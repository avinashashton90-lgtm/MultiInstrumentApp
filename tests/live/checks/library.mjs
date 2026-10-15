// Check 13. The song library after round E: where every track comes from, and the features around it.
//   sources   every listed track is verified (converted from a score) or generated (built from a definition); none
//             typed from memory is shipped (they sit in tracks/unverified.json, hidden); every verified track has
//             its score and MIDI file in sources/, a free licence (public domain, CC BY, CC BY-SA, GPL, GFDL), a composer, a death
//             year (or none for anonymous and traditional), a URL and a conversion date; TRACKS.md lists every track
//             with its status and first 16 notes, and the tunes not found
//   verify    tools/verify-tracks.mjs --notes-only passes (every note against the source MIDI), and the MIDI core in
//             index.html is the one the tools run (tools/sync-core.mjs --check)
//   offer     each instrument's Songs sheet lists every verified song in its own version (the tune, chord song, bass
//             line, drum beat or tabla theka), Celebrate songs first, none unverified
//   credits   Settings > Credits names every verified track with its composer and licence
//   full      Easy plays the tune; Full adds the score's bass line: as notes to play on the piano, as backing on the flute
//   sections  the section menu offers the track's own 4-8 bar sections
//   report    Report a wrong note: tapping bar 2, beat 1 copies "id, bar 2, beat 1"
//   mysong    Add my song: a .mid file is read, its parts offered, converted, listed under My songs, kept after a reload
//             (IndexedDB), playable, and deleted again
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, openApp, sleep, openFromGallery } from '../harness.mjs';
import { row } from '../common.mjs';
import { TRACK_FILES, typeOf } from './songs.mjs';
import { INSTRUMENTS } from '../instruments.mjs';

const LICENCE = /^(Public Domain|Creative Commons Attribution(-ShareAlike)? [0-9.]+|GNU (General Public|Free Documentation) License [0-9.]+)$/;
const load = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'tracks', f + '.json'), 'utf8'));

