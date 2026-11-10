# Bayyin — Play Store release, step by step

PWA approval ho gayi aur key mil gayi — ab app ko Play par **subscription ke saath**
ship karne ke steps. Har step ke saath likha hai: kaun karta hai (aap / main) aur
repo me kya badalta hai.

> Pehle ek cheez clear karein: "key" se aap ka matlab kya hai?
> 1. **App signing key / keystore** (PWA Builder ya Play App Signing) — build sign karne ke liye.
> 2. **Play Developer API service-account JSON** — purchase verify karne ke liye (RTDN).
> 3. **PWA Builder ka "package"** — sirf app package banane ke liye.
> Teeno ke kaam alag hain; neeche teeno ki jagah batayi gayi hai.

---

## 0. Jo pehle se maujood hai (repo me)

| Cheez | File |
| --- | --- |
| Installable PWA + manifest + screenshots | `manifest.webmanifest`, `screenshots/` |
| Paywall, trial, free limits, prices | `premium.js`, `premium-strings.js` |
| Play Billing bridge contract | `billing.js` (`window.BayyinBilling`) |
| Privacy policy (Play ko URL chahiye) | `privacy.html` |
| Icons 512 / maskable | `icon-512.png`, `icon-maskable-512.png` |
| Subscription SKUs | `bayyin_pro_monthly`, `bayyin_pro_yearly` |

Play build par app ab khud:
- **in-app 3-din trial band** rakhti hai (trial Play ke "free trial offer" se aata hai),
- launch par **restore** karti hai taake renewal/cancel apne aap pata chale.

---

## 1. Wrapper chunein — Capacitor (recommended), TWA nahi

TWA (Bubblewrap) me Play Billing seedha nahi lagta; Google ki policy bhi digital goods
ke liye Play Billing maangti hai. Is liye **Capacitor** shell:

```
bayyin-android/
  android/app/src/main/java/app/bayyin/MainActivity.kt   <- billing bridge
  capacitor.config.json                                  <- server.url = https://<aapka-preview-domain>
```

- `capacitor.config.json` me `server.url` aapki live site (preview link ya custom domain)
  rakhein, warna app khali WebView dikhegi.
- Package name chunein, e.g. `app.bayyin` (aage `assetlinks.json` me wahi likhna hai).

## 2. `assetlinks.json` (TWA ke liye; Capacitor me optional)

Agar TWA hi use karna ho to `https://<domain>/.well-known/assetlinks.json`:

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

**Mujhe do:** package name + SHA-256 fingerprint (Play Console → App integrity →
App signing key certificate). Main file bana ke repo me daal dunga.

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
   - Phone screenshots **1080×1920** (16:9). Hamare `screenshots/` 540×1080 hain —
     Play ke liye inhe 1080×1920 par export karna behtar hai (ya naye lein).
   - Short + full description.

## 4. Subscription products (yahi SKU rakhein)

| Product ID | Base plan | Price (IN) | PK | BD | NP | LK | Rest |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bayyin_pro_monthly` | `monthly` (P1M) | ₹99 | 330 | 140 | 160 | 340 | $3.33 |
| `bayyin_pro_yearly` | `yearly` (P1Y) | ₹799 | 2640 | 1120 | 1280 | 2720 | $29.99 |

- Play Console → Monetize → Products → **Subscriptions** → dono product banayein.
- **Set prices per country** (auto-convert band kar ke manual: India, Pakistan,
  Bangladesh, Nepal, Sri Lanka ke amounts upar; baqi duniya $3.33 / $29.99).
- Base plan par **free trial offer** banayein: **3 din**, naye subscribers ke liye.
- Base plan ko **auto-renewing** rakhein; "Grace period" 3 din, "Account hold" on.

## 5. Native billing bridge (`window.BayyinBilling`)

`billing.js` yahi contract maangta hai:

```js
window.BayyinBilling = {
  purchase(sku),  // -> { ok, token }  (verify ke BAAD ok)
  restore(),      // -> { ok, sku, token }
  manage(),       // Play subscription management screen
};
```

Kotlin me (Play Billing Library 7.x) skeleton:

```kotlin
class BillingBridge(private val activity: Activity) {
  private lateinit var billing: BillingClient

  @JavascriptInterface fun purchase(sku: String) {
    val params = BillingFlowParams.newBuilder()
      .setProductDetailsParamsList(listOf(/* productDetails for sku */)).build()
    activity.runOnUiThread { billing.launchBillingFlow(activity, params) }
    // onPurchasesUpdated -> token server ko bhejo -> verify -> webView.evaluateJavascript(
    //   "window.__bayyinBillingOk && window.__bayyinBillingOk('$sku')")
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

1. **Package name** (e.g. `app.bayyin`) — asset links aur billing ke liye.
2. **SHA-256 fingerprint** — Play Console → App integrity se.
3. **"Key" ka matlab** — signing keystore hai ya Developer API service-account JSON?

Ye mil jayein to main `assetlinks.json`, wrapper ka billing bridge skeleton aur
verification Worker ka code repo me daal deta hoon.
