# Building the Android app

GitHub Actions builds **PocketBand.apk** for you. Every push to `main` (and every press of **Run workflow** on the
[Android APK workflow](https://github.com/avinashashton90-lgtm/MultiInstrumentApp/actions/workflows/android.yml))
builds it, signs it, checks it and publishes it as a
[GitHub Release](https://github.com/avinashashton90-lgtm/MultiInstrumentApp/releases/latest) tagged `build-<number>`.
The APK is also kept as a workflow artifact. Pull requests run the same build as a check, without a release.
The test suite runs alongside in its own job and never holds a release back.

The web app itself is unchanged. The Android app is a [Capacitor](https://capacitorjs.com) shell around the same
`index.html`: during the build, `tools/copy-web.mjs` copies `index.html`, `selftest.html`, `manifest.json`, the icons
and `tracks/` into `www/` (not committed), and Capacitor bundles `www/` inside the APK, so the app works with no
connection. The GitHub Pages site is still served from the repository root exactly as before.

## 1. Make your signing key (once)

You need Java's `keytool` (it comes with any JDK, or with Android Studio). Run this in a folder **outside** the
repository:

```
keytool -genkeypair -v -storetype PKCS12 -keystore pocketband-release.jks -alias pocketband -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a password (use the same one when it asks for the key password; PKCS12 keystores use one password for
both), then your name and city. The alias is `pocketband`.

Then turn the file into text so it can be pasted into GitHub:

- Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("pocketband-release.jks")) | Set-Clipboard`
- macOS: `base64 -i pocketband-release.jks | pbcopy`
- Linux: `base64 -w0 pocketband-release.jks`

> [!WARNING]
> **Back up `pocketband-release.jks` and its password somewhere safe (for example a password manager and a second
> drive).** Android only installs updates signed with the same key. If the key is lost, people must uninstall the
> app (losing its saved settings) to install a new build, and a Play Store listing can never be updated again.
> Never commit the keystore or its passwords: this repository is public.

## 2. Paste the secrets into GitHub

Open the repository on GitHub, then **Settings → Secrets and variables → Actions → New repository secret**
([direct link](https://github.com/avinashashton90-lgtm/MultiInstrumentApp/settings/secrets/actions)) and add four
secrets:

| Name | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | the long text from the base64 command above |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
| `ANDROID_KEY_ALIAS` | `pocketband` |
| `ANDROID_KEY_PASSWORD` | the key password (the same password for a PKCS12 keystore) |

Then press **Run workflow** on the Android APK workflow, or push to `main`.

**Without the secrets** the build still works: the APK is signed with a temporary debug key and the release notes say
so. It installs and plays normally, but each debug-signed build has a different key, so to install a newer one you
must uninstall the old app first (its saved settings go with it). Builds signed with your real key update each
other in place. **With the secrets** the release also carries
**PocketBand.aab**, the file the Play Store asks for.

## What the workflow does

`.github/workflows/android.yml`, on `ubuntu-latest`, runs two jobs at the same time.

**build-apk** (does not wait for the tests):

1. Sets up Node 22 and JDK 21, then `npm ci`.
2. `node tools/copy-web.mjs`, then `npx cap sync android`.
3. Decodes the keystore from the secrets (if present) into a temporary file, runs `./gradlew assembleRelease`
   (plus `bundleRelease` when signed), and deletes the keystore file.
4. Checks the APK with `aapt dump badging` and prints the package, version, SDK levels and orientation, verifies the
   signature with `apksigner`, and confirms `index.html` and `tracks/` are inside and `sw.js` is not. Any mismatch
   fails the build with a plain error.
5. Uploads the files as a workflow artifact and, on `main` or a manual run, publishes the GitHub Release.

If a step fails, the last step ("Explain a failure") names which one and where to look.

**tests** (for information, `continue-on-error: true`, 25-minute limit): runs the existing suite in quick mode
(`node tests/run-all.mjs --quick --allow-slow-notes`): every check on every instrument, with the pitch check on
3 keys x 4 scales. Its result and `test-report.html` show on the run, but a failure there never blocks the APK.

### Choices made here

- **A flaky test never blocks a release.** The live Songs timing check could not be made stable on GitHub's
  machines and was removed (TESTING.md, "Removed: the live Songs timing check"). The tests job is informational.
- **Per-note timing is listed, not failed.** The performance check's limit of 8 ms of main-thread work per note
  fails on slower machines (a property of the machine, not an app bug), so the tests job passes
  `--allow-slow-notes`: a performance row that fails **only** on time per note is printed as KNOWN.
  `npm test` on your own computer is unchanged.
- **JDK 21, not 17.** Capacitor 8, the current version, compiles its Android library for Java 21, so a JDK 17 build
  fails. Capacitor 8 targets Android 16 (API 36), which the Play Store requires for new uploads.

## Version numbers

- **Version name** (shown in Android settings) comes from `"version"` in `package.json`, now `8.0.0` to match app v8.
  Change it there when you release a new app version.
- **Version code** is the GitHub Actions run number, so each build updates the one before it. The release tag is
  `build-<run number>`.

## What is different in the Android app

All of it is native, so the browser and GitHub Pages version behaves exactly as before:

- Landscape only (either way up), full screen with the status and navigation bars hidden (swipe from an edge to see
  them briefly), and the screen stays on while the app is open.
- The volume buttons control media volume; sound can start without a first tap.
- **Back** inside an instrument goes Home, like the Home button (an open Songs list closes first). Back on Home asks
  "Exit Pocket Band?".
- No service worker is registered (`index.html` skips it when it runs inside Capacitor); every file is already inside
  the APK. The page's web font still comes from Google Fonts when online and falls back to the system font offline,
  as in the browser.
- Adaptive launcher icon and splash screen made from `icon-512.png` by `tools/make-android-icons.py` (needs Pillow;
  run it again if the icon changes and commit the results).

The only web-side additions are `window.__pbBack` (called only by the Android Back button) and the Capacitor check
before the service worker registration, both at the end of `index.html`.

## Building on your own computer (optional)

With Node 22, JDK 21 and the Android SDK (Android Studio installs it):

```
npm ci
node tools/copy-web.mjs
npx cap sync android
cd android
./gradlew assembleRelease
```

The APK is in `android/app/build/outputs/apk/release/`. Without the signing variables it is debug-signed. To sign
locally, set `ANDROID_KEYSTORE_FILE` (path to the .jks), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and
`ANDROID_KEY_PASSWORD` in the environment first. `npx cap open android` opens the project in Android Studio.
