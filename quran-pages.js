// Mushaf page data (Tanzil quran-data metadata, CC-BY).
// Every <page> entry is the first aya on that page; the next entry ends it.
// Used by the "Page" tab: pick a mushaf page (1..604) and get its ayaat.

import { ayaCount } from './quran.js';

let pages = null;
let index = new Map();

export async function loadPages(url = 'quran-pages.xml') {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Page data load nahi hui (HTTP ${response.status})`);
  const text = await response.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const list = [];
  doc.querySelectorAll('pages > page').forEach((element) => {
    const page = Number(element.getAttribute('index'));
    const surah = Number(element.getAttribute('sura'));
    const aya = Number(element.getAttribute('aya'));
    if (page && surah && aya) list.push({ page, surah, aya });
  });
  list.sort((a, b) => a.page - b.page);
  pages = list;
  index = new Map(list.map((entry, i) => [entry.page, { ...entry, i }]));
  return list;
}

export function pageTotal() {
  return pages ? pages.length : 0;
}

export function isPagesLoaded() {
  return pages !== null;
}

/** Ayaat of one mushaf page, as [{surah, aya}]. */
export function pageAyahs(page) {
  const entry = index.get(Number(page));
  if (!entry) return [];
  const after = pages[entry.i + 1];
  const out = [];
  let surah = entry.surah;
  let aya = entry.aya;

  for (let guard = 0; guard < 400; guard += 1) {
    if (after && (surah > after.surah || (surah === after.surah && aya >= after.aya))) break;
    out.push({ surah, aya });
    const total = Math.max(1, ayaCount(surah));
    if (aya >= total) {
      surah += 1;
      aya = 1;
      if (surah > 114) break;
    } else {
      aya += 1;
    }
  }
  return out;
}
