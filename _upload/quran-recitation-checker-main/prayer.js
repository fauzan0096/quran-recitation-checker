// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Prayer times, calculated on the phone (no server, no API). Standard NOAA
// solar equations; Fajr 18°, Isha 17°, Asr Hanafi (2 shadows) or Shafi (1).
// Location comes from the browser's geolocation and is stored only on device.

import { t } from './i18n.js';

const STORE = 'tc.prayer';
const DEG = Math.PI / 180;

const PRAYERS = [
  ['fajr', 'prayer.fajr'],
  ['dhuhr', 'prayer.dhuhr'],
  ['asr', 'prayer.asr'],
  ['maghrib', 'prayer.maghrib'],
  ['isha', 'prayer.isha'],
];

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (raw && typeof raw === 'object') {
      return {
        lat: Number(raw.lat) || null,
        lon: Number(raw.lon) || null,
        hanafi: raw.hanafi !== false,
      };
    }
  } catch (error) {
    /* ignore */
  }
  return { lat: null, lon: null, hanafi: true };
}

function write(data) {
  try {
    localStorage.setItem(STORE, JSON.stringify(data));
  } catch (error) {
    /* private mode */
  }
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

/** Solar declination (radians) and equation of time (minutes). */
function sun(gamma) {
  const eq =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const dec =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  return { eq, dec };
}

function hourAngle(lat, dec, altitude) {
  const top = Math.sin(altitude * DEG) - Math.sin(lat * DEG) * Math.sin(dec);
  const bottom = Math.cos(lat * DEG) * Math.cos(dec);
  if (!bottom) return null;
  const cos = top / bottom;
  if (cos > 1 || cos < -1) return null;
  return Math.acos(cos) / DEG;
}

function wrap(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  return m;
}

/**
 * Times for today at the given place, in minutes after local midnight.
 * @returns {{fajr:number|null, dhuhr:number, asr:number|null,
 *   maghrib:number|null, isha:number|null, sunrise:number|null}}
 */
export function prayerTimes(lat, lon, hanafi = true, when = new Date()) {
  const tz = -when.getTimezoneOffset();
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear(when) - 1 + 0.5);
  const { eq, dec } = sun(gamma);

  const noon = 720 - 4 * lon - eq + tz;
  const haSun = hourAngle(lat, dec, -0.833);
  const haFajr = hourAngle(lat, dec, -18);
  const haIsha = hourAngle(lat, dec, -17);

  // Asr: shadow length equals factor × object height + noon shadow.
  const shadow = hanafi ? 2 : 1;
  const asrAltitude =
    Math.atan(1 / (shadow + Math.tan(Math.abs(lat * DEG - dec)))) / DEG;
  const haAsr = hourAngle(lat, dec, asrAltitude);

  return {
    fajr: haFajr === null ? null : wrap(noon - 4 * haFajr),
    sunrise: haSun === null ? null : wrap(noon - 4 * haSun),
    dhuhr: wrap(noon + 1),
    asr: haAsr === null ? null : wrap(noon + 4 * haAsr),
    maghrib: haSun === null ? null : wrap(noon + 4 * haSun + 1),
    isha: haIsha === null ? null : wrap(noon + 4 * haIsha),
  };
}

