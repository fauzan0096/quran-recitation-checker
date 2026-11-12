# Bayyin (بيّن) — on-device Quran recitation checker

Ayaat chunein, mic par tilawat karein, aur foran dekhein kaunsa lafz sahi tha,
kaunsa qareeb tha, kaun galat suna gaya aur kya chhoot gaya. Poori processing
browser (ya app) ke andar hoti hai — **koi server, koi API key, audio kabhi
upload nahi hota**.

## Files (sab ek hi level par, koi folder nahi)

`index.html` (+ `privacy.html`), `styles.css`, `app.js` (UI), `i18n.js` (zubaan /
translations), `asr.js` (mic + model), `align.js`, `normalize.js`,
`tajweed.js`, `quran.js`, `surahs.js`, `premium-tools.js` (Premium report), `billing.js`
(Play Billing adapter), `prayer.js` (namaz ke auqaat), `backup.js`, `quran-tanzil.txt`,
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
- App me ek hi **Mushaf** entry hai (neeche bar / Home ka "Quran padhein"). Andar teen tabs: **Aya ba aya** (poori surah aya-ba-aya), **Mushaf**
  (page-wise, Madani ya IndoPak) aur **Talash** (lafz / aya / juz se). Surah aur
  page dono me har aya apne card me (ya mushaf page par apni jagah) hoti hai aur
  usi ke neeche apna **Record** button hota hai.
- Settings ek alag page hai (gear icon ya "Aur" ka card): share, model, audio/mic,
  tajweed hints, about/privacy aur licenses.

## Screens — chaar darwaze

App khulne par seedha **Roz ki Naiki** aati hai (aya, hadith, sunnah + aaj ka
kaam), kyunke wahi roz wapas laane wali cheez hai. Neeche bar me sirf chaar:

- **Naiki** — aaj ki aya, hadith aur sunnah (poora page ek tap door).
- **Quran** — aya ba aya ya mushaf, Record ke saath (asli kaam).
- **Namaz** — teen tabs: **Auqaat**, **Qibla**, **Azaan** (ek hi jagah).
- **Aur** — Duaein, Tasbeeh, Khatam plan, Islami calendar, Inaam, Settings, aur
  ek hi **Bayyin Premium** card.

Premium ke andar bhi tabs hain: **Hifz plan**, **Hifz Test**, **Murajaa**,
**Report** — chaar alag alag screens nahi, ek jagah.

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

## Hifz Test (murajaat) — `hifz-test.js` (Premium)

Home → **Hifz Test** (Premium). Yaad ki azmaish, teen andaaz me:

- **Agli aya** — pichli aya dikhti hai, agli chhupi hoti hai (sirf "؟"). Mic par yaad se padhein.
- **Beech ki aya blur** — aage aur peechhe ki ayaat dikhti hain, beech ki blur.
- **Khali lafz** — aya me beech ke 1–3 lafz khali; poori aya ya sirf khali lafz bolein.
- **Mix** — teeno random.

Sahi padhne par aya poori khul jati hai (rang ke saath). Adhoori/ghalat padhne par sirf sahi lafz
khulte hain, baaki chhupe rehte hain — dobara bolein, **Hint** lein (pehla harf) ya **Dikhao**.
Mic ke baghair **khud check** mode (Dikhao → Yaad tha / Bhool gaya) bhi hai.

Har aya ka Leitner box hota hai (1, 3, 7, 14, 30 din): sahi par aage, ghalti/hint par kal phir.
"Smart" tarteeb due aur kamzor ayaat pehle laati hai; Home par "aaj due" dikhta hai. Sab data
sirf device ke `localStorage` (`tc.hztest`) me rehta hai.

## Padhna hai ya yaad se azmaish?

- Ayat ka text hamesha khula hota hai — dekh kar padh sakte hain.
- **🌙 (upar right)** se **night mode** — poori app dark ho jati hai, raat me padhne ke
  liye. Phone already dark mode me ho to app khud dark khulti hai; pasand yaad rehti hai.
