// Bayyin (بيّن) — Quran reader with recitation checking.
//
// Surah tab: every aya its own card with a Record button.
// Mushaf tab: a whole page as one continuous mushaf (Madani 604 pages from
// bundled Tanzil text, IndoPak 610 pages from Quran.com), one Record button
// for the page plus tap-to-select a single aya.
// Search tab: find by word, by aya (2:255) or by juz (5).

import { SURAHS, surahName } from './surahs.js';
import { loadQuran, isLoaded, ayaCount, getVerses } from './quran.js';
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
import { runSelfTest } from './selftest.js';

const STORAGE = {
  selection: 'tc.selection',
  model: 'tc.modelId',
  hidden: 'tc.textHidden',
  reading: 'tc.reading',
};
const CHUNK = 25;
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const SIZE_MIN = 18;
const SIZE_MAX = 44;
const WEIGHT_MIN = 300;
const WEIGHT_MAX = 800;
const WEIGHT_STEP = 100;

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
  textHidden: false,
  theme: 'light',
  fontSize: 26,
  fontWeight: 400,
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
let toastTimer = null;

init();

async function init() {
  cacheElements();
  fillSurahs();
  fillModels();
  restoreSelection();
  wireEvents();
  setGlobalStatus('');

  try {
    await loadQuran();
  } catch (error) {
    showError('Quran text load nahi hua — page dobara kholein ya internet check karein.');
    return;
  }
  try {
    await loadPages();
  } catch (error) {
    console.warn('page data failed', error);
  }
  updatePageTotal();
  await showList();
}

function cacheElements() {
  const ids = [
    'open-settings', 'close-settings', 'view-reader', 'view-settings',
    'toggle-theme', 'font-smaller', 'font-larger', 'weight-lighter', 'weight-bolder',
    'reading-meta',
    'tab-surah', 'tab-page', 'tab-search',
    'picker-surah', 'picker-page', 'picker-search',
    'surah-select', 'mushaf-select', 'page-prev', 'page-next', 'page-number', 'page-total',
    'search-input', 'search-go', 'search-results',
    'toggle-text', 'list-title', 'global-status', 'range-error', 'aya-list',
    'list-footer', 'load-more', 'share-app', 'model-select', 'load-model',
    'model-progress', 'model-progress-bar', 'model-status', 'audio-file',
    'mic-check', 'mic-check-output', 'player', 'tajweed', 'run-tests',
    'test-results', 'toast',
  ];
  for (const id of ids) {
    const name = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    els[name] = document.getElementById(id);
  }
}

// ------------------------------------------------------------------ setup

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
    state.textHidden = localStorage.getItem(STORAGE.hidden) === '1';
    const modelId = localStorage.getItem(STORAGE.model);
    if (modelId && MODELS.some((m) => m.id === modelId)) els.modelSelect.value = modelId;
  } catch (error) {
    console.warn('selection restore failed', error);
  }

  els.surahSelect.value = String(state.surah);
  els.mushafSelect.value = state.mushaf;
  els.pageNumber.value = String(state.page);
  els.toggleText.textContent = state.textHidden ? 'Text dikhayein' : 'Text chhupayein';

  try {
    const reading = JSON.parse(localStorage.getItem(STORAGE.reading) || 'null');
    if (reading) {
      if (reading.theme === 'dark' || reading.theme === 'light') state.theme = reading.theme;
      if (Number.isFinite(reading.fontSize)) {
        state.fontSize = Math.min(SIZE_MAX, Math.max(SIZE_MIN, reading.fontSize));
      }
      if (Number.isFinite(reading.fontWeight)) {
        state.fontWeight = Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, reading.fontWeight));
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
    localStorage.setItem(STORAGE.hidden, state.textHidden ? '1' : '0');
  } catch (error) {
    console.warn('selection persist failed', error);
  }
}

