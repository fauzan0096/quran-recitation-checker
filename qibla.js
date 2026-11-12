// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
// Qibla direction: location + device compass, with a plain "bearing from north"
// fallback when the phone has no compass.

import { t } from './i18n.js';
import { qiblaBearing, distanceToKaaba } from './hijri.js';

const COMPASS_POINTS = [
  [0, 'N'],
  [90, 'E'],
  [180, 'S'],
  [270, 'W'],
];

function headingOf(event) {
  if (typeof event.webkitCompassHeading === 'number') return event.webkitCompassHeading;
  if (event.absolute === false) return null;
  if (typeof event.alpha !== 'number') return null;
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

  function build() {
    root.innerHTML = '';
    root.className = 'qibla';

    const dial = document.createElement('div');
    dial.className = 'compass';

    const face = document.createElement('div');
    face.className = 'cp-face';

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

    if (heading !== null && bearing !== null) {
      face.style.transform = `rotate(${-heading}deg)`;
      const delta = Math.abs(((bearing - heading + 540) % 360) - 180);
      if (delta <= 6) dial.classList.add('is-aligned');
    }

    root.appendChild(dial);

    const read = document.createElement('p');
    read.className = 'qibla-read';
    if (status === 'live' && bearing !== null && heading !== null) {
      const delta = ((bearing - heading + 540) % 360) - 180;
      read.textContent =
        Math.abs(delta) <= 6
          ? t('qibla.aligned')
          : t('qibla.turn', {
              deg: Math.round(Math.abs(delta)),
              side: t(delta > 0 ? 'qibla.right' : 'qibla.left'),
            });
    } else if (bearing !== null) {
      read.textContent = t('qibla.static', { deg: Math.round(bearing) });
    } else if (message) {
      read.textContent = message;
    } else if (status === 'waiting') {
      read.textContent = t('qibla.waiting');
    } else {
      read.textContent = t('qibla.hint');
    }
    root.appendChild(read);

    if (bearing !== null && distance !== null) {
      const info = document.createElement('p');
      info.className = 'hint';
      info.textContent = `${t('qibla.bearing', { deg: Math.round(bearing) })} · ${t(
        'qibla.distance',
        { km: distance.toLocaleString() }
      )}`;
      root.appendChild(info);
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
          status = 'denied';
          message = t('qibla.denied');
          build();
          return;
        }
      }
    } catch (error) {
      status = 'denied';
      message = t('qibla.denied');
      build();
      return;
    }

    if (!navigator.geolocation) {
      status = 'error';
      message = t('qibla.noGeo');
      build();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        bearing = qiblaBearing(latitude, longitude);
        distance = distanceToKaaba(latitude, longitude);
        status = 'live';
        build();
        listen();
      },
      () => {
        status = 'error';
        message = t('qibla.noGeo');
        build();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  function listen() {
    if (watchStop) return;
    const onChange = (event) => {
      const next = headingOf(event);
      if (next === null) return;
      if (heading !== null && Math.abs(next - heading) < 1) return;
      heading = next;
      status = 'live';
      build();
    };
    window.addEventListener('deviceorientationabsolute', onChange, true);
    window.addEventListener('deviceorientation', onChange, true);
    watchStop = () => {
      window.removeEventListener('deviceorientationabsolute', onChange, true);
      window.removeEventListener('deviceorientation', onChange, true);
    };
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (heading === null) {
        status = 'error';
        message = t('qibla.noCompass');
        build();
      }
    }, 4000);
  }

  function stop() {
    if (watchStop) watchStop();
    watchStop = null;
    if (timer) window.clearTimeout(timer);
    timer = null;
  }

  build();
  return {
    refresh() {
      build();
    },
    stop,
  };
}
