// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Murajaa — what to revise today, and when to hear it again. (Premium.)
//
// Every checked aya is put on a small spaced-repetition schedule:
//   1 → 3 → 7 → 14 → 30 days
// A good check (90%+) moves it forward; a weak one brings it back tomorrow.
// Everything is stored on the phone (tc.murajaa); the scores come from the
// report data that every check already writes.

import { t, getLanguage } from './i18n.js';
import { surahName } from './surahs.js';
import { reportAyat } from './premium-tools.js';
import { markOf, isStarred } from './progress.js';

const KEY = 'tc.murajaa';
const INTERVALS = [1, 3, 7, 14, 30];

/**
 * Only what was memorised goes on the Murajaa list. Checking (just reciting)
 * an aya is not enough: the person marks it ✓ Yaad hai / ↺ Dobara, or ★, and
 * that is what puts it here. Reading it once must never queue it.
 */
export function isHifz(key) {
  return markOf(key) !== 'none' || isStarred(key);
}

export function dayKey(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') return raw;
  } catch (error) {
    /* ignore */
  }
  return {};
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (error) {
    /* private mode */
  }
}

function scoreOf(item) {
  return item && typeof item.score === 'number' ? item.score : 0;
}

function ageOf(item) {
  const at = (item && item.at) || 0;
  return at ? (Date.now() - at) / 86400000 : 999;
}

function refLabel(key) {
  const [surah, aya] = String(key).split(':').map(Number);
  if (!surah || !aya) return key;
  return `${surahName(surah)} ${surah}:${aya}`;
}

/**
 * Ayaat worth revising today, weakest first.
 * @returns {Array<{key,score,age,ghalti,chhoot,step,due,reason}>}
 */
export function dueList(limit = 60) {
  const today = dayKey();
  const schedule = read();
  const ayat = reportAyat() || {};
  const out = [];

  for (const [key, item] of Object.entries(ayat)) {
    if (!isHifz(key)) continue;
    const planned = schedule[key];
    if (planned && planned.due && planned.due > today) continue;

    const score = scoreOf(item);
    const age = ageOf(item);
    // A fresh, well-read aya does not need revision yet.
    if (!planned && score >= 85 && age <= 7) continue;

    let reason = 'old';
    if (score < 85) reason = 'weak';
    else if (planned) reason = 'scheduled';

    out.push({
      key,
      score,
      age,
      ghalti: (item && item.ghalti) || 0,
      chhoot: (item && item.chhoot) || 0,
      step: planned && typeof planned.step === 'number' ? planned.step : -1,
      due: planned ? planned.due : today,
      reason,
    });
  }

  // Ayaat that were scheduled earlier but have no report row any more.
  for (const [key, planned] of Object.entries(schedule)) {
    if (ayat[key]) continue;
    if (!isHifz(key)) continue;
    if (planned && planned.due && planned.due <= today) {
      out.push({
        key,
        score: typeof planned.score === 'number' ? planned.score : 0,
        age: 0,
        ghalti: 0,
        chhoot: 0,
        step: planned.step || 0,
        due: planned.due,
        reason: 'scheduled',
      });
    }
  }

  const rank = { weak: 0, scheduled: 1, old: 2 };
  return out
    .sort(
      (a, b) =>
        rank[a.reason] - rank[b.reason] || a.score - b.score || b.age - a.age
    )
    .slice(0, limit);
}

export function dueCount() {
  return dueList(999).length;
}

/** "Yaad tha" — push the aya to the next interval. Returns the new due date. */
export function markDone(key) {
  const schedule = read();
  const today = dayKey();
  const item = schedule[key] || { step: -1, due: today };
  const step = Math.min(INTERVALS.length - 1, (typeof item.step === 'number' ? item.step : -1) + 1);

  item.step = step;
  item.due = addDays(today, INTERVALS[Math.max(0, step)]);
  item.at = new Date().toISOString();
  schedule[key] = item;
  write(schedule);
  return item.due;
}

/** After a check: good scores move forward, weak ones come back tomorrow. */
export function updateFromCheck(entries) {
  const list = (entries || []).filter((entry) => entry && entry.key && isHifz(entry.key));
  if (!list.length) return;

  const schedule = read();
  const today = dayKey();

  for (const entry of list) {
    const score = Math.max(0, Math.min(100, Math.round(Number(entry.score) || 0)));
    const item = schedule[entry.key] || { step: -1, due: today };

    if (score >= 90) {
      item.step = Math.min(
        INTERVALS.length - 1,
        (typeof item.step === 'number' ? item.step : -1) + 1
      );
    } else if (score < 85) {
      item.step = -1;
    }

    item.due = addDays(today, INTERVALS[Math.max(0, typeof item.step === 'number' ? item.step : 0)]);
    item.at = new Date().toISOString();
    item.score = score;
    schedule[entry.key] = item;
  }

  write(schedule);
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function niceDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  try {
    return new Date(y, m - 1, d).toLocaleDateString(getLanguage() === 'ur' ? 'ur-PK' : 'en-GB', {
      day: 'numeric',
      month: 'short',
    });
  } catch (error) {
    return key;
  }
}

/** Mount the Murajaa screen; `openAya(surah, aya)` jumps into the reader. */
export function mountMurajaa(root, options = {}) {
  if (!root) return { refresh() {} };
  const openAya = typeof options.openAya === 'function' ? options.openAya : null;
  const onDone = typeof options.onDone === 'function' ? options.onDone : () => {};

  function build() {
    root.innerHTML = '';
    root.className = 'murajaa';

    const rows = dueList();
    const head = el('div', 'murajaa-head');
    head.appendChild(el('strong', 'murajaa-count', String(rows.length)));
    head.appendChild(el('span', 'murajaa-sub', t('murajaa.hint2')));
    root.appendChild(head);

    if (!rows.length) {
      root.appendChild(el('p', 'murajaa-empty', t('murajaa.empty')));
      return;
    }

    const list = el('div', 'murajaa-list');
    for (const row of rows) {
      const item = el('div', 'murajaa-row');

      const main = el('div', 'murajaa-main');
      main.appendChild(el('strong', 'murajaa-ref', refLabel(row.key)));

      const bits = [`${row.score}%`];
      if (row.ghalti || row.chhoot) bits.push(`${row.ghalti + row.chhoot} ${t('murajaa.mistakes')}`);
      const days = Math.max(0, Math.round(row.age));
      bits.push(days <= 0 ? t('murajaa.today') : t('murajaa.daysAgo', { days }));
      main.appendChild(el('span', 'murajaa-meta', bits.join(' · ')));

      if (row.reason === 'weak') main.appendChild(el('span', 'murajaa-tag', t('murajaa.weak')));
      else if (row.reason === 'old') main.appendChild(el('span', 'murajaa-tag', t('murajaa.old')));

      const actions = el('div', 'murajaa-actions');
      const read = el('button', 'btn small', t('murajaa.read'));
      read.type = 'button';
      const [surah, aya] = row.key.split(':').map(Number);
      if (openAya && surah && aya) {
        read.addEventListener('click', () => openAya(surah, aya));
      } else {
        read.disabled = true;
      }

      const done = el('button', 'btn ghost small', t('murajaa.done'));
      done.type = 'button';
      done.addEventListener('click', () => {
        const due = markDone(row.key);
        build();
        onDone({ key: row.key, due });
      });

      actions.append(read, done);
      item.append(main, actions);
      list.appendChild(item);
    }
    root.appendChild(list);
    root.appendChild(el('p', 'hint', t('murajaa.repeat')));
  }

  build();
  return { refresh: build };
}

export { niceDate };
