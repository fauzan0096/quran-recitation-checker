// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Gift codes: Premium for the people the owner chooses, without Play Billing.
//
//   • The owner types a phrase that only the owner knows, and Premium opens for good
//     on that phone — and from then on the Premium screen has a "Gift code banayein"
//     tool that makes a code for anybody. The phrase itself is written nowhere in
//     this app: gift.js keeps only a fingerprint of it.
//   • Anyone types such a code in the same box and Premium opens on their phone
//     for the days written inside the code (or for good).
//
// A code is  BAYYIN-ddd-NNNN-CCCCCC:  ddd = days (000 = hamesha), NNNN = a random
// part, CCCCCC = a check made with an app key. There is no server: the code is
// checked on the phone, offline.

const KEY = 'tc.gift';

// The owner phrase is never written in this file. Only a small fingerprint of it is
// kept — its normalised length and two sums of its character codes — so the app can
// recognise it while holding none of the words: reading this file cannot give the
// phrase back. It is still a courtesy, not a lock (a determined person could search
// for a different string with the same numbers). Giving Premium away costs Play
// nothing: the rule Play enforces is that a *purchase* must go through Play Billing.
const OWNER_LEN = 14;
const OWNER_SUM = 870;
const OWNER_WEIGHTED = 5970;

// Gift codes are checked with a key of their own, so the owner phrase never has to
// live in the app. Whoever reads this file can still mint a code — but a code only
// gives Premium for the days written in it, never the code maker.
const CHECK_KEY = 'Q7m2-K9x4-B3tz-88Fa';

const PREFIX = 'BAYYIN';
// Crockford-style base 32: no I, L, O, U, so a code cannot be misread.
const ALPH = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const NONCE_LEN = 4;
const CHECK_LEN = 6;

function normalize(text) {
  return String(text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function isBase32(text) {
  for (const char of text) if (ALPH.indexOf(char) < 0) return false;
  return true;
}

/** A number as `len` characters of ALPH, most significant first. */
function base32(number, len) {
  let value = Math.abs(Math.floor(number));
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out = ALPH[value % 32] + out;
    value = Math.floor(value / 32);
  }
  return out;
}

/** FNV-1a: a small, stable hash so the same payload always gives the same check. */
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function check(payload) {
  return base32(hash(`${CHECK_KEY}|${payload}`), CHECK_LEN);
}

/**
 * The owner phrase as a fingerprint: the same length, the same plain sum of its
 * character codes and the same sum counted with 1, 2, 3 … as weights. The words
 * themselves are not stored anywhere, so this file cannot give them away.
 */
function isOwnerPhrase(plain) {
  if (plain.length !== OWNER_LEN) return false;
  let sum = 0;
  let weighted = 0;
  for (let i = 0; i < plain.length; i += 1) {
    const code = plain.charCodeAt(i);
    sum += code;
    weighted += (i + 1) * code;
  }
  return sum === OWNER_SUM && weighted === OWNER_WEIGHTED;
}

function save(entry) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...entry, at: Date.now() }));
  } catch (error) {
    /* private mode: the code still works for this session */
  }
}

/** The gift on this phone: { active, owner, lifetime, days, until, code }. */
export function giftState() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch (error) {
    raw = null;
  }
  if (!raw || typeof raw !== 'object') {
    return { active: false, owner: false, lifetime: false, days: 0, until: 0, code: '' };
  }
  const lifetime = raw.lifetime === true;
  const until = Number(raw.until) || 0;
  return {
    active: lifetime || until > Date.now(),
    owner: raw.owner === true,
    lifetime,
    days: Number(raw.days) || 0,
    until,
    code: String(raw.code || ''),
  };
}

/** Make one code: `days` of Premium, 0 for hamesha. */
export function makeGiftCode(days) {
  const d = Math.max(0, Math.min(999, Math.round(Number(days) || 0)));
  const dayCode = String(d).padStart(3, '0');
  const nonce = base32(Math.floor(Math.random() * 32 ** NONCE_LEN), NONCE_LEN);
  return `${PREFIX}-${dayCode}-${nonce}-${check(dayCode + nonce)}`;
}

/**
 * Type a code (or the owner phrase). Returns
 * { ok: true, owner, lifetime, days } or { ok: false, reason: 'empty'|'format'|'bad' }.
 */
export function redeemGift(text) {
  const plain = normalize(text);
  if (!plain) return { ok: false, reason: 'empty' };

  if (isOwnerPhrase(plain)) {
    save({ code: 'owner', days: 0, until: 0, lifetime: true, owner: true });
    return { ok: true, owner: true, lifetime: true, days: 0 };
  }

  if (!plain.startsWith(PREFIX)) return { ok: false, reason: 'format' };
  const body = plain.slice(PREFIX.length);
  if (body.length !== 3 + NONCE_LEN + CHECK_LEN) return { ok: false, reason: 'format' };

  const dayCode = body.slice(0, 3);
  const nonce = body.slice(3, 3 + NONCE_LEN);
  const written = body.slice(3 + NONCE_LEN);
  if (!/^\d{3}$/.test(dayCode) || !isBase32(nonce) || check(dayCode + nonce) !== written) {
    return { ok: false, reason: 'bad' };
  }

  const days = Number(dayCode);
  save({
    code: plain,
    days,
    until: days ? Date.now() + days * 86400000 : 0,
    lifetime: days === 0,
    owner: false,
  });
  return { ok: true, owner: false, lifetime: days === 0, days };
}

/** Drop the gift from this phone (Settings/testing). */
export function clearGift() {
  try {
    localStorage.removeItem(KEY);
  } catch (error) {
    /* ignore */
  }
}
