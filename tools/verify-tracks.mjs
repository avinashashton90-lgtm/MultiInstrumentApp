#!/usr/bin/env node
// Checks every verified track against the score it was converted from, two ways:
//   1. notes: each note of the melody (and of its bass line) is in the source MIDI file, in the part the track names,
//      with the exact pitch and its onset within a 16th of a beat; and nothing is missing: every note the source's
//      melody part plays inside the excerpt (its top note at each onset; grace notes aside) is in the track. Chord songs
//      and bass lines made from a melody carry exactly its notes and its bass line (or, where the score has none, the
//      roots of the chord song's chords); its drum and tabla rhythms carry its tune, chords, tempo, time and length.
//   2. sound: the track is rendered offline through the app's own piano (headless Chromium, OfflineAudioContext), each
//      note's pitch is detected again from the audio, and must be the written note (within 25 cents).
// Any mismatch prints the track, bar and beat and exits with 1.
//   node tools/verify-tracks.mjs [--notes-only] [ids...]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, Core } from './midi-to-track.mjs';

const require = createRequire(import.meta.url);
const TOL = 1 / 16, CENTS = 25;
const args = process.argv.slice(2), notesOnly = args.includes('--notes-only'), only = args.filter((a) => !a.startsWith('--'));
const load = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'tracks', f + '.json'), 'utf8'));
const melodies = load('melodies'), chords = load('chords'), bass = load('bass'), drums = load('drums'), tabla = load('tabla');
const verified = melodies.filter((t) => t.status === 'verified' && (!only.length || only.includes(t.id)));
const per = (t) => t.time[0] * 4 / t.time[1];
const where = (t, b) => `bar ${Math.floor(b / per(t)) + 1}, beat ${+((b % per(t)) / (4 / t.time[1]) + 1).toFixed(3)}`;
const errors = [];
const fail = (t, msg) => errors.push(`${t.id}: ${msg}`);

