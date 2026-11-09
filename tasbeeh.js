// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
// Tasbeeh counter: big tap target, presets, round + daily totals.
// Counting is stored on the device only, under tc.tasbeeh.

import { t } from './i18n.js';

const KEY = 'tc.tasbeeh';

const PRESETS = [
  { id: 'subhanallah', ar: 'سُبْحَانَ اللّٰه', target: 33 },
  { id: 'alhamdulillah', ar: 'الْحَمْدُ لِلّٰه', target: 33 },
  { id: 'allahuakbar', ar: 'اللّٰهُ أَكْبَر', target: 34 },
  { id: 'tahlil', ar: 'لَا إِلٰهَ إِلَّا اللّٰه', target: 100 },
  { id: 'istighfar', ar: 'أَسْتَغْفِرُ اللّٰه', target: 100 },
  { id: 'salawat', ar: 'اللّٰهُ مَّ صَلِّ عَلَى مُحَمَّد', target: 100 },
];

function dayKey() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function blank() {
  return { day: dayKey(), counts: {}, allTime: 0, preset: PRESETS[0].id };
}

function load() {
  let store = null;
  try {
    store = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch (error) {
    store = null;
  }
  if (!store || typeof store !== 'object') store = blank();
  if (typeof store.counts !== 'object' || store.counts === null) store.counts = {};
  if (typeof store.allTime !== 'number') store.allTime = 0;
  if (!PRESETS.some((preset) => preset.id === store.preset)) store.preset = PRESETS[0].id;
  if (store.day !== dayKey()) {
    // A new day: today's counts start again, the lifetime total stays.
    store.day = dayKey();
    store.counts = {};
  }
  return store;
}

function save(store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch (error) {
    /* private mode */
  }
}

function countOf(store, preset) {
  return Number(store.counts[preset.id]) || 0;
}

function todayTotal(store) {
  return PRESETS.reduce((sum, preset) => sum + countOf(store, preset), 0);
}

export function mountTasbeeh(root) {
  if (!root) return { refresh() {} };

  function build() {
    const store = load();
    const preset = PRESETS.find((item) => item.id === store.preset) || PRESETS[0];
    const count = countOf(store, preset);
    const round = Math.floor(count / preset.target);
    const progress = (count % preset.target) / preset.target;

    root.innerHTML = '';
    root.className = 'tasbeeh';

    const presets = document.createElement('div');
    presets.className = 'tasbeeh-presets';
    for (const item of PRESETS) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip tasbeeh-chip';
      chip.lang = 'ar';
      chip.dir = 'rtl';
      chip.textContent = item.ar;
      chip.setAttribute('aria-pressed', String(item.id === preset.id));
      if (item.id === preset.id) chip.dataset.on = '1';
      chip.addEventListener('click', () => {
        const next = load();
        next.preset = item.id;
        save(next);
        build();
      });
      presets.appendChild(chip);
    }
    root.appendChild(presets);

    const big = document.createElement('button');
    big.type = 'button';
    big.className = 'tasbeeh-big';
    big.setAttribute('aria-label', t('tasbeeh.tap'));

    const circumference = 2 * Math.PI * 88;
    big.innerHTML = `
      <svg class="tasbeeh-ring" viewBox="0 0 200 200" aria-hidden="true">
        <circle class="ring-track" cx="100" cy="100" r="88"></circle>
        <circle class="ring-fill" cx="100" cy="100" r="88"
          stroke-dasharray="${circumference.toFixed(2)}"
          stroke-dashoffset="${(circumference * (1 - progress)).toFixed(2)}"></circle>
      </svg>
      <span class="tasbeeh-count">${count % preset.target}</span>
      <span class="tasbeeh-target">/ ${preset.target}</span>
    `;

    const counter = big.querySelector('.tasbeeh-count');
    big.addEventListener('click', () => {
      const next = load();
      next.counts[preset.id] = countOf(next, preset) + 1;
      next.allTime += 1;
      save(next);
      const total = next.counts[preset.id];
      const done = total % preset.target === 0;

      counter.textContent = String(total % preset.target);
      const span = big.querySelector('.tasbeeh-target');
      span.textContent = `/ ${preset.target}`;
      const fill = big.querySelector('.ring-fill');
      fill.setAttribute(
        'stroke-dashoffset',
        String(circumference * (1 - (total % preset.target) / preset.target))
      );

      if (navigator.vibrate) navigator.vibrate(done ? [18, 50, 18, 50, 18] : 8);
      if (done) {
        big.classList.add('is-done');
        window.setTimeout(() => big.classList.remove('is-done'), 700);
      }
      updateMeta();
    });

    root.appendChild(big);

    const meta = document.createElement('div');
    meta.className = 'tasbeeh-meta';
    root.appendChild(meta);

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'btn ghost small';
    reset.textContent = t('tasbeeh.reset');
    reset.addEventListener('click', () => {
      const next = load();
      next.counts[preset.id] = 0;
      save(next);
      build();
    });
    root.appendChild(reset);

    function updateMeta() {
      const now = load();
      const current = countOf(now, preset);
      meta.innerHTML = '';
      const cells = [
        [t('tasbeeh.round'), String(Math.floor(current / preset.target))],
        [t('tasbeeh.today'), String(todayTotal(now))],
        [t('tasbeeh.total'), String(now.allTime)],
      ];
      for (const [label, value] of cells) {
        const cell = document.createElement('div');
        cell.className = 'stat';
        const strong = document.createElement('strong');
        strong.textContent = value;
        const span = document.createElement('span');
        span.textContent = label;
        cell.append(strong, span);
        meta.appendChild(cell);
      }
    }

    updateMeta();
    if (round > 0) big.setAttribute('aria-label', t('tasbeeh.rounds', { count: round }));
  }

  build();
  return {
    refresh() {
      build();
    },
  };
}
