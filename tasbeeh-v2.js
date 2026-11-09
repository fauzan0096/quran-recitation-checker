// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
// Tasbeeh: big dial, presets, own target, Aaj / Kul / Round, undo, zero,
// vibration, sound and screen-on. Everything stays on the device (tc.tasbeeh).

import { getLanguage, t } from './i18n.js';

const KEY = 'tc.tasbeeh';

const PRESETS = [
  { id: 'subhanallah', mean: { ro: 'Allah paak hai', ur: 'اللہ پاک ہے', en: 'Allah is pure' }, ar: 'سُبْحَانَ اللّٰهِ', ro: 'SubhanAllah', target: 33 },
  { id: 'alhamdulillah', mean: { ro: 'Sab tareef Allah ke liye hai', ur: 'تمام تعریف اللہ کے لیے ہے', en: 'All praise is for Allah' }, ar: 'الْحَمْدُ لِلّٰهِ', ro: 'Alhamdulillah', target: 33 },
  { id: 'allahuakbar', mean: { ro: 'Allah sabse bada hai', ur: 'اللہ سب سے بڑا ہے', en: 'Allah is the Greatest' }, ar: 'اللّٰهُ أَكْبَرُ', ro: 'Allahu Akbar', target: 34 },
  { id: 'tahlil', mean: { ro: 'Allah ke siwa koi maabood nahi', ur: 'اللہ کے سوا کوئی معبود نہیں', en: 'There is no god but Allah' }, ar: 'لَا إِلٰهَ إِلَّا اللّٰهُ', ro: 'La ilaha illallah', target: 100 },
  { id: 'istighfar', mean: { ro: 'Main Allah se bakhshish maangta hoon', ur: 'میں اللہ سے مغفرت مانگتا ہوں', en: "I seek Allah's forgiveness" }, ar: 'أَسْتَغْفِرُ اللّٰهَ', ro: 'Astaghfirullah', target: 100 },
  { id: 'salawat', mean: { ro: 'Ya Allah, Muhammad ﷺ par rehmat bhej', ur: 'اے اللہ! محمد ﷺ پر رحمت بھیج', en: 'O Allah, send blessings upon Muhammad ﷺ' }, ar: 'اللّٰهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ', ro: 'Durood', target: 100 },
  { id: 'bihamdihi', mean: { ro: 'Allah paak hai aur usi ki tareef', ur: 'اللہ پاک ہے اور اسی کی تعریف', en: 'Glory and praise to Allah' }, ar: 'سُبْحَانَ اللّٰهِ وَبِحَمْدِهِ', ro: 'SubhanAllahi wa bihamdihi', target: 100 },
  { id: 'hawqala', mean: { ro: 'Taqat aur himmat sab Allah hi se hai', ur: 'طاقت اور ہمت سب اللہ ہی سے ہے', en: 'No power or strength except with Allah' }, ar: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللّٰهِ', ro: 'La hawla wa la quwwata', target: 100 },
  { id: 'hasbunallah', mean: { ro: 'Humein Allah kaafi hai, wohi behtareen kaarsaz', ur: 'ہمیں اللہ کافی ہے، وہی بہترین کارساز', en: 'Allah is enough for us, the best Disposer' }, ar: 'حَسْبُنَا اللّٰهُ وَنِعْمَ الْوَكِيلُ', ro: 'Hasbunallah', target: 100 },
];

function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function blank() {
  return {
    day: dayKey(),
    counts: {},
    rounds: {},
    allTime: 0,
    preset: PRESETS[0].id,
    targets: {},
    vib: true,
    snd: false,
    awake: false,
  };
}

function load() {
  let store = null;
  try {
    store = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch (error) {
    store = null;
  }
  const base = blank();
  if (!store || typeof store !== 'object') store = base;
  for (const k of ['counts', 'rounds', 'targets']) {
    if (typeof store[k] !== 'object' || store[k] === null) store[k] = {};
  }
  if (typeof store.allTime !== 'number') store.allTime = 0;
  for (const k of ['vib', 'snd', 'awake']) {
    if (typeof store[k] !== 'boolean') store[k] = base[k];
  }
  if (!PRESETS.some((p) => p.id === store.preset)) store.preset = PRESETS[0].id;
  if (store.day !== dayKey()) {
    // New day: today's numbers start again, the lifetime total stays.
    store.day = dayKey();
    store.counts = {};
    store.rounds = {};
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

const targetOf = (store, preset) => {
  const v = store.targets[preset.id];
  if (v === 'inf') return Infinity;
  const custom = Number(v);
  return custom >= 1 ? Math.min(custom, 100000) : preset.target;
};
const countOf = (store, preset) => Number(store.counts[preset.id]) || 0;
const sum = (obj) => Object.values(obj).reduce((a, b) => a + (Number(b) || 0), 0);

// ---- tiny WebAudio ticks (no audio files) ----
let audioCtx = null;
function beep(freq, ms, gain = 0.06, delay = 0) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const start = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + ms / 1000);
    osc.connect(amp).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + ms / 1000 + 0.02);
  } catch (error) {
    /* audio not available */
  }
}

