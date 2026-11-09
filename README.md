# Bayyin (بيّن) — on-device Quran recitation checker

Ayaat chunein, mic par tilawat karein, aur foran dekhein kaunsa lafz sahi tha,
kaunsa qareeb tha, kaun galat suna gaya aur kya chhoot gaya. Poori processing
browser (ya app) ke andar hoti hai — **koi server, koi API key, audio kabhi
upload nahi hota**.

## Files (sab ek hi level par, koi folder nahi)

`index.html` (+ `privacy.html`), `styles.css`, `app.js` (UI), `i18n.js` (zubaan /
translations), `asr.js` (mic + model), `align.js`, `normalize.js`,
`tajweed.js`, `quran.js`, `surahs.js`, `selftest.js`, `quran-tanzil.txt`,
`LICENSE` / `LICENSES.md`.

## Kaam kaise karta hai (pipeline)

1. **Text**: `quran-tanzil.txt` — Tanzil ka Uthmani (Hafs) text, `surah|aya|text` lines.
2. **Audio**: microphone (Web Audio PCM -> WAV; MediaRecorder sirf fallback), phir 16 kHz mono samples.
3. **Speech to text**: Whisper ka Quran par fine-tuned checkpoint, ONNX me export
   hua, browser me **Transformers.js + ONNX Runtime Web (WASM)** se chalta hai.
   Sirf model ke wazan ek dafa download hote hain, phir browser cache se load hote hain.
4. **Normalisation** (`normalize.js`): harakat, madd/maddeh signs, small high
   letters, tatweel aur waqf marks hata diye jate hain; `ٱ أ إ آ → ا`, `ى → ي`,
   `ة → ه`, `ؤ/ئ` unify. Yeh dono taraf (Quran text aur ASR output) par lagta hai.
5. **Word alignment** (`align.js`): expected alfaz aur sune gaye alfaz ka
   Needleman–Wunsch DP. Har expected lafz ko status milta hai:
   `correct`, `close` (1–2 harf ka farq, jaise ص/س), `wrong`, `missing`; aya me
   na hone wale alfaz `extras` ban jate hain. Score in sab se banta hai.
6. **Tajweed hints** (`tajweed.js`): script se rules detect hote hain —
   ghunnah, qalqalah, noon sakinah/tanween ke idgham/iqlab/izhar/ikhfa, meem
   sakinah, aur madd (maddah sign). Yeh hints hain, audio ki timing ki jaanch nahi.

## Al-Siraat jaisi apps kya karti hain

Public store listings ke mutabiq woh "AI tutor" hain jo recitation errors
"highlight" karti hain — yani ASR + Quran text ke saath alignment, aur uske
upar tajweed feedback. Implementation (on-device vs server, kaunsa model) kahin
public nahi. Is project me wahi pipeline khud banaya gaya hai, aur poori tarah
on-device.

## Chalane ka tareeqa

- Ye ek **zero-build plain web app** hai: `index.html` + ES modules, koi bundler nahi.
- Pehli dafa model load karne ke liye internet chahiye (CDN se library aur
  Hugging Face se model weights). Uske baad model browser cache me rehta hai.
- Reader teen tabs me khulta hai: **Surah** (poori surah aya-ba-aya), **Mushaf**
  (page-wise, Madani ya IndoPak) aur **Talash** (lafz / aya / juz se). Surah aur
  page dono me har aya apne card me (ya mushaf page par apni jagah) hoti hai aur
  usi ke neeche apna **Record** button hota hai.
- Settings ek alag page hai (gear icon): share, model, audio/mic, tajweed hints,
  self-test, about/privacy aur licenses.
- Mic ke baghair engine test: **Settings → Engine self-test**.

## Aya-ba-aya, mushaf-ba-mushaf

- **Surah** tab: chuni hui surah ki saari ayaat ek ke neeche ek — har aya apne card
  me, usi ke neeche apna Record button.
- **Mushaf** tab: poora page **ek musalsal mushaf** ki tarah (ayaat ko toda nahi
  jata), aya number ke nishan ke saath. Page ke aakhir me **"Is poore page ko record
  karein"** — poori page ki tilawat ka score aur aya-wise ghaltiyan. Kisi aya par tap
  karein to woh select ho jati hai aur sirf usi aya ko record/share kar sakte hain.
