// UI wiring: pick ayaat, record or load audio, run the on-device model, align
// the transcript with the Uthmani words and show where the recitation slipped.

import { SURAHS, surahName } from './surahs.js';
import { loadQuran, isLoaded, ayaCount, getVerses } from './quran.js';
import { normalizeArabic } from './normalize.js';
import { alignWords, WORD_STATUS } from './align.js';
import { tajweedHints, summariseHints } from './tajweed.js';
import { MODELS, loadModel, transcribe, decodeToMono16k, startRecording, micSupport, micPermissionState } from './asr.js';
import { runSelfTest } from './selftest.js';

const STORAGE = { model: 'qrc.modelId', selection: 'qrc.selection' };
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

const state = {
  verses: [],
  model: null,
  modelId: null,
  modelLoading: false,
  audioBlob: null,
  recording: false,
  recorder: null,
  recordingStarted: 0,
  recordingTimer: null,
  busy: false,
};

const els = {};
let toastTimer = null;

init();

function init() {
  cacheElements();
  fillSurahs();
  fillModels();
  restoreSelection();
  fillModelSelection();
  wireEvents();
  updateTranscribeButton();
  loadQuran()
    .then(() => {
      els.error.textContent = '';
      els.error.hidden = true;
      loadAya();
    })
    .catch((error) => {
      els.error.textContent = error.message;
      els.error.hidden = false;
    });
}

function cacheElements() {
  els.select = byId('surah-select');
  els.from = byId('aya-from');
  els.to = byId('aya-to');
  els.load = byId('load-range');
  els.error = byId('range-error');
  els.ref = byId('verse-ref');
  els.verse = byId('verse');
  els.record = byId('record');
  els.file = byId('audio-file');
  els.audioStatus = byId('audio-status');
  els.micCheck = byId('mic-check');
  els.micOutput = byId('mic-check-output');
  els.player = byId('player');
  els.modelSelect = byId('model-select');
  els.loadModel = byId('load-model');
  els.modelProgress = byId('model-progress');
  els.modelProgressBar = byId('model-progress-bar');
  els.modelStatus = byId('model-status');
  els.transcribe = byId('transcribe');
  els.transcript = byId('transcript');
  els.fillSample = byId('fill-sample');
  els.checkText = byId('check-text');
  els.resultPanel = byId('result-panel');
  els.scoreValue = byId('score-value');
  els.scoreVerdict = byId('score-verdict');
  els.scoreCounts = byId('score-counts');
  els.resultVerse = byId('result-verse');
  els.resultDetails = byId('result-details');
  els.tajweed = byId('tajweed');
  els.runTests = byId('run-tests');
  els.testResults = byId('test-results');
  els.toast = byId('toast');
}

function byId(id) {
  return document.getElementById(id);
}

// ---------------------------------------------------------------- selection

function fillSurahs() {
  els.select.innerHTML = '';
  for (const surah of SURAHS) {
    const option = document.createElement('option');
    option.value = String(surah.n);
    option.textContent = `${surah.n}. ${surah.latin} — ${surah.arabic}`;
    els.select.appendChild(option);
  }
  els.select.value = '1';
}

function restoreSelection() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE.selection) || 'null');
    if (stored && Number.isInteger(stored.surah)) {
      els.select.value = String(Math.min(114, Math.max(1, stored.surah)));
      els.from.value = String(Math.max(1, stored.from || 1));
      els.to.value = String(Math.max(1, stored.to || stored.from || 1));
    }
  } catch (error) {
    console.warn('selection restore failed', error);
  }
}

