// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Bayyin (بيّن) — Quran reader with recitation checking.
//
// Surah tab: every aya its own card with a Record button.
// Mushaf tab: a whole page as one continuous mushaf (Madani 604 pages from
// bundled Tanzil text, IndoPak 610 pages from Quran.com), one Record button
// for the page plus tap-to-select a single aya.
// Search tab: find by word, by aya (2:255) or by juz (5).

import { SURAHS, surahName } from './surahs.js';
import {
  loadQuran,
  isLoaded,
  ayaCount,
  getVerses,
  splitBasmala,
  INDOPAK_BASMALA,
} from './quran.js';
import { loadPages, juzAyahs, juzOfAya } from './quran-pages.js';
import { MADANI_PAGE_TOTAL, madaniPageAyahs, madaniPageLines } from './madani-layout.js';
import { indopakPage, indopakPageLines, INDOPAK_PAGES } from './indopak.js';
import { alignWords, WORD_STATUS } from './align.js';
import { tajweedHints } from './tajweed.js';
import { normalizeArabic } from './normalize.js';
import {
  MODELS,
  loadModel,
  transcribe,
  decodeToMono16k,
  startRecording,
  micSupport,
  micPermissionState,
  peakOf,
  libraryVersion,
} from './asr.js';
import './strings-v2.js';
import './premium-strings.js';
import './extra-strings.js';
import { mountPrayer } from './prayer.js';
import {
  available as billingAvailable,
  buy as billingBuy,
  manage as billingManage,
  manageAvailable as billingManageAvailable,
  refreshPrices as billingRefreshPrices,
  restore as billingRestore,
} from './billing.js';
import { download as backupDownload, restore as backupRestore, share as backupShare } from './backup.js';
import { mountBadges, checkBadges, celebrate } from './badges.js';
import {
  reciters,
  current as currentQari,
  setReciter,
  repeatCount,
  setRepeatCount,
  play as playQari,
  toggle as toggleQari,
  isPlaying as isQariPlaying,
  stop as stopQari,
} from './qari.js';
import { mountCard as mountReminderCard, start as startDailyReminder, state as reminderState } from './reminder.js';
import { enable as pushEnable, disable as pushDisable } from './push.js';
import { record as recordAccuracy, stats as accuracyStats, reset as resetAccuracy, percent as accuracyPercent } from './accuracy.js';
import { playWord } from './word-audio.js';
import {
  list as adhanList,
  current as currentAdhan,
  setId as setAdhanId,
  state as adhanState,
  setOn as setAdhanOn,
  play as playAdhan,
  stop as stopAdhan,
  check as checkAdhan,
  prime as primeAdhan,
  unlock as unlockAdhan,
  arm as armAdhan,
  disarm as disarmAdhan,
  saveLocalFile as saveAdhanFile,
  clearLocalFile as clearAdhanFile,
  hasLocalFile as hasAdhanFile,
} from './adhan.js';
import { location as prayerLocation } from './prayer.js';
import { mountMurajaa, dueCount, updateFromCheck } from './murajaa.js';
import { mountTasbeeh } from './tasbeeh-v2.js';
import { mountReport, recordReport } from './premium-tools.js';
import { mountDuas } from './duas.js';
import { mountHifz, mountKhatam, pendingToday, startReminderLoop } from './planners.js';
import { mountHifzTest } from './hifz-test.js';
import { hijriArabic, todayHijri } from './hijri.js';
import { mountQibla } from './qibla.js';
import { mountCalendar } from './calendar.js';
import { mountDaily } from './daily.js';
import { LANGUAGES, initLanguage, getLanguage, setLanguage, t } from './i18n.js';
import {
  DEMO_UI,
  PLANS,
  activate as activatePlan,
  canCheck,
  cancel as cancelPlan,
  isPlayBuild,
  isPremium,
  premiumState,
  recordCheck,
  regionName,
  resetDemo,
  skipTrial,
} from './premium.js';
import { makeGiftCode, redeemGift } from './gift.js';
import {
  clearAll,
  cycleMark,
  isStarred,
  listOf,
  markOf,
  resumeKey,
  scoreOf,
  setResume,
  setScore,
  stats,
  toggleStar,
} from './progress.js';

const STORAGE = {
  selection: 'tc.selection',
  model: 'tc.modelId',
  modelReady: 'tc.modelReady', // id of a model that finished loading once on this device
  reading: 'tc.reading',
  speed: 'tc.speed',
  welcomed: 'tc.welcomed',
};
const CHUNK = 25;
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const SIZE_MIN = 18;
const SIZE_MAX = 44;

const state = {
  mode: 'surah', // surah | page | search
  mushaf: 'madani', // madani | indopak
  mushafFull: true, // the mushaf tab opens as one full page, like a printed mus'haf
  surah: 1,
  page: 1,
  indopakLens: null, // words per printed line of the IndoPak page, when known
  turn: '', // 'fwd' | 'back' while a page turn is being drawn
  verses: [],
  visible: CHUNK,
  results: new Map(),
  pageAlignment: null,
  selectedKey: null,
  theme: 'light',
  fontSize: 26,
  model: null,
  modelId: null,
  modelLoading: false,
  recorder: null,
  recording: null, // { id, keys }
  recordingStarted: 0,
  timer: null,
  levelState: '',
  busyId: null,
  micChecking: false,
  recordings: new Map(), // aya key -> object URL of the person's own recording
};

const els = {};
const ERROR_KEY = 'tc.errors';

function readErrors() {
  try {
    const raw = JSON.parse(localStorage.getItem(ERROR_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (error) {
    return [];
  }
}

function logError(message) {
  const list = readErrors();
  list.push(`${new Date().toISOString()} ${message}`);
  try {
    localStorage.setItem(ERROR_KEY, JSON.stringify(list.slice(-20)));
  } catch (error) {
    /* private mode */
  }
}

function paintErrors() {
  if (!els.errorLog) return;
  const list = readErrors();
  els.errorLog.textContent = list.length ? list.join('\n') : t('errors.none');
}

/** After a check or a ✓ mark, tell the person about a badge just earned. */
function announceBadges() {
  const fresh = checkBadges();
  if (!fresh.length) return;
  celebrate(fresh);
  if (els.viewBadges && !els.viewBadges.hidden) moreViews.badges?.refresh();
}

/** The little count on the More grid's Murajaa card (Premium, so free users never see it). */
function paintMurajaaCount() {
  if (!els.moreMurajaaCount) return;
  const n = isPremium() ? dueCount() : 0;
  els.moreMurajaaCount.textContent = String(n);
  els.moreMurajaaCount.hidden = n === 0;
}
let toastTimer = null;
const bootAt = Date.now();
let splashGone = false;
let currentView = 'home';
let quranReady = null;
const moreViews = {
  daily: null,
  homeNoor: null,
  tasbeeh: null,
  qibla: null,
  calendar: null,
  duas: null,
  khatam: null,
  hifz: null,
  hztest: null,
  report: null,
  prayer: null,
  badges: null,
  murajaa: null,
};

async function init() {
  cacheElements();
  initLanguage();

  // A Play build has no in-app trial any more (there the trial is Play's own
  // free-trial offer), so the comparison chart must not promise one.
  if (isPlayBuild()) {
    const trialNote = document.getElementById('chart-trial');
    if (trialNote) trialNote.hidden = true;
  }
  fillLanguages();
  fillSurahs();
  fillModels();
  fillQaris();
  fillAdhans();
  mountReminderCardUI();
  restoreSelection();
  wireEvents();
  setGlobalStatus('');

  window.addEventListener('error', (event) => {
    logError(`${event.message} @ ${event.filename || '?'}:${event.lineno || 0}`);
  });
  window.addEventListener('unhandledrejection', (event) => {
    logError(String(event.reason || 'unhandled rejection'));
  });

  // Quran is the app's first page. Roz ki Naiki opens over it on every launch,
  // so Back simply closes it and the reader is waiting behind.
  paintHomeDate();
  const params = new URLSearchParams(window.location.search);
  const go = params.get('go');
  setView('reader');
  if (go) setView(go);
  else if (!params.get('adhan')) setView('daily');

  // A prayer notification opens the app with ?adhan=fajr: the person tapped it,
  // so the sound is allowed and the azaan starts straight away.
  const wantAdhan = params.get('adhan');
  if (wantAdhan) {
    setView('prayer');
    window.setTimeout(() => {
      playAdhan().then((ok) => {
        if (!ok) toast(t('adhan.failed'));
      });
    }, 500);
  }

  // Browsers only allow sound after one touch: open that door on the first one.
  const unlockOnce = () => {
    unlockAdhan();
    window.removeEventListener('pointerdown', unlockOnce);
    window.removeEventListener('keydown', unlockOnce);
  };
  window.addEventListener('pointerdown', unlockOnce, { passive: true });
  window.addEventListener('keydown', unlockOnce);

  // Tapping the prayer notification sends this message from the service worker.
  // It plays the azaan even when the app was already open (navigate() is often
  // refused in an installed app, and then nothing used to play).
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data || {};
      if (data.type !== 'ADHAN') return;
      // When the app is open (even in the background) the push itself starts
      // the azaan — no tap. The screen is only switched when it is visible.
      if (!document.hidden) setView('namaz');
      playAdhan().then((ok) => {
        if (!ok) toast(t('adhan.failed'));
      });
    });
  }

  hideSplash();
  maybeWelcome();
  watchBackSwipe();
  loadQuranInBackground();
  startReminderLoop();
  startDailyReminder();
  handleLaunch();
  autoLoadModel();
  syncSubscription();
  watchForUpdate();
}

/**
 * A new service worker means new code on the phone. Take it once, quietly, so a
 * fix is not stuck behind whatever the old worker had cached.
 */
let updateReloaded = false;

function watchForUpdate() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The very first install also "changes" the controller: that is not an
    // update and must not reload the page.
    if (!hadController || updateReloaded) return;
    if (state.recording) return;
    updateReloaded = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .getRegistration()
    .then((registration) => registration && registration.update())
    .catch(() => {
      /* offline: try again next launch */
    });
}

/**
 * A Play build: ask the store once at launch so a renewed (or lapsed)
 * subscription is picked up without the person opening the paywall.
 */
function syncSubscription() {
  if (!billingAvailable()) return;
  billingRestore()
    .then(() => {
      // The card and the paywall follow whatever Play reported, including a
      // subscription that lapsed and a price Play has changed since.
      renderPremiumCard();
      paintPremiumTabs();
      if (els.viewPremium && !els.viewPremium.hidden) renderPremium();
    })
    .catch(() => {
      /* the paywall's Restore button is still there */
    });
}

/** Share target, web+bayyin: links and opened files all end in the Search tab. */
async function openSearchWith(query) {
  const text = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!text) return;
  setView('reader');
  setMode('search');
  els.searchInput.value = text;
  try {
    await loadQuranInBackground();
  } catch (error) {
    /* the search below reports it */
  }
  runSearch();
}

function handleLaunch() {
  const params = new URLSearchParams(window.location.search);
  const screens = ['dua', 'tasbeeh', 'daily', 'reader', 'qibla', 'calendar', 'prayer'];
  let query = params.get('q') || params.get('text') || params.get('url') || params.get('title') || '';

  const protocol = params.get('protocol');
  if (protocol) {
    const value = protocol.replace(/^web\+bayyin:\/*/i, '').trim();
    if (screens.includes(value)) setView(value);
    else query = value;
  }
  if (query) openSearchWith(query);

  // File handler: a .txt file opened with the app searches its first line.
  if ('launchQueue' in window && window.launchQueue) {
    window.launchQueue.setConsumer(async (launchParams) => {
      if (!launchParams.files || !launchParams.files.length) return;
      try {
        const file = await launchParams.files[0].getFile();
        const first = (await file.text()).split(/\r?\n/).find((line) => line.trim());
        if (first) openSearchWith(first);
      } catch (error) {
        /* unreadable file: ignore */
      }
    });
  }
}

/** Quran text + page data load after first paint; the reader fills in when they arrive. */
function loadQuranInBackground() {
  if (quranReady) return quranReady;
  quranReady = (async () => {
    try {
      await loadQuran();
    } catch (error) {
      showError(t('error.quranLoad'));
      return;
    }
    try {
      await loadPages();
    } catch (error) {
      console.warn('page data failed', error);
    }
    updatePageTotal();
    await showList();
    moreViews.daily?.refresh();
    moreViews.homeNoor?.refresh();
  })();
  return quranReady;
}

