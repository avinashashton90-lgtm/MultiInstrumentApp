# Testing

Pocket Band is tested by playing it: a headless Chromium opens the real app, touches the screen with real
multi-touch events (the same trusted touch and pointer events a phone sends), changes settings with the real
controls, and records what comes out of the speakers. Every number below was measured that way.

## Running everything

**Windows:** double-click `run-tests.bat` in the app folder. The first time it installs the test tools (Node.js
must be installed, from https://nodejs.org), then it runs every check, prints a PASS/FAIL table and opens
`test-report.html`.

**Any computer with Node.js 18 or newer:**

```sh
npm install                 # once: installs Playwright
npx playwright install chromium   # once, if Chromium isn't installed yet
npm test                    # every check on every instrument (the pitch check alone is 12 keys x 10 scales)
npm run test:quick          # the same checks with 3 keys x 4 scales for pitch: a few minutes
node tests/run-all.mjs --only=strum,bowing --tabs=guitar,violin   # some checks, some instruments
node tests/run-all.mjs --workers=2   # fewer parallel pages on a slow computer (default: up to 4)
```

The run prints a table, writes `test-report.html`, rewrites the "Latest results" section at the end of this file
(full runs only, not `--only` or `--tabs`), saves `tests/results/latest.json`, and exits with code 1 if anything
failed, so it can gate a build.

**On the phone:** Settings › Self-test (`selftest.html`, which also works offline). See "Self-test page" below.

## The checks

Every instrument in `tests/live/instruments.mjs` goes through every check that applies to it. Adding an instrument
there adds it to the whole suite.

| # | Check | What it does | Passes when |
| --- | --- | --- | --- |
| 1 | Load | Opens the app, watches the console and network, swipes the gallery to every card, opens it, presses Home. Also runs the Self-test page end to end. | No console errors or failed requests (the Google web font is optional), every instrument opens and Home returns. |
| 2 | Pitch | For every key and every scale, sets them with the real Key and Scale menus, checks the header text, then taps every note button (or snap mark, string, chord) and measures the pitch. | Every note within 5 cents, in the scale and matching its label; buttons climb the scale from the root; keyboards with Scale lock give the nearest scale note; chords are the key's triad with the root lowest; any two key/scale settings that should sound different do. A case that fails is played once more (live recording on a busy computer can catch a dropped audio block); a real fault fails both times, and the report says how many needed a second take. |
| 3 | Loudness | Holds a medium note on each instrument. | No clipped samples, peak at or below -0.9 dBFS, RMS at least -30 dBFS; trumpet and horn -16 dBFS RMS ± 2.5 dB. |
| 4 | Stuck notes | Holds a note, then ends it four ways: finger lifted, touch cancelled by the system, app sent to the background, a touch-end reporting no fingers while one is still logged. | Output below -60 dBFS within 1 s every time. |
| 5 | Note limit | Five fingers at once, then forty. | Five fingers sound five notes (one on single-voice winds, one per string on bowed and bass); forty never exceed the 14-note limit or clip; nothing sounds after lifting. |
| 6 | Strumming | Guitar and rhythm guitar: a finger swipes down, up, down… at 4 strums a second with 30 px flicks; then the ▼ / ▲ pads. | 8 swipes give 8 alternating strums, each heard (its pick attack, above 4 kHz, rises 5 dB or more over the ringing); down-strums sound their lowest note within 70 ms and are louder; up-strums leave the low strings at least 6 dB weaker, reach the low note (if at all) after the high one, and are softer. |
| 7 | Bowing | Violin, viola, cello: the bow travels from the top string to the bottom one; rests between two strings; then a finger is held while bowing. | Each string sounds in turn at its own pitch, the double stop sounds both strings, and the finger sets the bowed string's pitch. |
| 8 | Brass | Trumpet, horn, sax at soft, medium and full breath, plus a legato slide and a breath swell. | Brightness (spectral centroid) rises with breath; no sample jumps or bursts of high-frequency energy (crackle detectors). |
| 9 | Record | Record, three notes, stop, Play, on every instrument with a Record button. | Playback has the same notes (within 10 cents, or the same chord) at the same times. |
| 10 | Offline | First visit with the service worker, then the network is cut. | The cache is `pocket-band-v` + the app version shown in Settings and holds every file; the manifest is valid with real 192 and 512 px icons; offline, the app opens, the piano plays and the Self-test page loads. |
| 11 | Performance | Main-thread time while ten notes are tapped; frame rate with ten fingers down. | Under 8 ms per note and at least 50 frames/s (headless Chromium on a desktop, so with room for a phone). |
| 12 | Songs | Tracks: every file in `tracks/` is validated. Fit: every song that suits an instrument is opened on it. Auto-play: a sample song (Twinkle Twinkle as a melody, chord song or bass line; the rock groove; Keherwa) is rendered offline through the instrument's own sound and measured. Timing: a song auto-plays live on the piano and xylophone. Train: Train me (Wait) is opened from the real Songs sheet and played to the end by touching whatever glows. Stop: a song is stopped four ways. Storage: the same with storage blocked. | Tracks: every bar adds up, no overlapping notes, lengths, tempos, keys, chords, pads and bols valid, under 2 MB, cached by the service worker, all in TRACKS.md. Fit: at least 8 songs per instrument, every note, strum or hit has its key, hole, spot, chord button, pad or drum zone, and it is the right one (worked out from the track by the test, not the app). Auto-play: every melody and bass note within 5 cents of the track's note moved to the instrument's key; every strum sounds all its chord's notes; every hit is heard at its moment. Timing: notes start within 20 ms of their time. Train: for every event the right target glows with the right name (note, sargam, chord and strum arrow, pad, bol), touching it plays that note (measured) and the song moves on; three stars and a saved best score at the end. Stop: below -60 dBFS within 1 s and no voices left after Stop, closing the song, Home and switching instruments. |

### How the harness listens

- `index.html` exposes `window.__testTap`, an `AnalyserNode` on the master output after the limiter and ceiling
  (what reaches the speakers). The harness attaches an AudioWorklet recorder to it before the app starts, so every
  sample of a run is kept, and notes pointer down and up on the audio clock so each note can be found in the take.
  Nothing else in the app is touched: the live checks need no test hooks, except Songs, which turns on
  `window.PocketBandTest` (only when `window.__PB_TEST__` is set before the app loads) to find the glowing target
  to touch and to render a song offline.
- Touches go through the DevTools protocol (`Input.dispatchTouchEvent`), so the page gets trusted touch and
  pointer events with `pointerType: "touch"`, multi-touch included. Chromium handles at most 16 touch points in one
  event (more crashes the page), so the 40-finger test uses 15 real touches plus 25 pointer events sent to the
  elements under the other fingers.
- Reference music theory (`tests/live/common.mjs`) is written from the definitions, not copied from the app.
- Pitch: YIN plus a harmonic refinement (`tests/lib/analysis.js`); chords: Goertzel energy per semitone with
  overtones removed. Reverbs are turned off with their own sliders before measuring, so the room doesn't blur notes.
- Chrome quirk found on the way: a `DelayNode` inside a feedback loop adds 128 frames (one render quantum) to the
  loop, on top of its delay time. The brass bore resonator measures this at start-up and tunes itself accordingly.

## Self-test page

Settings › Self-test opens `selftest.html`:

1. **Automatic check.** Plays one note on each of the 19 instruments through the app's own sound engines, rendered
   silently in an `OfflineAudioContext`, and shows tuning (within 5 cents), peak (at or below -1 dBFS), RMS and
   clipped samples. Your last instrument and key settings are put back afterwards.
2. **Songs check.** On each instrument: how many songs suit it, whether every note, chord or hit of every one has
   a place to play, and the first six seconds of a sample song rendered silently through the instrument's own
   sound: every note within 5 cents, every strum sounding, every hit at its time.
3. **Sound check.** A calibration tone (A 440 Hz at -12 dBFS), then a note from each instrument, each with
   "Can you hear this clearly?" Yes / No.
4. **Checklist.** Multi-touch, strumming, bowing, key and scale, songs, and sound quality items to tick, a notes
   box, and "Copy results as text", which copies all four parts.

## Songs: what was found and changed

- **A repeated note on a bowed string beat against itself.** Auto-play ends each note with a short fade, so a
  repeat of the same note overlapped the last one's tail; the cello's detuned voices then beat, and the pitch
  read 5 cents flat. A repeated note now stops the last one quickly as it starts, like a new bow stroke.
- **Drum hits could ring on after Stop.** The drum and drum-pad sounds didn't hand back their voice, so a hit
  already scheduled a moment ahead (a crash) couldn't be cut. They now do, and Stop, Home and switching cut them.
- **Measuring.** A strum is judged by whether every note of its chord is clearly there, not by which note is
  loudest: a bright steel string's overtones (the fifth above each note) can outweigh a chord tone.

## Round C: what was found and changed

### Key and scale "does nothing"

The live pitch check drove every key and scale through the real menus with real touches on all 15 pitched
instruments, in a fresh Chromium: the sound followed the key and scale every time (see the results below). So the
code path from the menus to the sound works. What the earlier tests could not show, because they set key and scale
through a test hook, is that the on-screen controls reach the sound; now they do.

That leaves the copy of the app on the phone as the likely cause (inferred, not reproduced on the phone):

- The old service worker answered from the network but let the browser's HTTP cache serve an older `index.html`,
  so an installed app could keep running an old version for a long time. It now asks the server every time
  (`cache: 'no-cache'`) and falls back to the cache only offline. When a new version takes over while you are on
  the gallery, the app reloads once to run it.
- Settings now shows the version (v6), so you can see which copy is running.
- Key, scale and Scale lock were not saved: if Android closed the app in the background, it came back in C major.
  They are now remembered per instrument.

Also changed so key and scale are visible everywhere:

- Each instrument's header shows the key, scale and its notes, e.g. "D Major: D E F♯ G A B C♯" (Chromatic lists
  all 12).
