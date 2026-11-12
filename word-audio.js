// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Word-level qari audio.
//
// Word timestamps come from quran-align (Collin Fair), CC BY 4.0; the recording
// is the EveryAyah Alafasy file. `qari-timings.json` is produced once by the
// "Qari word timings" workflow from the published archive. The word is played by
// seeking into that aya's mp3 and stopping at the segment's end.
//
// If the file or a segment is missing, nothing breaks: the caller simply falls
// back to playing the whole aya.

const TIMINGS_URL = 'qari-timings.json';
const AUDIO_BASE = 'https://everyayah.com/data/Alafasy_128kbps/';

let timings = null;
let loading = null;

const pad = (n) => String(n).padStart(3, '0');

async function load() {
  if (timings) return timings;
  if (loading) return loading;

  loading = (async () => {
    try {
      const response = await fetch(TIMINGS_URL, { cache: 'force-cache' });
      if (!response.ok) return null;
      const rows = await response.json();
      if (!Array.isArray(rows) || !rows.length) return null;
      const map = new Map();
      for (const row of rows) {
        if (!row || !row.surah || !row.ayah || !Array.isArray(row.segments)) continue;
        map.set(`${row.surah}:${row.ayah}`, row.segments);
      }
      timings = map;
      return timings;
    } catch (error) {
      return null;
    } finally {
      loading = null;
    }
  })();

  return loading;
}

/** True when this aya has word timings (the UI can show the per-word button). */
export async function hasWordTimings(surah, aya) {
  const map = await load();
  return Boolean(map && map.has(`${surah}:${aya}`));
}

let audio = null;

export function stopWord() {
  if (audio) {
    try {
      audio.pause();
    } catch (error) {
      /* already gone */
    }
    audio = null;
  }
}

/**
 * Play only one word of the aya. `wordIndex` is the 0-based index in the aya's
 * Tanzil text (basmala included), which is what quran-align numbers.
 * @returns {Promise<boolean>} false when there is no timing for that word
 */
export async function playWord(surah, aya, wordIndex) {
  const map = await load();
  if (!map) return false;

  const segments = map.get(`${surah}:${aya}`);
  if (!segments) return false;

  const segment = segments.find(
    (seg) => Array.isArray(seg) && seg[0] <= wordIndex && wordIndex < seg[1]
  );
  if (!segment) return false;

  const start = Number(segment[2]) / 1000;
  const end = Number(segment[3]) / 1000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;

  stopWord();

  const el = new Audio(`${AUDIO_BASE}${pad(surah)}${pad(aya)}.mp3`);
  audio = el;
  el.preload = 'auto';

  const stopAt = () => {
    if (el.currentTime >= end) {
      el.pause();
      if (audio === el) audio = null;
    }
  };

  el.addEventListener('timeupdate', stopAt);
  el.addEventListener('ended', () => {
    if (audio === el) audio = null;
  });

  try {
    await new Promise((resolve, reject) => {
      el.addEventListener('loadedmetadata', resolve, { once: true });
      el.addEventListener('error', reject, { once: true });
      el.load();
    });
    el.currentTime = start;
    await el.play();
    return true;
  } catch (error) {
    if (audio === el) audio = null;
    return false;
  }
}
