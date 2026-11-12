// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Inaam (badges): small milestones the person earns from what is already saved
// on the phone — checked ayaat, scores, surahs marked ✓, streak and practice
// days. Nothing new is tracked and nothing leaves the device.

import { t, getLanguage } from './i18n.js';
import { ayaCount, TOTAL_AYAS, isLoaded } from './quran.js';
import { stats, scoreStats, listOf } from './progress.js';

const KEY = 'tc.badges';

const L = (ro, ur, en) => ({ roman: ro, ur, en }[getLanguage()] || ro);

let data = null;

function load() {
  if (data) return data;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object' && raw.earned && typeof raw.earned === 'object') {
      data = { earned: raw.earned };
    } else {
      data = { earned: {} };
    }
  } catch (error) {
    data = { earned: {} };
  }
  return data;
}

function save(next) {
  data = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (error) {
    /* private mode */
  }
}

/** How many surahs have every aya marked ✓ (needs the Quran text loaded). */
function completedSurahs() {
  if (!isLoaded()) return 0;
  const counts = new Map();
  for (const key of listOf('ok')) {
    const [surah] = String(key).split(':').map(Number);
    if (!surah) continue;
    counts.set(surah, (counts.get(surah) || 0) + 1);
  }
  let done = 0;
  for (const [surah, count] of counts) {
    if (count >= ayaCount(surah)) done += 1;
  }
  return done;
}

