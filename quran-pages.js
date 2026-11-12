// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Mushaf page data (Tanzil quran-data metadata, CC-BY).
// Every <page> entry is the first aya on that page; the next entry ends it.
// Used by the "Page" tab: pick a mushaf page (1..604) and get its ayaat.

import { ayaCount } from './quran.js';

let pages = null;
let index = new Map();
let juzs = [];

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

  const juzList = [];
  doc.querySelectorAll('juzs > juz').forEach((element) => {
    const juz = Number(element.getAttribute('index'));
    const surah = Number(element.getAttribute('sura'));
    const aya = Number(element.getAttribute('aya'));
    if (juz && surah && aya) juzList.push({ juz, surah, aya });
  });
  juzs = juzList.sort((a, b) => a.juz - b.juz);

  return list;
}

export function juzTotal() {
  return juzs.length;
}

/** Ayaat of one juz (1..30), as [{surah, aya}]. */
export function juzAyahs(juzNumber) {
  const i = juzs.findIndex((entry) => entry.juz === Number(juzNumber));
  if (i < 0) return [];
  const start = juzs[i];
  const after = juzs[i + 1];
  const out = [];
  let surah = start.surah;
  let aya = start.aya;
  for (let guard = 0; guard < 7000; guard += 1) {
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

/** The juz (1..30) an aya belongs to. */
export function juzOfAya(surah, aya) {
  let found = 0;
  for (const entry of juzs) {
    if (entry.surah < surah || (entry.surah === surah && entry.aya <= aya)) found = entry.juz;
    else break;
  }
  return found;
}
