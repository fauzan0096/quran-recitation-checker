// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
// Qibla direction: location + device compass, with a plain "bearing from north"
// fallback when the phone has no compass.
//
// Android notes (why this file looks the way it does):
//  - Chrome on Android sends the *true* compass only through
//    `deviceorientationabsolute`; plain `deviceorientation` is relative to an
//    arbitrary start angle. Firefox / some WebViews do the opposite.
//  - Some phones fire neither, so we fall back to the Generic Sensor API
//    (AbsoluteOrientationSensor) before giving up.
//  - The compass must not depend on GPS: it starts first, location is fetched in
//    parallel (and falls back to the place saved in the prayer-times screen).
//  - alpha alone is wrong when the phone is tilted, so the heading is
//    tilt-compensated from alpha/beta/gamma and corrected for screen rotation.

import { t } from './i18n.js';
import { qiblaBearing, distanceToKaaba } from './hijri.js';

const COMPASS_POINTS = [
  [0, 'N'],
  [90, 'E'],
  [180, 'S'],
  [270, 'W'],
];

const RAD = Math.PI / 180;

function screenAngle() {
  try {
    if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
  } catch (error) {
    /* ignore */
  }
  return typeof window.orientation === 'number' ? window.orientation : 0;
}

/**
 * Tilt-compensated compass heading (degrees, 0 = north) from alpha/beta/gamma.
 * Phone lying (mostly) flat -> where its top edge points. Phone held upright ->
 * where its back faces. Plain 360 - alpha is only right when the phone is flat
 * and level, which is why tilting used to throw the needle off.
 */
function tiltHeading(alpha, beta, gamma) {
  const a = alpha * RAD;
  const b = beta * RAD;
  const g = gamma * RAD;
  const cA = Math.cos(a);
  const sA = Math.sin(a);
  const cB = Math.cos(b);
  const sB = Math.sin(b);
  const cG = Math.cos(g);
  const sG = Math.sin(g);

  // Top edge of the phone in earth axes (x east, y north, z up).
  const topE = -cB * sA;
  const topN = cA * cB;
  const topU = sB;

  let east;
  let north;
  if (Math.abs(topU) < 0.75) {
    east = topE;
    north = topN;
  } else {
    // Back of the phone (negative screen normal).
    east = -(cA * sG + cG * sA * sB);
    north = -(sA * sG - cA * cG * sB);
  }
  return (Math.atan2(east, north) / RAD + 360) % 360;
}

/**
 * Heading from a deviceorientation(absolute) event, or null when the event does
 * not carry a real compass reading.
 */
function headingOf(event, wantAbsolute) {
  // iOS Safari
  if (typeof event.webkitCompassHeading === 'number' && !Number.isNaN(event.webkitCompassHeading)) {
    return (event.webkitCompassHeading + screenAngle() + 360) % 360;
  }
  if (typeof event.alpha !== 'number') return null;
  // Plain `deviceorientation` on Chrome Android is relative: ignore it.
  if (!wantAbsolute && event.absolute !== true) return null;
  let h;
  if (typeof event.beta === 'number' && typeof event.gamma === 'number') {
    h = tiltHeading(event.alpha, event.beta, event.gamma);
  } else {
    h = (360 - event.alpha + 360) % 360;
  }
  return (h + screenAngle() + 360) % 360;
}

/** Heading of the phone's top edge from an AbsoluteOrientationSensor quaternion. */
function headingFromQuaternion(q) {
  const [x, y, z, w] = q;
  // Device y-axis (top edge) in earth axes: east = 2(xy - zw), north = 1 - 2(x^2 + z^2).
  const east = 2 * (x * y - z * w);
  const north = 1 - 2 * (x * x + z * z);
  return (Math.atan2(east, north) / RAD + 360) % 360;
}

function savedPlace() {
  try {
    const raw = JSON.parse(localStorage.getItem('tc.prayer') || 'null');
    const lat = Number(raw && raw.lat);
    const lon = Number(raw && raw.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon)) return { lat, lon };
  } catch (error) {
    /* ignore */
  }
  return null;
}