- Do mushaf: **Madani (604 pages, bundled Uthmani text)** aur **IndoPak (610 pages,
  Haram/Taj 15-line, Quran.com se page-wise text)**. IndoPak page pehli dafa internet
  se aata hai, phir cache se.
- **Basmala alag**: har surah ki bismillah apni line me dikhti hai aur aya 1 ka
  text uske baad se shuru hota hai (Fatihah me basmala khud aya 1 hai, Tawbah me
  basmala nahi). Check karte waqt basmala bolna ya na bolna dono theek hai — ghalti
  nahi ginti.
- **Search** tab: lafz se (harakat ke baghair bhi), aya se (`2:255`) ya juz number se
  (`5`) talash karein; nateeja tap karne par wahi aya khulti hai.

## Padhna hai ya yaad se azmaish?

- Ayat ka text upar khula hota hai — dekh kar padh sakte hain.
- **Text chhupayein** dabaein to ayat blur ho jati hai (yaad se padhne ke liye).
  Record rukne par text khud wapas aa jata hai aur usi par rang + natija dikhta hai.
- **🌙 (upar right)** se **night mode** — poori app dark ho jati hai, raat me padhne ke
  liye. Phone already dark mode me ho to app khud dark khulti hai; pasand yaad rehti hai.
- List ke neeche **A− / A+** se text ka size (18–44px) aur **− / +** se harf ki
  motai (300–800; patla / aam / mota / bohot mota). Dono settings yaad rehti hain.

## Zubaan, splash aur khush aamdeed

- Teen zubanein: **Roman Urdu**, **اردو** aur **English** — Settings → *Zubaan*, ya
  pehli dafa ki welcome screen par. Chuni hui zubaan browser me yaad rehti hai
  (`localStorage['tc.lang']`); phone ki zubaan Urdu ho to app khud Urdu me khulti hai.
- Poora UI usi zubaan me badal jata hai: tabs, labels, status lines, score/verdict,
  ghalti ke tags (`sahi / qareeb / galat / chhoot gaya`), share, install card — sab.
  **Quran ka text kabhi translate nahi hota** — har haal me mushaf ke usi Uthmani
  lafz me rehta hai.
- Har dafa app khulne par **splash**: logo + بيّن + ek chhoti loader line; ~1 second
  baad app aa jati hai. Kuch load na ho to bhi splash 6 second me khud hat jata hai.
- Pehli dafa sirf ek **welcome screen**: app kya karti hai (teen points), zubaan
  chunne ka option aur **"Shuru karein"**. Uske baad dobara nahi aati
  (`localStorage['tc.welcomed']`).
- Sab strings `i18n.js` me hain: static text `index.html` me `data-i18n="key"` se,
  dynamic text `t('key')` se. Nayi zubaan chahiye to usi file me ek table barha dein.

## Nateeja kahan dikhta hai

Koi alag "Nateeja" panel ya transcript type karne ki jagah nahi. Record khatam hote hi
tilawat khud check ho jati hai (model pehle se load na ho to woh pehle download hota hai)
aur nateeja **usi aya ke andar** aata hai:

1. Aya ke alfaz rang le lete hain: hara = sahi, peela = qareeb, laal = galat,
   cut (line-through) = chhoot gaya.
2. Har galat/qareeb lafz ke **neeche** chhote font me aap ka padha hua lafz likha
   aata hai (`padha: …` / `qareeb: …` / `chhoot gaya`).
3. Aya ke upar ek chhoti patti: score %, verdict aur ginti.
4. Aya ke **neeche** ghaltiyon ki list: `galat · aya ka lafz → jo aap ne padha`
   (chooha hua lafz `nahi padha` ke saath).
5. Agar check na ho sake (model load nahi, audio khali/khamosh, internet), to yahi
   patti wajah likh deti hai — kuch chup nahi rehta.

## Mic kaam nahi kar raha?

- Recording ab **Web Audio** se seedha hoti hai (MediaRecorder ke baghair), is liye
  "Record dabate hi band" wala masla (iOS, Android WebView, PWA) nahi aata. Sirf agar
  Web Audio na ho to MediaRecorder fallback chalta hai.
- Recording ke dauran status batata hai ke **awaaz aa rahi hai ya nahi**; 3 second tak
  khamoshi ho to warning aati hai.
- **"Mic ki ijazat nahi mili"**: browser/app me microphone Allow karein. Preview ke
  andar iframe me mic block ho sakta hai — tab tak "audio file" se upload karein.