- List ke neeche **A− / A+** se text ka size (18–44px); size yaad rehta hai.
- Quran ka text poore **Amiri Quran** font (`amiri-quran.ttf`) me rehta hai aur har lafz
  jud kar likha jata hai — tight letter-spacing, kerning tweaks aur synthetic motai hata
  di gayi hai, kyunke unse harf alag ho jate the (الصلاة → الص ل اة).

## Yaad-dasht (bookmark / progress)

- Har aya ke neeche ek chhoti patti hai: **✓ Yaad hai** / **↺ Dobara** / **＋ Nishan**.
  Tap karne par nishan badalta hai (none → ✓ → ↺ → none), aur jo chunein woh
  `localStorage['tc.progress']` me yaad rehta hai. Card ke oopar **★** se woh aya
  bookmark ho jati hai.
- Record ke baad aya ka **score khud save** ho jata hai (`97%` aya ke neeche dikhta
  hai), aur us din ko practice counted kiya jata hai.
- **Settings → Meri yaad-dasht**: lagataar din (streak), check ki hui ayaat, ausat
  score, aur ✓ / ↺ / ★ ki alag alag list — kisi bhi entry par tap karein to wahi aya
  khulti hai. **"Yaad-dasht mita dein"** se sab saaf.
- Surah picker ke saath **↩ 2:255** jaisa chip = jahan aakhri bar the, wahin se shuru;
  tap karne par wahi aya flash ho kar khulti hai.
- Sab kuch sirf is device par (localStorage) — koi account nahi, koi server nahi.
- Mushaf page par kisi aya ko select karein to usi bar me ★ aur ✓/↺ bhi mil jate hain.

## Tasbeeh, Qibla aur Islami calendar

Header ke **⋯ (Mazeed)** se teen sections khulte hain — reader saaf rehta hai:

- **Tasbeeh**: 6 zikr presets (SubhanAllah 33, Alhamdulillah 33, Allahu Akbar 34,
  tahlil / istighfar / darood 100). Bade gol button par tap = ginti +1, gol ring
  bharta hai, target poora hone par halka vibrate. Neeche **round**, **aaj ka
  total** aur **kul total**. Sab kuch `localStorage['tc.tasbeeh']` me; naya din
  aane par aaj ka count khud zero ho jata hai, lifetime total rehta hai.
- **Qibla**: button dabane par location + compass ki ijazat mangi jati hai, phir
  Kaaba ka rukh (**degrees uttar se**) aur **Makkah se doori** dikhti hai. Dial
  phone ke ghumne ke sath ghumta hai aur align hone par sunhara ho jata hai.
  iPhone par compass ki ijazat sirf usi tap se milti hai (iOS ka rule), aur agar
  phone me compass na ho to sirf bearing + instructions dikhte hain — jhoota
  compass nahi.
- **Islami calendar**: hisabi (tabular) Hijri calendar — aaj ki Hijri aur
  Gregorian tareekh, poore mahine ka grid (bada Hijri din, chhota Gregorian din),
  Jumma ka din alag rang, aur mahina aage/peeche karne ke buttons.
  Note: chand dekhne ki bina par mahina 1 din aage/peeche ho sakta hai — app yahi
  likhti hai, andaze se "aaj Eid hai" ka dawa nahi karti.

## Roz ki Naiki (pehle Noor) — roz ki aya, hadith aur sunnah

Mazeed ke home grid par **Roz ki Naiki**:

- **Aaj ki aya** — 60 ayaton ki list se roz badalti hai; text hamesha bundled Tanzil
  mushaf se aata hai (kabhi retype nahi), neeche **aasan matlab** (Roman Urdu ya
  English, zubaan ke hisaab se) aur reference (`Al-Baqarah 255`).
- **Aaj ki hadith** — 30 chhoti, mashhoor ahadith (Arabic + tarjuma + hawala:
  Bukhari / Muslim / Tirmidhi waghera).
- **Aaj ki sunnah** — 60 pyaari sunnatein, roz ek; neeche poori list khul jati hai
  (number, matlab, hawala, aur share button).
- Teenon ek hi page par, ek sajaye hue burgundy/copper card me — oopar Gregorian +
  Hijri tareekh.
