# Bundled speech model — `models/bayyin-tiny/`

The Quran recitation model that ships with the app. It is **ours**: no other
person's Hugging Face repository is needed at run time, and the app keeps working
even if that repository is deleted or Hugging Face is unreachable.

## What is here

| File | What it is |
| --- | --- |
| `config.json`, `generation_config.json`, `preprocessor_config.json` | Whisper configuration |
| `tokenizer.json`, `tokenizer_config.json`, `vocab.json`, `merges.txt`, `normalizer.json`, `added_tokens.json`, `special_tokens_map.json` | Tokenizer |
| `onnx/encoder_model_quantized.onnx` (9.7 MB) | Encoder, 8-bit quantised |
| `onnx/decoder_model_merged_quantized.onnx` (28.8 MB) | Decoder, 8-bit quantised |
| `LICENSE` | Apache License 2.0, as published with the model |

Total about 39 MB. The files are **not precached** by the service worker; they
are cached the first time the model is used (`sw.js` → `IMMUTABLE`), so the
download happens once and later checks work offline.

## Where it came from (credit)

- Base model: **`tarteel-ai/whisper-tiny-ar-quran`** — Apache-2.0,
  <https://huggingface.co/tarteel-ai/whisper-tiny-ar-quran>
- ONNX (transformers.js) conversion: **`Sharjeelbaig/whisper-tiny-ar-quran-onnx`**
  — Apache-2.0, <https://huggingface.co/Sharjeelbaig/whisper-tiny-ar-quran-onnx>
- Architecture: **OpenAI Whisper** — MIT, <https://github.com/openai/whisper>

Apache-2.0 allows commercial use and redistribution; the license text is kept in
this folder (`LICENSE`) and the credit is repeated in `LICENSES.md`.

## How the app uses it

`asr.js` sets `env.localModelPath = 'models/'` and loads the id `bayyin-tiny`, so
the files above are read from this folder. If a device cannot read them, the app
falls back to the same model on Hugging Face (`MODELS[].fallback`), so a broken
copy never leaves the person with a dead checker.

## Updating the model

Replace the files here with the newer ONNX export (keep the same names), bump
`CACHE` in `sw.js`, and check one aya on a phone. Nothing else needs to change.
The base model (`nael239/tasme3-whisper-base-ar-quran-web`) is optional and stays
remote because its decoder is ~80 MB.

## Bigger model, same folder (optional)

To bundle the high-accuracy Base model too, copy
`nael239/tasme3-whisper-base-ar-quran-web` into `models/bayyin-base/` the same
way and add it to `MODELS` in `asr.js` with `local: true`. GitHub Pages allows
files up to 100 MB, and that decoder is 80 MB.
