# Play Console — step by step (Bayyin)

Account ban gaya, app ban gayi. Ab Dashboard par jo checklist hai, usi order me ye karein.
Jo text chahiye wo `STORE-LISTING.md` me hai — wahan se copy-paste karein.

---

## Naya Play Console — cheezein kahan hain

Play ne UI badal diya hai; neeche wo jagah hai jahan aaj kal har cheez milti hai.
(Sab se pehle: phone par **Chrome me ⋮ → Desktop site**, warna menu chhupa rehta hai.)

| Kya chahiye | Naye console me kahan |
| --- | --- |
| Privacy policy, Ads, Content rating, Target audience, Data safety | left menu → **App content** |
| App ka naam, description, screenshots, feature graphic | **Store presence → Main store listing** |
| Category, tags, contact email | **Store presence → Store settings** |
| Subscriptions (`premium_monthly`, `premium_yearly`) | **Monetize with Play → Products → Subscriptions** |
| Closed testing track, release, testers, opt-in link | **Release → Testing → Closed testing** |
| Production release / apply for production | **Release → Production** |
| Upload kiye hue AAB | **Release → App bundle explorer** |
| **App signing SHA-256** | **Settings (⚙️) → App integrity** (kuch consoles me **Release → App integrity**) |
| Testers ki free kharidari (License testing) | **Settings → License testing** |
| Payments profile (bank + PAN) | **Settings → Payments profile** |
| Developer page (public) | **Grow → Developer page** (yahi na mile to search me "developer page") |
| Account details / verification | **Settings → Account details** |

**Sab se tez tareeqa:** Play Console ke upar **search (🔍)** me cheez ka naam likh dein —
`App integrity`, `License testing`, `Subscriptions`, `Closed testing` — wo seedha khul jata hai.

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

### 5.0 Order: pehle subscription ya pehle PWA/AAB?

**Pehle subscription products bana lein** (ye sirf catalog hai, 5 minute ka kaam), **phir AAB
upload karein** — is tarah jab tester app install karega, Premium ka button foran kaam
karega. AAB ke bina bhi subscription ban jati hai; magar **kharidari test** karne ke liye
Play se install ki hui build chahiye. Agar "Monetize" menu nazar na aaye to pehle Internal
testing par ek AAB chadha dein, phir menu aa jata hai.

### 5.1 Pehle payments profile

Play Console → **Setup → Payments profile** — bank account, PAN, address. Iske baghair
subscription **publish/activate nahi hoti** (draft ban jati hai). Ek dafa ka kaam.

### 5.2 Monthly subscription (ek ek step)

1. Play Console → **Monetize → Products → Subscriptions → Create subscription**.
2. **Product ID**: `premium_monthly` → **exact yahi** (app ke `billing.js` me yahi SKU
   hai; baad me badla nahi ja sakta).
3. **Name**: `Bayyin Premium (Monthly)`
   **Description**: `Hifz plan, Hifz Test, Murajaa aur Meri report — har mahine.`
4. **Add base plan**:
   - Base plan ID: `monthly` (default)
   - Billing period: **1 month**, **Auto-renewing**
   - Renewal type: charge full price (default)
5. **Set price** → India: **₹99**. Baqi mulkon ke liye:
   - chahein to "Set prices automatically" (Play khud convert karega), ya
   - manual: Pakistan 330 PKR, Bangladesh 140 BDT, Nepal 160 NPR, Sri Lanka 340 LKR.
6. **Free trial offer** (base plan ke andar): **3 days**, "New subscribers only",
   ek dafa per user.
7. **Activate base plan** → phir upar **Activate subscription** dabayein.
   (Draft rehne par testers ko price nahi milegi.)

### 5.3 Yearly subscription

Wahi steps, bas:
- Product ID: `premium_yearly`
- Base plan: `yearly`, **1 year**, auto-renewing
- India: **₹799** (PK 2640 / BD 1120 / NP 1280 / LK 2720)
- 3 din ka free trial

### 5.4 Testers ke liye free kharidari

1. Play Console → **Settings → License testing**.
2. Testers ke **Gmail** add karein → Save.
3. Unke liye Play ka "Test card, always approves" chalta hai — paisa nahi katta,
   purchase phir bhi asli tarah verify hoti hai.

### 5.5 Asli test (Play se install karke)

1. Testers app Play se install karein (closed testing ka opt-in link).
2. App → **Aur → Bayyin Premium** → monthly/y
   yearly card dabayein.
3. Play ka payment sheet khulega ("Test card") → Continue.
4. App me **Premium khul jana chahiye** (Hifz plan, Hifz Test, Report tabs aa jayenge).
5. App band karke dobara kholen — launch par **restore** chalta hai, Premium bana rehna
   chahiye.
6. **Cancel test**: Play Store → Payments & subscriptions → Subscriptions → cancel →
   app kholen → wapas free ho jana chahiye.

### 5.5.1 Agar kharidari ke baad Premium na khule

App purchase ko **Play ki apni list** (`listPurchases()`) se confirm karti hai, is liye:

- **Play wala Google account wohi hona chahiye** jis se kharidari hui (Play Store →
  profile). Doosre account par list khali aati hai.
- Subscription Play Console me **Active** honi chahiye (Monetize → Products →
  Subscriptions) — draft/inactive ho to card par "unavailable" aata hai.
