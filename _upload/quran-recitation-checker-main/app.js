// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
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
import { loadPages, pageTotal, pageAyahs, juzAyahs } from './quran-pages.js';
import { indopakPage, INDOPAK_PAGES } from './indopak.js';
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
  restore as billingRestore,
} from './billing.js';
import { download as backupDownload, restore as backupRestore } from './backup.js';
import { mountBadges, checkBadges, celebrate } from './badges.js';
import { mountTasbeeh } from './tasbeeh-v2.js';
import { mountReport, recordReport } from './premium-tools.js';
import { mountDuas } from './duas.js';
import { mountHifz, mountKhatam, pendingToday, startReminderLoop } from './planners.js';
import { mountHifzTest } from './hifz-test.js';
import { hijriArabic, todayHijri } from './hijri.js';
import { mountQibla } from './qibla.js';
import { mountCalendar } from './calendar.js';
import { mountDaily } from './daily.js';
import { LANGUAGES, initLanguage, getLanguage, setLanguage, getTarjuma, setTarjuma, t } from './i18n.js';
import {
  DEMO_UI,
  PLANS,
  activate as activatePlan,
  canCheck,
  cancel as cancelPlan,
  isPremium,
  premiumState,
  recordCheck,
  regionName,
  resetDemo,
  skipTrial,
} from './premium.js';
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
  surah: 1,
  page: 1,
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
};

init();

async function init() {
  cacheElements();
  initLanguage();
  fillLanguages();
  fillSurahs();
  fillModels();
  restoreSelection();
  wireEvents();
  setGlobalStatus('');

  window.addEventListener('error', (event) => {
    logError(`${event.message} @ ${event.filename || '?'}:${event.lineno || 0}`);
  });
  window.addEventListener('unhandledrejection', (event) => {
    logError(String(event.reason || 'unhandled rejection'));
  });

  // Show the home screen at once. The Quran text (1.3 MB) loads in the
  // background, so the app opens instantly instead of waiting for it.
  paintHomeDate();
  const go = new URLSearchParams(window.location.search).get('go');
  setView(['dua', 'tasbeeh', 'daily', 'reader', 'qibla', 'calendar', 'prayer'].includes(go) ? go : 'home');
  hideSplash();
  maybeWelcome();
  loadQuranInBackground();
  startReminderLoop();
  handleLaunch();
  autoLoadModel();
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
    'list-title', 'global-status', 'range-error', 'aya-list',
    'list-footer', 'load-more', 'share-app', 'model-select', 'load-model',
    'model-progress', 'model-progress-bar', 'model-status', 'audio-file',
    'accurate-mode',
    'mic-check', 'mic-check-output', 'player', 'tajweed',
    'toast',
    'splash', 'welcome', 'welcome-start', 'welcome-lang', 'lang-select',
    'resume-aya', 'progress-stats', 'progress-lists', 'progress-reset',
    'view-home', 'more-tasbeeh', 'more-qibla', 'more-calendar',
    'home-mushaf', 'home-dua', 'home-open-quran', 'home-todo', 'more-khatam', 'more-hifz',
    'view-khatam', 'view-hifz', 'khatam-root', 'hifz-root', 'close-khatam', 'close-hifz',
    'more-hztest', 'view-hztest', 'hztest-root', 'close-hztest',
    'more-report', 'view-report', 'report-root', 'close-report', 'open-report',
    'more-prayer', 'view-prayer', 'prayer-root', 'close-prayer',
    'more-badges', 'view-badges', 'badges-root', 'close-badges',
    'backup-export', 'backup-import', 'backup-file', 'error-log', 'errors-copy',
    'view-premium', 'close-premium', 'premium-root', 'open-premium', 'premium-status',
    'home-date', 'home-noor', 'view-dua', 'close-dua', 'dua-root', 'bottom-nav',
    'more-daily', 'view-daily', 'close-daily', 'daily-root',
    'view-tasbeeh', 'close-tasbeeh', 'tasbeeh-root',
    'view-qibla', 'close-qibla', 'qibla-root',
    'view-calendar', 'close-calendar', 'calendar-root',
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
}

function updatePageTotal() {
  const total = pageMax();
  els.pageTotal.textContent = t('page.total', { total });
  els.pageNumber.max = String(total);
}

