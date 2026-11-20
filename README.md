# Bayyin (بيّن) — on-device Quran recitation checker

Ayaat chunein, mic par tilawat karein, aur foran dekhein kaunsa lafz sahi tha,
kaunsa qareeb tha, kaun galat suna gaya aur kya chhoot gaya. Poori processing
phone ke andar hoti hai — **koi server, koi account, audio kabhi upload nahi**.

Ye README app ka poora, taza tarreen hai: engine, model, screens, offline, Premium,
aur woh do cheezein jo apni nahi hain (Tanzil ka Quran text aur EveryAyah ki qari
audio) — woh neeche saaf likhi hain.

---

## Sab kuch apna

| Hissa | Kahan se | Note |
| --- | --- | --- |
| App ka code, design, icon, naam | **Bayyin** | © 2026 F A FS, all rights reserved |
| Speech engine (normalise, align, vowel/hamza, tajweed hints) | **Bayyin engine** | `normalize.js`, `align.js`, `tajweed.js` |
| Chalane wali library | pehle apni copy `vendor/ort/`, na mile to CDN | code usi tarteeb se dekhta hai |
| Chhota model | **Bayyin Tiny** — app ke andar (`models/bayyin-tiny/`, ~39 MB) | bina internet |
| Bara model | **Bayyin Base** — apne domain par (`/vendor/bayyin-base/`, ~105 MB) | sirf wahin se, Hugging Face se kabhi nahi |
| Quran ka text | **Tanzil** (tanzil.net) | `quran-tanzil.txt`, badalna mana hai |
| Qari ki tilawat | **EveryAyah** (everyayah.com) | stream hoti hai, bundle nahi |
| IndoPak mushaf | **Quran.com** API | pehli dafa internet, phir cache |

Baqi har cheez — duaein, tasbeeh, auqaat, qibla, calendar, hifz, murajaa, report,
badges, backup, push — app ke andar hi hai.

---

## Engine kaise kaam karta hai

1. **Text** — `quran-tanzil.txt`, Tanzil ka Uthmani (Hafs) text, `surah|aya|text`
   lines. Quran ka ek harf kabhi retype ya translate nahi hota.
2. **Audio** — microphone se Web Audio PCM (MediaRecorder sirf fallback), phir
   16 kHz mono samples.
3. **Speech to text** — Bayyin Tiny/Base model, phone par hi (WebAssembly, Web
   Worker me) — is liye check ke doran app atakti nahi.
4. **Normalisation** (`normalize.js`) — harakat, madd signs, small high letters,
   tatweel aur waqf marks hata diye jate hain; `ٱ أ إ آ → ا`, `ى → ي`, `ة → ه`.
   Rasm Uthmani ki khaas shaklein bhi fold hoti hain (الصلوٰة = الصلاة).
5. **Alignment** (`align.js`) — expected aur sune gaye alfaz ka Needleman–Wunsch
   DP. Har lafz: `sahi` / `qareeb` / `pakka nahi` / `galat` / `chhoot gaya`; aya me
   na hone wale alfaz `extras` ban jate hain. Score inhi se banta hai.
6. **Hamza aur madd** — `hamzaPattern()` har hamza ki **seat** rakhta hai (آ أ إ ء =
   alif, ؤ = waw, ئ = yaa). مَآبًا اور مِئَابًا ab ek nahi rehte: seat badal jaye to
   lafz "qareeb" ho kar `hamza/madd` ka tag le leta hai. Jhooti ghalti se bachne ke
   liye ye faisla sirf tab hota hai jab **dono taraf** nishan likha ho.
7. **Harakat** — jahan model harakat de deta hai wahan un ka muqabla hota hai; lafz
   sahi magar vowel mukhtalif ho to red mistake nahi, "qareeb" + tooltip.
8. **Tajweed hints** (`tajweed.js`) — script se rules: ghunnah, qalqalah, noon
   sakinah/tanween ke idgham/iqlab/izhar/ikhfa, meem sakinah, marked madd. Ye
   **nishan** hain; audio ki timing se tajweed naapi nahi jati (neeche "Sach").

---

## Screens — chaar darwaze

App khulne par seedha **Roz ki Naiki** aati hai; neeche bar me chaar:

- **Naiki** — aaj ki aya, hadith aur sunnah (60 ayaat, 30 ahadith, 60 sunnatein;
  roz badalte hain, hawale `daily-content.js` me — Shamela se mile hue).
