#!/usr/bin/env node
// Pocket Band test suite: one command runs every check on every instrument in headless Chromium.
//   npm test                         everything (about 20-30 minutes; the pitch check is 12 keys x 10 scales)
//   npm run test:quick               the same checks with 3 keys x 4 scales for pitch (a few minutes)
//   node tests/run-all.mjs --only=pitch,strum --tabs=guitar,rhythm --workers=4
// Prints a PASS/FAIL table, writes test-report.html, updates the results section of TESTING.md and exits
// non-zero if anything failed.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ROOT, launch } from './live/harness.mjs';
import { startServer } from './live/server.mjs';
import { INSTRUMENTS } from './live/instruments.mjs';
import { writeReports } from './live/report.mjs';

const CHECKS = [
  ['load', 'Load, console, gallery and Home'],
  ['pitch', 'Pitch: 12 keys x every scale through the real controls'],
  ['loudness', 'Loudness and clipping'],
  ['stuck', 'Stuck notes: lift, cancel, tab switch, no fingers'],
  ['polyphony', 'Note limit and multi-touch (5 and 40 fingers)'],
  ['strum', 'Strumming at 4 strums a second'],
  ['bowing', 'Bowing across strings and double stops'],
  ['brass', 'Brass and reeds: brightness with breath, no crackle'],
  ['record', 'Record and playback'],
  ['songs', 'Songs: tracks, fitting, auto-play, Train me, stopping'],
  ['offline', 'Offline, manifest and service worker version'],
  ['perf', 'Performance: CPU per note and frame rate']
];

const arg = (k) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : null; };
const flag = (k) => process.argv.includes('--' + k);
const only = arg('only') ? arg('only').split(',') : null;
const tabs = arg('tabs') ? arg('tabs').split(',') : null;
const quick = flag('quick');
const workers = +(arg('workers') || Math.max(1, Math.min(4, os.cpus().length - 1)));

(async () => {
  const t0 = Date.now();
  const server = await startServer(ROOT);
  const browser = await launch();
  const env = {
    browser, base: server.url, workers, tabs, quick,
    keys: quick ? [0, 6, 9] : null, scales: quick ? ['major', 'minor', 'blues', 'chromatic'] : null,
    progress: (msg) => { if (!flag('quiet')) process.stdout.write(`  … ${msg}\n`); }
  };
  console.log(`Pocket Band tests: ${INSTRUMENTS.length} instruments, ${workers} parallel pages${quick ? ', quick mode' : ''}\n`);
  const results = [];
  for (const [id, title] of CHECKS) {
    if (only && !only.includes(id)) continue;
    const c0 = Date.now();
    console.log(`▶ ${title}`);
    let rows;
    try {
      const mod = await import(`./live/checks/${id}.mjs`);
      rows = await mod.default(env);
    } catch (e) {
      rows = [{ check: id, tab: '-', pass: false, detail: 'check crashed: ' + (e && e.stack || e).split('\n').slice(0, 3).join(' '), metrics: {} }];
    }
    rows.forEach((r) => { r.title = title; });
    results.push(...rows);
    const bad = rows.filter((r) => !r.pass).length;
    console.log(`  ${bad ? 'FAIL' : 'PASS'}  ${rows.length - bad}/${rows.length} in ${((Date.now() - c0) / 1000).toFixed(0)} s\n`);
  }
  await browser.close();
  await server.close();

  // The table
  const w = Math.max(...results.map((r) => r.tab.length), 10);
  console.log('Result  ' + 'Check'.padEnd(10) + ' ' + 'Instrument'.padEnd(w) + '  Details');
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}    ${r.check.padEnd(10)} ${r.tab.padEnd(w)}  ${r.detail}`);
  const failed = results.filter((r) => !r.pass);
  const secs = (Date.now() - t0) / 1000;
  console.log(`\n${failed.length ? 'FAILED' : 'ALL PASSED'}: ${results.length - failed.length} of ${results.length} passed in ${(secs / 60).toFixed(1)} minutes`);
  if (!flag('no-report')) {
    const files = writeReports(results, { secs, quick, partial: !!(only || tabs), workers });
    console.log('Report: ' + files.join(', '));
  }
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
