// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
//
// Hifz Test (murajaat): the app shows the aya BEFORE, hides the one you must recall and
// reveals it only when you recite it correctly.
//   • Agli aya    – previous aya is shown, the next one is hidden.
//   • Beech ki aya – previous and next are shown, the middle one is blurred.
//   • Khali lafz  – the aya is shown with a few words blanked out.
// Recitation is checked on the device (same ASR + word alignment as the reader). Without a
// microphone there is a self-check mode. Each aya has a Leitner box so weak ayaat come back
// sooner and strong ones later. Everything stays in localStorage.

import { getLanguage } from './i18n.js';
import { getVerses, ayaCount, isLoaded } from './quran.js';
import { SURAHS, surahName } from './surahs.js';
import { alignWords, WORD_STATUS } from './align.js';
import { normalizeArabic } from './normalize.js';
import { startRecording, decodeToMono16k, transcribe, peakOf, micSupport } from './asr.js';

const L = (ro, ur, en) => ({ roman: ro, ur, en }[getLanguage()] || ro);

const STORE = 'tc.hztest';
// Days until the next review for box 1..5 (box 0 = new / forgotten today).
const INTERVALS = [0, 1, 3, 7, 14, 30];
const MAX_BOX = 5;
const LISTEN_MAX_SECONDS = 90;

// ---------------------------------------------------------------- tiny helpers
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (key, n) => {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};
const arDigits = (n) => String(n).replace(/\d/g, (c) => '٠١٢٣٤٥٦٧٨٩'[c]);

function h(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(label, cls, onClick) {
  const node = h('button', cls, label);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}
function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------- storage
const DEFAULT_CFG = {
  kind: 'surah', // 'surah' (one surah, aya range) | 'surahs' (whole surahs from..to)
  surah: 78,
  from: 1,
  to: 40,
  surahFrom: 78,
  surahTo: 114,
  mode: 'next', // next | middle | cloze | mix
  blanks: 'auto', // auto | 1 | 2 | 3
  order: 'smart', // smart | seq | rand
  size: 10,
  strict: false,
  mic: true,
};

function load() {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(STORE) || 'null');
  } catch (error) {
    data = null;
  }
  if (!data || typeof data !== 'object') data = {};
  return {
    cfg: { ...DEFAULT_CFG, ...(data.cfg || {}) },
    cards: data.cards && typeof data.cards === 'object' ? data.cards : {},
    log: data.log && typeof data.log === 'object' ? data.log : {},
  };
}
function save(db) {
  try {
    // keep the daily log short
    const days = Object.keys(db.log).sort();
    while (days.length > 60) delete db.log[days.shift()];
    localStorage.setItem(STORE, JSON.stringify(db));
  } catch (error) {
    /* storage full or blocked: the test still works for this session */
  }
}

/** How many ayaat are due for review today (for the Home "baaki hai" list). */
export function hifzTestDue() {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(STORE) || 'null');
  } catch (error) {
    return 0;
  }
  if (!data || !data.cards) return 0;
  const today = dayKey();
  let n = 0;
  for (const card of Object.values(data.cards)) if (card && card.d && card.d <= today) n += 1;
  return n;
}

const keyOf = (s, a) => `${s}:${a}`;

// ---------------------------------------------------------------- question helpers
/** Letters of the first character plus its marks (so a hint never cuts a harakah off). */
function firstLetter(word) {
  const chars = Array.from(word);
  let out = '';
  for (let i = 0; i < chars.length; i += 1) {
    const c = chars[i];
    const isMark = /[ؐ-ًؚ-ٰٟۖ-ۭ]/.test(c);
    if (i > 0 && !isMark) break;
    out += c;
  }
  return out || word.slice(0, 1);
}

function pickBlanks(words, setting) {
  const n = words.length;
  if (n <= 1) return new Set([0]);
  let k;
  if (setting === 'auto') k = n <= 4 ? 1 : n <= 12 ? 2 : n <= 25 ? 3 : 4;
  else k = Number(setting) || 1;
  k = clamp(k, 1, Math.max(1, Math.floor(n / 2)));
  // "Beech ka lafz": stay away from the first and last word when the aya is long enough.
  let pool = [];
  for (let i = 0; i < n; i += 1) pool.push(i);
  if (n >= 5) pool = pool.filter((i) => i !== 0 && i !== n - 1);
  const longEnough = pool.filter((i) => normalizeArabic(words[i]).length >= 3);
  if (longEnough.length >= k) pool = longEnough;
  return new Set(shuffle(pool).slice(0, k));
}

function buildScope(cfg) {
  const list = [];
  if (cfg.kind === 'surahs') {
    const a = clamp(Math.min(cfg.surahFrom, cfg.surahTo), 1, 114);
    const b = clamp(Math.max(cfg.surahFrom, cfg.surahTo), 1, 114);
    for (let s = a; s <= b; s += 1) {
      const n = ayaCount(s);
      for (let ay = 1; ay <= n; ay += 1) list.push([s, ay]);
    }
  } else {
    const s = clamp(cfg.surah, 1, 114);
    const n = ayaCount(s);
    const a = clamp(Math.min(cfg.from, cfg.to), 1, n);
    const b = clamp(Math.max(cfg.from, cfg.to), 1, n);
    for (let ay = a; ay <= b; ay += 1) list.push([s, ay]);
  }
  return list;
}

function scopeStats(cfg, cards) {
  const items = buildScope(cfg);
  const today = dayKey();
  let due = 0;
  let fresh = 0;
  let weak = 0;
  let strong = 0;
  for (const [s, a] of items) {
    const c = cards[keyOf(s, a)];
    if (!c) {
      fresh += 1;
      continue;
    }
    if (c.d <= today) due += 1;
    if (c.b <= 1) weak += 1;
    if (c.b >= 4) strong += 1;
  }
  return { total: items.length, due, fresh, weak, strong };
}

