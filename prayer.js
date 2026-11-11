// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Prayer times, calculated on the phone (no server, no API). Standard solar
// equations with the earliest (first) time of each prayer: Fajr 18°, Isha 17°,
// and Asr at one shadow, so the screen shows "awwal waqt" and nothing about
// schools. A person can also set their own time for any prayer; that time is
// then used everywhere — the screen, the azaan and the notifications.
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
      const custom = {};
      if (raw.custom && typeof raw.custom === 'object') {
        for (const [key] of PRAYERS) {
          const minutes = clockMinutes(raw.custom[key]);
          if (minutes !== null) custom[key] = minutes;
        }
      }
      return {
        lat: Number(raw.lat) || null,
        lon: Number(raw.lon) || null,
        hanafi: false,
        custom,
      };
    }
  } catch (error) {
    /* ignore */
  }
  return { lat: null, lon: null, hanafi: false, custom: {} };
}

function write(data) {
  // Custom times are kept as "HH:MM" in storage and as minutes in memory, so
  // every caller can save whatever it has.
  const next = { ...data };
  const custom = {};
  if (next.custom && typeof next.custom === 'object') {
    for (const [key] of PRAYERS) {
      const value = next.custom[key];
      if (typeof value === 'number') custom[key] = formatTime(value);
      else if (clockMinutes(value) !== null) custom[key] = String(value).slice(0, 5);
    }
  }
  next.custom = custom;
  next.hanafi = false;

  try {
    localStorage.setItem(STORE, JSON.stringify(next));
  } catch (error) {
    /* private mode */
  }
}

/** "HH:MM" → minutes after midnight, or null when it is not a real time. */
function clockMinutes(text) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(text || '').trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** The saved location (shared with the azaan player). */
export function location() {
  return read();
}

/** The next `days` days of prayer times, for the push scheduler. */
export function upcomingPrayers(days = 7) {
  const saved = read();
  if (!saved.lat || !saved.lon) return [];

  const out = [];
  const base = new Date();
  for (let i = 0; i < days; i += 1) {
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const times = prayerTimes(saved.lat, saved.lon, saved.hanafi, day);
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    for (const [key] of PRAYERS) {
      const minutes = times[key];
      if (minutes === null || minutes === undefined) continue;
      const total = Math.round(minutes);
      out.push({
        date,
        time: `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`,
        name: key,
      });
    }
  }
  return out;
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
 * Times for the day, in minutes after local midnight: the earliest (first) time
 * of each prayer. Any time the person set themselves wins over the calculation.
 * The second argument is kept only so older callers keep working.
 * @returns {{fajr:number|null, dhuhr:number, asr:number|null,
 *   maghrib:number|null, isha:number|null, sun:number|null}}
 */
export function prayerTimes(lat, lon, _hanafi, when) {
  const at = when instanceof Date ? when : new Date();
  const latN = Number(lat);
  const lonN = Number(lon);
  const tz = -at.getTimezoneOffset();
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear(at) - 1 + 0.5);
  const { eq, dec } = sun(gamma);

  const noon = 720 - 4 * lonN - eq + tz;
  const haSun = hourAngle(latN, dec, -0.833);
  const haFajr = hourAngle(latN, dec, -18);
  const haIsha = hourAngle(latN, dec, -17);

  // Earliest asr: the shadow is one object-length again (plus the noon shadow).
  const asrAltitude = Math.atan(1 / (1 + Math.tan(Math.abs(latN * DEG - dec)))) / DEG;
  const haAsr = hourAngle(latN, dec, asrAltitude);

  const times = {
    fajr: haFajr === null ? null : wrap(noon - 4 * haFajr),
    sunrise: haSun === null ? null : wrap(noon - 4 * haSun),
    dhuhr: wrap(noon + 1),
    asr: haAsr === null ? null : wrap(noon + 4 * haAsr),
    maghrib: haSun === null ? null : wrap(noon + 4 * haSun + 1),
    isha: haIsha === null ? null : wrap(noon + 4 * haIsha),
  };

  // A time the person set themselves wins over the calculation — here and
  // everywhere else, because the azaan and the notifications use this function.
  const custom = read().custom || {};
  for (const [key] of PRAYERS) {
    if (typeof custom[key] === 'number') times[key] = custom[key];
  }

  return times;
}

