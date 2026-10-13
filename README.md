# Pocket Band

Piano, drums, guitars, flute, tabla, electric drum pad, harmonica, violin, viola, cello, French horn, trumpet,
saxophone, pipe organ, synth, xylophone, electric bass and rhythm guitar in one app. It runs in the browser (open it
from GitHub Pages and add it to the home screen) or as an Android app.

## Install the Android app

1. On your Android phone, open the **[latest release](https://github.com/avinashashton90-lgtm/MultiInstrumentApp/releases/latest)**
   and tap **PocketBand.apk** (or use the
   [direct download](https://github.com/avinashashton90-lgtm/MultiInstrumentApp/releases/latest/download/PocketBand.apk)).
2. Open the downloaded file. If Android asks, allow installing apps from your browser or Files app, then tap
   **Install**.
3. Open **Pocket Band** from the app drawer. It works offline.

A new build appears on the releases page each time `main` changes. If its release notes say **Debug-signed**,
uninstall the old app before installing it; otherwise it updates the app in place. How the
APK is built and signed: [ANDROID_BUILD.md](ANDROID_BUILD.md).

## For developers

- `npm test` runs the live test suite in headless Chromium; `npm run test:quick` is the short version. See
  [TESTING.md](TESTING.md).
- Songs and the track format: [TRACKS.md](TRACKS.md).
