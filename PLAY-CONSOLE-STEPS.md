# Play Console — step by step (Bayyin)

Account ban gaya, app ban gayi. Ab Dashboard par jo checklist hai, usi order me ye karein.
Jo text chahiye wo `STORE-LISTING.md` me hai — wahan se copy-paste karein.

---

## 0. Sab se pehle: package name

Play Console app ke naam ke neeche jo package dikhata hai wo **`bayyin.app`** hai (AAB isi
package se banti hai, aur `.well-known/assetlinks.json` me bhi yahi likha hai). PWABuilder me
package ID **bilkul `bayyin.app`** daalein — ek dafa upload hone ke baad package **badla
nahi ja sakta**.

---

## 1. Dashboard → "Set up your app" (neeche se upar)

### 1.1 App access (sign-in details)

Screen poochhta hai: *"Is all or some functionality restricted?"*

- **All functionality is available without special access** ← yahi chunein.
- App me koi login, account, password ya invite code nahi hai — sab kuch pehli screen se
  khul jata hai.
- Is option ke saath **instructions ka box nahi aata**; seedha **Save** karein.
- Agar Play phir bhi instructions maange (kuch consoles me aata hai), likh dein:
  `No login or account is needed. Every feature opens from the home screen.`
- **Sign-in details** ka box sirf tab khulta hai jab upar wala doosra option
  ("some/all functionality is restricted") chunein — us se bachein, warna Play reviewer
  ke liye username/password maangta hai jo hamare paas nahi hai.

### 1.2 Ads

- *"Does your app contain ads?"* → **No**.
- App me koi ad SDK nahi hai, koi banner/interstitial nahi, koi ad network nahi.
- **Save**.

### 1.3 Content rating (IARC questionnaire)

1. **Start questionnaire** → apna email → **Category: Reference, News or Educational**
   (Quran app ke liye sab se theek).
2. Phir jo sawal aayein, un ke jawab:

| Sawal (aisa hi aata hai) | Jawab |
| --- | --- |
| Violence (realistic / fantasy / cartoon) | **No** |
| Blood, gore, injury | **No** |
| Sexual content, nudity | **No** |
| Profanity / crude humour | **No** |
| Drugs, alcohol, tobacco | **No** |
| Gambling (real or simulated) | **No** |
| Horror / fear / disturbing themes | **No** |
| Users can interact or share content with others | **No** |
| Users can share their personal information | **No** |
| App shares the user's location | **No** (location sirf phone par namaz/qibla ke liye) |
| **In-app purchases / digital goods** | **Yes** (subscription hai) |
| Contains ads | **No** |
| App accesses the internet | **Yes** (sirf downloads: model, mushaf safhe, qari audio) |
| Miscellaneous (camera, contacts, etc.) | **No** |

3. Submit karein — rating aayegi (usually **Everyone / 3+ / PEGI 3**). **Save**.

> Note: "digital purchases = Yes" ka matlab yeh nahi ke app me ads hain — Play sirf yeh
> jaanna chahta hai ke paise liye jate hain ya nahi.

### 1.4 Target audience and content

- **Age groups** → **13-15, 16-17, 18 and over** tick karein (18+ bhi chalega, magar 13+ se
  app zyada logon tak pahunchti hai).
- *"Does your app appeal to children?"* → **No**.
- Agli screen par jo confirmation aaye ("Your app will not be available to children") →
  **Next / Save**.
- Isi section me kabhi *"Designed for families"* ka option aaye → **No**.

### 1.5 Data safety (line by line)

App content → **Data safety → Start**.

1. *"Does your app collect or share any of the required user data types?"* → **No**.
   (Isi jawab se poora lamba form skip ho jata hai — sirf tasdeeq maangi jati hai.)
2. *"Have you reviewed and accounted for all data types in the Data safety section?"* →
   **Yes** (tick karein).