- **Status par lagayein** — har card ka share button ek **1080×1920 WhatsApp status**
  image banata hai: app ke rangon me Arabic text, reference, Bayyin branding aur © line.
- Roz ka item **local date** se tay hota hai, is liye din badalte hi naya content
  aata hai.
- **Zaroori note (app me bhi likha hai):** hadith/sunnah ke hawale kitab ki sath hain —
  publish se pehle kisi aalim se takhreej ki tasdeeq karayein. Content
  `daily-content.js` me hai, barhana asaan hai.

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
- Service worker **cache-first** hai: shell turant cache se aata hai aur code
  background me taza hota hai, is liye naya version agli load par aa jata hai;
  naya worker activate hote hi page ek dafa reload hota hai.
- Android/Chrome: `beforeinstallprompt` pakar kar neeche chhoti **Install** card aati
  hai, jo asli install prompt kholti hai (`appinstalled` par band ho jati hai).
- iOS/Safari: wahi card **Share → Add to Home Screen** ke steps dikhata hai.
- iPhone par launcher icon change karne ke baad purana icon reh sakta hai — Home
  Screen se app **remove** kar ke dobara **Add to Home Screen** karein (iOS icon
  cache karta hai). `apple-touch-icon-180.png` ka naam badla gaya hai taake naya
  icon naya URL ho.
- Settings me bhi **"Install app"** card hai (banner dismiss karne ke baad bhi).
- Installed app ka naam **بيّن** hi dikhta hai (manifest `short_name`).

### Manifest — `manifest.webmanifest`

- Install prompt / app listing ke liye **screenshots** (`screenshots/`: 3 phone
  540×1080, 2 desktop 1280×720) labels ke saath.
- **Shortcuts** (icon long-press): Duaein, Tasbeeh, Namaz ke auqaat, Roz ki Naiki
  (`?go=dua|tasbeeh|prayer|daily`).
- **Share target**: koi bhi text/link share kar ke bhejein to app Quran search me
  wohi lafz khol deti hai.
- **File handler**: `.txt` file se kholein to pehli line search hoti hai.
- **Protocol handler** `web+bayyin:` — `web+bayyin:daily` jaisa link seedha us
  screen par.
- Desktop/Windows ke liye `display_override` (window controls overlay / tabbed),
  `edge_side_panel`, `note_taking`, `tab_strip` aur **widget** (`widgets/` me
  Adaptive Card template + data, `sw.js` ke `widgetinstall/widgetresume` handlers).

### Service worker ke extra kaam

- **Background Sync** (`bayyin-sync`) aur **Periodic Background Sync**
  (`bayyin-daily`, ~roz ek dafa): phone online hote hi / roz chupke se shell cache
  taza hota hai (`refreshShell()`).
- **Push**: `push` par notification (title/body/tag/url), `notificationclick` par
  app ka wohi screen khulta hai; `pushsubscriptionchange` ka handler maujood hai
  (server nahi hai, is liye kuch re-send nahi hota).
- `?go=` aur share/file/protocol se aane wale launch `app.js` ke `handleLaunch()`
  me handle hote hain.


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

- **© 2026 F A FS — All rights reserved.** Poori shartein repo ki `LICENSE`
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

## v2 changes (Nov 2026)
- Home screen opens instantly (Quran text loads in background); bottom bar: Home / Quran / Duaein / Tasbeeh / Naiki.
- Duaein are now inside the app (duas.js + duas-data.js); Ruqya section has only dua + hawala.
- New tasbeeh (tasbeeh-v2.js): own target, Aaj/Round/Kul, undo, zero, vibration, sound, screen-on.
- "Roz ki Naiki" (pehle Aaj ka Noor): ayat + hadith + sunnah on one page, also on Home.
- Faster service worker (cache-first for heavy files). Amiri Quran font bundled (OFL, see OFL-AmiriQuran.txt).
- Quran ka text poore Amiri Quran (`amiri-quran.ttf`) me: joined letters sahi, "hide text" option hata diya, aur motai slider bhi hata diya (synthetic bold Arabic ki joining tod deta tha).
- Old Fahm-ul-Quran files (dua.js, tools.js, sounds.js ...) deleted - they were never loaded.
- Premium: Hifz plan + be-paana checks paid, 3 din trial, roz 3 free checks, aur
  **har mulk ki apni currency** me price (`premium.js` ka country → currency table;
  dollar sirf un mulkon me jahan dollar hi chalta hai). Play build par trial band —
  trial wahan Play ke free-trial offer se aata hai.
