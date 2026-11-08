// UI wiring: pick ayaat, record or load audio, run the on-device model, align
// the transcript with the Uthmani words and show where the recitation slipped.

import { SURAHS, surahName } from './surahs.js';
import { loadQuran, isLoaded, ayaCount, getVerses } from './quran.js';
import { normalizeArabic } from './normalize.js';
import { alignWords, WORD_STATUS } from './align.js';
import { tajweedHints, summariseHints } from './tajweed.js';
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

const STORAGE = { model: 'qrc.modelId', selection: 'qrc.selection' };
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

const state = {
  verses: [],
  textHidden: false,
  model: null,
  modelId: null,
  modelLoading: false,
  audioBlob: null,
  audioUrl: null,
  starting: false,
  micChecking: false,
  levelState: '',
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
  if (els.verse) els.verse.textContent = 'Quran text load ho raha hai…';
  loadQuran()
    .then(() => {
      els.error.textContent = '';
      els.error.hidden = true;
      loadAya();
    })
    .catch((error) => {
      els.error.textContent = error.message;
      els.error.hidden = false;
      if (els.verse) {
        els.verse.textContent =
          'Quran text load nahi hua. Page dobara kholein ya internet check karein.';
      }
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
  els.verseDetails = byId('verse-details');
  els.toggleVerse = byId('toggle-verse');
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
  els.verseStatus = byId('verse-status');
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
  renderVerse(els.verse, entries, null, []);
  renderTajweed();
  hideResult();
  persistSelection();
}

/** Blur the aya so it can be recited from memory, or show it again. */
function setTextHidden(hidden) {
  state.textHidden = Boolean(hidden);
  if (els.verse) els.verse.classList.toggle('is-hidden', state.textHidden);
  if (els.toggleVerse) {
    els.toggleVerse.textContent = state.textHidden ? 'Text dikhayein' : 'Text chhupayein';
    els.toggleVerse.setAttribute('aria-pressed', String(state.textHidden));
  }
}

function toggleTextHidden() {
  setTextHidden(!state.textHidden);
  toast(
    state.textHidden
      ? 'Text chhup gaya — yaad se padhein, Record rukne par text aur natija dikh jayenge.'
      : 'Text dikh raha hai — dekh kar padhein.'
  );
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

function renderVerse(target, entries, results, extras = []) {
  target.innerHTML = '';
  const groups = [];
  entries.forEach((entry, index) => {
    let group = groups[groups.length - 1];
    if (!group || group.surah !== entry.surah || group.aya !== entry.aya) {
      group = { surah: entry.surah, aya: entry.aya, items: [] };
      groups.push(group);
    }
    group.items.push({ entry, index, result: results ? results[index] : null });
  });

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
      const result = item.result;
      if (!result) {
        line.appendChild(wordSpan(item.entry.word, null));
        continue;
      }
      if (result.status === WORD_STATUS.CORRECT) {
        line.appendChild(wordSpan(item.entry.word, WORD_STATUS.CORRECT));
        continue;
      }
      // Word that was not read exactly right: keep it in the aya and put what
      // the reciter actually said right under it.
      const wrap = document.createElement('span');
      wrap.className = `w-wrap is-${result.status}`;
      wrap.title = describeResult(result);
      wrap.appendChild(wordSpan(item.entry.word, result.status));

      const note = document.createElement('span');
      note.className = 'w-note';
      note.textContent = noteFor(result);
      wrap.appendChild(note);
      line.appendChild(wrap);
    }

    const firstIndex = group.items[0].index;
    const lastIndex = group.items[group.items.length - 1].index;
    const groupExtras = extras.filter(
      (extra) => extra.afterIndex >= firstIndex - 1 && extra.afterIndex <= lastIndex
    );
    if (groupExtras.length) {
      const extraLine = document.createElement('div');
      extraLine.className = 'extra-line';
      const label = document.createElement('span');
      label.className = 'extra-label';
      label.textContent = 'aya me nahi:';
      const words = document.createElement('span');
      words.lang = 'ar';
      words.dir = 'rtl';
      words.textContent = groupExtras.map((extra) => extra.heard).join(' ');
      extraLine.append(label, words);
      line.appendChild(extraLine);
    }

    const num = document.createElement('span');
    num.className = 'aya-num';
    num.textContent = toArabicDigits(group.aya);
    line.appendChild(num);

    target.appendChild(line);
  }
}

function wordSpan(word, status) {
  const span = document.createElement('span');
  span.className = status ? `w is-${status}` : 'w';
  span.textContent = word;
  return span;
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
  if (!els.verseStatus) return;
  els.verseStatus.hidden = true;
  els.verseStatus.className = 'verse-status';
  els.verseStatus.innerHTML = '';
  if (els.verseDetails) {
    els.verseDetails.hidden = true;
    els.verseDetails.innerHTML = '';
  }
}

/** Say, right above the aya, why a check could not run. */
function showVerseNotice(message) {
  if (!els.verseStatus) return;
  els.verseStatus.hidden = false;
  els.verseStatus.className = 'verse-status bad';
  els.verseStatus.innerHTML = '';

  const text = document.createElement('span');
  text.className = 'vs-verdict';
  text.textContent = message;
  els.verseStatus.appendChild(text);

  if (els.verseDetails) {
    els.verseDetails.hidden = true;
    els.verseDetails.innerHTML = '';
  }
  els.verse.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** Score + verdict above the aya, with the aya itself coloured word by word. */
function showResult(entries, alignment) {
  if (!els.verseStatus) return;
  // Whatever mode the reciter chose, the answered aya is shown with its colours.
  setTextHidden(false);
  els.verseStatus.hidden = false;
  els.verseStatus.className = `verse-status ${scoreClass(alignment.score)}`;
  els.verseStatus.innerHTML = '';

  const score = document.createElement('span');
  score.className = 'vs-score';
  score.textContent = `${alignment.score}%`;

  const verdict = document.createElement('span');
  verdict.className = 'vs-verdict';
  verdict.textContent = alignment.verdict;

  const counts = alignment.counts;
  const parts = [
    `${counts.correct} sahi`,
    counts.close ? `${counts.close} qareeb` : '',
    counts.wrong ? `${counts.wrong} galat` : '',
    counts.missing ? `${counts.missing} chhoote` : '',
    counts.extra ? `${counts.extra} zaid` : '',
  ].filter(Boolean);
  const summary = document.createElement('span');
  summary.className = 'vs-counts';
  summary.textContent = parts.join(' · ');

  const hint = document.createElement('span');
  hint.className = 'vs-hint';
  hint.textContent =
    'Hara = sahi, peela = qareeb, laal = galat, cut = chhoot gaya. Galat lafz ke neeche aap ka padha hua lafz likha hai.';

  els.verseStatus.append(score, verdict, summary, hint);

  renderVerse(els.verse, entries, alignment.results, alignment.extras);
  renderMistakes(alignment);
  els.verse.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** The mistakes spelled out under the aya: aya ka lafz -> jo aapne padha. */
function renderMistakes(alignment) {
  if (!els.verseDetails) return;
  els.verseDetails.hidden = false;
  els.verseDetails.innerHTML = '';

  const problems = alignment.results.filter((result) => result.status !== WORD_STATUS.CORRECT);
  const head = document.createElement('h4');
  head.textContent = problems.length
    ? `Ghaltiyan (${problems.length}) — aya ka lafz → jo aap ne padha`
    : 'Ghaltiyan (0)';
  els.verseDetails.appendChild(head);

  if (!problems.length) {
    const ok = document.createElement('p');
    ok.className = 'hint';
    ok.textContent =
      alignment.score === 100
        ? 'Model ne har lafz aya ke mutabiq suna. Yaad rahe: speech model kabhi ghalat talaffuz ko bhi sahi lafz bana deta hai, is liye tajweed/makhraj ki bareek ghalti yahan nahi pakdi jati.'
        : 'Lafz ke mutabiq koi ghalti nahi mili.';
    els.verseDetails.appendChild(ok);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'mistake-list';
  for (const result of problems) {
    const row = document.createElement('li');
    row.className = `mistake is-${result.status}`;

    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent =
      result.status === WORD_STATUS.CLOSE
        ? 'qareeb'
        : result.status === WORD_STATUS.MISSING
          ? 'chhoot gaya'
          : 'galat';

    const expected = document.createElement('span');
    expected.className = 'aya-word';
    expected.textContent = result.expected;

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '→';

    const heard = document.createElement('span');
    heard.className = result.heard ? 'spoken-word' : 'spoken-word muted';
    heard.textContent = result.heard || 'nahi padha';

    row.append(tag, expected, arrow, heard);
    list.appendChild(row);
  }
  els.verseDetails.appendChild(list);
}

/** Short label under a word that was not read exactly right. */
function noteFor(result) {
  if (result.status === WORD_STATUS.MISSING || !result.heard) return 'chhoot gaya';
  if (result.status === WORD_STATUS.CLOSE) return `qareeb: ${result.heard}`;
  return `padha: ${result.heard}`;
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

function describeResult(result) {
  if (result.status === WORD_STATUS.CLOSE) return `Qareeb — suna gaya: ${result.heard}`;
  if (result.status === WORD_STATUS.WRONG) return `Galat — suna gaya: ${result.heard}`;
  if (result.status === WORD_STATUS.MISSING) return 'Chhoot gaya';
  return 'Sahi';
}

function checkTranscript(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    toast('Kuch sunai nahi diya — dobara record karein.');
    return null;
  }
  const entries = flatten(state.verses);
  if (!entries.length) {
    toast('Pehle ayaat load karein.');
    return null;
  }
  const heard = text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => normalizeArabic(word).length > 0);

  if (!heard.length) {
    toast('Model ne koi Arabic lafz nahi suna.');
    return null;
  }

  const alignment = alignWords(
    entries.map((entry) => ({ word: entry.word, optional: entry.optional })),
    heard
  );
  showResult(entries, alignment);
  return alignment;
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
  if (state.busy) return false;
  const modelId = els.modelSelect.value;
  if (state.model && state.modelId === modelId) {
    toast('Yeh model pehle se load hai.');
    return true;
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
    els.modelStatus.textContent = `Model tayyar hai${libraryVersion() ? ` (transformers ${libraryVersion()})` : ''} — ab record karein.`;
    setProgress(100);
    try {
      localStorage.setItem(STORAGE.model, modelId);
    } catch (error) {
      console.warn('model id persist failed', error);
    }
    return true;
  } catch (error) {
    state.model = null;
    state.modelId = null;
    els.modelStatus.textContent = `Model load fail: ${error.message}`;
    els.modelProgress.hidden = true;
    showVerseNotice(`Model load nahi hua (${error.message}) — internet check karein, phir dobara koshish karein.`);
    return false;
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
    showVerseNotice(
      'Model load nahi hai, is liye tilawat check nahi ho saki. Neeche "Model load karein" dabaein, phir dobara record karein.'
    );
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
    if (audio.length < 16000 * 0.4) {
      els.modelStatus.textContent = 'Audio bohot chhota hai — thori lambi tilawat record karein.';
      showVerseNotice('Audio bohot chhota hai — poora aya record karein.');
      return;
    }
    if (peakOf(audio) < 0.003) {
      els.modelStatus.textContent = 'Audio khamosh hai (mic se awaaz nahi aayi) — dobara record karein.';
      showVerseNotice(
        'Audio khamosh hai — mic se awaaz nahi aayi. Dobara record karein, ya "Mic jaanch" se mic test karein.'
      );
      return;
    }
    els.modelStatus.textContent = 'Transcribe ho raha hai (device par)…';
    const text = await transcribe(state.model, audio);
    els.modelStatus.textContent = text
      ? 'Transcribe mukammal.'
      : 'Kuch sunai nahi diya — dobara record karein.';
    if (text) checkTranscript(text);
    else showVerseNotice('Kuch sunai nahi diya — dobara record karein ya zara zor se padhein.');
  } catch (error) {
    els.modelStatus.textContent = `Transcribe fail: ${error.message}`;
    showVerseNotice(`Check nahi ho saka: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

// ------------------------------------------------------------------- audio

async function toggleRecording() {
  if (state.busy || state.starting || state.micChecking) return;
  if (state.recording) {
    await finishRecording(false);
    return;
  }

  // Guard: a second tap while the permission prompt is open used to open a
  // second microphone stream, and the phone then killed the first one.
  state.starting = true;
  els.record.disabled = true;
  els.record.textContent = 'Mic khul raha hai…';
  setAudioStatus('Microphone ki ijazat maangi ja rahi hai…', 'info');
  try {
    state.recorder = await startRecording({ maxSeconds: 120 });
    state.recording = true;
    state.recordingStarted = Date.now();
    state.levelState = '';
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
  } finally {
    state.starting = false;
    els.record.disabled = state.busy;
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
      ? 'Recording khatam ho gayi (hadd poori ya mic chhin gaya) — jo record hua woh taiyar kiya ja raha hai…'
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
      return;
    }
    // Tell the person whether the mic is really hearing something.
    const peak = recorder && typeof recorder.getPeak === 'function' ? recorder.getPeak() : -1;
    if (peak >= 0) {
      if (peak >= 0.01 && state.levelState !== 'ok') {
        state.levelState = 'ok';
        setAudioStatus('Recording… awaaz aa rahi hai. Mukammal hone par Stop dabaein.', 'recording');
      } else if (peak < 0.002 && seconds >= 3 && state.levelState !== 'silent') {
        state.levelState = 'silent';
        setAudioStatus(
          'Recording chal rahi hai magar awaaz nahi aa rahi — mic ke qareeb padhein, ya phone ka mic mute/band to nahi?',
          'error'
        );
      }
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
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(blob);
  els.player.src = state.audioUrl;
  els.player.hidden = false;
  updateTranscribeButton();

  if (!state.model) {
    if (state.modelLoading) {
      setAudioStatus(`${source} — ${kb} KB. Model load ho raha hai, phir khud check hoga.`, 'info');
      return;
    }
    // No model yet: load the selected one, then check the recording by itself.
    setAudioStatus(`${source} — ${kb} KB. Model load ho raha hai, phir khud check hoga…`, 'info');
    handleLoadModel().then((loaded) => {
      if (loaded && state.model && state.audioBlob && !state.busy) handleTranscribe();
    });
    return;
  }
  if (state.modelLoading || state.busy) {
    setAudioStatus(`${source} — ${kb} KB. Tayyar hai.`, 'ok');
    return;
  }
  // Model is ready: transcribe and show the result on the aya without an extra tap.
  setAudioStatus(`${source} — ${kb} KB. Transcribe ho raha hai…`, 'ok');
  handleTranscribe();
}

function updateTranscribeButton() {
  els.transcribe.disabled =
    state.busy || state.modelLoading || !state.model || !state.audioBlob;
}

function setBusy(busy) {
  state.busy = busy;
  els.loadModel.disabled = busy || state.modelLoading;
  els.record.disabled = busy;
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
  if (state.starting || state.micChecking) return;
  els.micOutput.hidden = false;
  state.micChecking = true;
  els.record.disabled = true;
  if (els.micCheck) els.micCheck.disabled = true;
  try {
    await micCheckRun();
  } catch (error) {
    toast(`Mic jaanch me error: ${error.message}`);
  } finally {
    state.micChecking = false;
    els.record.disabled = state.busy;
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

  push('Tareeqa', recorder.kind === 'webaudio' ? 'Web Audio (seedha)' : 'MediaRecorder (fallback)', true);
  await new Promise((resolve) => window.setTimeout(resolve, 2000));
  const peak = recorder.getPeak();
  const blob = await recorder.stop();
  update('Recording (2s test)', `${blob.size} bytes`, blob.size > 0);
  if (peak >= 0) {
    push('Awaaz ka level', peak >= 0.01 ? 'theek' : 'bohot halka — mic ke qareeb bolein', peak >= 0.01);
  }

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
  els.runTests.addEventListener('click', () => runEngineTests());
  if (els.toggleVerse) {
    els.toggleVerse.addEventListener('click', () => toggleTextHidden());
  }
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