- **Quran** — aya ba aya ya mushaf, Record ke saath.
- **Namaz** — teen tabs: **Auqaat**, **Qibla**, **Azaan**.
- **Aur** — Duaein, Tasbeeh, Khatam plan, Islami calendar, Inaam, Settings, aur ek
  hi **Bayyin Premium** card.

Premium ke andar bhi tabs hain: **Hifz plan**, **Hifz Test**, **Murajaa**, **Report**.

## Mushaf

- **Surah** tab: chuni hui surah ki saari ayaat, har aya apne card me aur apna
  Record button.
- **Mushaf** tab: poora page ek musalsal mushaf ki tarah (ayaat todi nahi jatin).
  Page ke aakhir me **"Is poore page ko record karein"** — poore page ka score aur
  aya-wise ghaltiyan.
- Do mushaf: **Madani** (604 pages, bundled Uthmani text) aur **IndoPak** (610
  pages, Haram/Taj 15-line, quran.com se page-wise text, pehli dafa phir cache).
- **Basmala alag** line me; bolna ya na bolna dono theek, ghalti nahi ginti.
- **Talash**: lafz se (bina harakat bhi), `2:255` se, ya juz number se.

## Roz ki Naiki

- **Aaj ki aya** — 60 ayaton ki list se roz ek; text hamesha bundled Tanzil mushaf
  se, neeche aasan matlab aur reference.
- **Aaj ki hadith** — Bukhari / Muslim / Tirmidhi / Nasa'i ke hawale ke saath.
- **Aaj ki sunnah** — 60 sunnatein, roz ek, poori list ek tap door.
- Har card ka **share** button 1080×1920 WhatsApp status image banata hai
  (Bayyin branding ke saath).

## Nateeja kahan dikhta hai

Record khatam hote hi tilawat khud check hoti hai aur nateeja **usi aya ke andar**:

1. Alfaz rang le lete hain — hara sahi, peela qareeb, laal galat, line-through
   chhoot gaya.
2. Har ghalat/qareeb lafz ke neeche aap ka padha hua lafz.
3. Aya ke upar patti: score %, verdict aur ginti.
4. Aya ke neeche ghaltiyon ki list: `galat · aya ka lafz → jo aap ne padha`.
5. Har galat lafz ke saath **🔊** — wohi lafz qari ki awaz me (`qari-timings.json`).
6. Check na ho sake to wahi patti wajah likh deti hai — kuch chup nahi rehta.

---

## Models

Do options (`asr.js` → `MODELS`), dono **apne**:

- **Bayyin Tiny** — app ke andar (`models/bayyin-tiny/`, ~39 MB: encoder 9.7 MB +
  decoder 28.8 MB, 8-bit). Bina internet. Default yahi hai.
- **Bayyin Base** — behtar accuracy, ~105 MB, apne domain par
  (`/vendor/bayyin-base/`), aur **sirf wahin se** load hota hai (`ownOnly`). Wo
  folder user-site repo ke workflow **"Bundle the Base model"** se banta hai
  (GitHub → Actions → Run workflow).

Pehla download **background me khud** ho jata hai (`autoLoadModel()`), magar sirf
jab network theek ho — save-data, 2G/3G aur cellular par nahi. Load hone ke baad
app yaad rakhti hai (`tc.modelReady`), storage `persist()` se maangi jati hai, aur
agle launch par model cache se chupke se load ho jata hai.

Status line par sirf **Bayyin** ka naam aata hai.

## Pehla khulna halka

| Cheez | Size | Kab |
| --- | --- | --- |
| Code + font + icons | ~1.5 MB | app khulte hi (precache) |
| Quran text + page map | 1.3 + 1.5 MB | reader khulte hi |
| Bayyin Tiny | ~39 MB | 12 s idle ke baad, ya pehli check par |
| Bayyin Base | ~105 MB | sirf jab khud chunein |
| Azaan recordings | 6 MB | jab azaan bajti hai |

## Offline

- `index.html` **cache se foran** khulta hai; nayi copy peeche se cache hoti hai.
- Har update naye worker ke saath (`CACHE = 'bayyin-v149'`), is liye app purane
  version par nahi atakti.
- Cache khali ho aur internet na ho to ek saaf page kehta hai "app ko ek dafa
  online khol lein" — browser ka error page nahi.