- Button-row and fingerboard instruments already rebuild their notes from the key and scale (checked for every
  case above). The harmonica did not always: its chromatic setting gave the same holes as major, and blues gave
  exactly the same holes as minor pentatonic (the blue note never appeared). Chromatic is now a chromatic layout,
  and pentatonic and blues climb their own scale, so every note of the scale is on the harp.
- Piano, pipe organ and synth show the full keyboard with scale notes marked (dot on each, gold on the root,
  off-scale keys dimmed) and a **Scale lock** button (on by default): an off-scale key plays the nearest scale note
  (a tie goes down).
- The synth lead was 4 cents flat (its two oscillators were both detuned downwards); it is now centred.

### Strumming

- Every change of direction is a new strum, and an 8 px flick is enough, so a 20-30 px flick strums every string.
- Down-strums run low string to high; up-strums high to low, mostly the top four strings (the fifth from the top
  lightly), and 20% softer.
- Finger speed sets the gap between strings (30 ms slow to 5 ms fast) and the loudness.
- Each strum mutes what was ringing over 80 ms. Lifting the finger mutes the strings; palm mute still works.
- Each string now gets a few milliseconds of pick noise, which is what makes an up-strum stand out from the
  strings still ringing: without it, an up-strum's attack rose only 2-4 dB over the ring.
