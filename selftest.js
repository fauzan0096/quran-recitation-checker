// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Small assertions that prove the offline engine behaves. Run from the UI so a
// non-developer can see that normalisation, alignment and the tajweed scanner
// are working, without needing a microphone or a model.

import { normalizeToWords, compareDistance } from './normalize.js';
import { alignWords, WORD_STATUS } from './align.js';
import { tajweedHints } from './tajweed.js';
import { splitBasmala, INDOPAK_BASMALA } from './quran.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, mila ${JSON.stringify(actual)}`);
  }
}

/**
 * @param {{quran?: {ayaCount: Function, getVerses: Function}}} context
 * @returns {Array<{name: string, pass: boolean, detail: string}>}
 */
export function runSelfTest(context = {}) {
  const results = [];
  const check = (name, fn) => {
    try {
      const detail = fn();
      results.push({ name, pass: true, detail: detail || 'ok' });
    } catch (error) {
      results.push({
        name,
        pass: false,
        detail: error && error.message ? error.message : String(error),
      });
    }
  };

  check('Basmala normalise hoti hai', () => {
    const words = normalizeToWords('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ');
    assertEqual(words.join(' '), 'بسم الله الرحمن الرحيم', 'words');
    return words.join(' ');
  });

  check('Harakat aur wasla hatt jate hain', () => {
    const words = normalizeToWords('ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ');
    assertEqual(words.join(' '), 'الصرط المستقيم', 'words');
    return words.join(' ');
  });

  check('Chhoti alif (ٰ) wale lafz ASR ki dono spelling par sahi', () => {
    for (const heard of ['الصراط', 'الصرط']) {
      const alignment = alignWords(['ٱلصِّرَٰطَ'], [heard]);
      assertEqual(alignment.results[0].status, WORD_STATUS.CORRECT, `status for ${heard}`);
    }
    const rahman = alignWords(['ٱلرَّحْمَـٰنِ'], ['الرحمن']);
    assertEqual(rahman.results[0].status, WORD_STATUS.CORRECT, 'الرحمن');
    return 'الصراط / الصرط / الرحمن = sahi';
  });

  check('Basmala chhorne par score faraham nahi hota', () => {
    const alignment = alignWords(
      [
        { word: 'بسم', optional: true },
        { word: 'الله', optional: true },
        { word: 'الحمد' },
        { word: 'لله' },
      ],
      []
    );
    assertEqual(alignment.score, 0, 'score');
    assertEqual(alignment.counts.correct, 0, 'correct');
    return `score ${alignment.score}`;
  });

  check('دنيا me noon ke baad ya = izhar (idgham nahi)', () => {
    const hints = tajweedHints('ٱلدُّنْيَا');
    assert(!hints.some((hint) => hint.rule === 'Idgham'), 'galat Idgham hint');
    assert(hints.some((hint) => hint.rule === 'Izhar'), 'Izhar hint nahi mila');
    return hints.map((hint) => hint.rule).join(', ');
  });

  check('ص / س ka farq ek edit hai', () => {
    const distance = compareDistance('الصراط', 'السراط');
    assertEqual(distance, 1, 'distance');
    return 'distance = 1 (close)';
  });

  check('"ال" ke baghair bhi muqabla hota hai', () => {
    const distance = compareDistance('الصراط', 'صراط');
    assertEqual(distance, 0, 'distance');
    return 'distance = 0';
  });

  check('Sune mein milte harf (ص/س) "close" hote hain, "sahi" nahi', () => {
    const alignment = alignWords(['السراط'], ['الصراط']);
    assertEqual(alignment.results[0].status, WORD_STATUS.CLOSE, 'status');
    return `status ${alignment.results[0].status}`;
  });

  check('Hamza ki kami-beshi chalti hai (ءامنا / آمنا / امنا)', () => {
    for (const heard of ['ءامنا', 'آمنا', 'امنا']) {
      const alignment = alignWords(['ءَامَنَّا'], [heard]);
      assertEqual(alignment.results[0].status, WORD_STATUS.CORRECT, `status for ${heard}`);
    }
    const shay = alignWords(['شَيْءٍ'], ['شي']);
    assertEqual(shay.results[0].status, WORD_STATUS.CORRECT, 'شيء / شي');
    return 'ءامنا / آمنا / امنا / شيء = sahi';
  });

  check('Do hamze wale lafz (ءأنذرتهم = أأنذرتهم)', () => {
    const ank = alignWords(['ءَأَنذَرْتَهُمْ'], ['أأنذرتهم']);
    assertEqual(ank.results[0].status, WORD_STATUS.CORRECT, 'ءأنذرتهم');
    const ula = alignWords(['أُو۟لَٰٓئِكَ'], ['أولئك']);
    assertEqual(ula.results[0].status, WORD_STATUS.CORRECT, 'أولئك');
    const wula = alignWords(['ءُولَٰئِكَ'], ['أولئك']);
    assertEqual(wula.results[0].status, WORD_STATUS.CORRECT, 'ءولئك');
    return 'ءأنذرتهم / أولئك / ءولئك = sahi';
  });

  check('Uthmani rasm aur aam imla barabar (الصلوة = الصلاة)', () => {
    for (const heard of ['الصلاة', 'الصلوة']) {
      const alignment = alignWords(['ٱلصَّلَوٰةَ'], [heard]);
      assertEqual(alignment.results[0].status, WORD_STATUS.CORRECT, `status for ${heard}`);
    }
    for (const heard of ['الزكاة', 'الزكوة']) {
      const alignment = alignWords(['ٱلزَّكَوٰةَ'], [heard]);
      assertEqual(alignment.results[0].status, WORD_STATUS.CORRECT, `status for ${heard}`);
    }
    return 'الصلوة / الصلاة / الزكوة / الزكاة = sahi';
  });

  check('Bilkul durust tilawat = 100', () => {
    const expected = ['الحمد', 'لله', 'رب', 'العالمين'];
    const alignment = alignWords(expected, expected);
    assertEqual(alignment.score, 100, 'score');
    assertEqual(alignment.counts.correct, 4, 'correct');
    return `score ${alignment.score}, verdict "${alignment.verdict}"`;
  });

  check('Ek harf ka farq = "close", galat nahi', () => {
    const alignment = alignWords(['الرحمن'], ['الرحمان']);
    assertEqual(alignment.results[0].status, WORD_STATUS.CLOSE, 'status');
    assert(alignment.score > 0 && alignment.score < 100, 'score should be partial');
    return `status ${alignment.results[0].status}, score ${alignment.score}`;
  });

  check('Chhoota hua lafz "missing" banta hai', () => {
    const alignment = alignWords(
      ['الحمد', 'لله', 'رب', 'العالمين'],
      ['الحمد', 'لله', 'العالمين']
    );
    assertEqual(alignment.counts.missing, 1, 'missing');
    assertEqual(alignment.results[2].status, WORD_STATUS.MISSING, 'status of رب');
    assertEqual(alignment.score, 75, 'score');
    return `score ${alignment.score}`;
  });

  check('Zaid lafz alag se report hota hai', () => {
    const alignment = alignWords(
      ['الحمد', 'لله', 'رب', 'العالمين'],
      ['الحمد', 'لله', 'رب', 'العالمين', 'زيادة']
    );
    assertEqual(alignment.extras.length, 1, 'extras');
    assertEqual(alignment.score, 98, 'score');
    return `extras ${alignment.extras.length}, score ${alignment.score}`;
  });

  check('Har sune gaye lafz ka status milta hai', () => {
    const alignment = alignWords(['الحمد', 'لله'], ['الحمد', 'لله', 'زيادة']);
    assertEqual(alignment.heard.length, 3, 'heard');
    assertEqual(alignment.heardStatus.length, 3, 'heardStatus');
    assertEqual(alignment.heardStatus[0], WORD_STATUS.CORRECT, 'pehla lafz');
    assertEqual(alignment.heardStatus[2], 'extra', 'zaid lafz');
    return alignment.heardStatus.join(' ');
  });

  check('Basmala chhorna ghalti nahi (optional)', () => {
    const alignment = alignWords(
      [
        { word: 'بسم', optional: true },
        { word: 'الله', optional: true },
        { word: 'الحمد' },
        { word: 'لله' },
      ],
      ['الحمد', 'لله']
    );
    assertEqual(alignment.counts.missing, 0, 'missing');
    assertEqual(alignment.score, 100, 'score');
    return `score ${alignment.score}`;
  });

  check('Khali audio = koi match nahi', () => {
    const alignment = alignWords(['الحمد', 'لله'], []);
    assertEqual(alignment.counts.missing, 2, 'missing');
    assertEqual(alignment.score, 0, 'score');
    return alignment.verdict;
  });

  check('Ghunnah detect hoti hai', () => {
    const hints = tajweedHints('إِنَّ ٱللَّهَ');
    assert(hints.some((hint) => hint.rule === 'Ghunnah'), 'Ghunnah hint nahi mila');
    return hints.map((hint) => hint.rule).join(', ');
  });

  check('Idgham detect hota hai', () => {
    const hints = tajweedHints('مِنْ يَوْمٍ');
    assert(hints.some((hint) => hint.rule === 'Idgham'), 'Idgham hint nahi mila');
    return hints.map((hint) => hint.rule).join(', ');
  });

  check('Iqlab detect hota hai', () => {
    const hints = tajweedHints('مِنْ بَعْدِ');
    assert(hints.some((hint) => hint.rule === 'Iqlab'), 'Iqlab hint nahi mila');
    return hints.map((hint) => hint.rule).join(', ');
  });

  check('IndoPak me basmala alag line ke liye milti hai', () => {
    const split = splitBasmala(2, 1, 'الٓمٓ', INDOPAK_BASMALA);
    assertEqual(split.basmala, INDOPAK_BASMALA, 'basmala');
    assertEqual(split.ayaText, 'الٓمٓ', 'ayaText');
    assertEqual(split.prefixWords.length, 4, 'prefixWords');
    return split.prefixWords.join(' ');
  });

  check('Al-Fatihah me basmala alag nahi hoti', () => {
    const split = splitBasmala(1, 1, 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', INDOPAK_BASMALA);
    assertEqual(split.basmala, null, 'basmala');
    return split.ayaText.slice(0, 20);
  });

  const quran = context.quran;
  if (quran) {
    check('Quran text poora load hua (6236 ayaat)', () => {
      let total = 0;
      for (let surah = 1; surah <= 114; surah += 1) total += quran.ayaCount(surah);
      assertEqual(total, 6236, 'ayaat ka total');
      return `${total} ayaat`;
    });

    check('Surah ki ayaat ki tadaad durust hai', () => {
      assertEqual(quran.ayaCount(1), 7, 'Al-Fatihah');
      assertEqual(quran.ayaCount(2), 286, 'Al-Baqarah');
      assertEqual(quran.ayaCount(114), 6, 'An-Nas');
      return '7 / 286 / 6';
    });

    check('Surah ki pehli aya me basmala alag hai', () => {
      const verses = quran.getVerses(2, 1, 1);
      assert(verses.length === 1, 'aya nahi mili');
      assertEqual(verses[0].hasBasmala, true, 'hasBasmala');
      assert(verses[0].basmala && verses[0].basmala.length > 0, 'basmala text ghaib');
      assertEqual(verses[0].prefixWords.length, 4, 'prefixWords');
      assert(!verses[0].ayaText.startsWith(verses[0].basmala.split(' ')[0]), 'aya me basmala reh gayi');
      return verses[0].ayaText.slice(0, 40);
    });
  }

  return results;
}
