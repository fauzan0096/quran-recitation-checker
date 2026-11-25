// © 2026 F A FS — Bayyin (بيّن). All rights reserved.
//
// Bayyin — push Worker (Cloudflare Workers, free plan).
//
// What it does
//   1. POST /subscribe   — stores a browser push subscription, the time to send
//                          the daily reminder, the time zone and a week of
//                          prayer times. Returns { ok: true }.
//   2. POST /unsubscribe — forgets it.
//   3. POST /test        — one push right now, so the setup can be checked.
//   4. Cron (every minute) — sends an encrypted push with its own title and text:
//                          the azaan at the exact prayer minute, the daily
//                          reminder at the person's own time, and Roz ki Naiki
//                          at 08:00 local.
//
// Every push carries a payload (RFC 8291 / aes128gcm), so a prayer notification
// says "Azaan — Fajr" instead of the daily text, and it is sent with
// Urgency: high so the phone does not batch it for later.
//
// Settings are read from the environment first and then from KV (KV survives
// every deploy, while dashboard "variables" are replaced by wrangler on a Git
// deploy):
//   VAPID_PUBLIC   base64url public key      (from push-setup.html)
//   VAPID_PRIVATE  the private JWK, as JSON  (from push-setup.html)
//   VAPID_SUBJECT  mailto:you@example.com

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

function base64urlToBytes(text) {
  const padded = String(text || '').replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Environment variables first, then the KV entries (which deploys cannot wipe). */
async function settings(env) {
  const found = {
    publicKey: String(env.VAPID_PUBLIC || '').trim(),
    privateKey: String(env.VAPID_PRIVATE || '').trim(),
    subject: String(env.VAPID_SUBJECT || '').trim(),
  };

  if (found.publicKey && found.privateKey && found.subject) return found;
  if (!env.SUBS) return found;

  try {
    const [pub, priv, sub] = await Promise.all([
      env.SUBS.get('VAPID_PUBLIC'),
      env.SUBS.get('VAPID_PRIVATE'),
      env.SUBS.get('VAPID_SUBJECT'),
    ]);
    return {
      publicKey: found.publicKey || String(pub || '').trim(),
      privateKey: found.privateKey || String(priv || '').trim(),
      subject: found.subject || String(sub || '').trim(),
    };
  } catch (error) {
    return found;
  }
}

function privateKeyState(text) {
  if (!text) return 'missing';
  try {
    const parsed = JSON.parse(String(text).trim());
    return parsed && parsed.d ? 'ok' : 'invalid';
  } catch (error) {
    return 'invalid-json';
  }
}

async function vapidHeaders(origin, config) {
  const header = base64url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    encoder.encode(
      JSON.stringify({
        aud: origin,
        exp: now + 12 * 60 * 60,
        sub: config.subject || 'mailto:bayyin@example.com',
      })
    )
  );
  const unsigned = `${header}.${payload}`;

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(String(config.privateKey).trim()),
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
  return { Authorization: `vapid t=${jwt}, k=${config.publicKey}`, TTL: '600' };
}

// ------------------------------------------------------- encrypted payload
// RFC 8291 (message encryption) with RFC 8188's aes128gcm content encoding.

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

async function encryptPayload(subscription, text) {
  const keys = subscription.keys || {};
  const uaPublicRaw = base64urlToBytes(keys.p256dh);
  const authSecret = base64urlToBytes(keys.auth);

  const uaPublic = await crypto.subtle.importKey(
    'raw',
    uaPublicRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const asKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPublic }, asKeys.privateKey, 256)
  );
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // aes128gcm key + nonce, derived from the subscription's auth secret.
  const keyInfo = concatBytes(encoder.encode('WebPush: info\u0000'), uaPublicRaw, asPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\u0000'), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\u0000'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      aes,
      concatBytes(encoder.encode(text), new Uint8Array([2]))
    )
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  const header = concatBytes(salt, recordSize, new Uint8Array([asPublic.length]), asPublic);
  return concatBytes(header, cipher);
}

async function send(subscription, config, payload) {
  const endpoint = new URL(subscription.endpoint);
  const headers = await vapidHeaders(`${endpoint.protocol}//${endpoint.host}`, config);
  // High urgency: the device wakes for it instead of batching it for later.
  headers.Urgency = 'high';

  let body;
  if (payload && subscription.keys && subscription.keys.p256dh && subscription.keys.auth) {
    body = await encryptPayload(subscription, JSON.stringify(payload));
    headers['Content-Encoding'] = 'aes128gcm';
    headers['Content-Type'] = 'application/octet-stream';
  }

  const response = await fetch(subscription.endpoint, { method: 'POST', headers, body });
  return response.status;
}

