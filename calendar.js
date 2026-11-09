// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
// Calendar: Gregorian date big (English digits), Hijri small underneath.
// Hijri follows the place (time zone) and can be nudged by a day, because
// local moon sighting moves the month start.

import { getLanguage, t } from './i18n.js';
import { gregorianToJDN, hijriArabic, hijriMonthArabic, hijriOf, hijriOffset, setHijriOffset } from './hijri.js';

const monthName = (month) => t(`hm.${month}`);
const locale = () => (getLanguage() === 'ur' ? 'ur-PK-u-nu-latn' : 'en-GB');

export function mountCalendar(root) {
  if (!root) return { refresh() {} };

  const now = new Date();
  let view = { year: now.getFullYear(), month: now.getMonth() };

  const hijriText = (h) => `${h.day} ${monthName(h.month)} ${h.year}`;

  function build() {
    const today = new Date();
    const first = new Date(view.year, view.month, 1);
    const days = new Date(view.year, view.month + 1, 0).getDate();
    const startDay = first.getDay(); // 0 = Sunday

    root.innerHTML = '';
    root.className = 'calendar';

    const card = document.createElement('div');
    card.className = 'cal-today';
    const big = document.createElement('strong');
    big.className = 'cal-big';
    big.textContent = today.toLocaleDateString(locale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const sub = document.createElement('span');
    sub.className = 'cal-small';
    sub.lang = 'ar';
    sub.dir = 'rtl';
    sub.textContent = hijriArabic(
      hijriOf(gregorianToJDN(today.getFullYear(), today.getMonth() + 1, today.getDate()))
    );
    card.append(big, sub);
    root.appendChild(card);

    const head = document.createElement('div');
    head.className = 'cal-head';
    const nav = (label, delta, aria) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ghost small';
      b.textContent = label;
      b.setAttribute('aria-label', aria);
      b.addEventListener('click', () => {
        const d = new Date(view.year, view.month + delta, 1);
        view = { year: d.getFullYear(), month: d.getMonth() };
        build();
      });
      return b;
    };
    const label = document.createElement('div');
    label.className = 'cal-label';
    const lastJ = gregorianToJDN(view.year, view.month + 1, days);
    const firstJ = gregorianToJDN(view.year, view.month + 1, 1);
    const h1 = hijriOf(firstJ);
    const h2 = hijriOf(lastJ);
    label.innerHTML = '<strong></strong><small lang="ar" dir="rtl"></small>';
    label.querySelector('strong').textContent = first.toLocaleDateString(locale(), {
      month: 'long',
      year: 'numeric',
    });
    label.querySelector('small').textContent =
      h1.month === h2.month && h1.year === h2.year
        ? `${hijriMonthArabic(h1.month)} ${h1.year}`
        : `${hijriMonthArabic(h1.month)} – ${hijriMonthArabic(h2.month)} ${h2.year}`;
    head.append(nav('◀', -1, t('cal.prev')), label, nav('▶', 1, t('cal.next')));
    root.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'cal-grid';
    for (let i = 0; i < 7; i += 1) {
      const cell = document.createElement('span');
      cell.className = 'cal-wd';
      cell.textContent = t(`wd.${i}`);
      grid.appendChild(cell);
    }
    for (let i = 0; i < startDay; i += 1) {
      const blank = document.createElement('span');
      blank.className = 'cal-day is-blank';
      grid.appendChild(blank);
    }
    for (let day = 1; day <= days; day += 1) {
      const cell = document.createElement('span');
      cell.className = 'cal-day';
      if (
        day === today.getDate() &&
        view.month === today.getMonth() &&
        view.year === today.getFullYear()
      ) {
        cell.classList.add('is-today');
      }
      if ((startDay + day - 1) % 7 === 5) cell.classList.add('is-friday');
      const g = document.createElement('strong');
      g.textContent = String(day);
      const hj = hijriOf(gregorianToJDN(view.year, view.month + 1, day));
      const small = document.createElement('small');
      small.textContent = String(hj.day);
      cell.append(g, small);
      grid.appendChild(cell);
    }
    root.appendChild(grid);

    // Hijri day adjustment
    const adj = document.createElement('div');
    adj.className = 'cal-adj';
    const lab = document.createElement('span');
    lab.textContent = t('cal.adjust');
    adj.appendChild(lab);
    for (const v of [-1, 0, 1]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dua-chip' + (hijriOffset() === v ? ' is-on' : '');
      b.textContent = v > 0 ? `+${v}` : String(v);
      b.addEventListener('click', () => {
        setHijriOffset(v);
        build();
      });
      adj.appendChild(b);
    }
    const auto = document.createElement('button');
    auto.type = 'button';
    auto.className = 'dua-chip';
    auto.textContent = t('cal.auto');
    auto.addEventListener('click', () => {
      setHijriOffset('auto');
      build();
    });
    adj.appendChild(auto);
    root.appendChild(adj);

    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = t('cal.note');
    root.appendChild(note);
  }

  build();
  return {
    refresh() {
      const n = new Date();
      view = { year: n.getFullYear(), month: n.getMonth() };
      build();
    },
  };
}
