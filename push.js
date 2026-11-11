// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Push notifications (one a day, even when the app is closed).
//
// A page cannot wake itself up; the notification has to come from a server. The
// small Worker in `worker/push-worker.js` holds the subscriptions and runs the
// daily cron. Its URL and the VAPID public key are saved on the phone (Settings →
// Roz yaad dehani → Push) — no code change needed after the worker is deployed.

const STORE = 'tc.pushConfig';

// Optional defaults, if you would rather ship them with the app.
const ENDPOINT = '';
const PUBLIC_KEY = '';

export function config() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (raw && typeof raw === 'object' && raw.endpoint && raw.key) {
      return { endpoint: String(raw.endpoint), key: String(raw.key) };
    }
  } catch (error) {
    /* private mode */
  }
  return { endpoint: ENDPOINT, key: PUBLIC_KEY };
}

export function saveConfig(endpoint, key) {
  const value = {
    endpoint: String(endpoint || '').trim().replace(/\/+$/, ''),
    key: String(key || '').trim(),
  };
  try {
    localStorage.setItem(STORE, JSON.stringify(value));
  } catch (error) {
    /* private mode */
  }
  return value;
}

export function configured() {
  const { endpoint, key } = config();
  return Boolean(endpoint && key);
}

function toBytes(base64url) {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function supported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function post(path, payload) {
  const { endpoint } = config();
  const response = await fetch(`${endpoint}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json().catch(() => ({}));
}

/** Ask permission, subscribe, and tell the Worker the hour to send at. */
export async function enable(hour, body) {
  const settings = config();
  if (!settings.endpoint || !settings.key) return { ok: false, reason: 'config' };
  if (!supported()) return { ok: false, reason: 'unsupported' };

  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toBytes(settings.key),
      });
    }

    await post('/subscribe', {
      subscription: subscription.toJSON(),
      hour: String(hour || '20:00').slice(0, 2),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      body: body || '',
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error && error.message ? error.message : 'error' };
  }
}

/** Stop the daily push and forget the subscription on the Worker. */
export async function disable() {
  if (!supported()) return { ok: false, reason: 'unsupported' };
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      if (configured()) {
        await post('/unsubscribe', { endpoint: subscription.endpoint }).catch(() => {});
      }
      await subscription.unsubscribe();
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error && error.message ? error.message : 'error' };
  }
}

export async function isSubscribed() {
  if (!supported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    return Boolean(await registration.pushManager.getSubscription());
  } catch (error) {
    return false;
  }
}
