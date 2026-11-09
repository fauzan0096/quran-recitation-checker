// © 2026 fauzan0096 — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Arabic normalisation and fuzzy distance.
//
// The Uthmani script carries harakat, madd signs, small high letters and
// waqf marks. What we hear from a reciter (or back from a speech recogniser)
// never has those, so before any comparison we reduce both sides to bare
// consonantal Arabic. Everything here is pure and synchronous so it can be
// reused on device (browser, React Native, Kotlin/Swift port) without changes.

// Harakat, Quranic annotation marks, superscript alef, small high letters.
const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]/g;
// Bidi controls, zero-width joiners, BOM.
const INVISIBLES = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

const ALEF = '\u0627';
const YEH = '\u064A';
const WAW = '\u0648';
const HEH = '\u0647';

// Letter forms that are the same sound and must compare equal.
const LETTER_MAP = [
  [/[\u0622\u0623\u0625\u0671-\u0673\u0675]/g, ALEF], // آ أ إ ٱ ٲ ٳ ٵ
  [/\u0649/g, YEH], // ى
  [/\u06CC/g, YEH], // Persian yeh
  [/\u0624/g, WAW], // ؤ
  [/\u0626/g, YEH], // ئ
  [/\u0629/g, HEH], // ة
  [/\u06A9/g, '\u0643'], // Persian kaf
  [/[\u06BE\u06C1\u06D5]/g, HEH], // heh variants
];

/**
 * Reduce Arabic text to bare letters: no harakat, no Quranic marks, no
 * tatweel, no punctuation, alef/hamza and ta-marbuta forms unified.
 */
export function normalizeArabic(input) {
  if (!input) return '';
  let s = String(input);
  s = s.replace(INVISIBLES, ' ');
  s = s.replace(/\u00A0/g, ' ');
  s = s.replace(/\u0640/g, ''); // tatweel
  s = s.replace(MARKS, '');
  for (const [re, to] of LETTER_MAP) s = s.replace(re, to);
  // Drop everything that is not an Arabic letter or a space (punctuation,
  // digits, Latin, aya markers...).
  s = s.replace(/[^\u0621-\u063A\u0641-\u064A\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** Normalise a sentence into an array of comparable words. */
export function normalizeToWords(input) {
  const normalised = normalizeArabic(input);
  return normalised ? normalised.split(' ') : [];
}

/** Levenshtein edit distance over code units. */
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j += 1) {
      const sub = prev[j - 1] + (ca === b.charCodeAt(j - 1) ? 0 : 1);
      const del = prev[j] + 1;
      const ins = cur[j - 1] + 1;
      cur[j] = sub < del ? (sub < ins ? sub : ins) : del < ins ? del : ins;
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  return prev[b.length];
}

function stripArticle(word) {
  // "ال" is often elided or added by ear/recognisers; compare without it too.
  if (word.length > 3 && word.startsWith(ALEF + '\u0644')) return word.slice(2);
  return word;
}

/**
 * Distance used for judging "close enough": the best of the plain edit
 * distance and the distance with the definite article removed on both sides.
 */
export function compareDistance(a, b) {
  if (a === b) return 0;
  let best = levenshtein(a, b);
  const a2 = stripArticle(a);
  const b2 = stripArticle(b);
  if (a2 !== a || b2 !== b) {
    const alt = levenshtein(a2, b2);
    if (alt < best) best = alt;
  }
  return best;
}

/** 0..1 similarity derived from compareDistance. */
export function similarity(a, b) {
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  if (!longest) return 1;
  return 1 - compareDistance(a, b) / longest;
}
