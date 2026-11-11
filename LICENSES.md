# Licenses / Attributions

## 0. App ka code, design aur naam — © 2026 Fauzan Gorme

Bayyin (بيّن) ka **code, UI, theme, icon aur naam** © 2026 Fauzan Gorme hain.
**Tamam huqooq mehfooz hain.** Copy karna, badalna, kisi doosri app ya website me
istemal karna, ya bechna mana hai — poori shartein repo ki `LICENSE` file me
hain. Woh notice har source file ke top par aur app ke andar Settings me bhi
maujood hai.

Neeche diye gaye third-party hisse **is licence se mustasna** hain aur apne apne
malik ke terms ke tehat hain. Ye licence un par koi haq nahi deta, aur un ke
licences is app ke code par koi haq nahi dete.

Is app me teen tarah ka third-party material hai: Quran ka text, speech
recognition models, aur browser me unhe chalane wali libraries.

## 1. Quran text — Tanzil Project

Tanzil Quran Text (Uthmani, Version 1.1)
Copyright (C) 2007-2026 Tanzil Project
License: Creative Commons Attribution 3.0

This copy of the Quran text is carefully produced, highly verified and
continuously monitored by a group of specialists at Tanzil Project.

TERMS OF USE:

- Permission is granted to copy and distribute verbatim copies of this text,
  but CHANGING IT IS NOT ALLOWED.
- This Quran text can be used in any website or application, provided that its
  source (Tanzil Project) is clearly indicated, and a link is made to
  <https://tanzil.net> to enable users to keep track of changes.
- This copyright notice shall be included in all verbatim copies of the text,
  and shall be reproduced appropriately in all files derived from or containing
  substantial portion of this text.

Please check updates at <https://tanzil.net/updates/>.
License text: <https://creativecommons.org/licenses/by/3.0/>

Poora notice `quran-tanzil.txt` ke aakhir me bhi maujood hai — usay hatayein na.

## 1b. Amiri Quran font — SIL Open Font License 1.1

`amiri-quran.ttf` is the Amiri Quran typeface (Khaled Hosny / Amiri Project,
<https://github.com/aliftype/amiri>), released under the SIL Open Font License
1.1. The full licence text is in `OFL-AmiriQuran.txt`. The font is used
unmodified, embedded only for the mushaf text.

## 2. Quran-tuned Whisper models — Apache License 2.0

- Base fine-tunes: `tarteel-ai/whisper-base-ar-quran` and
  `tarteel-ai/whisper-tiny-ar-quran` (Tarteel AI), Apache-2.0.
- ONNX exports is app me istemal hue:
  - `nael239/tasme3-whisper-base-ar-quran-web`
  - `Sharjeelbaig/whisper-tiny-ar-quran-onnx`

Licensed under the Apache License, Version 2.0; you may obtain a copy of the
License at <https://www.apache.org/licenses/LICENSE-2.0>.

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied.

## 3. Whisper — MIT License

Model architecture aur original weights: OpenAI Whisper
(<https://github.com/openai/whisper>).

## 4. Transformers.js — Apache License 2.0

&copy; Hugging Face (<https://github.com/huggingface/transformers.js>).

## 5. ONNX Runtime Web — MIT License

&copy; Microsoft Corporation (<https://github.com/microsoft/onnxruntime>).

## MIT License text (Whisper, ONNX Runtime)

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions: the above copyright notice and this
permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.



## Quran recitation audio — EveryAyah.com

The "Qari sunen" button streams the recitation of one aya from
<https://everyayah.com> (plain mp3, no key, no account). Nothing is bundled with
the app and the audio is not re-sold. Reciters offered: Mishary Rashid Alafasy,
Mahmoud Khalil Al-Husary, Abdul Basit (Murattal) and Mohamed Al-Minshawy.

## IndoPak mushaf text — Quran.com (Quran Foundation)

The IndoPak 15-line option reads its text from Quran.com's public API
(<https://api.quran.com/api/v4/quran/verses/indopak>), page by page, and caches
it on the device. Quran.com is a waqf run by Quran Foundation; the Madani
mushaf stays fully offline from the bundled Tanzil text. Their newer Content
API needs a registered app and a server-side secret, which is why the app only
uses the public endpoint for this optional script.




## Word timings — quran-align (CC BY 4.0)

Word-by-word timestamps used by the "sirf yeh lafz sunen" button come from
**quran-align** by Collin Fair (<https://github.com/cpfair/quran-align>),
licensed under Creative Commons Attribution 4.0 International
(<https://creativecommons.org/licenses/by/4.0/>). The `qari-timings.json` file
in this repo is extracted from their published archive (Alafasy set) and is
used only to seek inside the EveryAyah recording of the same aya.



## Azaan recordings — Wikimedia Commons

The Settings → Azaan player streams one of four free recordings:

- **Adhan** by Aishatu98 — CC0 (public domain).
- **Adhan — Jarih** — CC BY-SA 3.0.
- **The Adhan — Aaqib Azeez** (Atcovi) — CC BY-SA 4.0.
- **Llamada a oración, Mezquita Hassan II** by Fraguando — CC BY-SA 4.0.

All four are on <https://commons.wikimedia.org> and are used unmodified with the
credit shown in Settings. Nothing is bundled with the app.
