// On-device speech recognition + audio helpers.
//
// The model is a Whisper checkpoint fine-tuned on Quran recitation, exported to
// ONNX by the community, and run in the browser by Transformers.js (ONNX
// Runtime Web, WebAssembly). No audio leaves the device: the only network call
// is the one-time download of the model weights, which the browser keeps in the
// Cache API / IndexedDB and reuses afterwards.

const CDN_CANDIDATES = [
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js',
  'https://esm.sh/@huggingface/transformers@3',
];

const TARGET_RATE = 16000;

export const MODELS = [
  {
    id: 'YunusZJ/whisper-base-ar-quran-ONNX',
    label: 'Whisper Base — Quran (behtar accuracy, ~150 MB)',
  },
  {
    id: 'Sharjeelbaig/whisper-tiny-ar-quran-onnx',
    label: 'Whisper Tiny — Quran (chhota aur tez, ~40 MB)',
  },
];

let libPromise = null;

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
            return lib;
          }
          errors.push(`${url}: pipeline export nahi mila`);
        } catch (error) {
          errors.push(`${url}: ${error && error.message ? error.message : error}`);
        }
      }
      throw new Error(`Speech library load nahi hui (internet chahiye). ${errors.join(' | ')}`);
    })();
  }
  return libPromise;
}

/**
 * Create the ASR pipeline.
 * @param {string} modelId Hugging Face repo id of the ONNX Quran model.
 * @param {(progress: object) => void} onProgress Transformers.js progress event.
 */
export async function loadModel(modelId, onProgress = () => {}) {
  const lib = await loadLibrary();
  const options = {
    progress_callback: (progress) => {
      try {
        onProgress(progress || {});
      } catch (error) {
        console.warn('progress callback failed', error);
      }
    },
  };
  // v3 picks the quantised ONNX files with `dtype`; v2 used `quantized`.
  if (lib.env && lib.env.backends) options.dtype = 'q8';
  else options.quantized = true;

  return lib.pipeline('automatic-speech-recognition', modelId, options);
}

/** Transcribe 16 kHz mono Float32 audio and return plain text. */
export async function transcribe(instance, audioFloat32) {
  if (!instance) throw new Error('Model load nahi hua');
  const output = await instance(audioFloat32, {
    language: 'ar',
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  const text = Array.isArray(output)
    ? output.map((part) => (part && part.text) || '').join(' ')
    : (output && output.text) || '';
  return text.trim();
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

  const sourceRate = audioBuffer.sampleRate;
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

/**
 * Start recording from the microphone.
 *
 * `stop()` always resolves — even when the recorder already stopped by itself
 * (iOS does that when the mic is interrupted), so the UI can never hang on
 * "recording…" with no audio.
 *
 * @returns {Promise<{stop: () => Promise<Blob>, cancel: () => void, getState: () => string}>}
 */
export async function startRecording(options = {}) {
  const maxSeconds = options.maxSeconds || 120;
  const timesliceMs = options.timesliceMs || 500;

  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Is browser me recording (MediaRecorder) support nahi hai — "audio file" se upload karein.');
  }
  if (!window.isSecureContext) {
    throw new Error('Microphone ke liye secure page (https) chahiye.');
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Is browser me microphone API nahi hai — "audio file" se upload karein.');
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch (error) {
    throw new Error(micErrorMessage(error));
  }

  const mimeType = pickMimeType();
  let recorder;
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error(`Recorder ban nahi paya: ${error.message}`);
  }

  const chunks = [];
  let settled = false;
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  const stopTracks = () => {
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (error) {
        console.warn('track stop failed', error);
      }
    });
  };

  function finish() {
    if (settled) return;
    settled = true;
    window.clearTimeout(maxTimer);
    stopTracks();
    resolveDone(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }));
  }

  const maxTimer = window.setTimeout(() => {
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch (error) {
        finish();
      }
    } else {
      finish();
    }
  }, Math.max(1, maxSeconds) * 1000);

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size) chunks.push(event.data);
  };
  recorder.onstop = () => finish();
  recorder.onerror = (event) => {
    console.warn('MediaRecorder error', event && event.error ? event.error : event);
    finish();
  };
  // If the OS takes the mic away (call, another app) the track ends: keep what
  // was recorded instead of hanging.
  stream.getTracks().forEach((track) => {
    track.addEventListener('ended', finish);
  });

  try {
    recorder.start(timesliceMs);
  } catch (error) {
    // Some browsers reject a timeslice: fall back to a plain start.
    try {
      recorder.start();
    } catch (inner) {
      stopTracks();
      throw new Error(`Recording shuru nahi hui: ${inner && inner.message ? inner.message : inner}`);
    }
  }

  return {
    getState() {
      return recorder.state;
    },
    stop() {
      if (settled) return done;
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch (error) {
          finish();
        }
      } else {
        finish();
      }
      return done;
    },
    cancel() {
      window.clearTimeout(maxTimer);
      chunks.length = 0;
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch (error) {
          console.warn('recorder cancel failed', error);
        }
      }
      settled = true;
      stopTracks();
      resolveDone(new Blob([], { type: 'audio/webm' }));
    },
  };
}