const BADGES = [
  {
    id: 'first',
    icon: '★',
    title: () => L('Pehla qadam', 'پہلا قدم', 'First step'),
    value: (c) => c.checked,
    target: () => 1,
    unit: 'aya',
  },
  {
    id: 'hundred',
    icon: '✧',
    title: () => L('100 ayaat', '100 آیات', '100 ayas'),
    value: (c) => c.checked,
    target: () => 100,
    unit: 'aya',
  },
  {
    id: 'quarter',
    icon: '◔',
    title: () => L('Chauthai Quran', 'چوتھائی قرآن', 'Quarter of the Quran'),
    value: (c) => c.checked,
    target: (c) => Math.ceil(c.total / 4),
    unit: 'aya',
  },
  {
    id: 'half',
    icon: '◑',
    title: () => L('Aadha Quran', 'آدھا قرآن', 'Half the Quran'),
    value: (c) => c.checked,
    target: (c) => Math.ceil(c.total / 2),
    unit: 'aya',
  },
  {
    id: 'three',
    icon: '◕',
    title: () => L('Teen chauthai', 'تین چوتھائی', 'Three quarters'),
    value: (c) => c.checked,
    target: (c) => Math.ceil((c.total * 3) / 4),
    unit: 'aya',
  },
  {
    id: 'khatam',
    icon: '✦',
    title: () => L('Poora Quran', 'پورا قرآن', 'The whole Quran'),
    value: (c) => c.checked,
    target: (c) => c.total,
    unit: 'aya',
  },
  {
    id: 'perfect',
    icon: '✓',
    title: () => L('Pehli be-ghalti', 'پہلی بے غلطی', 'First perfect aya'),
    value: (c) => c.perfect,
    target: () => 1,
    unit: 'aya',
  },
  {
    id: 'perfect25',
    icon: '✔',
    title: () => L('25 be-ghalti', '25 بے غلطی', '25 perfect ayas'),
    value: (c) => c.perfect,
    target: () => 25,
    unit: 'aya',
  },
  {
    id: 'accurate',
    icon: '◎',
    title: () => L('Saaf talaawat', 'صاف تلاوت', 'Clean recitation'),
    hint: () => L('20 checks ke baad ausat 90%', '20 چیکس کے بعد اوسط 90%', 'Average 90% after 20 checks'),
    value: (c) => (c.checked >= 20 ? c.average : 0),
    target: () => 90,
    unit: '%',
  },
  {
    id: 'surah1',
    icon: '❖',
    title: () => L('Pehli surah mukammal', 'پہلی سورہ مکمل', 'First surah complete'),
    hint: () => L('Ek surah ke saare ayât ✓', 'ایک سورہ کی ساری آیات ✓', 'Every aya of one surah ✓'),
    value: (c) => c.surahs,
    target: () => 1,
    unit: 'surah',
  },
  {
    id: 'surah5',
    icon: '❖',
    title: () => L('5 surah mukammal', '5 سوریں مکمل', '5 surahs complete'),
    value: (c) => c.surahs,
    target: () => 5,
    unit: 'surah',
  },
  {
    id: 'streak7',
    icon: '☾',
    title: () => L('7 din lagataar', '7 دن لگاتار', '7-day streak'),
    value: (c) => c.streak,
    target: () => 7,
    unit: 'day',
  },
  {
    id: 'streak30',
    icon: '☽',
    title: () => L('30 din lagataar', '30 دن لگاتار', '30-day streak'),
    value: (c) => c.streak,
    target: () => 30,
    unit: 'day',
  },
  {
    id: 'days30',
    icon: '❂',
    title: () => L('30 din ka safar', '30 دن کا سفر', '30 days of practice'),
    value: (c) => c.days,
    target: () => 30,
    unit: 'day',
  },
  {
    id: 'ten',
    icon: '✦',
    title: () => L('10 ayaat', '10 آیات', '10 ayas'),
    value: (c) => c.checked,
    target: () => 10,
    unit: 'aya',
  },
  {
    id: 'streak3',
    icon: '☾',
    title: () => L('3 din lagataar', '3 دن لگاتار', '3-day streak'),
    value: (c) => c.streak,
    target: () => 3,
    unit: 'day',
  },
  {
    id: 'days7',
    icon: '❂',
    title: () => L('Hafta bhar', 'ایک ہفتہ', 'A week of practice'),
    value: (c) => c.days,
    target: () => 7,
    unit: 'day',
  },
  {
    id: 'perfect10',
    icon: '✔',
    title: () => L('10 be-ghalti', '10 بے غلطی', '10 perfect ayas'),
    value: (c) => c.perfect,
    target: () => 10,
    unit: 'aya',
  },
  {
    id: 'surah10',
    icon: '❖',
    title: () => L('10 surah mukammal', '10 سوریں مکمل', '10 surahs complete'),
    value: (c) => c.surahs,
    target: () => 10,
    unit: 'surah',
  },
  {
    id: 'streak14',
    icon: '☽',
    title: () => L('2 hafte lagataar', 'دو ہفتے لگاتار', '14-day streak'),
    value: (c) => c.streak,
    target: () => 14,
    unit: 'day',
  },
  {
    id: 'days100',
    icon: '❂',
    title: () => L('100 din ka safar', '100 دن کا سفر', '100 days of practice'),
    value: (c) => c.days,
    target: () => 100,
    unit: 'day',
  },
  {
    id: 'accurate95',
    icon: '◎',
    title: () => L('Ustaad jaisi saaf tilaawat', 'استاد جیسی صاف تلاوت', 'Clean as a teacher'),
    hint: () => L('50 checks ke baad ausat 95%', '50 چیکس کے بعد اوسط 95%', 'Average 95% after 50 checks'),
    value: (c) => (c.checked >= 50 ? c.average : 0),
    target: () => 95,
    unit: '%',
  },
];

// Inaam ka darja: bronze (shuruaat) -> silver -> gold (bade maqsad).
const TIERS = {
  first: 'bronze',
  hundred: 'bronze',
  perfect: 'bronze',
  ten: 'bronze',
  streak3: 'bronze',
  quarter: 'silver',
  half: 'silver',
  perfect25: 'silver',
  accurate: 'silver',
  surah1: 'silver',
  streak7: 'silver',
  days7: 'bronze',
  perfect10: 'silver',
  three: 'gold',
  khatam: 'gold',
  surah5: 'gold',
  streak30: 'gold',
  days30: 'gold',
  surah10: 'gold',
  streak14: 'gold',
  days100: 'gold',
  accurate95: 'gold',
};
const tierOf = (id) => TIERS[id] || 'bronze';

