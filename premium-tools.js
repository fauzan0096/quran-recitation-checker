// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Premium report — three tools in one screen, all built from what the app has
// already stored on this phone (checks + progress). Nothing is uploaded:
//   Murajaa      — which ayaat need revising, low score / old checks first
//   Ghaltiyan    — the words that are most often wrong or left out
//   Tareekh      — a small day-by-day chart of how much was recited

import { t } from './i18n.js';
import { surahName } from './surahs.js';

const KEY = 'tc.report';
const MAX_WORDS = 120;
const MAX_DAYS = 90;
const CHART_DAYS = 14;

let data = null;

function blank() {
  return { days: {}, ayat: {}, words: [] };
}

function load() {
  if (data) return data;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      data = {
        days: raw.days && typeof raw.days === 'object' ? raw.days : {},
        ayat: raw.ayat && typeof raw.ayat === 'object' ? raw.ayat : {},
        words: Array.isArray(raw.words) ? raw.words : [],
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
    /* private mode: keep it in memory */
  }
}

function dayString(date) {
  const d = date || new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function refLabel(key) {
  const [surah, aya] = String(key).split(':').map(Number);
  if (!surah || !aya) return key;
  return `${surahName(surah)} ${surah}:${aya}`;
}

/**
 * Called after a finished check. `entries` is one item per aya:
 * { key: '2:255', score: 78, problems: [{ expected, heard, status }] }
 */
export function recordReport(entries) {
  const store = load();
  const day = dayString();
  let changed = false;

  for (const entry of entries || []) {
    if (!entry || !entry.key) continue;
    changed = true;

    const score = Math.max(0, Math.min(100, Math.round(Number(entry.score) || 0)));

    const box = store.days[day] || { n: 0, sum: 0 };
    box.n += 1;
    box.sum += score;
    store.days[day] = box;

    const aya = store.ayat[entry.key] || { score: 0, at: 0, n: 0, ghalti: 0, chhoot: 0 };
    aya.score = score;
    aya.at = Date.now();
    aya.n += 1;

    for (const problem of entry.problems || []) {
      if (!problem || !problem.expected) continue;
      if (problem.status === 'missing') aya.chhoot += 1;
      else aya.ghalti += 1;

      const found = store.words.find((w) => w.key === entry.key && w.word === problem.expected);
      if (found) {
        found.n += 1;
        found.heard = problem.heard || '';
        found.at = Date.now();
      } else {
        store.words.push({
          key: entry.key,
          word: problem.expected,
          heard: problem.heard || '',
          n: 1,
          at: Date.now(),
        });
      }
    }
    store.ayat[entry.key] = aya;
  }

  if (!changed) return;

  store.words.sort((a, b) => b.n - a.n || b.at - a.at);
  store.words = store.words.slice(0, MAX_WORDS);

  const days = Object.keys(store.days).sort();
  for (const old of days.slice(0, Math.max(0, days.length - MAX_DAYS))) delete store.days[old];

  save();
}

/** Ayaat worth hearing again: weak score, long gap, or words left out. */
export function murajaaList(limit = 12) {
  const now = Date.now();
  return Object.entries(load().ayat)
    .map(([key, aya]) => {
      const age = Math.max(0, (now - (aya.at || 0)) / 86400000);
      let weight = 0;
      if (aya.score < 50) weight += 4;
      else if (aya.score < 70) weight += 3;
      else if (aya.score < 85) weight += 2;
      else if (aya.score < 98) weight += 1;

      if (age > 21) weight += 3;
      else if (age > 10) weight += 2;
      else if (age > 4) weight += 1;

      if (aya.chhoot) weight += 1;

      return {
        key,
        score: aya.score,
        at: aya.at,
        age,
        ghalti: aya.ghalti || 0,
        chhoot: aya.chhoot || 0,
        weight,
      };
    })
    .filter((row) => row.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.score - b.score || a.at - b.at)
    .slice(0, limit);
}

/** The words heard wrong (or not heard at all) most often. */
export function mistakeList(limit = 14) {
  return [...load().words].sort((a, b) => b.n - a.n || b.at - a.at).slice(0, limit);
}

/** Last `count` days: how many checks and the average score of each day. */
export function historyDays(count = CHART_DAYS) {
  const store = load();
  const out = [];
  const today = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const key = dayString(day);
    const box = store.days[key];
    out.push({
      key,
      count: box ? box.n : 0,
      avg: box && box.n ? Math.round(box.sum / box.n) : 0,
    });
  }
  return out;
}

export function summary() {
  const store = load();
  const days = Object.keys(store.days);
  let checks = 0;
  let sum = 0;
  for (const key of days) {
    const box = store.days[key];
    if (!box) continue;
    checks += box.n || 0;
    sum += box.sum || 0;
  }
  const ayat = Object.values(store.ayat);
  return {
    checks,
    days: days.length,
    average: checks ? Math.round(sum / checks) : 0,
    weak: ayat.filter((aya) => aya.score < 85).length,
    words: store.words.length,
  };
}

