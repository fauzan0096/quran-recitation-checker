// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// The speech model in a Web Worker.
//
// Same model, same Transformers.js, same ONNX runtime — only off the page's main
// thread. Whisper decoding is heavy, and running it on the main thread froze the
// app while an aya was being checked. The page keeps drawing; this worker does
// the work and posts the text back.

const CDN_CANDIDATES = [
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4/dist/transformers.min.js',
  'https://esm.sh/@huggingface/transformers@4',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js',
];

let libPromise = null;
let pipePromise = null;
let loadId = 0;
let libVersion = '';

async function loadLibrary() {
  if (!libPromise) {
    libPromise = (async () => {
      const errors = [];
      for (const url of CDN_CANDIDATES) {
        try {
          const lib = await import(/* webpackIgnore: true */ url);
          if (lib && typeof lib.pipeline === 'function') {
            libVersion = (lib.env && lib.env.version) || '';
            if (lib.env) {
              // The bundled model lives in this app (`models/bayyin-tiny`), so the
              // weights are ours: nothing is fetched from anyone else's repo.
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
          errors.push(`${url}: pipeline export nahi mila`);
        } catch (error) {
          errors.push(`${url}: ${error && error.message ? error.message : error}`);
        }
      }
      throw new Error(`Speech library load nahi hui (internet chahiye). ${errors.join(' | ')}`);
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
    try {
      if (!pipePromise) pipePromise = loadPipeline(msg.modelId);
      await pipePromise;
      self.postMessage({ type: 'loaded', id: msg.id, version: libVersion });
    } catch (error) {
      pipePromise = null;
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
