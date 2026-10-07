// test-report.html and the results section of TESTING.md, from the suite's result rows
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';
import { INSTRUMENTS } from './instruments.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nameOf = (tab) => (INSTRUMENTS.find((i) => i.tab === tab) || { name: tab }).name;

// The Songs section: the songs check's rows grouped by part, each with what it proves
const SONG_PARTS = [
  ['tracks', /^track files/, 'Track files: every track has its tonic and mode, bars add up, all cached and listed in TRACKS.md'],
  ['fit', /^fit:/, 'Own key: a track opens in its tonic and mode and plays its written notes, moved by whole octaves only (the piano: exactly as stored)'],
  ['transpose', /^transpose:/, 'Transpose: every track in all 12 keys keeps its intervals and mode label; Transpose, Reset, Keep original and Remap'],
  ['autoplay', /^auto-play/, 'Auto-play rendered offline: every measured pitch within 5 cents of the expected note, in the own key and transposed +2'],
  ['timing', /^timing/, 'Live timing: auto-played notes sound on time and in tune'],
  ['train', /^train/, 'Train me (Wait) with real touches: the right target glows and is named, a wrong key shakes and waits, the right one moves on'],
  ['align', /^align/, 'Alignment: falling bars, glow and badges stay on their keys at five screen sizes'],
  ['stop', /^stop/, 'Stopping: nothing rings after Stop, close, Home or switching'],
  ['storage', /^storage/, 'Blocked storage: songs still open, train and score']
];
function songPart(r) {
  if (r.metrics && r.metrics.part) return r.metrics.part;
  const d = String(r.detail).replace(/^.*? · (?=(track files|fit:|transpose:|auto-play|timing|train|align|stop|storage))/, '');
  const hit = SONG_PARTS.find(([, re]) => re.test(d));
  return hit ? hit[0] : 'other';
}
function songsHtml(results) {
  const rows = results.filter((r) => r.check === 'songs');
  if (!rows.length) return '';
  const parts = SONG_PARTS.map(([id, , what]) => ({ id, what, rows: rows.filter((r) => songPart(r) === id) })).filter((p) => p.rows.length);
  const other = rows.filter((r) => !SONG_PARTS.some(([id]) => id === songPart(r)));
  if (other.length) parts.push({ id: 'other', what: 'Other songs rows', rows: other });
  const sum = parts.map((p) => { const bad = p.rows.filter((r) => !r.pass).length; return `<tr class="${bad ? 'bad' : 'ok'}"><td>${bad ? 'FAIL' : 'PASS'}</td><td>${esc(p.what)}</td><td>${p.rows.length - bad} of ${p.rows.length}</td></tr>`; }).join('\n');
  const detail = parts.map((p) => `<h3>${esc(p.what)}</h3><table><thead><tr><th>Result</th><th>Instrument</th><th>Details</th></tr></thead><tbody>` +
    p.rows.map((r) => `<tr class="${r.pass ? 'ok' : 'bad'}"><td>${r.pass ? 'PASS' : 'FAIL'}</td><td>${esc(r.tab === '-' ? 'all' : nameOf(r.tab))}</td><td>${esc(r.detail)}</td></tr>`).join('\n') + '</tbody></table>').join('\n');
  return `<h2 id="songs">Songs</h2><table><thead><tr><th>Result</th><th>Part</th><th>Rows passed</th></tr></thead><tbody>${sum}</tbody></table>\n${detail}`;
}

export function writeReports(results, info) {
  const when = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const failed = results.filter((r) => !r.pass).length;
  const version = (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/pocket-band-v(\d+)/) || [])[1];
  const head = `${failed ? 'FAILED' : 'All passed'}: ${results.length - failed} of ${results.length} checks passed`;
  const meta = `App v${version} · ${when} · ${(info.secs / 60).toFixed(1)} minutes · ${info.workers} parallel pages${info.quick ? ' · quick mode (3 keys x 4 scales for pitch)' : ''}${info.partial ? ' · partial run' : ''}`;

  // HTML report
  const rowsHtml = results.map((r) => `<tr class="${r.pass ? 'ok' : 'bad'}"><td>${r.pass ? 'PASS' : 'FAIL'}</td><td>${esc(r.title || r.check)}</td><td>${esc(r.tab === '-' ? 'all' : nameOf(r.tab))}</td><td>${esc(r.detail)}</td></tr>`).join('\n');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pocket Band test report</title><style>
:root { --bg: #f7f4ec; --ink: #1d2a2a; --ok: #1f7a4d; --bad: #b3261e; --line: #d9d2c0; }
@media (prefers-color-scheme: dark) { :root { --bg: #0f1818; --ink: #efe9da; --ok: #5ccf94; --bad: #ff8a80; --line: #33413f; } }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--ink); font: 14px/1.45 system-ui, sans-serif; }
h1 { font-size: 1.3rem; margin: 0 0 4px; } .meta { opacity: .75; margin-bottom: 14px; }
h2 { font-size: 1.15rem; margin: 28px 0 8px; } h3 { font-size: 1rem; margin: 18px 0 6px; }
table { border-collapse: collapse; width: 100%; } td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
tr.ok td:first-child { color: var(--ok); font-weight: 700; } tr.bad td:first-child { color: var(--bad); font-weight: 700; }
tr.bad { background: color-mix(in srgb, var(--bad) 8%, transparent); } td:last-child { font-size: .9em; }
</style></head><body><h1>${esc(head)}</h1><div class="meta">${esc(meta)}</div>
${results.some((r) => r.check === 'songs') ? '<p><a href="#songs">Songs section</a></p>' : ''}
<table><thead><tr><th>Result</th><th>Check</th><th>Instrument</th><th>Details</th></tr></thead><tbody>
${rowsHtml}
</tbody></table>
${songsHtml(results)}</body></html>`;
  const rep = path.join(ROOT, 'test-report.html');
  fs.writeFileSync(rep, html);

  // TESTING.md: replace the generated section between the markers
  const md = path.join(ROOT, 'TESTING.md');
  const table = ['| Result | Check | Instrument | Details |', '| --- | --- | --- | --- |']
    .concat(results.map((r) => `| ${r.pass ? 'PASS' : '**FAIL**'} | ${r.title || r.check} | ${r.tab === '-' ? 'all' : nameOf(r.tab)} | ${String(r.detail).replace(/\|/g, '/')} |`));
  const section = `<!-- RESULTS:START (written by tests/run-all.mjs) -->\n## Latest results\n\n**${head}.** ${meta}.\n\n${table.join('\n')}\n<!-- RESULTS:END -->`;
  let text = fs.existsSync(md) ? fs.readFileSync(md, 'utf8') : '# Testing\n';
  if (!info.partial) {
    if (/<!-- RESULTS:START[\s\S]*?RESULTS:END -->/.test(text)) text = text.replace(/<!-- RESULTS:START[\s\S]*?RESULTS:END -->/, section);
    else text = text.trimEnd() + '\n\n' + section + '\n';
    fs.writeFileSync(md, text);
    fs.writeFileSync(path.join(ROOT, 'tests', 'results', 'latest.json'), JSON.stringify({ when, version, quick: info.quick, results }, null, 1));
    return [rep, md];
  }
  return [rep];
}
