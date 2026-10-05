// test-report.html and the results section of TESTING.md, from the suite's result rows
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';
import { INSTRUMENTS } from './instruments.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nameOf = (tab) => (INSTRUMENTS.find((i) => i.tab === tab) || { name: tab }).name;

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
table { border-collapse: collapse; width: 100%; } td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
tr.ok td:first-child { color: var(--ok); font-weight: 700; } tr.bad td:first-child { color: var(--bad); font-weight: 700; }
tr.bad { background: color-mix(in srgb, var(--bad) 8%, transparent); } td:last-child { font-size: .9em; }
</style></head><body><h1>${esc(head)}</h1><div class="meta">${esc(meta)}</div>
<table><thead><tr><th>Result</th><th>Check</th><th>Instrument</th><th>Details</th></tr></thead><tbody>
${rowsHtml}
</tbody></table></body></html>`;
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
