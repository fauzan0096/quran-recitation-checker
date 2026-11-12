// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
// Hijri calendar maths (tabulated / Kuwaiti algorithm).
//
// This is the arithmetic Islamic calendar. Local moon sighting can put the
// start of a month a day earlier or later — the UI says so.

export const HIJRI_EPOCH = 1948440; // JDN of 1 Muharram 1 AH

const KAABA = { lat: 21.4225, lon: 39.8262 };

export function gregorianToJDN(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

export function jdnToGregorian(jdn) {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    year: 100 * b + d - 4800 + Math.floor(m / 10),
    month: m + 3 - 12 * Math.floor(m / 10),
    day: e - Math.floor((153 * m + 2) / 5) + 1,
  };
}

/** 1-based month (1 = Muharram). */
export function hijriToJDN(year, month, day) {
  return (
    day +
    Math.ceil(29.5 * (month - 1)) +
    (year - 1) * 354 +
    Math.floor((3 + 11 * year) / 30) +
    HIJRI_EPOCH -
    1
  );
}

export function jdnToHijri(jdn) {
  let year = Math.floor((jdn - HIJRI_EPOCH) / 354.367) + 1;
  while (hijriToJDN(year + 1, 1, 1) <= jdn) year += 1;
  while (hijriToJDN(year, 1, 1) > jdn) year -= 1;
  let month = 12;
  while (month > 1 && hijriToJDN(year, month, 1) > jdn) month -= 1;
  return { year, month, day: jdn - hijriToJDN(year, month, 1) + 1 };
}

export function hijriMonthLength(year, month) {
  const start = hijriToJDN(year, month, 1);
  const next = month === 12 ? hijriToJDN(year + 1, 1, 1) : hijriToJDN(year, month + 1, 1);
  return next - start;
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOfJDN(jdn) {
  return (jdn + 1) % 7;
}

export function todayJDN() {
  const now = new Date();
  return gregorianToJDN(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

const OFFSET_KEY = 'tc.hijriOffset';
const SOUTH_ASIA = /^Asia\/(Kolkata|Calcutta|Karachi|Dhaka|Colombo|Kathmandu)$/;

/** Hijri day shift for this place: saved choice, else South Asia (moon sighted later) = -1, else 0. */
export function hijriOffset() {
  try {
    const saved = localStorage.getItem(OFFSET_KEY);
    if (saved !== null && saved !== 'auto') return Math.max(-2, Math.min(2, Number(saved) || 0));
  } catch (error) {
    /* ignore */
  }
  let zone = '';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch (error) {
    /* ignore */
  }
  return SOUTH_ASIA.test(zone) ? -1 : 0;
}

export function setHijriOffset(value) {
  try {
    if (value === 'auto') localStorage.removeItem(OFFSET_KEY);
    else localStorage.setItem(OFFSET_KEY, String(value));
  } catch (error) {
    /* ignore */
  }
}

export function hijriOf(jdn) {
  return jdnToHijri(jdn + hijriOffset());
}

export function todayHijri() {
  return hijriOf(todayJDN());
}

/** Degrees clockwise from true north to the Kaaba. */
export function qiblaBearing(lat, lon) {
  const toRad = (value) => (value * Math.PI) / 180;
  const toDeg = (value) => (value * 180) / Math.PI;
  const phi1 = toRad(lat);
  const phi2 = toRad(KAABA.lat);
  const delta = toRad(KAABA.lon - lon);
  const y = Math.sin(delta);
  const x = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(delta);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Great-circle distance to the Kaaba, in km. */
export function distanceToKaaba(lat, lon) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(KAABA.lat - lat);
  const dLon = toRad(KAABA.lon - lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat)) * Math.cos(toRad(KAABA.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a))));
}

const AR_MONTHS = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
const arDigits = (value) => String(value).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

/** Hijri date in Arabic script, e.g. ٢٨ جمادى الأولى ١٤٤٨ هـ */
export function hijriArabic(h) {
  return arDigits(`${h.day} ${AR_MONTHS[h.month - 1]} ${h.year} هـ`);
}
export function hijriMonthArabic(month) {
  return AR_MONTHS[month - 1];
}