- **"Mic jaanch"** dabaein: secure page, API, permission, tareeqa, 2-second asli
  recording + decode aur awaaz ka level — sab dikha deta hai.
- Page https (ya localhost) se khulna chahiye; `index.html` ko seedha file se kholne par
  Quran text aur mic dono kaam nahi karte.

## Models

`asr.js` me do options hain (dono Transformers.js ke liye ONNX, same Tarteel
Quran fine-tune ke base se):

- `nael239/tasme3-whisper-base-ar-quran-web` — behtar accuracy, ~105 MB
  (23 MB encoder + 80 MB decoder).
- `Sharjeelbaig/whisper-tiny-ar-quran-onnx` — chhota/tez, ~40 MB.

Library **Transformers.js v4** (v4.3.2) se aati hai — yeh Quran ONNX exports
isi version ke saath test kiye gaye hain; purana v3 in models ko load nahi kar pata
tha. Status line me load hone ke baad version bhi likha aata hai.

Note: kuch base-model repos ka "quantized" decoder asal me 300 MB+ ka hota hai
(naam quantized, file full-size) — aisa model phone par load nahi hota, is liye
yahan woh repo istemal nahi hota. Naya model add karte waqt dono ONNX files ka
size zaroor dekhein; `dtype: 'q8'` layout (`encoder_model_quantized.onnx` /
`decoder_model_merged_quantized.onnx`) hona chahiye.

## Limits (sach)

- ASR ki accuracy mic, shor, aur qari ke lahje par depend karti hai. Tiny model
  tez hai magar zyada ghaltiyan karta hai; base behtar hai.
- `close` vs `wrong` ka faisla edit distance par hai, is liye tajweed ki bareek
  ghaltiyan (madd ki tadaad, ghunnah ki muddat, harf ka makhraj) audio se
  naapna is version me nahi hai — woh phoneme-level model ka kaam hai.
- Reciter agar aya se aage/peeche chala jaye to alignment us ko extras/missing
  ke tor par dikhata hai, jo expected behaviour hai.
- Whisper 30-second windows me chalta hai; bara range dein to chunking hoti hai.

## Apne app me kaise jorein

Engine (normalise + align + tajweed) platform-independent JS hai, is liye:

- **React Native / Capacitor / Ionic**: yehi `*.js` files copy karein; ASR ke
  liye `react-native-executorch`, `whisper.rn` ya ONNX Runtime Mobile.
- **iOS (native)**: Core ML me Whisper encoder/decoder convert karein
  (`coremltools`, ya `whisper.cpp` Ka `whisper.xcframework`), phir yehi
  normalise/align logic Swift me port karein (DP chhota hai, ~100 lines).
- **Android (native)**: ONNX Runtime Mobile (`onnxruntime-android`) me wahi
  quantized encoder/decoder, ya `whisper.cpp` NDK build.
- Alignment/tajweed ka koi bhi hissa server-side nahi hai — sirf model ka ek
  dafa download, uske baad app offline chalti hai.

## Install (PWA)

- `install.js` + `sw.js`: app home screen par install ho jati hai aur shell (Quran
  text, page data, JS/CSS) offline cache ho jata hai.
- Service worker **network-first** hai: naya version agli load par khud aa jata hai
  (offline par cache se chalta hai), aur naya worker activate hote hi page ek dafa
  reload hota hai.
- Android/Chrome: `beforeinstallprompt` pakar kar neeche chhoti **Install** card aati
  hai, jo asli install prompt kholti hai (`appinstalled` par band ho jati hai).
- iOS/Safari: wahi card **Share → Add to Home Screen** ke steps dikhata hai.
- iPhone par launcher icon change karne ke baad purana icon reh sakta hai — Home
  Screen se app **remove** kar ke dobara **Add to Home Screen** karein (iOS icon
  cache karta hai). `apple-touch-icon-180.png` ka naam badla gaya hai taake naya
  icon naya URL ho.
- Settings me bhi **"Install app"** card hai (banner dismiss karne ke baad bhi).
- Installed app ka naam **بيّن** hi dikhta hai (manifest `short_name` + `lang: ar`).

## Design / icon / naam

- Naam: **Bayyin (بيّن)** — launcher/manifest me Arabic **بيّن** hi dikhta hai.- Palette: **mushaf leather (burgundy/plum) + copper + parchment** — green/blue se alag,
  raat ke liye alag mahogany dark theme.