/** Gregorian + Hijri date line on the home banner. */
function paintHomeDate() {
  if (!els.homeDate) return;
  const english = new Date().toLocaleDateString(getLanguage() === 'ur' ? 'ur-PK-u-nu-latn' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  els.homeDate.textContent = '';
  const line1 = document.createElement('span');
  line1.className = 'date-en';
  line1.textContent = english;
  const line2 = document.createElement('span');
  line2.className = 'date-ar';
  line2.lang = 'ar';
  line2.dir = 'rtl';
  try {
    line2.textContent = hijriArabic(todayHijri());
  } catch (error) {
    /* optional */
  }
  els.homeDate.append(line1, line2);
}

// ---------------------------------------------------------------- boot UIs

/** Fade the logo splash away — but never so fast that it just flashes. */
function hideSplash() {
  const splash = els.splash || document.getElementById('splash');
  if (splashGone || !splash) {
    splashGone = true;
    return;
  }
  splashGone = true;
  const wait = Math.max(0, 350 - (Date.now() - bootAt));
  window.setTimeout(() => {
    splash.classList.add('is-gone');
    window.setTimeout(() => splash.remove(), 420);
  }, wait);
}

/** Very first visit: one short welcome screen, in the language they pick. */
function maybeWelcome() {
  const welcome = els.welcome;
  if (!welcome) return;
  let seen = '1'; // private mode: don't nag on every open
  try {
    seen = localStorage.getItem(STORAGE.welcomed) || '';
  } catch (error) {
    seen = '1';
  }
  if (seen === '1') return;
  welcome.hidden = false;
  document.body.classList.add('has-overlay');
}

function closeWelcome() {
  if (!els.welcome) return;
  els.welcome.hidden = true;
  document.body.classList.remove('has-overlay');
  try {
    localStorage.setItem(STORAGE.welcomed, '1');
  } catch (error) {
    /* private mode */
  }
}

/** Switch language and redraw whatever is on screen. */
async function changeLanguage(value) {
  setLanguage(value);
  applyReading(false);
  renderTajweed();
  renderProgress();
  renderPremiumCard();
  if (els.viewPremium && !els.viewPremium.hidden) renderPremium();
  paintHomeDate();
  moreViews.daily?.refresh();
  moreViews.homeNoor?.refresh();
  moreViews.tasbeeh?.refresh();
  moreViews.calendar?.refresh();
  moreViews.qibla?.refresh();
  moreViews.duas?.refresh();
  if (!isLoaded()) return;
  if (state.mode === 'search') {
    els.listTitle.textContent = t('list.searchTitle');
    return;
  }
  await showList();
}

function cacheElements() {
  const ids = [
    'open-settings', 'close-settings', 'view-reader', 'view-settings',
    'toggle-theme', 'font-smaller', 'font-larger',
    'reading-meta',
    'tab-surah', 'tab-page', 'tab-search',
    'picker-surah', 'picker-page', 'picker-search',
    'surah-select', 'mushaf-select', 'page-prev', 'page-next', 'page-number', 'page-total',
    'search-input', 'search-go', 'search-results',
    'list-title', 'global-status', 'range-error', 'aya-list', 'qari-all',
    'list-footer', 'load-more', 'share-app', 'model-select', 'load-model',
    'remind-root', 'qari-select', 'qari-repeat', 'adhan-select', 'adhan-toggle', 'adhan-test', 'adhan-credit',
    'adhan-file', 'adhan-file-clear', 'adhan-local-status',
    'model-progress', 'model-progress-bar', 'model-status', 'audio-file',
    'accurate-mode',
    'mic-check', 'mic-check-output', 'player', 'tajweed',
    'toast',
    'splash', 'welcome', 'welcome-start', 'welcome-lang', 'lang-select',
    'resume-aya', 'progress-stats', 'progress-lists', 'progress-reset',
    'view-home', 'more-tasbeeh', 'more-calendar',
    'home-mushaf', 'home-open-quran', 'home-todo', 'home-daily-all',
    'more-khatam', 'more-premium', 'view-more',
    'view-khatam', 'khatam-root', 'close-khatam',
    'hifz-root', 'hztest-root', 'murajaa-root', 'report-root', 'open-report',
    'more-badges', 'view-badges', 'badges-root', 'close-badges',
    'more-murajaa-count',
    'backup-export', 'backup-import', 'backup-file', 'backup-share', 'error-log', 'errors-copy',
    'view-premium', 'close-premium', 'premium-root', 'open-premium', 'premium-status',
    'accuracy-root',
    'premium-chart', 'premium-tabs', 'premium-plan', 'premium-test',
    'premium-murajaa', 'premium-report',
    'view-namaz', 'namaz-tabs', 'namaz-times', 'namaz-qibla', 'namaz-adhan',
    'prayer-root', 'qibla-root',
    'home-date', 'home-noor', 'view-dua', 'close-dua', 'dua-root', 'bottom-nav',
    'more-daily', 'view-daily', 'close-daily', 'daily-root',
    'more-dua', 'more-settings',
    'view-tasbeeh', 'close-tasbeeh', 'tasbeeh-root',
    'view-calendar', 'close-calendar', 'calendar-root',
    'more-settings',
  ];
  for (const id of ids) {
    const name = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    els[name] = document.getElementById(id);
  }
}

// ------------------------------------------------------------------ setup

function fillLanguages() {
  for (const select of [els.welcomeLang, els.langSelect]) {
    if (!select) continue;
    select.innerHTML = '';
    for (const language of LANGUAGES) {
      const option = document.createElement('option');
      option.value = language.id;
      option.textContent = language.label;
      select.appendChild(option);
    }
    select.value = getLanguage();
  }
}

function fillSurahs() {
  els.surahSelect.innerHTML = '';
  for (const surah of SURAHS) {
    const option = document.createElement('option');
    option.value = String(surah.n);
    option.textContent = `${surah.n}. ${surah.latin} — ${surah.arabic}`;
    els.surahSelect.appendChild(option);
  }
  els.surahSelect.value = '1';
}

function fillModels() {
  els.modelSelect.innerHTML = '';
  for (const model of MODELS) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.label;
    els.modelSelect.appendChild(option);
  }
  els.modelSelect.value = MODELS[0].id;
}

/** The reciter list for the "Qari ki tilawat" setting. */
function fillQaris() {  if (!els.qariSelect) return;
  els.qariSelect.textContent = '';
  for (const item of reciters()) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    els.qariSelect.appendChild(option);
  }
  els.qariSelect.value = currentQari();
  els.qariSelect.addEventListener('change', () => setReciter(els.qariSelect.value));

  if (els.qariRepeat) {
    els.qariRepeat.value = String(repeatCount());
    els.qariRepeat.addEventListener('change', () => setRepeatCount(Number(els.qariRepeat.value)));
  }
}

/** The daily reminder card lives in Settings. */
function mountReminderCardUI() {
  if (els.remindRoot) mountReminderCard(els.remindRoot);
}

/** Azaan: the app's own recording (or the person's own file), on or off. */
function fillAdhans() {
  // The muazzin picker is gone with the borrowed recordings; if one is ever put
  // back, this keeps working.
  if (els.adhanSelect) {
    const items = adhanList();
    const ids = items.map((item) => item.id);
    els.adhanSelect.textContent = '';
    for (const item of items) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      els.adhanSelect.appendChild(option);
    }
    els.adhanSelect.value = ids.includes(adhanState().id)
      ? adhanState().id
      : ids[0] || 'own';
    els.adhanSelect.addEventListener('change', () => {
      setAdhanId(els.adhanSelect.value);
      paintAdhan();
      armAdhanNow();
    });
    if (ids.length < 2) {
      const field = els.adhanSelect.closest('.field, .pl-row');
      if (field) field.hidden = true;
    }
  }

  if (els.adhanToggle) {
    els.adhanToggle.addEventListener('click', () => {
      setAdhanOn(!adhanState().on);
      syncPushFromToggles();
      paintAdhan();
      armAdhanNow();
      const loc = prayerLocation();
      if (adhanState().on && (!loc.lat || !loc.lon)) toast(t('prayer.needPlace'));
    });
  }
  if (els.adhanTest) {
    els.adhanTest.addEventListener('click', async () => {
      primeAdhan();
      const ok = await playAdhan();
      if (!els.adhanCredit) return;
      if (ok) {
        els.adhanCredit.textContent = currentAdhan().credit || '';
        return;
      }
      const own = await hasAdhanFile().catch(() => false);
      els.adhanCredit.textContent = own ? t('adhan.failed') : t('adhan.noFile');
    });
  }

  if (els.adhanFile) {
    els.adhanFile.addEventListener('change', async () => {
      const file = els.adhanFile.files && els.adhanFile.files[0];
      els.adhanFile.value = '';
      if (!file) return;
      try {
        await saveAdhanFile(file);
        toast(t('adhan.localSet'));
      } catch (error) {
        toast(t('adhan.failed'));
      }
      paintAdhan();
    });
  }
  if (els.adhanFileClear) {
    els.adhanFileClear.addEventListener('click', async () => {
      await clearAdhanFile().catch(() => {});
      paintAdhan();
    });
  }

  paintAdhan();
  primeAdhan();
  armAdhanNow();

  // Catch-up: if the phone slept through the exact second, the azaan still
  // plays within the first quarter of an hour. The exact timing comes from the
  // timer `armAdhan` sets, not from this poll.
  window.setInterval(tickAdhan, 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tickAdhan();
  });
}

/** The location + settings the azaan timer was last armed for. */
let adhanArmKey = '';

function tickAdhan() {
  const loc = prayerLocation();
  if (!loc.lat || !loc.lon) return;
  checkAdhan(loc.lat, loc.lon, loc.hanafi);
  armAdhanNow();
}

/** Arm the exact-second timer once per location/muazzin change. */
function armAdhanNow() {
  const loc = prayerLocation();
  const settings = adhanState();
  const key = `${loc.lat}|${loc.lon}|${loc.hanafi}|${settings.on}|${settings.id}`;
  const before = adhanArmKey;
  if (key === before) return;
  adhanArmKey = key;

  if (!loc.lat || !loc.lon || !settings.on) {
    disarmAdhan();
  } else {
    armAdhan(loc.lat, loc.lon, loc.hanafi);
  }

  // A new place means new prayer times: tell the Worker without asking for
  // anything, so the closed-app notifications follow the person.
  if (
    before &&
    typeof Notification !== 'undefined' &&
    (settings.on || reminderState().on) &&
    Notification.permission === 'granted'
  ) {
    syncPushFromToggles(false);
  }
}

/**
 * One push subscription serves both the azaan and the daily reminder, so the
 * azaan keeps arriving when the app is closed and the two switches do not undo
 * each other. It is dropped only when both are off.
 */
async function syncPushFromToggles(requestPermission = true) {
  const adhan = adhanState().on;
  const reminder = reminderState();
  if (!adhan && !reminder.on) {
    pushDisable().catch(() => {});
    return;
  }
  if (typeof Notification === 'undefined') return;

  if (Notification.permission !== 'granted') {
    if (!requestPermission) return;
    const granted = await Notification.requestPermission().catch(() => 'denied');
    if (granted !== 'granted') return;
  }

  pushEnable(reminder.time || '20:00', t('remind.body'), { daily: reminder.on }).catch(() => {});
}

function paintAdhan() {
  const on = adhanState().on;
  if (els.adhanToggle) {
    els.adhanToggle.textContent = on ? t('adhan.on') : t('adhan.off');
    els.adhanToggle.className = `btn small ${on ? 'ghost' : 'primary'}`;
  }
  if (els.adhanCredit) els.adhanCredit.textContent = currentAdhan().credit;

  hasAdhanFile()
    .then((has) => {
      if (els.adhanLocalStatus) els.adhanLocalStatus.textContent = has ? t('adhan.localSet') : '';
      if (els.adhanFileClear) els.adhanFileClear.hidden = !has;
    })
    .catch(() => {});
}

/** One qari button at the top of the reader plays the whole list, aya by aya. */
let qariQueue = null;

function paintQariAll() {
  if (!els.qariAll) return;
  const on = Boolean(qariQueue);
  els.qariAll.textContent = on ? t('qari.stopAll') : t('qari.playAll');
  els.qariAll.classList.toggle('is-on', on);
}

function stopAyaAudio() {
  qariQueue = null;
  stopQari();
  stopMyAudio();
  paintQariAll();
}

/**
 * ▶ Qari: from the aya on screen to the end of its surah, one aya after another.
 * The audio keeps going when the app goes to the background (qari.js holds one
 * media session), and the lock-screen next/previous buttons walk the surah too.
 */
function playAll() {
  if (qariQueue) {
    stopAyaAudio();
    return;
  }
  const first = state.verses[0];
  if (!first) return;

  const times = repeatCount();
  const surah = first.surah;
  const total = Math.max(first.aya, ayaCount(surah) || first.aya);

  const list = [];
  for (let aya = first.aya; aya <= total; aya += 1) {
    for (let r = 0; r < times; r += 1) list.push([surah, aya]);
  }
  if (!list.length) return;

  qariQueue = { list, index: 0 };
  paintQariAll();

  const next = () => {
    if (!qariQueue) return;
    if (qariQueue.index >= qariQueue.list.length) {
      stopAyaAudio();
      return;
    }
    const [s, a] = qariQueue.list[qariQueue.index];
    qariQueue.index += 1;
    playQari(s, a, {
      onEnd: next,
      onError: next,
      onNext: () => {
        if (!qariQueue) return;
        qariQueue.index = Math.min(qariQueue.index + 1, qariQueue.list.length);
        next();
      },
      onPrev: () => {
        if (!qariQueue) return;
        qariQueue.index = Math.max(0, qariQueue.index - times - 1);
        next();
      },
    });
  };

  next();
}

function restoreSelection() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE.selection) || 'null');
    if (stored) {
      if (['surah', 'page'].includes(stored.mode)) state.mode = stored.mode;
      if (stored.mushaf === 'indopak' || stored.mushaf === 'madani') state.mushaf = stored.mushaf;
      if (Number.isInteger(stored.surah)) state.surah = clamp(stored.surah, 1, 114);
      if (Number.isInteger(stored.page)) state.page = clamp(stored.page, 1, 610);
    }
    const modelId = localStorage.getItem(STORAGE.model);

    if (modelId && MODELS.some((m) => m.id === modelId)) els.modelSelect.value = modelId;
    if (els.accurateMode) els.accurateMode.checked = localStorage.getItem(STORAGE.speed) === 'accurate';
  } catch (error) {
    console.warn('selection restore failed', error);
  }

  els.surahSelect.value = String(state.surah);
  els.mushafSelect.value = state.mushaf;
  els.pageNumber.value = String(state.page);

  try {
    const reading = JSON.parse(localStorage.getItem(STORAGE.reading) || 'null');
    if (reading) {
      if (reading.theme === 'dark' || reading.theme === 'light') state.theme = reading.theme;
      if (Number.isFinite(reading.fontSize)) {
        state.fontSize = Math.min(SIZE_MAX, Math.max(SIZE_MIN, reading.fontSize));
      }
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      state.theme = 'dark';
    }
  } catch (error) {
    console.warn('reading prefs restore failed', error);
  }
  applyReading();
  applyMode();
}

function persistSelection() {
  try {
    localStorage.setItem(
      STORAGE.selection,
      JSON.stringify({
        mode: state.mode,
        mushaf: state.mushaf,
        surah: state.surah,
        page: state.page,
      })
    );
  } catch (error) {
    console.warn('selection persist failed', error);
  }
}

