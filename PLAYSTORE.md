# Bayyin — Play Store release, step by step

PWA taiyar hai. Ab app ko Play par **subscription ke saath** ship karne ke steps — shuruaat
**Play Console developer account** se. Har step ke saath likha hai: kaun karta hai
(aap / main) aur repo me kya badalta hai.

> "key" se aap ka matlab kya hai, ye baad me clear karenge:
> 1. **App signing key / keystore** — build sign karne ke liye.
> 2. **Developer API service-account JSON** — purchase verify karne ke liye (RTDN).
> 3. **Upload key** — Play par AAB upload karne ke liye.
> Teeno ka kaam alag hai; neeche teeno ki jagah batayi gayi hai.

---

## 0. Play Console developer account (pehla qadam)

1. **Google account** chunein jo hamesha rahe (isi se Play Console bandhega). Ek naya
   account banana behtar hai: `bayyin.app@gmail.com` jaisa.
2. **https://play.google.com/console/signup** kholen → developer name, email, phone.
3. **One-time fee $25** (India me lagbhag ₹2,100 + tax). Card chahiye; ye ek dafa hi hai.
4. **Identity verification**: ID (Aadhaar / passport / DL) + address proof. 1–3 din.
5. **Account type**: **Personal** (aasaan) ya **Organization** (D-U-N-S number chahiye).
   Personal account par production se pehle **12 testers × 14 din** closed testing zaroori hai.
6. **Payments profile** (subscription bechne ke liye): Play Console → Setup → Payments
   profile → bank account, PAN, address. Ye baad me bhi ho sakta hai, magar subscription
   product tab tak publish nahi hota.

**Account approve hone tak** ye kaam ho sakte hain (Play Console ki zaroorat nahi):
wrapper + signed AAB, asset links ka template, 1080×1920 screenshots, feature graphic,
store listing text aur billing bridge ka code.

---

## 0b. Play Console account ke faisle (jo ho gaye)

- **Ads**: nahi. Play listing me "Contains ads: No".
- **In-app purchase**: sirf **subscription** (`bayyin_pro_monthly`, `bayyin_pro_yearly`),
  koi one-time product nahi.
- Account ban gaya; card add karke **$25** one-time fee deni hai, phir Play 1–2 din me
  verify karta hai. Payments profile (bank + PAN) subscription publish karne se pehle chahiye.
- Onboarding me "kitne apps" ka jawab koi limit nahi lagata — jitne chahein bana sakte hain.

## 0c. Jo pehle se maujood hai (repo me)

| Cheez | File |
| --- | --- |
| Installable PWA + manifest + screenshots | `manifest.webmanifest`, `screenshots/` |
| Paywall, trial, free limits, prices | `premium.js`, `premium-strings.js` |
| Play Billing (TWA: Digital Goods API) | `billing.js` |
| Privacy policy (Play ko URL chahiye) | `privacy.html` |
| Icons 512 / maskable | `icon-512.png`, `icon-maskable-512.png` |
| Subscription SKUs | `bayyin_pro_monthly`, `bayyin_pro_yearly` |
| Gift codes (free Premium for chosen people) | `gift.js` |

Play build par app ab khud:
- **in-app 3-din trial band** rakhti hai (trial Play ke "free trial offer" se aata hai).
  `isPlayBuild()` native bridge aur Play-installed **TWA** (Digital Goods API +
  `android-app://` referrer) dono pehchanta hai, is liye PWABuilder wale package me bhi
  trial band rehta hai,
- launch par **restore** karti hai taake renewal/cancel apne aap pata chale,
- `?demo=1` wale testing buttons Play build par kabhi nahi dikhte.

**Gift codes aur Play:** kisi ko muft Premium dena Play ke rules ke khilaf nahi — Play
sirf yeh dekhta hai ke *khareedari* Play Billing se ho. Code offline check hota hai
(`gift.js`), is liye code ko koi bhi JS padh kar bana sakta hai: yeh courtesy hai, lock
nahi.

---