- Audio/video service worker se nahi guzarta (media byte-ranges mangta hai).

---

## Premium

- **Free (hamesha):** poora Quran aur mushaf, Duaein, Tasbeeh, Qibla, Calendar,
  Roz ki Naiki, Khatam plan, Inaam, aur **roz 3 talaawat checks**.
- **Premium:** Hifz plan, Hifz Test, Murajaa, Meri report, aur be-paana checks.
- **Plans:** `bayyin_premium` (30 din) aur `premium_yearly` (365 din).
- **Price:** Play build par **wahi price jo Play khud lega** (`getDetails()`, 30
  din cache, koi conversion nahi). Browser me region time zone se, currency
  `Intl.NumberFormat` se:
  - Mahina / Saal: **IN ₹99 / ₹799 · PK 299 / 2400 · BD 139 / 1120 ·
    NP 159 / 1280 · LK 359 / 2900 · baqi mulk $3.33 / $26.66**
  - Kata hua regular price (`REGULAR_PRICES`: IN 299, PK 899, BD 419, NP 479,
    LK 1079, baqi $6.66) sirf tab dikhta hai jab wo asli price se zyada ho.
- **Sab kuch device par:** `tc.premium*` keys. Koi account, koi server.
- **Kharidari ki jaanch:** TWA me Digital Goods API, phir Play ki apni
  `listPurchases()` — jo Play name kare wahi Premium kholta hai. Har launch par
  `restore()` chalta hai, lapse/cancel/refund khud band ho jate hain.
- **Gift codes** (`gift.js`) — owner phrase se apne phone par, aur
  `BAYYIN-ddd-NNNN-CCCCCC` codes dost ke liye.
- **`?demo=1`** par hi test buttons aate hain; normal app me kabhi nahi.

## Hifz Test, Murajaa, Report

- **Hifz Test** — agli aya / beech ki aya blur / khali lafz / mix; Leitner box
  (1, 3, 7, 14, 30 din), hint, khud-check mode. Data `tc.hztest`.
- **Murajaa** — har checked aya 1 → 3 → 7 → 14 → 30 din; 85% se neeche roz, 90%+
  par aage. Data `tc.murajaa`.
- **Meri report** — sab se zyada ghalat hone wale lafz + pichhle 14 din ka chart,
  share ke saath. Data `tc.report`.

## Inaam (badges)

Quran ka safar, accuracy, surah aur consistency ke badges — bronze / silver /
gold, hero ring, streak, aur naya badge milne par celebration. Free.

---

## Namaz, Qibla, Azaan

- **Auqaat** (`prayer.js`) — phone par NOAA solar equations (Fajr 18°, Isha 17°,
  Asr Hanafi 2 sāya / Shafi 1 sāya). Jagah `geo.js` se: pehle permission, phir
  network wali tez location, phir high accuracy; na chale to lat/long ka dabba.
- **Shehar** (`cities.js`) — ~180 shehar, ek tap me, koi permission nahi.
- **Qibla** (`qibla.js`) — pehle save ki hui jagah, phir GPS; needle
  `requestAnimationFrame` par halki smoothing ke saath ghumti hai.
- **Azaan** (`adhan.js`) — do recordings + "apni file"; jo chuni hai **wahi**
  bajti hai, ghalati par saaf message.

## Tasbeeh, Duaein, Calendar

- **Tasbeeh** — 6 zikr presets, apna target, Aaj/Round/Kul, undo, zero, vibration.
- **Duaein** — `duas.js` + `duas-data.js`, Ruqya me sirf dua + hawala.
- **Islami calendar** — hisabi Hijri; chand dekhne se 1 din farq ho sakta hai, app
  yahi likhti hai.

## Roz yaad dehani aur push

- `reminder.js` — roz ek notification, waqt chunne ka option.
- `push.js` + `worker/push-worker.js` — apna Cloudflare Worker, har minute ka cron.
  iOS par web push sirf iOS 16.4+ aur Home Screen install par.

## Backup aur error report

- Settings → **Backup**: saara `tc.*` ek JSON file me; naye phone par wapas.
- Settings → **Error report**: akhri 20 errors copy kar ke bhej sakte hain.

## Zubaan, design, icon

- Teen zubanein: **Roman Urdu**, **اردو**, **English** (`i18n.js`).
- Palette: mushaf leather (burgundy/plum) + copper + parchment, raat ke liye
  mahogany dark. Night mode, A− / A+ (18–44px) — dono yaad rehte hain.
