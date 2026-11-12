// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// IndoPak mushaf text (Quran.com "Indopak 15 lines", 610 pages) fetched page by
// page and cached in memory + localStorage. The Madani mushaf stays fully
// offline with the bundled Uthmani text; IndoPak pages need the page itself
// once, then they are served from the cache.

const API = 'https://api.quran.com/api/v4/quran/verses/indopak';
export const INDOPAK_PAGES = 610;

const cache = new Map();
const LS_KEY = 'tc.indopak.';

function readCache(page) {
  if (cache.has(page)) return cache.get(page);
  try {
    const raw = localStorage.getItem(LS_KEY + page);
    if (raw) {
      const parsed = JSON.parse(raw);
      cache.set(page, parsed);
      return parsed;
    }
  } catch (error) {
    console.warn('indopak cache read failed', error);
  }
  return null;
}

function writeCache(page, verses) {
  cache.set(page, verses);
  try {
    localStorage.setItem(LS_KEY + page, JSON.stringify(verses));
  } catch (error) {
    // Quota is not fatal: the page still works for this session.
    console.warn('indopak cache write failed', error);
  }
}

/**
 * @returns {Promise<Array<{surah:number, aya:number, text:string}>>}
 */
export async function indopakPage(page) {
  const cached = readCache(page);
  if (cached) return cached;

  const response = await fetch(`${API}?page_number=${page}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`IndoPak text load nahi hui (HTTP ${response.status})`);
  const data = await response.json();
  const verses = (data.verses || []).map((verse) => {
    const [surah, aya] = String(verse.verse_key).split(':').map(Number);
    return { surah, aya, text: String(verse.text_indopak || '') };
  });
  if (!verses.length) throw new Error('Is IndoPak page ka text nahi mila.');
  writeCache(page, verses);
  return verses;
}

// ---------------------------------------------------------------- 15 lines

const LINES_API = 'https://api.quran.com/api/v4/verses/by_page';
const LINES_KEY = 'tc.indopakLens.';
const linesCache = new Map();

/**
 * Words per printed line of one IndoPak page (top to bottom), from the
 * `line_number` of every word on Quran.com's 15-line IndoPak mus'haf (id 6).
 * Returns null when it cannot be had (offline, or the answer has no line
 * numbers): the page then simply stays flowing text, never wrong text.
 */
export async function indopakPageLines(page) {
  if (linesCache.has(page)) return linesCache.get(page);
  try {
    const raw = localStorage.getItem(LINES_KEY + page);
    if (raw) {
      const parsed = JSON.parse(raw);
      linesCache.set(page, parsed);
      return parsed;
    }
  } catch (error) {
    console.warn('indopak lines cache read failed', error);
  }
  try {
    const url = `${LINES_API}/${page}?mushaf=6&words=true&word_fields=line_number&per_page=50`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    const lens = linesFromApi(await response.json());
    if (!lens) return null;
    linesCache.set(page, lens);
    try {
      localStorage.setItem(LINES_KEY + page, JSON.stringify(lens));
    } catch (error) {
      console.warn('indopak lines cache write failed', error);
    }
    return lens;
  } catch (error) {
    return null;
  }
}

/** Pure: Quran.com `by_page` answer -> words per line, or null if unusable. */
export function linesFromApi(data) {
  const counts = new Map();
  let total = 0;
  for (const verse of (data && data.verses) || []) {
    for (const word of verse.words || []) {
      if (word.char_type_name && word.char_type_name !== 'word') continue; // aya-end marker
      const line = Number(word.line_number);
      if (!Number.isInteger(line) || line < 1) return null;
      counts.set(line, (counts.get(line) || 0) + 1);
      total += 1;
    }
  }
  if (!total) return null;
  return Array.from(counts.keys())
    .sort((a, b) => a - b)
    .map((line) => counts.get(line));
}