function pageMax() {
  return state.mushaf === 'indopak' ? INDOPAK_PAGES : Math.max(1, pageTotal() || 604);
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
        state.verses = list.map((entry) => verseFromText(entry.surah, entry.aya, entry.text));
        setGlobalStatus('');
        els.listTitle.textContent = t('list.pageIndopak', {
          page: state.page,
          total: INDOPAK_PAGES,
        });
      } else {
        const list = pageAyahs(state.page);
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

  head.append(badge, starButton(key), share);

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
  if (alignment) renderAyaResult(result, alignment);

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

function renderMushafPage() {
  const page = document.createElement('div');
  page.className = 'mushaf-page';
  page.id = 'mushaf-page';
  page.dir = 'rtl';

  if (state.selectedKey) {
    const selected = verseOf(state.selectedKey);
    if (selected) {
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

      bar.append(label, record, starButton(key), markChip(key), share, clear, status);
      page.appendChild(bar);
    }
  }

  const text = document.createElement('div');
  text.className = 'page-text';
  text.lang = 'ar';
  text.dir = 'rtl';

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

    seg.addEventListener('click', () => {
      state.selectedKey = state.selectedKey === key ? null : key;
      if (state.selectedKey) setResume(state.selectedKey);
      renderList();
    });

    text.appendChild(seg);
  });
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

  const record = document.createElement('button');
  record.type = 'button';
  record.className = 'btn primary record-aya';
  record.dataset.recId = 'page';
  record.dataset.label = t('record.page');
  record.textContent = t('record.page');
  record.addEventListener('click', () => {
    const keys = state.verses.map((verse) => keyOf(verse.surah, verse.aya));
    toggleRecording('page', keys);
  });
  actions.appendChild(record);

  const status = document.createElement('p');
  status.className = 'aya-status';
  status.dataset.role = 'status';
  actions.appendChild(status);

  page.appendChild(actions);
  els.ayaList.appendChild(page);
}

function mistakeBlock(key, problems) {
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
    list.appendChild(li);
  }
  block.appendChild(list);
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

  const tokens = source.split(/(\s+)/);
  let wordIndex = -1;
  const notes = [];

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
    target.appendChild(span);
    notes.push(`${token} — ${noteFor(result)}`);
  }

  // Notes sit on their own line: putting Latin text inside the Arabic line
  // breaks the right-to-left flow (and the joining) around that word.
  if (notes.length) {
    const line = document.createElement('div');
    line.className = 'aya-notes';
    line.textContent = notes.join(' · ');
    target.appendChild(line);
  }

  if (alignment.extras && alignment.extras.length) {
    const extra = document.createElement('div');
    extra.className = 'extra-line';
    extra.lang = 'ar';
    extra.dir = 'rtl';
    extra.textContent = t('extra.line', {
      words: alignment.extras.map((e) => e.heard).join(' '),
    });
    target.appendChild(extra);
  }
}

function noteFor(result) {
  if (result.status === WORD_STATUS.MISSING || !result.heard) return t('note.missing');
  if (result.status === WORD_STATUS.CLOSE) return t('note.closeHeard', { word: result.heard });
  return t('note.readHeard', { word: result.heard });
}