export function formatTime(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '—';
  const total = Math.round(minutes) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 12-ghante ka waqt: 05:12 AM */
export function formatTime12(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '—';
  const total = Math.round(minutes) % 1440;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

function nowMinutes(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

/** Har namaz ka [awwal, aakhir] — aakhir agle waqt ka awwal (Fajr ka tulu-e-aftab). */
function windows(times) {
  const fajr = times.fajr;
  const out = {
    fajr: [fajr, times.sunrise],
    dhuhr: [times.dhuhr, times.asr],
    asr: [times.asr, times.maghrib],
    maghrib: [times.maghrib, times.isha],
    isha: [times.isha, fajr === null || fajr === undefined ? null : fajr + 1440],
  };
  return out;
}

/** Abhi kaunsa waqt chal raha hai (null = Fajr se pehle ya tulu ke baad, Zuhr se pehle). */
function currentPrayer(times, now = new Date()) {
  const cur = nowMinutes(now);
  const win = windows(times);
  for (const [id] of PRAYERS) {
    const [a, b] = win[id];
    if (a === null || a === undefined || b === null || b === undefined) continue;
    if (cur >= a && cur < b) return id;
    // Isha raat ke 12 ke baad
    if (id === 'isha' && cur + 1440 >= a && cur + 1440 < b) return id;
  }
  return null;
}

function nextPrayer(times, now = new Date()) {
  const current = nowMinutes(now);
  for (const [id] of PRAYERS) {
    const value = times[id];
    if (value === null || value === undefined) continue;
    if (value > current) return { id, at: value };
  }
  const fajr = times.fajr;
  return fajr === null || fajr === undefined ? null : { id: 'fajr', at: fajr + 1440 };
}

function durationText(minutes) {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const parts = [];
  if (h) parts.push(t('prayer.h', { n: h }));
  if (m || !h) parts.push(t('prayer.m', { n: m }));
  return parts.join(' ');
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountPrayer(root) {
  if (!root) return { refresh() {} };
  const state = read();

  function build() {
    root.innerHTML = '';
    root.className = 'prayer';

    if (!state.lat || !state.lon) {
      root.appendChild(el('p', 'hint', t('prayer.needPlace')));
      const locate = el('button', 'btn primary', t('prayer.locate'));
      locate.type = 'button';
      locate.addEventListener('click', () => locateMe(build));
      root.appendChild(locate);
      root.appendChild(manualForm(state, build));
      return;
    }

    const times = prayerTimes(state.lat, state.lon, state.hanafi);
    const next = nextPrayer(times);

    // Sirf awwal waqt: har namaz ka naam aur uska shuru hone ka waqt.
    const list = el('div', 'prayer-list');
    for (const [id, label] of PRAYERS) {
      const row = el('div', `prayer-row${next && next.id === id ? ' is-next' : ''}`);
      row.append(el('span', 'prayer-name', t(label)), el('strong', 'prayer-time', formatTime12(times[id])));
      list.appendChild(row);
    }
    root.appendChild(list);

    const tools = el('div', 'prayer-tools');

    const method = el('button', 'btn ghost small', state.hanafi ? t('prayer.useShafi') : t('prayer.useHanafi'));
    method.type = 'button';
    method.addEventListener('click', () => {
      state.hanafi = !state.hanafi;
      write(state);
      build();
    });
    tools.appendChild(method);

    const refresh = el('button', 'btn ghost small', t('prayer.locateAgain'));
    refresh.type = 'button';
    refresh.addEventListener('click', () => locateMe(build));
    tools.appendChild(refresh);

    root.appendChild(tools);
    root.appendChild(manualForm(state, build));
  }

  build();
  const tick = window.setInterval(() => {
    if (!root.isConnected) {
      window.clearInterval(tick);
      return;
    }
    if (root.offsetParent !== null && state.lat && state.lon) build();
  }, 60000);
  return { refresh: build };
}

function manualForm(state, after) {
  const box = el('details', 'prayer-manual');
  box.appendChild(el('summary', '', t('prayer.manual')));
  const form = el('div', 'prayer-manual-grid');

  const lat = el('input');
  lat.type = 'number';
  lat.step = '0.0001';
  lat.placeholder = '24.8607';
  lat.value = state.lat ? String(state.lat) : '';
  lat.setAttribute('aria-label', 'Latitude');

  const lon = el('input');
  lon.type = 'number';
  lon.step = '0.0001';
  lon.placeholder = '67.0011';
  lon.value = state.lon ? String(state.lon) : '';
  lon.setAttribute('aria-label', 'Longitude');

  const save = el('button', 'btn small', t('prayer.save'));
  save.type = 'button';
  save.addEventListener('click', () => {
    const la = Number(lat.value);
    const lo = Number(lon.value);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return;
    state.lat = la;
    state.lon = lo;
    write(state);
    after();
  });

  form.append(lat, lon, save);
  box.appendChild(form);
  return box;
}

function locateMe(after) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const state = read();
      state.lat = position.coords.latitude;
      state.lon = position.coords.longitude;
      write(state);
      after();
    },
    () => {
      /* person declined: the manual form stays */
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 }
  );
}
