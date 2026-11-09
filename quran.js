// Loads and parses the Uthmani Quran text (Tanzil "txt-2" format:
// every line is  surah|aya|text  and comment lines start with '#').

import { normalizeArabic } from './normalize.js';

const ROW = /^(\d+)\|(\d+)\|(.+)$/;

// Normalised words of "بسم الله الرحمن الرحيم", used to recognise a basmala
// that Tanzil puts at the head of the first aya of a surah.
const BASMALA_WORDS = ['بسم', 'الله', 'الرحمن', 'الرحيم'];

export const TOTAL_AYAS = 6236;
export const TOTAL_SURAHS = 114;

let store = null;

export async function loadQuran(url = 'quran-tanzil.txt') {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(
      'Quran text load nahi hui. index.html ko seedha file se na kholein — GitHub Pages ya kisi local server se kholein.'
    );
  }
  if (!response.ok) {
    throw new Error(`Quran text load nahi hui (HTTP ${response.status})`);
  }
  const raw = await response.text();
  const bySurah = new Map();

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = ROW.exec(line);
    if (!match) continue;
    const surah = Number(match[1]);
    const aya = Number(match[2]);
    const text = match[3];
    let ayahs = bySurah.get(surah);
    if (!ayahs) {
      ayahs = [];
      bySurah.set(surah, ayahs);
    }
    ayahs[aya - 1] = text;
  }

  // Strict integrity check: the Quran is never shown altered or incomplete.
  // If anything does not add up, refuse to load instead of displaying a guess.
  if (bySurah.size !== TOTAL_SURAHS) {
    throw new Error(
      `Quran text adhoora hai: ${bySurah.size} surah mili, ${TOTAL_SURAHS} chahiye thi.`
    );
  }
  let total = 0;
  for (let surah = 1; surah <= TOTAL_SURAHS; surah += 1) {
    const ayahs = bySurah.get(surah);
    if (!Array.isArray(ayahs) || !ayahs.length) {
      throw new Error(`Quran text me surah ${surah} ghaib hai.`);
    }
    for (let i = 0; i < ayahs.length; i += 1) {
      if (typeof ayahs[i] !== 'string' || !ayahs[i].trim()) {
        throw new Error(`Quran text adhoora: surah ${surah}, aya ${i + 1}.`);
      }
      total += 1;
    }
  }
  if (total !== TOTAL_AYAS) {
    throw new Error(`Quran text me ${total} ayaat hain, ${TOTAL_AYAS} honi chahiye thi.`);
  }
  if (bySurah.get(1).length !== 7 || bySurah.get(2).length !== 286 || bySurah.get(114).length !== 6) {
    throw new Error('Quran text ki surah-wise ginti durust nahi (1:7, 2:286, 114:6 honi chahiye).');
  }

  store = { bySurah };
  return store;
}

export function isLoaded() {
  return store !== null;
}

export function ayaCount(surah) {
  if (!store) return 0;
  const ayahs = store.bySurah.get(surah);
  return ayahs ? ayahs.filter(Boolean).length : 0;
}

export function getAyaText(surah, aya) {
  if (!store) return null;
  const ayahs = store.bySurah.get(surah);
  if (!ayahs) return null;
  return ayahs[aya - 1] || null;
}

/**
 * Ayaat of a range, each split into display words plus the "optional" flags
 * used by the alignment (a basmala at the start of a surah may be skipped
 * without it counting as a mistake — although reciting it is better).
 *
 * @returns {Array<{surah:number, aya:number, text:string, words:string[],
 *   optional:boolean[], hasBasmala:boolean}>}
 */
export function getVerses(surah, from, to) {
  const verses = [];
  for (let aya = from; aya <= to; aya += 1) {
    const text = getAyaText(surah, aya);
    if (!text) continue;
    const words = text.split(/\s+/).filter(Boolean);
    const optional = words.map(() => false);
    let hasBasmala = false;

    if (surah !== 1 && surah !== 9 && aya === 1 && words.length >= 4) {
      const head = words.slice(0, 4).map((word) => normalizeArabic(word));
      if (head.every((word, index) => word === BASMALA_WORDS[index])) {
        for (let i = 0; i < 4; i += 1) optional[i] = true;
        hasBasmala = true;
      }
    }

    verses.push({ surah, aya, text, words, optional, hasBasmala });
  }
  return verses;
}
