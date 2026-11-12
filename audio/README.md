# Azaan recording

The app plays **one** azaan, and it is our own: put the recording here as

```
audio/adhan.mp3
```

`adhan.js` points at `audio/adhan.mp3` already, so the moment the file is in the
repository the azaan works — in the app, in the background, and from the prayer
notification. No code change is needed.

Notes

- Use an mp3 (every phone plays it). If the recording is an mp4/m4a, rename the
  file to `adhan.mp3` only if it really is mp3 audio; otherwise keep it as
  `audio/adhan.mp4` and change `url` in `adhan.js` to that path.
- Keep the file reasonably small (a 2–4 minute azaan at 96–128 kbps is fine);
  nothing is downloaded until it is needed.
- Do **not** add it to the service worker `SHELL` list in `sw.js` — one missing
  file would break the offline cache. The browser caches it after the first play.
- Until the file is here the app stays silent: the prayer notification still
  arrives, and the Azaan card says the recording is not in the app yet.
- Anyone can also pick their own mp3/mp4 from their phone (Namaz → Azaan → own
  file); that stays on their device and is used first.
