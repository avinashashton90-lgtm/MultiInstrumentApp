// Check 12. Songs: the free track library, Auto-play and Train me.
//   tracks    every track file validates: fields, every bar adds up, no overlapping notes beyond what the instrument
//             can play at once, the length matches its bars, tempo and key are sane, TRACKS.md lists it
//   fit       every track that suits an instrument fits it: each note has a key, hole, cell or spot to play it on
//             after the track is moved to the instrument's key, scale and octave (and enough fit without moving a note)
//   autoplay  a sample track rendered offline through the instrument's own sound: every note within 5 cents of the
//             note it should be (the track moved to the instrument's key), measured from the audio
//   timing    the same, played live on the real audio clock: each note sounds at the time the song says
//   train     Train me (Wait) through the real Songs sheet: for every note the right target glows with the right name,
//             touching it plays that note (measured from the audio) and the song moves on; the score is kept
//   stop      nothing is left ringing after Stop, Home or switching instruments in the middle of a song
//   storage   with storage blocked the songs still open, play and score
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, openApp, sleep, nowFrame, stats, playAndMeasure, waitAudio, openFromGallery } from '../harness.mjs';
import { INSTRUMENTS } from '../instruments.mjs';
import { NAMES, pc, midiOf, row, pool, dryReverb, setToggle } from '../common.mjs';

export const TRACK_FILES = ['melodies'];
export const TAGS = ['Kids', 'Classical', 'Folk', 'Indian', 'Hymn'];
const SCALES = ['major', 'minor', 'harmonic', 'melodic', 'penta', 'minpenta', 'blues', 'dorian', 'mixolydian', 'chromatic'];
const SCALE_IV = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], melodic: [0, 2, 3, 5, 7, 9, 11],
  penta: [0, 2, 4, 7, 9], minpenta: [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10], chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};
// Which tracks go with which instrument (the same rule the Songs sheet uses)
export const TYPE_OF = { guitar: 'chords', rhythm: 'chords', ebass: 'bass', drums: 'drums', epad: 'drums', tabla1: 'tabla', tabla2: 'tabla' };
export const MELODIC = INSTRUMENTS.filter((i) => i.pitched && !TYPE_OF[i.tab]);
const MONO = ['flute', 'horn', 'trumpet', 'sax']; // one note at a time
const SAMPLE = 'twinkle';

