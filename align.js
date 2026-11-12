// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Word level alignment between the Uthmani words of the selected ayaat and the
// words we actually heard. This is the part of the pipeline that decides
// "sahi pada / ghalat / chhoot gaya".
//
// It is a plain Needleman-Wunsch style dynamic programme: we may match a heard
// word to an expected word, skip an expected word (reciter left it out) or skip
// a heard word (reciter added something). Costs are tuned so that a near-miss
// (one letter off, e.g. ص/س confusion) is reported as "close" rather than
// "wrong", which is what a learner needs to see.

import { compareDistance, normalizeArabic } from './normalize.js';

export const WORD_STATUS = {
  CORRECT: 'correct',
  CLOSE: 'close',
  // Heard something, but not confidently the right word. It is shown as
  // "pakka nahi" — never as a red mistake. A wrong tick is what breaks trust.
  UNSURE: 'unsure',
  WRONG: 'wrong',
  MISSING: 'missing',
};

const CONFUSABLE_GROUPS = ['صسش', 'تط', 'ذزظ', 'حه', 'قك', 'بف', 'ثسص', 'ءأإآ'];

/** Reduce letters the recogniser swaps around to one symbol, for comparison only. */
function collapseConfusables(word) {
  let out = '';
  for (const char of String(word || '')) {
    const group = CONFUSABLE_GROUPS.find((set) => set.includes(char));
    out += group ? group[0] : char;
  }
  return out;
}

const COST = {
  correct: 0,
  close: 0.45,
  wrong: 1,
  missing: 1.15,
  optionalMissing: 0.02,
  extra: 0.9,
};

// A heard word counts as "close" when it is at most this many edits away and
// still reasonably similar overall.
const CLOSE_MIN_SIMILARITY = 0.72;
const CLOSE_MAX_EDITS = 2;

/**
 * @param {Array<string|{word: string, optional?: boolean}>} expectedWords
 *        Expected words in order; `optional` marks words whose absence is not
 *        an error (the basmala before an aya, for example).
 * @param {Array<string>} heardWords
 * @returns {{
 *   results: Array<{index:number, expected:string, expectedNormalized:string,
 *     heard:string|null, status:string, distance:number|null, similarity:number|null}>,
 *   extras: Array<{heard:string, afterIndex:number}>,
 *   counts: {correct:number, close:number, wrong:number, missing:number, extra:number},
 *   score: number,
 *   verdict: string
 * }}
 */
