// Tilawat Check — Quran reader with a Record button under every aya.
//
// Everything runs on the device: Web Audio for recording, a Quran-tuned
// Whisper ONNX model through Transformers.js (WASM), and a word alignment
// against the Uthmani text of the aya being recited.

import { SURAHS, surahName } from './surahs.js';
import { loadQuran, isLoaded, ayaCount, getVerses } from './quran.js';
import { loadPages, pageTotal, pageAyahs } from './quran-pages.js';
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
  mode: 'surah',
  surah: 1,
  page: 1,
  verses: [],
  visible: CHUNK,
  results: new Map(),
  textHidden: false,
  theme: 'light',
  fontSize: 26,
  fontWeight: 400,
  model: null,
  modelId: null,
  modelLoading: false,
  recorder: null,
  recordingKey: null,
  recordingStarted: 0,
  timer: null,
  levelState: '',
  busyKey: null,
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
    els.pageTotal.textContent = `${pageTotal()} pages`;
  } catch (error) {
    console.warn('page data failed', error);
    els.pageTotal.textContent = 'page data nahi mila';
  }
  await showList();
}

function cacheElements() {
  const ids = [
    'open-settings', 'close-settings', 'view-reader', 'view-settings',
    'toggle-theme', 'font-smaller', 'font-larger', 'weight-lighter', 'weight-bolder',
    'reading-meta',
    'tab-surah', 'tab-page', 'picker-surah', 'picker-page', 'surah-select',
    'page-prev', 'page-next', 'page-number', 'page-total',
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
      if (stored.mode === 'page') state.mode = 'page';
      if (Number.isInteger(stored.surah)) state.surah = clamp(stored.surah, 1, 114);
      if (Number.isInteger(stored.page)) state.page = clamp(stored.page, 1, 604);
    }
    state.textHidden = localStorage.getItem(STORAGE.hidden) === '1';
    const modelId = localStorage.getItem(STORAGE.model);
    if (modelId && MODELS.some((m) => m.id === modelId)) els.modelSelect.value = modelId;
  } catch (error) {
    console.warn('selection restore failed', error);
  }
  els.surahSelect.value = String(state.surah);
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

