# vendor/ — the speech runtime

The checker's runtime `.wasm` is served from the root of this domain
(`https://fauzan0096.github.io/vendor/ort/`, the user-site repo):
`asr.js` and `asr-worker.js` set `wasmPaths` there, the service worker caches the
file after the first check, and a device that cannot start it retries once with
the library's default CDN path.

The Transformers.js library itself (`@huggingface/transformers@4.3.2`, pinned) is
imported from jsDelivr — GitHub refused that 574 KB minified file when it was
committed here — and cached by the service worker after the first launch.

`LICENSE-transformers.txt` is that library's Apache-2.0 licence, kept with the
app as the licence requires (see `LICENSES.md` §4 and §5).
