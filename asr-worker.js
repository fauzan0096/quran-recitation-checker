// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// The speech model in a Web Worker.
//
// Same model, same Transformers.js, same ONNX runtime — only off the page's main
// thread. Whisper decoding is heavy, and running it on the main thread froze the
// app while an aya was being checked. The page keeps drawing; this worker does
// the work and posts the text back.

const CDN_CANDIDATES = [
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js',
  'https://esm.sh/@huggingface/transformers@4',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js',
];

// The runtime's .wasm (27 MB) is served from the root of this domain.
const WASM_DIR = '/vendor/ort/';

let libPromise = null;
let pipePromise = null;
let pipeKey = '';
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
                  lib.env.backends.onnx.wasm.wasmPaths = WASM_DIR;
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
    const localPath = msg.localPath || 'models/';
    const key = `${localPath}|${msg.modelId}`;
    const start = async () => {
      const lib = await loadLibrary();
      if (lib.env) lib.env.localModelPath = localPath;
      pipeKey = key;
      pipePromise = loadPipeline(msg.modelId);
      await pipePromise;
    };
    try {
      if (!pipePromise || pipeKey !== key) await start();
      else await pipePromise;
      self.postMessage({ type: 'loaded', id: msg.id, version: libVersion });
      return;
    } catch (error) {
      pipePromise = null;
      pipeKey = '';
      // One more try with the library's default runtime path, in case this
      // device cannot start the bundled .wasm.
      try {
        const lib = await loadLibrary();
        if (lib.env && lib.env.backends && lib.env.backends.onnx && lib.env.backends.onnx.wasm) {
          lib.env.backends.onnx.wasm.wasmPaths = undefined;
        }
        if (lib.env) lib.env.localModelPath = localPath;
        pipePromise = loadPipeline(msg.modelId);
        await pipePromise;
        self.postMessage({ type: 'loaded', id: msg.id, version: libVersion });
        return;
      } catch (inner) {
        pipePromise = null;
        self.postMessage({
          type: 'failed',
          id: msg.id,
          message: String((inner && inner.message) || inner || (error && error.message) || error),
        });
      }
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
