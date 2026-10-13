#!/usr/bin/env node
// Copies the web app into www/ for the Android build (Capacitor bundles www/ inside the APK).
// The GitHub Pages site is served from the repository root and is not touched.
// sw.js is left out on purpose: the native app loads every file from inside the APK, so it needs no service worker.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'www');
const FILES = ['index.html', 'selftest.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];
const DIRS = ['tracks', 'assets'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const f of FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) { console.error(`copy-web: missing ${f}`); process.exit(1); }
  fs.copyFileSync(src, path.join(OUT, f)); n++;
}
for (const d of DIRS) {
  const src = path.join(ROOT, d);
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, path.join(OUT, d), { recursive: true });
  n += fs.readdirSync(src, { recursive: true }).length;
}
console.log(`copy-web: copied ${n} files into www/`);