const keyPc = (k) => ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[k[0]] + (k[1] === '#' ? 1 : k[1] === 'b' ? -1 : 0) + 12) % 12;
const bpb = (t) => t.time[0] * 4 / t.time[1];
export function loadTracks() {
  const out = [];
  for (const f of TRACK_FILES) out.push(...JSON.parse(fs.readFileSync(path.join(ROOT, 'tracks', f + '.json'), 'utf8')).map((t) => ({ ...t, file: f })));
  return out;
}
const CHORD = /^[A-G](#|b)?(m|maj7|m7|7|dim|\+|aug|sus4)?$/;

// Most notes sounding at once
function polyphony(notes) {
  const ev = [];
  notes.forEach((n) => { ev.push([n[0], 1]); ev.push([n[0] + n[1], -1]); });
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0, max = 0;
  for (const e of ev) { cur += e[1]; max = Math.max(max, cur); }
  return max;
}

export function validateTrack(t) {
  const e = [], per = t.time && bpb(t);
  if (!t.id || !t.title || !t.by) e.push('missing id, title or composer');
  if (!['Public domain', 'Original'].includes(t.src)) e.push('source must be Public domain or Original');
  if (!(t.tempo >= 40 && t.tempo <= 220)) e.push('tempo ' + t.tempo + ' outside 40-220');
  if (!Array.isArray(t.time) || ![2, 3, 4, 5, 6, 7].includes(t.time[0]) || ![2, 4, 8].includes(t.time[1])) e.push('bad time signature');
  if (![1, 2, 3].includes(t.level)) e.push('difficulty must be 1-3');
  if (!t.tags || !t.tags.length || t.tags.some((g) => !TAGS.includes(g))) e.push('tags must come from ' + TAGS.join(', '));
  if (!(t.bars >= 1)) e.push('no bars');
  if (!/^[A-G](#|b)?$/.test(t.key || '')) e.push('bad key ' + t.key);
  if (!SCALES.includes(t.scale)) e.push('bad scale ' + t.scale);
  if (t.chords) {
    if (t.chords.length !== t.bars) e.push(`${t.chords.length} chord bars for ${t.bars} bars`);
    t.chords.forEach((c, i) => c.split(/\s+/).filter((x) => x && x !== '-').forEach((s) => { if (!CHORD.test(s)) e.push(`bar ${i + 1}: bad chord ${s}`); }));
  }
  if (t.type === 'melody' || t.type === 'bass') {
    const len = t.bars * per;
    if (!t.notes || !t.notes.length) e.push('no notes');
    else {
      let prev = -1;
      t.notes.forEach((n, i) => {
        if (n.length !== 4) e.push(`note ${i + 1}: needs [start, length, midi, velocity]`);
        if (n[0] < prev) e.push(`note ${i + 1}: out of order`);
        prev = n[0];
        if (!(n[1] > 0)) e.push(`note ${i + 1}: length ${n[1]}`);
        if (!(Number.isInteger(n[2]) && n[2] >= 21 && n[2] <= 108)) e.push(`note ${i + 1}: MIDI ${n[2]}`);
        if (!(n[3] >= 1 && n[3] <= 127)) e.push(`note ${i + 1}: velocity ${n[3]}`);
        if (!SCALE_IV[t.scale].includes(((n[2] - keyPc(t.key)) % 12 + 12) % 12)) e.push(`note ${i + 1}: ${NAMES[pc(n[2])]} is not in ${t.key} ${t.scale}`);
      });
      const end = Math.max(...t.notes.map((n) => n[0] + n[1]));
      if (end > len + 1e-6) e.push(`notes run to beat ${end}, past the ${t.bars} bars (${len} beats)`);
      if (end <= len - per + 1e-6) e.push(`the last bar is empty (notes end at beat ${end} of ${len})`);
      const poly = polyphony(t.notes);
      if (poly > 1) e.push(`${poly} notes at once: a melody or bass line plays one at a time (flute, horn, trumpet and sax can't play more)`);
    }
    if (t.sargam && t.sargam.length !== t.notes.length) e.push('sargam labels do not match the notes');
  }
  return e;
}

/* tracks: the files themselves */
function trackRows() {
  const rows = [];
  let all;
  try { all = loadTracks(); } catch (err) { return [row('songs', '-', false, 'track files: ' + err.message)]; }
  const bad = [], ids = new Set(), md = fs.existsSync(path.join(ROOT, 'TRACKS.md')) ? fs.readFileSync(path.join(ROOT, 'TRACKS.md'), 'utf8') : '';
  for (const t of all) {
    const e = validateTrack(t);
    if (ids.has(t.id)) e.push('duplicate id');
    ids.add(t.id);
    if (!md.includes(t.title)) e.push('not listed in TRACKS.md');
    if (e.length) bad.push(`${t.id}: ${e.slice(0, 2).join('; ')}`);
  }
  const size = TRACK_FILES.reduce((a, f) => a + fs.statSync(path.join(ROOT, 'tracks', f + '.json')).size, 0);
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), notCached = TRACK_FILES.filter((f) => !sw.includes(`tracks/${f}.json`));
  const byType = {};
  all.forEach((t) => { byType[t.type] = (byType[t.type] || 0) + 1; });
  rows.push(row('songs', '-', !bad.length && size < 2 * 1024 * 1024 && !notCached.length,
    (bad.length ? bad.slice(0, 4).join(' | ') + ' · ' : '') + `track files: ${all.length} tracks (${Object.entries(byType).map(([k, v]) => v + ' ' + k).join(', ')}), ` +
    `${(size / 1024).toFixed(1)} KB` + (notCached.length ? `; not cached by the service worker: ${notCached.join(', ')}` : ', all cached by the service worker') +
    (bad.length ? '' : '; every bar adds up, no overlaps, lengths, tempos and keys valid, all listed in TRACKS.md'),
    { tracks: all.length, kb: +(size / 1024).toFixed(1), bad: bad.length }));
  return rows;
}

// Opens the app with the test hooks on (window.PocketBandTest)
const HOOKS = 'window.__PB_TEST__ = true;';
async function openWithHooks(browser, base, tab, extra) {
  const cur = await openApp(browser, base, { tab });
  await cur.page.addInitScript({ content: HOOKS + (extra || '') });
  await cur.page.reload({ waitUntil: 'load' });
  await cur.page.waitForFunction(() => window.PocketBandTest);
  // with storage blocked the app can't remember the instrument and starts at Home
  if (await cur.page.evaluate(() => document.body.dataset.screen) !== 'play') await openFromGallery(cur.page, cur.touch, tab);
  return cur;
}

/* fit: every suitable track on every instrument */
async function fitRows(browser, base, workers, tabs) {
  const list = MELODIC.filter((i) => (!tabs || tabs.includes(i.tab)));
  const tasks = list.map((ins) => ({
    tab: ins.tab, check: 'songs', fresh: true,
    run: async () => {
      const cur = await openWithHooks(browser, base, ins.tab);
      try {
        const r = await cur.page.evaluate(async (tab) => {
          const P = window.PocketBandTest, S = P.songs, lib = await S.load(), out = [];
          for (const tr of lib.filter((t) => S.suits(t, tab))) {
            S.open(tr, 'train', 'wait');
            const plan = S.state().plan;
            out.push({ id: tr.id, n: plan.ev.length, missing: plan.missing, moved: plan.moved,
              inKey: plan.ev.every((e) => e.k !== 'note' || ((e.m - P.TONAL[tab].key) % 12 + 12) % 12 === ((tr.notes[e.i][2] - ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[tr.key[0]] + (tr.key[1] === '#' ? 1 : tr.key[1] === 'b' ? -1 : 0))) % 12 + 12) % 12) });
            S.close();
          }
          return out;
        }, ins.tab);
        const missing = r.filter((x) => x.missing), offKey = r.filter((x) => !x.inKey), full = r.filter((x) => !x.moved && !x.missing);
        const need = TYPE_OF[ins.tab] ? 8 : 8;
        const ok = r.length >= need && !missing.length && !offKey.length && full.length >= Math.min(5, r.length);
        return row('songs', ins.tab, ok,
          `fit: ${r.length} tracks, ${full.length} fit without moving a note, ${r.length - full.length - missing.length} with notes moved an octave` +
          (missing.length ? `; notes with nowhere to play: ${missing.slice(0, 3).map((x) => x.id + ' (' + x.missing + ')').join(', ')}` : ', every note has a place to play') +
          (offKey.length ? `; not in the instrument's key: ${offKey.map((x) => x.id).join(', ')}` : '') + (r.length < need ? `; fewer than ${need} tracks` : ''),
          { tracks: r.length, full: full.length, missing: missing.length });
      } finally { await cur.context.close(); }
    }
  }));
  return pool(browser, base, tasks, workers);
}

// Runs in the page before the app: an OfflineAudioContext in place of the real one (from the self-test page), so a
// song can be rendered faster than real time with every event at its exact moment
const OFFLINE = `window.__pbSeconds = 3; window.__pbSeed = 1;
(function () { var Off = window.OfflineAudioContext, s = 1;
  Math.random = function () { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  function Fake() { s = window.__pbSeed | 0; var c = new Off(2, Math.ceil(window.__pbSeconds * 48000), 48000); c.resume = function () { return Promise.resolve(); }; window.__pbCtx = c; return c; }
  window.AudioContext = Fake; window.webkitAudioContext = Fake;
  window.__pbRender = function (steps) { var c = window.__pbCtx, q = 128 / 48000, groups = {};
    steps.forEach(function (st) { var k = Math.round(st[0] / q); (groups[k] = groups[k] || []).push(st[1]); });
    Object.keys(groups).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) {
      if (k === 0) { groups[k].forEach(function (f) { f(); }); return; }
      c.suspend(k * q).then(function () { groups[k].forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); return Off.prototype.resume.call(c); }); });
    return c.startRendering(); };
})();`;

/* autoplay: rendered offline */
async function autoplayRows(browser, base, workers, tabs) {
  const tracks = loadTracks(), tr = tracks.find((t) => t.id === SAMPLE);
  const list = MELODIC.filter((i) => !tabs || tabs.includes(i.tab));
  const tasks = list.map((ins) => ({
    tab: ins.tab, check: 'songs', fresh: true,
    run: async () => {
      const cur = await openWithHooks(browser, base, ins.tab, OFFLINE);
      try {
        const r = await cur.page.evaluate(async ({ tab, id, win }) => {
          const P = window.PocketBandTest, S = P.songs, lib = await S.load(), tr = lib.find((t) => t.id === id), PRE = 0.3;
          for (const el of ['rev', 'irev']) { const x = document.getElementById(el); x.value = 0; x.dispatchEvent(new Event('input')); }
          P.bw.vib = false; P.sx.vib = false;
          S.state().count = false;
          window.__pbSeconds = PRE + tr.bars * tr.time[0] * 4 / tr.time[1] * 60 / tr.tempo + 2; // a context long enough for the whole song
          P.init(); P.setVolume(1);
          S.open(tr, 'auto'); S.halt();
          const sg = S.state(), spb = S.spb(), ev = sg.plan.ev, key = P.TONAL[tab].key;
          const steps = ev.map((e) => [PRE + e.b * spb, () => S.fire(e, PRE + e.b * spb)]);
          const buf = await window.__pbRender(steps), x = buf.getChannelData(0), y = buf.getChannelData(1), m = new Float32Array(x.length);
          for (let i = 0; i < x.length; i++) m[i] = 0.5 * (x[i] + y[i]);
          let peak = 0; for (let i = 0; i < m.length; i++) peak = Math.max(peak, Math.abs(m[i]));
          return { key, peak, notes: ev.map((e) => {
            const a = Math.round((PRE + e.b * spb + Math.min(Math.max(win[0] / 1000, e.d * spb * 0.25), 0.25)) * 48000), b = Math.round((PRE + e.b * spb + Math.max(win[1] / 1000, Math.min(e.d * spb * 0.85, 0.6))) * 48000); // most of the note
            // the mean of the middle two of four stretches of the note: detuned copies (the bowed strings' chorus) beat slowly, and
            // one stretch can catch them leaning sharp or flat
            const fs = [];
            for (let k = 0; k < 4; k++) { const p = PBA.pitch(m, 48000, Math.round(a + k * (b - a) / 4), Math.round(a + (k + 1) * (b - a) / 4), 50, 2600); if (p.f > 0) fs.push(Math.log2(p.f)); }
            return { i: e.i, want: e.m, f: fs.length ? Math.pow(2, fs.sort((x, y) => x - y).slice(fs.length > 2 ? 1 : 0, fs.length > 2 ? -1 : undefined).reduce((x, y, _, l) => x + y / l.length, 0)) : 0, orig: tr.notes[e.i][2] };
          }), trKey: tr.key };
        }, { tab: ins.tab, id: SAMPLE, win: ins.win });
        const shift = ((r.key - keyPc(r.trKey)) % 12 + 12) % 12, errs = [];
        let worst = 0;
        r.notes.forEach((n) => {
          if (pc(n.orig + shift) !== pc(n.want)) errs.push(`note ${n.i + 1}: plans ${NAMES[pc(n.want)]}, the key says ${NAMES[pc(n.orig + shift)]}`);
          if (!(n.f > 0)) { errs.push(`note ${n.i + 1}: no pitch`); return; }
          const c = 100 * (midiOf(n.f) - n.want);
          worst = Math.max(worst, Math.abs(c));
          if (Math.abs(c) > 5) errs.push(`note ${n.i + 1} (${NAMES[pc(n.want)]}): ${c.toFixed(1)} cents`);
        });
        if (20 * Math.log10(r.peak) > -0.5) errs.push(`peak ${(20 * Math.log10(r.peak)).toFixed(1)} dBFS`);
        return row('songs', ins.tab, !errs.length, (errs.length ? errs.slice(0, 3).join('; ') + ' · ' : '') +
          `auto-play (offline render of "${tr.title}" in ${NAMES[r.key]}): ${r.notes.length} notes, worst ${worst.toFixed(1)} cents, peak ${(20 * Math.log10(r.peak)).toFixed(1)} dBFS`,
          { notes: r.notes.length, worstCents: +worst.toFixed(2) });
      } finally { await cur.context.close(); }
    }
  }));
  return pool(browser, base, tasks, workers);
}

/* timing: live on the audio clock */
async function timingRows(browser, base, tabs) {
  const rows = [];
  for (const tab of ['piano', 'xylo'].filter((t) => !tabs || tabs.includes(t))) {
    const ins = INSTRUMENTS.find((i) => i.tab === tab);
    const cur = await openWithHooks(browser, base, tab);
    const { page, touch } = cur;
    try {
      await dryReverb(page);
      await tapSel(page, touch, '#songs');
      await page.waitForSelector('.sgitem');
      await setCount(page, false);
      await tapSel(page, touch, `.sgitem[data-id="${SAMPLE}"] [data-go="auto"]`);
      await waitAudio(page);
      const info = await page.evaluate(() => { const sg = window.PocketBandTest.songs.state(); return { t: sg.anchor.time, b: sg.anchor.beat, spb: window.PocketBandTest.songs.spb(), sr: window.__rec.sr, ev: sg.plan.ev.slice(0, 14).map((e) => ({ b: e.b, m: e.m, d: e.d })) }; });
      const last = info.ev[info.ev.length - 1], endF = Math.round((info.t + (last.b - info.b) * info.spb + 0.4) * info.sr);
      await page.waitForFunction((f) => window.__rec.last() >= f, endF, { timeout: 20000, polling: 50 });
      const res = await page.evaluate(({ info, win }) => info.ev.map((e) => {
        const R = window.__rec, t = info.t + (e.b - info.b) * info.spb, f0 = Math.round((t + win[0] / 1000) * info.sr), f1 = Math.round((t + Math.min(win[1] / 1000, e.d * info.spb * 0.9)) * info.sr);
        const x = R.get(f0, f1), p = PBA.pitch(x, info.sr, 0, x.length, 50, 4200);
        // onset: the first 2 ms block after the note's time that rises 10 dB over the block before the note
        const pre = R.get(Math.round((t - 0.012) * info.sr), Math.round((t - 0.002) * info.sr)), post = R.get(Math.round((t - 0.008) * info.sr), Math.round((t + 0.08) * info.sr));
        let base = 0; for (const v of pre) base += v * v; base = Math.sqrt(base / pre.length) + 1e-5;
        const B = Math.round(0.002 * info.sr); let onset = null;
        for (let k = 0; k + B <= post.length; k += B) { let s = 0; for (let j = k; j < k + B; j++) s += post[j] * post[j]; if (Math.sqrt(s / B) > base * 3.2) { onset = (k / info.sr - 0.008) * 1000; break; } }
        return { m: e.m, f: p.f, onset };
      }), { info, win: ins.win });
      const errs = [];
      let worstC = 0, worstT = 0;
      res.forEach((r, i) => {
        if (!(r.f > 0)) { errs.push(`note ${i + 1}: nothing heard at its time`); return; }
        const c = 100 * (midiOf(r.f) - r.m); worstC = Math.max(worstC, Math.abs(c));
        if (Math.abs(c) > 5) errs.push(`note ${i + 1}: ${c.toFixed(0)} cents off ${NAMES[pc(r.m)]}`);
        if (r.onset === null || Math.abs(r.onset) > 20) errs.push(`note ${i + 1}: starts ${r.onset === null ? '?' : r.onset.toFixed(1)} ms from its time`);
        else worstT = Math.max(worstT, Math.abs(r.onset));
      });
      rows.push(row('songs', tab, !errs.length, (errs.length ? errs.slice(0, 3).join('; ') + ' · ' : '') +
        `timing (live): ${res.length} auto-played notes each sound at their time (worst ${worstT.toFixed(1)} ms) and pitch (worst ${worstC.toFixed(1)} cents)`, { worstMs: +worstT.toFixed(1) }));
    } catch (e) { rows.push(row('songs', tab, false, 'timing: ' + e.message.split('\n')[0])); }
    await cur.context.close();
  }
  return rows;
}

async function tapSel(page, touch, sel) {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const b = await page.locator(sel).first().boundingBox();
  await touch.tap(b.x + b.width / 2, b.y + b.height / 2, 40);
}
async function setCount(page, on) { await page.evaluate((on) => { const sg = window.PocketBandTest && window.PocketBandTest.songs.state(); if (sg) sg.count = on; }, on); }

// Where the glowing target is: a key, hole, cell or bar, or the dot on a fingerboard
function glowNow() {
  const el = document.querySelector('.stage .sgnext'), dot = document.querySelector('.sgdot.show.next'), tag = document.querySelector('.sgtag.show');
  const t = el || dot;
  if (!t) return null;
  const r = t.getBoundingClientRect(), key = el && (el.classList.contains('key') || el.classList.contains('bkey'));
  return { x: r.left + r.width / 2, y: r.top + r.height * (key ? (el.classList.contains('bkey') ? 0.6 : 0.8) : 0.5), label: tag ? tag.textContent : '', n: document.querySelectorAll('.stage .sgnext').length + (dot ? 1 : 0),
    pos: document.getElementById('sgPos').textContent, wi: window.PocketBandTest.songs.state().wEv ? window.PocketBandTest.songs.state().wEv.i : -1 };
}
const labelPc = (s) => { const m = /^([A-G])([♯♭]?)/.exec(s); return m ? (NAMES.indexOf(m[1] + m[2]) + 12) % 12 : -1; };

/* train: through the real sheet and real touches */
async function trainRows(browser, base, workers, tabs) {
  const tr = loadTracks().find((t) => t.id === SAMPLE);
  const list = MELODIC.filter((i) => !tabs || tabs.includes(i.tab));
  const tasks = list.map((ins) => ({
    tab: ins.tab, check: 'songs', fresh: true,
    run: async () => {
      const cur = await openWithHooks(browser, base, ins.tab);
      const { page, touch } = cur, errs = [];
      try {
        await dryReverb(page);
        await setToggle(page, touch, 'bvib', false); await setToggle(page, touch, 'sxvib', false);
        await tapSel(page, touch, '#songs');
        await page.waitForSelector(`.sgitem[data-id="${SAMPLE}"]`);
        await tapSel(page, touch, `.sgitem[data-id="${SAMPLE}"] [data-go="train"]`);
        await page.waitForFunction(() => document.querySelector('.stage .sgnext, .sgdot.show.next'));
        const key = +(await page.evaluate(() => document.getElementById('key').value));
        const shift = ((key - keyPc(tr.key)) % 12 + 12) % 12;
        let done = 0, worst = 0;
        for (let i = 0; i < tr.notes.length; i++) {
          const g = await page.evaluate(glowNow);
          if (!g) { errs.push(`note ${i + 1}: nothing glows`); break; }
          const want = pc(tr.notes[i][2] + shift);
          if (g.wi !== i) { errs.push(`note ${i + 1}: the song is on note ${g.wi + 1}`); break; }
          if (labelPc(g.label) !== want) errs.push(`note ${i + 1}: labelled ${g.label}, expected ${NAMES[want]}`);
          const [m] = await playAndMeasure(page, touch, [g], { hold: ins.win[1] + 15, gap: 40, win: ins.win, fmax: ins.tab === 'xylo' ? 4200 : 2600 });
          if (!(m.f > 0)) errs.push(`note ${i + 1}: touching the glowing target made no sound`);
          else {
            const got = midiOf(m.f), c = 100 * (got - Math.round(got));
            worst = Math.max(worst, Math.abs(c));
            if (pc(Math.round(got)) !== want) errs.push(`note ${i + 1}: the glowing target plays ${NAMES[pc(Math.round(got))]}, expected ${NAMES[want]}`);
          }
          await sleep(60);
          done++;
          if (errs.length > 3) break;
        }
        const end = await page.evaluate(() => ({ res: document.getElementById('sgResult').textContent, best: (() => { try { return localStorage.getItem('pb-songs'); } catch (e) { return null; } })(), on: window.PocketBandTest.songs.state().on }));
        if (!errs.length && !/★★★/.test(end.res)) errs.push(`finished without three stars ("${end.res}")`);
        if (!errs.length && !(end.best || '').includes(SAMPLE + '|' + ins.tab + '|wait')) errs.push('best score not saved');
        return row('songs', ins.tab, !errs.length, (errs.length ? errs.slice(0, 3).join('; ') + ' · ' : '') +
          `train (Wait): ${done} of ${tr.notes.length} notes: the right target glowed and named, touching it played that note (worst ${worst.toFixed(1)} cents), ` +
          `the song moved on; finished with ${end.res || 'no score'}, best score saved`, { notes: done });
      } catch (e) { return row('songs', ins.tab, false, 'train: ' + e.message.split('\n')[0]); } finally { await cur.context.close(); }
    }
  }));
  return pool(browser, base, tasks, workers);
}

/* stop: Stop, Home and switching all leave silence */
async function stopRows(browser, base, workers, tabs) {
  const list = MELODIC.filter((i) => !tabs || tabs.includes(i.tab));
  const tasks = list.map((ins) => ({
    tab: ins.tab, check: 'songs', fresh: true,
    run: async () => {
      const cur = await openWithHooks(browser, base, ins.tab);
      const { page, touch } = cur, res = {};
      try {
        await dryReverb(page);
        const sr = await page.evaluate(() => { window.PocketBandTest.init(); return window.PocketBandTest.ctx().sampleRate; });
        const start = async () => {
          if (await page.evaluate(() => document.body.dataset.screen) !== 'play') await openFromGallery(page, touch, ins.tab);
          await dryReverb(page);
          await tapSel(page, touch, '#songs');
          await page.waitForSelector('.sgitem[data-id="ode"]');
          await setCount(page, false);
          await tapSel(page, touch, '.sgitem[data-id="ode"] [data-go="auto"]');
          await sleep(1800);
        };
        const ways = {
          Stop: () => tapSel(page, touch, '#sgStop'),
          'close the song': () => tapSel(page, touch, '#sgX'),
          Home: () => tapSel(page, touch, '#home'),
          'switch instrument': async () => { await tapSel(page, touch, '#home'); await openFromGallery(page, touch, ins.tab === 'piano' ? 'organ' : 'piano'); }
        };
        for (const [way, fn] of Object.entries(ways)) {
          await start();
          const during = await page.evaluate(() => window.__pbStats().voices);
          const f0 = await nowFrame(page);
          await fn();
          await sleep(1300);
          const s = await stats(page, f0 + Math.round(1.0 * sr), f0 + Math.round(1.25 * sr));
          const v = await page.evaluate(() => window.__pbStats().voices);
          res[way] = { after: Math.max(...s.frames), voices: v, during };
        }
        const bad = Object.entries(res).filter(([, r]) => r.after > -60 || r.voices > 0), silent = Object.entries(res).filter(([, r]) => !r.during);
        return row('songs', ins.tab, !bad.length && !silent.length,
          (silent.length ? `nothing was playing before ${silent.map(([w]) => w).join(', ')}; ` : '') +
          (bad.length ? bad.map(([w, r]) => `${w}: ${r.after.toFixed(0)} dBFS, ${r.voices} voices after 1 s`).join('; ')
            : 'stop: silent within 1 s, no voices left after ' + Object.keys(res).join(', ')),
          Object.fromEntries(Object.entries(res).map(([w, r]) => [w, +r.after.toFixed(1)])));
      } catch (e) { return row('songs', ins.tab, false, 'stop: ' + e.message.split('\n')[0]); } finally { await cur.context.close(); }
    }
  }));
  return pool(browser, base, tasks, workers);
}

/* storage: blocked storage must not break anything */
async function storageRows(browser, base) {
  const BLOCK = `(function () { var thrower = function () { throw new DOMException('blocked', 'SecurityError'); };
    try { Object.defineProperty(window, 'localStorage', { configurable: true, get: thrower }); } catch (e) {} })();`;
  const cur = await openWithHooks(browser, base, 'flute', BLOCK);
  const { page, touch, log } = cur, errs = [];
  try {
    await tapSel(page, touch, '#songs');
    await page.waitForSelector('.sgitem[data-id="mary"]');
    await tapSel(page, touch, '.sgitem[data-id="mary"] [data-go="train"]');
    for (let i = 0; i < 26; i++) {
      const g = await page.evaluate(glowNow);
      if (!g) break;
      await touch.tap(g.x, g.y, 90); await sleep(50);
    }
    const res = await page.evaluate(() => document.getElementById('sgResult').textContent);
    if (!/★/.test(res)) errs.push(`no score shown ("${res}")`);
    if (log.errors.length) errs.push('console errors: ' + log.errors.slice(0, 2).join(' / '));
  } catch (e) { errs.push(e.message.split('\n')[0]); }
  await cur.context.close();
  return [row('songs', '-', !errs.length, (errs.length ? errs.join('; ') + ' · ' : '') + 'storage blocked: the sheet opens, a song trains to the end and scores, no errors')];
}

export default async function songs({ browser, base, workers, tabs, progress, only }) {
  const rows = [];
  rows.push(...trackRows());
  for (const [name, fn] of [['fit', () => fitRows(browser, base, workers, tabs)], ['autoplay', () => autoplayRows(browser, base, workers, tabs)],
    ['timing', () => timingRows(browser, base, tabs)], ['train', () => trainRows(browser, base, workers, tabs)],
    ['stop', () => stopRows(browser, base, workers, tabs)], ['storage', () => storageRows(browser, base)]]) {
    if (process.env.SONGS_PARTS && !process.env.SONGS_PARTS.split(',').includes(name)) continue;
    if (progress) progress('songs: ' + name);
    try { rows.push(...await fn()); } catch (e) { rows.push(row('songs', '-', false, name + ' crashed: ' + (e && e.stack || e).split('\n').slice(0, 3).join(' '))); }
  }
  return rows;
}
