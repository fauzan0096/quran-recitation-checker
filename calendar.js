// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
// Hijri month page: today's date, a month grid with the Gregorian day underneath.

import { t } from './i18n.js';
import {
  hijriMonthLength,
  hijriToJDN,
  jdnToGregorian,
  jdnToHijri,
  todayJDN,
} from './hijri.js';

const monthName = (month) => t(`hm.${month}`);
const weekdayName = (index) => t(`wd.${index}`);

export function mountCalendar(root) {
  if (!root) return { refresh() {} };

  let today = todayJDN();
  let view = jdnToHijri(today);
  view = { year: view.year, month: view.month };

  function build() {
    today = todayJDN();
    const firstJDN = hijriToJDN(view.year, view.month, 1);
    const days = hijriMonthLength(view.year, view.month);
    const offset = (firstJDN + 1) % 7; // 0 = Sunday
    const startG = jdnToGregorian(firstJDN);
    const endG = jdnToGregorian(firstJDN + days - 1);

    root.innerHTML = '';
    root.className = 'calendar';

    const card = document.createElement('div');
    card.className = 'cal-today';

    const hijriToday = jdnToHijri(today);
    const title = document.createElement('strong');
    title.lang = 'ar';
    title.dir = 'rtl';
    title.textContent = `${hijriToday.day} ${monthName(hijriToday.month)} ${hijriToday.year}`;

    const sub = document.createElement('span');
    const g = jdnToGregorian(today);
    sub.textContent = `${t('cal.today')} · ${g.day}/${g.month}/${g.year} · ${weekdayName(
      (today + 1) % 7
    )}`;

    card.append(title, sub);
    root.appendChild(card);

    const head = document.createElement('div');
    head.className = 'cal-head';

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'btn ghost small';
    prev.textContent = '◀';
    prev.setAttribute('aria-label', t('cal.prev'));
    prev.addEventListener('click', () => {
      if (view.month === 1) view = { year: view.year - 1, month: 12 };
      else view = { year: view.year, month: view.month - 1 };
      build();
    });

    const label = document.createElement('div');
    label.className = 'cal-label';
    const strong = document.createElement('strong');
    strong.lang = 'ar';
    strong.dir = 'rtl';
    strong.textContent = `${monthName(view.month)} ${view.year}`;
    const range = document.createElement('span');
    range.textContent = `${startG.day}/${startG.month}/${startG.year} – ${endG.day}/${endG.month}/${endG.year}`;
    label.append(strong, range);

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn ghost small';
    next.textContent = '▶';
    next.setAttribute('aria-label', t('cal.next'));
    next.addEventListener('click', () => {
      if (view.month === 12) view = { year: view.year + 1, month: 1 };
      else view = { year: view.year, month: view.month + 1 };
      build();
    });

    head.append(prev, label, next);
    root.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'cal-grid';
    for (let index = 0; index < 7; index += 1) {
      const cell = document.createElement('span');
      cell.className = 'cal-wd';
      cell.textContent = weekdayName(index);
      grid.appendChild(cell);
    }
    for (let index = 0; index < offset; index += 1) {
      const blank = document.createElement('span');
      blank.className = 'cal-day is-blank';
      grid.appendChild(blank);
    }
    for (let day = 1; day <= days; day += 1) {
      const jdn = firstJDN + day - 1;
      const gregorian = jdnToGregorian(jdn);
      const cell = document.createElement('span');
      cell.className = 'cal-day';
      if (jdn === today) cell.classList.add('is-today');
      if (((jdn + 1) % 7) === 5) cell.classList.add('is-friday');
      const big = document.createElement('strong');
      big.textContent = String(day);
      const small = document.createElement('small');
      small.textContent = String(gregorian.day);
      cell.append(big, small);
      grid.appendChild(cell);
    }
    root.appendChild(grid);

    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = t('cal.note');
    root.appendChild(note);
  }

  build();
  return {
    refresh() {
      const now = jdnToHijri(todayJDN());
      view = { year: now.year, month: now.month };
      build();
    },
  };
}