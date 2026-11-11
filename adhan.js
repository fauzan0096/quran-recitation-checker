// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Azaan (adhan) — a free recording played at prayer time while the app is open.
//
// The four recordings are from Wikimedia Commons and are free to use as long as
// they are credited and not sold: one is public domain (CC0), the others are
// CC BY-SA. Attribution is shown in Settings and in LICENSES.md. Ogg files do
// not play on iPhone, so iOS picks the mp3/wav ones.

import { prayerTimes } from './prayer.js';

const KEY = 'tc.adhan';
const DAY_KEY = 'tc.adhanPlayed';

export const ADHANS = {
  aaqib: {
    name: 'Adhan — Aaqib Azeez',
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3',
    type: 'mp3',
    credit: 'Aaqib Azeez (Atcovi), CC BY-SA 4.0 — Wikimedia Commons',
  },
  hassan: {
    name: 'Adhan — Hassan II Mosque',
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Llamada_a_oraci%C3%B3n_Mezquita_Hassan_II.wav',
    type: 'wav',
    credit: 'Fraguando, CC BY-SA 4.0 — Wikimedia Commons',
  },
  adhan: {
    name: 'Adhan (public domain)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Adhan.ogg',
    type: 'ogg',
    credit: 'Aishatu98, CC0 — Wikimedia Commons',
  },
  wiki: {
    name: 'Adhan — Jarih',
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/16/Adhan_wiki.oga',
    type: 'oga',
    credit: 'Jarih, CC BY-SA 3.0 — Wikimedia Commons',
  },
};

const DEFAULT = 'aaqib';

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object' && ADHANS[raw.id]) {
      return { on: Boolean(raw.on), id: raw.id };
    }
  } catch (error) {
    /* private mode */
  }
  return { on: false, id: DEFAULT };
}

function save(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (error) {
    /* private mode */
  }
}

export function state() {
  return load();
}

export function setOn(on) {
  save({ ...load(), on: Boolean(on) });
}

export function setId(id) {
  save({ ...load(), id: ADHANS[id] ? id : DEFAULT });
}

export function list() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  return Object.entries(ADHANS)
    .filter(([, item]) => !ios || item.type === 'mp3' || item.type === 'wav')
    .map(([id, item]) => ({ id, name: item.name, credit: item.credit }));
}

export function current() {
  const s = load();
  return ADHANS[s.id] || ADHANS[DEFAULT];
}

let audio = null;

export function stop() {
  if (audio) {
    try {
      audio.pause();
    } catch (error) {
      /* already gone */
    }
    audio = null;
  }
}

/** Play the chosen azaan; resolves false when the file cannot be loaded. */
export function play() {
  stop();
  const item = current();
  try {
    audio = new Audio(item.url);
  } catch (error) {
    return false;
  }
  audio.preload = 'auto';
  audio.addEventListener('ended', stop);
  const started = audio.play();
  if (started && typeof started.catch === 'function') {
    started.catch(() => stop());
  }
  return true;
}

export function playing() {
  return Boolean(audio && !audio.paused);
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Called while the app is open: play the azaan when a prayer time arrives. */
export function check(lat, lon, hanafi) {
  const s = load();
  if (!s.on || !lat || !lon) return false;

  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const times = prayerTimes(lat, lon, hanafi !== false, now);
  const today = todayKey();

  let played = {};
  try {
    const raw = JSON.parse(localStorage.getItem(DAY_KEY) || 'null');
    if (raw && raw.day === today && raw.names) played = raw.names;
  } catch (error) {
    played = {};
  }

  const order = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  for (const name of order) {
    const at = times[name];
    if (at === null || at === undefined) continue;
    if (minutes < at || minutes - at > 12) continue; // within 12 minutes of the time
    if (played[name]) continue;

    played[name] = true;
    try {
      localStorage.setItem(DAY_KEY, JSON.stringify({ day: today, names: played }));
    } catch (error) {
      /* private mode */
    }
    play();
    return true;
  }
  return false;
}