export function mountQibla(root) {
  if (!root) return { refresh() {}, stop() {} };

  let bearing = null;
  let distance = null;
  let heading = null; // smoothed, 0..360
  let faceAngle = 0; // cumulative, so the dial never spins the long way round
  let listening = false;
  let started = false;
  let status = 'idle'; // idle | waiting | live | denied | error
  let message = '';
  let stops = [];
  let timer = null;
  let frame = 0;
  let sinAvg = 0;
  let cosAvg = 0;
  let haveAvg = false;
  let gotAbsolute = false;

  // Live nodes updated without rebuilding the whole screen.
  let faceEl = null;
  let dialEl = null;
  let readEl = null;

  function turnText() {
    if (status === 'live' && bearing !== null && heading !== null) {
      const delta = ((bearing - heading + 540) % 360) - 180;
      if (Math.abs(delta) <= 6) return t('qibla.aligned');
      return t('qibla.turn', {
        deg: Math.round(Math.abs(delta)),
        side: t(delta > 0 ? 'qibla.right' : 'qibla.left'),
      });
    }
    if (bearing !== null) return t('qibla.static', { deg: Math.round(bearing) });
    if (message) return message;
    if (status === 'waiting') return t('qibla.waiting');
    return t('qibla.hint');
  }

  /** Cheap per-frame update: rotate the dial, flip the "aligned" glow, redo the text. */
  function paint() {
    frame = 0;
    if (!faceEl) return;
    if (heading !== null) {
      let diff = ((-heading - faceAngle) % 360 + 540) % 360 - 180;
      faceAngle += diff;
      faceEl.style.transform = `rotate(${faceAngle}deg)`;
      if (bearing !== null && dialEl) {
        const delta = Math.abs(((bearing - heading + 540) % 360) - 180);
        dialEl.classList.toggle('is-aligned', delta <= 6);
      }
    }
    if (readEl) readEl.textContent = turnText();
  }

  function schedulePaint() {
    if (frame) return;
    frame = window.requestAnimationFrame(paint);
  }

  function build() {
    root.innerHTML = '';
    root.className = 'qibla';

    const dial = document.createElement('div');
    dial.className = 'compass';
    dialEl = dial;

    const face = document.createElement('div');
    face.className = 'cp-face';
    faceEl = face;

    for (let angle = 0; angle < 360; angle += 15) {
      const tick = document.createElement('span');
      tick.className = angle % 90 === 0 ? 'cp-tick is-major' : 'cp-tick';
      tick.style.transform = `rotate(${angle}deg)`;
      tick.appendChild(document.createElement('i'));
      face.appendChild(tick);
    }
    for (const [angle, label] of COMPASS_POINTS) {
      const point = document.createElement('span');
      point.className = 'cp-point';
      point.style.transform = `rotate(${angle}deg)`;
      const text = document.createElement('b');
      text.textContent = label;
      point.appendChild(text);
      face.appendChild(point);
    }
    if (bearing !== null) {
      const needle = document.createElement('div');
      needle.className = 'cp-qibla';
      needle.style.transform = `rotate(${bearing}deg)`;
      needle.innerHTML = '<span class="cp-arrow"></span><span class="cp-kaaba">🕋</span>';
      face.appendChild(needle);
    }
    face.style.transform = `rotate(${faceAngle}deg)`;
    dial.appendChild(face);

    const index = document.createElement('div');
    index.className = 'cp-index';
    dial.appendChild(index);

    const hub = document.createElement('span');
    hub.className = 'cp-hub';
    hub.textContent = '🕋';
    dial.appendChild(hub);

    root.appendChild(dial);

    const read = document.createElement('p');
    read.className = 'qibla-read';
    read.setAttribute('aria-live', 'polite');
    readEl = read;
    root.appendChild(read);

    if (bearing !== null && distance !== null) {
      const info = document.createElement('p');
      info.className = 'hint';
      info.textContent = `${t('qibla.bearing', { deg: Math.round(bearing) })} · ${t('qibla.distance', {
        km: distance.toLocaleString(),
      })}`;
      root.appendChild(info);
    }

    const actions = document.createElement('div');
    actions.className = 'qibla-actions';
    if (!started || status === 'error' || status === 'denied') {
      const start = document.createElement('button');
      start.type = 'button';
      start.className = 'btn primary';
      start.textContent = t('qibla.start');
      start.addEventListener('click', begin);
      actions.appendChild(start);
    }
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = t('qibla.calibrate');
    actions.appendChild(note);
    root.appendChild(actions);

    paint();
  }

  function setBearingFrom(latitude, longitude) {
    bearing = qiblaBearing(latitude, longitude);
    distance = distanceToKaaba(latitude, longitude);
    build();
  }

  /** New raw heading reading: smooth it on the circle (no 359 -> 0 jumps). */
  function accept(raw) {
    if (raw === null || Number.isNaN(raw)) return;
    const s = Math.sin(raw * RAD);
    const c = Math.cos(raw * RAD);
    if (!haveAvg) {
      sinAvg = s;
      cosAvg = c;
      haveAvg = true;
    } else {
      sinAvg += 0.22 * (s - sinAvg);
      cosAvg += 0.22 * (c - cosAvg);
    }
    const next = ((Math.atan2(sinAvg, cosAvg) / RAD) + 360) % 360;
    if (heading !== null && Math.abs(((next - heading + 540) % 360) - 180) < 0.8) return;
    heading = next;
    if (status !== 'live') status = 'live';
    if (message) message = '';
    schedulePaint();
  }

  function listen() {
    if (listening) return;
    listening = true;

    const onAbsolute = (event) => {
      const h = headingOf(event, true);
      if (h === null) return;
      gotAbsolute = true;
      accept(h);
    };
    const onRelative = (event) => {
      // Once a true absolute stream is running, ignore this one.
      if (gotAbsolute) return;
      const h = headingOf(event, false);
      if (h !== null) accept(h);
    };
    window.addEventListener('deviceorientationabsolute', onAbsolute, true);
    window.addEventListener('deviceorientation', onRelative, true);
    stops.push(() => {
      window.removeEventListener('deviceorientationabsolute', onAbsolute, true);
      window.removeEventListener('deviceorientation', onRelative, true);
    });

    // Re-aim the dial when the phone is rotated (screen angle changes).
    const onRotate = () => {
      haveAvg = false;
    };
    window.addEventListener('orientationchange', onRotate);
    stops.push(() => window.removeEventListener('orientationchange', onRotate));

    // Nothing after 1.8 s: try the Generic Sensor API (Chrome Android).
    timer = window.setTimeout(startSensorFallback, 1800);
  }

  async function startSensorFallback() {
    if (heading !== null) return;
    if (typeof window.AbsoluteOrientationSensor === 'function') {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          for (const name of ['accelerometer', 'gyroscope', 'magnetometer']) {
            try {
              const result = await navigator.permissions.query({ name });
              if (result.state === 'denied') throw new Error('denied');
            } catch (error) {
              if (error && error.message === 'denied') throw error;
            }
          }
        }
        const sensor = new window.AbsoluteOrientationSensor({ frequency: 30, referenceFrame: 'screen' });
        sensor.addEventListener('reading', () => {
          if (sensor.quaternion) accept(headingFromQuaternion(sensor.quaternion));
        });
        sensor.addEventListener('error', () => {
          /* handled by the timeout below */
        });
        sensor.start();
        stops.push(() => {
          try {
            sensor.stop();
          } catch (error) {
            /* ignore */
          }
        });
      } catch (error) {
        /* fall through to the message */
      }
    }
    timer = window.setTimeout(() => {
      if (heading === null) {
        status = 'error';
        message = t('qibla.noCompass');
        build();
      }
    }, 3000);
  }

  function locate() {
    const fallback = () => {
      const place = savedPlace();
      if (place) {
        setBearingFrom(place.lat, place.lon);
      } else if (bearing === null) {
        message = t('qibla.noGeo');
        if (heading === null) status = 'error';
        build();
      }
    };
    if (!navigator.geolocation) {
      fallback();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setBearingFrom(position.coords.latitude, position.coords.longitude),
      fallback,
      // Qibla only needs a rough fix: network location is fast and works indoors.
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 600000 }
    );
  }

  async function begin() {
    started = true;
    status = 'waiting';
    message = '';
    haveAvg = false;
    gotAbsolute = false;
    heading = null;
    stop();
    build();

    try {
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        const answer = await DeviceOrientationEvent.requestPermission();
        if (answer !== 'granted') {
          status = 'denied';
          message = t('qibla.denied');
          build();
          // Location can still give the static bearing.
          locate();
          return;
        }
      }
    } catch (error) {
      status = 'denied';
      message = t('qibla.denied');
      build();
      locate();
      return;
    }

    // Compass first, location in parallel — one must never block the other.
    listen();
    locate();
  }

  function stop() {
    for (const fn of stops) {
      try {
        fn();
      } catch (error) {
        /* ignore */
      }
    }
    stops = [];
    listening = false;
    if (timer) window.clearTimeout(timer);
    timer = null;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  }

  // If a place is already saved, show the bearing at once (no tap needed).
  const known = savedPlace();
  if (known) {
    bearing = qiblaBearing(known.lat, known.lon);
    distance = distanceToKaaba(known.lat, known.lon);
  }

  build();
  return {
    refresh() {
      build();
    },
    stop,
  };
}