## 1. Package — PWABuilder ka TWA (jo ban chuka hai)

PWABuilder se jo package bana wo ek **Trusted Web Activity (TWA)** hai, aur us ke saath ek
**signing keystore** mila (`signing.keystore` + `signing-key-info.txt`).

- **Key sambhal kar rakhein**: `signing.keystore` aur us ke passwords kabhi git ya public
  link me na jayein. Agli AAB usi key se sign honi chahiye, warna Play update reject karta hai.
- **Package name (final): `app.bayyin`** — Play par ek dafa upload hone ke baad badal nahi sakta.
- **TWA = live site**: app ka HTML/JS/CSS seedha site se aata hai, is liye naye features
  bhejne ke liye naya AAB release nahi chahiye. Sirf native/manifest/billing tab badalta hai
  jab package dobara banayein.
- **Billing**: TWA me native bridge nahi chalta — Play **Digital Goods API** deta hai
  (Chrome, sirf Play se install ki gayi TWA me). `billing.js` me ab dono raste hain:
  `window.BayyinBilling` (agar kabhi native shell use karein) aur Digital Goods API (TWA).

## 1b. Target SDK — Play ki minimum (Android 15/16 ke baad)

Play har naye app aur update par ek **minimum target SDK** maangta hai (2025 me API 35,
uske baad API 36 — "Android 15/16"). Yeh app ke JavaScript ka nahi, **package ki setting**
hai:

- **PWABuilder** me package banate waqt Android SDK / target SDK me sab se **naya**
  (API 35 ya 36) chunein. PWABuilder khud latest rakhta hai, phir bhi ek dafa dekh lein.
- Play Console par agar "Target SDK version is too low" aa jaye, to matlab purana package
  hai — PWABuilder se **naya AAB** bana kar upload karein; website ka code waisa hi rahega.
- `minSdk` (kitne purane phones chalenge) PWABuilder ka default theek rehta hai; sirf
  target SDK naya hona chahiye.
- Is app ki taraf se kuch karne ki zaroorat nahi: web code har Android version par ek hi
  chalta hai.

### 1c. Naya AAB banane ke steps (PWABuilder) — aap khud karte hain

PWABuilder ek website hai jo AAB banati hai; ye repo ke andar se nahi banti.

1. **https://www.pwabuilder.com** kholein.
2. URL daalein: `https://fauzan0096.github.io/quran-recitation-checker/`
3. **Package for stores** → **Android**.
4. Settings me:
   - **App name**: `Bayyin` (Play listing ka naam alag hota hai),
   - **Package ID**: `app.bayyin` — **bilkul wahi**, warna Play naya app samjhega,
   - **Signing key**: **purana `signing.keystore` upload karein** (ya wahi passwords
     daalein). Naya key = purani app par update **reject** ho jayega,
   - **Version code**: purane se **bada** (pehli AAB 1 thi, ab `2` ya us se zyada),
   - Display: `standalone`, orientation: `portrait`.
5. **Download** → `app-release-bundle.aab`.
6. PWABuilder jo **SHA-256 fingerprint** dikhaye (ya `signing-key-info.txt` wala), wo
   `.well-known/assetlinks.json` me `sha256_cert_fingerprints` me daal kar push karein —
   warna app browser me khulegi, app jaisi nahi.
7. Play Console → apna app → **Testing/Production** → **New release** → yahi `.aab` upload.

> Purana keystore kho gaya to update mumkin nahi — Play Console → App integrity se
> **upload key reset** karna padta hai (aur app ka data/naya install bhi). Is liye
> `signing.keystore` + passwords ki alag copy rakhein.

## 2. `assetlinks.json` (TWA ke liye zaroori)

`https://<aapki-site>/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.bayyin",
      "sha256_cert_fingerprints": ["AA:BB:...:ZZ"]
    }
  }
]
```

SHA-256 `signing-key-info.txt` me bhi hota hai (`SHA-256 fingerprint:`), aur PWABuilder
anta mein ye file khud bhi de deta hai. Na ho to:
`keytool -list -v -keystore signing.keystore -alias android` se nikal sakte hain.