/** Send once and say what happened: ok, fail, or gone (subscription dead). */
async function deliver(subscription, config, payload) {
  try {
    const status = await send(subscription, config, payload);
    if (status === 404 || status === 410) return 'gone';
    return status >= 200 && status < 300 ? 'ok' : 'fail';
  } catch (error) {
    return 'fail';
  }
}

function toMinutes(text) {
  const [h, m] = String(text || '0:0')
    .split(':')
    .map(Number);
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

/** Local date and HH:MM in the subscriber's time zone. */
function localNow(timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (type) => (parts.find((part) => part.type === type) || {}).value || '';
    const hour = String(get('hour')).padStart(2, '0');
    const minute = String(get('minute')).padStart(2, '0');
    return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${hour}:${minute}` };
  } catch (error) {
    const now = new Date();
    return {
      date: now.toISOString().slice(0, 10),
      time: `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`,
    };
  }
}

// --------------------------------------------------------------- payloads

const PRAYER_LABEL = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

function prayerPayload(name) {
  const label = PRAYER_LABEL[name] || 'Namaz';
  return {
    title: `Azaan — ${label}`,
    body: `${label} ka waqt ho gaya. Tap karein — azaan sunne ke liye.`,
    url: `./?adhan=${encodeURIComponent(name)}`,
    tag: `bayyin-azaan-${name}`,
    adhan: name,
    requireInteraction: true,
    vibrate: [180, 80, 180],
  };
}

function dailyPayload(saved) {
  const body = String((saved && saved.body) || '').trim();
  return {
    title: 'بيّن — Bayyin',
    body: body || 'Aaj ki aya, hadith aur sunnah parhein.',
    url: './?go=daily',
    tag: 'bayyin-daily',
  };
}

function naikiPayload(date) {
  // The subscriber's own date decides whether it is Jumu'ah for them.
  let friday = false;
  try {
    friday = new Date(`${date}T12:00:00Z`).getUTCDay() === 5;
  } catch (error) {
    friday = false;
  }
  return {
    title: friday ? 'Jumu’ah mubarak' : 'Roz ki Naiki',
    body: friday
      ? 'Aaj Surah Kahf parhein — Jumu’ah ki fazilat.'
      : 'Roz ki Naiki — aaj ki aya, hadith aur sunnah tayyar hain.',
    url: './?go=daily',
    tag: 'bayyin-naiki',
  };
}

// ------------------------------------------------------------------- the cron

/**
 * One phone: the azaan at its own minute, the daily reminder at the chosen time,
 * Roz ki Naiki in the morning. Kept out of the loop below so that a subscription
 * that cannot be delivered stops only itself.
 */
async function cronFor(env, config, name) {
  const raw = await env.SUBS.get(name);
  if (!raw) return;

  let saved;
  try {
    saved = JSON.parse(raw);
  } catch (error) {
    return;
  }
  if (!saved || !saved.subscription) return;

  const local = localNow(saved.timezone);
  const minute = toMinutes(local.time);
  let changed = false;

  // 1. The azaan at the prayer's own minute. Fifteen minutes of slack, so a cron
  //    that runs a few minutes late still announces the prayer — but a Worker
  //    that was down for an hour does not ring for a prayer that has passed.
  const prayers = Array.isArray(saved.prayers) ? saved.prayers : [];
  const done = Array.isArray(saved.sentPrayers) ? saved.sentPrayers : [];
  const due = prayers.find((prayer) => {
    if (!prayer || prayer.date !== local.date || !prayer.time) return false;
    if (done.includes(`${prayer.date} ${prayer.name}`)) return false;
    const gap = minute - toMinutes(prayer.time);
    return gap >= 0 && gap <= 15;
  });

  let sentPrayer = false;
  if (due) {
    const sent = await deliver(saved.subscription, config, prayerPayload(due.name));
    if (sent === 'gone') {
      await env.SUBS.delete(name);
      return;
    }
    if (sent === 'ok') {
      saved.sentPrayers = [...done, `${due.date} ${due.name}`].slice(-60);
      changed = true;
      sentPrayer = true;
    }
  }

  // 2. The daily reminder, once the person's own clock passes their time. Up to
  //    three hours late is still their evening reminder; after that it is dropped
  //    for today rather than arriving at midnight.
  const target = toMinutes(saved.time || '20:00');
  if (
    saved.daily !== false &&
    !sentPrayer &&
    saved.lastDay !== local.date &&
    minute >= target &&
    minute - target <= 180
  ) {
    const sent = await deliver(saved.subscription, config, dailyPayload(saved));
    if (sent === 'gone') {
      await env.SUBS.delete(name);
      return;
    }
    if (sent === 'ok') {
      saved.lastDay = local.date;
      changed = true;
    }
  }

  // 3. Roz ki Naiki in the morning (Surah Kahf on Friday). The window is wide
  //    (08:00–12:00), so a cron run that slips by a few minutes still delivers it
  //    the same morning instead of losing the day.
  if (
    saved.daily !== false &&
    saved.lastNaiki !== local.date &&
    minute >= 480 &&
    minute <= 720
  ) {
    const sent = await deliver(saved.subscription, config, naikiPayload(local.date));
    if (sent === 'gone') {
      await env.SUBS.delete(name);
      return;
    }
    if (sent === 'ok') {
      saved.lastNaiki = local.date;
      changed = true;
    }
  }

  if (changed) await env.SUBS.put(name, JSON.stringify(saved));
}

/**
 * The cron itself, every minute (see `crons` in wrangler.toml).
 *
 * A free-plan Worker may make about 50 outgoing requests per run, and one phone
 * costs a KV read plus a push. The run stops well before that and picks up from
 * the same place in the next minute, so nobody at the end of the list is starved.
 */
async function runCron(env) {
  const config = await settings(env);
  if (!config.publicKey || privateKeyState(config.privateKey) !== 'ok') return;
  if (!env.SUBS) return;

  // When this run started: `/status` shows it, so a late notification can be
  // told apart from one that never came.
  try {
    await env.SUBS.put('meta:lastCron', new Date().toISOString());
  } catch (error) {
    /* status only */
  }

  let budget = 40;
  let cursor = '';
  try {
    cursor = (await env.SUBS.get('meta:cursor')) || '';
  } catch (error) {
    cursor = '';
  }

  let pages = 0;
  while (budget > 0 && pages < 10) {
    pages += 1;
    let page;
    try {
      page = await env.SUBS.list({ prefix: 'sub:', limit: 200, cursor: cursor || undefined });
    } catch (error) {
      if (!cursor) return; // nothing to list at all
      cursor = ''; // a saved cursor can go stale: begin again from the top
      continue;
    }

    for (const item of page.keys) {
      if (budget <= 0) break;
      budget -= 2; // one KV read, one push
      try {
        await cronFor(env, config, item.name);
      } catch (error) {
        // One subscription that cannot be delivered must not stop the rest.
        console.warn('subscriber failed', item.name, String((error && error.message) || error));
      }
    }

    if (page.list_complete) {
      cursor = '';
      break;
    }
    cursor = page.cursor || '';
  }

  try {
    await env.SUBS.put('meta:cursor', cursor);
  } catch (error) {
    /* status only */
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return cors();

    const url = new URL(request.url);

    // Our own static files — today the speech library, so the app never asks a
    // CDN for the code that runs its model. `env.ASSETS` is the folder wrangler
    // uploads (`worker/public/`), filled by the deploy workflow from the upstream
    // package, so nothing large sits in git. The CORS header is what lets the app
    // `import()` the file from this origin, and the long cache means a phone
    // downloads it once and keeps it.
    if (url.pathname.startsWith('/ort/')) {
      if (!env.ASSETS) {
        return new Response('assets binding missing', { status: 503 });
      }
      const hit = await env.ASSETS.fetch(request);
      const out = new Response(hit.body, hit);
      out.headers.set('Access-Control-Allow-Origin', '*');
      out.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return out;
    }

    if (request.method === 'GET') {
      const config = await settings(env);
      if (url.pathname === '/vapid') return json({ key: config.publicKey || '' });

      // Diagnostics: open this URL in a browser to see whether the cron is
      // running and how many phones it holds. `lastCron` is the moment the last
      // run started — if that is minutes old while notifications are late, the
      // delay is Cloudflare's cron, not the app.
      if (url.pathname === '/status') {
        let subscribers = 0;
        let lastCron = '';
        let cursor = '';
        try {
          lastCron = (await env.SUBS.get('meta:lastCron')) || '';
          do {
            const page = await env.SUBS.list({ prefix: 'sub:', limit: 1000, cursor: cursor || undefined });
            subscribers += page.keys.length;
            cursor = page.list_complete ? '' : page.cursor || '';
          } while (cursor);
        } catch (error) {
          subscribers = -1; // KV not reachable
        }
        return json({
          ok: true,
          now: new Date().toISOString(),
          lastCron,
          subscribers,
          vapidPublic: Boolean(config.publicKey),
          vapidPrivate: privateKeyState(config.privateKey),
        });
      }
      return json({
        ok: true,
        service: 'bayyin-push',
        kv: Boolean(env.SUBS),
        vapidPublic: Boolean(config.publicKey),
        vapidPrivate: privateKeyState(config.privateKey),
        vapidSubject: Boolean(config.subject),
      });
    }

    if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

    let data = {};
    try {
      data = await request.json();
    } catch (error) {
      data = {};
    }

    if (url.pathname === '/subscribe') {
      const sub = data.subscription;
      if (!sub || !sub.endpoint) return json({ ok: false, error: 'no subscription' }, 400);
      if (!env.SUBS) return json({ ok: false, error: 'no KV' }, 500);

      const key = `sub:${base64url(encoder.encode(sub.endpoint))}`;
      // Keep what was already sent today: a re-sync must not repeat a
      // notification the person has already seen.
      const previous = await env.SUBS.get(key).catch(() => null);
      let old = {};
      try {
        old = previous ? JSON.parse(previous) : {};
      } catch (error) {
        old = {};
      }

      await env.SUBS.put(
        key,
        JSON.stringify({
          subscription: sub,
          time: String(data.time || old.time || '20:00').slice(0, 5),
          timezone: data.timezone || old.timezone || 'UTC',
          body: String(data.body || old.body || '').slice(0, 160),
          prayers: Array.isArray(data.prayers) ? data.prayers.slice(0, 70) : old.prayers || [],
          // false = this person only wants the azaan, not a daily reminder.
          daily: data.daily !== false,
          lastDay: old.lastDay || '',
          lastNaiki: old.lastNaiki || '',
          sentPrayers: Array.isArray(old.sentPrayers) ? old.sentPrayers : [],
        })
      );
      return json({ ok: true });
    }

    // The browser rotated this phone's push subscription (they expire on their
    // own): keep the person's time, time zone and prayer schedule instead of
    // starting again with the defaults.
    if (url.pathname === '/moved') {
      const sub = data.subscription;
      if (!sub || !sub.endpoint) return json({ ok: false, error: 'no subscription' }, 400);
      if (!env.SUBS) return json({ ok: false, error: 'no KV' }, 500);

      let old = {};
      const oldEndpoint = String(data.oldEndpoint || '');
      if (oldEndpoint) {
        const oldKey = `sub:${base64url(encoder.encode(oldEndpoint))}`;
        const raw = await env.SUBS.get(oldKey).catch(() => null);
        try {
          old = raw ? JSON.parse(raw) : {};
        } catch (error) {
          old = {};
        }
        await env.SUBS.delete(oldKey).catch(() => {});
      }

      await env.SUBS.put(
        `sub:${base64url(encoder.encode(sub.endpoint))}`,
        JSON.stringify({
          subscription: sub,
          time: old.time || '20:00',
          timezone: old.timezone || 'UTC',
          body: old.body || '',
          prayers: Array.isArray(old.prayers) ? old.prayers : [],
          daily: old.daily !== false,
          lastDay: old.lastDay || '',
          lastNaiki: old.lastNaiki || '',
          sentPrayers: Array.isArray(old.sentPrayers) ? old.sentPrayers : [],
        })
      );
      return json({ ok: true });
    }

    if (url.pathname === '/unsubscribe') {
      if (!data.endpoint) return json({ ok: false, error: 'no endpoint' }, 400);
      await env.SUBS.delete(`sub:${base64url(encoder.encode(data.endpoint))}`);
      return json({ ok: true });
    }

    if (url.pathname === '/test') {
      if (!data.endpoint) return json({ ok: false, error: 'no endpoint' }, 400);
      const key = `sub:${base64url(encoder.encode(data.endpoint))}`;
      const raw = await env.SUBS.get(key);
      if (!raw) return json({ ok: false, error: 'not subscribed' }, 404);

      const config = await settings(env);
      if (!config.publicKey || privateKeyState(config.privateKey) !== 'ok') {
        return json({ ok: false, error: 'vapid not configured' }, 500);
      }
      try {
        const saved = JSON.parse(raw);
        const status = await send(saved.subscription, config, {
          title: 'بيّن — Bayyin',
          body: 'Test notification — sab theek hai.',
          url: './',
          tag: 'bayyin-test',
        });
        return json({ ok: status >= 200 && status < 300, status });
      } catch (error) {
        return json({ ok: false, error: String(error && error.message) }, 500);
      }
    }

    return json({ ok: false, error: 'unknown path' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCron(env));
  },
};
