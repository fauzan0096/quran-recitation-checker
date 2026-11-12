// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
// "Roz ka Noor": one aya, one hadith and one sunnah a day, plus the 60 sunnahs.
// The aya text always comes from the bundled mushaf — it is never retyped.

import { getLanguage, t } from './i18n.js';
import { AYAT, AHADITH, AYAT_MEANING, SUNNAHS } from './daily-content.js';
import { getVerses, isLoaded } from './quran.js';
import { surahName } from './surahs.js';
import { shareStatus, shareDailyPage, PLAY_URL } from './status-card.js';
import { hijriArabic, todayHijri } from './hijri.js';

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
    // The home screen already shows the date in its own header, so the compact
    // copy there does not repeat it.
    if (!compact) {
      const strip = document.createElement('div');
      strip.className = 'daily-date';
      const en = document.createElement('span');
      en.className = 'date-en';
      en.textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const ar = document.createElement('span');
      ar.className = 'date-ar';
      ar.lang = 'ar';
      ar.dir = 'rtl';
      ar.textContent = hijriArabic(hijri);
      strip.append(en, ar);
      root.appendChild(strip);
    }

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
    } else if (!compact) {
      // The home screen quietly leaves the ayah out until the Quran text
      // arrives (it is refreshed right after) instead of warning about it.
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

    // The whole page as it looks in the app (burgundy, gold, the three cards).
    const tarjuma = AYAT_MEANING[`${ayah[0]}:${ayah[1]}`];
    const statusPayload = () => ({
      date: now.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      hijri: hijriArabic(hijri),
      items: [
        {
          title: t('daily.ayah'),
          arabic: verse ? verse.ayaText || verse.text : '',
          text: tarjuma ? meaning(tarjuma) : '',
          reference,
        },
        {
          title: t('daily.hadith'),
          arabic: hadith.ar,
          text: meaning(hadith),
          reference: hadith.ref,
        },
        {
          title: t('daily.sunnah'),
          arabic: '',
          text: meaning(sunnah),
          reference: sunnah.ref,
        },
      ],
    });

    const withLabel = (button, task) => {
      button.addEventListener('click', async () => {
        const label = button.textContent;
        button.disabled = true;
        button.textContent = t('daily.working');
        const result = await task();
        button.disabled = false;
        button.textContent =
          result === 'failed' ? t('daily.failed') : result === 'downloaded' ? t('daily.saved') : label;
        window.setTimeout(() => {
          button.textContent = label;
        }, 2200);
      });
    };

    const shareAll = document.createElement('button');
    shareAll.type = 'button';
    shareAll.className = 'btn small';
    shareAll.textContent = '↗ ' + t('daily.shareAll');
    withLabel(shareAll, () => shareDailyPage(statusPayload()));

    const appLink = document.createElement('button');
    appLink.type = 'button';
    appLink.className = 'btn ghost small';
    appLink.textContent = '📲 ' + t('daily.appLink');
    appLink.addEventListener('click', async () => {
      const label = appLink.textContent;
      const link = PLAY_URL;
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Bayyin (بيّن)', text: `${t('share.text')} ${link}` });
        } else {
          await navigator.clipboard.writeText(`${t('share.text')} ${link}`);
          appLink.textContent = t('daily.appCopied');
        }
      } catch (error) {
        appLink.textContent = t('daily.appCopied');
        try {
          await navigator.clipboard.writeText(`${t('share.text')} ${link}`);
        } catch (inner) {
          /* clipboard refused */
        }
      }
      window.setTimeout(() => {
        appLink.textContent = label;
      }, 2200);
    });

    const row = document.createElement('div');
    row.className = 'noor-share-row';
    row.append(shareAll, appLink);
    sheet.appendChild(row);

    // Roz bas ek sunnah — the whole 60-sunnah list is not opened here.
    if (compact) return;

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
