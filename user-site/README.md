# User site (`fauzan0096.github.io`) — TWA verification ke liye

Android app ko **bina URL bar** ke kholne ke liye Chrome `assetlinks.json` ko site ke
**domain root** par dhoondta hai:

```
https://fauzan0096.github.io/.well-known/assetlinks.json
```

App `https://fauzan0096.github.io/quran-recitation-checker/` par hai, magar file us se ek
level upar (domain root) chahiye. Us root ko sirf ek hi repo serve kar sakta hai:
**`fauzan0096.github.io`** naam ka repo.

## Ek dafa ka kaam

1. GitHub par naya **public** repo banayein: naam **`fauzan0096.github.io`** (bilkul yahi
   naam, `.github.io` ke saath).
2. Is folder (`user-site/`) ke dono files us repo me daal dein:
   - `index.html` → repo ke root me (root site par app ka link khul jayega)
   - `.well-known/assetlinks.json` → usi naam/raste par (folder ban jayega)
3. `assetlinks.json` me dono `REPLACE_…` ki jagah asli SHA-256 fingerprints daalein
   (Play App Signing + upload key).
4. Repo → Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, folder
   `/ (root)` → Save.
5. 1–2 minute baad check karein (browser me): 
   `https://fauzan0096.github.io/.well-known/assetlinks.json` — JSON dikhna chahiye.

Iske baad Play se install ki gayi app bina URL bar ke khulegi. App ka apna repo
(`quran-recitation-checker`) waise hi chalta rahega — usme jo `.well-known/assetlinks.json`
hai wo sirf record ke liye hai.
