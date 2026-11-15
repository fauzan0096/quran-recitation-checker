# Native wrapper (Capacitor + Play Billing) — plan

The web app is finished and works as a TWA, but a TWA (Digital Goods API) cannot
pass a **subscription offer token**, so a Play introductory offer cannot be shown
reliably there. A native wrapper with Google Play Billing **can**.

This folder is the plan and the reference code. Nothing here is built on this
device; it is built with Android Studio or a CI runner.

## What stays the same

- The app itself: `index.html` and the JavaScript are not forked. The wrapper
  loads the live site (`https://fauzan0096.github.io/quran-recitation-checker/`),
  so every web change still reaches the app at once.
- `billing.js` already prefers a native bridge: if `window.BayyinBilling` exists
  with a `purchase(sku, offerToken)` method, it uses that instead of the Digital
  Goods API. `offers(sku)` is asked for the offer token.

## Bridge the app expects

```js
// A Capacitor plugin named "BayyinBilling" is reachable as
// window.Capacitor.Plugins.BayyinBilling. Expose it as window.BayyinBilling:

window.BayyinBilling = {
  // Promise<{ offers: [{ offerId, offerToken, basePlanId }] }>
  offers: ({ sku }) => ...,
  // Promise<{ ok: true, plan: 'monthly' }> | Promise<{ ok: false, error: 'cancelled' }>
  purchase: ({ sku, offerToken }) => ...,
  // Promise<{ ok: true, sku }> | Promise<{ ok: false }>
  restore: () => ...,
  manage: () => ..., // opens Play's subscription page
};
```

The offer id in Play Console is **`bayyin-launch`**; that is what `billing.js`
looks for in the list.

## Steps

1. `npm init -y` in a **separate** folder (not in this repository — adding a
   `package.json` here would change how the web app is published), then
   `npm i @capacitor/core @capacitor/android`.
2. `npx cap init Bayyin app.bayyin --web-dir=www` (`www/` can be an empty folder
   because the app is loaded from the live URL).
3. `capacitor.config.json`:

   ```json
   {
     "appId": "app.bayyin",
     "appName": "Bayyin",
     "webDir": "www",
     "server": {
       "url": "https://fauzan0096.github.io/quran-recitation-checker/",
       "androidScheme": "https"
     }
   }
   ```

   `androidScheme: "https"` keeps geolocation and the service worker working.
4. `npx cap add android`, then copy `BayyinBillingPlugin.kt` (this folder) into
   `android/app/src/main/java/app/bayyin/` and register it in
   `MainActivity.java`/`.kt`:

   ```java
   registerPlugin(BayyinBillingPlugin.class);
   ```

5. In `android/app/build.gradle`:

   ```gradle
   dependencies {
     implementation "com.android.billingclient:billing:7.1.1"
     implementation "com.android.billingclient:billing-ktx:7.1.1"
   }
   ```

6. Expose the plugin to the page. In the web app, `billing.js` looks for
   `window.BayyinBilling`; add this once (a small `capacitor-bridge.js` loaded
   only in the wrapper, or inside the plugin's `load()` by injecting the script):

   ```js
   window.BayyinBilling = {
     offers: (opts) => window.Capacitor.Plugins.BayyinBilling.offers(opts),
     purchase: (opts) => window.Capacitor.Plugins.BayyinBilling.purchase(opts),
     restore: () => window.Capacitor.Plugins.BayyinBilling.restore(),
     manage: () => window.Capacitor.Plugins.BayyinBilling.manage(),
   };
   ```

   The app calls the bridge as `purchase(sku, token)`; wrap it so the plugin's
   object form is used:

   ```js
   purchase: (sku, offerToken) =>
     window.Capacitor.Plugins.BayyinBilling.purchase({ sku, offerToken }),
   ```

7. Build a signed AAB and upload it to Play. **The signing key must be the same
   one that signed `bayyin.app`**, otherwise Play rejects the upload.

## Before you replace the TWA — Play policy

A wrapper that only loads a website can be rejected for "minimum functionality".
Keep enough native behaviour (billing, notifications, share target) and say in
the listing what is native. This is the main risk of this path; the web-only TWA
does not have it.

## Testing the offer

1. Play Console: offer `bayyin-launch`, eligibility **New customer acquisition →
   Never had this subscription**, phases **3 months at ₹99 / $3.33 equivalent**,
   **Active**, changes **published**.
2. Install the build from Play with a **new Google account** (licensed tester is
   fine) that never had the subscription.
3. Tap Subscribe: the sheet should show the 3-month introductory price.
4. `offers()` returns the token of `bayyin-launch`; `purchase()` passes it with
   `setOfferToken` — that is what makes Play show the offer.