function buildQueue(cfg, cards) {
  const items = buildScope(cfg);
  const today = dayKey();
  let picked;
  if (cfg.order === 'rand') picked = shuffle(items);
  else if (cfg.order === 'seq') picked = items.slice();
  else {
    const seen = [];
    const fresh = [];
    for (const it of items) {
      const c = cards[keyOf(it[0], it[1])];
      if (!c) fresh.push(it);
      else if (c.d <= today) seen.push(it);
    }
    seen.sort((x, y) => {
      const cx = cards[keyOf(x[0], x[1])];
      const cy = cards[keyOf(y[0], y[1])];
      return cx.b - cy.b || (cx.d < cy.d ? -1 : cx.d > cy.d ? 1 : 0);
    });
    picked = seen.concat(fresh); // new ayaat keep their natural order
  }
  const size = cfg.size === 0 ? picked.length : cfg.size;
  return picked.slice(0, size);
}

function modeFor(cfg) {
  if (cfg.mode !== 'mix') return cfg.mode;
  return ['next', 'middle', 'cloze'][Math.floor(Math.random() * 3)];
}

// ---------------------------------------------------------------- component
/**
 * @param {HTMLElement} root
 * @param {{ ensureQuran: () => Promise<any>, ensureModel: () => Promise<any>, openAya?: (s:number,a:number)=>void }} deps
 */