- Settings me "Free ya Premium" ka chart (kaun si cheez free, kaun si paid) aur
  Premium me **Meri report** (`premium-tools.js`): murajaa ki list, sab se zyada
  ghalat hone wale lafz, aur roz ka tareekh. Engine self-test ka card hata diya gaya.
- Namaz ke auqaat (`prayer.js`), Backup (`backup.js`), error report, Play Billing
  adapter (`billing.js`), CSP aur CI syntax check. Demo buttons sirf `?demo=1` par.

## Update: rasm, hamza, model ek baar

- **Rasm Uthmani** (`normalize.js`): الصلوٰة = الصلاة = الصلوة، الزكوٰة = الزكاة، الحيوٰة = الحياة،
  الربوٰا = الربا. Sirf in khaas alfaz par; ربوة (pahari) ki asli waw nahi badalti.
- **Hamza (ء)**: ءامنوا = آمنوا، القرءان = القرآن، يستهزءون = يستهزئون، هٰٓؤلآء = هؤلاء، السماء.
  Hamza ki har shakal (ء ئ ؤ) dono taraf se hata di jati hai, aur do alif ek ho jate hain.
  Isse Talash (search) me bhi bina hamza likha lafz mil jata hai.
- **Model ek baar**: pehli dafa load hone ke baad app yaad rakhti hai (`tc.modelReady`) aur
  agli dafa khud background me cache se load kar leti hai; storage `persist()` se maangi jati hai
  taake browser weights na hataye; Transformers.js library + wasm service worker me
  `bayyin-lib-v1` cache me rehti hai (offline bhi). Record aur Load ek hi load ka intezar karte hain.


## Premium (subscription) — kaise chalta hai

- **Free (hamesha)**: poora Quran, Duaein, Tasbeeh, Qibla, Calendar, Roz ki Naiki
  (aya + hadith + sunnah), aur **roz 3 talaawat checks**.
- **Premium**: **Hifz plan** (sabaq / sabqi / murajaa planner, reminder ke saath),
  **Hifz Test**, **Murajaa** (roz ki dohrai, neeche), **Meri report** (neeche) aur
  be-paana talaawat checks. In sab ka har rasta (More card, home ka kaam, reminder)
  `setView()` se guzarta hai, is liye gate wahin ek jagah lagi hai. More grid me
  chaaron Premium cards ek hi jagah hain, "Premium" badge ke saath.
- **Trial**: pehli dafa app khulne par **3 din** poora Premium khula rehta hai
  (`tc.premiumSince`), uske baad free hadd lag jati hai.
- **Plans aur SKUs** (`premium.js` me `PLANS`): `bayyin_pro_monthly` (30 din),
  `bayyin_pro_yearly` (365 din).
- **Price mulk ke hisaab se**: `region()` phone ke **time zone** se mulk nikalta
  hai (Kolkata → IN, Karachi → PK, Dhaka → BD, Kathmandu → NP, Colombo → LK),
  warna phone ki language ke region tag se; currency `Intl.NumberFormat` se banti
  hai — **India, Pakistan, Bangladesh, Nepal aur Sri Lanka** me ₹99 jitna tier
  (IN ₹99/₹799, PK 330/2640, BD 140/1120, NP 160/1280, LK 340/2720) aur **baqi
  har mulk $3.33 / $29.99**. Paywall par mulk ka naam (`regionName`) aur local
  price likha aata hai. Asli qeemat Play apne payment sheet me dikhata hai.