export function formatTime(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '—';
  const total = Math.round(minutes) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function nextPrayer(times, now = new Date()) {
  const current = now.getHours() * 60 + now.getMinutes();
  for (const [id] of PRAYERS) {
    const value = times[id];
    if (value === null || value === undefined) continue;
    if (value > current) return { id, at: value };
  }
  const fajr = times.fajr;
  return fajr === null || fajr === undefined ? null : { id: 'fajr', at: fajr + 1440 };
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
      const status = el('p', 'hint');
      status.id = 'prayer-status';
      const locate = el('button', 'btn primary', t('prayer.locate'));
      locate.type = 'button';
      locate.addEventListener('click', () => locateMe(build, status));
      root.appendChild(locate);
      root.appendChild(status);
      root.appendChild(manualForm(state, build));
      return;
    }

    const times = prayerTimes(state.lat, state.lon, state.hanafi);
    const next = nextPrayer(times);

    const head = el('div', 'prayer-head');
    head.appendChild(el('span', 'prayer-place', `${state.lat.toFixed(3)}, ${state.lon.toFixed(3)}`));
    if (next) {
      head.appendChild(
        el('span', 'prayer-next', t('prayer.nextAt', { name: t(`prayer.${next.id}`), time: formatTime(next.at) }))
      );
    }
    root.appendChild(head);

    const list = el('div', 'prayer-list');
    for (const [id, label] of PRAYERS) {
      const row = el('div', `prayer-row${next && next.id === id ? ' is-next' : ''}`);
      const value = el('strong', 'prayer-time', formatTime(times[id]));
      if (state.custom && typeof state.custom[id] === 'number') value.classList.add('is-custom');
      row.append(el('span', 'prayer-name', t(label)), value);
      list.appendChild(row);
    }
    root.appendChild(list);

    root.appendChild(
      el('p', 'hint', t('prayer.awwal'))
    );

    root.appendChild(customForm(state, build));

    const tools = el('div', 'prayer-tools');

    const refresh = el('button', 'btn ghost small', t('prayer.locateAgain'));
    refresh.type = 'button';
    const status = el('p', 'hint');
    status.id = 'prayer-status';
    refresh.addEventListener('click', () => locateMe(build, status));
    tools.appendChild(refresh);

    root.appendChild(tools);
    root.appendChild(status);
    root.appendChild(manualForm(state, build));
  }

  build();
  return { refresh: build };
}

/** Set your own time for any prayer (a masjid's timetable, or a few minutes off). */
function customForm(state, after) {
  const box = el('details', 'prayer-manual');
  if (state.custom && Object.keys(state.custom).length) box.open = true;
  box.appendChild(el('summary', '', t('prayer.custom')));

  const grid = el('div', 'prayer-custom');
  const inputs = {};
  for (const [key, label] of PRAYERS) {
    const row = el('label', 'custom-row');
    row.appendChild(el('span', 'custom-label', t(label)));
    const input = document.createElement('input');
    input.type = 'time';
    input.value = typeof state.custom?.[key] === 'number' ? formatTime(state.custom[key]) : '';
    input.setAttribute('aria-label', t(label));
    inputs[key] = input;
    row.appendChild(input);
    grid.appendChild(row);
  }

  const actions = el('div', 'row-actions');

  const save = el('button', 'btn primary small', t('prayer.saveTimes'));
  save.type = 'button';
  save.addEventListener('click', () => {
    const custom = {};
    for (const [key] of PRAYERS) {
      const minutes = clockMinutes(inputs[key].value);
      if (minutes !== null) custom[key] = minutes;
    }
    state.custom = custom;
    write({ lat: state.lat, lon: state.lon, custom });
    after();
  });

  const reset = el('button', 'btn ghost small', t('prayer.resetTimes'));
  reset.type = 'button';
  reset.addEventListener('click', () => {
    state.custom = {};
    write({ lat: state.lat, lon: state.lon, custom: {} });
    after();
  });

  actions.append(save, reset);
  grid.appendChild(actions);
  box.appendChild(grid);
  return box;
}

/** The place's own latitude/longitude, for a phone whose location cannot be read. */
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

function locateMe(after, status) {
  const say = (text) => {
    if (status) status.textContent = text;
  };

  if (!navigator.geolocation) {
    say(t('prayer.noGeo'));
    return;
  }

  say(t('prayer.locating'));

  const done = (position) => {
    const state = read();
    state.lat = position.coords.latitude;
    state.lon = position.coords.longitude;
    write(state);
    after();
  };

  const failed = (error) => {
    const messages = {
      1: 'prayer.geoDenied',
      2: 'prayer.geoUnavailable',
      3: 'prayer.geoTimeout',
    };
    say(t(messages[error && error.code] || 'prayer.geoFailed'));
  };

  navigator.geolocation.getCurrentPosition(done, failed, {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 300000,
  });
}
