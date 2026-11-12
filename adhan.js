// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Azaan (adhan) — a free recording played at the exact prayer time.
//
// The four recordings are from Wikimedia Commons and are free to use as long as
// they are credited and not sold: one is public domain (CC0), the others are
// CC BY-SA. Attribution is shown in Settings and in LICENSES.md. Ogg files do
// not play on iPhone, so iOS picks the mp3/wav ones.
//
// Timing: `arm()` sets a single timer for the exact second of the next prayer
// (a 60-second poll was up to a minute late and kept running all day). `check()`
// stays as the catch-up for when the phone was asleep or the app was in the
// background, and it never plays the same prayer twice in a day.
//
// Browsers only start sound after the person has touched the page once, so
// `unlock()` is called from the first tap and keeps one audio element alive for
// the whole session — that element is the one that plays at prayer time.

import { prayerTimes } from './prayer.js';

const KEY = 'tc.adhan';
const DAY_KEY = 'tc.adhanPlayed';

// A prayer still counts as "now" this many minutes after its time: the phone
// may have slept through it or the app may be opened a little late.
const WINDOW = 15;

const ORDER = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

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
  if (on) prime();
  else {
    stop();
    disarm();
  }
}

export function setId(id) {
  save({ ...load(), id: ADHANS[id] ? id : DEFAULT });
  audioSrc = '';
  prime();
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

// ------------------------------------------- a recording of your own
// Kept in IndexedDB (a Blob survives restarts), so a person can use their own
// muazzin's mp3 or mp4 even when the Wikimedia links do not play for them.
const DB_NAME = 'bayyin-adhan';
const STORE_NAME = 'files';
const FILE_KEY = 'mine';

let localUrl = '';
let localReady = null;

function openDb() {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

async function readLocalFile() {
  if (localUrl) return localUrl;
  if (!localReady) {
    localReady = (async () => {
      try {
        const db = await openDb();
        const blob = await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const request = tx.objectStore(STORE_NAME).get(FILE_KEY);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        });
        if (blob instanceof Blob) localUrl = URL.createObjectURL(blob);
      } catch (error) {
        localUrl = '';
      }
      return localUrl;
    })();
  }
  return localReady;
}

/** Keep the person's own file; it is used before any internet recording. */
export async function saveLocalFile(file) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(file, FILE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  if (localUrl) URL.revokeObjectURL(localUrl);
  localUrl = '';
  localReady = null;
  audioSrc = '';
  await readLocalFile();
  prime();
}

export async function clearLocalFile() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(FILE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    /* nothing stored */
  }
  if (localUrl) URL.revokeObjectURL(localUrl);
  localUrl = '';
  localReady = null;
  audioSrc = '';
}

export async function hasLocalFile() {
  return Boolean(await readLocalFile());
}

// ------------------------------------------------------------------ sound
// One element for the whole session: on iOS a new Audio() object has to earn
// its own "user touched the page" permission, a reused one does not.
let audio = null;
let audioSrc = '';
let unlocking = false;

function element() {
  if (audio) return audio;
  try {
    audio = new Audio();
  } catch (error) {
    return null;
  }
  audio.preload = 'auto';
  audio.addEventListener('ended', () => {
    try {
      audio.currentTime = 0;
    } catch (error) {
      /* not loaded */
    }
  });
  return audio;
}

/** A 10 ms silent WAV, used to open the browser's audio door on the first tap. */
function silentSource() {
  try {
    const rate = 8000;
    const samples = 80;
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const text = (offset, value) => {
      for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
    };
    text(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, 'data');
    view.setUint32(40, samples * 2, true);
    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  } catch (error) {
    return '';
  }
}

/** Call from the first tap or key press: browsers allow sound only after one. */
export function unlock() {
  const el = element();
  if (!el) return false;
  if (playing()) return true; // already sound on this page: nothing to unlock

  try {
    const silent = silentSource();
    if (!silent) return false;
    if (audioSrc && !el.paused) return true;
    el.muted = true;
    const previous = audioSrc;
    el.src = silent;
    unlocking = true;
    const started = el.play();
    if (started && typeof started.catch === 'function') started.catch(() => {});
    // The silent file is 10 ms long; put the real one back right away so the
    // first azaan is not waiting for a download. `play()` cancels this first,
    // so a test tap on the same gesture is never cut off.
    window.setTimeout(() => {
      if (!unlocking) return;
      unlocking = false;
      try {
        el.pause();
        el.muted = false;
        audioSrc = previous;
        if (previous) el.src = previous;
        el.load();
      } catch (error) {
        /* ignore */
      }
    }, 60);
    return true;
  } catch (error) {
    return false;
  }
}

