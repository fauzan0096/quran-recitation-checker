# Quran Recitation Checker (on-device)

Ayaat chunein, mic par tilawat karein, aur foran dekhein kaunsa lafz sahi tha,
kaunsa qareeb tha, kaun galat suna gaya aur kya chhoot gaya. Poori processing
browser (ya app) ke andar hoti hai — **koi server, koi API key, audio kabhi
upload nahi hota**.

## Files (sab ek hi level par, koi folder nahi)

`index.html`, `styles.css`, `app.js` (UI), `asr.js` (mic + model), `align.js`, `normalize.js`,
`tajweed.js`, `quran.js`, `surahs.js`, `selftest.js`, `quran-tanzil.txt`.

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
- Interface jaan boojh kar chhota hai: surah/aya chunein, aya dikhti hai, aur neeche
  **sirf ek Record button**. Model download, audio file, mic jaanch, tajweed hints
  aur self-test sab **Settings / Advanced** ke peeche hain.
- Mic ke baghair engine test: **Engine self-test** (normalisation + alignment +
  tajweed + Quran data ke 16 assertions).

## Ek waqt me ek aya

- Surah chunein, aya number likhein (ya **Pichli / Agli** se badlein) — ek waqt me
  sirf ek aya check hoti hai, poori surah nahi.
- Har aya ka apna nateeja, apne rang aur apni ghaltiyon ki list hoti hai; agli aya
  par jaate hi nateeja saaf ho jata hai.

## Padhna hai ya yaad se azmaish?

- Ayat ka text upar khula hota hai — dekh kar padh sakte hain.
- **"Text chhupayein"** dabaein to ayat blur ho jati hai (yaad se padhne ke liye).
  Record rukne par text khud wapas aa jata hai aur usi par rang + natija dikhta hai.
- Dobara **"Text dikhayein"** se kabhi bhi wapas.

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

## Credits

- Quran text: **Tanzil Project** (tanzil.net), Uthmani Hafs — copyright notice
  `quran-tanzil.txt` ke aakhir me maujood hai, usay hatayein na.
- Quran-tuned Whisper: **Tarteel AI** (Apache-2.0), ONNX exports community se.
- Transformers.js / ONNX Runtime Web: Hugging Face / Microsoft (Apache-2.0).