function context() {
  const basic = stats();
  const exact = scoreStats();
  return {
    checked: basic.checked,
    average: basic.average,
    streak: basic.streak,
    days: basic.days,
    perfect: exact.perfect,
    surahs: completedSurahs(),
    total: TOTAL_AYAS,
  };
}

/** Every badge with its value, target, progress and earned flag. */
export function evaluate() {
  const ctx = context();
  return BADGES.map((badge) => {
    const value = Number(badge.value(ctx)) || 0;
    const target = Math.max(1, Number(badge.target(ctx)) || 1);
    return {
      ...badge,
      value,
      target,
      earned: value >= target,
      ratio: Math.max(0, Math.min(1, value / target)),
    };
  });
}

/** Return newly earned badges and remember them. */
export function checkBadges(notify) {
  const store = load();
  const fresh = evaluate().filter((badge) => badge.earned && !store.earned[badge.id]);
  if (!fresh.length) return [];

  const next = { earned: { ...store.earned } };
  const at = new Date().toISOString();
  for (const badge of fresh) next.earned[badge.id] = at;
  save(next);

  if (typeof notify === 'function') notify(fresh);
  return fresh;
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Mount the Inaam screen: overall Quran progress + every badge. */
export function mountBadges(root, options = {}) {
  if (!root) return { refresh() {} };
  const notify = typeof options.toast === 'function' ? options.toast : () => {};

  function build() {
    root.innerHTML = '';
    root.className = 'badges';

    // Opening the screen also records what is already earned, so the next
    // check does not announce badges the person has already seen.
    checkBadges();

    const list = evaluate();
    const earned = list.filter((badge) => badge.earned).length;
    const ctx = context();
    const percent = Math.min(100, Math.round((ctx.checked / ctx.total) * 100));

    const hero = el('div', 'badges-hero');
    hero.appendChild(el('span', 'badges-hero-glow'));
    const ring = el('div', 'badges-ring');
    ring.style.setProperty('--pct', String(percent));
    ring.appendChild(el('span', 'badges-ring-pct', `${percent}%`));
    hero.appendChild(ring);

    const heroText = el('div', 'badges-hero-text');
    heroText.appendChild(el('strong', 'badges-hero-title', t('badges.heading')));
    heroText.appendChild(
      el('span', 'badges-sub', t('badges.progress', { done: ctx.checked, total: ctx.total }))
    );
    heroText.appendChild(
      el('span', 'badges-sub', t('badges.earned', { earned, total: list.length }))
    );
    const meter = el('span', 'badges-meter');
    const meterFill = el('span', 'badges-meter-fill');
    meterFill.style.width = `${Math.round((earned / Math.max(1, list.length)) * 100)}%`;
    meter.appendChild(meterFill);
    heroText.appendChild(meter);
    hero.appendChild(heroText);
    root.appendChild(hero);

    const chips = el('div', 'badges-stats');
    const chip = (icon, value, label) => {
      const box = el('div', 'badges-stat');
      box.appendChild(el('span', 'badges-stat-ic', icon));
      box.appendChild(el('strong', 'badges-stat-n', String(value)));
      box.appendChild(el('span', 'badges-stat-l', label));
      return box;
    };
    chips.append(
      chip('☾', ctx.streak, L('Din lagataar', 'دن لگاتار', 'Day streak')),
      chip('✓', ctx.perfect, L('Be-ghalti ayaat', 'بے غلطی آیات', 'Perfect ayas')),
      chip('❖', ctx.surahs, L('Surah mukammal', 'سورتیں مکمل', 'Surahs done'))
    );
    root.appendChild(chips);

    // Agla maqsad: jo inaam sab se qareeb hai.
    const open = list.filter((badge) => !badge.earned);
    const nextBadge = open.reduce((best, badge) => (!best || badge.ratio > best.ratio ? badge : best), null);

    const card = (badge, isNext) => {
      const node = el(
        'div',
        `badge-card tier-${tierOf(badge.id)}${badge.earned ? ' is-earned' : ' is-locked'}${isNext ? ' is-next' : ''}`
      );
      if (badge.earned) node.appendChild(el('span', 'badge-ribbon', '✓'));
      else node.appendChild(el('span', 'badge-lock', '🔒'));
      if (isNext) node.appendChild(el('span', 'badge-next-tag', L('Agla maqsad', 'اگلا مقصد', 'Next goal')));

      const coin = el('span', 'badge-coin');
      coin.appendChild(el('span', 'badge-coin-ic', badge.icon));
      node.appendChild(coin);
      node.appendChild(el('strong', 'badge-title', badge.title()));
      if (badge.hint) node.appendChild(el('span', 'badge-hint', badge.hint()));

      if (!badge.earned) {
        const track = el('span', 'badge-track');
        const step = el('span', 'badge-step');
        step.style.width = `${Math.round(badge.ratio * 100)}%`;
        track.appendChild(step);
        node.appendChild(track);
        node.appendChild(
          el('span', 'badge-count', `${Math.min(badge.value, badge.target)} / ${badge.target}`)
        );
      } else {
        node.appendChild(el('span', 'badge-count is-done', t('badges.done')));
      }
      return node;
    };

    const section = (title, items) => {
      if (!items.length) return;
      root.appendChild(el('h3', 'badges-sec', title));
      const grid = el('div', 'badge-grid');
      for (const badge of items) grid.appendChild(card(badge, nextBadge && badge.id === nextBadge.id));
      root.appendChild(grid);
    };

    section(L('Mile hue inaam', 'ملے ہوئے انعام', 'Earned'), list.filter((badge) => badge.earned));
    section(L('Aage ke maqsad', 'آگے کے مقاصد', 'Goals ahead'), open);
  }

  build();
  return { refresh: build };
}

/**
 * A celebration overlay for newly earned badges — the moment should feel like
 * something big, not like a small toast.
 */
export function celebrate(list) {
  if (!list || !list.length) return;
  const badge = list[0];

  const overlay = document.createElement('div');
  overlay.className = 'badge-party';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', badge.title());

  const card = document.createElement('div');
  card.className = `badge-party-card tier-${tierOf(badge.id)}`;

  const rays = document.createElement('span');
  rays.className = 'badge-party-rays';
  card.appendChild(rays);

  for (let i = 0; i < 28; i += 1) {
    const spark = document.createElement('span');
    spark.className = 'badge-spark';
    spark.textContent = ['✦', '•', '✧', '★'][i % 4];
    spark.style.setProperty('--x', `${8 + Math.random() * 84}%`);
    spark.style.setProperty('--d', `${(Math.random() * 1.4).toFixed(2)}s`);
    spark.style.setProperty('--r', `${Math.round(Math.random() * 360)}deg`);
    card.appendChild(spark);
  }

  const coin = document.createElement('span');
  coin.className = 'badge-party-coin';
  coin.textContent = badge.icon;

  const title = document.createElement('strong');
  title.className = 'badge-party-title';
  title.textContent = badge.title();

  const sub = document.createElement('p');
  sub.className = 'badge-party-sub';
  sub.textContent =
    list.length > 1
      ? t('badges.celebrateMore', { n: list.length - 1 })
      : t('badges.celebrate');

  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'btn primary';
  ok.textContent = t('badges.ok');

  card.append(coin, title, sub, ok);
  overlay.appendChild(card);

  const close = () => overlay.remove();
  ok.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  document.body.appendChild(overlay);
  window.setTimeout(close, 9000);
}

/** True when the badge was already earned (used by tests/debug). */
export function isEarned(id) {
  return Boolean(load().earned[id]);
}

export { BADGES };
