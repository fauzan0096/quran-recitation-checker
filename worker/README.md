# Bayyin push Worker (roz ki notification, app band ho to bhi)

Ye ek chhota Cloudflare Worker hai jo:

1. App se **push subscription** leta hai (`POST /subscribe`),
2. **KV** me usay + desired hour + timezone save karta hai,
3. har ghante chal kar us waqt bhejta hai jab user ke mulk me us ka chuna hua ghanta ho.

Isi liye notification **app band hone par bhi** aati hai (browser khud page ko jagaa
nahi sakta — push server se aata hai).

## 1. Keys banayein

Repo ki `push-setup.html` file kholein (Run/preview me), **Generate keys** dabayein.
Do cheezein milengi:

- **Public key** — `push.js` ke `PUBLIC_KEY` me.
- **Private JWK** — sirf Worker me (`VAPID_PRIVATE`). Kisi ke sath share na karein, git me na daalein.

## 2. Worker deploy karein

1. <https://workers.cloudflare.com> → **Create** → **Worker**.
2. `worker/push-worker.js` ka poora code paste karein → **Deploy**.
3. **Settings → Variables and Secrets**:
   - `VAPID_PUBLIC` = public key
   - `VAPID_PRIVATE` = private JWK (poora JSON, ek line me)
   - `VAPID_SUBJECT` = `mailto:aapka@email.com`
4. **KV Namespace** banayein (e.g. `bayyin_subs`) aur binding ka naam **`SUBS`** rakhein.
5. **Triggers → Cron Triggers** → add `0 * * * *` (har ghante).

## 3. App me jodein

`push.js` ke top par:

```js
const ENDPOINT = 'https://bayyin-push.<aapka>.workers.dev';
const PUBLIC_KEY = '<public key>';
```

Phir app kholein → Settings → **Roz yaad dehani** → **"Push bhi (app band ho to bhi)"**.

## 4. Test

- Button dabane ke baad Worker → KV me `sub:...` key dikhni chahiye.
- Agle ghante (aap ke chune hue waqt par) notification aani chahiye.
- Test karna ho to Worker ke Cron ko `* * * * *` kar dein aur hour match hone par
  turant aayegi; baad me wapas `0 * * * *`.

## Limits / sach

- **iOS**: web push sirf **iOS 16.4+** aur jab app **Home Screen par install** ho.
- Android/Chrome: theek chalta hai.
- Play (TWA) me bhi ye wahi Web Push hai.
- Subscription expire ho jaye to Worker `404/410` par usay khud delete kar deta hai;
  app dobara on karne par naya ban jata hai.