- Big ▼ Down and ▲ Up pads with a pick animation and arrow; a pad strum rings until the next strum.
- On the rhythm guitar a tap is a down-strum, and a finger that rests and then swipes down plays one strum, not
  two. On both guitars a tap shorter than 35 ms (the time the app waits to tell a tap from a swipe) used to make no
  sound at all; it now plays as if held for 150 ms.
- Preset patterns and auto-strum tempo are unchanged.

### Trumpet, French horn, saxophone

Rebuilt from sawtooth oscillators to band-limited harmonic stacks:

- Three 28-harmonic `PeriodicWave`s per instrument (mellow, normal, bright), crossfaded by breath and velocity,
  each normalised to the same loudness so the crossfade only changes colour.
- Each attack scoops in about 30 cents flat and settles within 30-60 ms, with a short noise "blat" (lip buzz or
  reed) and a slight random pitch wobble. Attacks (time to 90%): trumpet about 25 ms, horn about 85 ms, sax about
  45 ms.
- Formant filters per instrument, then a bell and bore: a feedback comb tuned to each note plus a short synthetic
  tube response (0.2-0.3 s convolution).
- Full sample rate, the only distortion stage (horn hand-stop buzz) oversamples 4x, level and colour changes use
  `setTargetAtTime`.
- Measured (loudness check, medium breath): trumpet and horn within 2.5 dB of -16 dBFS RMS, peaks well under
  -1 dBFS, no clipped samples; brightness rises with breath (brass check). Exact figures are in the results below.

## Older offline render tests

