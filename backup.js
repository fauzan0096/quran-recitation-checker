// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Back up and restore everything the app keeps in localStorage. Useful before
// changing phones or clearing browser data; the file stays on the device unless
// the person shares it.

const PREFIX = 'tc.';

export function collect() {
  const keys = {};
  let count = 0;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      keys[key] = localStorage.getItem(key);
      count += 1;
    }
  } catch (error) {
    return { ok: false, reason: 'storage' };
  }
  return { ok: true, count, payload: { app: 'bayyin', version: 1, at: new Date().toISOString(), keys } };
}

export function download() {
  const data = collect();
  if (!data.ok) return data;
  const blob = new Blob([JSON.stringify(data.payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const day = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `bayyin-backup-${day}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { ok: true, count: data.count };
}

/**
 * Send the same backup through the phone's share sheet (WhatsApp, Drive, AirDrop
 * …), so moving to a new phone does not depend on finding the Downloads folder.
 */
export async function share() {
  const data = collect();
  if (!data.ok) return data;
  const name = `bayyin-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const text = JSON.stringify(data.payload, null, 2);
  try {
    const file = new File([text], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: 'Bayyin backup' });
      return { ok: true, count: data.count };
    }
    if (navigator.share) {
      await navigator.share({ title: 'Bayyin backup', text });
      return { ok: true, count: data.count };
    }
  } catch (error) {
    return { ok: false, reason: 'share' };
  }
  return { ok: false, reason: 'share' };
}

export async function restore(file) {  if (!file) return { ok: false, reason: 'empty' };
  let parsed = null;
  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, reason: 'json' };
  }
  if (!parsed || parsed.app !== 'bayyin' || !parsed.keys || typeof parsed.keys !== 'object') {
    return { ok: false, reason: 'format' };
  }

  let count = 0;
  try {
    for (const [key, value] of Object.entries(parsed.keys)) {
      if (!key.startsWith(PREFIX)) continue;
      if (typeof value !== 'string') continue;
      localStorage.setItem(key, value);
      count += 1;
    }
  } catch (error) {
    return { ok: false, reason: 'quota' };
  }
  return { ok: true, count };
}