function clamp(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function weightLabel() {
  if (state.fontWeight <= 350) return 'patla';
  if (state.fontWeight <= 500) return 'aam';
  if (state.fontWeight <= 650) return 'mota';
  return 'bohot mota';
}

function applyReading(persist = true) {
  document.body.dataset.theme = state.theme;
  document.documentElement.style.setProperty('--aya-size', `${state.fontSize}px`);
  document.documentElement.style.setProperty('--aya-weight', String(state.fontWeight));
  if (els.toggleTheme) {
    els.toggleTheme.textContent = state.theme === 'dark' ? '☀' : '🌙';
    els.toggleTheme.setAttribute('aria-pressed', String(state.theme === 'dark'));
  }
  if (els.readingMeta) {
    els.readingMeta.textContent = `${state.fontSize}px · ${weightLabel()}`;
  }
  if (persist) {
    try {
      localStorage.setItem(
        STORAGE.reading,
        JSON.stringify({
          theme: state.theme,
          fontSize: state.fontSize,
          fontWeight: state.fontWeight,
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

function stepWeight(delta) {
  state.fontWeight = Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, state.fontWeight + delta));
  applyReading();
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyReading();
  toast(state.theme === 'dark' ? 'Night mode on' : 'Night mode off');
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
  els.pageTotal.textContent = `${total} pages`;
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
        setGlobalStatus(`IndoPak page ${state.page} load ho raha hai…`);
        const list = await indopakPage(state.page);
        state.verses = list.map((entry) => verseFromText(entry.surah, entry.aya, entry.text));
        setGlobalStatus('');
        els.listTitle.textContent = `Mushaf IndoPak — page ${state.page} / ${INDOPAK_PAGES}`;
      } else {
        const list = pageAyahs(state.page);
        if (!list.length) throw new Error('Is page ka text nahi mila.');
        state.verses = list.map(({ surah, aya }) => getVerses(surah, aya, aya)[0]).filter(Boolean);
        els.listTitle.textContent = `Mushaf Madani — page ${state.page} / 604`;
      }
    } else {
      const total = Math.max(1, ayaCount(state.surah));
      state.verses = getVerses(state.surah, 1, total);
      els.listTitle.textContent = `${surahName(state.surah)} — ${total} ayaat`;
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
  const words = text.split(/\s+/).filter(Boolean);
  return {
    surah,
    aya,
    text,
    ayaText: text,
    basmala: null,
    words,
    prefixWords: [],
    optional: words.map(() => false),
    hasBasmala: false,
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
  if (state.mode === 'page') {
    renderMushafPage();
    updateRecordButtons();
    return;
  }

  const verses = state.verses.slice(0, state.visible);
  if (!verses.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Yahan koi aya nahi mili.';
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
  share.title = 'Share this aya';
  share.textContent = '↗';
  share.addEventListener('click', () => shareAya(verse));

  head.append(badge, share);

  const text = document.createElement('div');
  text.className = 'aya-text';
  text.lang = 'ar';
  text.dir = 'rtl';
  if (state.textHidden) text.classList.add('is-hidden');
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
  record.dataset.label = 'Record';
  record.textContent = 'Record';
  record.addEventListener('click', () => toggleRecording(key, [key]));
  actions.appendChild(record);

  card.append(head);
  if (verse.basmala) card.appendChild(basmalaLine(verse.basmala));
  card.append(text, status, result, actions);
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

// ------------------------------------------------------------ mushaf page

function renderMushafPage() {
  const page = document.createElement('div');
  page.className = 'mushaf-page';
  page.id = 'mushaf-page';

  if (state.selectedKey) {
    const selected = verseOf(state.selectedKey);
    if (selected) {
      const bar = document.createElement('div');
      bar.className = 'selection-bar';

      const label = document.createElement('span');
      label.className = 'selection-label';
      label.textContent = `Aya ${state.selectedKey}`;

      const share = document.createElement('button');
      share.type = 'button';
      share.className = 'btn ghost small';
      share.textContent = 'Share';
      share.addEventListener('click', () => shareAya(selected));

      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'btn ghost small';
      clear.textContent = 'Cancel';
      clear.addEventListener('click', () => {
        state.selectedKey = null;
        renderList();
      });

      const record = document.createElement('button');
      record.type = 'button';
      record.className = 'btn primary small';
      record.dataset.recId = `sel-${state.selectedKey}`;
      record.dataset.label = 'Record this aya';
      record.textContent = 'Record this aya';
      const key = state.selectedKey;
      record.addEventListener('click', () => toggleRecording(`sel-${key}`, [key]));

      const status = document.createElement('span');
      status.className = 'aya-status';
      status.dataset.role = 'status';

      bar.append(label, record, share, clear, status);
      page.appendChild(bar);
    }
  }

  const text = document.createElement('div');
  text.className = 'page-text';
  text.lang = 'ar';
  text.dir = 'rtl';
  if (state.textHidden) text.classList.add('is-hidden');

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
  record.dataset.label = 'Is poore page ko record karein';
  record.textContent = 'Is poore page ko record karein';
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
      r.status === WORD_STATUS.CLOSE ? 'qareeb' : r.status === WORD_STATUS.MISSING ? 'chhoot gaya' : 'galat';

    const expected = document.createElement('span');
    expected.className = 'aya-word';
    expected.textContent = r.expected;

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '→';

    const heard = document.createElement('span');
    heard.className = r.heard ? 'spoken-word' : 'spoken-word muted';
    heard.textContent = r.heard || 'nahi padha';

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

    const note = document.createElement('span');
    note.className = 'w-note';
    note.textContent = ` (${noteFor(result)})`;

    target.append(span, note);
  }

  if (alignment.extras && alignment.extras.length) {
    const extra = document.createElement('div');
    extra.className = 'extra-line';
    extra.lang = 'ar';
    extra.dir = 'rtl';
    extra.textContent = `aya me nahi: ${alignment.extras.map((e) => e.heard).join(' ')}`;
    target.appendChild(extra);
  }
}

function noteFor(result) {
  if (result.status === WORD_STATUS.MISSING || !result.heard) return 'chhoot gaya';
  if (result.status === WORD_STATUS.CLOSE) return `qareeb: ${result.heard}`;
  return `padha: ${result.heard}`;
}

function countsLine(c) {
  return [
    `${c.correct} sahi`,
    c.close ? `${c.close} qareeb` : '',
    c.wrong ? `${c.wrong} galat` : '',
    c.missing ? `${c.missing} chhoote` : '',
    c.extra ? `${c.extra} zaid` : '',
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
      alignment.score === 100
        ? 'Sab alfaz aya ke mutabiq sune gaye. (Tajweed ki bareek ghalti ASR se nahi pakdi jati.)'
        : 'Lafz ke mutabiq koi ghalti nahi mili.';
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
      if (!button.textContent.startsWith('Stop')) button.textContent = 'Stop · 0:00';
    } else {
      button.classList.remove('recording');
      button.textContent = button.dataset.label || 'Record';
    }
  });
}

async function toggleRecording(id, keys) {
  if (state.recording && state.recording.id === id) {
    await finishRecording(false);
    return;
  }
  if (state.recording || state.busyId || state.modelLoading || state.micChecking) return;

  state.recording = { id, keys };
  state.levelState = '';
  setStatus(id, 'Mic khul raha hai…');
  updateRecordButtons();

  try {
    state.recorder = await startRecording({ maxSeconds: 180 });
    state.recordingStarted = Date.now();
    setStatus(id, 'Recording… padhein, phir Stop dabaein.');
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
  setStatus(current.id, byItself ? 'Recording khud ruki — audio taiyar ho raha hai…' : 'Audio taiyar ho raha hai…');

  let blob = null;
  try {
    blob = await recorder.stop();
  } catch (error) {
    setStatus(current.id, `Recording error: ${error.message}`, 'error');
    return;
  }
  if (!blob || !blob.size) {
    setStatus(current.id, 'Recording khali rahi — dobara koshish karein.', 'error');
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
    if (button) button.textContent = `Stop · ${formatClock(seconds)}`;
    const recorder = state.recorder;
    if (recorder && typeof recorder.getState === 'function' && recorder.getState() === 'inactive') {
      finishRecording(true);
      return;
    }
    const peak = recorder && typeof recorder.getPeak === 'function' ? recorder.getPeak() : -1;
    if (peak >= 0) {
      if (peak >= 0.01 && state.levelState !== 'ok') {
        state.levelState = 'ok';
        setStatus(id, 'Recording… awaaz aa rahi hai. Mukammal hone par Stop dabaein.');
      } else if (peak < 0.002 && seconds >= 3 && state.levelState !== 'silent') {
        state.levelState = 'silent';
        setStatus(id, 'Awaaz nahi aa rahi — mic ke qareeb padhein.', 'error');
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
    setStatus(id, 'Audio taiyar ho raha hai…');
    const audio = await decodeToMono16k(blob);
    if (audio.length < 6400) throw new Error('Audio bohot chhota hai — poora padhein.');
    if (peakOf(audio) < 0.003) throw new Error('Audio khamosh hai — mic ke qareeb padhein.');

    if (!state.model) {
      setGlobalStatus('Speech model download ho raha hai… (pehli dafa ~105 MB)');
      const loaded = await handleLoadModel();
      if (!loaded) throw new Error('Model load nahi hua — Settings me dobara koshish karein.');
      setGlobalStatus('');
    }

    setStatus(id, 'Transcribe ho raha hai (device par)…');
    const text = await transcribe(state.model, audio);
    if (!text) throw new Error('Kuch sunai nahi diya — dobara padhein.');

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
    alignment.results.forEach((result, index) => {
      const vi = wordVerse[index];
      slices[vi].push({ ...result, index: slices[vi].length });
    });
    verses.forEach((verse, vi) => {
      const prefix = (verse.prefixWords || []).length;
      state.results.set(keyOf(verse.surah, verse.aya), summarise(slices[vi].slice(prefix), []));
    });

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

  let verdict = 'Kuch suna nahi gaya';
  if (counted) {
    if (!counts.wrong && !counts.missing && !counts.extra) {
      verdict = score === 100 ? 'Bilkul sahi' : 'Sahi (thori bariqi)';
    } else if (score >= 85) verdict = 'Achha — chhoti ghaltiyan';
    else if (score >= 65) verdict = 'Theek — kuch alfaaz durust karein';
    else if (score >= 40) verdict = 'Dobara koshish karein';
    else verdict = 'Is aya ko phir se seekhein';
  }

  return { results, extras, counts, score, verdict };
}

// -------------------------------------------------------------------- model

async function handleLoadModel() {
  if (state.modelLoading) return false;
  const modelId = els.modelSelect.value;
  if (state.model && state.modelId === modelId) return true;

  state.modelLoading = true;
  els.loadModel.disabled = true;
  els.modelSelect.disabled = true;
  els.modelProgress.hidden = false;
  setProgress(0);
  els.modelStatus.textContent = 'Model download ho raha hai…';
  updateRecordButtons();

  try {
    state.model = await loadModel(modelId, onModelProgress);
    state.modelId = modelId;
    els.modelStatus.textContent = `Model tayyar hai${libraryVersion() ? ` (transformers ${libraryVersion()})` : ''}.`;
    setProgress(100);
    try {
      localStorage.setItem(STORAGE.model, modelId);
    } catch (error) {
      console.warn('model id persist failed', error);
    }
    setGlobalStatus('');
    return true;
  } catch (error) {
    state.model = null;
    state.modelId = null;
    els.modelStatus.textContent = `Model load fail: ${error.message}`;
    els.modelProgress.hidden = true;
    setGlobalStatus(`Model load fail: ${error.message}`);
    return false;
  } finally {
    state.modelLoading = false;
    els.loadModel.disabled = false;
    els.modelSelect.disabled = false;
    updateRecordButtons();
  }
}

function onModelProgress(progress) {
  if (progress.status === 'progress' && typeof progress.progress === 'number') {
    setProgress(progress.progress);
    const pct = Math.round(progress.progress);
    if (progress.file) els.modelStatus.textContent = `${progress.file} — ${pct}%`;
    if (progress.file && pct % 20 < 5) setGlobalStatus(`Model download: ${progress.file} ${pct}%`);
  } else if (progress.status === 'initiate' && progress.file) {
    els.modelStatus.textContent = `Shuru: ${progress.file}`;
  } else if (progress.status === 'done' && progress.file) {
    els.modelStatus.textContent = `Download mukammal: ${progress.file}`;
  } else if (progress.status === 'ready') {
    els.modelStatus.textContent = 'Model ready…';
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
      renderSearchResults(list, `Juz ${juz} — ${list.length} ayaat`);
      return;
    }
  }

  const needle = normalizeArabic(raw);
  if (needle.length < 2) {
    els.searchResults.innerHTML = '';
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Kam az kam 2 harf likhein (harakat ke baghair bhi chalega).';
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
  renderSearchResults(found, `"${raw}" — ${found.length} nataij`);
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
    empty.textContent = 'Kuch nahi mila. Doosra lafz ya aya number try karein.';
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

function openSettings() {
  els.viewReader.hidden = true;
  els.viewSettings.hidden = false;
  if (els.modelStatus && !els.modelStatus.textContent) {
    els.modelStatus.textContent = 'Model abhi load nahi hua. Pehli recording par khud load hoga.';
  }
  renderTajweed();
}

function closeSettings() {
  els.viewSettings.hidden = true;
  els.viewReader.hidden = false;
}

function setTextHidden(hidden) {
  state.textHidden = Boolean(hidden);
  document.querySelectorAll('.aya-text, .page-text').forEach((element) => {
    element.classList.toggle('is-hidden', state.textHidden);
  });
  els.toggleText.textContent = state.textHidden ? 'Text dikhayein' : 'Text chhupayein';
  els.toggleText.setAttribute('aria-pressed', String(state.textHidden));
  persistSelection();
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
    text: 'Quran tilawat khud check karein — on-device, bina server ke.',
    url: location.href,
  });
}

async function shareAya(verse) {
  const reference = `${surahName(verse.surah)} — aya ${verse.aya}`;
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
    toast('Copy ho gaya — paste kar ke share karein.');
  } catch (error) {
    toast('Share support nahi hai.');
  }
}

// ----------------------------------------------------------------- tajweed

function renderTajweed() {
  if (!els.tajweed) return;
  els.tajweed.innerHTML = '';
  const verse = state.verses[0];
  if (!verse) {
    els.tajweed.textContent = 'Pehle koi aya chunein.';
    return;
  }
  const hints = tajweedHints(verse.ayaText || verse.text, 8);
  if (!hints.length) {
    els.tajweed.textContent = `${verse.surah}:${verse.aya} me koi tajweed hint nahi mila.`;
    return;
  }
  const intro = document.createElement('p');
  intro.className = 'hint';
  intro.textContent = `${surahName(verse.surah)} ${verse.aya} — script se milne wale hints:`;
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
  push('Secure page', support.secure ? 'haan' : 'nahi', support.secure);
  push('Microphone API', support.hasApi ? 'maujood' : 'nahi', support.hasApi);
  push('Permission', await micPermissionState(), null);

  try {
    const recorder = await startRecording({ maxSeconds: 8 });
    push('Recording (2s)', 'chal rahi hai…', null);
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
    const peak = recorder.getPeak();
    const blob = await recorder.stop();
    push('Recording (2s)', `${blob.size} bytes`, blob.size > 0);
    if (peak >= 0) push('Awaaz ka level', peak >= 0.01 ? 'theek' : 'bohot halka', peak >= 0.01);
  } catch (error) {
    push('Recording (2s)', error.message, false);
  } finally {
    state.micChecking = false;
    updateRecordButtons();
  }
}

// ------------------------------------------------------------------ tests

function runEngineTests() {
  const context = isLoaded() ? { quran: { ayaCount, getVerses } } : {};
  const results = runSelfTest(context);
  els.testResults.innerHTML = '';
  for (const result of results) {
    const li = document.createElement('li');
    li.className = `test ${result.pass ? 'pass' : 'fail'}`;
    const mark = document.createElement('span');
    mark.className = 'mark';
    mark.textContent = result.pass ? 'PASS' : 'FAIL';
    const body = document.createElement('div');
    const name = document.createElement('span');
    name.textContent = result.name;
    const detail = document.createElement('span');
    detail.className = 'detail';
    detail.textContent = result.detail;
    body.append(name, detail);
    li.append(mark, body);
    els.testResults.appendChild(li);
  }
  const passed = results.filter((result) => result.pass).length;
  toast(`Self-test: ${passed}/${results.length} pass`);
}

// ----------------------------------------------------------------- events

function setMode(mode) {
  state.mode = mode;
  applyMode();
  if (mode === 'search') {
    els.ayaList.hidden = true;
    els.searchResults.hidden = false;
    els.listTitle.textContent = 'Talash';
    return;
  }
  els.searchResults.hidden = true;
  els.ayaList.hidden = false;
  showList();
}

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

  els.toggleText.addEventListener('click', () => setTextHidden(!state.textHidden));
  els.toggleTheme.addEventListener('click', toggleTheme);
  els.fontSmaller.addEventListener('click', () => stepFont(-1));
  els.fontLarger.addEventListener('click', () => stepFont(1));
  els.weightLighter.addEventListener('click', () => stepWeight(-WEIGHT_STEP));
  els.weightBolder.addEventListener('click', () => stepWeight(WEIGHT_STEP));

  els.loadMore.addEventListener('click', () => {
    state.visible += CHUNK;
    renderList();
  });

  els.shareApp.addEventListener('click', shareApp);

  els.modelSelect.addEventListener('change', () => {
    if (state.model && state.modelId !== els.modelSelect.value) {
      state.model = null;
      state.modelId = null;
      els.modelStatus.textContent = 'Naya model — "Model load karein" dabaein.';
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
    toast('Audio file lagi hai.');
  });

  els.micCheck.addEventListener('click', runMicCheck);
  els.runTests.addEventListener('click', runEngineTests);
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
