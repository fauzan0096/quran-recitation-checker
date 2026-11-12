// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Push notifications (one a day, even when the app is closed).
//
// A page cannot wake itself up; the notification has to come from a server. The
// small Worker in `worker/push-worker.js` holds the subscriptions and runs the
// daily cron. Its URL and the VAPID public key are saved on the phone (Settings →
// Roz yaad dehani → Push) — no code change needed after the worker is deployed.

import { upcomingPrayers } from './prayer.js';

const STORE = 'tc.pushConfig';
// When the Worker last received this phone's prayer schedule. The Worker keeps
// about a week of prayer times, so the app sends them again every two days.
const SYNC = 'tc.pushSync';

// The Worker this app talks to (fixed, so nobody has to type it).
const ENDPOINT = 'https://bayyin-push.anbiyawarsatul.workers.dev';
// The VAPID public key (safe to ship: it is meant to be public).
const PUBLIC_KEY =
  'BJ3rZgQbKYGrS8oDBO1axJxzFybPMNi2WN7otPnCVd8WMxigLyqmyfDGEBiODBh5b_zv-JjkOB5B3BvOsm0WTOw';

export function config() {
  let saved = null;
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (raw && typeof raw === 'object' && raw.endpoint) {
      saved = {
        endpoint: String(raw.endpoint).trim().replace(/\/+$/, ''),
        key: String(raw.key || '').trim(),
      };
    }
  } catch (error) {
    /* private mode */
  }

  return {
    endpoint: ENDPOINT || (saved ? saved.endpoint : ''),
    key: PUBLIC_KEY || (saved ? saved.key : ''),
  };
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
  return Boolean(config().endpoint);
}

/** The VAPID public key: saved one, then the hard-coded one, then the Worker's. */
async function publicKey() {
  const settings = config();
  if (settings.key) return settings.key;

  try {
    const response = await fetch(`${settings.endpoint}/vapid`);
    const data = await response.json();
    const key = data && data.key ? String(data.key) : '';
    if (key) saveConfig(settings.endpoint, key);
    return key;
  } catch (error) {
    return '';
  }
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
export async function enable(hour, body, options = {}) {
  const settings = config();
  if (!settings.endpoint) return { ok: false, reason: 'config' };
  if (!supported()) return { ok: false, reason: 'unsupported' };

  const key = await publicKey();
  if (!key) return { ok: false, reason: 'config' };

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
        applicationServerKey: toBytes(key),
      });
    }

    await post('/subscribe', {
      subscription: subscription.toJSON(),
      time: String(hour || '20:00').slice(0, 5),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      body: body || '',
      prayers: upcomingPrayers(7),
      // false when only the azaan is wanted: no daily reminder then.
      daily: options.daily !== false,
    });
    markSynced();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error && error.message ? error.message : 'error' };
  }
}

function markSynced() {
  try {
    localStorage.setItem(SYNC, String(Date.now()));
  } catch (error) {
    /* private mode */
  }
}

function lastSynced() {
  try {
    return Number(localStorage.getItem(SYNC) || 0) || 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Send the prayer schedule again without asking for anything: the Worker's copy
 * runs out after a week, and a phone that is never re-registered would stop
 * getting prayer notifications on the eighth day.
 */
export async function refresh(hour, body, daily = true) {
  if (!supported() || !configured()) return { ok: false, reason: 'config' };
  if (Date.now() - lastSynced() < 2 * 86400000) return { ok: true, skipped: true };

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return { ok: false, reason: 'none' };

    await post('/subscribe', {
      subscription: subscription.toJSON(),
      time: String(hour || '20:00').slice(0, 5),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      body: body || '',
      prayers: upcomingPrayers(7),
      daily: daily !== false,
    });
    markSynced();
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

/** Ask the Worker to send one push right now, so the setup can be checked. */
export async function test() {
  if (!supported()) return { ok: false, reason: 'unsupported' };
  if (!configured()) return { ok: false, reason: 'config' };
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return { ok: false, reason: 'none' };
    const result = await post('/test', { endpoint: subscription.endpoint });
    return { ok: Boolean(result && result.ok), reason: result && result.error };
  } catch (error) {
    return { ok: false, reason: error && error.message ? error.message : 'error' };
  }
}
