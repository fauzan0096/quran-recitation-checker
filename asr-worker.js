// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// The speech model in a Web Worker.
//
// Same model, same Transformers.js, same ONNX runtime — only off the page's main
// thread. Whisper decoding is heavy, and running it on the main thread froze the
// app while an aya was being checked. The page keeps drawing; this worker does
// the work and posts the text back.

// The library that runs the model is served from our own Cloudflare Worker, so a
// check asks no other company for the code that does the work. The CDN copies
// stay behind it as a fallback: if the Worker is down or the asset is missing,
// the app does exactly what it did before.
const LOCAL_LIB = 'https://bayyin-push.anbiyawarsatul.workers.dev/ort/transformers.min.js';

const CANDIDATES = [
  { url: LOCAL_LIB, local: true },
  {
    url: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js',
    local: false,
  },
  { url: 'https://esm.sh/@huggingface/transformers@4', local: false },
  {
    url: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js',
    local: false,
  },
];

let libPromise = null;
let libIsLocal = false;
let pipePromise = null;
let pipeKey = '';
let loadId = 0;
let libVersion = '';

async function loadLibrary(options = {}) {
  const remoteOnly = Boolean(options.remoteOnly);
  if (!libPromise) {
    libPromise = (async () => {
      const errors = [];
      for (const candidate of CANDIDATES) {
        if (remoteOnly && candidate.local) continue;
        try {
          const lib = await import(/* webpackIgnore: true */ candidate.url);
          if (lib && typeof lib.pipeline === 'function') {
            libIsLocal = candidate.local;
            libVersion = (lib.env && lib.env.version) || '';
            if (lib.env) {
              // Model files are served by this app's own origin: the library
              // joins env.localModelPath + model id and fetches that path.
              lib.env.allowLocalModels = true;
              lib.env.allowRemoteModels = true;
              lib.env.localModelPath = 'models/';
              lib.env.useBrowserCache = true;
              try {
                const cores = Math.min(4, Math.max(1, navigator.hardwareConcurrency || 2));
                if (lib.env.backends && lib.env.backends.onnx && lib.env.backends.onnx.wasm) {
                  lib.env.backends.onnx.wasm.numThreads = cores;
                }
              } catch (error) {
                /* older build without the setting */
              }
            }
            return lib;
          }
          errors.push(`${candidate.url}: pipeline export nahi mila`);
        } catch (error) {
          errors.push(`${candidate.url}: ${error && error.message ? error.message : error}`);
        }
      }
      throw new Error(`Speech library load nahi hui. ${errors.join(' | ')}`);
    })().catch((error) => {
      libPromise = null;
      throw error;
    });
  }
  return libPromise;
}

async function loadPipeline(modelId) {
  const lib = await loadLibrary();
  const options = {
    device: 'wasm',
    progress_callback: (progress) => {
      try {
        self.postMessage({ type: 'progress', id: loadId, data: progress || {} });
      } catch (error) {
        /* nothing to report to */
      }
    },
  };
  if (lib.env && lib.env.backends) options.dtype = 'q8';
  else options.quantized = true;
  return lib.pipeline('automatic-speech-recognition', modelId, options);
}

self.onmessage = async (event) => {
  const msg = event.data || {};

  if (msg.type === 'load') {
    loadId = msg.id;
    const localPath = msg.localPath || 'models/';
    const key = `${localPath}|${msg.modelId}`;
    const build = async (modelId) => {
      const lib = await loadLibrary();
      if (lib.env) lib.env.localModelPath = localPath;
      pipeKey = key;
      pipePromise = loadPipeline(modelId);
      await pipePromise;
    };
    try {
      if (!pipePromise || pipeKey !== key) await build(msg.modelId);
      else await pipePromise;
      self.postMessage({ type: 'loaded', id: msg.id, version: libVersion });
    } catch (error) {
      // Our own copy of the library would not start. Go back to the CDN — the way
      // the app worked before — rather than leave the person with a model that
      // cannot load at all.
      let recovered = false;
      if (libIsLocal) {
        libPromise = null;
        libIsLocal = false;
        try {
          await loadLibrary({ remoteOnly: true });
          await build(msg.modelId);
          self.postMessage({ type: 'loaded', id: msg.id, version: libVersion });
          recovered = true;
        } catch (inner) {
          console.warn('CDN fallback failed too', inner);
        }
      }
      if (recovered) return;
      pipePromise = null;
      pipeKey = '';
      self.postMessage({
        type: 'failed',
        id: msg.id,
        message: String((error && error.message) || error),
      });
    }
    return;
  }

  if (msg.type === 'transcribe') {
    try {
      const pipe = await pipePromise;
      if (!pipe) throw new Error('Model load nahi hua');
      const output = await pipe(msg.audio, msg.args || {});
      const text = Array.isArray(output)
        ? output.map((part) => (part && part.text) || '').join(' ')
        : (output && output.text) || '';
      self.postMessage({ type: 'text', id: msg.id, text: String(text) });
    } catch (error) {
      self.postMessage({
        type: 'failed',
        id: msg.id,
        message: String((error && error.message) || error),
      });
    }
  }
};