const RING_R = 92;
const BEADS = 33;
const PRESET_TARGETS = [33, 99, 100];

export function mountTasbeeh(root) {
  if (!root) return { refresh() {}, stop() {} };
  let wakeLock = null;

  async function setAwake(on) {
    try {
      if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
      else if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (error) {
      wakeLock = null;
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && root.offsetParent !== null && load().awake) setAwake(true);
  });

  function build() {
    const store = load();
    const preset = PRESETS.find((p) => p.id === store.preset) || PRESETS[0];
    const target = targetOf(store, preset);
    const inf = target === Infinity;
    const lang = getLanguage();
    root.innerHTML = '';
    root.className = 'tasbeeh tsb';

    const el = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text !== undefined) n.textContent = text;
      return n;
    };

    const top = el('div', 'tsb-top');
    const todayBox = el('div', 'tsb-today');
    todayBox.append(el('span', 'tsb-today-l', t('tasbeeh.aaj')), el('strong', 'tsb-today-n', '0'));
    top.appendChild(todayBox);
    root.appendChild(top);

    const presets = el('div', 'tsb-presets');
    for (const item of PRESETS) {
      const chip = el('button', 'tsb-chip');
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(item.id === preset.id));
      if (item.id === preset.id) chip.dataset.on = '1';
      const ar = el('span', 'tsb-chip-ar', item.ar);
      ar.lang = 'ar';
      ar.dir = 'rtl';
      chip.appendChild(ar);
      chip.addEventListener('click', () => {
        const n = load();
        n.preset = item.id;
        save(n);
        build();
      });
      presets.appendChild(chip);
    }
    root.appendChild(presets);

    const phrase = el('p', 'tsb-phrase', preset.ar);
    phrase.lang = 'ar';
    phrase.dir = 'rtl';
    root.append(phrase, el('p', 'tsb-ro', preset.ro), el('p', 'tsb-mean', preset.mean[lang] || preset.mean.ro));

    // dial with bead ring
    const wrap = el('div', 'tsb-wrap');
    wrap.appendChild(el('span', 'tsb-pointer', '▼'));
    const dial = el('button', 'tsb-dial');
    dial.type = 'button';
    dial.setAttribute('aria-label', t('tasbeeh.tapHere'));
    let beads = '';
    for (let i = 0; i < BEADS; i += 1) {
      const a = ((360 / BEADS) * i - 90) * (Math.PI / 180);
      beads += `<circle class="tsb-bead" cx="${(100 + RING_R * Math.cos(a)).toFixed(1)}" cy="${(100 + RING_R * Math.sin(a)).toFixed(1)}" r="5.2"></circle>`;
    }
    dial.innerHTML = `<svg class="tsb-svg" viewBox="0 0 200 200" aria-hidden="true">${beads}</svg>
      <span class="tsb-core"><span class="tsb-count">0</span><span class="tsb-of"></span><span class="tsb-hint"></span></span>`;
    wrap.appendChild(dial);
    root.appendChild(wrap);
    const countEl = dial.querySelector('.tsb-count');
    const ofEl = dial.querySelector('.tsb-of');
    const hintEl = dial.querySelector('.tsb-hint');
    const beadEls = Array.from(dial.querySelectorAll('.tsb-bead'));

    // targets row
    const targets = el('div', 'tsb-targets');
    const mk = (label, active, onPick) => {
      const b = el('button', 'tsb-tgt' + (active ? ' is-on' : ''), label);
      b.type = 'button';
      b.addEventListener('click', onPick);
      targets.appendChild(b);
    };
    const customVal = Number(store.targets[preset.id]);
    const isCustom = !inf && customVal >= 1 && !PRESET_TARGETS.includes(customVal);
    for (const n of PRESET_TARGETS) {
      mk(String(n), !inf && target === n, () => {
        const s2 = load();
        s2.targets[preset.id] = n;
        save(s2);
        build();
      });
    }
    mk('∞', inf, () => {
      const s2 = load();
      s2.targets[preset.id] = 'inf';
      save(s2);
      build();
    });
    mk(isCustom ? String(customVal) : t('tasbeeh.target'), isCustom, () => {
      const v = Math.floor(Number(window.prompt(t('tasbeeh.target'), t('tasbeeh.targetHint'))));
      if (v >= 1) {
        const s2 = load();
        s2.targets[preset.id] = Math.min(v, 100000);
        save(s2);
        build();
      }
    });
    root.appendChild(targets);

    if (['subhanallah', 'alhamdulillah', 'allahuakbar'].includes(preset.id)) {
      root.appendChild(el('p', 'tsb-tip', t('tasbeeh.afterNamaz')));
    }

    // action tiles
    const tiles = el('div', 'tsb-tiles');
    const tile = (icon, label, onClick, field) => {
      const b = el('button', 'tsb-tile');
      b.type = 'button';
      b.append(el('span', 'tsb-tile-i', icon), el('span', 'tsb-tile-l', label));
      if (field) b.dataset.on = load()[field] ? '1' : '0';
      b.addEventListener('click', () => onClick(b));
      tiles.appendChild(b);
      return b;
    };
    tile('↶', t('tasbeeh.undo'), () => {
      const s2 = load();
      const c = countOf(s2, preset);
      if (c <= 0) return;
      s2.counts[preset.id] = c - 1;
      s2.allTime = Math.max(0, s2.allTime - 1);
      if (!inf && c % target === 0 && (Number(s2.rounds[preset.id]) || 0) > 0) s2.rounds[preset.id] -= 1;
      save(s2);
      paint();
    });
    tile('⟲', t('tasbeeh.zero'), () => {
      const s2 = load();
      const c = countOf(s2, preset);
      if (c === 0 || !window.confirm(t('tasbeeh.zeroAsk'))) return;
      s2.allTime = Math.max(0, s2.allTime - c);
      s2.counts[preset.id] = 0;
      s2.rounds[preset.id] = 0;
      save(s2);
      paint();
    });
    const toggle = (icon, label, field) =>
      tile(icon, label, (b) => {
        const s2 = load();
        s2[field] = !s2[field];
        save(s2);
        b.dataset.on = s2[field] ? '1' : '0';
        if (field === 'awake') setAwake(s2.awake);
        if (field === 'snd' && s2.snd) beep(660, 90);
        if (field === 'vib' && s2.vib && navigator.vibrate) navigator.vibrate(30);
      }, field);
    toggle('📳', t('tasbeeh.vibration'), 'vib');
    toggle('🔔', t('tasbeeh.sound'), 'snd');
    toggle('☀️', t('tasbeeh.screen'), 'awake');
    root.appendChild(tiles);

    const stats = el('div', 'tsb-stats');
    stats.innerHTML = `<div><strong class="s-aaj">0</strong><span>${t('tasbeeh.aaj')}</span></div>
      <div><strong class="s-round">0</strong><span>${t('tasbeeh.roundDone')}</span></div>
      <div><strong class="s-kul">0</strong><span>${t('tasbeeh.kul')}</span></div>`;
    root.appendChild(stats);

    function paint() {
      const s2 = load();
      const c = countOf(s2, preset);
      const inRound = inf ? c : c % target;
      countEl.textContent = String(inRound);
      ofEl.textContent = inf ? '∞' : `/ ${target}`;
      const rn = inf ? 0 : Math.floor(c / target);
      hintEl.textContent = inf ? t('tasbeeh.tapHere') : rn > 0 ? t('tasbeeh.roundOf', { n: rn + 1 }) : t('tasbeeh.tapHere');
      const lit = inf ? c % BEADS : Math.round((inRound / target) * BEADS);
      beadEls.forEach((b, i) => b.classList.toggle('is-on', i < lit));
      const aaj = sum(s2.counts);
      stats.querySelector('.s-aaj').textContent = String(aaj);
      todayBox.querySelector('.tsb-today-n').textContent = String(aaj);
      stats.querySelector('.s-round').textContent = String(sum(s2.rounds));
      stats.querySelector('.s-kul').textContent = String(s2.allTime);
    }
    paint();

    dial.addEventListener('click', () => {
      const s2 = load();
      const before = countOf(s2, preset);
      s2.counts[preset.id] = before + 1;
      s2.allTime += 1;
      const completed = !inf && (before + 1) % target === 0;
      if (completed) s2.rounds[preset.id] = (Number(s2.rounds[preset.id]) || 0) + 1;
      save(s2);
      paint();
      if (s2.vib && navigator.vibrate) navigator.vibrate(completed ? [30, 60, 30, 60, 60] : 10);
      if (s2.snd) {
        if (completed) {
          beep(660, 140, 0.08);
          beep(880, 220, 0.08, 0.16);
        } else beep(520, 45, 0.045);
      }
      dial.classList.remove('is-tap');
      void dial.offsetWidth;
      dial.classList.add('is-tap');
      if (completed) {
        dial.classList.add('is-done');
        window.setTimeout(() => dial.classList.remove('is-done'), 900);
      }
    });

    if (store.awake) setAwake(true);
  }

  build();
  return {
    refresh() {
      build();
    },
    stop() {
      setAwake(false);
    },
  };
}