function persistSelection() {
  try {
    localStorage.setItem(
      STORAGE.selection,
      JSON.stringify({ mode: state.mode, surah: state.surah, page: state.page })
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

// ---------------------------------------------------------------- listing

function applyMode() {
  const isPage = state.mode === 'page';
  els.pickerSurah.hidden = isPage;
  els.pickerPage.hidden = !isPage;
  els.tabSurah.classList.toggle('is-active', !isPage);
  els.tabPage.classList.toggle('is-active', isPage);
}

async function showList() {
  if (!isLoaded()) return;
  state.visible = CHUNK;
  els.rangeError.hidden = true;

  try {
    if (state.mode === 'page') {
      if (!pageTotal()) throw new Error('Page data load nahi hua.');
      const list = pageAyahs(state.page);
      if (!list.length) throw new Error('Is page ka text nahi mila.');
      state.verses = list.map(({ surah, aya }) => getVerses(surah, aya, aya)[0]).filter(Boolean);
      els.listTitle.textContent = `Mushaf page ${state.page}`;
    } else {
      const total = Math.max(1, ayaCount(state.surah));
      state.verses = getVerses(state.surah, 1, total);
      els.listTitle.textContent = `${surahName(state.surah)} — ${total} ayaat`;
    }
  } catch (error) {
    showError(error.message);
    state.verses = [];
  }

  renderList();
  renderTajweed();
  persistSelection();
}

function renderList() {
  els.ayaList.innerHTML = '';
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
  badge.textContent = `${verse.surah}:${verse.aya}`;

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
  text.addEventListener('dblclick', () => {
    setTextHidden(!state.textHidden);
  });

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
  record.dataset.role = 'record';
  record.dataset.key = key;
  record.textContent = 'Record';
  record.addEventListener('click', () => toggleRecording(key));
  actions.appendChild(record);

  card.append(head, text, status, result, actions);
  return card;
}

function keyOf(surah, aya) {
  return `${surah}:${aya}`;
}

function idOf(key) {
  return key.replace(':', '-');
}

function verseOf(key) {
  return state.verses.find((verse) => keyOf(verse.surah, verse.aya) === key) || null;
}

// ---------------------------------------------------------------- rendering

// The aya is rendered from its exact Uthmani string. Words are only wrapped in
// spans when a result exists; whitespace is re-emitted as-is so the text on
// screen is character-for-character the Tanzil text.
function renderAyaText(target, verse, alignment) {
  target.textContent = '';
  // No result yet: show the exact aya string, untouched.
  if (!alignment) {
    target.textContent = verse.text;
    return;
  }

  const tokens = verse.text.split(/(\s+)/);
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
      // Correct words stay plain text: the reading text is never rebuilt.
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

  if (alignment.extras.length) {
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
  const c = alignment.counts;
  counts.textContent = [
    `${c.correct} sahi`,
    c.close ? `${c.close} qareeb` : '',
    c.wrong ? `${c.wrong} galat` : '',
    c.missing ? `${c.missing} chhoote` : '',
    c.extra ? `${c.extra} zaid` : '',
  ]
    .filter(Boolean)
    .join(' · ');

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
  target.appendChild(list);
}

function scoreClass(score) {
  if (score >= 85) return 'good';
  if (score >= 60) return 'mid';
  return 'bad';
}

function setCardStatus(key, message, kind = 'info') {
  const card = document.getElementById(`card-${idOf(key)}`);
  if (!card) return;
  const status = card.querySelector('[data-role="status"]');
  if (!status) return;
  status.textContent = message;
  status.className = kind === 'info' ? 'aya-status' : `aya-status is-${kind}`;
}

function refreshCard(key) {
  const card = document.getElementById(`card-${idOf(key)}`);
  const verse = verseOf(key);
  if (!card || !verse) return;
  const alignment = state.results.get(key);

  const text = card.querySelector('.aya-text');
  if (text) renderAyaText(text, verse, alignment);

  const result = card.querySelector('.aya-result');
  if (result) {
    result.innerHTML = '';
    if (alignment) renderAyaResult(result, alignment);
  }
  updateRecordButtons();
}

function updateRecordButtons() {
  const buttons = document.querySelectorAll('[data-role="record"]');
  buttons.forEach((button) => {
    const key = button.dataset.key;
    const isThisRecording = state.recordingKey === key;
    const locked = Boolean(state.busyKey) || state.modelLoading || state.micChecking;
    button.disabled = locked || (state.recordingKey !== null && !isThisRecording);
    if (isThisRecording) {
      button.classList.add('recording');
      if (!button.textContent.startsWith('Stop')) button.textContent = 'Stop · 0:00';
    } else {
      button.classList.remove('recording');
      button.textContent = 'Record';
    }
  });
}

// ---------------------------------------------------------------- recording

async function toggleRecording(key) {
  if (state.recordingKey === key) {
    await finishRecording(false);
    return;
  }
  if (state.recordingKey || state.busyKey || state.modelLoading || state.micChecking) return;

  state.recordingKey = key;
  state.levelState = '';
  setCardStatus(key, 'Mic khul raha hai…');
  updateRecordButtons();

  try {
    state.recorder = await startRecording({ maxSeconds: 120 });
    state.recordingStarted = Date.now();
    setCardStatus(key, 'Recording… aya padhein, phir Stop dabaein.');
    startTimer(key);
  } catch (error) {
    state.recordingKey = null;
    state.recorder = null;
    setCardStatus(key, error.message, 'error');
    updateRecordButtons();
  }
}

async function finishRecording(byItself) {
  const key = state.recordingKey;
  const recorder = state.recorder;
  if (!key || !recorder) return;

  state.recorder = null;
  state.recordingKey = null;
  stopTimer();
  updateRecordButtons();
  setCardStatus(key, byItself ? 'Recording khud ruki — audio taiyar ho raha hai…' : 'Audio taiyar ho raha hai…');

  let blob = null;
  try {
    blob = await recorder.stop();
  } catch (error) {
    setCardStatus(key, `Recording error: ${error.message}`, 'error');
    return;
  }
  if (!blob || !blob.size) {
    setCardStatus(key, 'Recording khali rahi — dobara koshish karein.', 'error');
    return;
  }
  await checkAya(key, blob);
}

function startTimer(key) {
  stopTimer();
  state.timer = window.setInterval(() => {
    if (!state.recordingKey) return;
    const seconds = Math.floor((Date.now() - state.recordingStarted) / 1000);
    const button = document.querySelector(`#card-${idOf(key)} [data-role="record"]`);
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
        setCardStatus(key, 'Recording… awaaz aa rahi hai. Mukammal hone par Stop dabaein.');
      } else if (peak < 0.002 && seconds >= 3 && state.levelState !== 'silent') {
        state.levelState = 'silent';
        setCardStatus(key, 'Awaaz nahi aa rahi — mic ke qareeb padhein.', 'error');
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

async function checkAya(key, blob) {
  const verse = verseOf(key);
  if (!verse) return;

  state.busyKey = key;
  updateRecordButtons();

  try {
    setCardStatus(key, 'Audio taiyar ho raha hai…');
    const audio = await decodeToMono16k(blob);
    if (audio.length < 6400) throw new Error('Audio bohot chhota hai — poora aya padhein.');
    if (peakOf(audio) < 0.003) throw new Error('Audio khamosh hai — mic ke qareeb padhein.');

    if (!state.model) {
      setGlobalStatus('Speech model download ho raha hai… (pehli dafa ~105 MB)');
      const loaded = await handleLoadModel();
      if (!loaded) throw new Error('Model load nahi hua — Settings me dobara koshish karein.');
      setGlobalStatus('');
    }

    setCardStatus(key, 'Transcribe ho raha hai (device par)…');
    const text = await transcribe(state.model, audio);
    if (!text) throw new Error('Kuch sunai nahi diya — dobara padhein.');

    const expected = verse.words.map((word, i) => ({ word, optional: Boolean(verse.optional[i]) }));
    const heard = text
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => normalizeArabic(word).length > 0);

    const alignment = alignWords(expected, heard);
    state.results.set(key, alignment);
    refreshCard(key);
    setCardStatus(key, '');
  } catch (error) {
    setCardStatus(key, error.message, 'error');
  } finally {
    state.busyKey = null;
    setGlobalStatus('');
    updateRecordButtons();
  }
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
  document.querySelectorAll('.aya-text').forEach((element) => {
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
  const data = {
    title: 'Tilawat Check',
    text: 'Quran tilawat khud check karein — on-device, bina server ke.',
    url: location.href,
  };
  await shareOrCopy(data);
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
  const hints = tajweedHints(verse.text, 8);
  if (!hints.length) {
    els.tajweed.textContent = `Surah ${verse.surah}:${verse.aya} me koi tajweed hint nahi mila.`;
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
  if (!els.micCheckOutput || state.recordingKey) return;
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

function wireEvents() {
  els.openSettings.addEventListener('click', openSettings);
  els.closeSettings.addEventListener('click', closeSettings);

  els.tabSurah.addEventListener('click', () => {
    state.mode = 'surah';
    applyMode();
    showList();
  });
  els.tabPage.addEventListener('click', () => {
    state.mode = 'page';
    applyMode();
    showList();
  });

  els.surahSelect.addEventListener('change', () => {
    state.surah = clamp(els.surahSelect.value, 1, 114);
    showList();
  });

  els.pageNumber.addEventListener('change', () => {
    state.page = clamp(els.pageNumber.value, 1, Math.max(1, pageTotal() || 604));
    els.pageNumber.value = String(state.page);
    showList();
  });
  els.pagePrev.addEventListener('click', () => {
    state.page = clamp(state.page - 1, 1, Math.max(1, pageTotal() || 604));
    els.pageNumber.value = String(state.page);
    showList();
  });
  els.pageNext.addEventListener('click', () => {
    state.page = clamp(state.page + 1, 1, Math.max(1, pageTotal() || 604));
    els.pageNumber.value = String(state.page);
    showList();
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
    toast('Audio file lagi hai — ab us aya ka Record dabaein jise check karna hai.');
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
