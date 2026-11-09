// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
// Tasbeeh: big dial, presets, own target, Aaj / Kul / Round, undo, zero,
// vibration, sound and screen-on. Everything stays on the device (tc.tasbeeh).

import { t } from './i18n.js';

const KEY = 'tc.tasbeeh';

const PRESETS = [
  { id: 'subhanallah', ar: 'سُبْحَانَ اللّٰهِ', ro: 'SubhanAllah', target: 33 },
  { id: 'alhamdulillah', ar: 'الْحَمْدُ لِلّٰهِ', ro: 'Alhamdulillah', target: 33 },
  { id: 'allahuakbar', ar: 'اللّٰهُ أَكْبَرُ', ro: 'Allahu Akbar', target: 34 },
  { id: 'tahlil', ar: 'لَا إِلٰهَ إِلَّا اللّٰهُ', ro: 'La ilaha illallah', target: 100 },
  { id: 'istighfar', ar: 'أَسْتَغْفِرُ اللّٰهَ', ro: 'Astaghfirullah', target: 100 },
  { id: 'salawat', ar: 'اللّٰهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ', ro: 'Durood', target: 100 },
  { id: 'bihamdihi', ar: 'سُبْحَانَ اللّٰهِ وَبِحَمْدِهِ', ro: 'SubhanAllahi wa bihamdihi', target: 100 },
  { id: 'hawqala', ar: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللّٰهِ', ro: 'La hawla wa la quwwata', target: 100 },
  { id: 'hasbunallah', ar: 'حَسْبُنَا اللّٰهُ وَنِعْمَ الْوَكِيلُ', ro: 'Hasbunallah', target: 100 },
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
  const custom = Number(store.targets[preset.id]);
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

const SVG_NS = 'http://www.w3.org/2000/svg';
const RING_R = 92;
const CIRC = 2 * Math.PI * RING_R;

export function mountTasbeeh(root) {
  if (!root) return { refresh() {}, stop() {} };

  let wakeLock = null;

  async function setAwake(on) {
    try {
      if (on && 'wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      } else if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (error) {
      wakeLock = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !root.closest('[hidden]')) {
      const store = load();
      if (store.awake) setAwake(true);
    }
  });

  function build() {
    const store = load();
    const preset = PRESETS.find((p) => p.id === store.preset) || PRESETS[0];
    const target = targetOf(store, preset);
    const count = countOf(store, preset);

    root.innerHTML = '';
    root.className = 'tasbeeh tsb';

    // presets
    const presets = document.createElement('div');
    presets.className = 'tsb-presets';
    for (const item of PRESETS) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tsb-chip';
      chip.setAttribute('aria-pressed', String(item.id === preset.id));
      if (item.id === preset.id) chip.dataset.on = '1';
      chip.innerHTML = `<span class="tsb-chip-ar" lang="ar" dir="rtl"></span><span class="tsb-chip-ro"></span>`;
      chip.querySelector('.tsb-chip-ar').textContent = item.ar;
      chip.querySelector('.tsb-chip-ro').textContent = item.ro;
      chip.addEventListener('click', () => {
        const next = load();
        next.preset = item.id;
        save(next);
        build();
      });
      presets.appendChild(chip);
    }
    root.appendChild(presets);

    // the dhikr in large Arabic
    const phrase = document.createElement('p');
    phrase.className = 'tsb-phrase';
    phrase.lang = 'ar';
    phrase.dir = 'rtl';
    phrase.textContent = preset.ar;
    root.appendChild(phrase);

    // dial
    const dial = document.createElement('button');
    dial.type = 'button';
    dial.className = 'tsb-dial';
    dial.setAttribute('aria-label', t('tasbeeh.tap'));

    const useBeads = target <= 40;
    let beads = '';
    if (useBeads) {
      for (let i = 0; i < target; i += 1) {
        const a = ((360 / target) * i - 90) * (Math.PI / 180);
        const x = 100 + RING_R * Math.cos(a);
        const y = 100 + RING_R * Math.sin(a);
        beads += `<circle class="tsb-bead" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${target > 34 ? 3.4 : 4.1}"></circle>`;
      }
    }
    dial.innerHTML = `
      <svg class="tsb-svg" viewBox="0 0 200 200" aria-hidden="true">
        <circle class="tsb-track" cx="100" cy="100" r="${RING_R}"></circle>
        ${
          useBeads
            ? beads
            : `<circle class="tsb-arc" cx="100" cy="100" r="${RING_R}" stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${CIRC.toFixed(1)}" transform="rotate(-90 100 100)"></circle>`
        }
      </svg>
      <span class="tsb-core">
        <span class="tsb-count">0</span>
        <span class="tsb-of"></span>
        <span class="tsb-hint"></span>
      </span>`;
    root.appendChild(dial);

    const countEl = dial.querySelector('.tsb-count');
    const ofEl = dial.querySelector('.tsb-of');
    const hintEl = dial.querySelector('.tsb-hint');
    const beadEls = Array.from(dial.querySelectorAll('.tsb-bead'));
    const arc = dial.querySelector('.tsb-arc');

    // stats
    const stats = document.createElement('div');
    stats.className = 'tsb-stats';
    stats.innerHTML = `
      <div><strong class="s-aaj">0</strong><span>${t('tasbeeh.aaj')}</span></div>
      <div><strong class="s-round">0</strong><span>${t('tasbeeh.roundDone')}</span></div>
      <div><strong class="s-kul">0</strong><span>${t('tasbeeh.kul')}</span></div>`;
    root.appendChild(stats);

    // action row
    const actions = document.createElement('div');
    actions.className = 'tsb-actions';
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'tsb-btn';
    undo.textContent = '↶ ' + t('tasbeeh.undo');
    const zero = document.createElement('button');
    zero.type = 'button';
    zero.className = 'tsb-btn is-quiet';
    zero.textContent = '⟲ ' + t('tasbeeh.zero');
    actions.append(undo, zero);
    root.appendChild(actions);

    // toggles
    const toggles = document.createElement('div');
    toggles.className = 'tsb-toggles';
    const makeToggle = (field, label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tsb-toggle';
      const paint = () => {
        const on = load()[field];
        btn.setAttribute('aria-pressed', String(on));
        btn.dataset.on = on ? '1' : '0';
      };
      btn.innerHTML = `<span class="tsb-switch"></span><span>${label}</span>`;
      btn.addEventListener('click', () => {
        const s = load();
        s[field] = !s[field];
        save(s);
        paint();
        if (field === 'awake') setAwake(s.awake);
        if (field === 'snd' && s.snd) beep(660, 90);
        if (field === 'vib' && s.vib && navigator.vibrate) navigator.vibrate(30);
      });
      paint();
      return btn;
    };
    toggles.append(
      makeToggle('vib', t('tasbeeh.vibration')),
      makeToggle('snd', t('tasbeeh.sound')),
      makeToggle('awake', t('tasbeeh.screen'))
    );
    root.appendChild(toggles);

    // own target
    const custom = document.createElement('form');
    custom.className = 'tsb-custom';
    custom.innerHTML = `
      <label for="tsb-target-input">${t('tasbeeh.target')}</label>
      <input id="tsb-target-input" type="number" inputmode="numeric" min="1" max="100000" placeholder="${t('tasbeeh.targetHint')}" />
      <button type="submit" class="tsb-btn">${t('tasbeeh.setTarget')}</button>`;
    custom.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = Math.floor(Number(custom.querySelector('input').value));
      const s = load();
      if (value >= 1) s.targets[preset.id] = Math.min(value, 100000);
      else delete s.targets[preset.id];
      save(s);
      build();
    });
    root.appendChild(custom);

    // ---- painting ----
    const paint = () => {
      const s = load();
      const c = countOf(s, preset);
      const inRound = c % target;
      const doneRounds = Math.floor(c / target);
      countEl.textContent = String(inRound);
      ofEl.textContent = `/ ${target}`;
      hintEl.textContent = doneRounds > 0 ? t('tasbeeh.roundOf', { n: doneRounds + 1 }) : t('tasbeeh.tapHere');
      if (useBeads) beadEls.forEach((b, i) => b.classList.toggle('is-on', i < inRound));
      else if (arc) arc.style.strokeDashoffset = String(CIRC * (1 - inRound / target));
      stats.querySelector('.s-aaj').textContent = String(sum(s.counts));
      stats.querySelector('.s-round').textContent = String(sum(s.rounds));
      stats.querySelector('.s-kul').textContent = String(s.allTime);
    };
    paint();

    dial.addEventListener('click', () => {
      const s = load();
      const before = countOf(s, preset);
      s.counts[preset.id] = before + 1;
      s.allTime += 1;
      const completed = (before + 1) % target === 0;
      if (completed) s.rounds[preset.id] = (Number(s.rounds[preset.id]) || 0) + 1;
      save(s);
      paint();
      if (s.vib && navigator.vibrate) navigator.vibrate(completed ? [30, 60, 30, 60, 60] : 10);
      if (s.snd) {
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

    undo.addEventListener('click', () => {
      const s = load();
      const c = countOf(s, preset);
      if (c <= 0) return;
      s.counts[preset.id] = c - 1;
      s.allTime = Math.max(0, s.allTime - 1);
      if (c % target === 0 && (Number(s.rounds[preset.id]) || 0) > 0) s.rounds[preset.id] -= 1;
      save(s);
      paint();
    });

    zero.addEventListener('click', () => {
      const s = load();
      const c = countOf(s, preset);
      if (c === 0) return;
      if (!window.confirm(t('tasbeeh.zeroAsk'))) return;
      s.allTime = Math.max(0, s.allTime - c);
      s.counts[preset.id] = 0;
      s.rounds[preset.id] = 0;
      save(s);
      paint();
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
