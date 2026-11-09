// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
// "Roz ka Noor": one aya, one hadith and one sunnah a day, plus the 60 sunnahs.
// The aya text always comes from the bundled mushaf — it is never retyped.

import { getLanguage, t } from './i18n.js';
import { AYAT, AHADITH, AYAT_MEANING, SUNNAHS } from './daily-content.js';
import { getVerses, isLoaded } from './quran.js';
import { surahName } from './surahs.js';
import { shareStatus } from './status-card.js';
import { todayHijri } from './hijri.js';

const english = () => getLanguage() === 'en';
const meaning = (item) => (english() ? item.en : item.rm);

/** Same item for the same calendar day, rotating through the list. */
function dayIndex(length) {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - start) / 86400000);
  return ((days % length) + length) % length;
}

export function mountDaily(root, options = {}) {
  const compact = Boolean(options.compact);
  if (!root) return { refresh() {} };

  async function share(button, payload) {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = t('daily.working');
    const result = await shareStatus({
      ...payload,
      message: t('daily.shareText'),
    });
    button.disabled = false;
    button.textContent = result === 'failed' ? t('daily.failed') : t('daily.shared');
    window.setTimeout(() => {
      button.textContent = label;
    }, 2200);
  }

  function card({ kind, title, arabic, text, reference }) {
    const box = document.createElement('article');
    box.className = `daily-card is-${kind}`;

    const head = document.createElement('div');
    head.className = 'daily-head';
    const label = document.createElement('span');
    label.className = 'daily-label';
    label.textContent = title;
    head.appendChild(label);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn ghost small';
    button.textContent = t('daily.share');
    button.addEventListener('click', () => share(button, { title, arabic, text, reference }));
    head.appendChild(button);
    box.appendChild(head);

    if (arabic) {
      const arab = document.createElement('p');
      arab.className = 'daily-arabic';
      arab.lang = 'ar';
      arab.dir = 'rtl';
      arab.textContent = arabic;
      box.appendChild(arab);
    }
    if (text) {
      const body = document.createElement('p');
      body.className = 'daily-text';
      body.textContent = text;
      box.appendChild(body);
    }
    if (reference) {
      const ref = document.createElement('span');
      ref.className = 'daily-ref';
      ref.textContent = reference;
      box.appendChild(ref);
    }
    return box;
  }

  function build() {
    root.innerHTML = '';
    root.className = compact ? 'daily is-compact' : 'daily';

    const now = new Date();
    const hijri = todayHijri();
    const strip = document.createElement('div');
    strip.className = 'daily-date';
    strip.textContent = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} · ${hijri.day} ${t(
      `hm.${hijri.month}`
    )} ${hijri.year}`;
    root.appendChild(strip);

    const sheet = document.createElement('div');
    sheet.className = 'noor-sheet';
    root.appendChild(sheet);

    const ayah = AYAT[dayIndex(AYAT.length)];
    const hadith = AHADITH[dayIndex(AHADITH.length)];
    const sunnah = SUNNAHS[dayIndex(SUNNAHS.length)];
    const verse = isLoaded() ? getVerses(ayah[0], ayah[1], ayah[1])[0] : null;
    const reference = `${surahName(ayah[0])} ${ayah[1]}`;

    if (verse) {
      const tarjuma = AYAT_MEANING[`${ayah[0]}:${ayah[1]}`];
      sheet.appendChild(
        card({
          kind: 'ayah',
          title: t('daily.ayah'),
          arabic: verse.ayaText || verse.text,
          text: tarjuma ? meaning(tarjuma) : '',
          reference,
        })
      );
    } else {
      const missing = document.createElement('p');
      missing.className = 'hint';
      missing.textContent = t('daily.missing');
      sheet.appendChild(missing);
    }

    sheet.appendChild(
      card({
        kind: 'hadith',
        title: t('daily.hadith'),
        arabic: hadith.ar,
        text: meaning(hadith),
        reference: hadith.ref,
      })
    );

    sheet.appendChild(
      card({
        kind: 'sunnah',
        title: t('daily.sunnah'),
        text: meaning(sunnah),
        reference: sunnah.ref,
      })
    );

    if (compact) return;

    const details = document.createElement('details');
    details.className = 'card daily-list';
    const summary = document.createElement('summary');
    summary.textContent = `${t('daily.sunnahs')} (${SUNNAHS.length})`;
    details.appendChild(summary);

    for (let index = 0; index < SUNNAHS.length; index += 1) {
      const item = SUNNAHS[index];
      const row = document.createElement('div');
      row.className = 'daily-row';
      const number = document.createElement('span');
      number.className = 'daily-row-num';
      number.textContent = String(index + 1);
      const body = document.createElement('div');
      body.className = 'daily-row-body';
      const line = document.createElement('p');
      line.textContent = meaning(item);
      const ref = document.createElement('span');
      ref.className = 'daily-ref';
      ref.textContent = item.ref;
      body.append(line, ref);
      const shareButton = document.createElement('button');
      shareButton.type = 'button';
      shareButton.className = 'icon-btn small';
      shareButton.textContent = '↗';
      shareButton.title = t('daily.share');
      shareButton.addEventListener('click', () =>
        share(shareButton, {
          title: t('daily.sunnah'),
          text: meaning(item),
          reference: item.ref,
        })
      );
      row.append(number, body, shareButton);
      details.appendChild(row);
    }
    root.appendChild(details);

    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = t('daily.note');
    root.appendChild(note);
  }

  build();
  return {
    refresh() {
      build();
    },
  };
}
