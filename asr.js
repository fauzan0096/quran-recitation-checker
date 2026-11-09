// © 2026 fauzan0096 — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// On-device speech recognition + audio helpers.
//
// The model is a Whisper checkpoint fine-tuned on Quran recitation, exported to
// ONNX by the community, and run in the browser by Transformers.js (ONNX
// Runtime Web, WebAssembly). No audio leaves the device: the only network call
// is the one-time download of the model weights, which the browser keeps in the
// Cache API / IndexedDB and reuses afterwards.

// The community Quran ONNX exports are validated against Transformers.js v4
// (v4.3.2 was verified loading this model and running inference on iPhone
// Safari). v3 is only kept as a last resort.
const CDN_CANDIDATES = [
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4/dist/transformers.min.js',
  'https://esm.sh/@huggingface/transformers@4',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js',
];

const TARGET_RATE = 16000;

export const MODELS = [
  {
    id: 'nael239/tasme3-whisper-base-ar-quran-web',
    label: 'Whisper Base — Quran (behtar accuracy, ~105 MB)',
  },
  {
    id: 'Sharjeelbaig/whisper-tiny-ar-quran-onnx',
    label: 'Whisper Tiny — Quran (chhota aur tez, ~40 MB)',
  },
];

let libPromise = null;
let libVersion = '';

async function loadLibrary() {
  if (!libPromise) {
    libPromise = (async () => {
      const errors = [];
      for (const url of CDN_CANDIDATES) {
        try {
          const lib = await import(/* webpackIgnore: true */ url);
          if (lib && typeof lib.pipeline === 'function') {
            if (lib.env) {
              lib.env.allowLocalModels = false;
              lib.env.useBrowserCache = true;
            }
            libVersion = (lib.env && lib.env.version) || '';
            return lib;
          }
          errors.push(`${url}: pipeline export nahi mila`);
        } catch (error) {
          errors.push(`${url}: ${error && error.message ? error.message : error}`);
        }
      }
      throw new Error(`Speech library load nahi hui (internet chahiye). ${errors.join(' | ')}`);
    })().catch((error) => {
      libPromise = null; // next try must retry, not replay the old failure
      throw error;
    });
  }
  return libPromise;
}

/** Version of the loaded Transformers.js, for the status line. */
export function libraryVersion() {
  return libVersion;
}

/**
 * Create the ASR pipeline.
 * @param {string} modelId Hugging Face repo id of the ONNX Quran model.
 * @param {(progress: object) => void} onProgress Transformers.js progress event.
 */
export async function loadModel(modelId, onProgress = () => {}) {
  const lib = await loadLibrary();
  const options = {
    device: 'wasm',
    progress_callback: (progress) => {
      try {
        onProgress(progress || {});
      } catch (error) {
        console.warn('progress callback failed', error);
      }
    },
  };
  // v3/v4 pick the quantised ONNX files with `dtype`; v2 used `quantized`.
  if (lib.env && lib.env.backends) options.dtype = 'q8';
  else options.quantized = true;

  // A stalled download or a model too big for the phone must end with a message,
  // not an endless "load ho raha hai".
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            'Model 6 minute me tayyar nahi hua — internet slow hai ya model is phone ke liye bara hai. Chhota (Tiny) model chunein.'
          )
        ),
      360000
    );
  });
  try {
    return await Promise.race([
      lib.pipeline('automatic-speech-recognition', modelId, options),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Transcribe 16 kHz mono Float32 audio and return plain text. */
export async function transcribe(instance, audioFloat32) {
  if (!instance) throw new Error('Model load nahi hua');
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Transcribe 3 minute me mukammal nahi hua — dobara koshish karein.')),
      180000
    );
  });
  try {
    const output = await Promise.race([
      instance(audioFloat32, {
        language: 'ar',
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
      }),
      timeout,
    ]);
    const text = Array.isArray(output)
      ? output.map((part) => (part && part.text) || '').join(' ')
      : (output && output.text) || '';
    return text.trim();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Decode any audio blob or file the browser understands into 16 kHz mono. */
export async function decodeToMono16k(input) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('Is browser me audio decode support nahi hai');

  const data = input instanceof ArrayBuffer ? input.slice(0) : await input.arrayBuffer();
  const context = new AudioCtx();
  let decoded;
  try {
    decoded = await new Promise((resolve, reject) => {
      // decodeAudioData detaches the buffer, so hand it a copy.
      const maybePromise = context.decodeAudioData(data.slice(0), resolve, reject);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(resolve).catch(reject);
      }
    });
  } finally {
    if (typeof context.close === 'function') {
      try {
        const closing = context.close();
        if (closing && typeof closing.catch === 'function') closing.catch(() => {});
      } catch (error) {
        console.warn('audio context close failed', error);
      }
    }
  }

  return toMono16k(decoded);
}

