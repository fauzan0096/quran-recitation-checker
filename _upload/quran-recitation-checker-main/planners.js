// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
// Khatam planner (free) and Hifz planner (premium): each person sets their own pace,
// the app says how many days it takes, shows today's portion and reminds.
// Everything stays on the device.

import { getLanguage } from './i18n.js';
import { getVerses, isLoaded } from './quran.js';
import { SURAHS, surahName } from './surahs.js';
import { isPremium } from './premium.js';
import { hifzTestDue } from './hifz-test.js';

const L = (ro, ur, en) => ({ roman: ro, ur, en }[getLanguage()] || ro);
const TOTAL_PAGES = 604;
const AY_PER_PAGE = 6236 / 604;
const AY = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

// ---------------------------------------------------------------- helpers
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toUTC = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
const addDays = (key, n) => {
  const d = new Date(toUTC(key) + n * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const niceDate = (key) =>
  new Date(toUTC(key)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch (error) {
    return null;
  }
}
function writeJSON(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    /* ignore */
  }
}

function h(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
function button(label, cls, onClick) {
  const b = h('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function fmtDays(d) {
  if (d >= 365) {
    const y = Math.floor(d / 365);
    const m = Math.round((d - y * 365) / 30);
    return L(`${y} saal ${m} mahine`, `${y} سال ${m} مہینے`, `${y} yr ${m} mo`);
  }
  if (d >= 30) {
    const m = Math.floor(d / 30);
    const r = d - m * 30;
    return r ? L(`${m} mahine ${r} din`, `${m} مہینے ${r} دن`, `${m} mo ${r} d`) : L(`${m} mahine`, `${m} مہینے`, `${m} mo`);
  }
  return L(`${d} din`, `${d} دن`, `${d} days`);
}

function ring(frac, big, small) {
  const R = 54;
  const C = 2 * Math.PI * R;
  const box = h('div', 'pl-ring');
  box.innerHTML = `<svg viewBox="0 0 130 130" aria-hidden="true"><circle cx="65" cy="65" r="${R}" class="pl-ring-bg"/><circle cx="65" cy="65" r="${R}" class="pl-ring-fg" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - Math.min(1, frac))).toFixed(1)}" transform="rotate(-90 65 65)"/></svg><div class="pl-ring-t"><strong></strong><span></span></div>`;
  box.querySelector('strong').textContent = big;
  box.querySelector('span').textContent = small;
  return box;
}

function statRow(items) {
  const row = h('div', 'pl-stats');
  for (const [value, label] of items) {
    const cell = h('div');
    cell.append(h('strong', '', String(value)), h('span', '', label));
    row.appendChild(cell);
  }
  return row;
}

// ---------------------------------------------------------------- reminders
async function notify(id, title, body) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.showNotification) reg.showNotification(title, { body, icon: 'icon-192.png', tag: `bayyin-${id}` });
    else new Notification(title, { body });
  } catch (error) {
    /* ignore */
  }
}

