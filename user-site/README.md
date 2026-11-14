# User site (`fauzan0096.github.io`) — TWA verification

Android app ko **bina URL bar** ke kholne ke liye Chrome asset links ko site ke
**domain root** par dhoondta hai:

```
https://fauzan0096.github.io/.well-known/assetlinks.json
```

App `https://fauzan0096.github.io/quran-recitation-checker/` par hai, magar ye file
us se ek level upar (domain root) chahiye — aur GitHub Pages `.well-known` jaisi
dot-folder ko tab tak nahi dikhata jab tak **`.nojekyll`** file na ho.

## Step by step

1. **Play Console → Test and release → Setup → App signing** kholen.
   *App signing key certificate* ka **SHA-256** copy karein.
   (Play se install hone wali app isi key se sign hoti hai, aapki upload key se nahi.)

2. **Upload key** ka SHA-256 bhi lein:
   - PWABuilder ki zip me `signing-key-info.txt` (`SHA-256 fingerprint:`), ya
   - Play Console → App integrity → Upload key certificate.

3. Dono ko `assetlinks.json` ke `sha256_cert_fingerprints` me **comma se alag** daalein:

```json
"sha256_cert_fingerprints": [
  "AA:BB:CC:…:PLAY_APP_SIGNING",
  "11:22:33:…:UPLOAD_KEY"
]
```

   `package_name` bilkul wahi rahe jo Play Console me hai: **`bayyin.app`**

4. GitHub par naya **public** repo banayein: naam **`fauzan0096.github.io`**
   (bilkul yahi naam).

5. Us repo me ye files daalein (is folder se copy karein):
   - `index.html` → root me
   - `.well-known/assetlinks.json` → usi raste par
   - **`.nojekyll`** → root me (khali file) — iske baghair `.well-known` serve nahi hoti

6. Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch `main`,
   folder `/ (root)` → **Save**.

7. 1–2 minute baad browser me khol kar check karein:

```
https://fauzan0096.github.io/.well-known/assetlinks.json
```

   JSON dikhna chahiye. Agar 404 aaye to `.nojekyll` missing hai ya Pages build nahi hua.

8. Phone se app **uninstall** karke Play Store se **dobara install** karein.
   Chrome verification purani cache rakhta hai — kabhi kabhi 1–2 ghante lagte hain.
   Uske baad app bina URL bar ke khulegi.

> Note: is project repo me bhi `.nojekyll` daal diya gaya hai, is liye
> `https://fauzan0096.github.io/quran-recitation-checker/.well-known/assetlinks.json`
> bhi copy ke tor par khulti hai — magar Chrome sirf **domain root** wali file
> padhta hai, is liye upar wala repo lazmi hai.
