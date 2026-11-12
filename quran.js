// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Loads and parses the Uthmani Quran text (Tanzil "txt-2" format:
// every line is  surah|aya|text  and comment lines start with '#').

import { normalizeArabic } from './normalize.js';

const ROW = /^(\d+)\|(\d+)\|(.+)$/;

// Normalised words of "بسم الله الرحمن الرحيم", used to recognise a basmala
// that Tanzil puts at the head of the first aya of a surah.
const BASMALA_WORDS = ['بسم', 'الله', 'الرحمن', 'الرحيم'];

/** IndoPak script basmala (Quran.com Indopak 15 lines, aya 1:1). */
export const INDOPAK_BASMALA = 'بِسۡمِ اللهِ الرَّحۡمٰنِ الرَّحِيۡمِ';

/**
 * Split a surah's basmala away from aya 1.
 *
 * Tanzil keeps it inside aya 1; the IndoPak pages from Quran.com do not, so a
 * `fallback` can be passed for them. al-Fatihah keeps the basmala as its aya 1
 * and at-Tawbah has none.
 */
export function splitBasmala(surah, aya, text, fallback = null) {
  const allWords = text.split(/\s+/).filter(Boolean);
  if (surah !== 1 && surah !== 9 && aya === 1) {
    if (allWords.length > 4) {
      const head = allWords.slice(0, 4);
      if (head.map((word) => normalizeArabic(word)).every((word, i) => word === BASMALA_WORDS[i])) {
        const words = allWords.slice(4);
        return { basmala: head.join(' '), prefixWords: head, words, ayaText: words.join(' ') };
      }
    }
    if (fallback) {
      return {
        basmala: fallback,
        prefixWords: fallback.split(/\s+/).filter(Boolean),
        words: allWords,
        ayaText: text,
      };
    }
  }
  return { basmala: null, prefixWords: [], words: allWords, ayaText: text };
}

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
 * Ayaat of a range. The basmala that Tanzil keeps inside the first aya of a
 * surah (except al-Fatihah and at-Tawbah) is split out: `basmala` holds it,
 * `ayaText` is the aya itself, and `prefixWords` are its words as optional
 * alignment input (reciting it is fine, skipping it is not a mistake).
 *
 * `text` always stays the exact Tanzil string.
 *
 * @returns {Array<{surah:number, aya:number, text:string, ayaText:string,
 *   basmala:string|null, words:string[], prefixWords:string[],
 *   optional:boolean[], hasBasmala:boolean}>}
 */
export function getVerses(surah, from, to) {
  const verses = [];
  for (let aya = from; aya <= to; aya += 1) {
    const text = getAyaText(surah, aya);
    if (!text) continue;

    const split = splitBasmala(surah, aya, text);
    const { basmala, prefixWords, words, ayaText } = split;

    verses.push({
      surah,
      aya,
      text,
      ayaText,
      basmala,
      words,
      prefixWords,
      optional: words.map(() => false),
      hasBasmala: Boolean(basmala),
    });
  }
  return verses;
}