function countsLine(c) {
  return [
    `${c.correct} ${t('count.correct')}`,
    c.close ? `${c.close} ${t('count.close')}` : '',
    c.wrong ? `${c.wrong} ${t('count.wrong')}` : '',
    c.missing ? `${c.missing} ${t('count.missing')}` : '',
    c.extra ? `${c.extra} ${t('count.extra')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function renderAyaResult(target, alignment) {
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

  const problems = alignment.results.filter((r) => r.status !== WORD_STATUS.CORRECT);
  if (!problems.length) {
    const ok = document.createElement('p');
    ok.className = 'hint';
    ok.textContent =
      alignment.score === 100 ? t('hint.allWords') : t('hint.noWordErrors');
    target.appendChild(ok);
    return;
  }
  target.appendChild(mistakeBlock('', problems));
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
      text = await transcribe(state.model, audio, { fast: !accurate });
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
  const counts = { correct: 0, close: 0, wrong: 0, missing: 0, extra: extras.length };
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
  }
}

/** Show exactly one section, keep the bottom bar in step, and stop what is not on screen. */
function setView(name) {
  // The Hifz plan, the Hifz Test and the report are Premium: every way in (the
  // More card, the home todo, a reminder) ends up here, so this is the one gate.
  if ((name === 'hifz' || name === 'hztest' || name === 'report') && !isPremium()) {
    toast(t('premium.locked'));
    name = 'premium';
  }
  const sections = {
    reader: els.viewReader,
    settings: els.viewSettings,
    home: els.viewHome,
    dua: els.viewDua,
    daily: els.viewDaily,
    tasbeeh: els.viewTasbeeh,
    qibla: els.viewQibla,
    calendar: els.viewCalendar,
    khatam: els.viewKhatam,
    hifz: els.viewHifz,
    hztest: els.viewHztest,
    report: els.viewReport,
    prayer: els.viewPrayer,
    badges: els.viewBadges,
    premium: els.viewPremium,
  };
  if (currentView === 'qibla' && name !== 'qibla') moreViews.qibla?.stop();
  if (currentView === 'tasbeeh' && name !== 'tasbeeh') moreViews.tasbeeh?.stop();
  if (currentView === 'dua' && name !== 'dua') moreViews.duas?.stop();
  if (currentView === 'hztest' && name !== 'hztest') moreViews.hztest?.stop();
  currentView = name;

  for (const [key, element] of Object.entries(sections)) {
    if (element) element.hidden = key !== name;
  }

  if (name === 'home') ensureMounted('homeNoor');
  if (name === 'daily') ensureMounted('daily');
  if (name === 'tasbeeh') ensureMounted('tasbeeh');
  if (name === 'qibla') ensureMounted('qibla');
  if (name === 'calendar') ensureMounted('calendar');
  if (name === 'dua') ensureMounted('duas');
  if (name === 'khatam') ensureMounted('khatam');
  if (name === 'hifz') ensureMounted('hifz');
  if (name === 'hztest') ensureMounted('hztest');
  if (name === 'report') ensureMounted('report');
  if (name === 'prayer') ensureMounted('prayer');
  if (name === 'badges') ensureMounted('badges');
  if (name === 'khatam') moreViews.khatam?.refresh();
  if (name === 'hifz') moreViews.hifz?.refresh();
  if (name === 'hztest') moreViews.hztest?.refresh();
  if (name === 'report') moreViews.report?.refresh();
  if (name === 'prayer') moreViews.prayer?.refresh();
  if (name === 'badges') moreViews.badges?.refresh();
  if (name === 'home') paintHomeTodo();
  if (name === 'settings') {
    renderPremiumCard();
    paintErrors();
  }
  if (name === 'premium') renderPremium();
  if (name === 'daily') moreViews.daily?.refresh();
  if (name === 'tasbeeh') moreViews.tasbeeh?.refresh();
  if (name === 'calendar') moreViews.calendar?.refresh();
  if (name === 'reader') loadQuranInBackground();

  const navKey = { reader: 'reader', settings: '', home: 'home', dua: 'dua', daily: 'daily', tasbeeh: 'tasbeeh' }[name];
  document.querySelectorAll('.bn-item').forEach((item) => {
    const on = item.dataset.nav === navKey;
    item.classList.toggle('is-on', on);
    if (on) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
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
    const date = s.expires ? new Date(s.expires).toLocaleDateString() : '';
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

/** The paywall: region prices, the trial, the free limits and demo switches. */
function renderPremium() {
  const root = els.premiumRoot;
  if (!root) return;
  const s = premiumState();
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
            toast(t('premium.activated'));
            renderPremium();
            renderPremiumCard();
          } else if (result.reason === 'unavailable') {
            toast(t('premium.notAvailable'));
          } else {
            toast(t('premium.purchaseFailed'));
          }
          return;
        }
        if (DEMO_UI) {
          activatePlan(id);
          toast(t('premium.activated'));
          renderPremium();
          renderPremiumCard();
          return;
        }
        toast(t('premium.notAvailable'));
      });
      grid.appendChild(card);
    }
    root.appendChild(grid);

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = t('premium.buyHint');
    root.appendChild(hint);

    if (billingAvailable()) {
      const restore = document.createElement('button');
      restore.type = 'button';
      restore.className = 'btn ghost small';
      restore.textContent = t('premium.restore');
      restore.addEventListener('click', async () => {
        const result = await billingRestore();
        if (result.ok) {
          toast(t('premium.restored'));
          renderPremium();
          renderPremiumCard();
        } else {
          toast(t('premium.restoreNone'));
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
  for (const key of ['premium.pro1', 'premium.pro2', 'premium.pro3', 'premium.pro4']) {
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

async function shareApp() {
  await shareOrCopy({
    title: 'Bayyin (بيّن)',
    text: t('share.text'),
    url: location.href,
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
  els.closeSettings.addEventListener('click', closeSettings);

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
  els.pagePrev.addEventListener('click', () => {
    state.page = clamp(state.page - 1, 1, pageMax());
    showList();
  });
  els.pageNext.addEventListener('click', () => {
    state.page = clamp(state.page + 1, 1, pageMax());
    showList();
  });

  els.searchGo.addEventListener('click', runSearch);
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

  const tarjumaSelect = document.getElementById('tarjuma-select');
  if (tarjumaSelect) {
    tarjumaSelect.value = getTarjuma();
    tarjumaSelect.addEventListener('change', () => {
      setTarjuma(tarjumaSelect.value);
      moreViews.daily?.refresh();
      moreViews.homeNoor?.refresh();
    });
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
  go(els.moreKhatam, 'khatam');
  if (els.moreHifz) {
    els.moreHifz.addEventListener('click', () => {
      if (!isPremium()) {
        setView('premium');
        return;
      }
      setView('hifz');
    });
  }
  go(els.moreHztest, 'hztest');
  go(els.moreReport, 'report');
  go(els.morePrayer, 'prayer');
  go(els.moreBadges, 'badges');
  go(els.homeOpenQuran, 'reader');
  go(els.homeDua, 'dua');
  go(els.moreDaily, 'daily');
  go(els.moreTasbeeh, 'tasbeeh');
  go(els.moreQibla, 'qibla');
  go(els.moreCalendar, 'calendar');
  for (const closer of [
    els.closeTasbeeh,
    els.closeQibla,
    els.closeCalendar,
    els.closeDaily,
    els.closeDua,
    els.closeKhatam,
    els.closeHifz,
    els.closeHztest,
    els.closeReport,
    els.closePrayer,
    els.closeBadges,
    els.closePremium,
  ]) {
    go(closer, 'home');
  }
  if (els.openReport) els.openReport.addEventListener('click', () => setView('report'));

  if (els.backupExport) {
    els.backupExport.addEventListener('click', () => {
      const result = backupDownload();
      toast(result.ok ? t('backup.done', { count: result.count }) : t('backup.failed'));
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
