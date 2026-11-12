// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Text based tajweed hints.
//
// What this can do: read the Uthmani script and point out where a rule
// *applies* — ghunnah on a doubled noon/meem, qalqalah letters, noon sakinah
// and tanween followed by an idgham / iqlab / izhar / ikhfa letter, meem
// sakinah before ب or م, and marked madd.
//
// What this cannot do: measure timing from audio (how many counts a madd was
// held, whether ghunnah was nasal enough). Those need a phoneme level acoustic
// model; here they are shown as "dhyan dein" hints, not as marks against the
// reciter.

const SHADDA = '\u0651';
const SUKOON = '\u0652';
const FATHA = '\u064E';
const DAMMA = '\u064F';
const KASRA = '\u0650';
const FATHAATAN = '\u064B';
const DAMMAATAN = '\u064C';
const KASRAATAN = '\u064D';
const MADDAH = '\u0653';

const MARKS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/;

const NOON = '\u0646';
const MEEM = '\u0645';
const BEH = '\u0628';

const QALQALAH = new Set(['\u0642', '\u0637', '\u0628', '\u062C', '\u062F']); // ق ط ب ج د
const IDGHAM_NOON = new Set(['\u064A', '\u0631', '\u0645', '\u0644', '\u0648', '\u0646']); // ي ر م ل و ن
const IZHAR_THROAT = new Set(['\u0621', '\u0647', '\u0639', '\u062D', '\u063A', '\u062E']); // ء ه ع ح غ خ
const IKHFA = new Set([
  '\u062A', '\u062B', '\u062C', '\u062F', '\u0630', '\u0632', '\u0633', '\u0634',
  '\u0635', '\u0636', '\u0637', '\u0638', '\u0641', '\u0642', '\u0643',
]); // ت ث ج د ذ ز س ش ص ض ط ظ ف ق ك

const SHORT_VOWELS = [FATHA, DAMMA, KASRA];

/**
 * Split aya text into letter tokens: a base letter plus the marks written on
 * it, in reading order, remembering which word it belongs to.
 */
export function tokenize(text) {
  const letters = [];
  let wordIndex = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      wordIndex += 1;
      i += 1;
      continue;
    }
    if (MARKS_RE.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '\u0640') {
      // tatweel is decoration, not a letter
      i += 1;
      continue;
    }
    let marks = '';
    let j = i + 1;
    while (j < text.length && MARKS_RE.test(text[j])) {
      marks += text[j];
      j += 1;
    }
    letters.push({ base: ch, marks, wordIndex, glyph: ch + marks });
    i = j;
  }
  return letters;
}

function hasAnyShortVowel(marks) {
  for (const mark of SHORT_VOWELS) if (marks.includes(mark)) return true;
  return marks.includes(SHADDA);
}

function hasTanween(marks) {
  return marks.includes(FATHAATAN) || marks.includes(DAMMAATAN) || marks.includes(KASRAATAN);
}

function lastIndexOfWord(letters) {
  const last = new Map();
  letters.forEach((letter, index) => last.set(letter.wordIndex, index));
  return last;
}

function firstIndexOfWord(letters) {
  const first = new Map();
  letters.forEach((letter, index) => {
    if (!first.has(letter.wordIndex)) first.set(letter.wordIndex, index);
  });
  return first;
}

/**
 * Collect tajweed hints for one aya.
 * @param {string} text Uthmani text of a single aya.
 * @param {number} maxHints upper bound on how many hints to return.
 * @returns {Array<{rule:string, note:string, wordIndex:number, glyph:string}>}
 */
