#!/usr/bin/env node
// Converts a MIDI file into a Pocket Band track.
//   node tools/midi-to-track.mjs song.mid                 list the parts, then convert the likeliest melody
//   node tools/midi-to-track.mjs song.mid --melody=1 --bass=2 --start=0.5 --lead=0.5 --bars=16 --tempo=90 --id=x --title="..."
// Parts are MIDI tracks ("1" every channel of track 1, "1:2" channel 2 only). start is the beat (quarter notes from the
// start of the file) where the first full bar of the excerpt begins, lead the pickup to keep before it.
// The library build (tools/make-tracks.mjs) calls convertSource() for every score in tools/sources.json.
//
// What the conversion does (the code is tools/lib/midi-core.js, which the app's "Add my song" also runs):
//   - the melody is the chosen part's top line (the highest note of each chord, each note cut where the next starts);
//     grace notes (shorter than a 16th of a beat) are left out; a tied note is one note, as MIDI stores it
//   - onsets and ends are quantised lightly: to the nearest 16th or triplet 8th within a 24th of a beat, else a 24th
//   - key and mode: the key signature in the file and a Krumhansl-Kessler profile of every part (the last note breaks
//     ties); the tune keeps its own key and mode, it is never transposed
//   - tempo and time signature from the file (tempo only where the score has a marking; otherwise the manifest's)
//   - the intro is trimmed: the excerpt starts at the bar the melody starts in, unless a start is given
//   - sections of 4 to 8 bars, ending where the tune breathes
//   - Easy: the melody. Full: the melody with the source's own bass line (low) and the chords its harmony spells
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const Core = require('./lib/midi-core.js');
export const SOURCES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'sources.json'), 'utf8'));

// "8" -> every part of MIDI track 8; "1:2" -> that part
export function partKeys(mid, specs) {
  if (!specs) return undefined;
  const list = Core.parts(mid), out = [];
  for (const s of specs) {
    const hit = String(s).includes(':') ? list.filter((p) => p.key === String(s)) : list.filter((p) => p.tr === +s);
    if (!hit.length) throw new Error(`no part ${s} in the file`);
    hit.forEach((p) => out.push(p.key));
  }
  return out;
}

export function readMidi(file) { return Core.parse(new Uint8Array(fs.readFileSync(file))); }

// One score from tools/sources.json -> the track's fields (before the library adds id, type and the rest)
export function convertSource(src) {
  const file = path.join(ROOT, 'sources', src.id, src.id + '.mid');
  const mid = readMidi(file);
  const t = Core.convert(mid, { melody: partKeys(mid, src.melody), bass: src.bass ? partKeys(mid, src.bass) : [], start: src.start, lead: src.lead,
    bars: src.bars, end: src.end, tempo: src.tempo, octave: src.octave, grace: src.grace, keySig: src.keySig, key: src.key, mode: src.mode });
  t.map.file = path.relative(ROOT, file);
  return t;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(3).map((a) => { const m = /^--(\w+)=(.*)$/.exec(a); return m ? [m[1], m[2]] : [a, true]; }));
  const file = process.argv[2];
  if (!file) { console.error('usage: node tools/midi-to-track.mjs file.mid [--melody=1] [--bass=2] [--start=0] [--lead=0] [--bars=8] [--tempo=100] [--id=..] [--title=..]'); process.exit(1); }
  const mid = readMidi(file);
  console.error('Parts:');
  Core.parts(mid).forEach((p) => console.error(`  ${p.key}  ${p.label}  ${p.n} notes  ${Core.name(p.lo)}-${Core.name(p.hi)}${p.chords > 0.3 ? '  (chords)' : ''}`));
  const list = (v) => v === undefined ? undefined : String(v).split(',');
  const num = (v) => v === undefined ? undefined : +v;
  const t = Core.convert(mid, { melody: partKeys(mid, list(args.melody)), bass: args.bass ? partKeys(mid, list(args.bass)) : undefined,
    start: num(args.start), lead: num(args.lead), bars: num(args.bars), tempo: num(args.tempo), octave: num(args.octave), grace: !!args.grace });
  const out = { id: args.id || path.basename(file).replace(/\.\w+$/, ''), type: 'melody', title: args.title || path.basename(file), by: args.by || '', ...t };
  console.log(JSON.stringify(out));
}
