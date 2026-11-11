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

## 2. Worker deploy karein (phone se bhi ho jata hai)

**A. Account**
1. <https://dash.cloudflare.com/sign-up> par free account banayein (card nahi chahiye).
2. Login ke baad left menu → **Workers & Pages**.

**B. Worker banayein**
3. **Create** → **Workers** → **Start with Hello World!** (ya "Create Worker").
4. Naam: `bayyin-push` → **Deploy**.
5. **Edit code** kholein → andar ka saara code mita dein → `worker/push-worker.js` ka
   poora code paste karein → **Deploy**.

**C. KV (subscriptions yahan rehti hain)**
6. Left menu → **Storage & Databases → KV** → **Create a namespace** → naam `bayyin_subs`.
7. Wapas **Workers & Pages → bayyin-push → Settings → Bindings** → **Add binding** →
   **KV Namespace** → Variable name **`SUBS`** → namespace `bayyin_subs` → **Save**.

**D. Variables (VAPID)**

Jagah: **Worker → Settings → Variables and Secrets** (purane UI me sirf "Variables").
**Add** / **Add variable** dabayein aur teen entries banayein — naam **bilkul** aise
(capital letters, koi space nahi):

| Variable name | Type | Value |
| --- | --- | --- |
| `VAPID_PUBLIC` | Text (plain) | public key — ek hi line, ~87 characters, `B` se shuru |
| `VAPID_PRIVATE` | **Secret** (Encrypt) | private JWK — poora JSON `{ "kty":"EC", … "d":"…" }` |
| `VAPID_SUBJECT` | Text | `mailto:aapka@email.com` |

- Private JWK me line breaks ho to koi masla nahi — JSON waise bhi parse ho jata hai.
  Bas naam/values me extra space na ho.
- `VAPID_PRIVATE` ko **Secret** rakhein: dashboard me dobara padha nahi ja sakega.
- Add karne ke baad **Deploy** (ya "Save and Deploy") dabayein, warna values live nahi hotin.

**Check (GET par health JSON)**:

```json
{"ok":true,"service":"bayyin-push","kv":true,
 "vapidPublic":true,"vapidPrivate":"ok","vapidSubject":true}
```

`vapidPrivate` me `"ok"` aana chahiye. `"invalid-json"` = JSON toota hua,
`"invalid"` = `d` field nahi mila, `"missing"` = variable hi nahi laga.

**E. Cron (roz bhejne ke liye)**
10. **Settings → Triggers → Cron Triggers → Add Cron Trigger** → `0 * * * *` → **Save**.
    (Har ghanta chalta hai; Worker khud user ke timezone ka ghanta dekh kar bhejta hai.)

**F. Check**
11. Worker ka URL kholein (`https://bayyin-push.<aapka-subdomain>.workers.dev`) —
    browser me `{"ok":true,"service":"bayyin-push"}` dikhna chahiye.
12. Wahi URL `push.js` ke `ENDPOINT` me aur public key `PUBLIC_KEY` me daalein.

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