3. Aage jo confirmation aaye ("You have declared that your app does not collect or share
   user data") → **Save**.
4. Agar kabhi *"Is all user data encrypted in transit?"* poochha jaye → **Yes** — app ki
   har network request HTTPS par hoti hai.

**Kyun "No" sach hai (aapke mann me clear ho jaye):**
- App **kuch bhi upload nahi karti**: zubaan, theme, reading position, tasbih count, hifz
  progress, backup — sab phone ke local storage me.
- Tilawat ka audio sirf check hone tak memory me rehta hai, phir mit jata hai.
- Mic sirf Record dabane par chalta hai aur aawaz device chhodti nahi.
- Network sirf teen kaam: speech model ka ek dafa download (Hugging Face CDN), IndoPak
  mushaf ke safhat (Quran.com — sirf page number), aur qari ki audio (EveryAyah.com).
  In me se kisi me naam/email/phone/location nahi jata.
- Kahin account nahi banta, is liye "data deletion" ka sawal hi nahi uthta.

### 1.6 AI-generated content / AI assets

- *"Does your app generate content using AI?"* → **No**.
- Kyun: app me ek hi AI hai — **on-device speech recognition model** (jo tilawat sun kar
  lafzon se milata hai). Yeh content **banata nahi**, sirf suni hui baat ko text me badal
  kar check karta hai. Koi text, tasveer, audio ya video user ko dikhane ke liye generate
  nahi hota, aur kuch upload bhi nahi hota.
- App ke icon, illustrations aur screenshots **static assets** hain (design files), AI se
  banne wala koi user-facing content nahi.
- Agar form "AI assets" ke naam se poochhe ke app/listing me AI se banayi tasveerein hain →
  jo sach ho wahi batayein. Yahan declaration app ke *content* ki hoti hai, aur uska jawab
  **No** hai.
- **"Yes" na karein** — us se Play in-app reporting aur extra review maangta hai, aur app
  me aisa kuch hai hi nahi.

### 1.7 News app
- **No.**

### 1.8 COVID-19 apps / Government apps / Financial features / Health
- Sab **No.**

### 1.9 Privacy policy

- **Privacy policy URL** (yahi paste karein):
  `https://fauzan0096.github.io/quran-recitation-checker/privacy.html`
- Yeh page live hai (maine check kiya) aur usme app ka naam, data, mic, payment, bachon
  wali baat aur rabta — sab likha hua hai.
- Agar isi screen par **"Data deletion"** ki line aaye:
  - *"Do you provide a way for users to request deletion of their data?"* → **No**.
  - Reason (agar box ho): "The app has no account and stores nothing on a server. All data
    lives on the user's own device, so deleting the app deletes the data."
- Agar **"Account deletion URL"** maanga jaye → yeh app accounts nahi banati, is liye
  box khali chhod dein (ya "Not applicable" chunein).

---

## 2. Store listing

| Box | Kya daalein |
| --- | --- |
| App name | `Bayyin — Quran Recitation` |
| Short description | `STORE-LISTING.md` se (80 chars) |
| Full description | `STORE-LISTING.md` se |
| App icon | `icon-512.png` |
| Feature graphic | `screenshots.html` → "Feature graphic" → PNG (1024×500) |
| Phone screenshots | `screenshots.html` se 6 tasveerein (1080×1920) |
| Category | Education (ya Books & Reference) |
| Tags | Quran, Islam, Education |
| Contact email | **apna email** (Play isi par reply karta hai) |
| Website | `https://fauzan0096.github.io/quran-recitation-checker/` |

---

## 3. Store settings

- **App category**: Education.
- **Tags**: Quran, Islam, Education.
- **Contact details**: email **gormefauzan@gmail.com** + website (upar wala).
- **External marketing**: tick kar sakte hain (Play aapki app ko promote karega).

---

## 4. Pricing & distribution

- **Free** (with in-app purchases).
- **Countries**: sab (ya jahan chahein).
- **Device categories**: Phone + Tablet.
- Declarations (export laws etc.): tick karein.

---

## 5. Monetize → Products → Subscriptions

1. **Create subscription** → Product ID: `bayyin_pro_monthly`
2. Base plan: `monthly`, **auto-renewing**, billing period **P1M**.
3. Price: India ₹99; baqi mulk Play khud convert kar dega (chahein to manual bhi kar
   sakte hain).
4. **Free trial**: 3 din, naye subscribers ke liye.
5. **Activate** karein.
6. Wahi cheez dobara: Product ID `bayyin_pro_yearly`, base plan `yearly`, **P1Y**, ₹799.

---

## 6. Testing → Internal testing

1. **Create new release** → AAB upload karein (PWABuilder se bani hui, package `bayyin.app`).
2. Release notes: `STORE-LISTING.md` ka "What's new".
3. **Testers**: apna email + 2–3 dost.
4. **Save → Review → Start rollout**.
5. Testers ko opt-in link milega — us par tap kar ke Play se install karein.
6. Install ke baad app kholein: agar upar **URL bar** dikhe to assetlinks ki fingerprint
   theek nahi hai (neeche step 8).

---

## 7. Closed testing (production se pehle zaroori)

Naye **personal** developer account par production se pehle **12 testers × 14 din** ki
closed testing lazmi hai:

1. **Testing → Closed testing → Create track**.
2. Wahi AAB upload karein (ya internal wali release ko promote karein).
3. 12 testers ke email daalein, 14 din tak unhe app use karne dein.
4. 14 din poore hone par **Production → Apply for production access** — Play kuch sawal
   poochta hai (kaun test kiya, kya feedback mila). Saaf-saaf likh dein.

---

## 8. Asset links (URL bar hatane ke liye)

1. Play Console → **Test and release → Setup → App signing**.
2. *App signing key certificate* ka **SHA-256** copy karein.
3. PWABuilder ki `signing-key-info.txt` se **upload key** ka SHA-256 bhi lein.
4. Dono `PLAY-CONSOLE-STEPS.md` ke sath wale numbers mujhe bhej dein — main
   `.well-known/assetlinks.json` me daal dunga, phir app bina URL bar ke khulegi.

---

## 9. Production

1. **Production → Create new release** → wahi AAB.
2. Countries: sab.
3. **Review → Start rollout** (20% se shuru karna behtar hai).
4. Review 2–7 din leta hai.

---

## Yaad rahe

- **TWA = live website**: naye features ke liye naya AAB nahi chahiye, sirf site update hoti hai.
  AAB tabhi badalta hai jab icon/manifest/billing/package badle.
- Har purchase **Play Billing** se hi honi chahiye (app me already hai).
- Privacy policy, rating aur data safety ke jawab app ke asli behaviour se match karte hain —
  yeh `privacy.html` aur code ke hisaab se likhe gaye hain.