function toMono16k(audioBuffer) {
  const channelCount = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  if (!length || !channelCount) return new Float32Array(0);
  const mono = new Float32Array(length);
  for (let channel = 0; channel < channelCount; channel += 1) {
    const samples = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) mono[i] += samples[i] / channelCount;
  }
  return resampleMono(mono, audioBuffer.sampleRate);
}

function resampleMono(mono, sourceRate) {
  const length = mono.length;
  if (!length) return new Float32Array(0);
  if (sourceRate === TARGET_RATE) return mono;
  const ratio = sourceRate / TARGET_RATE;
  const outLength = Math.max(1, Math.floor(length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const position = i * ratio;
    const index = Math.floor(position);
    const next = Math.min(index + 1, length - 1);
    const fraction = position - index;
    out[i] = mono[index] * (1 - fraction) + mono[next] * fraction;
  }
  return out;
}

/** 16-bit mono WAV: plays everywhere and decodes everywhere (unlike webm on iOS). */
export function encodeWav(samples, rate = TARGET_RATE) {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const text = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

/** Loudest sample of a Float32Array (0..1) — used to spot a silent recording. */
export function peakOf(samples) {
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.abs(samples[i]);
    if (v > peak) peak = v;
  }
  return peak;
}

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

/** What this browser can do about the microphone, without asking permission. */
export function micSupport() {
  const secure = Boolean(typeof window !== 'undefined' && window.isSecureContext);
  const hasApi = Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const hasRecorder = typeof MediaRecorder !== 'undefined';
  return { secure, hasApi, hasRecorder, mimeType: pickMimeType() };
}

/** 'granted' | 'denied' | 'prompt' | 'unknown' */
export async function micPermissionState() {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const status = await navigator.permissions.query({ name: 'microphone' });
      return status.state || 'unknown';
    }
  } catch (error) {
    return 'unknown';
  }
  return 'unknown';
}

function micErrorMessage(error) {
  const name = error && error.name ? error.name : 'Error';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Mic ki ijazat nahi mili. Browser/app me microphone Allow karein, phir dobara Record dabaein (ya neeche "audio file" se upload karein).';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Koi microphone nahi mila.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Microphone kisi aur app ne le rakha hai — usay band kar ke dobara koshish karein.';
  }
  if (name === 'OverconstrainedError') {
    return 'Microphone ne maangi hui setting support nahi ki.';
  }
  return `Microphone error: ${error && error.message ? error.message : name}`;
}

async function openMicStream() {
  const md = navigator.mediaDevices;
  try {
    return await md.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch (error) {
    // Some phones/WebViews reject the extra settings: retry with the plain request.
    if (error && (error.name === 'OverconstrainedError' || error.name === 'TypeError')) {
      return md.getUserMedia({ audio: true });
    }
    throw error;
  }
}

function stopStream(stream) {
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch (error) {
      console.warn('track stop failed', error);
    }
  });
}

/**
 * Start recording from the microphone.
 *
 * Main path: Web Audio (raw samples -> WAV). It does not depend on MediaRecorder,
 * so it works on iOS Safari, Android WebView and PWAs where MediaRecorder stops
 * by itself right after start. Fallback: MediaRecorder.
 *
 * Returned object: stop() always resolves with a Blob (empty if nothing came),
 * getState() is 'recording' | 'inactive', getPeak() is the loudest level heard
 * so far (0..1, or -1 when unknown).
 *
 * @returns {Promise<{stop: () => Promise<Blob>, cancel: () => void, getState: () => string, getPeak: () => number, kind: string}>}
 */
export async function startRecording(options = {}) {
  const maxSeconds = options.maxSeconds || 120;

  if (!window.isSecureContext) {
    throw new Error('Microphone ke liye secure page (https) chahiye.');
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Is browser me microphone API nahi hai — "audio file" se upload karein.');
  }

  // iOS/Safari only lets an AudioContext start inside the tap itself, so create
  // it now, before the first await.
  let context = null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (AudioCtx) {
    try {
      context = new AudioCtx();
      if (context.state === 'suspended' && context.resume) context.resume().catch(() => {});
    } catch (error) {
      context = null;
    }
  }
  const closeContext = () => {
    if (context && typeof context.close === 'function') {
      try {
        const closing = context.close();
        if (closing && closing.catch) closing.catch(() => {});
      } catch (error) {
        console.warn('audio context close failed', error);
      }
    }
  };

  let stream;
  try {
    stream = await openMicStream();
  } catch (error) {
    closeContext();
    throw new Error(micErrorMessage(error));
  }

  if (context && typeof context.createScriptProcessor === 'function' && context.createMediaStreamSource) {
    try {
      return startPcmCapture(context, stream, maxSeconds);
    } catch (error) {
      console.warn('Web Audio capture shuru nahi hua, MediaRecorder try ho raha hai', error);
    }
  }
  closeContext();
  return startMediaRecorderCapture(stream, maxSeconds);
}

