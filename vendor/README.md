# vendor/ — licence text

`LICENSE-transformers.txt` is the Apache-2.0 licence of the Transformers.js build
the app uses (`@huggingface/transformers@4.3.2`, imported from jsDelivr with the
version pinned and cached by the service worker after the first launch).

## Not used by the app (kept in the user-site repo)

- `fauzan0096.github.io/vendor/ort/` — the ONNX runtime `.wasm`. Serving it from
  our own domain raised a WebAssembly TypeError, so the app now uses the runtime
  the library ships with. The files stay there unused.
- `fauzan0096.github.io/vendor/bayyin-base/` — the Base model. This one **is**
  used: `asr.js` loads it from `/vendor/` on the same origin.

Model files themselves live in this repo (`models/bayyin-tiny/`). See
`LICENSES.md` §4 and §5.