- App me **Aur → Bayyin Premium → Purchase restore karein** dabayein.
- Phir bhi na ho to app recents se hata kar dobara kholein — har launch par restore chalta
  hai.
- Jo subscription Play ki list me nahi (cancel, refund ya lapse) wo app me **khud band**
  ho jati hai. Gift code apni muddat tak chalta rehta hai.

### 5.6 Price baad me badalna

Monetize → Products → Subscriptions → product → base plan → **Edit price** → naye
countries/prices → **Save → Publish**. Purane subscribers par naya price tab lagta hai jab
aap "apply to existing subscribers" chunein (Play usi waqt batata hai).

### 5.7 App ke andar kya dikhta hai

- Price app **Play se poochti hai** (`getDetails`) — jo card par likha hai wohi
  payment sheet me aata hai. Browser me country → currency table (`premium.js`)
  chalta hai: South Asia me fixed ₹99 tier, baqi mulkon me $3.33/$29.99 ka local
  conversion.
- Kharidari Play Billing (TWA me Digital Goods API) se hoti hai — `billing.js`.
  Purchase ke baad app `listPurchases()` se confirm karti hai, aur har launch par
  renewal / cancel / refund khud pakad leti hai.
- `VERIFY_URL` abhi khali hai: abhi Play ki list hi jaanch hai. Chahein to release ke
  baad server verification laga sakte hain (PLAYSTORE.md step 6) — app me aur kuch
  badalna nahi padega.


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

### 7.1 Pehle ye taiyar rakhein

- **AAB** PWABuilder se (package **`bayyin.app`**, purana keystore, version code `1`).
  Baad ki har update me version code **bara** karna hai.
- **assetlinks** domain root par (`user-site/README.md` dekhein) — warna test ke doran app
  upar URL bar ke saath khulegi. Testing ke liye lazmi nahi, magar theek karna behtar hai.
- **Subscriptions** pehle bana kar **Activate** kar dein, warna testers ko Premium ka
  button "unavailable" milega.
- **License testing** (free kharidari testers ke liye): Play Console → **Settings →
  License testing** → testers ke email add karein → "Response: RESPOND_NORMALLY".
  Iske baad testers ka payment "Test card, always approves" se ho jata hai (paisa nahi
  katta).

### 7.2 Track aur release banayein

1. Play Console → **Testing → Closed testing → Create track** (naam: `Beta`).
2. **Create new release** → AAB upload karein.
3. Release notes: `STORE-LISTING.md` ka "What's new".
4. **Countries/regions**: sab (ya kam se kam un mulkon ko jahan testers hain).
5. **Save → Review release → Start rollout to Closed testing**.

### 7.3 Testers (12 se kam nahi)

1. **Testers tab → Create email list** (naam: `Beta testers`).
2. **Kam se kam 12 Gmail/Google accounts** daalein — apne + dost/rishtedar. Ek hi banda do
   email se count nahi hota; 12 **alag** accounts chahiye.
3. Save karke **opt-in link** copy karein (do link hote hain: web link aur Play link —
   Play link phone par kholna aasan hai).
4. Wahi link testers ko WhatsApp par bhejein.

### 7.4 14 din ka qanoon (sab se ahem)

- Tester ko **opt-in karna** hai (link khol kar "Become a tester" → **Accept**), phir Play
  se app install karni hai.
- Play **14 lagataar din** ginta hai jisme tester **opted-in rehna** chahiye — app uninstall
  kar dena theek hai, magar **opt-out** kar dena din ka hisab reset kar deta hai.
- Is liye: link bhejne ke baad khud har tester se confirm karein ke usne accept kar liya.
  Jis ne accept nahi kiya, wo 14 din me count nahi hota.
- 14 din poore hone se pehle production ki apply **nahi** ho sakti.

### 7.5 Testers ko bhejne wala message (copy-paste)

```
Assalamu alaikum! Bayyin (Quran tilawat checker) ka beta test chal raha hai.
Ye link khol kar "Become a tester" → Accept karein, phir Play Store se app install karein:
<OPT-IN LINK>

Zaroori: 14 din tak test se opt-out na karein, warna test dobara shuru karna padega.
App chala kar batayein kya acha laga aur kya dikkat aayi. JazakAllah!
```

### 7.6 Ye galtiyan test rad kar deti hain

- 12 se kam testers, ya testers ka opt-in na karna.
- Test ke doran AAB/release **delete** kar dena ya track band kar dena.
- Tester khud ke hi 12 fake accounts (Play pakad leta hai) — asli log rakhein.
- App ka package badalna (naya package = naya app, test dobara).

### 7.7 14 din ke baad: Production access

1. **Production → Apply for production access** (Dashboard par bhi link aa jata hai).
2. Play kuch sawal poochta hai. Aise jawab dein (apne asli tajurbe ke hisaab se):
   - **How did you test?** "12 testers ne Play ki closed testing track se app install ki
     aur 14 din tak istemal ki — tilawat check, mushaf, namaz, azaan aur Hifz plan."
   - **What did testers find?** 3–5 asli cheezein likhein jo aapne theek ki (misal:
     aya ka ulta hona, mushaf page ka fit, azaan ki recording, qari ka background
     playback).
   - **How did you recruit testers?** "Family and friends, WhatsApp par opt-in link."
   - **What is different now?** Jo changes kiye wo saaf likhein.
3. Review 1–7 din leta hai. Manzoor hone par **Production → Create new release** → wahi
   AAB → rollout (20% se shuru karna behtar).


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