function persistSelection() {
  try {
    localStorage.setItem(
      STORAGE.selection,
      JSON.stringify({
        surah: Number(els.select.value),
        from: Number(els.from.value),
        to: Number(els.to.value),
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

function loadAya() {
  if (!isLoaded()) return;
  const surah = clamp(els.select.value, 1, 114);
  const total = Math.max(1, ayaCount(surah));
  const from = clamp(els.from.value, 1, total);
  const to = clamp(els.to.value, from, total);

  els.select.value = String(surah);
  els.from.value = String(from);
  els.from.max = String(total);
  els.to.max = String(total);
  els.to.value = String(to);

  const verses = getVerses(surah, from, to);
  if (!verses.length) {
    els.error.textContent = 'Is range me Quran ka text nahi mila.';
    els.error.hidden = false;
    return;
  }
  els.error.hidden = true;
  state.verses = verses;
  els.ref.textContent = `${surahName(surah)} — aya ${from === to ? from : `${from}–${to}`}`;

  const entries = flatten(verses);
  renderVerse(els.verse, entries, null);
  renderTajweed();
  hideResult();
  persistSelection();
}

function flatten(verses) {
  const entries = [];
  for (const verse of verses) {
    verse.words.forEach((word, indexInAya) => {
      entries.push({
        word,
        optional: Boolean(verse.optional[indexInAya]),
        surah: verse.surah,
        aya: verse.aya,
      });
    });
  }
  return entries;
}

// ------------------------------------------------------------------ render

function renderVerse(target, entries, results) {
  target.innerHTML = '';
  const groups = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    let group = groups[groups.length - 1];
    if (!group || group.surah !== entry.surah || group.aya !== entry.aya) {
      group = { surah: entry.surah, aya: entry.aya, items: [] };
      groups.push(group);
    }
    group.items.push({ entry, result: results ? results[i] : null });
  }

  for (const group of groups) {
    const line = document.createElement('div');
    line.className = 'ayah-line';

    if (groups.length > 1) {
      const label = document.createElement('span');
      label.className = 'aya-label';
      label.textContent = `${group.surah}:${group.aya}`;
      line.appendChild(label);
    }

    for (const item of group.items) {
      const span = document.createElement('span');
      span.className = 'w';
      span.textContent = item.entry.word;
      if (item.result) {
        span.classList.add(`is-${item.result.status}`);
        span.title = describeResult(item.result);
      }
      line.appendChild(span);
    }

    const num = document.createElement('span');
    num.className = 'aya-num';
    num.textContent = toArabicDigits(group.aya);
    line.appendChild(num);

    target.appendChild(line);
  }
}

function renderTajweed() {
  els.tajweed.innerHTML = '';
  const hints = [];
  for (const verse of state.verses) {
    const verseHints = tajweedHints(verse.text, 8);
    for (const hint of verseHints) hints.push({ ...hint, aya: verse.aya });
  }

  if (!hints.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Is aya me koi tajweed hint nahi mila.';
    els.tajweed.appendChild(empty);
    return;
  }

  const chips = document.createElement('div');
  chips.className = 'chips';
  for (const item of summariseHints(hints)) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = `${item.rule} ×${item.count}`;
    chips.appendChild(chip);
  }
  els.tajweed.appendChild(chips);

  const list = document.createElement('ul');
  list.className = 'hint-list';
  for (const hint of hints.slice(0, 24)) {
    const li = document.createElement('li');
    li.className = 'hint-item';

    const glyph = document.createElement('span');
    glyph.className = 'glyph';
    glyph.lang = 'ar';
    glyph.dir = 'rtl';
    glyph.textContent = hint.glyph;

    const name = document.createElement('span');
    name.className = 'rule-name';
    name.textContent = hint.rule;

    const note = document.createElement('span');
    note.textContent = hint.note;

    li.append(glyph, name, note);
    list.appendChild(li);
  }
  els.tajweed.appendChild(list);
}

function hideResult() {
  els.resultPanel.hidden = true;
  els.scoreValue.textContent = '—';
  els.scoreValue.className = 'score';
  els.scoreVerdict.textContent = '';
  els.scoreCounts.textContent = '';
  els.resultVerse.innerHTML = '';
  els.resultDetails.innerHTML = '';
}

function showResult(entries, alignment, transcript) {
  els.resultPanel.hidden = false;
  els.scoreValue.textContent = String(alignment.score);
  els.scoreValue.className = `score ${scoreClass(alignment.score)}`;
  els.scoreVerdict.textContent = alignment.verdict;

  const counts = alignment.counts;
  const parts = [
    `${counts.correct} sahi`,
    counts.close ? `${counts.close} qareeb` : '',
    counts.wrong ? `${counts.wrong} galat` : '',
    counts.missing ? `${counts.missing} chhoote` : '',
    counts.extra ? `${counts.extra} zaid` : '',
  ].filter(Boolean);
  els.scoreCounts.textContent = parts.join(' · ');

  renderVerse(els.resultVerse, entries, alignment.results);
  renderDetails(alignment, transcript);
  els.resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDetails(alignment, transcript) {
  els.resultDetails.innerHTML = '';

  const problems = alignment.results.filter((result) => result.status !== WORD_STATUS.CORRECT);
  if (problems.length) {
    els.resultDetails.appendChild(heading('Ghaltiyan / dhyan dene wali jagah'));
    const list = document.createElement('ul');
    list.className = 'detail-list';
    for (const result of alignment.results) {
      if (result.status === WORD_STATUS.CORRECT) continue;
      list.appendChild(detailRow(result));
    }
    els.resultDetails.appendChild(list);
  } else {
    const ok = document.createElement('p');
    ok.className = 'hint';
    ok.textContent = 'Koi lafz chhoota ya galat nahi — sab match hue.';
    els.resultDetails.appendChild(ok);
  }

  if (alignment.extras.length) {
    els.resultDetails.appendChild(heading('Aya me nahi, magar sune gaye alfaz'));
    const line = document.createElement('p');
    line.className = 'heard-text';
    line.lang = 'ar';
    line.dir = 'rtl';
    line.textContent = alignment.extras.map((extra) => extra.heard).join(' ');
    els.resultDetails.appendChild(line);
  }

  els.resultDetails.appendChild(heading('Model ne yeh suna'));
  const raw = document.createElement('p');
  raw.className = 'heard-text';
  raw.lang = 'ar';
  raw.dir = 'rtl';
  raw.textContent = transcript || '(khali)';
  els.resultDetails.appendChild(raw);
}

function heading(text) {
  const h = document.createElement('h4');
  h.textContent = text;
  return h;
}

function detailRow(result) {
  const li = document.createElement('li');
  li.className = `detail is-${result.status}`;

  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = tagText(result.status);

  const expected = document.createElement('span');
  expected.className = 'ar';
  expected.lang = 'ar';
  expected.dir = 'rtl';
  expected.textContent = result.expected;

  li.append(tag, expected);

  if (result.heard) {
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '→';
    const heard = document.createElement('span');
    heard.className = 'ar';
    heard.lang = 'ar';
    heard.dir = 'rtl';
    heard.textContent = result.heard;
    li.append(arrow, heard);
  }

  return li;
}

function tagText(status) {
  if (status === WORD_STATUS.CLOSE) return 'qareeb';
  if (status === WORD_STATUS.WRONG) return 'galat';
  if (status === WORD_STATUS.MISSING) return 'chhoot gaya';
  return 'sahi';
}

function describeResult(result) {
  if (result.status === WORD_STATUS.CLOSE) return `Qareeb — suna gaya: ${result.heard}`;
  if (result.status === WORD_STATUS.WRONG) return `Galat — suna gaya: ${result.heard}`;
  if (result.status === WORD_STATUS.MISSING) return 'Chhoot gaya';
  return 'Sahi';
}

function scoreClass(score) {
  if (score >= 85) return 'good';
  if (score >= 60) return 'mid';
  return 'bad';
}

function toArabicDigits(value) {
  return String(value).replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

// ----------------------------------------------------------------- checking

function checkTranscript() {
  const raw = els.transcript.value.trim();
  if (!raw) {
    toast('Pehle transcribe karein ya jo padha woh likh dein.');
    return null;
  }
  const entries = flatten(state.verses);
  if (!entries.length) {
    toast('Pehle ayaat load karein.');
    return null;
  }
  const heard = raw
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => normalizeArabic(word).length > 0);

  if (!heard.length) {
    toast('Text me koi Arabic lafz nahi mila.');
    return null;
  }

  const alignment = alignWords(
    entries.map((entry) => ({ word: entry.word, optional: entry.optional })),
    heard
  );
  showResult(entries, alignment, raw);
  return alignment;
}

function fillSample() {
  const entries = flatten(state.verses);
  const words = entries.map((entry) => normalizeArabic(entry.word)).filter(Boolean);
  if (!words.length) {
    toast('Pehle ayaat load karein.');
    return;
  }
  const sample = words.slice();
  if (sample.length > 3) sample.splice(Math.min(2, sample.length - 2), 1);
  if (sample.length > 1) sample[sample.length - 1] = sample[0];
  els.transcript.value = sample.join(' ');
  toast('Sample bhar diya — "Check karein" dabaein.');
}

// -------------------------------------------------------------------- model

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

function fillModelSelection() {
  try {
    const stored = localStorage.getItem(STORAGE.model);
    if (stored && MODELS.some((model) => model.id === stored)) els.modelSelect.value = stored;
  } catch (error) {
    console.warn('model selection restore failed', error);
  }
}

async function handleLoadModel() {
  if (state.busy) return;
  const modelId = els.modelSelect.value;
  if (state.model && state.modelId === modelId) {
    toast('Yeh model pehle se load hai.');
    return;
  }

  state.modelLoading = true;
  els.loadModel.disabled = true;
  els.modelSelect.disabled = true;
  els.modelProgress.hidden = false;
  setProgress(0);
  els.modelStatus.textContent = 'Model download ho raha hai… (pehli dafa bara download, Record abhi bhi chalta rahega)';
  updateTranscribeButton();

  try {
    state.model = await loadModel(modelId, onModelProgress);
    state.modelId = modelId;
    els.modelStatus.textContent = 'Model tayyar hai — ab audio record karein ya file chunein.';
    setProgress(100);
    try {
      localStorage.setItem(STORAGE.model, modelId);
    } catch (error) {
      console.warn('model id persist failed', error);
    }
  } catch (error) {
    state.model = null;
    state.modelId = null;
    els.modelStatus.textContent = `Model load fail: ${error.message}`;
    els.modelProgress.hidden = true;
  } finally {
    state.modelLoading = false;
    els.loadModel.disabled = false;
    els.modelSelect.disabled = false;
    updateTranscribeButton();
  }
}

function onModelProgress(progress) {
  if (progress.status === 'progress' && typeof progress.progress === 'number') {
    setProgress(progress.progress);
    if (progress.file) {
      els.modelStatus.textContent = `${progress.file} — ${Math.round(progress.progress)}%`;
    }
  } else if (progress.status === 'initiate' && progress.file) {
    els.modelStatus.textContent = `Shuru: ${progress.file}`;
  } else if (progress.status === 'done' && progress.file) {
    els.modelStatus.textContent = `Download mukammal: ${progress.file}`;
  } else if (progress.status === 'ready') {
    els.modelStatus.textContent = 'Model ready…';
  }
}

function setProgress(percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  els.modelProgressBar.style.width = `${clamped}%`;
}

async function handleTranscribe() {
  if (state.busy) return;
  if (!state.model) {
    toast('Pehle model load karein.');
    return;
  }
  if (!state.audioBlob) {
    toast('Pehle audio record karein ya file chunein.');
    return;
  }

  setBusy(true);
  try {
    els.modelStatus.textContent = 'Audio taiyar ho raha hai…';
    const audio = await decodeToMono16k(state.audioBlob);
    els.modelStatus.textContent = 'Transcribe ho raha hai (device par)…';
    const text = await transcribe(state.model, audio);
    els.transcript.value = text;
    els.modelStatus.textContent = text
      ? 'Transcribe mukammal.'
      : 'Kuch sunai nahi diya — dobara record karein.';
    if (text) checkTranscript();
  } catch (error) {
    els.modelStatus.textContent = `Transcribe fail: ${error.message}`;
  } finally {
    setBusy(false);
  }
}

// ------------------------------------------------------------------- audio

async function toggleRecording() {
  if (state.busy) return;
  if (state.recording) {
    await finishRecording(false);
    return;
  }

  setAudioStatus('Microphone ki ijazat maangi ja rahi hai…', 'info');
  try {
    state.recorder = await startRecording({ maxSeconds: 120 });
    state.recording = true;
    state.recordingStarted = Date.now();
    els.record.classList.add('recording');
    els.record.textContent = 'Stop · 0:00';
    setAudioStatus('Recording… aya padhein, mukammal hone par Stop dabaein.', 'recording');
    startRecordingTimer();
  } catch (error) {
    state.recorder = null;
    state.recording = false;
    stopRecordingTimer();
    els.record.classList.remove('recording');
    els.record.textContent = 'Record';
    setAudioStatus(error.message, 'error');
  }
}

async function finishRecording(byItself) {
  const recorder = state.recorder;
  if (!recorder || !state.recording) return;

  state.recorder = null;
  state.recording = false;
  stopRecordingTimer();
  els.record.classList.remove('recording');
  els.record.textContent = 'Record';
  setAudioStatus(
    byItself
      ? 'Recording khud ruk gayi — jo bacha hai woh taiyar kiya ja raha hai…'
      : 'Recording ruk gayi — audio taiyar ho raha hai…',
    'info'
  );

  try {
    const blob = await recorder.stop();
    if (!blob || !blob.size) {
      setAudioStatus(
        'Recording khali rahi — mic se awaaz nahi aayi. Dobara koshish karein, ya "audio file" se upload karein.',
        'error'
      );
      return;
    }
    setAudioBlob(blob, 'Recording');
  } catch (error) {
    setAudioStatus(`Recording error: ${error.message}`, 'error');
  }
}

function startRecordingTimer() {
  stopRecordingTimer();
  state.recordingTimer = window.setInterval(() => {
    if (!state.recording) return;
    const seconds = Math.floor((Date.now() - state.recordingStarted) / 1000);
    els.record.textContent = `Stop · ${formatClock(seconds)}`;
    const recorder = state.recorder;
    if (recorder && typeof recorder.getState === 'function' && recorder.getState() === 'inactive') {
      finishRecording(true);
    }
  }, 300);
}

function stopRecordingTimer() {
  if (state.recordingTimer) {
    window.clearInterval(state.recordingTimer);
    state.recordingTimer = null;
  }
}

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function setAudioStatus(message, kind = 'info') {
  els.audioStatus.textContent = message;
  els.audioStatus.className = kind === 'info' ? 'hint' : `hint is-${kind}`;
}

function setAudioBlob(blob, source) {
  state.audioBlob = blob;
  const kb = Math.max(1, Math.round(blob.size / 1024));
  setAudioStatus(`${source} — ${kb} KB. Ab "Transcribe + check" dabaein (pehle model load karein).`, 'ok');
  const url = URL.createObjectURL(blob);
  els.player.src = url;
  els.player.hidden = false;
  updateTranscribeButton();
}

function updateTranscribeButton() {
  els.transcribe.disabled =
    state.busy || state.modelLoading || !state.model || !state.audioBlob;
}

function setBusy(busy) {
  state.busy = busy;
  els.loadModel.disabled = busy || state.modelLoading;
  els.record.disabled = busy;
  els.checkText.disabled = busy;
  els.fillSample.disabled = busy;
  els.load.disabled = busy;
  updateTranscribeButton();
}

// --------------------------------------------------------------- mic check

async function runMicCheck() {
  if (!els.micOutput) return;
  if (state.recording) {
    toast('Pehle chal rahi recording band karein, phir Mic jaanch chalayein.');
    return;
  }
  els.micOutput.hidden = false;
  if (els.micCheck) els.micCheck.disabled = true;
  try {
    await micCheckRun();
  } finally {
    if (els.micCheck) els.micCheck.disabled = false;
  }
}

async function micCheckRun() {
  const items = [];
  const render = () => {
    els.micOutput.innerHTML = '';
    for (const item of items) {
      const li = document.createElement('li');
      li.className = item.ok === true ? 'diag-ok' : item.ok === false ? 'diag-bad' : 'diag-wait';
      const label = document.createElement('span');
      label.className = 'diag-label';
      label.textContent = item.label;
      const value = document.createElement('span');
      value.textContent = item.value;
      li.append(label, value);
      els.micOutput.appendChild(li);
    }
  };
  const push = (label, value, ok = null) => {
    items.push({ label, value, ok });
    render();
  };
  const update = (label, value, ok) => {
    const existing = items.find((item) => item.label === label);
    if (existing) {
      existing.value = value;
      existing.ok = ok;
    } else {
      items.push({ label, value, ok });
    }
    render();
  };

  items.length = 0;
  const support = micSupport();
  push('Secure page (https)', support.secure ? 'haan' : 'nahi', support.secure);
  push('Microphone API', support.hasApi ? 'maujood' : 'nahi', support.hasApi);
  push('MediaRecorder', support.hasRecorder ? 'maujood' : 'nahi', support.hasRecorder);
  push('Audio format', support.mimeType || '(browser default)', Boolean(support.mimeType));

  const permission = await micPermissionState();
  push('Permission', permission, permission === 'denied' ? false : null);

  if (!support.hasApi || !support.hasRecorder) {
    push('Recording', 'rucka — API maujood nahi', false);
    return;
  }

  push('Recording (2s test)', 'koshish…', null);
  let recorder;
  try {
    recorder = await startRecording({ maxSeconds: 8 });
  } catch (error) {
    update('Recording (2s test)', error.message, false);
    return;
  }

  await new Promise((resolve) => window.setTimeout(resolve, 2000));
  const blob = await recorder.stop();
  update('Recording (2s test)', `${blob.size} bytes`, blob.size > 0);

  if (blob.size > 0) {
    try {
      const audio = await decodeToMono16k(blob);
      const seconds = audio.length / 16000;
      push('Decode', `${audio.length} samples (~${seconds.toFixed(1)}s)`, audio.length > 0);
    } catch (error) {
      push('Decode', `fail: ${error.message}`, false);
    }
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

// ------------------------------------------------------------------ events

function wireEvents() {
  els.load.addEventListener('click', () => loadAya());
  els.select.addEventListener('change', () => loadAya());
  els.from.addEventListener('change', () => loadAya());
  els.to.addEventListener('change', () => loadAya());
  els.record.addEventListener('click', () => {
    toggleRecording();
  });
  els.file.addEventListener('change', () => {
    const file = els.file.files && els.file.files[0];
    if (file) setAudioBlob(file, file.name);
  });
  els.loadModel.addEventListener('click', () => {
    handleLoadModel();
  });
  els.transcribe.addEventListener('click', () => {
    handleTranscribe();
  });
  els.checkText.addEventListener('click', () => checkTranscript());
  els.fillSample.addEventListener('click', () => fillSample());
  els.runTests.addEventListener('click', () => runEngineTests());
  if (els.micCheck) {
    els.micCheck.addEventListener('click', () => {
      runMicCheck();
    });
  }
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