- Icon: `icon-source.png` (mushaf + mihrab arch + tick, burgundy/copper) hi asli
  source hai. Usi se `icon-512.png`, `icon-192.png`, `icon-maskable-512.png`
  (Android), `apple-touch-icon-180.png` (180×180, iPhone), `favicon.ico` /
  `favicon-32.png` aur `icon.svg` / `icon-maskable.svg` bane hain. Header ka
  logo aur install banner bhi yehi icon dikhate hain.
- App ka naam **Bayyin (بيّن)** hai. Play Store par "Qirat Check" ya "Harf Mizan"
  bhi check kiye gaye — dono ke exact naam ka koi listing search me nahi mila.

## Apna icon lagana ho to

Repo me apni image `icon-source.png` naam se upload kar dein (koi bhi size,
PNG/JPG). Workflow `.github/workflows/icons-from-source.yml` **ek hi source** se
saare icons bana deta hai — `icon-512.png`, `icon-192.png`,
`icon-maskable-512.png` (icon ke apne background par padded), `apple-touch-icon-180.png`
(180, iPhone), `favicon-48.png` / `favicon-32.png` / `favicon.ico`, aur
`icon.svg` / `icon-maskable.svg` (jo wahi PNG embed karte hain). Manifest aur
index.html pehle se inhi filenames par set hain, is liye kuch aur badalna nahi padta.

## Licenses (Play Store ke liye)

App ke andar **Settings → Licenses / Open source** me poore notices hain, aur
`LICENSES.md` me bhi:

- **Quran text**: Tanzil Project, **CC BY 3.0** — commercial use allowed, magar
  text badalna mana hai, copyright block rehna chahiye, aur Tanzil + tanzil.net ka
  zikr zaroori hai.
- **Quran-tuned Whisper** (Tarteel AI + ONNX exports): **Apache-2.0**.
- **Whisper**: MIT. **Transformers.js**: Apache-2.0. **ONNX Runtime**: MIT.

Yani app free hai aur store par publish ho sakti hai; bas ye notices app me
maujood rehni chahiye.

## Copyright / licence (app ka apna)

App ka **code, design, icon aur naam** kisi open-source licence par nahi hai:

- **© 2026 Fauzan Gorme — All rights reserved.** Poori shartein repo ki `LICENSE`
  file me hain: copy karna, badalna, kisi aur app / website / store listing me
  istemal karna ya bechna mana hai; sirf app ko apne istemal ke liye chalana
  jaiz hai.
- Yeh notice **har source file ke top** par bhi maujood hai (`index.html`,
  `app.js`, `styles.css`, `sw.js` …) aur app ke andar **Settings → About &
  privacy** aur settings ke neeche footer me bhi dikhta hai.
- Third-party hisse is licence se **mustasna** hain: Quran text (Tanzil,
  CC BY 3.0 — badalna mana), Whisper models (Apache-2.0), Transformers.js
  (Apache-2.0), ONNX Runtime (MIT). Tafseel `LICENSES.md` me hai.
- Naam "Bayyin / بيّن" aur icon par bhi haq mehfooz hai, taake koi doosra isi
  naam ya icon ke saath app publish na kar sake.

## Privacy policy (Play Store ke liye)

- `privacy.html` — alag page, bina kisi JS ke, app ke hi theme me. Ismein likha
  hai: koi account nahi, koi server nahi, audio upload nahi, local storage me
  kya rehta hai, aur internet sirf model download + IndoPak pages ke liye hai.
- Settings ke About card aur footer me iska link hai; service worker ise bhi
  cache karta hai, to offline bhi khulta hai.
- Play Store listing me **privacy policy URL** chahiye hota hai — published site
  ka `…/privacy.html` wohi URL hai. `LICENSE` aur `LICENSES.md` bhi repo me
  maujood hain, un ka link bhi desk par de sakte hain.

## Credits

- Quran text: **Tanzil Project** (tanzil.net), Uthmani Hafs — copyright notice
  `quran-tanzil.txt` ke aakhir me maujood hai, usay hatayein na.
- Quran-tuned Whisper: **Tarteel AI** (Apache-2.0), ONNX exports community se.
- Transformers.js / ONNX Runtime Web: Hugging Face / Microsoft (Apache-2.0).
