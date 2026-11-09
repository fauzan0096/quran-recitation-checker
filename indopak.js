// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
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
