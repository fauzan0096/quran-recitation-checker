// Bayyin — daily push Worker (Cloudflare Workers, free plan).
//
// What it does
//   1. POST /subscribe   — stores a browser push subscription, the hour to send at
//                          and the time zone. Returns { ok: true }.
//   2. POST /unsubscribe — forgets it.
//   3. Cron (hourly)     — sends an empty push to every subscription whose local
//                          hour matches, so the phone shows the notification even
//                          when the app is closed.
//
// You need three values set in the Worker (Settings → Variables):
//   VAPID_PUBLIC   base64url public key   (from push-setup.html)
//   VAPID_PRIVATE  the private JWK, as a JSON string  (from push-setup.html)
//   VAPID_SUBJECT  mailto:you@example.com
// and a KV namespace bound as SUBS.
//
// Deploy: workers.cloudflare.com → Create → Worker → paste this file → add the
// KV binding and variables → add a Cron Trigger "0 * * * *".

const encoder = new TextEncoder();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

function base64url(bytes) {
  let binary = '';
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function vapidHeaders(origin, env) {
  const header = base64url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    encoder.encode(
      JSON.stringify({
        aud: origin,
        exp: now + 12 * 60 * 60,
        sub: env.VAPID_SUBJECT || 'mailto:bayyin@example.com',
      })
    )
  );
  const unsigned = `${header}.${payload}`;

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(env.VAPID_PRIVATE),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(unsigned)
  );

  const jwt = `${unsigned}.${base64url(signature)}`;
  return { Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC}`, TTL: '86400' };
}

async function send(subscription, env) {
  const endpoint = new URL(subscription.endpoint);
  const headers = await vapidHeaders(`${endpoint.protocol}//${endpoint.host}`, env);
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers,
  });
  return response.status;
}

function localHour(timezone) {
  try {
    const text = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'UTC',
      hour: '2-digit',
      hour12: false,
    }).format(new Date());
    return String(Number(text)).padStart(2, '0');
  } catch (error) {
    return String(new Date().getUTCHours()).padStart(2, '0');
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return cors();
    if (request.method === 'GET') {
      // Health check: tells you which settings are actually wired up.
      return json({
        ok: true,
        service: 'bayyin-push',
        kv: Boolean(env.SUBS),
        vapidPublic: Boolean(env.VAPID_PUBLIC),
        vapidPrivate: Boolean(env.VAPID_PRIVATE),
        vapidSubject: Boolean(env.VAPID_SUBJECT),
      });
    }
    if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

    const url = new URL(request.url);
    let data = {};
    try {
      data = await request.json();
    } catch (error) {
      data = {};
    }

    if (url.pathname === '/subscribe') {
      const sub = data.subscription;
      if (!sub || !sub.endpoint) return json({ ok: false, error: 'no subscription' }, 400);
      const key = `sub:${base64url(encoder.encode(sub.endpoint))}`;
      await env.SUBS.put(
        key,
        JSON.stringify({
          subscription: sub,
          hour: String(data.hour || '20').padStart(2, '0'),
          timezone: data.timezone || 'UTC',
          body: String(data.body || '').slice(0, 160),
        })
      );
      return json({ ok: true });
    }

    if (url.pathname === '/unsubscribe') {
      if (!data.endpoint) return json({ ok: false, error: 'no endpoint' }, 400);
      await env.SUBS.delete(`sub:${base64url(encoder.encode(data.endpoint))}`);
      return json({ ok: true });
    }

    return json({ ok: false, error: 'unknown path' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const list = await env.SUBS.list({ prefix: 'sub:' });
        for (const item of list.keys) {
          const raw = await env.SUBS.get(item.name);
          if (!raw) continue;
          let saved;
          try {
            saved = JSON.parse(raw);
          } catch (error) {
            continue;
          }
          if (!saved || !saved.subscription) continue;
          if (localHour(saved.timezone) !== saved.hour) continue;

          try {
            const status = await send(saved.subscription, env);
            if (status === 404 || status === 410) await env.SUBS.delete(item.name);
          } catch (error) {
            /* transient: try again next hour */
          }
        }
      })()
    );
  },
};