export function alignWords(expectedWords, heardWords) {
  const expected = expectedWords.map((item) =>
    typeof item === 'string'
      ? { word: item, optional: false }
      : { word: item.word, optional: Boolean(item.optional) }
  );
  const heard = (heardWords || []).map((w) => String(w));

  const n = expected.length;
  const m = heard.length;
  const width = m + 1;

  const expectedNorm = expected.map((item) => normalizeArabic(item.word));
  // Uthmani script writes some long alefs only as a small dagger mark (ٰ), e.g.
  // الصراط / هذا / الرحمن. A recogniser may or may not spell that alef out, so
  // such a word also gets a second form with the alef written, and the better
  // of the two is used.
  const expectedAlt = expected.map((item) =>
    item.word.includes('\u0670') ? normalizeArabic(item.word.replace(/\u0670/g, '\u0627')) : null
  );
  const distanceOf = (i, b) => {
    const plain = compareDistance(expectedNorm[i], b);
    if (plain === 0 || expectedAlt[i] === null) return plain;
    return Math.min(plain, compareDistance(expectedAlt[i], b));
  };
  const heardNorm = heard.map((word) => normalizeArabic(word));

  // dp[i][j]: cheapest way to consume the first i expected and j heard words.
  const dp = new Float64Array((n + 1) * (m + 1));
  const back = new Uint8Array((n + 1) * (m + 1)); // 0 diag, 1 up (missing), 2 left (extra)
  // What a diagonal move decided, kept for the traceback.
  const diagStatus = new Uint8Array(n * m); // 0 correct, 1 close, 2 wrong
  const diagDistance = new Int32Array(n * m);

  for (let j = 1; j <= m; j += 1) {
    dp[j] = dp[j - 1] + COST.extra;
    back[j] = 2;
  }
  for (let i = 1; i <= n; i += 1) {
    const skip = expected[i - 1].optional ? COST.optionalMissing : COST.missing;
    dp[i * width] = dp[(i - 1) * width] + skip;
    back[i * width] = 1;
  }

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const a = expectedNorm[i - 1];
      const b = heardNorm[j - 1];
      const distance = distanceOf(i - 1, b);
      const longest = Math.max(a.length, b.length) || 1;
      const sim = 1 - distance / longest;

      let status = 2; // wrong
      let cost = COST.wrong;
      if (distance === 0) {
        status = 0;
        cost = COST.correct;
      } else if (sim >= CLOSE_MIN_SIMILARITY && distance <= CLOSE_MAX_EDITS) {
        status = 1;
        cost = COST.close;
      }

      const diagonal = dp[(i - 1) * width + (j - 1)] + cost;
      const skipExpected =
        dp[(i - 1) * width + j] + (expected[i - 1].optional ? COST.optionalMissing : COST.missing);
      const skipHeard = dp[i * width + (j - 1)] + COST.extra;

      const cell = i * width + j;
      if (diagonal <= skipExpected && diagonal <= skipHeard) {
        dp[cell] = diagonal;
        back[cell] = 0;
        diagStatus[(i - 1) * m + (j - 1)] = status;
        diagDistance[(i - 1) * m + (j - 1)] = distance;
      } else if (skipExpected <= skipHeard) {
        dp[cell] = skipExpected;
        back[cell] = 1;
      } else {
        dp[cell] = skipHeard;
        back[cell] = 2;
      }
    }
  }

  const matched = new Array(n).fill(null); // heard index per expected word
  const extras = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const cell = i * width + j;
    const move = back[cell];
    if (i > 0 && j > 0 && move === 0) {
      matched[i - 1] = j - 1;
      i -= 1;
      j -= 1;
    } else if (i > 0 && (j === 0 || move === 1)) {
      i -= 1;
    } else {
      extras.push({ heard: heard[j - 1], afterIndex: i - 1 });
      j -= 1;
    }
  }
  extras.reverse();

  const results = expected.map((item, index) => {
    const heardIndex = matched[index];
    if (heardIndex === null) {
      return {
        index,
        expected: item.word,
        expectedNormalized: expectedNorm[index],
        heard: null,
        heardIndex: null,
        status: item.optional ? WORD_STATUS.CORRECT : WORD_STATUS.MISSING,
        distance: null,
        similarity: null,
        optional: item.optional,
      };
    }
    const statusCode = diagStatus[index * m + heardIndex];
    const distance = diagDistance[index * m + heardIndex];
    const a = expectedNorm[index];
    const b = heardNorm[heardIndex];
    const longest = Math.max(a.length, b.length) || 1;
    // A wrong word must look wrong: judge by similarity after the phonetic
    // folding, not by a single edit the recogniser might have mis-heard.
    const sim = a === b ? 1 : 1 - compareDistance(a, b) / longest;
    return {
      index,
      expected: item.word,
      expectedNormalized: a,
      heard: heard[heardIndex],
      heardIndex,
      status:
        sim >= 0.85
          ? WORD_STATUS.CORRECT
          : sim >= 0.55
            ? WORD_STATUS.CLOSE
            : sim >= 0.3
              ? WORD_STATUS.UNSURE
              : WORD_STATUS.WRONG,
      distance,
      similarity: sim,
      optional: item.optional,
    };
  });

  // Every heard word with the status it earned, in the order it was said, so the
  // UI can show the reciter's own words ("Aap ki tilawat"), extras included.
  const heardStatus = new Array(m).fill('extra');
  for (const result of results) {
    if (result.heardIndex !== null) heardStatus[result.heardIndex] = result.status;
  }

  const counts = { correct: 0, close: 0, unsure: 0, wrong: 0, missing: 0, extra: extras.length };
  let gained = 0;
  let counted = 0;
  for (const result of results) {
    // A skipped optional word (basmala) is neither a mistake nor a point earned.
    if (result.optional && result.heard === null) continue;
    counted += 1;
    counts[result.status] += 1;
    if (result.status === WORD_STATUS.CORRECT) gained += 1;
    else if (result.status === WORD_STATUS.CLOSE) gained += 0.6;
    // An unsure word neither earns a point nor loses one.
    else if (result.status === WORD_STATUS.WRONG) gained += 0.15;
  }

  let score = counted ? (gained / counted) * 100 : 0;
  score -= Math.min(15, extras.length * 2);
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    results,
    extras,
    heard,
    heardStatus,
    counts,
    score,
    verdict: verdictFor(score, counts),
  };
}

function verdictFor(score, counts) {
  const total = counts.correct + counts.close + counts.unsure + counts.wrong + counts.missing;
  if (total === 0) return 'Kuch suna nahi gaya';
  if (counts.missing === 0 && counts.wrong === 0 && counts.extra === 0) {
    if (counts.unsure > 0 && counts.correct + counts.close <= counts.unsure) return 'Kuch lafz pakke nahi';
    return score === 100 ? 'Bilkul sahi' : 'Sahi (thori bariqi)';
  }
  if (score >= 85) return 'Achha — chhoti ghaltiyan';
  if (score >= 65) return 'Theek — kuch alfaaz durust karein';
  if (score >= 40) return 'Dobara koshish karein';
  return 'Is aya ko phir se seekhein';
}

/**
 * Debug helper used by the self test: align and flatten to a compact string
 * like "C C M W" so expectations are readable.
 */
export function statusLine(alignment) {
  const letters = {
    [WORD_STATUS.CORRECT]: 'C',
    [WORD_STATUS.CLOSE]: 'K',
    [WORD_STATUS.UNSURE]: 'U',
    [WORD_STATUS.WRONG]: 'W',
    [WORD_STATUS.MISSING]: 'M',
  };
  return alignment.results.map((r) => letters[r.status]).join(' ');
}
