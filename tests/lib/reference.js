// Independent reference for the expected notes, written from the musical definitions rather than copied
// from the app, so a test failure means the app's pitches or labels are wrong.
'use strict';

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],            // natural minor (Aeolian)
  harmonic: [0, 2, 3, 5, 7, 8, 11],         // raised 7th
  melodic: [0, 2, 3, 5, 7, 9, 11],          // ascending melodic minor: raised 6th and 7th
  penta: [0, 2, 4, 7, 9],
  minpenta: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],               // minor pentatonic + flat 5
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};
const PARENT = { penta: 'major', minpenta: 'minor', blues: 'minor', chromatic: 'major' };
const SCALE_NAMES = Object.keys(SCALES);

const pc = (m) => ((m % 12) + 12) % 12;
const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);
const cents = (f, m) => 1200 * Math.log2(f / freq(m));

// count notes of the scale upward from root
function run(root, scale, count) {
  const s = SCALES[scale], out = [];
  for (let i = 0; i < count; i++) out.push(root + 12 * Math.floor(i / s.length) + s[i % s.length]);
  return out;
}

// Harmonica: Richter layout written as steps of a 7-note scale; other scales take the nearest scale note
// to the major step (lower note on a tie)
const HARP_BLOW = [0, 2, 4, 7, 9, 11, 14, 16, 18, 21];
const HARP_DRAW = [1, 4, 6, 8, 10, 12, 13, 15, 17, 19];
function seventh(scale, d) {
  const o = Math.floor(d / 7), i = d % 7, s = SCALES[scale];
  if (s.length === 7) return 12 * o + s[i];
  const want = SCALES.major[i];
  let best = null;
  for (let k = want - 12; k <= want + 12; k++) {
    if (!s.includes(pc(k))) continue;
    if (best === null || Math.abs(k - want) < Math.abs(best - want)) best = k;
  }
  return 12 * o + best;
}

// Tonic triad of a key + scale (seven-note scales; the rest use their parent scale)
function tonicTriad(key, scale) {
  const s = SCALES[scale].length === 7 ? SCALES[scale] : SCALES[PARENT[scale]];
  const third = s[2], fifth = s[4];
  const q = third === 4 ? (fifth === 8 ? '+' : '') : (fifth === 6 ? 'dim' : 'm');
  return { pcs: [pc(key), pc(key + third), pc(key + fifth)], root: pc(key), name: NAMES[pc(key)] + q };
}

module.exports = { NAMES, SCALES, SCALE_NAMES, pc, freq, cents, run, seventh, HARP_BLOW, HARP_DRAW, tonicTriad };
