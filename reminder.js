// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Daily reminder — one notification a day, at the time the person chose, about
// what is still to be recited (Murajaa ayaat when there are any).
//
// A page cannot wake itself up when it is closed, so the check runs while the
// app is open and the moment it is opened: if the chosen time has passed and
// nothing was sent today, one notification goes out. That is honest and works
// in every browser; a real background push needs a server, which this app
// deliberately does not have.

import { t } from './i18n.js';
import { dueCount } from './murajaa.js';
import { isPremium } from './premium.js';
import { enable as pushEnable, disable as pushDisable } from './push.js';

const KEY = 'tc.reminder';
const DEFAULT_TIME = '20:00';

function dayKey(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      return { on: false, time: DEFAULT_TIME, day: '', push: false, ...raw };
    }
  } catch (error) {
    /* private mode */
  }
  return { on: false, time: DEFAULT_TIME, day: '', push: false };
}

function save(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (error) {
    /* private mode */
  }
}

export function state() {
  return load();
}

function bodyText() {
  const due = isPremium() ? dueCount() : 0;
  return due > 0 ? t('remind.bodyDue', { n: due }) : t('remind.body');
}

async function notify(title, body) {
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    const reg = navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.showNotification) {
      await reg.showNotification(title, {
        body,
        icon: 'icon-192.png',
        badge: 'icon-96.png',
        tag: 'bayyin-daily',
        data: { url: './?go=daily' },
      });
      return true;
    }
    // eslint-disable-next-line no-new
    new Notification(title, { body });
    return true;
  } catch (error) {
    return false;
  }
}

/** Ask for permission; returns "granted", "denied", "default" or "unsupported". */
export async function ask() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch (error) {
    return 'denied';
  }
}

export function setOn(on) {
  save({ ...load(), on: Boolean(on) });
}

export function setTime(time) {
  save({ ...load(), time: time || DEFAULT_TIME });
}

/** Fire today's reminder if its time has come and it has not gone yet. */
export async function check() {
  const s = load();
  if (!s.on) return;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (hhmm < (s.time || DEFAULT_TIME)) return;
  const today = dayKey(now);
  if (s.day === today) return;
  if (await notify(t('remind.title'), bodyText())) save({ ...s, day: today });
}

export function start() {
  check();
  window.setInterval(check, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}

/** The Settings card: on/off, the time and a test button. */
export function mountCard(root) {
  if (!root) return { refresh() {} };

  function build() {
    root.innerHTML = '';
    const s = load();

    const row = document.createElement('div');
    row.className = 'remind-row';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = `btn small ${s.on ? 'ghost' : 'primary'}`;
    toggle.textContent = s.on ? t('remind.on') : t('remind.off');
    toggle.addEventListener('click', async () => {
      const note = document.getElementById('remind-note');

      if (load().on) {
        setOn(false);
        save({ ...load(), push: false });
        pushDisable().catch(() => {});
        build();
        return;
      }

      const permission = await ask();
      if (permission !== 'granted') {
        if (note) note.textContent = t('remind.denied');
        return;
      }

      setOn(true);
      const result = await pushEnable(load().time || DEFAULT_TIME, t('remind.body')).catch(() => ({
        ok: false,
      }));
      save({ ...load(), push: Boolean(result && result.ok) });
      build();
    });

    const time = document.createElement('input');
    time.type = 'time';
    time.className = 'remind-time';
    time.value = s.time || DEFAULT_TIME;
    time.setAttribute('aria-label', t('remind.time'));
    time.addEventListener('change', () => {
      setTime(time.value);
      if (load().on) {
        pushEnable(time.value || DEFAULT_TIME, t('remind.body')).catch(() => {});
      }
      build();
    });

    row.append(toggle, time);
    root.appendChild(row);

    const note = document.createElement('p');
    note.className = 'hint';
    note.id = 'remind-note';
    note.textContent = s.on ? t('remind.onHint', { time: s.time }) : t('remind.offHint');
    root.appendChild(note);
  }

  build();
  return { refresh: build };
}
