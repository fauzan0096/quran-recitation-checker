// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Use of this file is
// governed by the LICENSE in the project root.

// A tally of how often the checker's verdict matched what the reciter knows to
// be true. "Sahi tha" / "Galat tha" after a result; the totals are shown in
// Settings as a measured accuracy instead of a guess. Nothing leaves the phone.

const KEY = 'tc.accuracy';

export function stats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (parsed && typeof parsed === 'object') {
      return {
        total: Number(parsed.total) || 0,
        ok: Number(parsed.ok) || 0,
        bad: Number(parsed.bad) || 0,
        at: Number(parsed.at) || 0,
      };
    }
  } catch (error) {
    /* private mode */
  }
  return { total: 0, ok: 0, bad: 0, at: 0 };
}

function save(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (error) {
    /* private mode */
  }
  return next;
}

/** `right` = the result the app gave was the correct one. */
export function record(right) {
  const now = stats();
  const next = {
    total: now.total + 1,
    ok: now.ok + (right ? 1 : 0),
    bad: now.bad + (right ? 0 : 1),
    at: Date.now(),
  };
  save(next);
  return next;
}

/** 0–100, or null until at least one result has been rated. */
export function percent(now) {
  const data = now || stats();
  if (!data.total) return null;
  return Math.round((data.ok / data.total) * 100);
}

export function reset() {
  save({ total: 0, ok: 0, bad: 0, at: 0 });
  return stats();
}