- **Sab kuch device par**: `tc.premium`, `tc.premiumSince`, `tc.premiumExpires`,
  `tc.premiumPlan`, `tc.premiumChecks` — koi account, koi server, koi audio upload
  nahi. (Browser/OS ka data clear karna "restore purchase" se hoga.)
- **Play Billing judne par**: verified purchase par sirf `activate('monthly' |
  'yearly')` call karna hai; app khulte waqt `queryPurchasesAsync` mila purchase
  par `setPremium(true)`; refund/cancel par `cancel()`. `billing.js` yahi bridge
  use karta hai (`window.BayyinBilling`).
- **Test karna**: URL ke aakhir me `?demo=1` lagayein to paywall par demo buttons
  aa jate hain; normal app me wo kabhi nahi dikhte.
- **Demo mode**: demo buttons ("Premium chalu", "Trial khatam") sirf `?demo=1` wale URL par
  dikhte hain — normal app me kabhi nahi. Is liye release me koi muft Premium nahi le sakta.
  `PAYWALL_ON = false` kar dene se app poori khuli rehti hai (Play review ke liye kaam aata hai).
- Test karne ka tareeqa: More → Hifz plan (lock) → Premium screen; ya 4th
  talaawat check par paywall; trial khatam kar ke roz 3 checks ka limit dekhein.

## Meri report (Premium) — `premium-tools.js`

Settings → **Meri report**, ya More grid ka **Meri report** card. Do tab:

- **Ghaltiyan** — sab se zyada ghalat/suna nahi gaya lafz, kitni dafa, kis aya me,
  aur suna kya gaya. **Report share** se poora khulasa text me bhej sakte hain.
- **Tareekh** — pichhle 14 din ki chhoti chart (kitne checks), kul checks, din aur
  ausat score.

Data sirf `tc.report` me device par rehta hai (`premium-tools.js`); check ke waqt
`recordReport()` use bharta hai. Koi audio ya text bahar nahi jata.

## Talaawat check ki raftaar

- **Default ab tez hai**: greedy decoding (`num_beams = 1`) — Whisper ka default beam search
  (5 beams) se kai guna tez.
- **Chhote audio par chunking nahi**: sirf 30 second se lambi recording chunk hoti hai;
  ek aya ke liye overlap ka extra kaam khatam.
- **Shuru/aakhir ki khamoshi hata di jati hai** (`asr.js` → `trimSilence`), is liye model
  khali waqt decode nahi karta.
- **Token limit**: audio ki lambai ke hisaab se `max_new_tokens` tay hota hai (448 se zyada nahi).
- Settings → **Model** me **"Behtar accuracy (deri zyada)"** checkbox: beam search (5 beams),
  dheri lagti hai magar natija behtar ho sakta hai.
- Sab se bara waqt pehli dafa **model download (~105 MB)** ka hota hai; uske baad cache se
  chalta hai. **Tiny** model chun kar inference aur bhi tez ho jata hai (accuracy kam).
- Check ke doran status me **kitne second lag rahe hain** aur **audio kitni der ka hai** dikhta hai.

## Inaam (badges) — `badges.js`

More → **Inaam**. Har badge pehle se mehfooz data se banta hai (`progress.js` ke scores aur
✓ marks, streak aur practice days) — naya kuch track nahi hota:

- **Quran ka safar**: pehla qadam, 100 ayaat, chauthai, **aadha**, teen chauthai, poora Quran.
- **Accuracy**: pehli be-ghalti (100%), 25 be-ghalti, "saaf talaawat" (20 checks ke baad ausat 90%).
- **Surah**: pehli surah mukammal, 5 surahs mukammal (saari ayaat ✓).
- **Consistency**: 7 din lagataar, 30 din lagataar, 30 din ka safar.

Screen (naya design):

- **Hero card**: dark maroon panel, gold ring me poori Quran progress (%), aur neeche ek
  patli **meter** jo dikhati hai kitne badges mile.
- Uske neeche teen **stats** chips: lambi streak, be-ghalti ayaat aur mukammal surahs.
- Badges ke teen **darje**: **bronze** (shuruaat — pehla qadam, 100 ayaat, pehli
  be-ghalti), **silver** (chauthai, aadha, 25 be-ghalti, saaf talaawat, pehli surah,
  7 din), **gold** (teen chauthai, khatam, 5 surahs, 30 din, 30 din ka safar). Medal ka
  rang darje se badalta hai.
