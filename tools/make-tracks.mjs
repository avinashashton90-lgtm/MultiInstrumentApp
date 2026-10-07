#!/usr/bin/env node
// Builds the free song library in tracks/*.json and the list in TRACKS.md from the readable sources below.
//   node tools/make-tracks.mjs
// Every track is either public domain (traditional, or a composer who died long ago) or written for Pocket Band.
// Melodies are written bar by bar ("|" between bars); the script checks that every bar adds up to the time
// signature, so a slip in a transcription stops the build instead of reaching the app.
//
// Melody notation: NOTE[:beats] tokens, e.g. "C4:1 D4 E4:0.5 F#4" (a beat is a quarter note; a length carries on to
// the next notes until changed). "r" is a rest, a trailing "~" ties a note into the next one of the same pitch and
// a leading ">" accents it. Chords: one entry per bar, two chords in a bar split it ("G C"), "-" for none.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], melodic: [0, 2, 3, 5, 7, 9, 11],
  penta: [0, 2, 4, 7, 9], minpenta: [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10], chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};
const SARGAM = ['Sa', 're', 'Re', 'ga', 'Ga', 'Ma', 'ma', 'Pa', 'dha', 'Dha', 'ni', 'Ni'];
const r3 = (x) => Math.round(x * 1000) / 1000;

