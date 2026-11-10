// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Qari (reciter) audio — the correct recitation of an aya, played next to the
// words the person got wrong.
//
// The files come from EveryAyah.com, which publishes these recitations free to
// use (no key, no account, plain mp3). Only the reciters whose sets are marked
// free on that site are listed here. Nothing is bundled with the app: the audio
// streams on demand, so the download stays small and the files stay theirs.

const BASE = 'https://everyayah.com/data/';
const KEY = 'tc.qari';

export const RECITERS = {
  alafasy: { dir: 'Alafasy_128kbps', name: 'Mishary Rashid Alafasy' },
  husary: { dir: 'Husary_128kbps', name: 'Mahmoud Khalil Al-Husary' },
  basit: { dir: 'Abdul_Basit_Murattal_128kbps', name: 'Abdul Basit (Murattal)' },
  minshawy: { dir: 'Minshawy_128kbps', name: 'Mohamed Al-Minshawy' },
};

const DEFAULT = 'alafasy';

function read() {
  try {
    const id = localStorage.getItem(KEY);
    return RECITERS[id] ? id : DEFAULT;
  } catch (error) {
    return DEFAULT;
  }
}

export function current() {
  return read();
}

export function setReciter(id) {
  if (!RECITERS[id]) return read();
  try {
    localStorage.setItem(KEY, id);
  } catch (error) {
    /* private mode */
  }
  return id;
}

export function reciters() {
  return Object.entries(RECITERS).map(([id, info]) => ({ id, name: info.name }));
}

const pad = (n) => String(n).padStart(3, '0');

/** The mp3 of one aya (EveryAyah numbers the files by surah + aya). */
export function urlFor(surah, aya) {
  const id = read();
  return `${BASE}${RECITERS[id].dir}/${pad(surah)}${pad(aya)}.mp3`;
}

let audio = null;
let playing = null;

export function isPlaying(surah, aya) {
  return Boolean(playing && playing.surah === surah && playing.aya === aya);
}

export function stop() {
  if (audio) {
    try {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    } catch (error) {
      /* already gone */
    }
    audio = null;
  }
  playing = null;
}

/** Play one aya; any other aya that was playing stops first. */
export function play(surah, aya, options = {}) {
  stop();
  const onEnd = typeof options.onEnd === 'function' ? options.onEnd : () => {};
  const onError = typeof options.onError === 'function' ? options.onError : () => {};

  let el;
  try {
    el = new Audio(urlFor(surah, aya));
  } catch (error) {
    onError();
    return false;
  }

  audio = el;
  playing = { surah, aya };
  el.preload = 'auto';
  el.addEventListener('ended', () => {
    if (playing && playing.surah === surah && playing.aya === aya) playing = null;
    onEnd();
  });
  el.addEventListener('error', () => {
    if (playing && playing.surah === surah && playing.aya === aya) playing = null;
    onError();
  });

  const started = el.play();
  if (started && typeof started.catch === 'function') {
    started.catch(() => {
      if (playing && playing.surah === surah && playing.aya === aya) playing = null;
      onError();
    });
  }
  return true;
}

/** Play, or stop if this aya is already playing. Returns true when it started. */
export function toggle(surah, aya, options = {}) {
  if (isPlaying(surah, aya)) {
    stop();
    if (typeof options.onStop === 'function') options.onStop();
    return false;
  }
  return play(surah, aya, options);
}