- List do hisson me: **"Haasil kiye"** (earned) aur **"Aage ke lakshya"** (locked, 🔒).
  Jo maqsad sab se qareeb hai us par **"Next goal"** ka tag.
- Locked badge par progress bar aur `x / target`.

Naya badge milne par **celebration** overlay: gold medallion, ghoomti kirnein, 28
chamakte sitare, "Mubarak ho!" aur ek button. Sab **free** hai (premium nahi). Data
`tc.badges` me sirf earned ids ke tor par rehta hai.


## Murajaa — `murajaa.js` (Premium)

More → **Murajaa** — Premium cards ke saath, "Premium" badge ke saath. Card par aaj
kitni ayaat due hain woh chhota gold count bhi dikhta hai. Free user card dabaein to
paywall khulta hai (gate `setView()` me, hifz / hztest / report ke saath).

- Har checked aya aik chhote **spaced-repetition** schedule par aa jati hai: **1 → 3 → 7 → 14 → 30 din**.
- **Kam score (85% se neeche)** wali ayaat roz aati hain; **90%+** par agli murajaa aage khisak jati hai;
  umeed se kam par wapas kal.
- Har row: aya ka reference, score, kitni ghaltiyan, kitne din purani, aur **Padhein** (reader me
  khulta hai) + **Yaad tha** (agla din set hota hai) buttons.
- Data `tc.murajaa` me (due date, step); scores wohi jo har check par `tc.report` me likhe jate hain.
- Report (Premium) me **Ghaltiyan** aur **Tareekh** tabs hain — Murajaa apna alag Premium card hai.

## Play Store billing — `billing.js`

Browser paisa nahi le sakta. Play par app **TWA** (PWABuilder package) me chalti hai — wahan
billing Chrome ke **Digital Goods API** se hoti hai (sirf Play se install ki gayi TWA me):

```js
const service = await window.getDigitalGoodsService('https://play.google.com/billing');
// getDetails -> PaymentRequest(https://play.google.com/billing) -> acknowledge(token, 'repeatable')
```

`billing.js` me dono raste hain: Digital Goods API (TWA) aur `window.BayyinBilling` bridge
(agar kabhi Capacitor/native shell use ho):

```js
window.BayyinBilling = {
  purchase(sku) { /* Play Billing -> verify -> { ok, token } */ },
  restore()     { /* queryPurchasesAsync -> { ok, sku, token } */ },
  manage()      { /* Play subscription management screen */ },
};
```

`available()` tabhi true hota hai jab bridge ho ya page Play-installed TWA me chale
(`document.referrer` = `android-app://…`); warna paywall saaf kehta hai ke subscription
Play app me milti hai. Plan card `billing.buy()` chalata hai, "Purchase restore karein" aur
"Play Store me manage karein" buttons khud aa jate hain, aur app **launch par `restore()`**
khud chala kar renewal/cancel pick up karti hai (`app.js` → `syncSubscription()`).

Play build me **in-app 3-din trial band** rehta hai (`premium.js` → `isPlayBuild()`): wo
native bridge aur Play-installed **TWA** (Digital Goods API + `android-app://` referrer)
dono pehchanta hai, is liye PWABuilder wale package me bhi trial nahi chalta — wahan trial
Play ke "free trial offer" se aata hai, taake Play ki digital-goods policy ki khilaf-warzi
na ho. Browser/preview me purana 3-din trial jaisa hai. `?demo=1` wale testing buttons
Play build par kabhi nahi dikhte.

Play policy: digital subscription sirf Play Billing se — is liye `assetlinks.json` (TWA)
aur native shell bina release nahi ho sakta. Verify server-side (RTDN) karna behtar hai;
client par `activate()` sirf verified jawab ke baad chalta hai.

### Gift codes — `gift.js`