export function tajweedHints(text, maxHints = 14) {
  if (!text) return [];
  const letters = tokenize(text);
  const lastOfWord = lastIndexOfWord(letters);
  const firstOfWord = firstIndexOfWord(letters);
  const hints = [];
  const seen = new Set();

  const add = (rule, note, letter) => {
    const key = `${rule}:${letter.wordIndex}:${letter.glyph}`;
    if (seen.has(key)) return;
    seen.add(key);
    hints.push({ rule, note, wordIndex: letter.wordIndex, glyph: letter.glyph });
  };

  letters.forEach((letter, index) => {
    // 1. Ghunnah: a doubled noon or meem.
    if ((letter.base === NOON || letter.base === MEEM) && letter.marks.includes(SHADDA)) {
      add('Ghunnah', 'Noon/meem mushaddad: naak se ghunnah, takriban 2 misraak', letter);
    }

    // 2. Qalqalah: ق ط ب ج د with sukoon, or bare at the end of a word (waqf).
    if (QALQALAH.has(letter.base)) {
      const isLastOfWord = lastOfWord.get(letter.wordIndex) === index;
      if (letter.marks.includes(SUKOON) || (isLastOfWord && !hasAnyShortVowel(letter.marks))) {
        add('Qalqalah', 'Qalqalah harf: ruk kar uchhal ke ada karein', letter);
      }
    }

    // 3. Noon sakinah / tanween before the next letter.
    const noonSakinah = letter.base === NOON && letter.marks.includes(SUKOON);
    const tanween = hasTanween(letter.marks);
    if (noonSakinah || tanween) {
      const nextIndex = tanween
        ? firstOfWord.get(letter.wordIndex + 1)
        : index + 1 < letters.length
          ? index + 1
          : undefined;
      const nextLetter = nextIndex === undefined ? null : letters[nextIndex];
      if (nextLetter) {
        const target = nextLetter.base;
        const sameWord = nextLetter.wordIndex === letter.wordIndex;
        if (noonSakinah && sameWord && (target === '\u064A' || target === '\u0648')) {
          // دُنْيَا، صِنْوَانٌ، بُنْيَانٌ، قِنْوَانٌ: idgham needs two words (izhar mutlaq here)
          add('Izhar', 'Isi lafz me noon ke baad ya/waw: idgham nahi, noon saaf parhein', letter);
        } else if (IDGHAM_NOON.has(target)) {
          add('Idgham', 'Noon sakinah/tanween ke baad idgham: noon ko agli harf me mila dein', letter);
        } else if (target === BEH) {
          add('Iqlab', 'Iqlab: noon ki awaaz meem ki tarah, ghunnah ke saath', letter);
        } else if (IZHAR_THROAT.has(target)) {
          add('Izhar', 'Izhar: noon ko saaf, ghunnah ke baghair', letter);
        } else if (IKHFA.has(target)) {
          add('Ikhfa', 'Ikhfa: noon ki awaaz chhupa kar ghunnah', letter);
        }
      }
    }

    // 4. Meem sakinah before meem or beh.
    if (letter.base === MEEM && letter.marks.includes(SUKOON)) {
      const nextLetter = index + 1 < letters.length ? letters[index + 1] : null;
      if (nextLetter && nextLetter.base === MEEM) {
        add('Idgham Shafawi', 'Meem sakinah doosri meem me idgham — ghunnah ke saath', letter);
      } else if (nextLetter && nextLetter.base === BEH) {
        add('Ikhfa Shafawi', 'Meem sakinah beh se pehle ikhfa — ghunnah', letter);
      }
    }

    // 5. Marked madd (the maddah sign in the Uthmani script).
    if (letter.marks.includes(MADDAH)) {
      add('Madd', 'Madd: is harf ko 4-5 misraak tak khenchein', letter);
    }
  });

  return hints.slice(0, maxHints);
}

/** Count hints per rule for a compact summary in the UI. */
export function summariseHints(hints) {
  const summary = new Map();
  for (const hint of hints) {
    const entry = summary.get(hint.rule) || { rule: hint.rule, count: 0 };
    entry.count += 1;
    summary.set(hint.rule, entry);
  }
  return [...summary.values()];
}
