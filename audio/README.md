# Azaan recordings

Two recordings, both by **Mohammad Duste**:

```
audio/adhan-1.m4a
audio/adhan-2.m4a
```

`adhan.js` points at them; the person picks "Adhan by Mohammad Duste 1" or "2" on
Namaz → Azaan. They play in the app, in the background, and from the prayer
notification.

Notes

- Both files are m4a (AAC), which every Android phone and iPhone plays.
- Keep them reasonably small (1–4 MB is fine); nothing is downloaded until it is
  needed.
- Do **not** add them to the service worker `SHELL` list in `sw.js` — a large
  audio file there only slows the install. The browser caches them after the
  first play.
- Anyone can also pick their own mp3/mp4 from their phone (Namaz → Azaan → own
  file); that stays on their device and is used first.