Owner (aap) ek dafa **owner phrase** gift box me likh kar apne phone par Premium hamesha ke
liye khol lete hain; uske baad Premium screen par **"Gift code banayein"** tool aata hai jo
`BAYYIN-ddd-NNNN-CCCCCC` codes banata hai (`ddd` = din, `000` = hamesha). Jisko chahein wo
code bhej dein — wo **"Gift code"** box me daal kar Premium khol leta hai. Sab kuch phone
par check hota hai (koi server nahi), is liye yeh courtesy hai, lock nahi: JS padhne wala
bhi khol sakta hai. Play ke liye yeh theek hai — Play sirf yeh chahta hai ke *khareedari*
Play Billing se ho, muft dena mana nahi.

**Poora step-by-step release plan: [`PLAYSTORE.md`](PLAYSTORE.md)** (Play Console account,
wrapper, asset links, subscription products + per-country prices, billing bridge ka Kotlin
skeleton, verification Worker, testing aur rollout).

## Namaz ke auqaat — `prayer.js`

More → **Namaz ke auqaat**. Auqaat phone par hisaab hote hain (NOAA solar equations:
Fajr 18°, Isha 17°, Asr Hanafi 2 sāya / Shafi 1 sāya). Jagah geolocation se ya khud
latitude/longitude daal kar; sirf `tc.prayer` me save hoti hai. Network ki zaroorat nahi.

## Backup — `backup.js`

Settings → **Backup**: ek JSON file me saara `tc.*` data (progress, report, settings,
premium status). Wapas laane par app reload hoti hai. File device se bahar nahi jati
jab tak aap khud share na karein.

## Error report

App me `window.onerror` / unhandled rejection akhri 20 errors `tc.errors` me rakhte hain;
Settings → **Error report** se copy kar ke bhej sakte hain.

## CI

`.github/workflows/syntax-check.yml` har push/PR par saari `.js` files ko esbuild se parse
karta hai aur `manifest.webmanifest` ka JSON check karta hai.


## Play Store: closed testing (14 din / 12 testers)

- Personal developer account par Google ki shart: **kam az kam 12 testers** jo
  **14 din lagataar** closed test me opted-in rahein, tab "production" access
  milta hai (organization account par yeh shart nahi).
- Tareeqa: Play Console → Testing → Closed testing → naya track → testers ki
  email list ya Google Group daalein → build upload karein → opt-in link
  (`play.google.com/apps/testing/<package>`) testers ko bhejein.
- Testers ke liye aasan steps: link kholein → "Become a tester" → Play Store se
  app install karein → 14 din tak app kuch dafa kholein (uninstall na karein).
- 12 se zyada (14–15) rakhein, kyunke koi ek agar opt-out kar de to ginti poori
  rahe.
- Testers ko yeh cheezein zaroor karne ko kahein: Hifz plan aur Hifz Test (Premium
  screen), trial khatam kar ke roz 3 checks ka limit, qibla compass, Roz ki Naiki
  page, aur ek talaawat check (mic ki ijazat ke saath).



## Qari ki audio — `qari.js`

Ghalti ki wazahat ke saath ab sahi tilawat bhi suni ja sakti hai.

- Reciters (EveryAyah.com — muft, bina key): Alafasy, Husary, Abdul Basit (Murattal),
  Minshawy. Settings → **Qari ki tilawat** se chunein (choice `tc.qari` me).
- Reader me har result card par **🔊 Qari sunen** — wohi aya, sahi tilawat.
- Meri report → Ghaltiyan me har lafz ke saath **▶** — us aya ki awaaz.
- Audio on-demand stream hoti hai (app me bundle nahi), is liye APK chhoti rehti hai;
  internet chahiye. Ek waqt me ek aya; reader chhodne par khud band.

## Galti ki wazahat

- Har mistake list ke neeche ek seedhi line: "Aap ne «X» sunaya, sahi «Y» hai" ya
  "«Y» chhoot gaya" — pehli 3 galtiyan, uske baad "+n aur".
- Word list pehle jaisi: tag (close / wrong / missing), sahi lafz → jo suna gaya.

## Roz yaad dehani — `reminder.js`