function clamp(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function applyReading(persist = true) {
  document.body.dataset.theme = state.theme;
  document.documentElement.style.setProperty('--aya-size', `${state.fontSize}px`);
  if (els.toggleTheme) {
    els.toggleTheme.textContent = state.theme === 'dark' ? '☀' : '🌙';
    els.toggleTheme.setAttribute('aria-pressed', String(state.theme === 'dark'));
  }
  if (els.readingMeta) {
    els.readingMeta.textContent = `${state.fontSize}px`;
  }
  if (persist) {
    try {
      localStorage.setItem(
        STORAGE.reading,
        JSON.stringify({
          theme: state.theme,
          fontSize: state.fontSize,
        })
      );
    } catch (error) {
      console.warn('reading prefs persist failed', error);
    }
  }
}

function stepFont(delta) {
  state.fontSize = Math.min(SIZE_MAX, Math.max(SIZE_MIN, state.fontSize + delta));
  applyReading();
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyReading();
  toast(state.theme === 'dark' ? t('theme.on') : t('theme.off'));
}

// ---------------------------------------------------------------- listing

function applyMode() {
  const isPage = state.mode === 'page';
  const isSearch = state.mode === 'search';
  els.pickerSurah.hidden = state.mode !== 'surah';
  els.pickerPage.hidden = !isPage;
  els.pickerSearch.hidden = !isSearch;
  els.tabSurah.classList.toggle('is-active', state.mode === 'surah');
  els.tabPage.classList.toggle('is-active', isPage);
  els.tabSearch.classList.toggle('is-active', isSearch);

  els.ayaList.hidden = isSearch;
  els.searchResults.hidden = !isSearch;
  els.listFooter.hidden = isSearch || state.visible >= state.verses.length;
  document.body.dataset.mode = state.mode;

  const immersive = isPage && currentView === 'reader' && state.mushafFull !== false;
  document.body.classList.toggle('is-mushaf-full', immersive);
}

function updatePageTotal() {
  const total = pageMax();
  els.pageTotal.textContent = t('page.total', { total });
  els.pageNumber.max = String(total);
}

function pageMax() {
  return state.mushaf === 'indopak' ? INDOPAK_PAGES : MADANI_PAGE_TOTAL;
}

async function showList() {
  if (!isLoaded()) return;
  state.visible = CHUNK;
  state.selectedKey = null;
  state.pageAlignment = null;
  els.rangeError.hidden = true;
  state.page = clamp(state.page, 1, pageMax());

  try {
    if (state.mode === 'page') {
      if (state.mushaf === 'indopak') {
        setGlobalStatus(t('status.indopak', { page: state.page }));
        const list = await indopakPage(state.page);
        state.indopakLens = await indopakPageLines(state.page);
        state.verses = list.map((entry) => verseFromText(entry.surah, entry.aya, entry.text));
        setGlobalStatus('');
        els.listTitle.textContent = t('list.pageIndopak', {
          page: state.page,
          total: INDOPAK_PAGES,
        });
      } else {
        const list = madaniPageAyahs(state.page);
        if (!list.length) throw new Error(t('error.pageText'));
        state.verses = list.map(({ surah, aya }) => getVerses(surah, aya, aya)[0]).filter(Boolean);
        els.listTitle.textContent = t('list.pageMadani', { page: state.page, total: pageMax() });
      }
    } else {
      const total = Math.max(1, ayaCount(state.surah));
      state.verses = getVerses(state.surah, 1, total);
      els.listTitle.textContent = t('list.surah', {
        name: surahName(state.surah),
        total,
      });
    }
    els.pageNumber.value = String(state.page);
  } catch (error) {
    setGlobalStatus('');
    showError(error.message);
    state.verses = [];
  }

  renderList();
  renderTajweed();
  persistSelection();
}

function verseFromText(surah, aya, text) {
  // IndoPak pages don't carry the basmala inside aya 1, so it is supplied.
  const split = splitBasmala(surah, aya, text, INDOPAK_BASMALA);
  return {
    surah,
    aya,
    text,
    ayaText: split.ayaText,
    basmala: split.basmala,
    words: split.words,
    prefixWords: split.prefixWords,
    optional: split.words.map(() => false),
    hasBasmala: Boolean(split.basmala),
  };
}

function keyOf(surah, aya) {
  return `${surah}:${aya}`;
}

function verseOf(key) {
  return state.verses.find((verse) => keyOf(verse.surah, verse.aya) === key) || null;
}

function renderList() {
  els.ayaList.innerHTML = '';
  renderResume();
  if (state.mode === 'page') {
    renderMushafPage();
    updateRecordButtons();
    return;
  }

  const verses = state.verses.slice(0, state.visible);
  if (!verses.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = t('list.none');
    els.ayaList.appendChild(empty);
  }
  for (const verse of verses) els.ayaList.appendChild(ayaCard(verse));

  els.listFooter.hidden = state.visible >= state.verses.length;
  updateRecordButtons();
}

// ------------------------------------------------------------- aya cards

function ayaCard(verse) {
  const key = keyOf(verse.surah, verse.aya);
  const alignment = state.results.get(key);

  const card = document.createElement('article');
  card.className = 'aya-card';
  card.id = `card-${idOf(key)}`;

  const head = document.createElement('div');
  head.className = 'aya-head';

  const badge = document.createElement('span');
  badge.className = 'aya-badge';
  badge.textContent = key;

  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'icon-btn small';
  share.title = t('share.aya');
  share.textContent = '↗';
  share.addEventListener('click', () => shareAya(verse));

  const mine = myAudioButton(key);
  head.append(badge, starButton(key), hearButton(key));
  if (mine) head.appendChild(mine);
  head.appendChild(share);

  const text = document.createElement('div');
  text.className = 'aya-text';
  text.lang = 'ar';
  text.dir = 'rtl';
  renderAyaText(text, verse, alignment);

  const status = document.createElement('p');
  status.className = 'aya-status';
  status.dataset.role = 'status';

  const result = document.createElement('div');
  result.className = 'aya-result';
  if (alignment) renderAyaResult(result, alignment, key);

  const actions = document.createElement('div');
  actions.className = 'aya-actions';

  const record = document.createElement('button');
  record.type = 'button';
  record.className = 'btn primary record-aya';
  record.dataset.recId = key;
  record.dataset.label = t('record');
  record.textContent = t('record');
  record.addEventListener('click', () => toggleRecording(key, [key]));
  actions.appendChild(record);

  card.append(head);
  if (verse.basmala) card.appendChild(basmalaLine(verse.basmala));
  card.append(text, ayaMeta(key), status, result, actions);
  return card;
}

/** The surah's basmala as its own line, above the first aya. */
function basmalaLine(text) {
  const line = document.createElement('div');
  line.className = 'basmala-line';
  line.lang = 'ar';
  line.dir = 'rtl';
  line.textContent = text;
  return line;
}

function idOf(key) {
  return key.replace(/[^a-zA-Z0-9]/g, '-');
}

// -------------------------------------------------------------- aya marks

/** ★ bookmark toggle for one aya. */
function starButton(key) {
  const star = document.createElement('button');
  star.type = 'button';
  star.className = 'icon-btn small star-btn';
  star.title = t('mark.star');
  star.setAttribute('aria-label', t('mark.star'));
  const paint = () => {
    const on = isStarred(key);
    star.textContent = on ? '★' : '☆';
    star.classList.toggle('is-on', on);
    star.setAttribute('aria-pressed', String(on));
  };
  paint();
  star.addEventListener('click', () => {
    toggleStar(key);
    paint();
    renderProgress();
  });
  return star;
}

/** ✓ memorised / ↺ redo / ＋ unmarked — tap to cycle. */
function markChip(key) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip mark-chip';
  const paint = () => {
    const mark = markOf(key);
    chip.dataset.mark = mark;
    chip.textContent =
      mark === 'ok'
        ? `✓ ${t('mark.ok')}`
        : mark === 'redo'
          ? `↺ ${t('mark.redo')}`
          : `＋ ${t('mark.none')}`;
    chip.setAttribute('aria-pressed', String(mark !== 'none'));
  };
  paint();
  chip.addEventListener('click', () => {
    cycleMark(key);
    paint();
    renderProgress();
    announceBadges();
  });
  return chip;
}

/** Mark chip + last score, under an aya's text. */
function ayaMeta(key) {
  const row = document.createElement('div');
  row.className = 'aya-meta';
  row.appendChild(markChip(key));
  const score = scoreOf(key);
  if (typeof score === 'number') {
    const mini = document.createElement('span');
    mini.className = 'mini-score';
    mini.title = t('progress.average');
    mini.textContent = `${score}%`;
    row.appendChild(mini);
  }
  return row;
}

/** The "back where you were" chip in the surah picker. */
function renderResume() {
  if (!els.resumeAya) return;
  const key = resumeKey();
  els.resumeAya.hidden = !key;
  els.resumeAya.textContent = key ? `↩ ${key}` : '';
  els.resumeAya.title = t('progress.resume');
  els.resumeAya.setAttribute('aria-label', t('progress.resume'));
}

// ------------------------------------------------------------- mushaf page

/** The bar under the page for the selected aya (null when nothing is selected). */
function mushafSelectionBar() {
  if (!state.selectedKey) return null;
  const selected = verseOf(state.selectedKey);
  if (!selected) return null;

  const bar = document.createElement('div');
  bar.className = 'selection-bar';

  const label = document.createElement('span');
  label.className = 'selection-label';
  label.textContent = t('selection.aya', { ref: state.selectedKey });

  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'btn ghost small';
  share.textContent = t('share');
  share.addEventListener('click', () => shareAya(selected));

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'btn ghost small';
  clear.textContent = t('cancel');
  clear.addEventListener('click', () => {
    state.selectedKey = null;
    renderList();
  });

  const record = document.createElement('button');
  record.type = 'button';
  record.className = 'btn primary small';
  record.dataset.recId = `sel-${state.selectedKey}`;
  record.dataset.label = t('record.aya');
  record.textContent = t('record.aya');
  const key = state.selectedKey;
  record.addEventListener('click', () => toggleRecording(`sel-${key}`, [key]));

  const status = document.createElement('span');
  status.className = 'aya-status';
  status.dataset.role = 'status';

  bar.append(label, record, starButton(key), hearButton(key));
  const mine = myAudioButton(key);
  if (mine) bar.appendChild(mine);
  bar.append(markChip(key), share, clear, status);
  return bar;
}

/**
 * A tap on an aya only repaints the selection — the whole page is not thrown
 * away and re-fitted, which is what made tapping feel slow on a long page.
 */
function selectAya(page, key) {
  state.selectedKey = state.selectedKey === key ? null : key;
  if (state.selectedKey) setResume(state.selectedKey);

  for (const seg of page.querySelectorAll('.aya-seg.is-selected')) {
    seg.classList.remove('is-selected');
  }
  if (state.selectedKey) {
    const segs = page.querySelectorAll('.aya-seg');
    for (const seg of segs) {
      if (seg.dataset.key === state.selectedKey) seg.classList.add('is-selected');
    }
  }

  const old = page.querySelector('.selection-bar');
  const next = mushafSelectionBar();
  if (old && next) old.replaceWith(next);
  else if (old) old.remove();
  else if (next) page.insertBefore(next, page.firstChild);

  window.requestAnimationFrame(() => fitMushafPage(page));
}


function renderMushafPage() {
  const page = document.createElement('div');
  page.className = 'mushaf-page';
  page.id = 'mushaf-page';
  page.dir = 'rtl';
  page.classList.add(state.mushaf === 'indopak' ? 'mf-indopak' : 'mf-madani');

  const bar = mushafSelectionBar();
  if (bar) page.appendChild(bar);

  const text = document.createElement('div');
  text.className = 'page-text';
  text.lang = 'ar';
  text.dir = 'rtl';

  // Madani: the page is cut into its 15 printed lines. IndoPak (or any page the
  // line data does not fit) keeps the flowing text.
  const lens = state.mushaf === 'madani' ? madaniPageLines(state.page) : state.indopakLens;
  const asLines = Array.isArray(lens) && renderMadaniLines(text, page, lens);
  if (!asLines) {
    text.classList.remove('is-lines');
    text.textContent = '';
    state.verses.forEach((verse) => {
      if (verse.basmala) text.appendChild(basmalaLine(verse.basmala));
      const key = keyOf(verse.surah, verse.aya);
      const seg = document.createElement('span');
      seg.className = 'aya-seg';
      seg.dataset.key = key;
      if (state.selectedKey === key) seg.classList.add('is-selected');

      renderAyaText(seg, verse, state.results.get(key));

      const marker = document.createElement('span');
      marker.className = 'aya-marker';
      marker.textContent = toArabicDigits(verse.aya);
      marker.setAttribute('aria-label', `Aya ${verse.aya}`);
      seg.appendChild(document.createTextNode(' '));
      seg.appendChild(marker);
      seg.appendChild(document.createTextNode(' '));

      seg.addEventListener('click', () => selectAya(page, key));

      text.appendChild(seg);
    });
  }
  page.appendChild(mushafTopStrip());
  page.appendChild(text);

  if (state.pageAlignment) {
    const strip = document.createElement('div');
    strip.className = `aya-score ${scoreClass(state.pageAlignment.score)}`;
    const score = document.createElement('span');
    score.className = 'score-value';
    score.textContent = `${state.pageAlignment.score}%`;
    const verdict = document.createElement('span');
    verdict.className = 'score-verdict';
    verdict.textContent = state.pageAlignment.verdict;
    const counts = document.createElement('span');
    counts.className = 'score-counts';
    counts.textContent = countsLine(state.pageAlignment.counts);
    strip.append(score, verdict, counts);
    page.appendChild(strip);

    const mistakes = document.createElement('div');
    mistakes.className = 'page-mistakes';
    for (const verse of state.verses) {
      const key = keyOf(verse.surah, verse.aya);
      const alignment = state.results.get(key);
      if (!alignment) continue;
      const problems = alignment.results.filter((r) => r.status !== WORD_STATUS.CORRECT);
      if (!problems.length) continue;
      mistakes.appendChild(mistakeBlock(key, problems));
    }
    page.appendChild(mistakes);
  }

  const actions = document.createElement('div');
  actions.className = 'page-actions';

  // No page-level recording here: the mushaf page is for reading along. A single
  // aya can still be checked from the aya list, or recorded aya by aya.

  const status = document.createElement('p');
  status.className = 'aya-status';
  status.dataset.role = 'status';
  actions.appendChild(status);

  page.appendChild(actions);

  // One small floating button: ☰ brings the app's bars back, ✕ returns to the
  // full page. Tapping the text itself only selects an aya.
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'mushaf-toggle';
  toggle.setAttribute('aria-label', t('tab.mushaf'));
  toggle.addEventListener('click', () => toggleMushafFull(page));
  page.appendChild(toggle);
  paintMushafToggle(toggle);

  if (state.turn) page.classList.add(state.turn === 'fwd' ? 'turn-fwd' : 'turn-back');
  state.turn = '';
  els.ayaList.appendChild(page);
  fitMushafPage(page);
  attachPageSwipe(page);
  if (window.ResizeObserver) {
    const text = page.querySelector('.page-text');
    let last = '';
    const ro = new ResizeObserver(() => {
      if (!page.isConnected) { ro.disconnect(); return; }
      const size = `${text.clientWidth}x${text.clientHeight}`;
      if (size === last || !text.clientWidth) return;
      last = size;
      fitMushafPage(page);
    });
    ro.observe(text);
  }
  // The Arabic font may arrive after the first fit: fit once more when it has.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (page.isConnected) fitMushafPage(page);
    });
  }
}

const BASMALA_FALLBACK = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

/** Thin strip above the page, as in the printed mus'haf: juz, page number, surah. */
function mushafTopStrip() {
  const strip = document.createElement('div');
  strip.className = 'mpage-top';
  strip.dir = 'rtl';
  const first = state.verses[0];
  const juz = first ? juzOfAya(first.surah, first.aya) : 0;
  const right = document.createElement('span');
  right.className = 'mpage-juz';
  right.lang = 'ar';
  right.textContent = juz ? `الجزء ${toArabicDigits(juz)}` : '';
  const mid = document.createElement('span');
  mid.className = 'mpage-no';
  mid.textContent = toArabicDigits(state.page);
  const left = document.createElement('span');
  left.className = 'mpage-surah';
  left.lang = 'ar';
  const last = state.verses[state.verses.length - 1] || first;
  const sOf = (n) => (SURAHS[n - 1] ? SURAHS[n - 1].arabic : '');
  left.textContent = last ? `سورة ${sOf(last.surah)}` : '';
  strip.append(right, mid, left);
  return strip;
}

/**
 * Fill `text` with the printed lines of the current Madani page. Returns false
 * (and leaves `text` for the flowing fallback) when the line data does not add
 * up to the words on the page, so a page is never shown with a word missing.
 */
