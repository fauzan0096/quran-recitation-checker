# Azaan recording

The app plays **one** azaan, and it is our own:

```
audio/adhan.m4a
```

`adhan.js` points at it already, so the azaan works in the app, in the
background, and from the prayer notification. No code change is needed.

Notes

- The file is m4a (AAC). Every Android phone and iPhone plays it. If a smaller
  mp3 is made later, put it here as `audio/adhan.mp3` and change `url` (and
  `type`) in `adhan.js`.
- Keep the file reasonably small (1–2 MB is fine); nothing is downloaded until it
  is needed.
- Do **not** add it to the service worker `SHELL` list in `sw.js` — one missing
  file would break the offline cache. The browser caches it after the first play.
- If the file is ever missing the app stays silent: the prayer notification still
  arrives, and the Azaan card says the recording is not in the app yet.
- Anyone can also pick their own mp3/mp4 from their phone (Namaz → Azaan → own
  file); that stays on their device and is used first.