**Mujhe do:** SHA-256 fingerprint — main file bana dunga aur batadunga kahan host karni hai.

### Fingerprint kahan se (2 hote hain, dono daalein)

1. **Play App Signing** — jab app Play se install hoti hai to Google apni key se sign karta
   hai. Play Console → **Test and release → Setup → App signing** → *App signing key
   certificate* → **SHA-256**. Yeh TWA verification ke liye sab se zaroori hai.
2. **Upload key** — PWABuilder ke `signing-key-info.txt` me (`SHA-256 fingerprint:`), ya
   `keytool -list -v -keystore signing.keystore -alias android`. Play Console → App
   integrity me bhi milti hai. AAB/APK jo aap khud phone par sideload karte hain, wo isi se
   sign hoti hai.

`.well-known/assetlinks.json` me abhi dono ke liye jagah hai — dono strings ko asli
fingerprints se badal dein (`AA:BB:…` format, uppercase). Warna app Play se khulne par
URL bar ke saath khulegi.

**Listing ka poora text** (title, short/full description, data safety ke jawab, rating,
subscription disclosure) → `STORE-LISTING.md`. Feature graphic aur screenshots
`screenshots.html` se bante hain.

## 3. Play Console — app ki tayyari

1. **Create app** → name `Bayyin — Quran Tilawat Check`, default language.
2. **App content**:
   - Privacy policy URL: `privacy.html` ka live link.
   - Data safety: *koi data collect nahi*, *koi share nahi*, *ads nahi* (mic device par hi).
   - Content rating questionnaire (Education / Reference).
   - Target audience 13+ (religious content, no ads).
3. **Store listing**:
   - Icon 512×512 → `icon-512.png`.
   - Feature graphic 1024×500 (banana hoga).
   - Phone screenshots **1080×1920** (9:16). Purani `screenshots/` (540×1080) puraani
     design ki hain — naye screens lein. Phone par jo screen dikhani ho khol kar
     screenshot lein (Power + Volume Down), phir repo ka tool kholein:
     **`screenshots.html`** → tasveer chunein → **PNG save karein**. Wo har tasveer
     khud 1080×1920 bana deta hai (kuch upload nahi hota, sab phone par).
     Play ke liye ye 6 screen theek hain: (1) Quran aya list, (2) mushaf poora page,
     (3) tilawat check ka nateeja, (4) Roz ki Naiki, (5) Namaz auqaat + azaan,
     (6) Tasbeeh ya Qibla.
   - Short + full description.

## 4. Subscription products (yahi SKU rakhein)

| Product ID | Base plan | Price (IN) | PK | BD | NP | LK | Rest |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bayyin_pro_monthly` | `monthly` (P1M) | ₹99 | 330 | 140 | 160 | 340 | $3.33 |
| `bayyin_pro_yearly` | `yearly` (P1Y) | ₹799 | 2640 | 1120 | 1280 | 2720 | $29.99 |

- Play Console → Monetize → Products → **Subscriptions** → dono product banayein.
- **Set prices per country** (auto-convert band kar ke manual: India, Pakistan,
  Bangladesh, Nepal, Sri Lanka ke amounts upar; baqi duniya $3.33 / $29.99).
- App apne aap **har mulk ki apni currency** me price dikhati hai (`premium.js`:
  country → currency table). South Asia ke 5 mulk fixed ₹99 tier par hain; baqi jagah
  $3.33 / $29.99 ko local money me badal kar dikhaya jata hai. Jo asal me katega wo
  **Play ka payment sheet** dikhata hai.
- Base plan par **free trial offer** banayein: **3 din**, naye subscribers ke liye.
- Base plan ko **auto-renewing** rakhein; "Grace period" 3 din, "Account hold" on.

## 5. Billing — TWA me Digital Goods API

TWA me native bridge nahi hota, is liye Chrome ka **Digital Goods API** use hota hai.
`billing.js` me ye pehle se laga hua hai (`twaBuild()` detect karta hai):

```js
const service = await window.getDigitalGoodsService('https://play.google.com/billing');
const [plan] = await service.getDetails(['bayyin_pro_monthly']);
const pay = new PaymentRequest(
  [{ supportedMethods: 'https://play.google.com/billing', data: { sku: 'bayyin_pro_monthly' } }],
  { total: { label: plan.title, amount: { currency: plan.price.currency, value: plan.price.value } } }
);
const res = await pay.show();
await service.acknowledge(res.details.purchaseToken, 'repeatable');
```

- Ye sirf **Play se install ki gayi TWA** me chalta hai (browser me nahi).
- `restore()` = `service.listPurchases()`; `manage()` = Play subscription page.
- Purchase token **server se verify** hona chahiye — `billing.js` ka `VERIFY_URL` release se
  pehle set karein (Step 6), warna koi bhi token se Premium le sakta hai.

### Agar kabhi native shell use karein (Capacitor)

Wahan `window.BayyinBilling` bridge isi shape me chahiye (Kotlin skeleton):

```kotlin
class BillingBridge(private val activity: Activity) {
  private lateinit var billing: BillingClient