function renderMadaniLines(text, page, lens) {
  const flat = [];
  for (const verse of state.verses) {
    const key = keyOf(verse.surah, verse.aya);
    const alignment = state.results.get(key);
    verse.words.forEach((word, i) => {
      flat.push({ verse, key, i, word, alignment, lastWord: i === verse.words.length - 1 });
    });
  }
  const total = lens.reduce((a, b) => a + b, 0);
  if (!lens.length || total !== flat.length) return false;

  text.classList.add('is-lines');
  let at = 0;
  for (const len of lens) {
    const slice = flat.slice(at, at + len);
    at += len;
    const head = slice[0];

    if (head.i === 0 && head.verse.aya === 1) {
      const banner = document.createElement('div');
      banner.className = 'msurah';
      const inner = document.createElement('div');
      inner.className = 'msurah-in';
      inner.lang = 'ar';
      const info = SURAHS[head.verse.surah - 1];
      inner.textContent = `سورة ${info ? info.arabic : ''}`;
      banner.appendChild(inner);
      text.appendChild(banner);
      if (head.verse.surah !== 1 && head.verse.surah !== 9) {
        const row = document.createElement('div');
        row.className = 'mbasmala';
        const inn = document.createElement('div');
        inn.className = 'mbasmala-in';
        inn.lang = 'ar';
        inn.dir = 'rtl';
        inn.textContent = head.verse.basmala || BASMALA_FALLBACK;
        row.appendChild(inn);
        text.appendChild(row);
      }
    }

    const row = document.createElement('div');
    row.className = 'mline';
    const inner = document.createElement('div');
    inner.className = 'mline-in';
    inner.lang = 'ar';
    inner.dir = 'rtl';

    let seg = null;
    slice.forEach((entry, n) => {
      if (!seg || seg.dataset.key !== entry.key) {
        if (seg) inner.appendChild(document.createTextNode(' '));
        seg = document.createElement('span');
        seg.className = 'aya-seg';
        seg.dataset.key = entry.key;
        if (state.selectedKey === entry.key) seg.classList.add('is-selected');
        const key = entry.key;
        seg.addEventListener('click', () => selectAya(page, key));
        inner.appendChild(seg);
      } else {
        seg.appendChild(document.createTextNode(' '));
      }

      const result = entry.alignment ? entry.alignment.results[entry.i] : null;
      if (result && result.status !== WORD_STATUS.CORRECT) {
        const span = document.createElement('span');
        span.className = `w is-${result.status}`;
        span.textContent = entry.word;
        span.title = noteFor(result);
        seg.appendChild(span);
      } else {
        seg.appendChild(document.createTextNode(entry.word));
      }

      if (entry.lastWord) {
        const marker = document.createElement('span');
        marker.className = 'aya-marker';
        marker.textContent = toArabicDigits(entry.verse.aya);
        marker.setAttribute('aria-label', `Aya ${entry.verse.aya}`);
        seg.appendChild(document.createTextNode(' '));
        seg.appendChild(marker);
        // The last line of a surah is not stretched, as in the printed mus'haf.
        if (n === slice.length - 1 && entry.verse.aya === Math.max(1, ayaCount(entry.verse.surah))) {
          inner.classList.add('is-end');
        }
      }
    });

    row.appendChild(inner);
    text.appendChild(row);
  }
  return true;
}

/** The floating button shows what it will do on the next tap. */
function paintMushafToggle(button) {
  if (!button) return;
  button.textContent = state.mushafFull !== false ? '✕' : '☰';
  button.setAttribute('aria-label', t('tab.mushaf'));
}

function toggleMushafFull(page) {
  state.mushafFull = state.mushafFull === false;
  document.body.classList.toggle('is-mushaf-full', state.mushafFull && state.mode === 'page');
  const button = page ? page.querySelector('.mushaf-toggle') : null;
  paintMushafToggle(button);
  // The frame changes size the moment the class is toggled; fitting inside a
  // single animation frame measured the old height and left the page with an
  // oversized font that got clipped (paper with no ayaat). Fit again after the
  // layout has really settled.
  if (page) refitMushafSoon();
  return state.mushafFull;
}

/**
 * Fit one page of the mus'haf into the frame, like a printed page.
 * A binary search over the font size instead of a 0.5px walk: the old loop could
 * touch the layout ninety times per page, which is what made the mushaf stutter
 * on a slow phone.
 */
function fitMushafPage(page) {
  const text = page.querySelector('.page-text');
  if (!text) return;
  if (text.classList.contains('is-lines')) {
    fitMadaniLines(text);
    return;
  }
  text.style.fontSize = '';

  const room = text.clientHeight;
  if (!room || room < 120) return;

  const fits = (size) => {
    text.style.fontSize = `${size}px`;
    return text.scrollHeight <= room;
  };

  const base = parseFloat(window.getComputedStyle(text).fontSize) || 26;

  // A short page (Fatihah, a page of few ayas) grows a little so the frame is
  // not half empty, but never so much that pages look different from each other.
  if (fits(base)) {
    const cap = Math.min(52, Math.round(base * 1.4));
    let size = base;
    while (size + 2 <= cap && fits(size + 2)) size += 2;
    text.style.fontSize = `${size}px`;
    markTall(page, text, false);
    return;
  }

  let low = 12;
  let high = base;
  while (high - low > 0.5) {
    const mid = (low + high) / 2;
    if (fits(mid)) low = mid;
    else high = mid;
  }
  const finalSize = Math.max(12, Math.floor(low * 10) / 10);
  // Last check at the size that actually stays on screen: on a very short screen
  // even 12px may not fit, and the page is allowed to scroll — a clipped aya is
  // worse than a page that moves.
  const tall = !fits(finalSize);
  text.style.fontSize = `${finalSize}px`;
  markTall(page, text, tall);
}

/** Never hide a word: a page taller than the screen scrolls instead of clipping. */
function markTall(page, text, tall) {
  text.classList.toggle('is-tall', tall);
  if (page) page.classList.toggle('is-tall', tall);
}

/**
 * Size the printed lines so the widest one just fills the page width and no
 * line wraps; every line is then stretched to the same width (justify), like
 * the printed mus'haf. Width and height are measured, never guessed.
 */
function fitMadaniLines(text) {
  const width = text.clientWidth;
  const room = text.clientHeight;
  if (!width || !room) return;
  const lines = Array.from(text.querySelectorAll('.mline-in'));
  if (!lines.length) return;

  // The same page keeps the same size after a check: colouring a word must not
  // re-flow the page and move the ayaat around. Only a new page or a new width
  // (rotation, keyboard) measures again.
  const remembered = state.mushafFit;
  if (
    remembered &&
    remembered.page === state.page &&
    remembered.mushaf === state.mushaf &&
    remembered.width === width &&
    remembered.size
  ) {
    text.style.fontSize = `${remembered.size}px`;
    spreadMushafLines(text);
    markTall(text.closest('.mushaf-page'), text, text.scrollHeight > text.clientHeight + 1);
    return;
  }

  text.classList.add('is-measuring');
  const range = document.createRange();
  const widest = () => {
    let max = 0;
    for (const line of lines) {
      range.selectNodeContents(line);
      max = Math.max(max, range.getBoundingClientRect().width);
    }
    return max;
  };

  // Two measurements instead of up to nine: the width of a line is linear in
  // the font size, so one scale gets very close and one more corrects it.
  text.style.fontSize = '40px';
  let natural = widest() || 1;
  let size = (40 * (width - 2)) / natural;
  text.style.fontSize = `${Math.floor(size * 10) / 10}px`;
  if (widest() > width - 1) {
    natural = widest() || 1;
    size *= (width - 2) / natural;
    text.style.fontSize = `${Math.floor(size * 10) / 10}px`;
  }
  // Size the page by its width only, so every line fills the frame and no gaps
  // are left between the words. If those fifteen lines are taller than the frame
  // on a short screen, the page scrolls (is-tall) instead of shrinking the text —
  // a smaller text is what used to leave big holes in the lines.
  size = Math.max(12, Math.min(size, 64));
  const finalSize = Math.floor(size * 10) / 10;
  text.style.fontSize = `${finalSize}px`;
  text.classList.remove('is-measuring');
  spreadMushafLines(text);
  // 15 printed lines can still be taller than the frame on a short screen: let the
  // page scroll rather than cut the last line off.
  markTall(text.closest('.mushaf-page'), text, text.scrollHeight > room + 1);
  state.mushafFit = { page: state.page, mushaf: state.mushaf, width, size: finalSize };
}

/**
 * Fill every printed line edge to edge by widening only the spaces between
 * words (word-spacing). The browser's own `justify` can stretch the gaps
 * between the letters of a word on some phones, which breaks the joining
 * (ال ك تاب); this never touches a letter.
 */
function spreadMushafLines(text) {
  const lines = Array.from(text.querySelectorAll('.mline-in'));
  if (!lines.length) return;
  const range = document.createRange();

  // Read every line first, then write every gap: measuring after each write
  // forced a fresh layout fifteen times per fit, which is what made the page
  // feel slow to open and to swipe.
  const plans = [];
  for (const line of lines) {
    line.style.wordSpacing = '0px';
    if (line.classList.contains('is-end')) continue;
    const gaps = (line.textContent.match(/ /g) || []).length;
    if (!gaps) continue;
    range.selectNodeContents(line);
    const natural = range.getBoundingClientRect().width;
    plans.push([line, (line.clientWidth - natural - 0.5) / gaps]);
  }
  for (const [line, extra] of plans) {
    // Only the spaces between words are widened, and the line is `nowrap`, so no
    // word is ever pushed onto another line and no gap is left at the edge.
    if (extra > 0) line.style.wordSpacing = `${extra.toFixed(2)}px`;
  }
}

/** Fit the page again once the reader is really on screen (it was hidden before). */
function refitMushafSoon() {
  // Two passes: one now, one after the view transition has settled. Each pass
  // measures 15 lines, so a third only cost time without changing anything.
  for (const wait of [0, 200]) {
    window.setTimeout(() => {
      if (currentView !== 'reader') return;
      const page = els.ayaList.querySelector('.mushaf-page');
      if (page) fitMushafPage(page);
    }, wait);
  }
}

/** Swipe left/right on the mushaf page to move to the next/previous page. */
function attachPageSwipe(page) {
  let x0 = 0;
  let y0 = 0;
  let started = 0;

  page.addEventListener(
    'touchstart',
    (event) => {
      const touch = event.changedTouches[0];
      x0 = touch.clientX;
      y0 = touch.clientY;
      started = Date.now();
    },
    { passive: true }
  );

  page.addEventListener(
    'touchend',
    (event) => {
      const touch = event.changedTouches[0];
      const dx = touch.clientX - x0;
      const dy = touch.clientY - y0;
      if (Date.now() - started > 900) return;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      // RTL mus'haf: the next page lies to the LEFT, so the finger moves
      // left-to-right to turn forward (like a printed Arabic book and the
      // mus'haf apps); right-to-left turns back.
      goPage(dx > 0 ? 1 : -1);
    },
    { passive: true }
  );
}

function goPage(delta) {
  const next = clamp(state.page + delta, 1, pageMax());
  if (next === state.page) return;
  state.turn = delta > 0 ? 'fwd' : 'back';
  state.page = next;
  els.pageNumber.value = String(next);
  showList();
}

/** The little 🔊 button — listen to this aya's qari before or after recording. */
function hearButton(key) {
  const [surah, aya] = String(key || '')
    .split(':')
    .map(Number);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icon-btn small aya-hear';
  btn.title = t('qari.listen');
  btn.textContent = '🔊';
  if (!surah || !aya) return btn;

  btn.addEventListener('click', () => {
    qariQueue = null;
    paintQariAll();
    toggleQari(surah, aya, {
      onStop: () => setHearLabel(btn, false),
      onEnd: () => setHearLabel(btn, false),
      onError: () => {
        setHearLabel(btn, false);
        toast(t('qari.failed'));
      },
    });
    setHearLabel(btn, isQariPlaying(surah, aya));
  });
  return btn;
}

function setHearLabel(btn, on) {
  btn.textContent = on ? '⏹' : '🔊';
  btn.classList.toggle('is-on', on);
}

/** Play back the person's own recording of this aya — the proof of what they said. */
let myAudio = null;

function stopMyAudio() {
  if (myAudio) {
    try {
      myAudio.pause();
    } catch (error) {
      /* already gone */
    }
    myAudio = null;
  }
  document.querySelectorAll('.aya-mine.is-on').forEach((btn) => {
    btn.classList.remove('is-on');
    btn.textContent = '🎧';
  });
}

function playMyAudio(key, btn) {
  const url = state.recordings.get(key);
  if (!url) return;

  if (btn.classList.contains('is-on')) {
    stopMyAudio();
    return;
  }
  stopAyaAudio();
  stopMyAudio();

  myAudio = new Audio(url);
  btn.classList.add('is-on');
  btn.textContent = '⏸';
  myAudio.addEventListener('ended', stopMyAudio);
  const started = myAudio.play();
  if (started && typeof started.catch === 'function') {
    started.catch(() => {
      stopMyAudio();
      toast(t('mine.failed'));
    });
  }
}

function myAudioButton(key) {
  if (!state.recordings.has(key)) return null;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icon-btn small aya-mine';
  btn.title = t('mine.listen');
  btn.textContent = '🎧';
  btn.addEventListener('click', () => playMyAudio(key, btn));
  return btn;
}

function setQariLabel(btn, on) {
  btn.textContent = on ? t('qari.stop') : t('qari.listen');
  btn.classList.toggle('is-on', on);
}

/** "Suno" button: the qari's recitation of this aya, right next to the mistakes. */
function qariRow(key) {
  const [surah, aya] = String(key || '')
    .split(':')
    .map(Number);
  const row = document.createElement('div');
  row.className = 'qari-row';
  if (!surah || !aya) return row;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn ghost small qari-btn';
  btn.textContent = t('qari.listen');
  btn.addEventListener('click', () => {
    toggleQari(surah, aya, {
      onStop: () => setQariLabel(btn, false),
      onEnd: () => setQariLabel(btn, false),
      onError: () => {
        setQariLabel(btn, false);
        toast(t('qari.failed'));
      },
    });
    setQariLabel(btn, isQariPlaying(surah, aya));
  });
  row.appendChild(btn);
  return row;
}

/** The plain-language "what went wrong" line under the word list. */
function explainLine(problems) {
  const p = document.createElement('p');
  p.className = 'mistake-explain';

  const bits = problems.slice(0, 3).map((r) => {
    const heard = r.heard || t('note.unread');
    if (r.status === WORD_STATUS.MISSING) return t('explain.missing', { expected: r.expected });
    if (r.status === WORD_STATUS.CLOSE) return t('explain.close', { expected: r.expected, heard });
    return t('explain.wrong', { expected: r.expected, heard });
  });
  if (problems.length > 3) bits.push(t('explain.more', { n: problems.length - 3 }));

  p.textContent = bits.join(' ');
  return p;
}