function downloadReminder(title, time, days) {
  const [hh, mm] = (time || '20:00').split(':');
  const today = dayKey().replace(/-/g, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bayyin//EN', 'BEGIN:VEVENT',
    `UID:bayyin-${Date.now()}@bayyin`, `DTSTAMP:${today}T000000Z`,
    `DTSTART:${today}T${hh}${mm}00`, `DTEND:${today}T${hh}${mm}00`,
    `RRULE:FREQ=DAILY;COUNT=${Math.max(1, Math.min(days, 1000))}`,
    `SUMMARY:${title}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bayyin-reminder.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function reminderRow(plan, save, title, days) {
  const box = h('div', 'pl-remind');
  const on = button('🔔 ' + L('Yaad dilao', 'یاد دلائیں', 'Remind me'), 'dua-chip' + (plan.remind ? ' is-on' : ''), async () => {
    if (!plan.remind && 'Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        /* ignore */
      }
    }
    plan.remind = !plan.remind;
    save();
    on.classList.toggle('is-on', plan.remind);
  });
  const time = h('input', 'pl-time');
  time.type = 'time';
  time.value = plan.time || '20:00';
  time.addEventListener('change', () => {
    plan.time = time.value || '20:00';
    save();
  });
  const ics = button('📅 ' + L('Phone reminder', 'فون ریمائنڈر', 'Phone reminder'), 'dua-chip', () =>
    downloadReminder(title, plan.time, days)
  );
  box.append(on, time, ics);
  const note = h('p', 'hint', L(
    'Notification tab aati hai jab app khuli ho ya khulte hi. Roz pakka yaad ke liye "Phone reminder" lagayein.',
    'نوٹیفکیشن تب آتا ہے جب ایپ کھلی ہو یا کھلتے ہی۔ روز پکا یاد کے لیے "فون ریمائنڈر" لگائیں۔',
    'Notifications show when the app is open or as you open it. For a sure daily alert add the "Phone reminder".'
  ));
  return [box, note];
}

// ---------------------------------------------------------------- KHATAM (free)
const KH = 'tc.khatam';
const khSave = (p) => writeJSON(KH, p);

function khGoal(p) {
  const today = dayKey();
  if (!p.dayGoal || p.dayGoal.day !== today) {
    const left = Math.max(1, diffDays(today, p.endDay) + 1);
    p.dayGoal = { day: today, startRead: p.read, goal: Math.max(1, Math.ceil((TOTAL_PAGES - p.read) / left)) };
    khSave(p);
  }
  return p.dayGoal;
}
function khDoneToday(p) {
  const g = khGoal(p);
  return p.read >= TOTAL_PAGES || p.read - g.startRead >= g.goal;
}

export function mountKhatam(root) {
  if (!root) return { refresh() {} };
  const openPage = (page) => window.dispatchEvent(new CustomEvent('bayyin:open', { detail: { page } }));

  function setup() {
    root.innerHTML = '';
    root.className = 'planner';
    let days = 30;
    let already = 0;
    const card = h('div', 'pl-card');
    card.append(h('h3', '', L('Khatam plan banayein', 'ختم پلان بنائیں', 'Plan your khatam')));
    card.append(h('p', 'hint', L('Kitne din mein Quran khatam karna hai? App roz ka hissa bata dega.', 'کتنے دن میں قرآن ختم کرنا ہے؟ ایپ روز کا حصہ بتائے گی۔', 'In how many days do you want to finish? The app tells you the daily portion.')));
    const chips = h('div', 'pl-chips');
    const out = h('div', 'pl-result');
    const paint = () => {
      const per = Math.ceil((TOTAL_PAGES - already) / days);
      out.innerHTML = '';
      out.append(
        h('strong', '', L(`Roz ${per} safha`, `روز ${per} صفحے`, `${per} pages a day`)),
        h('span', '', L(`${fmtDays(days)} mein khatam · ${niceDate(addDays(dayKey(), days - 1))}`, `${fmtDays(days)} میں ختم · ${niceDate(addDays(dayKey(), days - 1))}`, `Done in ${fmtDays(days)} · ${niceDate(addDays(dayKey(), days - 1))}`))
      );
      chips.querySelectorAll('.dua-chip').forEach((c) => c.classList.toggle('is-on', Number(c.dataset.d) === days));
    };
    for (const d of [30, 60, 90, 180, 365]) {
      const c = button(String(d), 'dua-chip', () => {
        days = d;
        paint();
      });
      c.dataset.d = String(d);
      c.append(h('small', '', ' ' + L('din', 'دن', 'days')));
      chips.appendChild(c);
    }
    chips.appendChild(button(L('Apna', 'اپنا', 'Own'), 'dua-chip', () => {
      const v = Math.floor(Number(window.prompt(L('Kitne din?', 'کتنے دن؟', 'How many days?'), '45')));
      if (v >= 1 && v <= 1500) {
        days = v;
        paint();
      }
    }));
    card.append(chips, out);
    const row = h('div', 'pl-row');
    row.append(h('label', '', L('Pehle se padhe safhe', 'پہلے سے پڑھے صفحے', 'Pages already read')));
    const num = h('input', 'pl-num');
    num.type = 'number';
    num.min = '0';
    num.max = '603';
    num.value = '0';
    num.addEventListener('input', () => {
      already = Math.max(0, Math.min(603, Math.floor(Number(num.value)) || 0));
      paint();
    });
    row.appendChild(num);
    card.appendChild(row);
    card.appendChild(button(L('Shuru karein', 'شروع کریں', 'Start'), 'btn', () => {
      const p = { startDay: dayKey(), endDay: addDays(dayKey(), days - 1), days, read: already, streak: 0, lastDone: null, remind: false, time: '20:00' };
      khSave(p);
      build();
    }));
    root.appendChild(card);
    paint();
  }

  function build() {
    const p = readJSON(KH);
    if (!p) return setup();
    root.innerHTML = '';
    root.className = 'planner';
    const g = khGoal(p);
    const done = p.read - g.startRead;
    const finished = p.read >= TOTAL_PAGES;
    const left = Math.max(0, diffDays(dayKey(), p.endDay) + 1);

    const top = h('div', 'pl-card pl-top');
    top.appendChild(ring(p.read / TOTAL_PAGES, `${Math.round((p.read / TOTAL_PAGES) * 100)}%`, `${p.read}/${TOTAL_PAGES}`));
    const side = h('div', 'pl-side');
    if (finished) side.append(h('strong', '', L('Khatam mubarak! 🎉', 'ختم مبارک! 🎉', 'Khatam mubarak! 🎉')));
    else {
      side.append(h('span', 'pl-lab', L('Aaj ka hissa', 'آج کا حصہ', 'Today')));
      side.append(h('strong', '', L(`Safha ${g.startRead + 1}–${Math.min(TOTAL_PAGES, g.startRead + g.goal)}`, `صفحہ ${g.startRead + 1}–${Math.min(TOTAL_PAGES, g.startRead + g.goal)}`, `Pages ${g.startRead + 1}–${Math.min(TOTAL_PAGES, g.startRead + g.goal)}`)));
      side.append(h('span', 'pl-lab', L(`Aaj padha: ${Math.max(0, done)} / ${g.goal}`, `آج پڑھا: ${Math.max(0, done)} / ${g.goal}`, `Read today: ${Math.max(0, done)} / ${g.goal}`)));
    }
    top.appendChild(side);
    root.appendChild(top);

    if (!finished) {
      const act = h('div', 'pl-actions');
      act.append(
        button(L('Mushaf kholein', 'مصحف کھولیں', 'Open Mushaf'), 'btn', () => openPage(Math.min(TOTAL_PAGES, p.read + 1))),
        button(khDoneToday(p) ? '✓ ' + L('Aaj ka hissa poora', 'آج کا حصہ پورا', 'Today done') : L('Aaj ka hissa poora hua', 'آج کا حصہ پورا ہوا', 'Mark today done'), 'btn ' + (khDoneToday(p) ? 'ghost' : 'gold'), () => {
          if (khDoneToday(p)) return;
          p.read = Math.min(TOTAL_PAGES, g.startRead + g.goal);
          p.prevLast = p.lastDone;
          p.streak = p.lastDone === addDays(dayKey(), -1) ? (p.streak || 0) + 1 : 1;
          p.lastDone = dayKey();
          khSave(p);
          window.dispatchEvent(new CustomEvent('bayyin:planner'));
          build();
        })
      );
      root.appendChild(act);
      const fine = h('div', 'pl-actions');
      fine.append(
        button('−1 ' + L('safha', 'صفحہ', 'page'), 'dua-chip', () => { p.read = Math.max(0, p.read - 1); if (p.lastDone === dayKey() && p.read - g.startRead < g.goal) { p.lastDone = p.prevLast || null; p.streak = Math.max(0, (p.streak || 1) - 1); } khSave(p); build(); }),
        button('+1 ' + L('safha', 'صفحہ', 'page'), 'dua-chip', () => { p.read = Math.min(TOTAL_PAGES, p.read + 1); if (p.read - g.startRead >= g.goal && p.lastDone !== dayKey()) { p.prevLast = p.lastDone; p.streak = p.lastDone === addDays(dayKey(), -1) ? (p.streak || 0) + 1 : 1; p.lastDone = dayKey(); } khSave(p); window.dispatchEvent(new CustomEvent('bayyin:planner')); build(); })
      );
      root.appendChild(fine);
    }

    root.appendChild(statRow([
      [Math.max(0, TOTAL_PAGES - p.read), L('Baaki safhe', 'باقی صفحے', 'Pages left')],
      [left, L('Baaki din', 'باقی دن', 'Days left')],
      [p.streak || 0, L('Lagataar din', 'مسلسل دن', 'Streak')],
    ]));
    root.appendChild(h('p', 'hint', L(`Khatam ki tareekh: ${niceDate(p.endDay)}. Kam padha to baaki din mein hissa khud barh jata hai.`, `ختم کی تاریخ: ${niceDate(p.endDay)}۔ کم پڑھا تو باقی دنوں میں حصہ خود بڑھ جاتا ہے۔`, `Finish date: ${niceDate(p.endDay)}. If you read less, the daily portion adjusts itself.`)));
    if (!finished) root.append(...reminderRow(p, () => khSave(p), L('Bayyin: Quran ka aaj ka hissa', 'بیّن: قرآن کا آج کا حصہ', 'Bayyin: today’s Quran portion'), Math.max(1, left)));
    root.appendChild(button(L('Naya plan', 'نیا پلان', 'New plan'), 'dua-chip', () => {
      if (window.confirm(L('Purana plan hata kar naya banayein?', 'پرانا پلان ہٹا کر نیا بنائیں؟', 'Replace the current plan?'))) {
        khSave(null);
        setup();
      }
    }));
  }

  build();
  return { refresh: build };
}

// ---------------------------------------------------------------- HIFZ (premium)
const HF = 'tc.hifz';
const hfSave = (p) => writeJSON(HF, p);
const itemsCache = new Map();

function buildItems(scope) {
  const key = `${scope.kind}:${scope.from}:${scope.to}:${scope.reverse ? 1 : 0}`;
  if (itemsCache.has(key)) return itemsCache.get(key);
  let from = 1;
  let to = 114;
  if (scope.kind === 'juz30') from = 78;
  if (scope.kind === 'range') {
    from = Math.min(scope.from, scope.to);
    to = Math.max(scope.from, scope.to);
  }
  const list = [];
  const order = [];
  for (let s = from; s <= to; s += 1) order.push(s);
  if (scope.reverse) order.reverse();
  for (const s of order) for (let a = 1; a <= AY[s - 1]; a += 1) list.push([s, a]);
  itemsCache.set(key, list);
  return list;
}

function refRange(items, i, j) {
  if (!items[i]) return '';
  const a = items[i];
  const b = items[Math.min(j, items.length - 1)];
  // LRM after the Arabic name keeps "4–6" from flipping to "6–4" in the Latin line.
  const nm = (n) => `${surahName(n)}\u200E`;
  if (a[0] === b[0]) return a[1] === b[1] ? `${nm(a[0])} ${a[1]}` : `${nm(a[0])} ${a[1]}\u200E–\u200E${b[1]}`;
  return `${nm(a[0])} ${a[1]} → ${nm(b[0])} ${b[1]}`;
}

function perDayAyat(unit, n) {
  return unit === 'page' ? Math.max(1, Math.round(n * AY_PER_PAGE)) : Math.max(1, n);
}

export function mountHifz(root) {
  if (!root) return { refresh() {} };
  const openAt = (surah, aya) => window.dispatchEvent(new CustomEvent('bayyin:open', { detail: { surah, aya } }));

  function hfGoal(p, items) {
    const today = dayKey();
    if (!p.dayGoal || p.dayGoal.day !== today) {
      p.dayGoal = { day: today, startPos: p.pos, count: perDayAyat(p.unit, p.n) };
      hfSave(p);
    }
    return p.dayGoal;
  }
  const hfDone = (p, items, g) => p.pos >= Math.min(items.length, g.startPos + g.count);

  function setup() {
    root.innerHTML = '';
    root.className = 'planner';
    const form = { kind: 'juz30', from: 78, to: 114, reverse: false, unit: 'ayat', n: 3 };
    const card = h('div', 'pl-card');
    card.append(h('h3', '', L('Hifz plan banayein', 'حفظ پلان بنائیں', 'Plan your hifz')));
    card.append(h('p', 'hint', L('Kya aur roz kitna yaad karna hai chunein — app batayega kitne din lagenge.', 'کیا اور روز کتنا یاد کرنا ہے چنیں — ایپ بتائے گی کتنے دن لگیں گے۔', 'Choose what and how much per day — the app tells you how many days it takes.')));

    const scopeChips = h('div', 'pl-chips');
    const rangeRow = h('div', 'pl-row');
    const mkSelect = (value, onChange) => {
      const sel = h('select', 'pl-select');
      for (const s of SURAHS) {
        const o = h('option', '', `${s.n}. ${s.latin}`);
        o.value = String(s.n);
        sel.appendChild(o);
      }
      sel.value = String(value);
      sel.addEventListener('change', () => onChange(Number(sel.value)));
      return sel;
    };
    rangeRow.append(mkSelect(form.from, (v) => { form.from = v; paint(); }), h('span', '', '→'), mkSelect(form.to, (v) => { form.to = v; paint(); }));
    const rev = h('label', 'pl-check');
    const revBox = h('input');
    revBox.type = 'checkbox';
    revBox.addEventListener('change', () => { form.reverse = revBox.checked; paint(); });
    rev.append(revBox, h('span', '', ' ' + L('Aakhir se shuru (ulta)', 'آخر سے شروع (الٹا)', 'Start from the end (reverse)')));
    const scopes = [['all', L('Poora Quran', 'پورا قرآن', 'Whole Quran')], ['juz30', L('Juz Amma', 'پارہ عم', 'Juz Amma')], ['range', L('Surah chunein', 'سورتیں چنیں', 'Pick surahs')]];
    for (const [k, label] of scopes) {
      const c = button(label, 'dua-chip', () => { form.kind = k; paint(); });
      c.dataset.k = k;
      scopeChips.appendChild(c);
    }

    const unitChips = h('div', 'pl-chips');
    const stepper = h('div', 'pl-stepper');
    const minus = button('−', 'pl-step', () => { form.n = Math.max(form.unit === 'page' ? 0.5 : 1, form.unit === 'page' && form.n <= 1 ? 0.5 : form.n - 1); paint(); });
    const val = h('strong', 'pl-step-v');
    const plus = button('+', 'pl-step', () => { form.n = form.unit === 'page' && form.n < 1 ? 1 : form.n + 1; paint(); });
    stepper.append(minus, val, plus);
    const unitBtns = [['ayat', L('Ayat', 'آیات', 'Ayat')], ['page', L('Safha', 'صفحہ', 'Pages')]];
    for (const [k, label] of unitBtns) {
      const c = button(label, 'dua-chip', () => { form.unit = k; form.n = k === 'page' ? 0.5 : 3; paint(); });
      c.dataset.u = k;
      unitChips.appendChild(c);
    }
    const quick = h('div', 'pl-chips pl-quick');
    const out = h('div', 'pl-result');

    const startBtn = button(L('Shuru karein', 'شروع کریں', 'Start'), 'btn', () => {
      if (!isPremium()) {
        window.dispatchEvent(new CustomEvent('bayyin:paywall'));
        return;
      }
      const scope = { kind: form.kind, from: form.from, to: form.to, reverse: form.reverse };
      hfSave({ scope, unit: form.unit, n: form.n, pos: 0, mz: 0, log: [], streak: 0, lastDone: null, startDay: dayKey(), remind: false, time: '20:00' });
      build();
    });

    function paint() {
      const items = buildItems(form);
      const per = perDayAyat(form.unit, form.n);
      const days = Math.ceil(items.length / per);
      val.textContent = form.unit === 'page' ? (form.n === 0.5 ? '½' : String(form.n)) : String(form.n);
      scopeChips.querySelectorAll('.dua-chip').forEach((c) => c.classList.toggle('is-on', c.dataset.k === form.kind));
      unitChips.querySelectorAll('.dua-chip').forEach((c) => c.classList.toggle('is-on', c.dataset.u === form.unit));
      rangeRow.hidden = form.kind !== 'range';
      out.innerHTML = '';
      out.append(
        h('strong', '', L(`≈ ${fmtDays(days)}`, `≈ ${fmtDays(days)}`, `≈ ${fmtDays(days)}`)),
        h('span', '', L(`Roz ${per} ayat × ${items.length} ayat = khatam ${niceDate(addDays(dayKey(), days - 1))}`, `روز ${per} آیات × ${items.length} آیات = ختم ${niceDate(addDays(dayKey(), days - 1))}`, `${per} ayat a day × ${items.length} ayat = done ${niceDate(addDays(dayKey(), days - 1))}`))
      );
      quick.innerHTML = '';
      for (const [u, n, label] of [['ayat', 1, '1'], ['ayat', 3, '3'], ['ayat', 5, '5'], ['ayat', 10, '10'], ['page', 0.5, '½'], ['page', 1, '1']]) {
        const d = Math.ceil(items.length / perDayAyat(u, n));
        const c = button('', 'dua-chip', () => { form.unit = u; form.n = n; paint(); });
        c.append(h('b', '', `${label} ${u === 'page' ? L('safha', 'صفحہ', 'pg') : L('ayat', 'آیات', 'ayat')}`), h('small', '', ' · ' + fmtDays(d)));
        quick.appendChild(c);
      }
      startBtn.textContent = isPremium() ? L('Shuru karein', 'شروع کریں', 'Start') : '🔒 ' + L('Premium se shuru karein', 'پریمیم سے شروع کریں', 'Start with Premium');
    }

    card.append(h('h4', '', L('Kya yaad karna hai', 'کیا یاد کرنا ہے', 'What to memorise')), scopeChips, rangeRow, rev);
    card.append(h('h4', '', L('Roz kitna', 'روز کتنا', 'Per day')), unitChips, stepper, quick, out, startBtn);
    root.appendChild(card);
    paint();
  }

  const RV_CYCLES = [5, 7, 10, 15, 30];

  /** Murajaa (revision) of everything already memorised: one full cycle in N days. */
  function murajaaCard(p, items, g, finished) {
    const today = dayKey();
    const M = finished ? items.length : g.startPos; // memorised before today's sabaq
    const card = h('div', 'pl-card');
    card.append(h('h3', '', L('Murajaa plan (dohrana)', 'مراجعہ پلان (دہرانا)', 'Murajaa plan (revision)')));
    if (M <= 0) {
      card.append(h('p', 'hint', L('Pehla sabaq yaad hone ke baad, kal se murajaa yahan shuru hoga.', 'پہلا سبق یاد ہونے کے بعد، کل سے مراجعہ یہاں شروع ہوگا۔', 'Revision starts here tomorrow, once your first sabaq is memorised.')));
      return card;
    }
    const cycle = p.rvDays || 10;
    const count = Math.max(1, Math.ceil(M / cycle));
    if (!p.rvToday || p.rvToday.day !== today) {
      const from = (p.rvPtr || 0) >= M ? 0 : p.rvPtr || 0;
      p.rvToday = { day: today, from, count: Math.min(count, M - from), done: false };
      hfSave(p);
    }
    const t = p.rvToday;
    const last = t.from + t.count - 1;
    card.append(h('p', 'hint', L(`Ab tak yaad: ${M} ayat. Sab ka ek chakkar ${cycle} din me — roz ~${count} ayat.`, `اب تک یاد: ${M} آیات۔ سب کا ایک چکر ${cycle} دن میں — روز ~${count} آیات۔`, `Memorised so far: ${M} ayat. One full round every ${cycle} days — about ${count} ayat a day.`)));

    const chips = h('div', 'pl-chips');
    for (const d of RV_CYCLES) {
      const c = button(L(`${d} din`, `${d} دن`, `${d} days`), 'dua-chip' + (d === cycle ? ' is-on' : ''), () => {
        p.rvDays = d;
        if (!p.rvToday.done) p.rvToday = null;
        hfSave(p);
        build();
      });
      chips.appendChild(c);
    }
    card.appendChild(chips);

    const box = h('div', 'pl-result');
    box.append(
      h('span', '', t.done ? L('Aaj ki murajaa ✓', 'آج کی مراجعہ ✓', 'Today’s murajaa ✓') : L('Aaj ki murajaa', 'آج کی مراجعہ', 'Today’s murajaa')),
      h('strong', '', refRange(items, t.from, last)),
      h('span', '', L(`${t.count} ayat • chakkar ${Math.round((t.from / M) * 100)}% • ${p.rvCycles || 0} chakkar mukammal`, `${t.count} آیات • چکر ${Math.round((t.from / M) * 100)}% • ${p.rvCycles || 0} چکر مکمل`, `${t.count} ayat • round ${Math.round((t.from / M) * 100)}% • ${p.rvCycles || 0} rounds completed`))
    );
    card.appendChild(box);

    const act = h('div', 'pl-actions');
    act.append(
      button(L('Mushaf mein kholein', 'مصحف میں کھولیں', 'Open in Mushaf'), 'btn ghost', () => openAt(items[t.from][0], items[t.from][1])),
      button(L('🎯 Hifz Test se jaanchein', '🎯 حفظ ٹیسٹ سے جانچیں', '🎯 Check with Hifz Test'), 'btn ghost', () =>
        window.dispatchEvent(new CustomEvent('bayyin:hztest', { detail: { items: items.slice(t.from, last + 1) } }))
      )
    );
    if (!t.done) {
      act.append(
        button('✓ ' + L('Murajaa poori', 'مراجعہ پوری', 'Murajaa done'), 'btn gold', () => {
          let next = t.from + t.count;
          if (next >= M) {
            next = 0;
            p.rvCycles = (p.rvCycles || 0) + 1;
          }
          p.rvPtr = next;
          t.done = true;
          hfSave(p);
          window.dispatchEvent(new CustomEvent('bayyin:planner'));
          build();
        })
      );
    } else {
      const nextFrom = (p.rvPtr || 0) >= M ? 0 : p.rvPtr || 0;
      card.append(h('p', 'hint', L(`Kal: ${refRange(items, nextFrom, Math.min(M - 1, nextFrom + count - 1))}`, `کل: ${refRange(items, nextFrom, Math.min(M - 1, nextFrom + count - 1))}`, `Tomorrow: ${refRange(items, nextFrom, Math.min(M - 1, nextFrom + count - 1))}`)));
    }
    card.appendChild(act);
    return card;
  }

  function build() {
    const p = readJSON(HF);
    if (!p) return setup();
    root.innerHTML = '';
    root.className = 'planner';
    const items = buildItems(p.scope);
    const g = hfGoal(p, items);
    const finished = p.pos >= items.length;
    const done = hfDone(p, items, g);
    const per = g.count;
    const remaining = Math.max(0, items.length - g.startPos);
    const daysLeft = Math.ceil(remaining / per);
    const end = Math.min(items.length, g.startPos + g.count) - 1;

    const top = h('div', 'pl-card pl-top');
    top.appendChild(ring(p.pos / items.length, `${Math.round((p.pos / items.length) * 100)}%`, `${p.pos}/${items.length}`));
    const side = h('div', 'pl-side');
    if (finished) side.append(h('strong', '', L('Hifz mukammal! 🎉', 'حفظ مکمل! 🎉', 'Hifz complete! 🎉')));
    else {
      side.append(h('span', 'pl-lab', L('Aaj ka sabaq', 'آج کا سبق', 'Today’s sabaq')), h('strong', '', refRange(items, g.startPos, end)), h('span', 'pl-lab', L(`${Math.min(per, items.length - g.startPos)} ayat`, `${Math.min(per, items.length - g.startPos)} آیات`, `${Math.min(per, items.length - g.startPos)} ayat`)));
    }
    top.appendChild(side);
    root.appendChild(top);

    if (!finished) {
      // today's text
      if (isLoaded()) {
        const box = h('div', 'pl-text');
        box.lang = 'ar';
        box.dir = 'rtl';
        const shown = items.slice(g.startPos, end + 1).slice(0, 12);
        box.textContent = shown.map(([s, a]) => { const v = getVerses(s, a, a)[0]; return v ? `${v.ayaText || v.text} ﴿${a}﴾` : ''; }).join(' ');
        root.appendChild(box);
        if (end + 1 - g.startPos > 12) root.appendChild(h('p', 'hint', '…'));
      }
      const act = h('div', 'pl-actions');
      act.append(
        button(L('Mushaf mein kholein', 'مصحف میں کھولیں', 'Open in Mushaf'), 'btn', () => openAt(items[g.startPos][0], items[g.startPos][1])),
        button(done ? '✓ ' + L('Aaj ka sabaq poora', 'آج کا سبق پورا', 'Sabaq done') : L('Sabaq yaad ho gaya', 'سبق یاد ہو گیا', 'Sabaq memorised'), 'btn ' + (done ? 'ghost' : 'gold'), () => {
          if (done) return;
          p.pos = Math.min(items.length, g.startPos + g.count);
          p.log = (p.log || []).filter((e) => e.day !== dayKey());
          p.log.push({ day: dayKey(), s: g.startPos, e: p.pos - 1 });
          p.log = p.log.slice(-60);
          const size = Math.max(10, per * 2);
          p.mz = g.startPos > 0 ? (((p.mz || 0) + size) % Math.max(1, g.startPos)) : 0;
          p.prevLast = p.lastDone;
          p.streak = p.lastDone === addDays(dayKey(), -1) ? (p.streak || 0) + 1 : 1;
          p.lastDone = dayKey();
          hfSave(p);
          window.dispatchEvent(new CustomEvent('bayyin:planner'));
          build();
        })
      );
      root.appendChild(act);

      // sabqi: the last few sabaq; manzil: older memorised part, in turn
      const rev = h('div', 'pl-card');
      const sabqi = (p.log || []).filter((e) => e.day !== dayKey()).slice(-5);
      rev.append(h('h4', '', L('Sabqi (pichhle 5 sabaq dohrayein)', 'سبقی (پچھلے 5 سبق دہرائیں)', 'Sabqi (revise the last 5 sabaq)')));
      if (sabqi.length) for (const e of sabqi) rev.append(h('p', 'pl-line', refRange(items, e.s, e.e)));
      else rev.append(h('p', 'hint', L('Kal se yahan pichhle sabaq aayenge.', 'کل سے یہاں پچھلے سبق آئیں گے۔', 'Previous sabaq will show here from tomorrow.')));
      root.appendChild(rev);
    }
    root.appendChild(murajaaCard(p, items, g, finished));

    root.appendChild(statRow([
      [remaining, L('Baaki ayat', 'باقی آیات', 'Ayat left')],
      [daysLeft, L('Baaki din', 'باقی دن', 'Days left')],
      [p.streak || 0, L('Lagataar din', 'مسلسل دن', 'Streak')],
    ]));
    if (!finished) {
      root.appendChild(h('p', 'hint', L(`Isi raftaar se hifz ${niceDate(addDays(dayKey(), daysLeft - 1))} tak mukammal hoga (${fmtDays(daysLeft)}).`, `اسی رفتار سے حفظ ${niceDate(addDays(dayKey(), daysLeft - 1))} تک مکمل ہوگا (${fmtDays(daysLeft)})۔`, `At this pace you finish by ${niceDate(addDays(dayKey(), daysLeft - 1))} (${fmtDays(daysLeft)}).`)));
      // change pace
      const pace = h('div', 'pl-row');
      pace.append(h('label', '', L('Roz ki miqdar (ayat)', 'روز کی مقدار (آیات)', 'Daily amount (ayat)')));
      const stepper = h('div', 'pl-stepper');
      const change = (delta) => {
        const cur = perDayAyat(p.unit, p.n);
        p.unit = 'ayat';
        p.n = Math.max(1, cur + delta);
        if (!done) p.dayGoal = null;
        hfSave(p);
        build();
      };
      stepper.append(button('−', 'pl-step', () => change(-1)), h('strong', 'pl-step-v', String(per)), button('+', 'pl-step', () => change(1)));
      pace.appendChild(stepper);
      root.appendChild(pace);
      root.append(...reminderRow(p, () => hfSave(p), L('Bayyin: aaj ka hifz sabaq', 'بیّن: آج کا حفظ سبق', 'Bayyin: today’s hifz sabaq'), Math.max(1, daysLeft)));
    }
    root.appendChild(button(L('Naya plan', 'نیا پلان', 'New plan'), 'dua-chip', () => {
      if (window.confirm(L('Purana plan hata kar naya banayein?', 'پرانا پلان ہٹا کر نیا بنائیں؟', 'Replace the current plan?'))) {
        hfSave(null);
        setup();
      }
    }));
  }

  build();
  return { refresh: build };
}

// ---------------------------------------------------------------- today list + reminder loop
export function pendingToday() {
  const out = [];
  const k = readJSON(KH);
  if (k && k.read < TOTAL_PAGES && !khDoneToday(k)) {
    const g = khGoal(k);
    out.push({ id: 'khatam', view: 'khatam', text: L(`Khatam: aaj safha ${g.startRead + 1}–${Math.min(TOTAL_PAGES, g.startRead + g.goal)} baaki hai`, `ختم: آج صفحہ ${g.startRead + 1}–${Math.min(TOTAL_PAGES, g.startRead + g.goal)} باقی ہے`, `Khatam: pages ${g.startRead + 1}–${Math.min(TOTAL_PAGES, g.startRead + g.goal)} left today`) });
  }
  const f = readJSON(HF);
  if (f && isPremium()) {
    const items = buildItems(f.scope);
    if (f.pos < items.length) {
      const g = f.dayGoal && f.dayGoal.day === dayKey() ? f.dayGoal : { startPos: f.pos, count: perDayAyat(f.unit, f.n) };
      if (!hfDone(f, items, g) && true) out.push({ id: 'hifz', view: 'hifz', text: L(`Hifz: aaj ka sabaq ${refRange(items, g.startPos, g.startPos + g.count - 1)} baaki hai`, `حفظ: آج کا سبق ${refRange(items, g.startPos, g.startPos + g.count - 1)} باقی ہے`, `Hifz: today’s sabaq ${refRange(items, g.startPos, g.startPos + g.count - 1)} is left`) });
    }
  }
  const due = hifzTestDue();
  if (due > 0) {
    out.push({ id: 'hztest', view: 'hztest', text: L(`Hifz Test: ${due} ayaat ki murajaat due hai`, `حفظ ٹیسٹ: ${due} آیات کی مراجعت واجب ہے`, `Hifz Test: ${due} ayaat due for review`) });
  }
  if (f && isPremium() && f.pos > 0) {
    const items = buildItems(f.scope);
    const fin = f.pos >= items.length;
    const M = fin ? items.length : f.dayGoal && f.dayGoal.day === dayKey() ? f.dayGoal.startPos : f.pos;
    const done = f.rvToday && f.rvToday.day === dayKey() && f.rvToday.done;
    if (M > 0 && !done) out.push({ id: 'murajaa', view: 'hifz', text: L('Murajaa: aaj ki dohrai baaki hai', 'مراجعہ: آج کی دہرائی باقی ہے', 'Murajaa: today’s revision is left') });
  }
  return out;
  function hfDone(p, items, g) {
    return p.pos >= Math.min(items.length, g.startPos + g.count);
  }
}

export function startReminderLoop() {
  const check = () => {
    const now = new Date();
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const today = dayKey();
    for (const [key, id, title] of [[KH, 'khatam', 'Bayyin'], [HF, 'hifz', 'Bayyin']]) {
      const p = readJSON(key);
      if (!p || !p.remind || p.notified === today || hhmm < (p.time || '20:00')) continue;
      const pending = pendingToday().find((x) => x.id === id);
      if (!pending) continue;
      p.notified = today;
      writeJSON(key, p);
      notify(id, title, pending.text);
    }
  };
  check();
  window.setInterval(check, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}