// The source's notes in the named parts, as one line (top notes for a melody, bottom notes for a bass line), in beats
function sourceLine(mid, keys, top, grace) {
  const ppq = mid.ppq;
  return Core.line(mid.notes.filter((n) => keys.includes(n.tr + ':' + n.ch) && (grace || (n.off - n.on) / ppq >= 1 / 16 - 1e-6)), top)
    .map((n) => ({ b: n.on / ppq, m: n.m }));
}
function compare(t, notes, src, what) {
  const f = t.from, lo = f.srcBeat + (f.lead ? per(t) - f.lead : 0), hi = Math.min(f.srcBeat + t.bars * per(t), f.end === undefined ? Infinity : f.end);
  let bad = 0;
  notes.forEach((n) => {
    const want = n[0] + f.srcBeat;
    if (!src.some((s) => s.m === n[2] && Math.abs(s.b - want) <= TOL + 1e-9)) { bad++; if (bad <= 5) fail(t, `${what} ${Core.name(n[2])} at ${where(t, n[0])} is not in the source`); }
  });
  src.filter((s) => s.b >= lo - TOL && s.b < hi - TOL).forEach((s) => {
    if (!notes.some((n) => n[2] === s.m && Math.abs(n[0] + f.srcBeat - s.b) <= TOL + 1e-9)) { bad++; if (bad <= 5) fail(t, `${what}: the source's ${Core.name(s.m)} at ${where(t, s.b - f.srcBeat)} is missing`); }
  });
  return bad;
}
const chordRoot = (sym) => { const m = /^([A-G])(#|b)?/.exec(sym); return ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] ? -1 : 0) + 12) % 12; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let checked = 0;
for (const t of verified) {
  const mid = Core.parse(new Uint8Array(fs.readFileSync(path.join(ROOT, t.from.file))));
  compare(t, t.notes, sourceLine(mid, t.from.melody, true, t.from.grace), 'melody');
  if (t.low) compare(t, t.low, sourceLine(mid, t.from.bass, false, t.from.grace), 'bass');
  const ch = chords.find((c) => c.id === 'ch-' + t.id), bs = bass.find((c) => c.id === 'bs-' + t.id);
  if (ch && !same(ch.notes, t.notes)) fail(ch, 'the chord song\'s tune differs from the melody track');
  if (ch && !same(ch.chords, Core.convert(mid, { melody: t.from.melody, bass: t.from.bass, start: t.from.srcBeat + (t.from.lead ? per(t) : 0), lead: t.from.lead, bars: t.bars - (t.from.lead ? 1 : 0), end: t.from.end, grace: t.from.grace, key: t.from.key, mode: t.from.mode }).keyChords))
    fail(ch, 'the chord song\'s chords are not the key chords its score\'s harmony gives');
  if (bs && bs.line === 'score' && !same(bs.notes, t.low)) fail(bs, 'the bass line differs from the score\'s bass line');
  if (bs && bs.line === 'roots') bs.notes.forEach((n) => {
    const bar = ch && ch.chords[Math.floor(n[0] / per(t) + 1e-9)], syms = bar ? bar.split(/\s+/).filter((x) => x !== '-') : [];
    const sym = syms[Math.floor((n[0] % per(t)) / (per(t) / syms.length) + 1e-9)], root = sym && chordRoot(sym);
    if (root !== n[2] % 12) fail(bs, `the bass note ${Core.name(n[2])} at ${where(t, n[0])} is not the root of the chord there (${sym})`);
  });
  if (!ch || !bs) fail(t, 'has no chord song or no bass line');
  for (const r of [drums.find((x) => x.id === 'dr-' + t.id), tabla.find((x) => x.id === 'tl-' + t.id)]) {
    if (!r) { fail(t, 'has no drum or tabla rhythm'); continue; }
    if (!same([r.tempo, r.time, r.bars, r.tune, r.chords], [t.tempo, t.time, t.bars, t.notes, ch && ch.chords])) fail(r, 'the rhythm\'s tempo, time, length, tune or chords differ from the song\'s');
    if (r.hits.some((h) => h[0] < 0 || h[0] >= t.bars * per(t) - 1e-6)) fail(r, 'a hit falls outside the song');
  }
  checked++;
}
console.log(`notes: ${checked} verified tracks compared with their source MIDI (pitch exact, onset within 1/16 beat)`);

if (!notesOnly && !errors.length) {
  const { launch } = require('../tests/lib/browser.js');
  const { measure } = require('../tests/lib/measure.js');
  const browser = await launch();
  let notesHeard = 0;
  try {
    for (const t of verified) {
      for (const [what, list] of [['melody', t.notes], ['bass', t.low || []]]) {
        if (!list.length) continue;
        // a note too low to measure well is played whole octaves up; it must then sound exactly that many octaves up
        const play = list.map((n) => { let m = n[2]; while (m < 40) m += 12; return m; });
        const r = await measure(browser, {}, ({ play }) => {
          const P = window.PocketBandTest, LEN = 0.32, GAP = 0.08, steps = [], windows = [];
          play.forEach((m, i) => {
            const at = 0.1 + i * (LEN + GAP);
            steps.push([at, () => P.noteOn('v' + i, m, 0.8, 'piano', [0])], [at + LEN, () => P.noteOff('v' + i)]);
            windows.push(['n' + i, at + 0.06, at + LEN - 0.02, 'pitch', { fmin: 60, fmax: 2600 }]);
          });
          return { seconds: 0.4 + play.length * (LEN + GAP), steps, windows,
            before: () => { P.open('piano'); const v = document.getElementById('rev'); v.value = 0; v.dispatchEvent(new Event('input')); P.init(); } };
        }, { play });
        play.forEach((m, i) => {
          const f = r['n' + i].f, heard = f > 0 ? 69 + 12 * Math.log2(f / 440) : NaN, off = (heard - m) * 100;
          if (!(Math.abs(off) <= CENTS)) fail(t, `${what} note ${i + 1} (${where(t, list[i][0])}) should sound ${Core.name(m)}, heard ${f ? f.toFixed(1) + ' Hz' : 'nothing'}`);
          else notesHeard++;
        });
      }
    }
  } finally { await browser.close(); }
  console.log(`sound: ${notesHeard} notes rendered offline and heard at the written pitch (within ${CENTS} cents)`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('all verified tracks match their sources');