export function mountHifzTest(root, deps) {
  if (!root) return { refresh() {}, stop() {} };
  const db = load();
  const openAt = deps.openAya || ((surah, aya) => window.dispatchEvent(new CustomEvent('bayyin:open', { detail: { surah, aya } })));

  let session = null; // { queue, i, done: [], retried:Set, q }
  let rec = null; // active recorder
  let recTimer = null;
  let busy = false;
  let loading = false;

  function stopRecorder() {
    if (recTimer) {
      window.clearInterval(recTimer);
      recTimer = null;
    }
    if (rec) {
      try {
        rec.cancel();
      } catch (error) {
        /* ignore */
      }
      rec = null;
    }
  }

  function stop() {
    stopRecorder();
    busy = false;
  }

  // ------------------------------------------------------------ setup screen
  function renderSetup() {
    stop();
    session = null;
    root.innerHTML = '';
    root.className = 'planner hz';
    const cfg = db.cfg;

    if (!isLoaded()) {
      root.appendChild(h('div', 'pl-card', L('Quran ka text load ho raha hai…', 'قرآن کا متن لوڈ ہو رہا ہے…', 'Loading the Quran text…')));
      if (!loading) {
        loading = true;
        Promise.resolve(deps.ensureQuran()).finally(() => {
          loading = false;
          if (isLoaded() && !session) renderSetup();
        });
      }
      return;
    }

    const intro = h('div', 'pl-card');
    intro.append(
      h('h3', '', L('Hifz Test — yaad ki azmaish', 'حفظ ٹیسٹ — یاد کی آزمائش', 'Hifz Test — recall check')),
      h(
        'p',
        'hint',
        L(
          'Pichli aya dikhegi, agli aya chhupi hogi. Mic par yaad se padhein — sahi padhne par aya khul jayegi. Kamzor ayaat jaldi wapas aate hain.',
          'پچھلی آیت دکھائی جائے گی، اگلی چھپی ہوگی۔ مائیک پر یاد سے پڑھیں — صحیح پڑھنے پر آیت کھل جائے گی۔ کمزور آیات جلدی واپس آتی ہیں۔',
          'You see the previous aya, the next one is hidden. Recite it from memory — it opens when you get it right. Weak ayaat come back sooner.'
        )
      )
    );
    root.appendChild(intro);

    const card = h('div', 'pl-card');
    card.appendChild(h('h4', '', L('1. Kahan se test?', '۱۔ کہاں سے ٹیسٹ؟', '1. What to test')));

    // scope kind
    const kindRow = h('div', 'hz-seg');
    for (const [value, label] of [
      ['surah', L('Ek surah', 'ایک سورت', 'One surah')],
      ['surahs', L('Kai surahs', 'کئی سورتیں', 'Several surahs')],
    ]) {
      const b = button(label, `hz-seg-b${cfg.kind === value ? ' is-on' : ''}`, () => {
        cfg.kind = value;
        save(db);
        renderSetup();
      });
      b.setAttribute('aria-pressed', String(cfg.kind === value));
      kindRow.appendChild(b);
    }
    card.appendChild(kindRow);

    const surahOptions = (select, current) => {
      for (const s of SURAHS) {
        const o = document.createElement('option');
        o.value = String(s.n);
        o.textContent = `${s.n}. ${s.latin} (${s.arabic})`;
        if (s.n === current) o.selected = true;
        select.appendChild(o);
      }
    };

    if (cfg.kind === 'surah') {
      const row = h('div', 'pl-row');
      const lab = h('label', '', L('Surah', 'سورت', 'Surah'));
      const sel = h('select', 'pl-select');
      surahOptions(sel, cfg.surah);
      sel.addEventListener('change', () => {
        cfg.surah = Number(sel.value);
        cfg.from = 1;
        cfg.to = ayaCount(cfg.surah);
        save(db);
        renderSetup();
      });
      lab.appendChild(sel);
      row.appendChild(lab);
      card.appendChild(row);

      const n = ayaCount(cfg.surah);
      cfg.from = clamp(cfg.from, 1, n);
      cfg.to = clamp(cfg.to, 1, n);
      const r2 = h('div', 'pl-row');
      for (const [field, label] of [
        ['from', L('Aya se', 'آیت سے', 'From aya')],
        ['to', L('Aya tak', 'آیت تک', 'To aya')],
      ]) {
        const lb = h('label', '', label);
        const input = h('input', 'pl-num');
        input.type = 'number';
        input.min = '1';
        input.max = String(n);
        input.inputMode = 'numeric';
        input.value = String(cfg[field]);
        input.addEventListener('change', () => {
          cfg[field] = clamp(parseInt(input.value, 10) || 1, 1, n);
          save(db);
          renderSetup();
        });
        lb.appendChild(input);
        r2.appendChild(lb);
      }
      r2.appendChild(h('span', 'hint', L(`(1–${n})`, `(۱–${n})`, `(1–${n})`)));
      card.appendChild(r2);
    } else {
      const row = h('div', 'pl-row');
      for (const [field, label] of [
        ['surahFrom', L('Surah se', 'سورت سے', 'From surah')],
        ['surahTo', L('Surah tak', 'سورت تک', 'To surah')],
      ]) {
        const lb = h('label', '', label);
        const sel = h('select', 'pl-select');
        surahOptions(sel, cfg[field]);
        sel.addEventListener('change', () => {
          cfg[field] = Number(sel.value);
          save(db);
          renderSetup();
        });
        lb.appendChild(sel);
        row.appendChild(lb);
      }
      card.appendChild(row);
      const quick = h('div', 'pl-chips');
      for (const [label, a, b] of [
        [L('Juz 30', 'پارہ ۳۰', 'Juz 30'), 78, 114],
        [L('Juz 29', 'پارہ ۲۹', 'Juz 29'), 67, 77],
        [L('Poora Quran', 'پورا قرآن', 'Whole Quran'), 1, 114],
      ]) {
        quick.appendChild(
          button(label, 'dua-chip', () => {
            cfg.surahFrom = a;
            cfg.surahTo = b;
            save(db);
            renderSetup();
          })
        );
      }
      card.appendChild(quick);
    }

    const st = scopeStats(cfg, db.cards);
    const stats = h('div', 'pl-stats');
    for (const [num, label] of [
      [st.due, L('Aaj due', 'آج واجب', 'Due today')],
      [st.weak, L('Kamzor', 'کمزور', 'Weak')],
      [st.strong, L('Mazboot', 'مضبوط', 'Strong')],
    ]) {
      const box = h('div');
      box.append(h('strong', '', String(num)), h('span', '', label));
      stats.appendChild(box);
    }
    card.appendChild(stats);
    card.appendChild(
      h('p', 'hint', L(`${st.total} ayaat • ${st.fresh} abhi tak test nahi hui`, `${st.total} آیات • ${st.fresh} ابھی تک ٹیسٹ نہیں ہوئیں`, `${st.total} ayaat • ${st.fresh} not tested yet`))
    );
    root.appendChild(card);

    // --- how
    const how = h('div', 'pl-card');
    how.appendChild(h('h4', '', L('2. Test ka andaaz', '۲۔ ٹیسٹ کا انداز', '2. Test style')));
    const modes = [
      ['next', L('Agli aya', 'اگلی آیت', 'Next aya'), L('Pichli dikhe, agli chhupi', 'پچھلی دکھے، اگلی چھپی', 'Previous shown, next hidden')],
      ['middle', L('Beech ki aya blur', 'بیچ کی آیت دھندلی', 'Blurred middle aya'), L('Aage-peechhe dikhein, beech ki blur', 'آگے پیچھے دکھیں، بیچ کی دھندلی', 'Both neighbours shown, middle blurred')],
      ['cloze', L('Khali lafz', 'خالی لفظ', 'Missing words'), L('Aya me beech ke lafz khali', 'آیت میں بیچ کے الفاظ خالی', 'Words missing inside the aya')],
      ['mix', L('Mix', 'مکس', 'Mix'), L('Teeno random', 'تینوں رینڈم', 'All three at random')],
    ];
    const modeList = h('div', 'hz-modes');
    for (const [value, title, sub] of modes) {
      const b = h('button', `hz-mode${cfg.mode === value ? ' is-on' : ''}`);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(cfg.mode === value));
      b.append(h('strong', '', title), h('small', '', sub));
      b.addEventListener('click', () => {
        cfg.mode = value;
        save(db);
        renderSetup();
      });
      modeList.appendChild(b);
    }
    how.appendChild(modeList);

    if (cfg.mode === 'cloze' || cfg.mode === 'mix') {
      const r = h('div', 'pl-row');
      const lb = h('label', '', L('Kitne lafz khali?', 'کتنے الفاظ خالی؟', 'How many blanks?'));
      const sel = h('select', 'pl-select');
      for (const [v, label] of [
        ['auto', L('Auto (aya ke hisaab se)', 'آٹو (آیت کے حساب سے)', 'Auto (by aya length)')],
        ['1', '1'],
        ['2', '2'],
        ['3', '3'],
      ]) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = label;
        if (String(cfg.blanks) === v) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => {
        cfg.blanks = sel.value;
        save(db);
      });
      lb.appendChild(sel);
      r.appendChild(lb);
      how.appendChild(r);
    }

    const r1 = h('div', 'pl-row');
    const l1 = h('label', '', L('Tarteeb', 'ترتیب', 'Order'));
    const s1 = h('select', 'pl-select');
    for (const [v, label] of [
      ['smart', L('Smart — due aur kamzor pehle', 'اسمارٹ — واجب اور کمزور پہلے', 'Smart — due & weak first')],
      ['seq', L('Tarteeb se', 'ترتیب سے', 'In order')],
      ['rand', L('Random', 'رینڈم', 'Random')],
    ]) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = label;
      if (cfg.order === v) o.selected = true;
      s1.appendChild(o);
    }
    s1.addEventListener('change', () => {
      cfg.order = s1.value;
      save(db);
    });
    l1.appendChild(s1);
    r1.appendChild(l1);
    how.appendChild(r1);

    const r2 = h('div', 'pl-row');
    const l2 = h('label', '', L('Ek session me', 'ایک سیشن میں', 'Per session'));
    const s2 = h('select', 'pl-select');
    for (const v of [5, 10, 20, 0]) {
      const o = document.createElement('option');
      o.value = String(v);
      o.textContent = v === 0 ? L('Saari ayaat', 'ساری آیات', 'All ayaat') : L(`${v} ayaat`, `${v} آیات`, `${v} ayaat`);
      if (cfg.size === v) o.selected = true;
      s2.appendChild(o);
    }
    s2.addEventListener('change', () => {
      cfg.size = Number(s2.value);
      save(db);
    });
    l2.appendChild(s2);
    r2.appendChild(l2);
    how.appendChild(r2);

    const sup = micSupport();
    const micOk = sup.secure && sup.hasApi;
    const r3 = h('div', 'pl-row');
    const l3 = h('label', 'pl-check');
    const c3 = h('input');
    c3.type = 'checkbox';
    c3.checked = cfg.mic && micOk;
    c3.disabled = !micOk;
    c3.addEventListener('change', () => {
      cfg.mic = c3.checked;
      save(db);
    });
    l3.append(c3, document.createTextNode(' ' + L('Mic se bolkar jawab dein (warna khud check)', 'مائیک سے بول کر جواب دیں (ورنہ خود چیک)', 'Answer by voice (otherwise self-check)')));
    r3.appendChild(l3);
    how.appendChild(r3);
    if (!micOk) {
      how.appendChild(h('p', 'hint', L('Is browser me mic available nahi — khud check mode chalega.', 'اس براؤزر میں مائیک دستیاب نہیں — خود چیک موڈ چلے گا۔', 'No microphone here — self-check mode will be used.')));
    }

    const r4 = h('div', 'pl-row');
    const l4 = h('label', 'pl-check');
    const c4 = h('input');
    c4.type = 'checkbox';
    c4.checked = Boolean(cfg.strict);
    c4.addEventListener('change', () => {
      cfg.strict = c4.checked;
      save(db);
    });
    l4.append(c4, document.createTextNode(' ' + L('Sakht checking (ek lafz ki ghalti bhi nahi)', 'سخت چیکنگ (ایک لفظ کی غلطی بھی نہیں)', 'Strict (no word may be wrong)')));
    r4.appendChild(l4);
    how.appendChild(r4);
    root.appendChild(how);

    const go = h('div', 'pl-card');
    const start = button(L('▶ Test shuru karein', '▶ ٹیسٹ شروع کریں', '▶ Start test'), 'btn primary wide', () => startSession());
    go.appendChild(start);
    if (st.total === 0) {
      start.disabled = true;
    }
    root.appendChild(go);
  }

  // ------------------------------------------------------------ session
  function startSession() {
    stop();
    const queue = buildQueue(db.cfg, db.cards);
    if (!queue.length) {
      renderNothingDue();
      return;
    }
    session = { queue: queue.slice(), i: 0, done: [], retried: new Set(), q: null };
    nextQuestion();
  }

  function renderNothingDue() {
    root.innerHTML = '';
    root.className = 'planner hz';
    const card = h('div', 'pl-card');
    card.append(
      h('h3', '', L('Aaj ki murajaat mukammal 🎉', 'آج کی مراجعت مکمل 🎉', 'Today’s review is done 🎉')),
      h('p', 'hint', L('Is hisse me ab koi aya due nahi. Chahein to phir bhi random test kar lein.', 'اس حصے میں اب کوئی آیت واجب نہیں۔ چاہیں تو پھر بھی رینڈم ٹیسٹ کر لیں۔', 'Nothing in this range is due. You can still run a random test.'))
    );
    const actions = h('div', 'pl-actions');
    actions.append(
      button(L('Random test', 'رینڈم ٹیسٹ', 'Random test'), 'btn primary', () => {
        db.cfg.order = 'rand';
        save(db);
        startSession();
      }),
      button(L('◀ Wapas', '◀ واپس', '◀ Back'), 'btn ghost', renderSetup)
    );
    card.appendChild(actions);
    root.appendChild(card);
  }

  function makeQuestion(s, a) {
    const cfg = db.cfg;
    const verse = getVerses(s, a, a)[0];
    if (!verse) return null;
    const words = verse.words.slice();
    let mode = modeFor(cfg);
    const total = ayaCount(s);
    const prev = a > 1 ? getVerses(s, a - 1, a - 1)[0] : null;
    const next = a < total ? getVerses(s, a + 1, a + 1)[0] : null;
    if (mode === 'middle' && !prev && !next) mode = 'next';
    const q = {
      s,
      a,
      mode,
      verse,
      words,
      prev,
      next,
      vis: words.map(() => false),
      mark: words.map(() => null),
      hint: words.map(() => 0),
      blanks: null,
      attempts: 0,
      hints: 0,
      heard: '',
      finished: false,
      passed: false,
      revealed: false,
      assisted: false,
      attempted: false,
    };
    if (mode === 'cloze') {
      q.blanks = pickBlanks(words, cfg.blanks);
      words.forEach((_, i) => {
        q.vis[i] = !q.blanks.has(i);
      });
    }
    return q;
  }

  function nextQuestion() {
    stop();
    if (!session) return;
    if (session.i >= session.queue.length) {
      renderSummary();
      return;
    }
    const [s, a] = session.queue[session.i];
    const q = makeQuestion(s, a);
    if (!q) {
      session.i += 1;
      nextQuestion();
      return;
    }
    session.q = q;
    renderQuestion();
  }

  // ------------------------------------------------------------ question UI
  function ayaMarker(a) {
    return ` ﴿${arDigits(a)}﴾`;
  }

  function ctxCard(verse, label) {
    const c = h('div', 'hz-ctx');
    c.appendChild(h('div', 'hz-label', label));
    const t = h('div', 'hz-aya aya-text', verse.ayaText + ayaMarker(verse.aya));
    t.setAttribute('lang', 'ar');
    t.setAttribute('dir', 'rtl');
    c.appendChild(t);
    return c;
  }

  function wordNode(q, i) {
    const word = q.words[i];
    const hideStyle = q.mode === 'middle' ? 'blur' : 'blank';
    const span = h('span', 'hz-w');
    const hintLevel = q.hint[i];
    if (q.vis[i] || (hideStyle === 'blur' && hintLevel >= 1) || (hideStyle === 'blank' && hintLevel >= 2)) {
      span.textContent = word;
      if (q.mark[i] === 'ok') span.classList.add('is-ok');
      else if (q.mark[i] === 'close') span.classList.add('is-close');
      else if (q.revealed && q.mark[i] === 'bad') span.classList.add('is-bad');
      if (!q.vis[i]) span.classList.add('is-hinted');
    } else if (hideStyle === 'blur') {
      span.textContent = word;
      span.classList.add('is-blur');
      if (q.mark[i] === 'bad') span.classList.add('is-badmark');
    } else {
      span.classList.add('is-blank');
      if (q.mark[i] === 'bad') span.classList.add('is-badmark');
      if (hintLevel === 1) {
        const first = h('span', 'hz-first', firstLetter(word));
        span.appendChild(first);
        span.appendChild(document.createTextNode(word.slice(firstLetter(word).length)));
      } else {
        span.textContent = word;
      }
    }
    return span;
  }

  function targetCard(q) {
    const c = h('div', 'hz-target');
    const labels = {
      next: L('Ab agli aya yaad se bolein', 'اب اگلی آیت یاد سے بولیں', 'Now recite the next aya from memory'),
      middle: L('Beech ki blur aya yaad se bolein', 'بیچ کی دھندلی آیت یاد سے بولیں', 'Recite the blurred aya from memory'),
      cloze: L('Khali lafz bharein — poori aya ya sirf khali lafz bolein', 'خالی الفاظ بھریں — پوری آیت یا صرف خالی لفظ بولیں', 'Fill the blanks — say the whole aya or just the missing words'),
    };
    c.appendChild(h('div', 'hz-label', `${surahName(q.s)} • ${L('Aya', 'آیت', 'Aya')} ${q.a}`));
    if (q.mode === 'next' && !q.attempted && !q.revealed && !q.finished) {
      const ph = h('div', 'hz-placeholder', '؟');
      ph.setAttribute('aria-label', labels.next);
      c.appendChild(ph);
    } else {
      const box = h('div', 'hz-aya aya-text');
      box.setAttribute('lang', 'ar');
      box.setAttribute('dir', 'rtl');
      q.words.forEach((_, i) => {
        if (i > 0) box.appendChild(document.createTextNode(' '));
        box.appendChild(wordNode(q, i));
      });
      box.appendChild(document.createTextNode(ayaMarker(q.a)));
      c.appendChild(box);
    }
    c.appendChild(h('p', 'hz-prompt', labels[q.mode]));
    return c;
  }

  let statusNode = null;
  function setStatus(text, kind) {
    if (!statusNode) return;
    statusNode.textContent = text || '';
    statusNode.className = `hz-status${kind ? ` is-${kind}` : ''}`;
    statusNode.hidden = !text;
  }

  function renderQuestion() {
    stopRecorder();
    const q = session.q;
    root.innerHTML = '';
    root.className = 'planner hz';

    // top bar
    const top = h('div', 'hz-top');
    const pct = Math.round((session.i / session.queue.length) * 100);
    const bar = h('div', 'hz-bar');
    const fill = h('span', 'hz-bar-fill');
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    top.append(
      button(L('✕ Band', '✕ بند', '✕ End'), 'btn ghost small', () => {
        if (session.done.length) renderSummary();
        else renderSetup();
      }),
      bar,
      h('span', 'hz-count', `${session.i + 1} / ${session.queue.length}`)
    );
    root.appendChild(top);

    // context
    if (q.mode === 'next' || q.mode === 'cloze') {
      if (q.prev) root.appendChild(ctxCard(q.prev, L(`Pichli aya (${q.prev.aya})`, `پچھلی آیت (${q.prev.aya})`, `Previous aya (${q.prev.aya})`)));
      else {
        const c = h('div', 'hz-ctx hz-banner');
        c.append(h('div', 'hz-label', L('Surah ki shuruaat', 'سورت کی ابتدا', 'Start of the surah')), h('div', 'hz-banner-name', SURAHS[q.s - 1].arabic));
        root.appendChild(c);
      }
    } else if (q.prev) {
      root.appendChild(ctxCard(q.prev, L(`Pichli aya (${q.prev.aya})`, `پچھلی آیت (${q.prev.aya})`, `Previous aya (${q.prev.aya})`)));
    } else {
      const c = h('div', 'hz-ctx hz-banner');
      c.append(h('div', 'hz-label', L('Surah ki shuruaat', 'سورت کی ابتدا', 'Start of the surah')), h('div', 'hz-banner-name', SURAHS[q.s - 1].arabic));
      root.appendChild(c);
    }

    root.appendChild(targetCard(q));

    if (q.mode === 'middle' && q.next) {
      root.appendChild(ctxCard(q.next, L(`Agli aya (${q.next.aya})`, `اگلی آیت (${q.next.aya})`, `Next aya (${q.next.aya})`)));
    }

    statusNode = h('div', 'hz-status');
    statusNode.setAttribute('role', 'status');
    statusNode.setAttribute('aria-live', 'polite');
    statusNode.hidden = true;
    root.appendChild(statusNode);
    if (!q.finished && q.attempts > 0 && q.feedback) {
      setStatus(
        L(
          `Abhi ${q.feedback} lafz baaki hain — dobara bolein, hint lein ya "Dikhao" dabaein.`,
          `ابھی ${q.feedback} الفاظ باقی ہیں — دوبارہ بولیں، ہنٹ لیں یا "دکھاؤ" دبائیں۔`,
          `${q.feedback} word(s) still hidden — try again, take a hint or press Reveal.`
        ),
        'warn'
      );
    }
    if (q.heard) {
      const hd = h('p', 'hz-heard');
      hd.append(document.createTextNode(L('Maine suna: ', 'میں نے سنا: ', 'Heard: ')));
      const sp = h('span', '', q.heard);
      sp.setAttribute('dir', 'rtl');
      sp.setAttribute('lang', 'ar');
      hd.appendChild(sp);
      root.appendChild(hd);
    }

    root.appendChild(controlsFor(q));
  }

  function controlsFor(q) {
    const wrap = h('div', 'hz-controls');
    const useMic = db.cfg.mic && micSupport().secure && micSupport().hasApi;

    if (q.finished) {
      const verdict = h('div', `hz-verdict ${q.passed ? 'is-pass' : 'is-fail'}`);
      verdict.textContent = q.passed
        ? q.assisted
          ? L('✓ Theek — lekin hint/madad li, jaldi dobara aayegi', '✓ ٹھیک — مگر ہنٹ/مدد لی، جلد دوبارہ آئے گی', '✓ OK — but you used help, it will return soon')
          : L('✓ Mashallah, sahi!', '✓ ماشاءاللہ، صحیح!', '✓ Mashallah, correct!')
        : L('✗ Is aya ko dobara dekhein — yeh jaldi wapas aayegi', '✗ اس آیت کو دوبارہ دیکھیں — یہ جلد واپس آئے گی', '✗ Review this aya — it will come back soon');
      wrap.appendChild(verdict);
      const row = h('div', 'pl-actions');
      row.appendChild(button(L('Reader me kholein', 'ریڈر میں کھولیں', 'Open in reader'), 'btn ghost small', () => openAt(q.s, q.a)));
      const isLast = session.i + 1 >= session.queue.length;
      row.appendChild(
        button(isLast ? L('Natija dekhein ▶', 'نتیجہ دیکھیں ▶', 'See results ▶') : L('Agla ▶', 'اگلا ▶', 'Next ▶'), 'btn primary', () => {
          session.i += 1;
          nextQuestion();
        })
      );
      wrap.appendChild(row);
      return wrap;
    }

    if (useMic) {
      const micBtn = button(L('🎙 Bolna shuru karein', '🎙 بولنا شروع کریں', '🎙 Start reciting'), 'btn primary wide hz-mic', () => toggleRecord(q, micBtn));
      micBtn.id = 'hz-mic';
      wrap.appendChild(micBtn);
    } else {
      wrap.appendChild(
        button(L('👁 Dikhao', '👁 دکھاؤ', '👁 Reveal'), 'btn primary wide', () => {
          revealAll(q);
          renderQuestion();
        })
      );
    }

    // self grading after a reveal in self-check mode is handled via finished state below
    const row = h('div', 'pl-actions');
    row.appendChild(
      button(L('💡 Hint', '💡 ہنٹ', '💡 Hint'), 'btn ghost small', () => giveHint(q))
    );
    if (useMic) {
      row.appendChild(
        button(L('👁 Dikhao (haar)', '👁 دکھاؤ (ہار)', '👁 Reveal (give up)'), 'btn ghost small', () => {
          stopRecorder();
          revealAll(q);
          finish(q, false);
          renderQuestion();
        })
      );
    } else {
      row.appendChild(
        button(L('✓ Yaad tha', '✓ یاد تھا', '✓ I knew it'), 'btn ghost small', () => {
          revealAll(q);
          finish(q, true);
          renderQuestion();
        })
      );
      row.appendChild(
        button(L('✗ Bhool gaya', '✗ بھول گیا', '✗ Forgot'), 'btn ghost small', () => {
          revealAll(q);
          finish(q, false);
          renderQuestion();
        })
      );
    }
    row.appendChild(
      button(L('Chhor do', 'چھوڑ دو', 'Skip'), 'btn ghost small', () => {
        stopRecorder();
        session.i += 1;
        nextQuestion();
      })
    );
    wrap.appendChild(row);

    if (q.attempted && useMic) {
      wrap.appendChild(
        button(L('Mera jawab sahi tha (mic ne ghalat suna)', 'میرا جواب صحیح تھا (مائیک نے غلط سنا)', 'My answer was right (mic misheard)'), 'hz-link', () => {
          q.assisted = true;
          revealAll(q);
          finish(q, true);
          renderQuestion();
        })
      );
    }
    return wrap;
  }

  function revealAll(q) {
    q.revealed = true;
    q.vis = q.words.map(() => true);
  }

  function giveHint(q) {
    const hideStyle = q.mode === 'middle' ? 'blur' : 'blank';
    const idx = q.words.findIndex((_, i) => !q.vis[i] && q.hint[i] < (hideStyle === 'blur' ? 1 : 2));
    if (idx < 0) return;
    q.hint[idx] += 1;
    q.hints += 1;
    q.assisted = true;
    q.attempted = true; // the next-aya placeholder turns into word slots
    renderQuestion();
  }

  // ------------------------------------------------------------ recording
  async function toggleRecord(q, micBtn) {
    if (busy) return;
    if (rec) {
      await stopAndCheck(q, micBtn);
      return;
    }
    try {
      micBtn.disabled = true;
      setStatus(L('Mic khul raha hai…', 'مائیک کھل رہا ہے…', 'Opening the microphone…'));
      rec = await startRecording({ maxSeconds: LISTEN_MAX_SECONDS });
    } catch (error) {
      rec = null;
      micBtn.disabled = false;
      setStatus(error.message, 'error');
      return;
    }
    micBtn.disabled = false;
    const started = Date.now();
    micBtn.classList.add('is-rec');
    micBtn.textContent = `${L('⏹ Bas / Stop', '⏹ بس / اسٹاپ', '⏹ Stop')} · 0:00`;
    setStatus(L('Sun raha hoon… poora padh kar Stop dabaein.', 'سن رہا ہوں… پورا پڑھ کر اسٹاپ دبائیں۔', 'Listening… press Stop when you finish.'));
    recTimer = window.setInterval(() => {
      if (!rec) return;
      const sec = Math.floor((Date.now() - started) / 1000);
      micBtn.textContent = `${L('⏹ Bas / Stop', '⏹ بس / اسٹاپ', '⏹ Stop')} · ${Math.floor(sec / 60)}:${pad(sec % 60)}`;
      if (typeof rec.getState === 'function' && rec.getState() === 'inactive') stopAndCheck(q, micBtn);
    }, 300);
  }

  async function stopAndCheck(q, micBtn) {
    const recorder = rec;
    if (!recorder || busy) return;
    busy = true;
    if (recTimer) {
      window.clearInterval(recTimer);
      recTimer = null;
    }
    rec = null;
    micBtn.disabled = true;
    micBtn.classList.remove('is-rec');
    micBtn.textContent = L('⏳ Check ho raha hai…', '⏳ چیک ہو رہا ہے…', '⏳ Checking…');
    try {
      setStatus(L('Audio tayyar ho rahi hai…', 'آڈیو تیار ہو رہی ہے…', 'Preparing audio…'));
      const blob = await recorder.stop();
      if (!blob || !blob.size) throw new Error(L('Kuch record nahi hua — dobara koshish karein.', 'کچھ ریکارڈ نہیں ہوا — دوبارہ کوشش کریں۔', 'Nothing was recorded — try again.'));
      const audio = await decodeToMono16k(blob);
      if (audio.length < 6400) throw new Error(L('Awaaz bohot chhoti thi — dobara bolein.', 'آواز بہت چھوٹی تھی — دوبارہ بولیں۔', 'Too short — please recite again.'));
      if (peakOf(audio) < 0.003) throw new Error(L('Awaaz sunayi nahi di — mic ke qareeb bolein.', 'آواز سنائی نہیں دی — مائیک کے قریب بولیں۔', 'No sound heard — speak closer to the mic.'));

      setStatus(L('Model load ho raha hai (pehli dafa bada download ho sakta hai)…', 'ماڈل لوڈ ہو رہا ہے (پہلی بار بڑا ڈاؤنلوڈ ہو سکتا ہے)…', 'Loading the model (the first time can be a big download)…'));
      const model = await deps.ensureModel();
      if (!model) throw new Error(L('Model load nahi hua. Settings me model check karein ya "Dikhao" se khud check karein.', 'ماڈل لوڈ نہیں ہوا۔ سیٹنگز میں چیک کریں یا "دکھاؤ" سے خود چیک کریں۔', 'The model did not load. Check Settings, or use Reveal to self-check.'));

      setStatus(L('Sun kar samajh raha hoon…', 'سن کر سمجھ رہا ہوں…', 'Transcribing…'));
      const text = await transcribe(model, audio);
      if (!text) throw new Error(L('Kuch samajh nahi aaya — dobara bolein.', 'کچھ سمجھ نہیں آیا — دوبارہ بولیں۔', 'Could not understand — recite again.'));
      evaluate(q, text);
      busy = false;
      renderQuestion();
    } catch (error) {
      busy = false;
      micBtn.disabled = false;
      micBtn.textContent = L('🎙 Dobara bolein', '🎙 دوبارہ بولیں', '🎙 Try again');
      setStatus(error.message, 'error');
    }
  }

  // ------------------------------------------------------------ checking
  function evaluate(q, text) {
    const heard = text
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => normalizeArabic(w).length > 0);
    q.heard = heard.join(' ');
    q.attempts += 1;
    q.attempted = true;

    const expected = [];
    (q.verse.prefixWords || []).forEach((word) => expected.push({ word, optional: true }));
    const offset = expected.length;
    q.words.forEach((word) => expected.push({ word, optional: false }));
    const alignment = alignWords(expected, heard);
    const results = alignment.results.slice(offset);

    results.forEach((r, i) => {
      const good = r.status === WORD_STATUS.CORRECT || r.status === WORD_STATUS.CLOSE;
      if (good) {
        q.vis[i] = true;
        q.mark[i] = r.status === WORD_STATUS.CORRECT ? 'ok' : 'close';
      } else if (!q.vis[i]) {
        q.mark[i] = 'bad';
      } else if (q.mode === 'cloze' && q.blanks && !q.blanks.has(i)) {
        q.mark[i] = null; // given words are not judged in the cloze mode
      }
    });

    const n = q.words.length;
    let passed;
    if (q.mode === 'cloze') {
      passed = [...q.blanks].every((i) => {
        const r = results[i];
        return r && (r.status === WORD_STATUS.CORRECT || r.status === WORD_STATUS.CLOSE);
      });
    } else {
      const bad = results.filter((r) => r.status === WORD_STATUS.WRONG || r.status === WORD_STATUS.MISSING).length;
      const allowed = db.cfg.strict ? 0 : Math.floor(n / 8);
      const matched = results.filter((r) => r.status === WORD_STATUS.CORRECT || r.status === WORD_STATUS.CLOSE).length;
      passed = bad <= allowed && matched >= Math.ceil(n * 0.6);
    }

    if (passed) {
      q.vis = q.words.map(() => true);
      q.revealed = true;
      finish(q, true);
    } else {
      const left = q.words.filter((_, i) => !q.vis[i]).length;
      setStatus('');
      q.feedback = left;
    }
  }

  /** Close the question, update the Leitner box and the daily log. */
  function finish(q, passed) {
    if (q.finished) return;
    q.finished = true;
    q.passed = passed;
    const key = keyOf(q.s, q.a);
    const old = db.cards[key] || { b: 0, ok: 0, no: 0 };
    const today = dayKey();
    let box;
    if (passed && !q.assisted) box = clamp(old.b + 1, 1, MAX_BOX);
    else if (passed) box = clamp(old.b || 1, 1, MAX_BOX);
    else box = 1;
    // A forgotten aya is due again tomorrow at the latest; a hinted pass tomorrow too.
    let wait = INTERVALS[box];
    if (!passed || q.assisted) wait = Math.min(wait, 1);
    db.cards[key] = { b: box, d: addDays(today, wait), ok: old.ok + (passed ? 1 : 0), no: old.no + (passed ? 0 : 1), l: today };
    const day = db.log[today] || { n: 0, ok: 0 };
    day.n += 1;
    if (passed && !q.assisted) day.ok += 1;
    db.log[today] = day;
    save(db);
    session.done.push({ s: q.s, a: q.a, passed, assisted: q.assisted, mode: q.mode });
    // a missed aya gets one more chance at the end of this session
    if (!passed && !session.retried.has(key)) {
      session.retried.add(key);
      session.queue.push([q.s, q.a]);
    }
    window.dispatchEvent(new CustomEvent('bayyin:planner'));
  }

  // ------------------------------------------------------------ summary
  function renderSummary() {
    stop();
    root.innerHTML = '';
    root.className = 'planner hz';
    const done = session ? session.done : [];
    const first = new Map();
    for (const d of done) if (!first.has(keyOf(d.s, d.a))) first.set(keyOf(d.s, d.a), d);
    const unique = [...first.values()];
    const good = unique.filter((d) => d.passed && !d.assisted).length;
    const helped = unique.filter((d) => d.passed && d.assisted).length;
    const missed = unique.filter((d) => !d.passed);
    const total = unique.length || 1;
    const pct = Math.round((good / total) * 100);

    const top = h('div', 'pl-card pl-top');
    const ring = h('div', 'pl-ring');
    ring.innerHTML =
      '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="pl-ring-bg" cx="60" cy="60" r="50"/><circle class="pl-ring-fg" cx="60" cy="60" r="50" transform="rotate(-90 60 60)"/></svg>';
    const fg = ring.querySelector('.pl-ring-fg');
    const circ = 2 * Math.PI * 50;
    fg.style.strokeDasharray = String(circ);
    fg.style.strokeDashoffset = String(circ * (1 - pct / 100));
    const rt = h('div', 'pl-ring-t');
    rt.append(h('strong', '', `${pct}%`), h('span', '', L('bina madad', 'بغیر مدد', 'unaided')));
    ring.appendChild(rt);
    const side = h('div', 'pl-side');
    side.append(
      h('span', 'pl-lab', L('Session mukammal', 'سیشن مکمل', 'Session complete')),
      h('strong', '', L(`${good} / ${unique.length} bina madad sahi`, `${good} / ${unique.length} بغیر مدد صحیح`, `${good} of ${unique.length} right unaided`))
    );
    if (helped) side.appendChild(h('span', 'pl-lab', L(`${helped} hint ke saath`, `${helped} ہنٹ کے ساتھ`, `${helped} with hints`)));
    top.append(ring, side);
    root.appendChild(top);

    if (missed.length) {
      const card = h('div', 'pl-card');
      card.appendChild(h('h3', '', L('Dobara dekhne wali ayaat', 'دوبارہ دیکھنے والی آیات', 'Ayaat to review')));
      const list = h('div', 'hz-miss');
      for (const d of missed) {
        list.appendChild(
          button(`${surahName(d.s)} • ${d.a}`, 'dua-chip', () => openAt(d.s, d.a))
        );
      }
      card.appendChild(list);
      card.appendChild(h('p', 'hint', L('Yeh kal phir test me aayengi.', 'یہ کل پھر ٹیسٹ میں آئیں گی۔', 'These will come back tomorrow.')));
      root.appendChild(card);
    }

    const actions = h('div', 'pl-card');
    const row = h('div', 'pl-actions');
    row.append(
      button(L('▶ Aur test', '▶ اور ٹیسٹ', '▶ Another round'), 'btn primary', startSession),
      button(L('◀ Setup', '◀ سیٹ اپ', '◀ Setup'), 'btn ghost', renderSetup)
    );
    actions.appendChild(row);
    root.appendChild(actions);
    session = null;
  }

  /** Start a test on an exact list of [surah, aya] pairs (used by the Murajaa plan). */
  async function startCustom(items) {
    stop();
    await deps.ensureQuran();
    const list = (items || []).filter(([s, a]) => ayaCount(s) >= a);
    if (!list.length) return renderSetup();
    session = { queue: list, i: 0, done: [], retried: new Set(), q: null };
    nextQuestion();
  }

  function refresh() {
    if (session && session.q && !session.q.finished) return; // keep the question on screen
    if (!session) renderSetup();
  }

  renderSetup();
  return { refresh, stop, startCustom };
}