export function pitchClass(name) {
  const m = /^([A-G])(#|b|♯|♭)?$/.exec(name);
  if (!m) throw new Error('bad key ' + name);
  return (STEP[m[1]] + (m[2] === '#' || m[2] === '♯' ? 1 : m[2] ? -1 : 0) + 12) % 12;
}
export function noteMidi(tok) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(tok);
  if (!m) throw new Error('bad note ' + tok);
  return 12 * (+m[3] + 1) + STEP[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const barBeats = (time) => time[0] * 4 / time[1];

// "C4:1 D4 | E4:2 r" -> notes [[start, length, midi, velocity]] and the bar count
export function parseMelody(src, time, id) {
  const per = barBeats(time), bars = src.split('|').map((b) => b.trim()).filter((b, i, a) => b || i < a.length - 1);
  const notes = [];
  let dur = 1, t = 0, tie = null;
  bars.forEach((bar, bi) => {
    const start = t;
    for (let tok of bar.split(/\s+/).filter(Boolean)) {
      let acc = false, tied = false;
      if (tok[0] === '>') { acc = true; tok = tok.slice(1); }
      if (tok.endsWith('~')) { tied = true; tok = tok.slice(0, -1); }
      const [n, d] = tok.split(':');
      if (d !== undefined) { dur = +d; if (!(dur > 0)) throw new Error(`${id}: bad length in "${tok}"`); }
      if (n !== 'r') {
        const m = noteMidi(n);
        if (tie && tie[2] === m) tie[1] = r3(tie[1] + dur);
        else notes.push(tie = [r3(t), dur, m, acc ? 112 : Math.abs(t - start) < 1e-6 ? 100 : 88]);
        if (!tied) tie = null;
      } else tie = null;
      t = r3(t + dur);
    }
    const len = r3(t - start);
    if (Math.abs(len - per) > 1e-6) throw new Error(`${id}: bar ${bi + 1} lasts ${len} beats, the time signature needs ${per}: "${bar}"`);
  });
  return { notes, bars: bars.length };
}

// The smallest scale (from the one asked for) that holds every note, counted from the key
function scaleFor(notes, key, want) {
  const pcs = new Set(notes.map((n) => ((n[2] - key) % 12 + 12) % 12));
  for (const s of [want, 'major', 'minor', 'harmonic', 'melodic', 'dorian', 'mixolydian', 'chromatic']) {
    if ([...pcs].every((p) => SCALES[s].includes(p))) return s;
  }
  return 'chromatic';
}

// Sargam for each note, counted from Sa (the key) in the octave from the key's note in octave 4: a dot below for
// the low octave (mandra), a dot above for the high one (taar)
function sargamOf(notes, key) {
  const sa = 60 + key - (key > 6 ? 12 : 0);
  return notes.map((n) => {
    const d = n[2] - sa, o = Math.floor(d / 12), s = SARGAM[((d % 12) + 12) % 12];
    return o < 0 ? s[0] + '̣' + s.slice(1) : o > 0 ? s[0] + '̇' + s.slice(1) : s;
  });
}

/* ---------------- Melodies ---------------- */
// status: where the melody comes from, for TRACKS.md. check: true marks "needs ear check" (written from memory and
// worth checking by ear against a version you know).
const PD = 'Public domain: traditional';
const MELODIES = [
  { id: 'twinkle', title: 'Twinkle Twinkle Little Star', by: 'Traditional', status: PD + ' (French air, 1761)', tempo: 100, time: [4, 4], key: 'C', scale: 'major', level: 1, tags: ['Kids', 'Folk'],
    mel: 'C4:1 C4 G4 G4 | A4 A4 G4:2 | F4:1 F4 E4 E4 | D4 D4 C4:2 | G4:1 G4 F4 F4 | E4 E4 D4:2 | G4:1 G4 F4 F4 | E4 E4 D4:2 | C4:1 C4 G4 G4 | A4 A4 G4:2 | F4:1 F4 E4 E4 | D4 D4 C4:2',
    chords: 'C | F C | F C | G C | C F | C G | C F | C G | C | F C | F C | G C' },
  { id: 'ode', title: 'Ode to Joy', by: 'Ludwig van Beethoven (1824)', status: 'Public domain: Beethoven died 1827', tempo: 108, time: [4, 4], key: 'C', scale: 'major', level: 1, tags: ['Classical'],
    mel: 'E4:1 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:0.5 D4:2 | E4:1 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:0.5 C4:2 | D4:1 D4 E4 C4 | D4 E4:0.5 F4 E4:1 C4 | D4 E4:0.5 F4 E4:1 D4 | C4 D4 G3:2 | E4:1 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:0.5 C4:2',
    chords: 'C | G | C | G | C | G | C | G C | G | G C | G C | C G | C | G | C | G C' },
  { id: 'jingle', title: 'Jingle Bells (chorus)', by: 'James Lord Pierpont (1857)', status: 'Public domain: Pierpont died 1893', tempo: 116, time: [4, 4], key: 'C', scale: 'major', level: 1, tags: ['Kids', 'Folk'],
    mel: 'E4:1 E4 E4:2 | E4:1 E4 E4:2 | E4:1 G4 C4:1.5 D4:0.5 | E4:4 | F4:1 F4 F4:1.5 F4:0.5 | F4:1 E4 E4 E4:0.5 E4 | E4:1 D4 D4 E4 | D4:2 G4:2 | E4:1 E4 E4:2 | E4:1 E4 E4:2 | E4:1 G4 C4:1.5 D4:0.5 | E4:4 | F4:1 F4 F4 F4 | F4 E4 E4 E4:0.5 E4 | G4:1 G4 F4 D4 | C4:4',
    chords: 'C | C | C | C | F | C | D | G | C | C | C | C | F | C | G | C' },
  { id: 'grace', title: 'Amazing Grace', by: 'Traditional (tune "New Britain")', status: PD + ' (American hymn tune, 1829)', tempo: 84, time: [3, 4], key: 'G', scale: 'major', level: 1, tags: ['Hymn', 'Folk'],
    mel: 'r:2 D4:1 | G4:2 B4:0.5 G4 | B4:2 A4:1 | G4:2 E4:1 | D4:2 D4:1 | G4:2 B4:0.5 G4 | B4:2 A4:1 | D5:3~ | D5:2 B4:1 | D5:2 B4:0.5 G4 | B4:2 A4:1 | G4:2 E4:1 | D4:2 D4:1 | G4:2 B4:0.5 G4 | B4:2 A4:1 | G4:3',
    chords: '- | G | G | C | G | G | Em | D | D | G | G | C | G | Em | D | G' },
  { id: 'greensleeves', title: 'Greensleeves', by: 'Traditional (English, 16th century)', status: PD, tempo: 96, time: [3, 4], key: 'A', scale: 'minor', level: 2, tags: ['Folk'],
    mel: 'r:2 A4:1 | C5:2 D5:1 | E5:1.5 F5:0.5 E5:1 | D5:2 B4:1 | G4:1.5 A4:0.5 B4:1 | C5:2 A4:1 | A4:1.5 G#4:0.5 A4:1 | B4:2 G#4:1 | E4:2 A4:1 | C5:2 D5:1 | E5:1.5 F5:0.5 E5:1 | D5:2 B4:1 | G4:1.5 A4:0.5 B4:1 | C5:1.5 B4:0.5 A4:1 | G#4:1.5 F#4:0.5 G#4:1 | A4:3',
    chords: '- | Am | C | G | Em | Am | E | E | E | Am | C | G | Em | Am | E | Am' },
  { id: 'frere', title: 'Frère Jacques', by: 'Traditional (French)', status: PD, tempo: 112, time: [4, 4], key: 'C', scale: 'major', level: 1, tags: ['Kids', 'Folk'],
    mel: 'C4:1 D4 E4 C4 | C4 D4 E4 C4 | E4 F4 G4:2 | E4:1 F4 G4:2 | G4:0.5 A4 G4 F4 E4:1 C4 | G4:0.5 A4 G4 F4 E4:1 C4 | C4 G3 C4:2 | C4:1 G3 C4:2',
    chords: 'C | C | C | C | C | C | C G | C' },
  { id: 'mary', title: 'Mary Had a Little Lamb', by: 'Traditional (American, 1830s)', status: PD, tempo: 112, time: [4, 4], key: 'C', scale: 'major', level: 1, tags: ['Kids'],
    mel: 'E4:1 D4 C4 D4 | E4 E4 E4:2 | D4:1 D4 D4:2 | E4:1 G4 G4:2 | E4:1 D4 C4 D4 | E4 E4 E4 E4 | D4 D4 E4 D4 | C4:4',
    chords: 'C | C | G | C | C | C | G | C' },
  { id: 'birthday', title: 'Happy Birthday', by: 'Mildred and Patty Hill (1893)', status: 'Public domain (melody 1893, "Good Morning to All"; US court ruling 2016)', tempo: 100, time: [3, 4], key: 'C', scale: 'major', level: 1, tags: ['Kids'],
    mel: 'r:2 G4:0.75 G4:0.25 | A4:1 G4 C5 | B4:2 G4:0.75 G4:0.25 | A4:1 G4 D5 | C5:2 G4:0.75 G4:0.25 | G5:1 E5 C5 | B4 A4 F5:0.75 F5:0.25 | E5:1 C5 D5 | C5:3',
    chords: '- | C | G | G | C | F | C G | C G | C' },
  { id: 'london', title: 'London Bridge', by: 'Traditional (English)', status: PD, tempo: 112, time: [4, 4], key: 'C', scale: 'major', level: 1, tags: ['Kids'],
    mel: 'G4:1.5 A4:0.5 G4:1 F4 | E4 F4 G4:2 | D4:1 E4 F4:2 | E4:1 F4 G4:2 | G4:1.5 A4:0.5 G4:1 F4 | E4 F4 G4:2 | D4:2 G4:2 | E4:2 C4:2',
    chords: 'C | C | G | C | C | C | G | C' },
  { id: 'saints', title: 'When the Saints Go Marching In', by: 'Traditional (American spiritual)', status: PD, check: true, tempo: 120, time: [4, 4], key: 'C', scale: 'major', level: 1, tags: ['Hymn', 'Folk'],
    mel: 'r:1 C4 E4 F4 | G4:4 | r:1 C4 E4 F4 | G4:4 | r:1 C4 E4 F4 | G4:2 E4:2 | C4:2 E4:2 | D4:4 | r:1 E4 E4 D4 | C4:3 C4:1 | E4:2 G4:2 | G4:1 F4:3 | r:1 E4 F4 G4 | E4:2 C4:2 | D4:4 | C4:4',
    chords: 'C | C | C | C | C | C | C | G | G | C | C | F | C | C | G | C' },
  { id: 'auld', title: 'Auld Lang Syne', by: 'Traditional (Scottish)', status: PD, tempo: 88, time: [4, 4], key: 'C', scale: 'major', level: 1, tags: ['Folk'],
    mel: 'r:3 G3:1 | C4:1.5 C4:0.5 C4:1 E4 | D4:1.5 C4:0.5 D4:1 E4 | C4:1.5 C4:0.5 E4:1 G4 | A4:3 A4:1 | G4:1.5 E4:0.5 E4:1 C4 | D4:1.5 C4:0.5 D4:1 E4 | C4:1.5 A3:0.5 A3:1 G3 | C4:3 r:1',
    chords: '- | C | G | C | F | C | G | F G | C' },
  { id: 'brahms', title: 'Lullaby (Wiegenlied)', by: 'Johannes Brahms (1868)', status: 'Public domain: Brahms died 1897', check: true, tempo: 84, time: [3, 4], key: 'C', scale: 'major', level: 1, tags: ['Classical', 'Kids'],
    mel: 'r:2 E4:0.5 E4 | G4:2 E4:0.5 E4 | G4:2 E4:0.5 G4 | C5:1 B4:1.5 A4:0.5 | A4:1 G4 D4:0.5 E4 | F4:1 D4 D4:0.5 E4 | F4:2 D4:0.5 F4 | B4:0.5 A4 G4:1 B4 | C5:2 C4:0.5 C4 | C5:2 A4:0.5 F4 | G4:2 E4:0.5 C4 | F4:1 G4 A4 | G4:2 C4:0.5 C4 | C5:2 A4:0.5 F4 | G4:2 E4:0.5 C4 | F4:1 E4 D4 | C4:3',
    chords: '- | C | C | G | G | G | G | G | C | F | C | G | C | F | C | G | C' },
  { id: 'minuet', title: 'Minuet in G', by: 'Christian Petzold (c. 1725, long credited to J. S. Bach)', status: 'Public domain: Petzold died 1733', tempo: 112, time: [3, 4], key: 'G', scale: 'major', level: 2, tags: ['Classical'],
    mel: 'D5:1 G4:0.5 A4 B4 C5 | D5:1 G4 G4 | E5:1 C5:0.5 D5 E5 F#5 | G5:1 G4 G4 | C5:1 D5:0.5 C5 B4 A4 | B4:1 C5:0.5 B4 A4 G4 | F#4:1 G4:0.5 A4 B4 G4 | A4:3 | D5:1 G4:0.5 A4 B4 C5 | D5:1 G4 G4 | E5:1 C5:0.5 D5 E5 F#5 | G5:1 G4 G4 | C5:1 D5:0.5 C5 B4 A4 | B4:1 C5:0.5 B4 A4 G4 | A4:1 B4:0.5 A4 G4 F#4 | G4:3',
    chords: 'G | G | C | G | C | G | D | D | G | G | C | G | C | G | D | G' },
  { id: 'canon', title: 'Canon in D (simplified)', by: 'Johann Pachelbel (c. 1690)', status: 'Public domain: Pachelbel died 1706', check: true, tempo: 72, time: [4, 4], key: 'D', scale: 'major', level: 1, tags: ['Classical'],
    mel: 'F#5:2 E5:2 | D5:2 C#5:2 | B4:2 A4:2 | B4:2 C#5:2 | D5:2 C#5:2 | B4:2 A4:2 | G4:2 F#4:2 | G4:2 E4:2 | D4:1 F#4 A4 G4 | F#4 D4 F#4 E4 | D4 B3 D4 A4 | G4 B4 A4 G4 | F#4:2 E4:2 | D4:4',
    chords: 'D A | Bm F#m | G D | G A | D A | Bm F#m | G D | G A | D A | Bm F#m | G D | G A | D A | D' },
  { id: 'elise', title: 'Für Elise (opening)', by: 'Ludwig van Beethoven (1810)', status: 'Public domain: Beethoven died 1827', tempo: 66, time: [3, 8], key: 'A', scale: 'minor', level: 3, tags: ['Classical'],
    mel: 'r:1 E5:0.25 D#5 | E5 D#5 E5 B4 D5 C5 | A4:0.5 r:0.25 C4 E4 A4 | B4:0.5 r:0.25 E4 G#4 B4 | C5:0.5 r:0.25 E4 E5 D#5 | E5 D#5 E5 B4 D5 C5 | A4:0.5 r:0.25 C4 E4 A4 | B4:0.5 r:0.25 E4 C5 B4 | A4:1.5',
    chords: '- | - | Am | E | Am | - | Am | E | Am' },
  { id: 'mountain', title: 'In the Hall of the Mountain King', by: 'Edvard Grieg (1875)', status: 'Public domain: Grieg died 1907', check: true, tempo: 100, time: [4, 4], key: 'A', scale: 'minor', level: 2, tags: ['Classical'],
    mel: 'A3:0.5 B3 C4 D4 E4 C4 E4:1 | D#4:0.5 B3 D#4:1 D4:0.5 Bb3 D4:1 | A3:0.5 B3 C4 D4 E4 C4 E4 A4 | G4 E4 C4 E4 G4:2 | A3:0.5 B3 C4 D4 E4 C4 E4:1 | D#4:0.5 B3 D#4:1 D4:0.5 Bb3 D4:1 | A3:0.5 B3 C4 D4 E4 C4 E4 A4 | G4 E4 C4 E4 A3:2',
    chords: 'Am | B Bb | Am | C | Am | B Bb | Am | C Am' },
  { id: 'cancan', title: 'Can-Can (Galop infernal)', by: 'Jacques Offenbach (1858)', status: 'Public domain: Offenbach died 1880', check: true, tempo: 126, time: [2, 4], key: 'C', scale: 'major', level: 2, tags: ['Classical'],
    mel: 'C4:1 D4:0.25 F4 E4 D4 | G4:0.5 G4 G4 A4:0.25 E4 | F4:0.5 F4 F4 A4:0.25 G4 | F4:0.25 C5 B4 A4 G4 F4 E4 D4 | C4:1 D4:0.25 F4 E4 D4 | G4:0.5 G4 G4 A4:0.25 E4 | D4:0.25 G4 E4 D4 C4:1 | C4:2',
    chords: 'C | C | F | G | C | C | G C | C' },
  { id: 'danube', title: 'The Blue Danube (theme)', by: 'Johann Strauss II (1866)', status: 'Public domain: Strauss died 1899', check: true, tempo: 150, time: [3, 4], key: 'D', scale: 'major', level: 2, tags: ['Classical'],
    mel: 'r:2 D4:1 | D4:1 F#4 A4 | A4:3 | r:1 A5 A5 | r:1 F#5 F#5 | D4 D4 F#4 | A4:3 | r:1 A5 A5 | r:1 G5 G5 | C#4 C#4 E4 | B4:3 | r:1 B5 B5 | r:1 G5 G5 | C#4 C#4 E4 | B4:3 | r:1 B5 B5 | r:1 F#5 F#5 | D5:3',
    chords: '- | D | D | D | D | D | D | D | D | A | A | A | A | A | A | A | D | D' },
  { id: 'raghupati', title: 'Raghupati Raghav Raja Ram', by: 'Traditional bhajan (tune popularised by V. D. Paluskar, d. 1931)', status: PD + ' (devotional song)', check: true, tempo: 92, time: [4, 4], key: 'C', scale: 'major', level: 1, tags: ['Indian', 'Folk'],
    mel: 'C4:1 D4 E4 E4 | E4 D4 E4 F4 | E4:2 D4:2 | C4:4 | E4:1 F4 G4 G4 | G4 F4 E4 F4 | E4:2 D4:2 | C4:4 | G4:1 G4 A4 G4 | F4:2 E4:2 | F4:1 F4 G4 F4 | E4:2 D4:2 | E4:1 F4 G4 F4 | E4 D4 C4 D4 | E4:2 D4:2 | C4:4',
    chords: 'C | C | G | C | C | F | G | C | C | F C | F | C G | C | F G | C G | C' },
  { id: 'vaishnav', title: 'Vaishnav Jan To', by: 'Narsinh Mehta (15th century), traditional tune', status: PD + ' (poem 15th century; the tune is traditional)', check: true, tempo: 76, time: [4, 4], key: 'C', scale: 'mixolydian', level: 2, tags: ['Indian'],
    mel: 'C4:1 C4 D4 E4 | F4:2 E4:1 D4 | E4:1 F4 G4 F4 | E4:2 D4:2 | E4:1 F4 G4 A4 | Bb4:2 A4:1 G4 | A4:1 G4 F4 E4 | D4:2 C4:2 | G4:1 G4 A4 Bb4 | C5:2 Bb4:1 A4 | G4:1 A4 G4 F4 | E4:2 D4:2 | E4:1 F4 G4 F4 | E4 D4 C4 D4 | E4:2 D4:2 | C4:4',
    chords: 'C | F C | C | C G | C | Bb F | F C | G C | C | C Bb | C F | C G | C | F C | G | C' },
  { id: 'chandamama', title: 'Chandamama Raave', by: 'Traditional (Telugu lullaby)', status: PD + ' (folk lullaby)', check: true, tempo: 88, time: [4, 4], key: 'C', scale: 'penta', level: 1, tags: ['Indian', 'Kids'],
    mel: 'E4:1 G4 G4:2 | E4:1 G4 G4:2 | A4:1 G4 E4 D4 | E4:4 | D4:1 E4 G4 E4 | D4 C4 D4:2 | E4:1 D4 C4 A3 | C4:4',
    chords: 'C | C | F C | C | G C | G | C Am | C' },
  { id: 'alankar', title: 'Sa Re Ga Ma alankar (paltas)', by: 'Traditional exercise', status: PD + ' (teaching exercise)', tempo: 80, time: [3, 4], key: 'C', scale: 'major', level: 1, tags: ['Indian'],
    mel: 'C4:1 D4 E4 | D4 E4 F4 | E4 F4 G4 | F4 G4 A4 | G4 A4 B4 | A4 B4 C5 | C5 B4 A4 | B4 A4 G4 | A4 G4 F4 | G4 F4 E4 | F4 E4 D4 | E4 D4 C4 | C4:3',
    chords: 'C | G | C | F | C | F | C | G | F | C | G | C | C' },
  { id: 'bilawal', title: 'Bilawal: aroha and avaroha', by: 'Traditional exercise', status: PD + ' (raag scale)', tempo: 80, time: [4, 4], key: 'C', scale: 'major', level: 1, tags: ['Indian'],
    mel: 'C4:1 D4 E4 F4 | G4 A4 B4 C5 | C5 B4 A4 G4 | F4 E4 D4 C4',
    chords: 'C | C | C | C' },
  { id: 'bhoopali', title: 'Bhoopali: aroha and avaroha', by: 'Traditional exercise', status: PD + ' (raag scale)', tempo: 80, time: [4, 4], key: 'C', scale: 'penta', level: 1, tags: ['Indian'],
    mel: 'C4:1 D4 E4 G4 | A4 C5:3 | C5:1 A4 G4 E4 | D4 C4:3',
    chords: 'C | C | C | C' },
  { id: 'yaman', title: 'Yaman: aroha and avaroha', by: 'Traditional exercise', status: PD + ' (raag scale)', tempo: 76, time: [4, 4], key: 'C', scale: 'major', level: 2, tags: ['Indian'],
    mel: 'B3:1 D4 E4 F#4 | A4 B4 C5:2 | C5:1 B4 A4 G4 | F#4 E4 D4 C4',
    chords: 'C | C | C | C' },
  { id: 'sunny', title: 'Sunny Steps', by: 'Pocket Band (original)', status: 'Original, written for Pocket Band', tempo: 100, time: [4, 4], key: 'C', scale: 'major', level: 1, tags: ['Kids'],
    mel: 'C4:1 D4 E4 C4 | E4 F4 G4:2 | G4:1 A4 G4 F4 | E4:2 C4:2 | D4:1 D4 E4 C4 | D4:2 G3:2 | C4:1 D4 E4 F4 | E4 D4 C4:2',
    chords: 'C | C | C F | C | G C | G | C F | G C' },
  { id: 'fivefinger', title: 'Five Finger March', by: 'Pocket Band (original)', status: 'Original, written for Pocket Band', tempo: 96, time: [4, 4], key: 'C', scale: 'major', level: 1, tags: ['Kids'],
    mel: 'C4:1 E4 G4 E4 | F4 D4 E4:2 | E4:1 G4 F4 D4 | E4:2 C4:2 | G4:1 F4 E4 D4 | C4 D4 E4:2 | F4:1 E4 D4 G4 | C4:4',
    chords: 'C | G C | C G | C | C G | C | F G | C' },
  { id: 'waltz', title: 'Little Waltz', by: 'Pocket Band (original)', status: 'Original, written for Pocket Band', tempo: 120, time: [3, 4], key: 'G', scale: 'major', level: 1, tags: ['Kids', 'Classical'],
    mel: 'G4:2 B4:1 | D5:2 B4:1 | A4:2 F#4:1 | G4:3 | E4:2 G4:1 | B4:2 G4:1 | A4:1 B4 A4 | D4:3 | G4:2 B4:1 | D5:2 E5:1 | D5:1 C5 B4 | A4:3 | B4:1 A4 G4 | A4:2 F#4:1 | G4:3~ | G4:3',
    chords: 'G | G | D | G | C | G | D | D | G | G | G | D | G | D | G | G' },
  { id: 'rainy', title: 'Rainy Day Blues', by: 'Pocket Band (original)', status: 'Original, written for Pocket Band', tempo: 92, time: [4, 4], key: 'A', scale: 'blues', level: 2, tags: ['Folk'],
    mel: 'A4:1 C5 A4 D5 | D#5:0.5 E5 C5:1 A4:2 | A4:1 C5 A4 D5 | E5:1 G5:0.5 E5 D5:2 | D5:1 C5 A4 G4 | C5:1 D5 D#5:0.5 E5 C5:1 | E5:1 D5 C5 A4 | A4:4',
    chords: 'Am | Am | Am | Am | Dm | Dm | Em | Am' },
  { id: 'ragawalk', title: 'Morning Walk in Bhoopali', by: 'Pocket Band (original)', status: 'Original, written for Pocket Band', tempo: 88, time: [4, 4], key: 'C', scale: 'penta', level: 1, tags: ['Indian', 'Kids'],
    mel: 'C4:1 D4 E4:2 | D4:1 E4 G4:2 | A4:1 G4 E4 G4 | D4:4 | E4:1 G4 A4 C5 | A4 G4 E4:2 | D4:1 E4 D4 C4 | C4:4',
    chords: 'C | C | F C | G | C | F C | G | C' }
];

export function buildMelody(src) {
  const key = pitchClass(src.key), { notes, bars } = parseMelody(src.mel, src.time, src.id);
  const chords = src.chords ? src.chords.split('|').map((c) => c.trim()) : null;
  if (chords && chords.length !== bars) throw new Error(`${src.id}: ${chords.length} chord bars for ${bars} melody bars`);
  const t = {
    id: src.id, type: src.type || 'melody', title: src.title, by: src.by, src: /^Original/.test(src.status) ? 'Original' : 'Public domain',
    tempo: src.tempo, time: src.time, key: src.key, scale: scaleFor(notes, key, src.scale), level: src.level, tags: src.tags, bars, notes
  };
  if (chords) t.chords = chords;
  if (src.tags.includes('Indian')) t.sargam = sargamOf(notes, key);
  return t;
}

/* ---------------- Writing it out ---------------- */
const KIND = { melodies: 'Melodies (every melodic instrument)', chords: 'Chord songs (guitar and rhythm guitar)', bass: 'Bass lines (electric bass)',
  drums: 'Drum grooves (drums and electric drum pad)', tabla: 'Taals (tabla, dual and single)' };
const fmtLen = (t) => { const s = Math.round(t.bars * t.time[0] * 4 / t.time[1] * 60 / t.tempo); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function tracksMd(rows) {
  const out = ['# Songs: the free track library', '',
    'Every track the Songs button offers. All are free to use: either public domain (traditional, or by a composer who',
    'died long ago, with the source noted) or original, written for Pocket Band. There are no modern, film or copyrighted songs.',
    '"Needs ear check" marks a melody written down from memory that a musician should play through once to confirm.', '',
    'The tracks live in `tracks/*.json` and are generated by `node tools/make-tracks.mjs` from the note lists in that file;',
    'edit there and re-run it (it also rewrites this list). The service worker caches them, so they work offline.', '',
    '**Format.** Each track: `id`, `type`, `title`, `by` (composer or "Traditional"), `src` (Public domain or Original),',
    '`tempo` (beats a minute, a beat is a quarter note), `time` ([beats, unit]), `key`, `scale`, `level` (difficulty 1-3),',
    '`tags`, `bars`, and depending on the type: `notes` as `[startBeat, durationBeats, midi, velocity]`, `chords` (one',
    'string a bar, chords split across the bar by spaces), `strum` (down and up strokes), `hits` as `[startBeat, pad, velocity]`',
    'or `bols` (tabla strokes a beat), and `sargam` (Sa Re Ga labels for Indian melodies).', ''];
  for (const file of Object.keys(KIND)) {
    const list = rows.filter((r) => r.file === file);
    if (!list.length) continue;
    out.push('## ' + KIND[file], '', '| Track | By | Key | Time | Tempo | Length | Level | Tags | Source | Check |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const { t, s } of list) out.push(`| ${t.title} | ${t.by} | ${t.key}${t.scale === 'major' ? '' : ' ' + t.scale} | ${t.time.join('/')} | ${t.tempo} | ${fmtLen(t)} | ${'★'.repeat(t.level)} | ${t.tags.join(', ')} | ${s.status} | ${s.check ? 'Needs ear check' : ''} |`);
    out.push('');
  }
  return out.join('\n');
}

export const LIBRARY = { melodies: MELODIES };
export const BUILD = { melodies: buildMelody };
const SOURCES = { melodies: MELODIES };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = {}, rows = [];
  for (const [file, list] of Object.entries(SOURCES)) {
    out[file] = list.map((s) => BUILD[file](s));
    out[file].forEach((t, i) => rows.push({ t, s: list[i], file }));
    fs.writeFileSync(path.join(ROOT, 'tracks', file + '.json'), JSON.stringify(out[file]).replace(/\],\[/g, '],\n['));
  }
  const size = Object.keys(out).reduce((a, f) => a + fs.statSync(path.join(ROOT, 'tracks', f + '.json')).size, 0);
  fs.writeFileSync(path.join(ROOT, 'TRACKS.md'), tracksMd(rows));
  console.log(`${rows.length} tracks, ${(size / 1024).toFixed(1)} KB in tracks/; TRACKS.md written`);
}