function sourceRows() {
  const errs = [], all = [];
  TRACK_FILES.forEach((f) => load(f).forEach((t) => all.push(t)));
  const hidden = load('unverified');
  all.forEach((t) => {
    if (!['verified', 'generated'].includes(t.status)) errs.push(`${t.id}: status ${t.status} is shipped`);
    if (t.status !== 'verified') return;
    const c = t.credit || {};
    if (!c.composer || !('died' in c) || !LICENCE.test(c.licence || '') || !/^https:\/\//.test(c.url || '') || !/^\d{4}-\d\d-\d\d$/.test(c.converted || '')) errs.push(`${t.id}: incomplete credit`);
    if (!t.from || !fs.existsSync(path.join(ROOT, t.from.file))) errs.push(`${t.id}: source MIDI missing`);
    else if (!fs.readdirSync(path.dirname(path.join(ROOT, t.from.file))).some((f) => /\.(ly|abc|mxl|musicxml|xml)$/.test(f))) errs.push(`${t.id}: score files missing`);
  });
  hidden.forEach((t) => { if (t.status !== 'unverified' || !t.hidden) errs.push(`${t.id}: in unverified.json but not marked hidden`); });
  const md = fs.readFileSync(path.join(ROOT, 'TRACKS.md'), 'utf8');
  all.forEach((t) => { if (!md.includes(`| ${t.title} | ${t.status} |`)) errs.push(`TRACKS.md lacks ${t.id} with its status`); });
  if (!/## Not found/.test(md) || !/## Unverified \(hidden\)/.test(md)) errs.push('TRACKS.md lacks the Not found or Unverified sections');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  if (/unverified\.json/.test(sw)) errs.push('the service worker caches the hidden tracks');
  const v = all.filter((t) => t.status === 'verified').length;
  return [row('library', '-', !errs.length, (errs.length ? errs.slice(0, 6).join('; ') + ' · ' : '') +
    `sources: ${all.length} tracks shipped (${v} verified from scores, ${all.length - v} generated), ${hidden.length} unverified kept hidden; credits, MIDI and scores present; TRACKS.md complete`)];
}

function verifyRows() {
  const out = [];
  for (const [name, args] of [['verify', ['tools/verify-tracks.mjs', '--notes-only']], ['core', ['tools/sync-core.mjs', '--check']]]) {
    try { const txt = execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' }); out.push(row('library', '-', true, name + ': ' + txt.trim().split('\n').join(' · '))); }
    catch (e) { out.push(row('library', '-', false, name + ': ' + String(e.stdout || '') + String(e.stderr || e.message).slice(0, 400))); }
  }
  return out;
}

async function tapSel(page, touch, sel) {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const b = await page.locator(sel).first().boundingBox();
  await touch.tap(b.x + b.width / 2, b.y + b.height / 2, 40);
}
async function openWithHooks(browser, base, tab) {
  const cur = await openApp(browser, base, { tab: '' });
  await cur.page.addInitScript({ content: 'window.__PB_TEST__ = true;' });
  await cur.page.reload({ waitUntil: 'load' });
  await openFromGallery(cur.page, cur.touch, tab);
  return cur;
}

const PREFIX = { melody: '', chords: 'ch-', bass: 'bs-', drums: 'dr-', tabla: 'tl-' };
async function offerRows(browser, base) {
  const errs = [], counts = [], songs = load('melodies').filter((t) => t.status === 'verified');
  const cur = await openApp(browser, base, { tab: '' });
  const { page, touch } = cur;
  try {
    for (const it of INSTRUMENTS) {
      await openFromGallery(page, touch, it.tab);
      await tapSel(page, touch, '#songs');
      await page.waitForSelector('.sgitem');
      const ids = await page.evaluate(() => [...document.querySelectorAll('#sgList .sgitem')].map((li) => li.dataset.id));
      const want = songs.map((t) => PREFIX[typeOf(it.tab)] + t.id), lacks = want.filter((id) => !ids.includes(id));
      if (lacks.length) errs.push(`${it.tab}: lacks ${lacks.slice(0, 4).join(', ')}${lacks.length > 4 ? ' and ' + (lacks.length - 4) + ' more' : ''}`);
      if (ids[0] !== PREFIX[typeOf(it.tab)] + 'birthday') errs.push(`${it.tab}: the list starts with ${ids[0]}, not Happy Birthday`);
      if (ids.some((id) => /^uv-/.test(id))) errs.push(`${it.tab}: lists an unverified track`);
      counts.push(it.tab + ' ' + ids.length);
      await tapSel(page, touch, '#sgClose');
    }
  } catch (e) { errs.push(e.message.split('\n')[0]); }
  await cur.context.close();
  return [row('library', '-', !errs.length, (errs.length ? errs.join('; ') + ' · ' : '') + 'offer: ' + counts.join(', '))];
}

async function featureRows(browser, base) {
  const rows = [];
  const cur = await openWithHooks(browser, base, 'piano');
  const { page, touch, log, context } = cur;
  const step = async (name, fn) => { try { const d = await fn(); rows.push(row('library', 'piano', true, name + ': ' + d)); } catch (e) { rows.push(row('library', 'piano', false, name + ': ' + e.message.split('\n')[0])); } };
  try {
    await step('credits', async () => {
      await tapSel(page, touch, '#more');
      await tapSel(page, touch, '#credits');
      await page.waitForSelector('#credList li');
      const txt = await page.evaluate(() => document.getElementById('credList').textContent);
      const want = load('melodies').filter((t) => t.status === 'verified');
      const miss = want.filter((t) => !txt.includes(t.title) || !txt.includes(t.credit.licence));
      if (miss.length) throw new Error('credits lack ' + miss.map((t) => t.id).join(', '));
      await tapSel(page, touch, '#credClose');
      if (await page.evaluate(() => document.getElementById('panel').classList.contains('open'))) await tapSel(page, touch, '#more');
      return `${want.length} verified tracks credited with composer and licence`;
    });
    const tr = load('melodies').find((t) => t.id === 'twinkle');
    await tapSel(page, touch, '#songs');
    await page.waitForSelector('.sgitem[data-id="twinkle"]');
    await tapSel(page, touch, '.sgitem[data-id="twinkle"] [data-go="auto"]');
    await page.evaluate(() => window.PocketBandTest.songs.halt());
    await step('full', async () => {
      const easy = await page.evaluate(() => window.PocketBandTest.songs.state().plan.ev.length);
      if (easy !== tr.notes.length) throw new Error(`Easy has ${easy} events, the tune ${tr.notes.length} notes`);
      await tapSel(page, touch, '#sgMore'); await tapSel(page, touch, '#sgFull');
      const full = await page.evaluate(() => { const p = window.PocketBandTest.songs.state().plan; return { n: p.ev.length, low: p.ev.filter((e) => e.low).length, missing: p.missing }; });
      if (full.n !== tr.notes.length + tr.low.length || full.low !== tr.low.length) throw new Error(`Full has ${full.n} events (${full.low} bass), want ${tr.notes.length} + ${tr.low.length}`);
      if (full.missing) throw new Error(full.missing + ' Full notes have no key');
      await tapSel(page, touch, '#sgMore'); await tapSel(page, touch, '#sgFull'); // back to Easy
      return `Easy ${easy} notes; Full ${full.n} (tune and ${full.low} bass notes, every one on a key)`;
    });
    await step('sections', async () => {
      const opts = await page.evaluate(() => [...document.querySelectorAll('#sgSec option')].map((o) => o.textContent));
      const want = ['Whole song'].concat(tr.sections.map((s) => 'Bars ' + s[0] + '–' + s[1]));
      if (JSON.stringify(opts) !== JSON.stringify(want)) throw new Error(`menu ${opts.join(', ')}; want ${want.join(', ')}`);
      return opts.join(', ');
    });
    await step('report', async () => {
      await tapSel(page, touch, '#sgMore'); await tapSel(page, touch, '#sgReport');
      await page.waitForSelector('#repGrid [data-rep]');
      const bars = await page.evaluate(() => document.querySelectorAll('#repGrid .repbar').length);
      if (bars !== tr.bars) throw new Error(`${bars} bars shown, the song has ${tr.bars}`);
      await tapSel(page, touch, '#repGrid .repbar:nth-child(2) button:nth-of-type(1)');
      await page.waitForFunction(() => /twinkle, bar 2, beat 1/.test(document.getElementById('repMsg').textContent), null, { timeout: 3000 });
      const msg = await page.evaluate(() => document.getElementById('repMsg').textContent);
      await tapSel(page, touch, '#repClose');
      return msg;
    });
    await page.evaluate(() => window.PocketBandTest.songs.close());
    await step('flute full', async () => {
      await openFromGallery(page, touch, 'flute');
      const r = await page.evaluate((tr) => {
        const S = window.PocketBandTest.songs, t = S.all().find((x) => x.id === 'twinkle');
        S.state().full = true; S.open(t, 'auto'); S.halt();
        const p = S.state().plan, out = { ev: p.ev.length, tune: p.tune.length };
        S.state().full = false; S.close();
        return out;
      }, tr);
      if (r.ev !== tr.notes.length || r.tune !== tr.low.length) throw new Error(`flute Full: ${r.ev} events, ${r.tune} backing notes`);
      return `the flute plays the ${r.ev} tune notes and the ${r.tune} bass notes play as backing`;
    });
    await step('my song', async () => {
      await openFromGallery(page, touch, 'piano');
      await tapSel(page, touch, '#songs');
      await page.waitForSelector('.sgitem');
      await page.setInputFiles('#sgFile', path.join(ROOT, 'sources', 'minuet', 'minuet.mid'));
      await page.waitForSelector('#mySheet:not([hidden])');
      const parts = await page.evaluate(() => [...document.querySelectorAll('#myPart option')].map((o) => o.value));
      if (parts.length < 2) throw new Error('the parts are not offered: ' + parts.join(', '));
      await page.selectOption('#myPart', '1:0');
      await page.fill('#myName', 'Test minuet');
      await tapSel(page, touch, '#myOk');
      await page.waitForSelector('.sgitem[data-id^="my-"]');
      // The list shows the song before IndexedDB has stored it; on a fast machine a reload straight away can come first
      await page.waitForFunction(() => new Promise((ok) => {
        const r = indexedDB.open('pocketband-mysongs', 1);
        r.onsuccess = () => { const q = r.result.transaction('songs').objectStore('songs').count(); q.onsuccess = () => { ok(q.result === 1); r.result.close(); }; };
        r.onerror = () => ok(false);
      }), null, { timeout: 5000 });
      await page.reload({ waitUntil: 'load' });
      await openFromGallery(page, touch, 'violin');
      await tapSel(page, touch, '#songs');
      await page.waitForSelector('.sgitem[data-id^="my-"]', { timeout: 5000 });
      const my = await page.evaluate(() => { const t = window.PocketBandTest.songs.mine()[0]; return { id: t.id, title: t.title, n: t.notes.length, first: t.notes.slice(0, 4).map((n) => n[2]), tonic: t.tonic, mode: t.mode }; });
      const lib = load('melodies').find((t) => t.id === 'minuet');
      if (JSON.stringify(my.first) !== JSON.stringify(lib.notes.slice(0, 4).map((n) => n[2])) || my.tonic !== lib.tonic || my.mode !== lib.mode) throw new Error('the converted song differs from the library\'s Minuet: ' + JSON.stringify(my));
      await tapSel(page, touch, `.sgitem[data-id="${my.id}"] [data-go="auto"]`);
      await page.waitForFunction(() => window.PocketBandTest.songs.state().on);
      const ev = await page.evaluate(() => { const S = window.PocketBandTest.songs; const n = S.state().plan.ev.length; S.close(); return n; });
      await tapSel(page, touch, '#songs');
      await page.waitForSelector(`.sgitem[data-id="${my.id}"]`);
      await tapSel(page, touch, `.sgitem[data-id="${my.id}"] [data-go="del"]`);
      await page.waitForFunction(() => new Promise((ok) => { // the delete has reached IndexedDB
        const r = indexedDB.open('pocketband-mysongs', 1);
        r.onsuccess = () => { const q = r.result.transaction('songs').objectStore('songs').count(); q.onsuccess = () => { ok(q.result === 0); r.result.close(); }; };
        r.onerror = () => ok(false);
      }), null, { timeout: 5000 });
      await page.reload({ waitUntil: 'load' });
      await openFromGallery(page, touch, 'violin');
      await tapSel(page, touch, '#songs');
      await page.waitForSelector('.sgitem');
      if (await page.evaluate(() => !!document.querySelector('.sgitem[data-id^="my-"]'))) throw new Error('the deleted song came back after a reload');
      return `"${my.title}" converted (${my.n} notes, the same tune and key as the library's), kept over a reload, played (${ev} events), deleted`;
    });
    // (the web font can't load where the test machine has no internet; the app falls back to system fonts)
    log.errors = log.errors.filter((e) => !/fonts\.(googleapis|gstatic)\.com/.test(e));
    if (log.errors.length) rows.push(row('library', 'piano', false, 'console errors: ' + log.errors.slice(0, 3).join(' / ')));
  } catch (e) { rows.push(row('library', 'piano', false, 'features crashed: ' + e.message.split('\n')[0])); }
  await context.close();
  return rows;
}

export default async function library({ browser, base, progress }) {
  const rows = [...sourceRows(), ...verifyRows()];
  for (const [name, fn] of [['offer', () => offerRows(browser, base)], ['features', () => featureRows(browser, base)]]) {
    if (progress) progress('library: ' + name);
    try { rows.push(...await fn()); } catch (e) { rows.push(row('library', '-', false, name + ' crashed: ' + (e && e.stack || e).split('\n').slice(0, 3).join(' '))); }
  }
  return rows;
}
