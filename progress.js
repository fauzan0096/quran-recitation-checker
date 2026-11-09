// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
// Local practice record: per-aya mark, bookmark, last score and day streak.
// Everything lives in one localStorage key and never leaves the device.

const KEY = 'tc.progress';
const MAX_DAYS = 180;

export const MARKS = ['none', 'ok', 'redo'];

let data = null;

function blank() {
  return { ayat: {}, days: [], last: null };
}

function load() {
  if (data) return data;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      data = {
        ayat: raw.ayat && typeof raw.ayat === 'object' ? raw.ayat : {},
        days: Array.isArray(raw.days) ? raw.days.filter((day) => typeof day === 'string') : [],
        last: typeof raw.last === 'string' ? raw.last : null,
      };
    } else {
      data = blank();
    }
  } catch (error) {
    data = blank();
  }
  return data;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(load()));
  } catch (error) {
    /* private mode: keep it in memory only */
  }
}

function entry(key) {
  const store = load();
  if (!store.ayat[key] || typeof store.ayat[key] !== 'object') {
    store.ayat[key] = { mark: 'none', star: false, score: null, at: 0 };
  }
  return store.ayat[key];
}

function dayString(date) {
  const d = date || new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function byRef(a, b) {
  const [sa, aa] = a.split(':').map(Number);
  const [sb, ab] = b.split(':').map(Number);
  return sa * 1000 + aa - (sb * 1000 + ab);
}

export function markOf(key) {
  return entry(key).mark || 'none';
}

export function isStarred(key) {
  return Boolean(entry(key).star);
}

export function scoreOf(key) {
  const score = entry(key).score;
  return typeof score === 'number' ? score : null;
}

/** none → ok → redo → none. */
export function cycleMark(key) {
  const item = entry(key);
  item.mark = item.mark === 'ok' ? 'redo' : item.mark === 'redo' ? 'none' : 'ok';
  item.at = Date.now();
  save();
  return item.mark;
}

export function toggleStar(key) {
  const item = entry(key);
  item.star = !item.star;
  item.at = Date.now();
  save();
  return item.star;
}

/** Remember the last score of an aya and count the day as practised. */
export function setScore(key, score) {
  const item = entry(key);
  item.score = Math.max(0, Math.min(100, Math.round(score)));
  item.at = Date.now();

  const store = load();
  const today = dayString();
  if (!store.days.includes(today)) {
    store.days.push(today);
    store.days.sort();
    if (store.days.length > MAX_DAYS) store.days = store.days.slice(-MAX_DAYS);
  }
  save();
}

export function setResume(key) {
  if (!key) return;
  load().last = key;
  save();
}

export function resumeKey() {
  return load().last;
}

function streakOf(days) {
  if (!days.length) return 0;
  const seen = new Set(days);
  const cursor = new Date();
  // Today may not be practised yet — yesterday still keeps the streak alive.
  if (!seen.has(dayString(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (seen.has(dayString(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function stats() {
  const store = load();
  let ok = 0;
  let redo = 0;
  let star = 0;
  let checked = 0;
  let sum = 0;
  for (const key of Object.keys(store.ayat)) {
    const item = store.ayat[key];
    if (!item || typeof item !== 'object') continue;
    if (item.mark === 'ok') ok += 1;
    if (item.mark === 'redo') redo += 1;
    if (item.star) star += 1;
    if (typeof item.score === 'number') {
      checked += 1;
      sum += item.score;
    }
  }
  return {
    ok,
    redo,
    star,
    checked,
    average: checked ? Math.round(sum / checked) : 0,
    streak: streakOf(store.days),
    days: store.days.length,
  };
}

/** 'star' | 'ok' | 'redo' → sorted aya references. */
export function listOf(kind) {
  const store = load();
  return Object.keys(store.ayat)
    .filter((key) => {
      const item = store.ayat[key];
      if (!item || typeof item !== 'object') return false;
      if (kind === 'star') return Boolean(item.star);
      return item.mark === kind;
    })
    .sort(byRef);
}

export function clearAll() {
  data = blank();
  save();
}
