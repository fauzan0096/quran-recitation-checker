// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Qari (reciter) audio — the correct recitation of an aya, played next to the
// words the person got wrong, or on its own from any aya in the reader.
//
// Two free, key-less sources, tried in order:
//   1. EveryAyah.com — one mp3 per aya, folder per reciter.
//   2. Islamic Network CDN — one mp3 per aya, but numbered 1..6236, so the aya's
//      position in the whole Quran is worked out from the surah lengths.
// Nothing is bundled with the app: the audio streams on demand.

import { ayaCount } from './quran.js';

const BASE = 'https://everyayah.com/data/';
const MIRROR = 'https://cdn.islamic.network/quran/audio/128/';
const KEY = 'tc.qari';

export const RECITERS = {
  alafasy: {
    dir: 'Alafasy_128kbps',
    mirror: 'ar.alafasy',
    name: 'Mishary Rashid Alafasy',
  },
  husary: { dir: 'Husary_128kbps', mirror: 'ar.husary', name: 'Mahmoud Khalil Al-Husary' },
  basit: {
    dir: 'Abdul_Basit_Murattal_64kbps',
    mirror: 'ar.abdulbasitmurattal',
    name: 'Abdul Basit (Murattal)',
  },
  minshawy: {
    dir: 'Minshawy_Murattal_128kbps',
    mirror: 'ar.minshawy',
    name: 'Mohamed Al-Minshawy',
  },
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

export function setCurrent(id) {
  if (!RECITERS[id]) return read();
  try {
    localStorage.setItem(KEY, id);
  } catch (error) {
    /* private mode */
  }
  return id;
}

export const setReciter = setCurrent;

export function reciters() {
  return Object.entries(RECITERS).map(([id, info]) => ({ id, name: info.name }));
}

const pad = (n) => String(n).padStart(3, '0');

/** How many times a single aya is played in a row (1, 2 or 3). */
const REPEAT_KEY = 'tc.qariRepeat';

export function repeatCount() {
  try {
    const n = Number(localStorage.getItem(REPEAT_KEY));
    return n === 2 || n === 3 ? n : 1;
  } catch (error) {
    return 1;
  }
}

export function setRepeatCount(n) {
  const value = n === 2 || n === 3 ? n : 1;
  try {
    localStorage.setItem(REPEAT_KEY, String(value));
  } catch (error) {
    /* private mode */
  }
  return value;
}

/** The aya's number in the whole Quran (1..6236), 0 while the text is loading. */
function globalIndex(surah, aya) {
  let index = aya;
  for (let s = 1; s < surah; s += 1) {
    const count = ayaCount(s);
    if (!count) return 0;
    index += count;
  }
  return index;
}

/** Every URL for one aya, best first. */
export function urlsFor(surah, aya) {
  const info = RECITERS[read()];
  const list = [`${BASE}${info.dir}/${pad(surah)}${pad(aya)}.mp3`];

  const index = globalIndex(surah, aya);
  if (index) list.push(`${MIRROR}${info.mirror}/${index}.mp3`);

  return list;
}

/** The primary mp3 of one aya. */
export function urlFor(surah, aya) {
  return urlsFor(surah, aya)[0];
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

/**
 * Play one aya; any other aya that was playing stops first. If a source fails
 * (404, offline, blocked), the next one is tried before giving up.
 */
export function play(surah, aya, options = {}) {
  stop();
  const onEnd = typeof options.onEnd === 'function' ? options.onEnd : () => {};
  const onError = typeof options.onError === 'function' ? options.onError : () => {};
  const list = urlsFor(surah, aya);
  let index = 0;

  const finish = () => {
    if (playing && playing.surah === surah && playing.aya === aya) playing = null;
  };

  const tryNext = () => {
    if (index >= list.length) {
      finish();
      onError();
      return;
    }
    const url = list[index];
    index += 1;

    let el;
    try {
      el = new Audio(url);
    } catch (error) {
      tryNext();
      return;
    }

    audio = el;
    playing = { surah, aya };
    el.preload = 'auto';

    el.addEventListener('ended', () => {
      finish();
      onEnd();
    });
    el.addEventListener('error', () => {
      if (index < list.length) tryNext();
      else {
        finish();
        onError();
      }
    });

    const started = el.play();
    if (started && typeof started.catch === 'function') {
      started.catch(() => {
        if (index < list.length) tryNext();
        else {
          finish();
          onError();
        }
      });
    }
  };

  tryNext();
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