export function reportText() {
  const totals = summary();
  const due = murajaaList(8);
  const mistakes = mistakeList(8);
  const lines = [t('rep.shareTitle'), ''];

  lines.push(
    t('rep.shareSummary', {
      checks: totals.checks,
      days: totals.days,
      avg: totals.average,
    })
  );

  if (due.length) {
    lines.push('', t('rep.tabMurajaa'));
    for (const row of due) lines.push(`• ${refLabel(row.key)} — ${row.score}%`);
  }
  if (mistakes.length) {
    lines.push('', t('rep.tabMistakes'));
    for (const row of mistakes) lines.push(`• ${row.word} — ${row.n}×`);
  }
  lines.push('', t('rep.shareFooter'));
  return lines.join('\n');
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Mount the report screen; `openAya(surah, aya)` jumps into the reader. */
export function mountReport(root, options = {}) {
  if (!root) return { refresh() {} };

  const openAya = typeof options.openAya === 'function' ? options.openAya : null;
  let tab = 'murajaa';

  function build() {
    root.innerHTML = '';
    root.className = 'report';

    const tabs = el('div', 'rep-tabs');
    const list = [
      ['murajaa', t('rep.tabMurajaa')],
      ['mistakes', t('rep.tabMistakes')],
      ['history', t('rep.tabHistory')],
    ];
    for (const [id, label] of list) {
      const button = el('button', `rep-tab${id === tab ? ' is-on' : ''}`, label);
      button.type = 'button';
      button.addEventListener('click', () => {
        tab = id;
        build();
      });
      tabs.appendChild(button);
    }

    const body = el('div', 'rep-body');
    if (tab === 'murajaa') paintMurajaa(body);
    else if (tab === 'mistakes') paintMistakes(body);
    else paintHistory(body);

    root.append(tabs, body);
  }

  function paintMurajaa(body) {
    body.appendChild(el('p', 'hint', t('rep.murajaaHint')));
    const rows = murajaaList(12);
    if (!rows.length) {
      body.appendChild(el('p', 'rep-empty', t('rep.emptyMurajaa')));
      return;
    }

    const list = el('div', 'rep-list');
    for (const row of rows) {
      const item = el('button', 'rep-row');
      item.type = 'button';
      const [surah, aya] = row.key.split(':').map(Number);
      if (openAya && surah && aya) {
        item.addEventListener('click', () => openAya(surah, aya));
      }

      const main = el('span', 'rep-main');
      main.appendChild(el('strong', '', refLabel(row.key)));
      const days = Math.max(0, Math.round(row.age));
      main.appendChild(
        el(
          'span',
          'rep-sub',
          t('rep.sub', {
            ghalti: row.ghalti + row.chhoot,
            when: days <= 0 ? t('rep.today') : t('rep.daysAgo', { days }),
          })
        )
      );

      item.append(main, el('span', `rep-score${row.score < 70 ? ' is-low' : ''}`, `${row.score}%`));
      list.appendChild(item);
    }
    body.appendChild(list);
  }

  function paintMistakes(body) {
    body.appendChild(el('p', 'hint', t('rep.mistakesHint')));
    const rows = mistakeList(14);
    if (!rows.length) {
      body.appendChild(el('p', 'rep-empty', t('rep.emptyMistakes')));
      return;
    }

    const list = el('div', 'rep-list');
    for (const row of rows) {
      const item = el('div', 'rep-word-row');
      const word = el('span', 'rep-word', row.word);
      word.lang = 'ar';
      word.dir = 'rtl';
      const heard = row.heard ? ` · ${t('rep.heard')}: ${row.heard}` : '';
      item.append(word, el('span', 'rep-meta', `${refLabel(row.key)} · ${row.n}×${heard}`));
      list.appendChild(item);
    }
    body.appendChild(list);

    const share = el('button', 'btn primary small', t('rep.share'));
    share.type = 'button';
    share.addEventListener('click', async () => {
      const text = reportText();
      try {
        if (navigator.share) {
          await navigator.share({ title: t('rep.shareTitle'), text });
          return;
        }
        await navigator.clipboard.writeText(text);
      } catch (error) {
        /* person closed the share sheet or clipboard is blocked */
      }
    });
    body.appendChild(share);
  }

  function paintHistory(body) {
    const totals = summary();
    if (!totals.checks) {
      body.appendChild(el('p', 'rep-empty', t('rep.emptyHistory')));
      return;
    }

    const days = historyDays();
    const max = Math.max(1, ...days.map((day) => day.count));
    const chart = el('div', 'rep-bars');
    for (const day of days) {
      const bar = el('span', 'rep-bar');
      bar.title = `${day.key} · ${day.count}`;
      const fill = el('span', 'rep-bar-fill');
      fill.style.height = `${Math.max(4, Math.round((day.count / max) * 100))}%`;
      bar.appendChild(fill);
      chart.appendChild(bar);
    }
    body.appendChild(chart);
    body.appendChild(
      el(
        'p',
        'rep-total',
        t('rep.historyLine', {
          checks: totals.checks,
          days: totals.days,
          avg: totals.average,
        })
      )
    );

    const share = el('button', 'btn ghost small', t('rep.share'));
    share.type = 'button';
    share.addEventListener('click', async () => {
      const text = reportText();
      try {
        if (navigator.share) {
          await navigator.share({ title: t('rep.shareTitle'), text });
          return;
        }
        await navigator.clipboard.writeText(text);
      } catch (error) {
        /* person closed the share sheet or clipboard is blocked */
      }
    });
    body.appendChild(share);
  }

  build();
  return { refresh: build };
}
