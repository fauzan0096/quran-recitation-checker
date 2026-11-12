// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Qari (reciter) audio — the correct recitation of an aya, played next to the
// words the person got wrong, or on its own from any aya in the reader.
//
// The reader's ▶ Qari button chains the ayas (till the end of the surah), and this
// file keeps that going while the app is in the background: one audio element lives
// for the whole session, and the lock screen gets a media notification with
// play/pause and next/previous.
//
// Two free, key-less sources, tried in order:
//   1. EveryAyah.com — one mp3 per aya, folder per reciter.
//   2. Islamic Network CDN — one mp3 per aya, but numbered 1..6236, so the aya's
//      position in the whole Quran is worked out from the surah lengths.
// Nothing is bundled with the app: the audio streams on demand.

import { ayaCount } from './quran.js';
import { surahName } from './surahs.js';

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

// ---------------------------------------------------------------- playback
// One element for the whole session: a fresh Audio() per aya loses the media
// session, and Android then stops the sound the moment the app goes to the
// background. This one keeps playing, with a lock-screen notification.
let element = null;
let playing = null; // { surah, aya }
let paused = false;
let hooks = { onEnd: null, onError: null, onNext: null, onPrev: null };

function audio() {
  if (element) return element;
  try {
    element = new Audio();
    element.preload = 'auto';
    element.setAttribute('playsinline', '');
  } catch (error) {
    element = null;
  }
  return element;
}

function mediaSession() {
  try {
    return typeof navigator !== 'undefined' ? navigator.mediaSession : null;
  } catch (error) {
    return null;
  }
}

/** "Aya" in the app's language; tiny on purpose, no import needed. */
function ayaWord() {
  try {
    const lang = localStorage.getItem('tc.lang');
    if (lang === 'ur') return 'آیت';
    if (lang === 'en') return 'Aya';
  } catch (error) {
    /* ignore */
  }
  return 'Aya';
}

/** Lock-screen / notification controls, so playback can be driven from outside. */
function paintSession(surah, aya, state) {
  const session = mediaSession();
  if (!session) return;
  try {
    if (!surah) {
      session.metadata = null;
    } else if (typeof MediaMetadata === 'function') {
      const name = surahName(surah) || `Surah ${surah}`;
      session.metadata = new MediaMetadata({
        title: `${name} • ${ayaWord()} ${aya}`,
        artist: RECITERS[read()].name,
        album: 'Bayyin — Quran',
      });
    }
  } catch (error) {
    /* no MediaMetadata on this browser */
  }
  try {
    session.playbackState = state;
  } catch (error) {
    /* ignore */
  }
}

function wireSessionActions() {
  const session = mediaSession();
  if (!session || typeof session.setActionHandler !== 'function') return;
  const handlers = {
    play: () => resume(),
    pause: () => pause(),
    stop: () => stop(),
    nexttrack: () => {
      if (hooks.onNext) hooks.onNext();
    },
    previoustrack: () => {
      if (hooks.onPrev) hooks.onPrev();
    },
  };
  for (const [action, handler] of Object.entries(handlers)) {
    try {
      session.setActionHandler(action, handler);
    } catch (error) {
      /* this action is not supported here */
    }
  }
}

export function isPlaying(surah, aya) {
  return Boolean(playing && playing.surah === surah && playing.aya === aya);
}

export function isPaused() {
  const el = audio();
  return Boolean(el && playing && el.paused && !el.ended);
}

/** Stop the sound and forget the aya. */
export function stop() {
  const el = audio();
  if (el) {
    try {
      el.onended = null;
      el.onerror = null;
      el.pause();
      el.removeAttribute('src');
      el.load();
    } catch (error) {
      /* already gone */
    }
  }
  playing = null;
  paused = false;
  hooks = { onEnd: null, onError: null, onNext: null, onPrev: null };
  paintSession(0, 0, 'none');
}

export function pause() {
  const el = audio();
  if (!el || !playing) return false;
  try {
    el.pause();
  } catch (error) {
    return false;
  }
  paused = true;
  paintSession(playing.surah, playing.aya, 'paused');
  return true;
}

export function resume() {
  const el = audio();
  if (!el || !playing) return false;
  paused = false;
  const started = el.play();
  if (started && typeof started.catch === 'function') started.catch(() => {});
  paintSession(playing.surah, playing.aya, 'playing');
  return true;
}

/**
 * Play one aya; any other aya that was playing stops first. If a source fails
 * (404, offline, blocked), the next one is tried before giving up.
 *
 * `options.onNext` and `options.onPrev` are what the lock-screen next/previous
 * buttons call — the reader uses them to walk the surah.
 */
export function play(surah, aya, options = {}) {
  const el = audio();
  if (!el) return false;

  const onEnd = typeof options.onEnd === 'function' ? options.onEnd : () => {};
  const onError = typeof options.onError === 'function' ? options.onError : () => {};
  hooks = {
    onEnd,
    onError,
    onNext: typeof options.onNext === 'function' ? options.onNext : null,
    onPrev: typeof options.onPrev === 'function' ? options.onPrev : null,
  };

  // Stop whatever was playing, but keep the element and its media session.
  try {
    el.pause();
  } catch (error) {
    /* ignore */
  }
  paused = false;
  playing = { surah, aya };
  paintSession(surah, aya, 'playing');
  wireSessionActions();

  const list = urlsFor(surah, aya);
  let index = 0;

  const fail = () => {
    if (playing && playing.surah === surah && playing.aya === aya) playing = null;
    onError();
  };

  const attempt = () => {
    if (index >= list.length) {
      fail();
      return;
    }
    const url = list[index];
    index += 1;

    el.onerror = () => attempt();
    el.onended = () => {
      if (playing && playing.surah === surah && playing.aya === aya) playing = null;
      onEnd();
    };

    try {
      el.src = url;
      el.load();
    } catch (error) {
      attempt();
      return;
    }

    const started = el.play();
    if (started && typeof started.catch === 'function') {
      started.catch((error) => {
        // The browser refused the sound (no tap yet): stop instead of running
        // through the rest of the surah in a tight loop.
        if (error && error.name === 'NotAllowedError') {
          stop();
          return;
        }
        attempt();
      });
    }
  };

  attempt();
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
