// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
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
  [/\u0621/g, ''], // ء — hamza on its own is often simply omitted: ءامنا / آمنا / امنا
  [/\u06A9/g, '\u0643'], // Persian kaf
  [/[\u06BE\u06C1\u06D5]/g, HEH], // heh variants
];

// Uthmani rasm writes a long ā with a waw in a handful of words (الصَّلَوٰةُ,
// الزَّكَوٰةُ, الحَيَوٰةُ, المِشْكَوٰةُ) where a modern reader and every speech
// recogniser writes an alef. Both sides are pulled to the alef form here, after
// the letters above have already turned ة into ه.
const RASM_FIXES = [
  ['صلوه', 'صلاه'],
  ['زكوه', 'زكاه'],
  ['حيوه', 'حياه'],
  ['مشكوه', 'مشكاه'],
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
  for (const [from, to] of RASM_FIXES) s = s.split(from).join(to);
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

// Letters a reciter (and a recogniser) routinely swap because they share a
// sound or a makhraj. Mapping them to one form lets "close" catch a real
// near-miss instead of calling it wrong.
const PHONETIC_MAP = [
  [/[\u0635\u0633]/g, '\u0633'], // ص س
  [/[\u0637\u062A]/g, '\u062A'], // ط ت
  [/[\u0630\u0632\u0638]/g, '\u0632'], // ذ ز ظ
  [/[\u062B\u0633]/g, '\u0633'], // ث س
  [/[\u062D\u0647]/g, '\u0647'], // ح ه
  [/[\u0642\u0643]/g, '\u0643'], // ق ك
];

/** A sound-alike form of a bare word (one letter for one letter). */
export function phoneticForm(word) {
  let s = word;
  for (const [re, to] of PHONETIC_MAP) s = s.replace(re, to);
  return s;
}

// A conjunction or preposition written as one letter is often merged or dropped
// by the recogniser ("wa" + word, "bi" + word), so the same word may come back
// without its first letter.
function stripPrefix(word) {
  if (word.length >= 4 && /^[\u0648\u0641\u0628\u0644\u0643]/.test(word)) return word.slice(1);
  return word;
}

/**
 * Distance used for judging "close enough": the best of the plain edit
 * distance and the distance with the definite article removed on both sides.
 * A distance of 0 here means the same word, so it must stay strict — the
 * sound-alike comparison below is only used to soften "wrong" into "close".
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

/**
 * How different two words sound — sound-alike letters and a dropped one-letter
 * prefix count for less here. Only ever used to decide "close", never to turn
 * a word into "correct": a mispronounced letter must still be visible.
 */
export function phoneticDistance(a, b) {
  if (a === b) return 0;
  const pa = phoneticForm(stripArticle(a));
  const pb = phoneticForm(stripArticle(b));
  let best = levenshtein(pa, pb);
  const preA = stripPrefix(pa);
  const preB = stripPrefix(pb);
  if (preA !== pa || preB !== pb) {
    const alt = levenshtein(preA, preB);
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
