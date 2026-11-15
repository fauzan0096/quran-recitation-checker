// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
// Qibla direction: location + device compass, with a plain "bearing from north"
// fallback when the phone has no compass.

import { t } from './i18n.js';
import { qiblaBearing, distanceToKaaba } from './hijri.js';
import { locate } from './geo.js';
import { location as savedPlace } from './prayer.js';

const COMPASS_POINTS = [
  [0, 'N'],
  [90, 'E'],
  [180, 'S'],
  [270, 'W'],
];

function headingOf(event) {
  // iPhone: the compass heading, already measured clockwise from north.
  if (
    typeof event.webkitCompassHeading === 'number' &&
    Number.isFinite(event.webkitCompassHeading)
  ) {
    return ((event.webkitCompassHeading % 360) + 360) % 360;
  }
  if (typeof event.alpha !== 'number' || !Number.isFinite(event.alpha)) return null;
  // A relative event (absolute === false) is measured from where the phone
  // happened to start, not from north: it cannot point at the Kaaba.
  if (event.absolute === false) return null;
  return (360 - event.alpha + 360) % 360;
}

export function mountQibla(root) {
  if (!root) return { refresh() {}, stop() {} };

  let bearing = null;
  let distance = null;
  let heading = null;
  let watchStop = null;
  let started = false;
  let status = 'idle'; // idle | waiting | live | denied | error
  let message = '';
  let timer = null;
  // The needle is moved by two transforms and one line of text, not by
  // rebuilding the dial. Rebuilding it on every sensor reading is what made the
  // compass feel a step behind the phone.
  let faceEl = null;
  let dialEl = null;
  let readEl = null;
  let infoEl = null;
  let rafId = 0;

  function readText() {
    if (status === 'live' && bearing !== null && heading !== null) {
      const delta = ((bearing - heading + 540) % 360) - 180;
      if (Math.abs(delta) <= 6) return t('qibla.aligned');
      return t('qibla.turn', {
        deg: Math.round(Math.abs(delta)),
        side: t(delta > 0 ? 'qibla.right' : 'qibla.left'),
      });
    }
    if (bearing !== null) {
      const base = t('qibla.static', { deg: Math.round(bearing) });
      return message ? `${base} · ${message}` : base;
    }
    if (message) return message;
    if (status === 'waiting') return t('qibla.waiting');
    return t('qibla.hint');
  }

  function paint() {
    if (heading !== null && bearing !== null) {
      if (faceEl) faceEl.style.transform = `rotate(${-heading}deg)`;
      const delta = Math.abs(((bearing - heading + 540) % 360) - 180);
      if (dialEl) dialEl.classList.toggle('is-aligned', delta <= 6);
    }
    if (readEl) readEl.textContent = readText();
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
    readEl = read;
    root.appendChild(read);

    infoEl = document.createElement('p');
    infoEl.className = 'hint';
    infoEl.hidden = true;
    root.appendChild(infoEl);
    if (bearing !== null && distance !== null) {
      infoEl.hidden = false;
      infoEl.textContent = `${t('qibla.bearing', { deg: Math.round(bearing) })} · ${t(
        'qibla.distance',
        { km: distance.toLocaleString() }
      )}`;
    }

    const actions = document.createElement('div');
    actions.className = 'qibla-actions';
    if (!started) {
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

  async function begin() {
    started = true;
    status = 'waiting';
    message = '';
    build();

    try {
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        const answer = await DeviceOrientationEvent.requestPermission();
        if (answer !== 'granted') {
          started = false;
          status = 'denied';
          message = t('qibla.denied');
          build();
          return;
        }
      }
    } catch (error) {
      started = false;
      status = 'denied';
      message = t('qibla.denied');
      build();
      return;
    }

    // The compass is started before the place is worked out, so it keeps
    // listening while a GPS fix is being waited for.
    listen();

    try {
      // A place the person already set (a city, or latitude/longitude) needs no
      // permission at all — that is what makes the Qibla work on a phone whose
      // location is refused.
      const saved = savedPlace();
      const spot = saved.lat && saved.lon ? saved : await locate();
      bearing = qiblaBearing(spot.lat, spot.lon);
      distance = distanceToKaaba(spot.lat, spot.lon);
      status = 'live';
      message = '';
      build();
      // The place is known: if the compass has still said nothing, tell the
      // person plainly instead of leaving the needle frozen.
      if (heading === null) {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (heading !== null) return;
          message = t('qibla.noCompass');
          build();
        }, 6000);
      }
    } catch (error) {
      started = false;
      status = 'error';
      const denied = (error && error.code) === 'denied';
      message = `${t(denied ? 'qibla.denied' : 'qibla.noGeo')} ${t('qibla.setPlace')}`;
      build();
    }
  }

  function listen() {
    if (watchStop) return;
    const onChange = (event) => {
      const next = headingOf(event);
      if (next === null) return;

      if (heading === null) {
        heading = next;
      } else {
        // A light smoothing: the needle follows the phone instead of jumping on
        // every sensor jitter, which is what made it look "laggy" before.
        const diff = ((next - heading + 540) % 360) - 180;
        if (Math.abs(diff) < 0.4) return;
        heading = (heading + diff * 0.28 + 360) % 360;
      }

      if (status !== 'live') {
        status = 'live';
        build();
        return;
      }
      if (!faceEl) {
        build();
        return;
      }
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        paint();
      });
    };
    window.addEventListener('deviceorientationabsolute', onChange, true);
    window.addEventListener('deviceorientation', onChange, true);
    watchStop = () => {
      window.removeEventListener('deviceorientationabsolute', onChange, true);
      window.removeEventListener('deviceorientation', onChange, true);
    };
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      // Only worth saying once the place is known: before that the phone is
      // still waiting for a fix, not for a compass.
      if (heading !== null || bearing === null) return;
      status = 'live';
      message = t('qibla.noCompass');
      build();
    }, 6000);
  }

  function stop() {
    if (watchStop) watchStop();
    watchStop = null;
    if (timer) window.clearTimeout(timer);
    timer = null;
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  build();
  return {
    refresh() {
      build();
    },
    stop,
  };
}