`tests/*.js` (`tests/package.json`) render the app's audio offline through test hooks: fast and exactly repeatable,
kept for sound design and the LEVEL calibration. Their documentation and results are in
[tests/OFFLINE-TESTS.md](tests/OFFLINE-TESTS.md).

<!-- RESULTS:START (written by tests/run-all.mjs) -->
## Latest results

**All passed: 130 of 130 checks passed.** App v6 · 2026-10-05 07:15 UTC · 30.2 minutes · 3 parallel pages.

| Result | Check | Instrument | Details |
| --- | --- | --- | --- |
| PASS | Load, console, gallery and Home | all | opens on the gallery, 19 cards, no console errors, no failed requests, (web font not reachable here; the system font is used) |
| PASS | Load, console, gallery and Home | Piano | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Drums | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Guitar | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Flute | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Tabla (dual) | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Tabla (single) | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Electric drum pad | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Harmonica | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Violin | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Cello | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | French horn | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Trumpet | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Viola | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Pipe organ | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Saxophone | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Xylophone | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Synth | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Electric bass | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | Rhythm guitar | swiped to, opened from the gallery, Home returned |
| PASS | Load, console, gallery and Home | selftest | Self-test page: automatic check 19/19 passed, sound check plays, report copies as text |
| PASS | Pitch: 12 keys x every scale through the real controls | Piano | 120 key/scale cases, 1560 notes, worst 2.4 cents, every case distinct (5 played twice after a glitch) |
| PASS | Pitch: 12 keys x every scale through the real controls | Guitar | 120 key/scale cases, 630 notes, worst 1.1 cents, every case distinct |
| PASS | Pitch: 12 keys x every scale through the real controls | Flute | 120 key/scale cases, 960 notes, worst 3.7 cents, every case distinct |
| PASS | Pitch: 12 keys x every scale through the real controls | Harmonica | 120 key/scale cases, 1440 notes, worst 1.8 cents, every case distinct |
| PASS | Pitch: 12 keys x every scale through the real controls | Violin | 120 key/scale cases, 980 notes, worst 0.9 cents, every case distinct |
| PASS | Pitch: 12 keys x every scale through the real controls | Cello | 120 key/scale cases, 980 notes, worst 3.6 cents, every case distinct |
| PASS | Pitch: 12 keys x every scale through the real controls | French horn | 120 key/scale cases, 960 notes, worst 1.3 cents, every case distinct |
| PASS | Pitch: 12 keys x every scale through the real controls | Trumpet | 120 key/scale cases, 960 notes, worst 3.1 cents, every case distinct |
| PASS | Pitch: 12 keys x every scale through the real controls | Viola | 120 key/scale cases, 980 notes, worst 3.9 cents, every case distinct |
| PASS | Pitch: 12 keys x every scale through the real controls | Pipe organ | 120 key/scale cases, 1560 notes, worst 1.1 cents, every case distinct |
| PASS | Pitch: 12 keys x every scale through the real controls | Saxophone | 120 key/scale cases, 960 notes, worst 2.7 cents, every case distinct (1 played twice after a glitch) |
| PASS | Pitch: 12 keys x every scale through the real controls | Xylophone | 120 key/scale cases, 960 notes, worst 1.1 cents, every case distinct |
| PASS | Pitch: 12 keys x every scale through the real controls | Synth | 120 key/scale cases, 1560 notes, worst 3.2 cents, every case distinct |
| PASS | Pitch: 12 keys x every scale through the real controls | Electric bass | 120 key/scale cases, 910 notes, worst 0.7 cents, every case distinct |
| PASS | Pitch: 12 keys x every scale through the real controls | Rhythm guitar | 120 key/scale cases, every strum played the key's chord, every case distinct |
| PASS | Loudness and clipping | Guitar | peak -1.1 dBFS, RMS -18.5 dBFS, 0 clipped |
| PASS | Loudness and clipping | Piano | peak -1.1 dBFS, RMS -11.1 dBFS, 0 clipped |
| PASS | Loudness and clipping | Drums | peak -1.3 dBFS, RMS -15.0 dBFS, 0 clipped |
| PASS | Loudness and clipping | Tabla (dual) | peak -1.3 dBFS, RMS -13.9 dBFS, 0 clipped |
| PASS | Loudness and clipping | Tabla (single) | peak -1.8 dBFS, RMS -15.1 dBFS, 0 clipped |
| PASS | Loudness and clipping | Flute | peak -2.9 dBFS, RMS -7.0 dBFS, 0 clipped |
| PASS | Loudness and clipping | Electric drum pad | peak -1.0 dBFS, RMS -13.6 dBFS, 0 clipped |
| PASS | Loudness and clipping | Violin | peak -12.5 dBFS, RMS -27.8 dBFS, 0 clipped |
| PASS | Loudness and clipping | Harmonica | peak -2.9 dBFS, RMS -13.7 dBFS, 0 clipped |
| PASS | Loudness and clipping | Cello | peak -12.7 dBFS, RMS -23.9 dBFS, 0 clipped |
| PASS | Loudness and clipping | French horn | peak -8.5 dBFS, RMS -16.4 dBFS, 0 clipped |
| PASS | Loudness and clipping | Trumpet | peak -7.9 dBFS, RMS -17.2 dBFS, 0 clipped |
| PASS | Loudness and clipping | Viola | peak -13.5 dBFS, RMS -25.4 dBFS, 0 clipped |
| PASS | Loudness and clipping | Saxophone | peak -9.3 dBFS, RMS -18.0 dBFS, 0 clipped |
| PASS | Loudness and clipping | Pipe organ | peak -7.9 dBFS, RMS -15.7 dBFS, 0 clipped |
| PASS | Loudness and clipping | Xylophone | peak -1.5 dBFS, RMS -11.0 dBFS, 0 clipped |
| PASS | Loudness and clipping | Synth | peak -2.2 dBFS, RMS -12.1 dBFS, 0 clipped |
| PASS | Loudness and clipping | Electric bass | peak -2.6 dBFS, RMS -18.6 dBFS, 0 clipped |
| PASS | Loudness and clipping | Rhythm guitar | peak -1.3 dBFS, RMS -17.3 dBFS, 0 clipped |
| PASS | Stuck notes: lift, cancel, tab switch, no fingers | Guitar | silent within 1 s after lift (silence), cancel (silence), background (silence), no fingers (silence) |
| PASS | Stuck notes: lift, cancel, tab switch, no fingers | Flute | silent within 1 s after lift (silence), cancel (silence), background (silence), no fingers (silence) |
| PASS | Stuck notes: lift, cancel, tab switch, no fingers | Piano | silent within 1 s after lift (silence), cancel (silence), background (silence), no fingers (silence) |
| PASS | Stuck notes: lift, cancel, tab switch, no fingers | Violin | silent within 1 s after lift (silence), cancel (silence), background (silence), no fingers (silence) |
| PASS | Stuck notes: lift, cancel, tab switch, no fingers | Cello | silent within 1 s after lift (silence), cancel (silence), background (silence), no fingers (silence) |
| PASS | Stuck notes: lift, cancel, tab switch, no fingers | Harmonica | silent within 1 s after lift (silence), cancel (silence), background (silence), no fingers (silence) |
| PASS | Stuck notes: lift, cancel, tab switch, no fingers | French horn | silent within 1 s after lift (silence), cancel (silence), background (silence), no fingers (silence) |
| PASS | Stuck notes: lift, cancel, tab switch, no fingers | Trumpet | silent within 1 s after lift (silence), cancel (silence), background (silence), no fingers (silence) |
| PASS | Stuck notes: lift, cancel, tab switch, no fingers | Viola | silent within 1 s after lift (silence), cancel (silence), background (silence), no fingers (silence) |
| PASS | Stuck notes: lift, cancel, tab switch, no fingers | Saxophone | silent within 1 s after lift (silence), cancel (silence), background (silence), no fingers (silence) |
| PASS | Stuck notes: lift, cancel, tab switch, no fingers | Pipe organ | silent within 1 s after lift (silence), cancel (silence), background (silence), no fingers (silence) |
| PASS | Stuck notes: lift, cancel, tab switch, no fingers | Xylophone | silent within 1 s after lift (silence), cancel (silence), background (silence), no fingers (silence) |
| PASS | Stuck notes: lift, cancel, tab switch, no fingers | Synth | silent within 1 s after lift (silence), cancel (silence), background (silence), no fingers (silence) |
| PASS | Stuck notes: lift, cancel, tab switch, no fingers | Rhythm guitar | silent within 1 s after lift (silence), cancel (silence), background (silence), no fingers (silence) |
| PASS | Stuck notes: lift, cancel, tab switch, no fingers | Electric bass | silent within 1 s after lift (silence), cancel (silence), background (silence), no fingers (silence) |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Guitar | 5 fingers: 5 voices, 40 fingers: at most 6 of 14, peak -1.0 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Drums | 5 fingers: 3 voices, 40 fingers: at most 14 of 14, peak -1.0 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Piano | 5 fingers: 5 voices, 40 fingers: at most 14 of 14, peak -1.0 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Flute | 5 fingers: 1 voices, 40 fingers: at most 1 of 14, peak -1.2 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Tabla (single) | 5 fingers: 1 voices, 40 fingers: at most 1 of 14, peak -1.0 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Tabla (dual) | 5 fingers: 2 voices, 40 fingers: at most 2 of 14, peak -1.0 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Electric drum pad | 5 fingers: 2 voices, 40 fingers: at most 14 of 14, peak -1.0 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Harmonica | 5 fingers: 5 voices, 40 fingers: at most 14 of 14, peak -1.0 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Violin | 5 fingers: 5 voices, 40 fingers: at most 5 of 14, peak -7.8 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Cello | 5 fingers: 5 voices, 40 fingers: at most 5 of 14, peak -12.4 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | French horn | 5 fingers: 1 voices, 40 fingers: at most 1 of 14, peak -6.1 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Trumpet | 5 fingers: 1 voices, 40 fingers: at most 1 of 14, peak -4.5 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Viola | 5 fingers: 5 voices, 40 fingers: at most 5 of 14, peak -14.6 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Pipe organ | 5 fingers: 5 voices, 40 fingers: at most 14 of 14, peak -1.0 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Saxophone | 5 fingers: 1 voices, 40 fingers: at most 1 of 14, peak -7.1 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Xylophone | 5 fingers: 5 voices, 40 fingers: at most 14 of 14, peak -1.0 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Synth | 5 fingers: 5 voices, 40 fingers: at most 14 of 14, peak -1.0 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Electric bass | 5 fingers: 4 voices, 40 fingers: at most 4 of 14, peak -1.0 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Note limit and multi-touch (5 and 40 fingers) | Rhythm guitar | 5 fingers: 1 voices, 40 fingers: at most 1 of 14, peak -1.0 dBFS, 0 clipped, after lifting: 0 voices |
| PASS | Strumming at 4 strums a second | Guitar | chord notes 4, 8 strums at 4/s ▼▲▼▲▼▲▼▲, each rose 14+ dB, down -11.7 dB, up 3.5 dB softer with the low strings 26 dB weaker, low strings first on every down, high strings first on every up, pads ▼▲ strum both ways |
| PASS | Strumming at 4 strums a second | Rhythm guitar | chord notes 3, 8 strums at 4/s ▼▲▼▲▼▲▼▲, each rose 13+ dB, down -17.8 dB, up 3.9 dB softer with the low strings 31 dB weaker, low strings first on every down, high strings first on every up, pads ▼▲ strum both ways |
| PASS | Bowing across strings and double stops | Viola | bow across the strings: C G D A, double stop G+D both sound (0, -9.1 dB), finger on C + bow plays C |
| PASS | Bowing across strings and double stops | Cello | bow across the strings: C G D A, double stop G+D both sound (0, -3.7 dB), finger on C + bow plays C |
| PASS | Bowing across strings and double stops | Violin | bow across the strings: G D A E, double stop D+A both sound (0, -3.3 dB), finger on G + bow plays G |
| PASS | Brass and reeds: brightness with breath, no crackle | Saxophone | centroid soft/medium/full 749 / 1047 / 1510 Hz, largest jump 1.1 x neighbours, worst 8 kHz burst 3.9 dB, peak -5.5 dBFS, 0 clipped |
| PASS | Brass and reeds: brightness with breath, no crackle | Trumpet | centroid soft/medium/full 1134 / 1601 / 2235 Hz, largest jump 1.1 x neighbours, worst 8 kHz burst 3.3 dB, peak -2.9 dBFS, 0 clipped |
| PASS | Brass and reeds: brightness with breath, no crackle | French horn | centroid soft/medium/full 398 / 509 / 881 Hz, largest jump 1.3 x neighbours, worst 8 kHz burst 4.9 dB, peak -5.3 dBFS, 0 clipped |
| PASS | Record and playback | Harmonica | recorded 3 notes and played back the same (C E G) at the same times |
| PASS | Record and playback | Piano | recorded 3 notes and played back the same (C D E) at the same times |
| PASS | Record and playback | Violin | recorded 3 notes and played back the same (E G B) at the same times |
| PASS | Record and playback | Trumpet | recorded 3 notes and played back the same (B♭ D F) at the same times |
| PASS | Record and playback | French horn | recorded 3 notes and played back the same (F A C) at the same times |
| PASS | Record and playback | Cello | recorded 3 notes and played back the same (A C E) at the same times |
| PASS | Record and playback | Pipe organ | recorded 3 notes and played back the same (C D E) at the same times |
| PASS | Record and playback | Saxophone | recorded 3 notes and played back the same (E♭ G B♭) at the same times |
| PASS | Record and playback | Viola | recorded 3 notes and played back the same (A C E) at the same times |
| PASS | Record and playback | Xylophone | recorded 3 notes and played back the same (C E G) at the same times |
| PASS | Record and playback | Synth | recorded 3 notes and played back the same (A B C) at the same times |
| PASS | Record and playback | Electric bass | recorded 3 notes and played back the same (G B E) at the same times |
| PASS | Record and playback | Rhythm guitar | recorded 3 strums and played back the same (match 0.94 match 0.95 match 0.94) at the same times |
| PASS | Offline, manifest and service worker version | all | cache pocket-band-v6 holds 6 files, Settings shows v6, manifest OK (fullscreen, 3 icons), offline: opens, piano plays (-1 dBFS peak), Self-test page loads offline |
| PASS | Performance: CPU per note and frame rate | Piano | 3.5 ms per note, 60 frames/s with 10 fingers (10 voices) |
| PASS | Performance: CPU per note and frame rate | Drums | 3.1 ms per note, 61 frames/s with 8 fingers (0 voices) |
| PASS | Performance: CPU per note and frame rate | Guitar | 5.7 ms per note, 61 frames/s with 6 fingers (6 voices) |
| PASS | Performance: CPU per note and frame rate | Flute | 5.0 ms per note, 61 frames/s with 8 fingers (1 voices) |
| PASS | Performance: CPU per note and frame rate | Tabla (dual) | 5.7 ms per note, 61 frames/s with 4 fingers (0 voices) |
| PASS | Performance: CPU per note and frame rate | Tabla (single) | 4.3 ms per note, 61 frames/s with 4 fingers (0 voices) |
| PASS | Performance: CPU per note and frame rate | Electric drum pad | 5.2 ms per note, 61 frames/s with 10 fingers (0 voices) |
| PASS | Performance: CPU per note and frame rate | Harmonica | 3.8 ms per note, 61 frames/s with 10 fingers (10 voices) |
| PASS | Performance: CPU per note and frame rate | Violin | 7.4 ms per note, 61 frames/s with 8 fingers (8 voices) |
| PASS | Performance: CPU per note and frame rate | Cello | 7.5 ms per note, 61 frames/s with 8 fingers (8 voices) |
| PASS | Performance: CPU per note and frame rate | French horn | 4.7 ms per note, 61 frames/s with 8 fingers (1 voices) |
| PASS | Performance: CPU per note and frame rate | Trumpet | 5.7 ms per note, 61 frames/s with 8 fingers (1 voices) |
| PASS | Performance: CPU per note and frame rate | Viola | 7.6 ms per note, 61 frames/s with 8 fingers (8 voices) |
| PASS | Performance: CPU per note and frame rate | Pipe organ | 4.0 ms per note, 61 frames/s with 10 fingers (10 voices) |
| PASS | Performance: CPU per note and frame rate | Saxophone | 4.9 ms per note, 61 frames/s with 8 fingers (1 voices) |
| PASS | Performance: CPU per note and frame rate | Xylophone | 4.0 ms per note, 61 frames/s with 8 fingers (0 voices) |
| PASS | Performance: CPU per note and frame rate | Synth | 3.8 ms per note, 61 frames/s with 10 fingers (10 voices) |
| PASS | Performance: CPU per note and frame rate | Electric bass | 7.4 ms per note, 61 frames/s with 6 fingers (1 voices) |
| PASS | Performance: CPU per note and frame rate | Rhythm guitar | 7.8 ms per note, 61 frames/s with 1 fingers (1 voices) |
<!-- RESULTS:END -->