- Settings → **Roz yaad dehani**: on/off, waqt (default 20:00) aur **Test notification**.
- Roz ek notification: Murajaa ayaat due hain to "{n} ayaat dohrani hain", warna
  "aaj ka hissa baqi hai".
- Notification tab aati hai jab app khuli ho ya khulte hi; app band ho to wahi
  notification Cloudflare Worker ki push se aati hai (neeche "Push notifications").



## Word-level qari audio — `word-audio.js`

- Ghalti ki list me har lafz ke saath **🔊** — sirf wohi lafz qari ki awaz me sunai
  deta hai (poora aya nahi).
- Timing data **quran-align** (CC BY 4.0, Alafasy) se: `.github/workflows/qari-timings.yml`
  ko GitHub par **ek dafa manually chalayein** (Actions → Qari word timings → Run
  workflow). Wo `qari-timings.json` bana kar commit kar deta hai.
- File na ho ya us lafz ki timing na ho to button "poora aya sun lein" keh deta hai —
  app kuch nahi torta.

## Push notifications (app band ho to bhi) — `push.js` + `worker/push-worker.js`

- Push apne aap on ho jata hai jab **Azaan** ya **Roz yaad dehani** on karein — dono ek
  hi subscription use karte hain, aur wo tabhi hatti hai jab dono band hon.
- Server: ek chhota **Cloudflare Worker** (`worker/push-worker.js`) — subscriptions
  KV me, aur **har minute** ka cron. Har push apna payload le kar jati hai (RFC 8291 /
  aes128gcm) aur `Urgency: high` ke saath jati hai, is liye:
  - namaz ke waqt: **"Azaan — Fajr"** usi minute (pehle `*/10` cron se 7-8 minute late
    aati thi),
  - chune hue waqt par roz ki yaad dehani,
  - 08:00 par Roz ki Naiki (Jumma ko Jumma wali),
  - azaan ki notification par tap karne se app khulta hai aur azaan chalti hai.
- Phone ~7 din ka prayer schedule rakhta hai; app har 2 din me use dobara bhej deti hai.
- Keys `push-setup.html` se banti hain (browser me hi); `push.js` me `ENDPOINT` aur
  `PUBLIC_KEY` daalna hai. Poora tareeqa `worker/README.md` me.
- iOS par web push sirf iOS 16.4+ aur Home Screen par install hone par chalta hai.
- App **band** hone par awaz khud nahi baj sakti (koi browser app closed page ko sound
  nahi bajane deta) — us waqt notification aati hai, tap par azaan chalti hai.



## Kya pakadta hai, kya nahi

- Checker sirf **lafz** dekhta hai: sahi / qareeb / **pakka nahi** / galat /
  chhoot gaya.
- **Jo pakka nahi suna gaya, wo "pakke nahi" (grey) dikhta hai — galat nahi.**
  Galat ka nishan lagana bharosa todta hai, is liye aisa lafz na sahi gina jata
  hai na galat.
- **Tajweed** (madd, ghunnah, qalqala, ikhfa…) Whisper nahi pakad sakta — wo
  sirf alfaaz sunta hai. Result ke neeche yeh baat saaf likhi hai, taake koi
  ghalat umeed na rakhe. Tajweed ke liye kisi qari se mashwara karein.

## Checker ki jaanch (accuracy)

- Har result ke neeche **"✓ Sahi tha / ✗ Galat tha"** hai.
- Settings → **Checker ki jaanch** me ginti aur percentage banti hai.
- 20–30 asli recordings (bade aur bachche, alag awaazein) par rate karein — tab
  yeh number andaze ki jagah **naapi hui accuracy** ban jata hai.

## Backup (naya phone)

- Settings → Backup → **Backup file save karein** ya **Backup bhejein
  (WhatsApp / Drive)**.
- File me hifz plan, yaad ki hui ayaat, murajaa, tasbeeh, badges, settings aur
  report — sab kuch hai (`tc.*` keys).
- Naye phone par app kholein → Settings → **Backup wapas laayein** → sab wapas.
  (Yeh file hi sync hai: device se device, bina account.)