function mistakeBlock(key, problems) {
  const [surah, aya] = String(key || '')
    .split(':')
    .map(Number);
  const block = document.createElement('div');
  block.className = 'page-mistake';
  const label = document.createElement('span');
  label.className = 'page-mistake-key';
  label.textContent = key;
  block.appendChild(label);

  const list = document.createElement('ul');
  list.className = 'mistake-list';
  for (const r of problems) {
    const li = document.createElement('li');
    li.className = `mistake is-${r.status}`;

    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent =
      r.status === WORD_STATUS.CLOSE
        ? t('count.close')
        : r.status === WORD_STATUS.UNSURE
          ? t('count.unsure')
          : r.status === WORD_STATUS.MISSING
            ? t('note.missing')
            : t('count.wrong');

    const expected = document.createElement('span');
    expected.className = 'aya-word';
    expected.textContent = r.expected;

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '→';

    const heard = document.createElement('span');
    heard.className = r.heard ? 'spoken-word' : 'spoken-word muted';
    heard.textContent = r.heard || t('note.unread');

    li.append(tag, expected, arrow, heard);

    if (surah && aya && Number.isInteger(r.index)) {
      const wordHear = document.createElement('button');
      wordHear.type = 'button';
      wordHear.className = 'icon-btn small word-hear';
      wordHear.textContent = '🔊';
      wordHear.title = t('qari.word');
      wordHear.addEventListener('click', async () => {
        const ok = await playWord(surah, aya, r.index);
        if (!ok) toast(t('qari.wordNo'));
      });
      li.appendChild(wordHear);
    }

    list.appendChild(li);
  }
  block.appendChild(list);
  block.appendChild(explainLine(problems));
  if (key && String(key).includes(':')) block.appendChild(qariRow(key));
  return block;
}

// ---------------------------------------------------------------- rendering

function renderAyaText(target, verse, alignment) {
  target.textContent = '';
  const source = verse.ayaText || verse.text;
  if (!alignment) {
    target.textContent = source;
    return;
  }

  // The aya is never moved, shortened or rewritten: the words stay exactly as
  // they are in the mushaf and only the ones that need attention are coloured
  // and underlined. Everything else (heard word, extras) is in the box below.
  const tokens = source.split(/(\s+)/);
  let wordIndex = -1;

  for (const token of tokens) {
    if (!token) continue;
    if (/^\s+$/.test(token)) {
      target.appendChild(document.createTextNode(token));
      continue;
    }
    wordIndex += 1;
    const result = alignment.results[wordIndex];

    if (!result || result.status === WORD_STATUS.CORRECT) {
      target.appendChild(document.createTextNode(token));
      continue;
    }

    const span = document.createElement('span');
    span.className = `w is-${result.status}`;
    span.textContent = token;
    span.title = noteFor(result);
    target.appendChild(span);
  }
}

function noteFor(result) {
  if (result.status === WORD_STATUS.MISSING || !result.heard) return t('note.missing');
  if (result.status === WORD_STATUS.UNSURE) return t('note.unsure');
  if (result.status === WORD_STATUS.CLOSE) return t('note.closeHeard', { word: result.heard });
  return t('note.readHeard', { word: result.heard });
}

