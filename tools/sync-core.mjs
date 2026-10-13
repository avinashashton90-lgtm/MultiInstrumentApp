#!/usr/bin/env node
// Pastes tools/lib/midi-core.js (the MIDI reader and converter) into index.html between the MIDI-CORE markers, so the
// app's "Add my song" runs exactly the code the library build runs. --check only compares (the test suite runs it).
//   node tools/sync-core.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = '// MIDI-CORE-BEGIN', E = '// MIDI-CORE-END';
const core = fs.readFileSync(path.join(ROOT, 'tools', 'lib', 'midi-core.js'), 'utf8');
const block = core.slice(core.indexOf(B), core.indexOf(E) + E.length).split('\n').map((l) => (l.trim() ? '  ' + l : l)).join('\n');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const a = html.indexOf('  ' + B), b = html.indexOf(E, a) + E.length;
if (a < 0 || b < E.length) { console.error('index.html has no MIDI-CORE markers'); process.exit(1); }
const now = html.slice(a, b);
if (process.argv.includes('--check')) {
  if (now !== block) { console.error('index.html\'s MIDI core differs from tools/lib/midi-core.js: run node tools/sync-core.mjs'); process.exit(1); }
  console.log('MIDI core in index.html matches tools/lib/midi-core.js');
} else if (now !== block) {
  fs.writeFileSync(path.join(ROOT, 'index.html'), html.slice(0, a) + block + html.slice(b));
  console.log('index.html updated');
} else console.log('index.html already up to date');