  @JavascriptInterface fun purchase(sku: String) {
    val params = BillingFlowParams.newBuilder()
      .setProductDetailsParamsList(listOf(/* productDetails for sku */)).build()
    activity.runOnUiThread { billing.launchBillingFlow(activity, params) }
    // onPurchasesUpdated -> token server ko bhejo -> verify ->
    //   "window.__bayyinBillingOk && window.__bayyinBillingOk('$sku')"
  }

  @JavascriptInterface fun restore() { /* queryPurchasesAsync(SUBS) -> ok/sku/token */ }
  @JavascriptInterface fun manage() { /* open play.google.com/store/account/subscriptions */ }
}
```

Bridge ko `webView.addJavascriptInterface(BillingBridge(...), "BayyinBilling")` se
register karein (ya Capacitor plugin banayein).

**Important:** `ok` sirf tab do jab token verify ho jaye — warna koi bhi free me
Premium le lega.

## 6. Server-side verification (chhoti si service)

Play se aane wale token ko yahan verify karein:

- **Cloudflare Worker** (free tier) ya koi bhi chhota function:
  `POST /verify { token, sku }` → Play Developer API
  `purchases.subscriptionsv2.get` (service account key = "key" yahi ho sakti hai) →
  `{ ok, expiry }` wapas.
- **RTDN** (Play → Cloud Pub/Sub → Worker): renewal, cancel, refund par entitlement
  update karein.
- App side par kuch badalne ki zaroorat nahi: verified jawab par hi `activate(plan)`
  chalta hai.

## 7. Testing

1. Play Console → **License testing** → apna Gmail add karein (test purchases free).
2. **Internal testing** track par AAB upload karein, apne phone par install karein.
3. Test: monthly kharid → Premium khulta hai; app band kar ke kholein → launch par
   restore khud chalta hai; cancel → Play se cancel kar ke app kholen → free ho jaye.
4. `?demo=1` wale buttons ka release build me koi asar nahi (wo URL par hi dikhte hain).

## 8. Rollout

1. Closed testing (naye personal accounts ke liye 12 testers × 14 din zaroori).
2. Production → review (2–7 din) → staged rollout 20% → 100%.
3. Review ke doran `PAYWALL_ON = false` rakhne ki zaroorat nahi jab Play Billing sahi
   juda ho; agar reviewer ko poora app dikhana ho to wo flag kaam aata hai.

---

## Mujhe kya chahiye (bas ye 3 jawab)

1. **Package name** — fix ho gaya: `app.bayyin`
2. **SHA-256 fingerprint** — Play Console → App integrity se.
3. **"Key" ka matlab** — signing keystore hai ya Developer API service-account JSON?

Ye mil jayein to main `assetlinks.json`, wrapper ka billing bridge skeleton aur
verification Worker ka code repo me daal deta hoon.
