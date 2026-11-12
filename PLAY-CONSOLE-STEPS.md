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

### 1.1 App access
- **All functionality is available without special access** — chunein (app me koi login nahi).

### 1.2 Ads
- **No, my app does not contain ads.**

### 1.3 Content rating
- Category: **Reference, News or Educational** (ya "Utility, Productivity, Communication,
  or Other").
- Har sawal ka jawab **No**, siwaye:
  - *"Does the app allow users to purchase digital goods?"* → **Yes** (subscription hai).
  - *"Does the app share the user's location?"* → **No** (location sirf phone par namaz ke
    auqaat/qibla ke liye, kahin bhejti nahi).
- Aakhir me rating aa jayegi (usually **Everyone / 3+**), usay **Save** karein.

### 1.4 Target audience and content
- Age: **13+** (religious content, no ads, no user chat).
- *"Does your app appeal to children?"* → **No**.

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

### 1.6 News app
- **No.**

### 1.7 COVID-19 apps / Government apps / Financial features / Health
- Sab **No.**

### 1.8 Privacy policy

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
- **Contact details**: email + website (upar wala).
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
