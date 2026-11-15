// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// The phone's place, asked for the way that actually works.
//
//  - The permission is read first: when it has been refused, saying so at once
//    beats a 15-second timeout that ends in "location not found".
//  - A network fix is tried first (fast, no GPS, works indoors), and only then
//    high accuracy. Asking for high accuracy straight away was what made the
//    prayer times sit on "finding your place" and then time out on a phone with
//    no GPS lock or inside a building.
//  - Every failure comes back with a `code` the screens can turn into a real
//    message: denied, unavailable, timeout, unsupported.

const QUICK = { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 };
const PRECISE = { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 };

function codeOf(error) {
  const code = error && error.code;
  if (code === 1) return 'denied';
  if (code === 2) return 'unavailable';
  if (code === 3) return 'timeout';
  return 'failed';
}

function fromPosition(position) {
  const coords = (position && position.coords) || {};
  return {
    lat: coords.latitude,
    lon: coords.longitude,
    accuracy: coords.accuracy,
  };
}

function ask(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function permission() {
  try {
    if (!navigator.permissions || typeof navigator.permissions.query !== 'function') {
      return 'unknown';
    }
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return (status && status.state) || 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

function fail(code, text) {
  const error = new Error(text);
  error.code = code;
  return error;
}

/** { lat, lon, accuracy } or an Error whose `code` says why it failed. */
export async function locate() {
  if (!navigator.geolocation) {
    throw fail('unsupported', 'Geolocation is not available in this browser');
  }

  if ((await permission()) === 'denied') {
    throw fail('denied', 'Geolocation permission is denied');
  }

  try {
    return fromPosition(await ask(QUICK));
  } catch (first) {
    if (codeOf(first) === 'denied') {
      throw fail('denied', 'Geolocation permission is denied');
    }
  }

  try {
    return fromPosition(await ask(PRECISE));
  } catch (second) {
    throw fail(codeOf(second), 'Geolocation failed');
  }
}