function countsLine(c) {
  return [
    `${c.correct} ${t('count.correct')}`,
    c.close ? `${c.close} ${t('count.close')}` : '',
    c.unsure ? `${c.unsure} ${t('count.unsure')}` : '',
    c.wrong ? `${c.wrong} ${t('count.wrong')}` : '',
    c.missing ? `${c.missing} ${t('count.missing')}` : '',
    c.extra ? `${c.extra} ${t('count.extra')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function renderAyaResult(target, alignment, key) {
  const strip = document.createElement('div');
  strip.className = `aya-score ${scoreClass(alignment.score)}`;

  const score = document.createElement('span');
  score.className = 'score-value';
  score.textContent = `${alignment.score}%`;

  const verdict = document.createElement('span');
  verdict.className = 'score-verdict';
  verdict.textContent = alignment.verdict;

  const counts = document.createElement('span');
  counts.className = 'score-counts';
  counts.textContent = countsLine(alignment.counts);

  strip.append(score, verdict, counts);
  target.appendChild(strip);

  // Whisper hears words, not tajweed: say so where the result is read, so
  // nobody expects a madd or ghunnah to be judged here.
  const scope = document.createElement('p');
  scope.className = 'hint result-scope';
  scope.textContent = t('result.tajweedNote');
  target.appendChild(scope);

  const problems = alignment.results.filter((r) => r.status !== WORD_STATUS.CORRECT);
  if (!problems.length) {
    const ok = document.createElement('p');
    ok.className = 'hint';
    ok.textContent =
      alignment.score === 100 ? t('hint.allWords') : t('hint.noWordErrors');
    target.appendChild(ok);
    return;
  }
  target.appendChild(mistakeBlock(key, problems));
  target.appendChild(accuracyButtons());
}

/**
 * "Sahi tha / Galat tha": the person's own verdict on what the app said. It is
 * what turns "the checker feels right" into a counted accuracy in Settings.
 */
function accuracyButtons() {
  const row = document.createElement('div');
  row.className = 'verdict-ask';

  const ask = document.createElement('span');
  ask.className = 'hint accuracy-ask';
  ask.textContent = t('accuracy.ask');
  row.appendChild(ask);

  const yes = document.createElement('button');
  yes.type = 'button';
  yes.className = 'btn small';
  yes.textContent = t('accuracy.yes');

  const no = document.createElement('button');
  no.type = 'button';
  no.className = 'btn ghost small';
  no.textContent = t('accuracy.no');

  const finish = (right) => {
    recordAccuracy(right);
    row.textContent = '';
    const done = document.createElement('span');
    done.className = 'hint';
    done.textContent = t('accuracy.thanks');
    row.appendChild(done);
  };

  yes.addEventListener('click', () => finish(true));
  no.addEventListener('click', () => finish(false));

  row.append(yes, no);
  return row;
}

function scoreClass(score) {
  if (score >= 85) return 'good';
  if (score >= 60) return 'mid';
  return 'bad';
}

function toArabicDigits(value) {
  return String(value).replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

// ---------------------------------------------------------------- recording

function statusElementFor(id) {
  if (id.startsWith('sel-')) {
    return document.querySelector('#mushaf-page .selection-bar [data-role="status"]');
  }
  if (id === 'page') {
    return document.querySelector('#mushaf-page .page-actions [data-role="status"]');
  }
  const card = document.getElementById(`card-${idOf(id)}`);
  return card ? card.querySelector('[data-role="status"]') : null;
}

function setStatus(id, message, kind = 'info') {
  const element = statusElementFor(id);
  if (!element) return;
  element.textContent = message;
  element.className = kind === 'info' ? 'aya-status' : `aya-status is-${kind}`;
}

function updateRecordButtons() {
  const buttons = document.querySelectorAll('[data-rec-id]');
  buttons.forEach((button) => {
    const id = button.dataset.recId;
    const isActive = state.recording && state.recording.id === id;
    const locked = Boolean(state.busyId) || state.modelLoading || state.micChecking;
    button.disabled = locked || (state.recording !== null && !isActive);
    if (isActive) {
      button.classList.add('recording');
      if (button.dataset.active !== '1') {
        button.dataset.active = '1';
        button.textContent = `${t('stop')} · 0:00`;
      }
    } else {
      button.classList.remove('recording');
      delete button.dataset.active;
      button.textContent = button.dataset.label || t('record');
    }
  });

  // A page reload for a new service worker must wait until nothing is running.
  const busy = Boolean(state.recording || state.busyId || state.modelLoading || state.micChecking);
  document.body.dataset.busy = busy ? '1' : '0';
  if (!busy && typeof window.bayyinReloadPending === 'function') {
    const reload = window.bayyinReloadPending;
    window.bayyinReloadPending = null;
    reload();
  }
}

async function toggleRecording(id, keys) {
  stopQari();
  if (state.recording && state.recording.id === id) {
    await finishRecording(false);
    return;
  }
  if (state.recording || state.busyId || state.modelLoading || state.micChecking) return;
  if (!canCheck()) {
    toast(t('premium.limit'));
    setView('premium');
    return;
  }

  state.recording = { id, keys };
  state.levelState = '';
  setStatus(id, t('status.mic'));
  updateRecordButtons();

  try {
    state.recorder = await startRecording({ maxSeconds: 180 });
    state.recordingStarted = Date.now();
    setStatus(id, t('status.recording'));
    startTimer(id);
  } catch (error) {
    state.recording = null;
    state.recorder = null;
    setStatus(id, error.message, 'error');
    updateRecordButtons();
  }
}

async function finishRecording(byItself) {
  const current = state.recording;
  const recorder = state.recorder;
  if (!current || !recorder) return;

  state.recorder = null;
  state.recording = null;
  stopTimer();
  updateRecordButtons();
  setStatus(current.id, t(byItself ? 'status.byItself' : 'status.preparing'));

  let blob = null;
  try {
    blob = await recorder.stop();
  } catch (error) {
    setStatus(current.id, t('status.recordError', { message: error.message }), 'error');
    return;
  }
  if (!blob || !blob.size) {
    setStatus(current.id, t('status.empty'), 'error');
    return;
  }

  // Keep this recording so the person can hear exactly what the app heard.
  const url = URL.createObjectURL(blob);
  for (const key of current.keys) {
    const old = state.recordings.get(key);
    if (old && old !== url) URL.revokeObjectURL(old);
    state.recordings.set(key, url);
  }

  await checkTarget(current.id, current.keys, blob);
}

function startTimer(id) {
  stopTimer();
  state.timer = window.setInterval(() => {
    if (!state.recording) return;
    const seconds = Math.floor((Date.now() - state.recordingStarted) / 1000);
    const button = document.querySelector(`[data-rec-id="${id}"]`);
    if (button) button.textContent = `${t('stop')} · ${formatClock(seconds)}`;
    const recorder = state.recorder;
    if (recorder && typeof recorder.getState === 'function' && recorder.getState() === 'inactive') {
      finishRecording(true);
      return;
    }
    const peak = recorder && typeof recorder.getPeak === 'function' ? recorder.getPeak() : -1;
    if (peak >= 0) {
      if (peak >= 0.01 && state.levelState !== 'ok') {
        state.levelState = 'ok';
        setStatus(id, t('status.hearing'));
      } else if (peak < 0.002 && seconds >= 3 && state.levelState !== 'silent') {
        state.levelState = 'silent';
        setStatus(id, t('status.silentAlert'), 'error');
      }
    }
  }, 300);
}

function stopTimer() {
  if (state.timer) {
    window.clearInterval(state.timer);
    state.timer = null;
  }
}

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// ----------------------------------------------------------------- checking

async function checkTarget(id, keys, blob) {
  const verses = keys.map(verseOf).filter(Boolean);
  if (!verses.length) return;

  state.busyId = id;
  updateRecordButtons();

  try {
    setStatus(id, t('status.preparing'));
    const audio = await decodeToMono16k(blob);
    if (audio.length < 6400) throw new Error(t('status.short'));
    if (peakOf(audio) < 0.003) throw new Error(t('status.silent'));

    if (!state.model) {
      setGlobalStatus(t('status.modelDownload'));
      const loaded = await handleLoadModel();
      if (!loaded) throw new Error(t('status.modelFailed'));
      setGlobalStatus('');
    }

    setStatus(id, t('status.transcribing'));
    const accurate = Boolean(els.accurateMode && els.accurateMode.checked);
    const seconds = Math.max(1, Math.round(audio.length / 16000));
    const startedAt = Date.now();
    const ticker = window.setInterval(() => {
      const s = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      setGlobalStatus(t('status.thinking', { s, audio: seconds }));
    }, 1000);
    setGlobalStatus(t('status.thinking', { s: 0, audio: seconds }));

    let text;
    try {
      text = await transcribe(state.model, audio, {
        fast: !accurate,
        prompt: verses.map((verse) => verse.ayaText || verse.text).join(' '),
      });
    } finally {
      window.clearInterval(ticker);
      setGlobalStatus('');
    }
    if (!text) throw new Error(t('status.nothing'));

    const expected = [];
    const wordVerse = [];
    verses.forEach((verse, vi) => {
      // A surah's basmala may be recited or skipped without it being an error.
      (verse.prefixWords || []).forEach((word) => {
        expected.push({ word, optional: true });
        wordVerse.push(vi);
      });
      verse.words.forEach((word, wi) => {
        expected.push({ word, optional: Boolean(verse.optional[wi]) });
        wordVerse.push(vi);
      });
    });

    const heard = text
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => normalizeArabic(word).length > 0);

    const alignment = alignWords(expected, heard);

    // Store a per-aya slice so each aya shows its own mistakes.
    const slices = verses.map(() => []);
    const report = [];
    alignment.results.forEach((result, index) => {
      const vi = wordVerse[index];
      slices[vi].push({ ...result, index: slices[vi].length });
    });
    verses.forEach((verse, vi) => {
      const prefix = (verse.prefixWords || []).length;
      const key = keyOf(verse.surah, verse.aya);
      const summary = summarise(slices[vi].slice(prefix), []);
      state.results.set(key, summary);
      setScore(key, summary.score);
      report.push({
        key,
        score: summary.score,
        problems: slices[vi].slice(prefix).filter((result) => result.status !== WORD_STATUS.CORRECT),
      });
    });
    recordReport(report);
    updateFromCheck(report);
    paintMurajaaCount();
    if (verses.length) setResume(keyOf(verses[0].surah, verses[0].aya));
    recordCheck();
    announceBadges();
    renderPremiumCard();

    state.pageAlignment =
      verses.length > 1 ? summarise(alignment.results, alignment.extras) : null;

    setStatus(id, '');
    renderList();
  } catch (error) {
    setStatus(id, error.message, 'error');
  } finally {
    state.busyId = null;
    setGlobalStatus('');
    updateRecordButtons();
  }
}

/** counts + score + verdict for a set of word results. */
function summarise(results, extras) {
  const counts = { correct: 0, close: 0, unsure: 0, wrong: 0, missing: 0, extra: extras.length };
  let gained = 0;
  let counted = 0;
  for (const result of results) {
    if (result.optional && !result.heard) continue;
    counted += 1;
    counts[result.status] += 1;
    if (result.status === WORD_STATUS.CORRECT) gained += 1;
    else if (result.status === WORD_STATUS.CLOSE) gained += 0.6;
    else if (result.status === WORD_STATUS.WRONG) gained += 0.15;
  }
  let score = counted ? (gained / counted) * 100 : 0;
  score -= Math.min(15, extras.length * 2);
  score = Math.max(0, Math.min(100, Math.round(score)));

  let verdict = t('verdict.nothing');
  if (counted) {
    if (!counts.wrong && !counts.missing && !counts.extra) {
      verdict = score === 100 ? t('verdict.perfect') : t('verdict.near');
    } else if (score >= 85) verdict = t('verdict.good');
    else if (score >= 65) verdict = t('verdict.ok');
    else if (score >= 40) verdict = t('verdict.retry');
    else verdict = t('verdict.learn');
  }

  return { results, extras, counts, score, verdict };
}

// -------------------------------------------------------------------- model

/**
 * Load the speech model once and keep it for the whole session. Calls that
 * arrive while it is loading (Record pressed, Load pressed, auto-load at start)
 * wait for the SAME load instead of failing or starting a second one.
 */
function handleLoadModel() {
  const modelId = els.modelSelect.value;
  if (state.model && state.modelId === modelId) return Promise.resolve(true);
  if (state.modelPromise && state.modelPromiseId === modelId) return state.modelPromise;
  if (state.modelLoading) return state.modelPromise || Promise.resolve(false);
  state.modelPromiseId = modelId;
  state.modelPromise = doLoadModel(modelId).finally(() => {
    state.modelPromise = null;
    state.modelPromiseId = null;
  });
  return state.modelPromise;
}

async function doLoadModel(modelId) {
  state.modelLoading = true;
  els.loadModel.disabled = true;
  els.modelSelect.disabled = true;
  els.modelProgress.hidden = false;
  setProgress(0);
  els.modelStatus.textContent = t('model.downloading');
  updateRecordButtons();

  try {
    state.model = await loadModel(modelId, onModelProgress);
    state.modelId = modelId;
    els.modelStatus.textContent = `${t('model.ready')}${
      libraryVersion() ? ` (transformers ${libraryVersion()})` : ''
    }`;
    setProgress(100);
    try {
      localStorage.setItem(STORAGE.model, modelId);
      // Remember that this model is already on the device: next launch loads it
      // from the browser cache by itself, no tap and no download.
      localStorage.setItem(STORAGE.modelReady, modelId);
    } catch (error) {
      console.warn('model id persist failed', error);
    }
    keepStorage();
    setGlobalStatus('');
    return true;
  } catch (error) {
    state.model = null;
    state.modelId = null;
    els.modelStatus.textContent = t('model.loadFail', { message: error.message });
    els.modelProgress.hidden = true;
    setGlobalStatus(t('model.loadFail', { message: error.message }));
    return false;
  } finally {
    state.modelLoading = false;
    els.loadModel.disabled = false;
    els.modelSelect.disabled = false;
    updateRecordButtons();
  }
}

/** Ask the browser not to evict the cached model weights when space runs low. */
function keepStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (error) {
    /* optional */
  }
}

/**
 * If the model was loaded on this device before, load it again quietly in the
 * background (weights come from the browser cache, nothing is downloaded), so
 * it is ready by the time the person presses Record.
 */
function autoLoadModel() {
  let ready = null;
  try {
    ready = localStorage.getItem(STORAGE.modelReady);
  } catch (error) {
    return;
  }
  if (!ready || !MODELS.some((m) => m.id === ready)) return;
  els.modelSelect.value = ready;
  const run = () => {
    handleLoadModel();
  };
  // Let the home screen paint first.
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 3000 });
  else window.setTimeout(run, 1200);
}

function onModelProgress(progress) {
  if (progress.status === 'progress' && typeof progress.progress === 'number') {
    setProgress(progress.progress);
    const pct = Math.round(progress.progress);
    if (progress.file) els.modelStatus.textContent = `${progress.file} — ${pct}%`;
    if (progress.file) setGlobalStatus(t('model.downloadingPct', { pct }));
  } else if (progress.status === 'initiate' && progress.file) {
    els.modelStatus.textContent = t('model.start', { file: progress.file });
  } else if (progress.status === 'done' && progress.file) {
    els.modelStatus.textContent = t('model.done', { file: progress.file });
  } else if (progress.status === 'ready') {
    els.modelStatus.textContent = t('model.readying');
  }
}

function setProgress(percent) {
  els.modelProgressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

// ----------------------------------------------------------------- search

async function runSearch() {
  const raw = els.searchInput.value.trim();
  if (!raw) {
    els.searchResults.innerHTML = '';
    return;
  }

  const ref = raw.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
  if (ref) {
    const surah = Number(ref[1]);
    const aya = Number(ref[2]);
    if (surah >= 1 && surah <= 114 && aya >= 1) await jumpToAya(surah, aya);
    return;
  }

  const juzMatch = raw.match(/^(?:juz\s*)?(\d{1,2})$/i);
  if (juzMatch) {
    const juz = Number(juzMatch[1]);
    if (juz >= 1 && juz <= 30) {
      const list = juzAyahs(juz);
      renderSearchResults(list, t('list.juz', { juz, total: list.length }));
      return;
    }
  }

  const needle = normalizeArabic(raw);
  if (needle.length < 2) {
    els.searchResults.innerHTML = '';
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = t('list.minChars');
    els.searchResults.appendChild(hint);
    return;
  }

  const found = [];
  for (let surah = 1; surah <= 114 && found.length < 100; surah += 1) {
    const total = ayaCount(surah);
    for (let aya = 1; aya <= total && found.length < 100; aya += 1) {
      const text = getVerses(surah, aya, aya)[0];
      if (!text) continue;
      if (normalizeArabic(text.ayaText || text.text).includes(needle)) found.push({ surah, aya });
    }
  }
  renderSearchResults(found, t('list.results', { query: raw, total: found.length }));
}

function renderSearchResults(list, heading) {
  els.ayaList.hidden = true;
  els.searchResults.hidden = false;
  els.searchResults.innerHTML = '';

  const title = document.createElement('p');
  title.className = 'list-title';
  title.textContent = heading;
  els.searchResults.appendChild(title);

  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = t('list.noResults');
    els.searchResults.appendChild(empty);
    return;
  }

  for (const item of list) {
    const verse = getVerses(item.surah, item.aya, item.aya)[0];
    if (!verse) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-hit';
    const ref = document.createElement('span');
    ref.className = 'search-hit-ref';
    ref.textContent = `${item.surah}:${item.aya}`;
    const text = document.createElement('span');
    text.className = 'search-hit-text';
    text.lang = 'ar';
    text.dir = 'rtl';
    text.textContent = verse.ayaText || verse.text;
    button.append(ref, text);
    button.addEventListener('click', () => jumpToAya(item.surah, item.aya));
    els.searchResults.appendChild(button);
  }
}

async function jumpToAya(surah, aya) {
  state.mode = 'surah';
  state.surah = clamp(surah, 1, 114);
  els.surahSelect.value = String(state.surah);
  applyMode();
  await showList();

  setResume(keyOf(state.surah, aya));

  const index = state.verses.findIndex((verse) => verse.aya === aya);
  if (index < 0) return;
  state.visible = Math.max(CHUNK, index + 1);
  renderList();

  const card = document.getElementById(`card-${idOf(keyOf(state.surah, aya))}`);
  if (card) {
    card.classList.add('is-flash');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => card.classList.remove('is-flash'), 1600);
  }
}

// ------------------------------------------------------------------ views

/** Mount a section the first time it is needed (keeps the first screen light). */
function ensureMounted(name) {
  if (moreViews[name]) return;
  if (name === 'daily') moreViews.daily = mountDaily(els.dailyRoot);
  else if (name === 'homeNoor') moreViews.homeNoor = mountDaily(els.homeNoor, { compact: true });
  else if (name === 'tasbeeh') moreViews.tasbeeh = mountTasbeeh(els.tasbeehRoot);
  else if (name === 'qibla') moreViews.qibla = mountQibla(els.qiblaRoot);
  else if (name === 'calendar') moreViews.calendar = mountCalendar(els.calendarRoot);
  else if (name === 'duas') moreViews.duas = mountDuas(els.duaRoot);
  else if (name === 'khatam') moreViews.khatam = mountKhatam(els.khatamRoot);
  else if (name === 'hifz') moreViews.hifz = mountHifz(els.hifzRoot);
  else if (name === 'hztest') {
    moreViews.hztest = mountHifzTest(els.hztestRoot, {
      ensureQuran: () => loadQuranInBackground(),
      ensureModel: async () => {
        if (state.model) return state.model;
        const ok = await handleLoadModel();
        return ok ? state.model : null;
      },
    });
  } else if (name === 'report') {
    moreViews.report = mountReport(els.reportRoot, {
      openAya: async (surah, aya) => {
        setView('reader');
        await jumpToAya(surah, aya);
      },
    });
  } else if (name === 'prayer') {
    moreViews.prayer = mountPrayer(els.prayerRoot);
  } else if (name === 'badges') {
    moreViews.badges = mountBadges(els.badgesRoot);
  } else if (name === 'murajaa') {
    moreViews.murajaa = mountMurajaa(els.murajaaRoot, {
      openAya: async (surah, aya) => {
        setView('reader');
        await jumpToAya(surah, aya);
      },
      onDone: ({ due }) => {
        paintMurajaaCount();
        toast(t('murajaa.doneToast', { date: due }));
      },
    });
  }
}

/** The four Premium tabs: Hifz plan, Hifz Test, Murajaa and the report. */
const PREMIUM_TABS = { plan: 'hifz', test: 'hztest', murajaa: 'murajaa', report: 'report' };
let premiumTab = 'plan';
let namazTab = 'times';

/** Show one Premium tab; only Premium has them at all. */
function setPremiumTab(tab) {
  const key = PREMIUM_TABS[tab] ? tab : 'plan';
  if (premiumTab === 'test' && key !== 'test') moreViews.hztest?.stop?.();
  premiumTab = key;

  for (const button of document.querySelectorAll('[data-premium-tab]')) {
    button.classList.toggle('is-active', button.dataset.premiumTab === key);
  }
  const panels = {
    plan: els.premiumPlan,
    test: els.premiumTest,
    murajaa: els.premiumMurajaa,
    report: els.premiumReport,
  };
  for (const [id, panel] of Object.entries(panels)) {
    if (panel) panel.hidden = id !== key;
  }

  const mounted = PREMIUM_TABS[key];
  ensureMounted(mounted);
  if (typeof moreViews[mounted]?.refresh === 'function') moreViews[mounted].refresh();
}

/** Premium in one screen: plans when free, the four tools once it is paid. */
function paintPremiumTabs() {
  const on = isPremium();
  if (els.premiumTabs) els.premiumTabs.hidden = !on;
  if (els.premiumChart) els.premiumChart.hidden = on;
  if (on) setPremiumTab(premiumTab);
}

/** Auqaat, Qibla and the Azaan card live on one screen, under three tabs. */
function setNamazTab(tab) {
  const key = ['times', 'qibla', 'adhan'].includes(tab) ? tab : 'times';
  namazTab = key;

  if (els.namazTabs) {
    for (const button of els.namazTabs.querySelectorAll('[data-namaz-tab]')) {
      button.classList.toggle('is-active', button.dataset.namazTab === key);
    }
  }
  if (els.namazTimes) els.namazTimes.hidden = key !== 'times';
  if (els.namazQibla) els.namazQibla.hidden = key !== 'qibla';
  if (els.namazAdhan) els.namazAdhan.hidden = key !== 'adhan';

  if (key === 'times') {
    ensureMounted('prayer');
    if (typeof moreViews.prayer?.refresh === 'function') moreViews.prayer.refresh();
  }
  if (key === 'qibla') ensureMounted('qibla');
  else moreViews.qibla?.stop?.();
}

// ------------------------------------------------------------- back button
// Screens are kept in a small trail, so the phone's back button (and the
// left-edge swipe on a new iPhone) goes back one screen — never straight to the
// first page.
const navStack = [];
let navSkipPush = false;

function pushHistory() {
  try {
    history.pushState({ bayyin: true }, '');
  } catch (error) {
    /* some in-app browsers refuse */
  }
}

function rememberNav(name) {
  if (navSkipPush) return;
  if (navStack[navStack.length - 1] === name) return;
  navStack.push(name);
  if (navStack.length > 30) navStack.shift();
  pushHistory();
}

/**
 * Work the back out here, then leave a fresh history entry behind so that the
 * NEXT back is caught the same way. Without that, a web view with a single
 * history entry sends the person straight to the start.
 */
function handleBack() {
  // The full-screen mushaf is a layer over the reader: back leaves it first.
  if (state.mushafFull && state.mode === 'page') {
    state.mushafFull = false;
    document.body.classList.remove('is-mushaf-full');
    const page = els.ayaList ? els.ayaList.querySelector('.mushaf-page') : null;
    if (page) {
      paintMushafToggle(page.querySelector('.mushaf-toggle'));
      refitMushafSoon();
    }
    pushHistory();
    return;
  }

  const had = navStack.length > 1;
  if (had) navStack.pop();
  const target = navStack[navStack.length - 1] || 'home';
  navSkipPush = true;
  setView(target);
  navSkipPush = false;
  // Keep one entry behind us while there is a trail, so the phone's back goes
  // home first and only a second press at home leaves the app.
  if (had) pushHistory();
}

/** One step back, through the browser so both stay in step. */
function navigateBack() {
  try {
    history.back();
  } catch (error) {
    handleBack();
  }
}

window.addEventListener('popstate', handleBack);

function watchBackSwipe() {
  let start = null;
  document.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 1) {
        start = null;
        return;
      }
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY, at: Date.now() };
    },
    { passive: true }
  );
  document.addEventListener(
    'touchend',
    (event) => {
      if (!start) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const edge = start.x < 26;
      const quick = Date.now() - start.at < 800;
      start = null;
      if (!edge || !quick) return;
      if (dx < 70 || Math.abs(dy) > 70) return;
      // Never while the welcome screen or the splash is in front.
      if (document.querySelector('#welcome:not([hidden]), #splash:not(.is-gone)')) return;
      navigateBack();
    },
    { passive: true }
  );
}

/** Show exactly one section, keep the bottom bar in step, and stop what is not on screen. */
function setView(view, tab) {
  let name = view;
  let tabName = tab;

  // The Hifz plan, the Hifz Test, Murajaa and the report all live in one
  // Premium screen now; every way in (a card, a reminder, the home list) comes
  // through here.
  if (name === 'hifz' || name === 'hztest' || name === 'murajaa' || name === 'report') {
    if (!isPremium()) {
      toast(t('premium.locked'));
      name = 'premium';
      tabName = undefined;
    } else {
      tabName = name;
      name = 'premium';
    }
  }
  // Namaz: times, qibla and azaan are one screen with three tabs.
  if (name === 'prayer') {
    name = 'namaz';
    tabName = tabName || 'times';
  }
  if (name === 'qibla') {
    name = 'namaz';
    tabName = 'qibla';
  }
  // The reader is the first screen; the old "home" is the same page.
  if (name === 'home') name = 'reader';

  const sections = {
    reader: els.viewReader,
    settings: els.viewSettings,
    home: els.viewHome,
    more: els.viewMore,
    dua: els.viewDua,
    daily: els.viewDaily,
    tasbeeh: els.viewTasbeeh,
    namaz: els.viewNamaz,
    calendar: els.viewCalendar,
    khatam: els.viewKhatam,
    badges: els.viewBadges,
    premium: els.viewPremium,
  };

  if (currentView === 'namaz' && name !== 'namaz') moreViews.qibla?.stop?.();
  if (currentView === 'dua' && name !== 'dua') moreViews.duas?.stop();
  if (currentView === 'tasbeeh' && name !== 'tasbeeh') moreViews.tasbeeh?.stop();
  if (name !== 'reader') stopAyaAudio();
  if (name !== 'reader') document.body.classList.remove('is-mushaf-full');
  if (name === 'reader' && state.mode === 'page' && state.mushafFull !== false) {
    document.body.classList.add('is-mushaf-full');
  }
  currentView = name;

  for (const [key, element] of Object.entries(sections)) {
    if (element) element.hidden = key !== name;
  }

  if (name === 'home') ensureMounted('homeNoor');
  if (name === 'daily') ensureMounted('daily');
  if (name === 'tasbeeh') ensureMounted('tasbeeh');
  if (name === 'calendar') ensureMounted('calendar');
  if (name === 'dua') ensureMounted('duas');
  if (name === 'khatam') ensureMounted('khatam');
  if (name === 'badges') ensureMounted('badges');
  if (name === 'namaz') setNamazTab(tabName || namazTab);
  if (name === 'khatam') moreViews.khatam?.refresh();
  if (name === 'badges') moreViews.badges?.refresh();
  if (name === 'home') {
    paintHomeTodo();
    paintMurajaaCount();
  }
  if (name === 'settings') {
    renderPremiumCard();
    renderAccuracyCard();
    paintErrors();
  }
  if (name === 'premium') {
    renderPremium();
    paintPremiumTabs();
    loadQuranInBackground();
  }
  if (name === 'reader') refitMushafSoon();
  if (name === 'daily') moreViews.daily?.refresh();
  if (name === 'tasbeeh') moreViews.tasbeeh?.refresh();
  if (name === 'calendar') moreViews.calendar?.refresh();
  if (name === 'reader') loadQuranInBackground();

  const navKey = {
    home: 'reader',
    reader: 'reader',
    namaz: 'namaz',
    more: 'more',
    premium: 'more',
    dua: 'dua',
    tasbeeh: 'tasbeeh',
    daily: '',
    khatam: 'more',
    calendar: 'more',
    badges: 'more',
    settings: '',
  }[name];
  document.querySelectorAll('.bn-item').forEach((item) => {
    const on = item.dataset.nav === navKey;
    item.classList.toggle('is-on', on);
    if (on) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  rememberNav(name);
}

function openSettings() {
  setView('settings');
  if (els.modelStatus && !els.modelStatus.textContent) {
    els.modelStatus.textContent = t('model.status');
  }
  renderTajweed();
  renderProgress();
}

function closeSettings() {
  setView('home');
}

// ---------------------------------------------------------------- premium

function premiumStatusText() {
  const s = premiumState();
  if (s.phase === 'open') return t('premium.statusOpen');
  if (s.phase === 'paid') {
    // No date = a lifetime gift (or a demo unlock): never say "until".
    if (!s.expires) return t('premium.statusLife');
    const date = new Date(s.expires).toLocaleDateString();
    return t('premium.statusPaid', { date });
  }
  if (s.phase === 'trial') return t('premium.statusTrial', { days: Math.max(1, s.trialDaysLeft) });
  return t('premium.statusFree', { left: s.remaining, limit: s.limit });
}

/** The plan block in Settings. */
function renderPremiumCard() {
  if (els.premiumStatus) els.premiumStatus.textContent = premiumStatusText();
  if (els.openPremium) {
    els.openPremium.textContent =
      premiumState().phase === 'paid' ? t('premium.manage') : t('premium.open');
  }
}

/**
 * Settings: how often the checker's verdict was actually right. The person
 * rates each result ("Sahi tha / Galat tha") and this counts it — the only
 * honest way to know, instead of a guess.
 */
function renderAccuracyCard() {
  const root = els.accuracyRoot;
  if (!root) return;
  root.textContent = '';

  const data = accuracyStats();
  const pct = accuracyPercent(data);

  const line = document.createElement('p');
  line.className = 'hint';
  line.textContent =
    pct === null
      ? t('accuracy.none')
      : t('accuracy.line', { ok: data.ok, total: data.total, pct });
  root.appendChild(line);

  if (!data.total) return;

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'btn ghost small';
  reset.textContent = t('accuracy.reset');
  reset.addEventListener('click', () => {
    resetAccuracy();
    renderAccuracyCard();
  });
  root.appendChild(reset);
}

function premiumLine(text) {
  const row = document.createElement('li');
  const mark = document.createElement('span');
  mark.className = 'premium-mark';
  mark.textContent = '✓';
  const body = document.createElement('span');
  body.textContent = text;
  row.append(mark, body);
  return row;
}

/**
 * "Gift code hai?" — a code from the owner (or from anyone the owner gave one to)
 * opens Premium on this phone. Checked on the phone, offline; see gift.js.
 */
function giftBox() {
  const box = document.createElement('div');
  box.className = 'gift-box';

  const title = document.createElement('h4');
  title.textContent = t('gift.title');

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = t('gift.hint');

  const row = document.createElement('div');
  row.className = 'gift-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'gift-input';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'characters');
  input.placeholder = 'BAYYIN-365-XXXX-XXXXXX';

  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'btn primary small';
  go.textContent = t('gift.redeem');

  const note = document.createElement('p');
  note.className = 'hint';
  note.hidden = true;

  const submit = () => {
    const result = redeemGift(input.value);
    if (!result.ok) {
      note.hidden = false;
      note.textContent = result.reason === 'bad' ? t('gift.bad') : t('gift.badFormat');
      return;
    }
    toast(result.owner ? t('gift.owner') : t('gift.ok'));
    renderPremium();
    renderPremiumCard();
    paintPremiumTabs();
  };

  go.addEventListener('click', submit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submit();
  });

  row.append(input, go);
  box.append(title, hint, row, note);
  return box;
}

/**
 * The gift block for someone who already has it: the line saying what they have,
 * and — for the owner — the tool that makes codes for other people.
 */
function giftInfo(gift) {
  const box = document.createElement('div');
  box.className = 'gift-box';

  const line = document.createElement('p');
  line.className = 'hint';
  line.textContent = gift.lifetime
    ? t('gift.activeLife')
    : t('gift.activeLine', { date: new Date(gift.until).toLocaleDateString() });
  box.appendChild(line);

  if (!gift.owner) return box;

  const title = document.createElement('h4');
  title.textContent = t('gift.makeTitle');

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = t('gift.makeHint');

  const choices = document.createElement('div');
  choices.className = 'gift-choices';

  const out = document.createElement('output');
  out.className = 'gift-code';
  out.textContent = '—';

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'btn ghost small';
  copy.textContent = t('gift.copy');
  copy.disabled = true;
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(out.textContent);
      toast(t('gift.copied'));
    } catch (error) {
      // No clipboard permission: select the code so it can be copied by hand.
      const range = document.createRange();
      range.selectNodeContents(out);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      toast(t('gift.copyManual'));
    }
  });

  for (const [days, label] of [
    [30, t('gift.month')],
    [365, t('gift.year')],
    [0, t('gift.life')],
  ]) {
    const make = document.createElement('button');
    make.type = 'button';
    make.className = 'btn ghost small';
    make.textContent = label;
    make.addEventListener('click', () => {
      out.textContent = makeGiftCode(days);
      copy.disabled = false;
    });
    choices.appendChild(make);
  }

  box.append(title, hint, choices, out, copy);
  return box;
}

let askedStorePrices = false;
// The words the browser used for the last purchase failure, shown on the paywall.
let lastPurchaseError = '';

/**
 * A purchase that did not finish: say what actually went wrong — Chrome's own
 * error name and message — instead of a friendly line that hides the cause.
 */
function purchaseFailure(result) {
  const name = result && result.name ? String(result.name) : '';
  const message = result && result.message ? String(result.message) : '';
  lastPurchaseError = [name, message].filter(Boolean).join(': ');
  if (!lastPurchaseError) lastPurchaseError = String((result && result.reason) || '');
  toast(lastPurchaseError || t('premium.purchaseFailed'));
  renderPremium();
  renderPremiumCard();
}

/** The paywall: region prices, the trial, the free limits and demo switches. */
function renderPremium() {
  const root = els.premiumRoot;
  if (!root) return;
  const s = premiumState();

  // On a Play build the price on the card must be the one Play will charge, not
  // a converted guess: ask the store once, then repaint with its answer.
  if (billingAvailable() && !askedStorePrices) {
    askedStorePrices = true;
    billingRefreshPrices()
      .then((ok) => {
        if (ok && els.viewPremium && !els.viewPremium.hidden) renderPremium();
      })
      .catch(() => {
        /* the converted price stays */
      });
  }
  root.innerHTML = '';
  root.className = 'premium';

  const status = document.createElement('p');
  status.className = 'premium-status';
  status.textContent = premiumStatusText();
  root.appendChild(status);

  if (s.phase !== 'paid') {
    const regionLine = document.createElement('p');
    regionLine.className = 'hint';
    const where = regionName(s.prices.region) || t('premium.worldwide');
    regionLine.textContent = t('premium.region', { region: where });
    root.appendChild(regionLine);

    const grid = document.createElement('div');
    grid.className = 'premium-plans';
    for (const id of ['yearly', 'monthly']) {
      if (!PLANS[id]) continue;
      const price = id === 'yearly' ? s.prices.yearly : s.prices.monthly;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = id === 'yearly' ? 'premium-plan is-best' : 'premium-plan';

      const name = document.createElement('span');
      name.className = 'premium-plan-name';
      name.textContent = id === 'yearly' ? t('premium.yearly') : t('premium.monthly');

      const amount = document.createElement('strong');
      amount.className = 'premium-plan-price';
      amount.textContent = price.label;

      const note = document.createElement('span');
      note.className = 'premium-plan-note';
      note.textContent = id === 'yearly' ? t('premium.yearlyNote') : t('premium.monthlyNote');

      if (id === 'yearly') {
        const badge = document.createElement('span');
        badge.className = 'premium-badge';
        badge.textContent = t('premium.bestValue');
        card.appendChild(badge);
      }
      card.append(name, amount, note);
      card.addEventListener('click', async () => {
        if (billingAvailable()) {
          card.disabled = true;
          const result = await billingBuy(id);
          card.disabled = false;
          if (result.ok) {
            lastPurchaseError = '';
            toast(t('premium.activated'));
            renderPremium();
            renderPremiumCard();
            paintPremiumTabs();
          } else if (result.reason === 'cancelled') {
            /* the person closed Play's sheet: say nothing */
          } else {
            purchaseFailure(result);
          }
          return;
        }
        if (DEMO_UI) {
          activatePlan(id);
          toast(t('premium.activated'));
          renderPremium();
          renderPremiumCard();
          paintPremiumTabs();
          return;
        }
        toast(t('premium.notAvailable'));
      });
      grid.appendChild(card);
    }
    root.appendChild(grid);

    const hint = document.createElement('p');
    hint.className = 'hint';
    // In a browser there is no Play Billing, so a card can never charge anyone:
    // say that in plain words instead of leaving a tap to fall on a toast.
    hint.textContent = billingAvailable() ? t('premium.buyHint') : t('premium.notAvailable');
    root.appendChild(hint);

    // Whatever went wrong last time, in the browser's own words, until it works.
    if (lastPurchaseError) {
      const errLine = document.createElement('p');
      errLine.className = 'hint';
      errLine.textContent = lastPurchaseError;
      root.appendChild(errLine);
    }

    // Play asks that the renewal terms are on screen before anyone subscribes.
    if (billingAvailable()) {
      const terms = document.createElement('p');
      terms.className = 'hint';
      terms.textContent = t('premium.renewNote');
      root.appendChild(terms);
    }

    if (billingAvailable()) {
      const restore = document.createElement('button');
      restore.type = 'button';
      restore.className = 'btn ghost small';
      restore.textContent = t('premium.restore');
      restore.addEventListener('click', async () => {
        const result = await billingRestore();
        if (result.ok) {
          lastPurchaseError = '';
          toast(t('premium.restored'));
          renderPremium();
          renderPremiumCard();
          paintPremiumTabs();
        } else if (result.reason === 'none') {
          toast(t('premium.restoreNone'));
        } else {
          purchaseFailure(result);
        }
      });
      root.appendChild(restore);
    } else if (!DEMO_UI) {
      const note = document.createElement('p');
      note.className = 'hint';
      note.textContent = t('premium.notAvailable');
      root.appendChild(note);
    }
  } else if (billingManageAvailable()) {
    const manage = document.createElement('button');
    manage.type = 'button';
    manage.className = 'btn ghost';
    manage.textContent = t('premium.managePlay');
    manage.addEventListener('click', () => billingManage());
    root.appendChild(manage);
  } else if (DEMO_UI) {
    const manage = document.createElement('button');
    manage.type = 'button';
    manage.className = 'btn ghost';
    manage.textContent = t('premium.demoOff');
    manage.addEventListener('click', () => {
      cancelPlan();
      toast(t('premium.cancelled'));
      renderPremium();
      renderPremiumCard();
    });
    root.appendChild(manage);
  }

  // Gift: a code opens Premium on this phone; the owner also gets the code maker.
  const gift = s.gift || { active: false, owner: false, lifetime: false, until: 0 };
  if (s.on && s.phase === 'paid' && gift.active) {
    root.appendChild(giftInfo(gift));
  } else if (s.on && s.phase !== 'paid') {
    root.appendChild(giftBox());
  }

  const features = document.createElement('div');
  features.className = 'premium-features';

  const freeBox = document.createElement('div');
  freeBox.className = 'premium-feature';
  const freeTitle = document.createElement('h4');
  freeTitle.textContent = t('premium.freeHeading');
  const freeList = document.createElement('ul');
  for (const key of ['premium.free1', 'premium.free2', 'premium.free3']) {
    freeList.appendChild(premiumLine(t(key)));
  }
  freeBox.append(freeTitle, freeList);

  const proBox = document.createElement('div');
  proBox.className = 'premium-feature is-pro';
  const proTitle = document.createElement('h4');
  proTitle.textContent = t('premium.proHeading');
  const proList = document.createElement('ul');
  for (const key of ['premium.pro1', 'premium.pro2', 'premium.pro3', 'premium.pro4', 'premium.pro5']) {
    proList.appendChild(premiumLine(t(key)));
  }
  proBox.append(proTitle, proList);

  features.append(freeBox, proBox);
  root.appendChild(features);

  if (DEMO_UI) {
    const demo = document.createElement('p');
    demo.className = 'hint';
    demo.textContent = t('premium.demoNote');
    root.appendChild(demo);

    const tools = document.createElement('div');
    tools.className = 'premium-tools';
    if (!s.premium) {
      const on = document.createElement('button');
      on.type = 'button';
      on.className = 'btn ghost small';
      on.textContent = t('premium.demoOn');
      on.addEventListener('click', () => {
        activatePlan('monthly');
        toast(t('premium.activated'));
        renderPremium();
        renderPremiumCard();
      });
      tools.appendChild(on);
    }
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'btn ghost small';
    skip.textContent = t('premium.resetTrial');
    skip.addEventListener('click', () => {
      resetDemo();
      toast(t('premium.reset'));
      renderPremium();
      renderPremiumCard();
    });
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.className = 'btn ghost small';
    jump.textContent = t('premium.skipTrial');
    jump.addEventListener('click', () => {
      skipTrial(4);
      renderPremium();
      renderPremiumCard();
    });
    tools.append(skip, jump);
    root.appendChild(tools);
  }
}

// --------------------------------------------------------------- progress

/** Stats + the starred / memorised / redo lists in Settings. */
function renderProgress() {
  if (!els.progressStats || !els.progressLists) return;
  const s = stats();

  els.progressStats.innerHTML = '';
  const cells = [
    [t('progress.streak'), t('progress.days', { count: s.streak })],
    [t('progress.checked'), String(s.checked)],
    [t('progress.average'), `${s.average}%`],
    [t('progress.okCount'), String(s.ok)],
    [t('progress.redoCount'), String(s.redo)],
    [t('progress.starCount'), String(s.star)],
  ];
  for (const [label, value] of cells) {
    const cell = document.createElement('div');
    cell.className = 'stat';
    const strong = document.createElement('strong');
    strong.textContent = value;
    const span = document.createElement('span');
    span.textContent = label;
    cell.append(strong, span);
    els.progressStats.appendChild(cell);
  }

  els.progressLists.innerHTML = '';
  const groups = [
    ['ok', t('progress.okList')],
    ['redo', t('progress.redoList')],
    ['star', t('progress.starList')],
  ];
  for (const [kind, title] of groups) {
    const keys = listOf(kind);
    if (!keys.length) continue;
    const block = document.createElement('div');
    block.className = 'jump-block';
    const heading = document.createElement('h4');
    heading.textContent = `${title} (${keys.length})`;
    const list = document.createElement('div');
    list.className = 'jump-list';
    for (const key of keys.slice(0, 60)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'jump-btn';
      button.textContent = key;
      button.addEventListener('click', () => goToKey(key));
      list.appendChild(button);
    }
    block.append(heading, list);
    els.progressLists.appendChild(block);
  }
  if (!els.progressLists.children.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = t('progress.empty');
    els.progressLists.appendChild(empty);
  }
}

/** Jump to an aya from the progress lists or the resume chip. */
async function goToKey(key) {
  const [surah, aya] = key.split(':').map(Number);
  if (!surah || !aya) return;
  closeSettings();
  await jumpToAya(surah, aya);
}

function setGlobalStatus(text) {
  if (!els.globalStatus) return;
  els.globalStatus.textContent = text || '';
  els.globalStatus.hidden = !text;
}

function showError(message) {
  els.rangeError.textContent = message;
  els.rangeError.hidden = false;
}

// ------------------------------------------------------------------- share

import { PLAY_URL } from './status-card.js';

async function shareApp() {
  await shareOrCopy({
    title: 'Bayyin (بيّن)',
    text: t('share.text'),
    url: PLAY_URL,
  });
}

async function shareAya(verse) {
  const reference = t('share.ref', { name: surahName(verse.surah), aya: verse.aya });
  await shareOrCopy({
    title: reference,
    text: `${reference}\n\n${verse.text}\n\n${location.href}`,
    url: location.href,
  });
}

async function shareOrCopy(data) {
  try {
    if (navigator.share) {
      await navigator.share(data);
      return;
    }
  } catch (error) {
    if (error && error.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(`${data.text}\n${data.url}`);
    toast(t('share.copied'));
  } catch (error) {
    toast(t('share.unsupported'));
  }
}

// ----------------------------------------------------------------- tajweed

function renderTajweed() {
  if (!els.tajweed) return;
  els.tajweed.innerHTML = '';
  const verse = state.verses[0];
  if (!verse) {
    els.tajweed.textContent = t('tajweed.pick');
    return;
  }
  const hints = tajweedHints(verse.ayaText || verse.text, 8);
  if (!hints.length) {
    els.tajweed.textContent = t('tajweed.none', { ref: `${verse.surah}:${verse.aya}` });
    return;
  }
  const intro = document.createElement('p');
  intro.className = 'hint';
  intro.textContent = t('tajweed.intro', {
    ref: `${surahName(verse.surah)} ${verse.aya}`,
  });
  els.tajweed.appendChild(intro);
  const list = document.createElement('ul');
  list.className = 'hint-list';
  for (const hint of hints) {
    const li = document.createElement('li');
    li.className = 'hint-item';
    const glyph = document.createElement('span');
    glyph.className = 'glyph';
    glyph.lang = 'ar';
    glyph.dir = 'rtl';
    glyph.textContent = hint.glyph;
    const rule = document.createElement('span');
    rule.className = 'rule-name';
    rule.textContent = hint.rule;
    const note = document.createElement('span');
    note.textContent = hint.note;
    li.append(glyph, rule, note);
    list.appendChild(li);
  }
  els.tajweed.appendChild(list);
}

// --------------------------------------------------------------- mic check

async function runMicCheck() {
  if (!els.micCheckOutput || state.recording) return;
  state.micChecking = true;
  updateRecordButtons();
  els.micCheckOutput.hidden = false;
  const items = [];
  const render = () => {
    els.micCheckOutput.innerHTML = '';
    for (const item of items) {
      const li = document.createElement('li');
      li.className = item.ok === true ? 'diag-ok' : item.ok === false ? 'diag-bad' : 'diag-wait';
      const label = document.createElement('span');
      label.className = 'diag-label';
      label.textContent = item.label;
      const value = document.createElement('span');
      value.textContent = item.value;
      li.append(label, value);
      els.micCheckOutput.appendChild(li);
    }
  };
  const push = (label, value, ok = null) => {
    const existing = items.find((item) => item.label === label);
    if (existing) {
      existing.value = value;
      existing.ok = ok;
    } else {
      items.push({ label, value, ok });
    }
    render();
  };

  const support = micSupport();
  push(t('diag.secure'), support.secure ? t('diag.yes') : t('diag.no'), support.secure);
  push(t('diag.micApi'), support.hasApi ? t('diag.present') : t('diag.no'), support.hasApi);
  push(t('diag.permission'), await micPermissionState(), null);

  try {
    const recorder = await startRecording({ maxSeconds: 8 });
    push(t('diag.record'), t('diag.running'), null);
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
    const peak = recorder.getPeak();
    const blob = await recorder.stop();
    push(t('diag.record'), t('diag.bytes', { bytes: blob.size }), blob.size > 0);
    if (peak >= 0) {
      push(t('diag.sound'), peak >= 0.01 ? t('diag.good') : t('diag.low'), peak >= 0.01);
    }
  } catch (error) {
    push(t('diag.record'), error.message, false);
  } finally {
    state.micChecking = false;
    updateRecordButtons();
  }
}

// ----------------------------------------------------------------- events

function setMode(mode) {
  // Entering the Mushaf tab always starts on the full page; leaving it forgets
  // the choice so the next visit is a full page again.
  if (mode === 'page' && state.mode !== 'page') state.mushafFull = true;
  state.mode = mode;
  applyMode();
  if (mode === 'search') {
    els.ayaList.hidden = true;
    els.searchResults.hidden = false;
    els.listTitle.textContent = t('list.searchTitle');
    return;
  }
  els.searchResults.hidden = true;
  els.ayaList.hidden = false;
  showList();
}

/** "Aaj baaki hai" cards on Home (Khatam / Hifz). */
function paintHomeTodo() {
  if (!els.homeTodo) return;
  els.homeTodo.textContent = '';

  const due = isPremium() ? dueCount() : 0;
  if (due) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'todo-item';
    row.innerHTML = '<span class="todo-dot"></span><span class="todo-text"></span><span aria-hidden="true">›</span>';
    row.querySelector('.todo-text').textContent = t('murajaa.todo', { n: due });
    row.addEventListener('click', () => setView('murajaa'));
    els.homeTodo.appendChild(row);
  }

  for (const item of pendingToday()) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'todo-item';
    row.innerHTML = '<span class="todo-dot"></span><span class="todo-text"></span><span aria-hidden="true">›</span>';
    row.querySelector('.todo-text').textContent = item.text;
    row.addEventListener('click', () => setView(item.view));
    els.homeTodo.appendChild(row);
  }
}

window.addEventListener('bayyin:planner', paintHomeTodo);
window.addEventListener('bayyin:hztest', async (event) => {
  const items = (event.detail && event.detail.items) || [];
  setView('hztest');
  await loadQuranInBackground();
  moreViews.hztest?.startCustom(items);
});
window.addEventListener('bayyin:open', async (event) => {
  const detail = event.detail || {};
  setView('reader');
  await loadQuranInBackground();
  if (detail.page) {
    state.mode = 'page';
    state.page = clamp(detail.page, 1, pageMax());
    applyMode();
    await showList();
  } else if (detail.surah) {
    await jumpToAya(detail.surah, detail.aya || 1);
  }
});

function wireEvents() {
  els.openSettings.addEventListener('click', openSettings);

  els.tabSurah.addEventListener('click', () => setMode('surah'));
  els.tabPage.addEventListener('click', () => setMode('page'));
  els.tabSearch.addEventListener('click', () => setMode('search'));

  els.surahSelect.addEventListener('change', () => {
    state.surah = clamp(els.surahSelect.value, 1, 114);
    showList();
  });

  els.mushafSelect.addEventListener('change', () => {
    state.mushaf = els.mushafSelect.value === 'indopak' ? 'indopak' : 'madani';
    state.page = 1;
    updatePageTotal();
    showList();
  });

  els.pageNumber.addEventListener('change', () => {
    state.page = clamp(els.pageNumber.value, 1, pageMax());
    showList();
  });
  // ◀ (left) is the NEXT page and ▶ (right) the previous one: the mus'haf runs
  // right to left, so its next page lies on the left.
  els.pagePrev.addEventListener('click', () => goPage(-1));
  els.pageNext.addEventListener('click', () => goPage(1));
  window.addEventListener('keydown', (event) => {
    if (state.mode !== 'page' || currentView !== 'reader') return;
    const tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (event.key === 'ArrowLeft') goPage(1);
    else if (event.key === 'ArrowRight') goPage(-1);
  });

  els.searchGo.addEventListener('click', runSearch);
  if (els.qariAll) els.qariAll.addEventListener('click', playAll);
  window.addEventListener('resize', () => {
    if (state.mode !== 'page') return;
    if (state.fitFrame) window.cancelAnimationFrame(state.fitFrame);
    state.fitFrame = window.requestAnimationFrame(() => {
      state.fitFrame = 0;
      const page = els.ayaList.querySelector('.mushaf-page');
      if (page) fitMushafPage(page);
    });
  });
  els.searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch();
    }
  });

  els.toggleTheme.addEventListener('click', toggleTheme);
  els.fontSmaller.addEventListener('click', () => stepFont(-1));
  els.fontLarger.addEventListener('click', () => stepFont(1));

  els.loadMore.addEventListener('click', () => {
    state.visible += CHUNK;
    renderList();
  });

  els.shareApp.addEventListener('click', shareApp);

  els.modelSelect.addEventListener('change', () => {
    if (state.model && state.modelId !== els.modelSelect.value) {
      state.model = null;
      state.modelId = null;
      els.modelStatus.textContent = t('model.newOne');
    }
  });
  els.loadModel.addEventListener('click', () => {
    handleLoadModel();
  });

  els.audioFile.addEventListener('change', () => {
    const file = els.audioFile.files && els.audioFile.files[0];
    if (!file) return;
    els.player.src = URL.createObjectURL(file);
    els.player.hidden = false;
    toast(t('audio.loaded'));
  });

  els.micCheck.addEventListener('click', runMicCheck);

  if (els.welcomeStart) els.welcomeStart.addEventListener('click', closeWelcome);
  if (els.welcomeLang) {
    els.welcomeLang.addEventListener('change', () => changeLanguage(els.welcomeLang.value));
  }
  if (els.langSelect) {
    els.langSelect.addEventListener('change', () => changeLanguage(els.langSelect.value));
  }

  if (els.resumeAya) {
    els.resumeAya.addEventListener('click', () => {
      const key = resumeKey();
      if (key) goToKey(key);
    });
  }

  if (els.progressReset) {
    els.progressReset.addEventListener('click', () => {
      if (!window.confirm(t('progress.resetAsk'))) return;
      clearAll();
      renderProgress();
      renderList();
      renderResume();
      toast(t('progress.cleared'));
    });
  }

  const go = (element, view, mode) => {
    if (!element) return;
    element.addEventListener('click', () => {
      setView(view);
      if (mode) setMode(mode);
    });
  };
  go(els.homeMushaf, 'reader');
  go(els.morePremium, 'premium');
  go(els.moreKhatam, 'khatam');
  go(els.moreBadges, 'badges');
  go(els.homeOpenQuran, 'reader');
  go(els.homeDailyAll, 'daily');
  go(els.moreDaily, 'daily');
  go(els.moreCalendar, 'calendar');
  if (els.moreSettings) els.moreSettings.addEventListener('click', openSettings);

  if (els.namazTabs) {
    for (const button of els.namazTabs.querySelectorAll('[data-namaz-tab]')) {
      button.addEventListener('click', () => setNamazTab(button.dataset.namazTab));
    }
  }
  for (const button of document.querySelectorAll('[data-premium-tab]')) {
    button.addEventListener('click', () => setPremiumTab(button.dataset.premiumTab));
  }

  // Every "◀ Wapas" is a real step back, not a jump to the first page.
  for (const closer of [els.closeTasbeeh, els.closeCalendar, els.closeDaily, els.closeDua, els.closeKhatam, els.closeBadges, els.closePremium, els.closeSettings]) {
    if (closer) closer.addEventListener('click', () => navigateBack());
  }
  if (els.openReport) els.openReport.addEventListener('click', () => setView('report'));

  if (els.backupExport) {
    els.backupExport.addEventListener('click', () => {
      const result = backupDownload();
      toast(result.ok ? t('backup.done', { count: result.count }) : t('backup.failed'));
    });
  }

  if (els.backupShare) {
    els.backupShare.addEventListener('click', async () => {
      const result = await backupShare();
      if (result.ok) toast(t('backup.shared', { count: result.count }));
      else toast(t('backup.shareFailed'));
    });
  }

  if (els.backupImport && els.backupFile) {
    els.backupImport.addEventListener('click', () => els.backupFile.click());
    els.backupFile.addEventListener('change', async () => {
      const file = els.backupFile.files && els.backupFile.files[0];
      els.backupFile.value = '';
      if (!file) return;
      const result = await backupRestore(file);
      if (!result.ok) {
        toast(t('backup.badFile'));
        return;
      }
      toast(t('backup.restored', { count: result.count }));
      window.setTimeout(() => window.location.reload(), 1200);
    });
  }

  if (els.errorsCopy) {
    els.errorsCopy.addEventListener('click', async () => {
      const text = readErrors().join('\n') || t('errors.none');
      try {
        await navigator.clipboard.writeText(text);
        toast(t('errors.copied'));
      } catch (error) {
        toast(t('errors.none'));
      }
    });
  }

  if (els.accurateMode) {
    els.accurateMode.addEventListener('change', () => {
      try {
        localStorage.setItem(STORAGE.speed, els.accurateMode.checked ? 'accurate' : 'fast');
      } catch (error) {
        /* private mode: the choice lasts this session only */
      }
    });
  }
  if (els.openPremium) els.openPremium.addEventListener('click', () => setView('premium'));
  window.addEventListener('bayyin:paywall', () => setView('premium'));
  document.querySelectorAll('.bn-item').forEach((item) => {
    item.addEventListener('click', () => setView(item.dataset.nav));
  });
}

function toast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.hidden = false;
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    els.toast.hidden = true;
  }, 3200);
}



// Start last, on purpose: `init()` reaches into consts and lets declared further
// down this file (the Premium tabs, the azaan timer key). Calling it above them
// throws "Cannot access before initialization" and leaves the splash on screen
// forever — which is exactly what a boot at the top of the file did.
try {
  init();
} catch (error) {
  logError(`init: ${error && error.message ? error.message : error}`);
  hideSplash();
}