- Quran ka text poore **Amiri Quran** font me, har lafz jud kar likha jata hai.
- Icon `icon-source.png` se; `.github/workflows/icons-from-source.yml` ek hi source
  se saare icons bana deta hai.

## Back button aur reload

- Har screen asli history entry hai apne trail ke saath — back button ek hi daba
  kar pichhli screen par.
- Pull-down reload, worker update ya crash ke baad app **usi screen** par wapas
  khulti hai (`tc.view`), pehle page par nahi.
- `overscroll-behavior-y: contain` — galti se pull-to-refresh nahi hota.

---

## Sach — kya pakadta hai, kya nahi

- Checker **lafz** dekhta hai: sahi / qareeb / pakka nahi / galat / chhoot gaya.
- Jo pakka nahi suna gaya wo **"pakke nahi" (grey)** — galat nahi. Jhoota nishan
  bharosa todta hai.
- **Tajweed** (madd ki tadaad, ghunnah ki muddat, makhraj) audio se naapi nahi
  jati — us ke liye phoneme-level model chahiye. Result ke neeche yahi likha aata
  hai; tajweed hints script se aate hain.
- ASR ki accuracy mic, shor aur lahje par depend karti hai. Tiny tez hai magar
  zyada ghaltiyan karta hai; Base behtar.
- Check lambi recording ko 30-second chunks me todta hai.

## Do cheezein jo apni nahi (aur ek chhoti baat)

- **Quran ka text — Tanzil** (tanzil.net), CC BY 3.0: commercial use theek hai,
  magar text badalna mana, copyright block rehna chahiye.
- **Qari ki tilawat — EveryAyah** (everyayah.com): muft, bina key, stream hoti hai.
- **Chhoti baat:** ONNX runtime ki wasm file (`ort-wasm-simd-threaded*.wasm`,
  14–26 MB) abhi CDN se aati hai, kyunke is repo ka GitHub rule itne bade file
  reject karta hai. Rule hata dein to woh bhi `vendor/ort/` me aa jayegi; code
  pehle se usi ke liye tayyar hai.

Third-party licences (Apache-2.0 / MIT / CC BY) ki poori tafseel `LICENSES.md` aur
app ke **Settings → Licenses** me hai — woh notices wahin rehni chahiye.

## Copyright

**© 2026 F A FS — Bayyin (بيّن). All rights reserved.** Shartein `LICENSE` me:
copy, badalna, kisi aur app/website/store listing me istemal karna ya bechna mana;
sirf apne istemal ke liye chalana jaiz. Yeh notice har source file ke top par aur
Settings me bhi hai.

---

## Files

`index.html` (+ `privacy.html`), `styles.css`, `v2.css`, `app.js`, `i18n.js`,
`strings-v2.js`, `extra-strings.js`, `asr.js` + `asr-worker.js`, `normalize.js`,
`align.js`, `tajweed.js`, `quran.js`, `surahs.js`, `quran-pages.js`, `indopak.js`,
`madani-layout.js`, `daily.js` + `daily-content.js`, `duas.js` + `duas-data.js`,
`tasbeeh-v2.js`, `calendar.js` + `hijri.js`, `prayer.js`, `geo.js`, `cities.js`,
`qibla.js`, `adhan.js`, `qari.js`, `word-audio.js`, `hifz-test.js`, `murajaa.js`,
`planners.js`, `premium-tools.js`, `premium.js` + `premium-strings.js`,
`billing.js`, `gift.js`, `progress.js`, `badges.js`, `accuracy.js`, `backup.js`,
`reminder.js`, `push.js`, `install.js`, `sw.js`, `quran-tanzil.txt`,
`models/bayyin-tiny/`, `vendor/`, `native/`, `worker/`, `widgets/`.

## CI

`.github/workflows/syntax-check.yml` har push/PR par saari apni `.js` files esbuild
se parse karta hai aur `manifest.webmanifest` ka JSON check karta hai (vendor
skip hota hai).

## Play Store

Poora step-by-step: [`PLAYSTORE.md`](PLAYSTORE.md) aur
[`PLAY-CONSOLE-STEPS.md`](PLAY-CONSOLE-STEPS.md) — account, TWA wrapper,
asset links, subscription products + per-country prices, billing bridge, testing,
closed testing (12 testers / 14 din) aur rollout.