function startPcmCapture(context, stream, maxSeconds) {
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const silent = context.createGain();
  silent.gain.value = 0; // keeps the graph running without echoing the mic to the speaker

  const rate = context.sampleRate || 48000;
  const maxSamples = Math.max(1, maxSeconds) * rate;
  const chunks = [];
  let total = 0;
  let peak = 0;
  let settled = false;
  let maxTimer = null;
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  function finish() {
    if (settled) return;
    settled = true;
    if (maxTimer) window.clearTimeout(maxTimer);
    try {
      processor.onaudioprocess = null;
      source.disconnect();
      processor.disconnect();
      silent.disconnect();
    } catch (error) {
      console.warn('audio graph disconnect failed', error);
    }
    stopStream(stream);
    try {
      const closing = context.close();
      if (closing && closing.catch) closing.catch(() => {});
    } catch (error) {
      console.warn('audio context close failed', error);
    }
    if (!total) {
      resolveDone(new Blob([], { type: 'audio/wav' }));
      return;
    }
    const all = new Float32Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      all.set(chunk, offset);
      offset += chunk.length;
    }
    chunks.length = 0;
    resolveDone(encodeWav(resampleMono(all, rate), TARGET_RATE));
  }

  processor.onaudioprocess = (event) => {
    if (settled) return;
    const input = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
    total += input.length;
    const level = peakOf(input);
    if (level > peak) peak = level;
    if (total >= maxSamples) finish();
  };

  source.connect(processor);
  processor.connect(silent);
  silent.connect(context.destination);
  if (context.state === 'suspended' && context.resume) context.resume().catch(() => {});

  maxTimer = window.setTimeout(finish, maxSeconds * 1000 + 500);
  // The OS took the mic away (call, another app): keep what we have.
  stream.getTracks().forEach((track) => track.addEventListener('ended', finish));

  return {
    kind: 'webaudio',
    getState: () => (settled ? 'inactive' : 'recording'),
    getPeak: () => peak,
    stop() {
      finish();
      return done;
    },
    cancel() {
      chunks.length = 0;
      total = 0;
      finish();
    },
  };
}

function startMediaRecorderCapture(stream, maxSeconds) {
  if (typeof MediaRecorder === 'undefined') {
    stopStream(stream);
    throw new Error('Is browser me recording support nahi hai — "audio file" se upload karein.');
  }

  const mimeType = pickMimeType();
  let recorder;
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch (error) {
    stopStream(stream);
    throw new Error(`Recorder ban nahi paya: ${error.message}`);
  }

  const chunks = [];
  let settled = false;
  let maxTimer = null;
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  function finish() {
    if (settled) return;
    settled = true;
    if (maxTimer) window.clearTimeout(maxTimer);
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch (error) {
        console.warn('recorder stop failed', error);
      }
    }
    stopStream(stream);
    resolveDone(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }));
  }

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size) chunks.push(event.data);
  };
  // Stop and WAIT for onstop: the last chunk arrives just before it.
  function requestStop() {
    if (!settled && recorder.state !== 'inactive') {
      try {
        recorder.stop();
        return;
      } catch (error) {
        console.warn('recorder stop failed', error);
      }
    }
    finish();
  }
  recorder.onstop = () => finish();
  recorder.onerror = (event) => {
    console.warn('MediaRecorder error', event && event.error ? event.error : event);
    finish();
  };
  stream.getTracks().forEach((track) => track.addEventListener('ended', requestStop));

  try {
    recorder.start(500);
  } catch (error) {
    try {
      recorder.start();
    } catch (inner) {
      stopStream(stream);
      throw new Error(`Recording shuru nahi hui: ${inner && inner.message ? inner.message : inner}`);
    }
  }
  maxTimer = window.setTimeout(requestStop, maxSeconds * 1000);

  return {
    kind: 'mediarecorder',
    getState: () => (settled ? 'inactive' : recorder.state),
    getPeak: () => -1,
    stop() {
      requestStop();
      return done;
    },
    cancel() {
      chunks.length = 0;
      finish();
    },
  };
}