/** Start downloading the chosen recording, so prayer time is instant. */
export function prime() {
  const s = load();
  if (!s.on) return;
  const el = element();
  if (!el) return;
  readLocalFile()
    .then((local) => {
      const url = local || current().url;
      if (!url || audioSrc === url) return;
      audioSrc = url;
      try {
        el.src = url;
        el.load();
      } catch (error) {
        audioSrc = '';
      }
    })
    .catch(() => {});
}

export function stop() {
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch (error) {
    /* already gone */
  }
}

/** Play the chosen azaan; resolves false when the browser refuses the sound. */
export async function play() {
  const el = element();
  if (!el) return false;
  unlocking = false;

  // Your own file first; otherwise the chosen muazzin, then the others in case
  // a host does not answer on this phone.
  const local = await readLocalFile();
  const first = current().url;
  const urls = local ? [local] : [first, ...fallbackUrls(first)];

  for (const url of urls) {
    if (!url) continue;
    audioSrc = url;
    try {
      el.src = url;
    } catch (error) {
      /* the next one may work */
    }
    try {
      el.currentTime = 0;
    } catch (error) {
      /* not loaded yet: it starts from the beginning anyway */
    }
    el.muted = false;
    el.volume = 1;

    // Make it a real media session, so the phone keeps the azaan going when the
    // screen locks or the app is in the background.
    try {
      if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Azaan',
          artist: 'Bayyin (بيّن)',
        });
      }
    } catch (error) {
      /* not supported */
    }

    try {
      await el.play();
      return true;
    } catch (error) {
      // "Not allowed" is the browser blocking sound (no tap yet), not a bad
      // file: another recording will not help.
      if (error && (error.name === 'NotAllowedError' || error.name === 'AbortError')) return false;
    }
  }
  return false;
}

/** The other recordings, mp3/wav first (ogg does not play on iPhone). */
function fallbackUrls(first) {
  const order = { mp3: 0, wav: 1, ogg: 2, oga: 3 };
  return Object.values(ADHANS)
    .filter((item) => item.url && item.url !== first)
    .sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9))
    .map((item) => item.url);
}

export function playing() {
  return Boolean(audio && !audio.paused && !audio.muted);
}

// ----------------------------------------------------------------- timing

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function playedToday(today) {
  try {
    const raw = JSON.parse(localStorage.getItem(DAY_KEY) || 'null');
    if (raw && raw.day === today && raw.names && typeof raw.names === 'object') return raw.names;
  } catch (error) {
    /* private mode */
  }
  return {};
}

function markPlayed(today, names) {
  try {
    localStorage.setItem(DAY_KEY, JSON.stringify({ day: today, names }));
  } catch (error) {
    /* private mode */
  }
}

/** The prayer whose time has just come, if it has not been played today. */
export function check(lat, lon, hanafi) {
  const s = load();
  if (!s.on || !lat || !lon) return '';

  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const times = prayerTimes(lat, lon, hanafi !== false, now);
  const today = todayKey();
  const played = playedToday(today);

  for (const name of ORDER) {
    const at = times[name];
    if (at === null || at === undefined) continue;
    const gap = minutes - at;
    if (gap < 0 || gap > WINDOW) continue;
    if (played[name]) continue;

    markPlayed(today, { ...played, [name]: true });
    play();
    return name;
  }
  return '';
}

// ------------------------------------------------------------------ timer
let timer = null;

export function disarm() {
  if (timer) {
    window.clearTimeout(timer);
    timer = null;
  }
}

/**
 * One timer for the exact second of the next prayer. It re-arms itself after
 * each one, and returns the name of the prayer it armed for.
 */
export function arm(lat, lon, hanafi) {
  disarm();
  const s = load();
  if (!s.on || !lat || !lon) return '';

  const now = new Date();
  const times = prayerTimes(lat, lon, hanafi !== false, now);
  const current = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  let next = null;
  for (const name of ORDER) {
    const at = times[name];
    if (at === null || at === undefined) continue;
    if (at > current && (!next || at < next.at)) next = { name, at };
  }

  if (!next) {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const ahead = prayerTimes(lat, lon, hanafi !== false, tomorrow);
    if (ahead.fajr === null || ahead.fajr === undefined) return '';
    next = { name: 'fajr', at: 1440 + ahead.fajr };
  }

  const delay = Math.max(1000, Math.round((next.at - current) * 60000));
  timer = window.setTimeout(() => {
    timer = null;
    check(lat, lon, hanafi);
    arm(lat, lon, hanafi);
  }, Math.min(delay, 2147000000));
  return next.name;
}

export function armedFor() {
  return timer ? true : false;
}
