// Check 12. Songs: the free track library, Auto-play and Train me, on every instrument.
//   tracks    every track file validates: fields, every bar adds up, no overlapping notes (a melody or bass line is
//             one note at a time), the length matches its bars, tempo, tonic and mode (a tune ends on its tonic;
//             drum grooves and taals are unpitched), chords, pads and bols are valid, the files are small and cached
//             by the service worker, TRACKS.md lists every track
//   fit       every track that suits an instrument opens in its own key: the Key and Scale menus show the song's
//             tonic and mode, the label says "Song key: ...", every note is the written one moved by one whole number
//             of octaves (none at all on the piano: native-key playback is the stored track exactly), and each note,
//             chord or hit has a key, hole, spot, chord button, pad or drum zone (the harmonica's missing chromatic
//             notes are reported)
//   transpose for every track and every key chosen in the real Key menu: the notes' intervals equal the original's,
//             every note moved by the same number of semitones (plus whole octaves), the mode label stays the song's;
//             the Transpose buttons say "Transposed +n", stop at ±6, Reset goes back; a new Scale keeps the notes
//             ("Keep original") until Remap moves them to the new mode's steps
//   autoplay  a sample track rendered offline through the instrument's own sound, in its own key and transposed +2:
//             every melody and bass note within 5 cents of the note it should be (worked out here from the track),
//             every strum sounds its chord, every drum hit and tabla stroke sounds at its time
//   timing    a song played live on the real audio clock: each note sounds at the time the song says
//   train     Train me (Wait, the default) through the real Songs sheet and real touches, after the first-time hint:
//             for every event of the sample track the right target glows with the right name (checked against the
//             track itself); a wrong key shakes and the song waits; touching the right one plays it and the song
//             moves on; the pass ends with three stars and a saved best score
//   align     Rhythm at five screen sizes: every falling bar is centred on its key, hole or spot and no wider, the
//             strip's hit-line sits on top of the instrument, what glows is what is due, and the Wait badges sit on
//             their keys (a zoomed keyboard wider than the screen scrolls to the note and stays aligned)
//   stop      nothing is left ringing after Stop, closing the song, Home or switching instruments mid-song
//   storage   with storage blocked the songs still open, train and score
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, openApp, sleep, nowFrame, stats, playAndMeasure, waitAudio, openFromGallery } from '../harness.mjs';
import { INSTRUMENTS } from '../instruments.mjs';
import { NAMES, pc, midiOf, row, pool, dryReverb, setToggle } from '../common.mjs';

export const TRACK_FILES = ['melodies', 'chords', 'bass', 'drums', 'tabla'];
export const TAGS = ['Kids', 'Classical', 'Folk', 'Indian', 'Hymn'];
// Modes a track may be in, and what the app's key label calls them (written here from the definitions)
const SCALE_IV = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], melodic: [0, 2, 3, 5, 7, 9, 11],
  penta: [0, 2, 4, 7, 9], minpenta: [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10], bilawal: [0, 2, 4, 5, 7, 9, 11], bhoopali: [0, 2, 4, 7, 9], yaman: [0, 2, 4, 6, 7, 9, 11],
  khamaj: [0, 2, 4, 5, 7, 9, 10], chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};
const MODE_LABEL = { major: 'Major', minor: 'Natural minor', harmonic: 'Harmonic minor', melodic: 'Melodic minor', penta: 'Major pentatonic',
  minpenta: 'Minor pentatonic', blues: 'Blues', dorian: 'Dorian', mixolydian: 'Mixolydian', bilawal: 'Bilawal', bhoopali: 'Bhoopali',
  yaman: 'Yaman', khamaj: 'Khamaj', chromatic: 'Chromatic' };
const pitchedType = (t) => t.type === 'melody' || t.type === 'bass' || t.type === 'chords';
// Which tracks go with which instrument (the rule the Songs sheet uses)
export const TYPE_OF = { guitar: 'chords', rhythm: 'chords', ebass: 'bass', drums: 'drums', epad: 'drums', tabla1: 'tabla', tabla2: 'tabla' };
export const typeOf = (tab) => TYPE_OF[tab] || 'melody';
export const SAMPLE = { melody: 'twinkle', chords: 'ch-twinkle', bass: 'bs-twinkle', drums: 'dr-rock', tabla: 'tl-keherwa' };
const PADS = ['kick', 'snare', 'hatC', 'hatO', 'tomL', 'tomH', 'clap', 'crash'];
const PAD_NAMES = { kick: ['Kick'], snare: ['Snare'], hatC: ['Closed hat'], hatO: ['Open hat'], clap: ['Clap'], crash: ['Crash'], tomL: ['Tom low', 'Tom'], tomH: ['Tom high', 'Tom'] };
// Bols as tabla strokes (dayan: Na Tin Tun Te Ti; bayan: Ge Ke), as a tabla player reads them
const TABLA = { Dha: ['Na', 'Ge'], Dhin: ['Tin', 'Ge'], Dhi: ['Tin', 'Ge'], Din: ['Tin', 'Ge'], Tin: ['Tin'], Tu: ['Tun'], Na: ['Na'], Ta: ['Na'],
  Ti: ['Te'], Ra: ['Ti'], Ki: ['Ke'], Ka: ['Ke'], Kat: ['Ke'], Ge: ['Ge'], Ga: ['Ge'], Di: ['Tin'], Ne: ['Na'] };
const BAYAN = ['Ge', 'Ke'];

const keyPc = (k) => ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[k[0]] + (k[1] === '#' ? 1 : k[1] === 'b' ? -1 : 0) + 12) % 12;
const bpb = (t) => t.time[0] * 4 / t.time[1];
const near = (a, b) => Math.abs(a - b) < 1e-6;
export function loadTracks() {
  const out = [];
  for (const f of TRACK_FILES) out.push(...JSON.parse(fs.readFileSync(path.join(ROOT, 'tracks', f + '.json'), 'utf8')).map((t) => ({ ...t, file: f })));
  return out;
}
const CHORD = /^[A-G](#|b)?(m|maj7|m7|7|dim|\+|aug|sus4)?$/;
// A chord symbol moved by `shift` semitones, named as the chord buttons name it ("F#m7" -> "F♯m")
function chordName(sym, shift) {
  const m = /^([A-G](?:#|b)?)(.*)$/.exec(sym), q = m[2], root = (keyPc(m[1]) + shift + 120) % 12;
  return NAMES[root] + (/^m(?!aj)/.test(q) ? 'm' : /^dim/.test(q) ? 'dim' : /^(\+|aug)/.test(q) ? '+' : '');
}
function chordPcs(sym, shift) {
  const m = /^([A-G](?:#|b)?)(.*)$/.exec(sym), q = m[2], r = keyPc(m[1]) + shift;
  return (/^m(?!aj)/.test(q) ? [0, 3, 7] : /^dim/.test(q) ? [0, 3, 6] : [0, 4, 7]).map((i) => pc(r + i));
}
// The chord sounding at beat b
function chordAt(t, b) {
  const per = bpb(t), bar = t.chords[Math.floor(b / per + 1e-9)], list = bar.split(/\s+/).filter((x) => x && x !== '-');
  return list.length ? list[Math.min(list.length - 1, Math.floor((b % per) / (per / list.length) + 1e-9))] : null;
}

// Most notes sounding at once
function polyphony(notes) {
  const ev = [];
  notes.forEach((n) => { ev.push([n[0], 1]); ev.push([n[0] + n[1], -1]); });
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0, max = 0;
  for (const e of ev) { cur += e[1]; max = Math.max(max, cur); }
  return max;
}
function checkNotes(t, notes, e, label) {
  const len = t.bars * bpb(t);
  let prev = -1;
  notes.forEach((n, i) => {
    if (n.length !== 4) e.push(`${label} ${i + 1}: needs [start, length, midi, velocity]`);
    if (n[0] < prev) e.push(`${label} ${i + 1}: out of order`);
    prev = n[0];
    if (!(n[1] > 0)) e.push(`${label} ${i + 1}: length ${n[1]}`);
    if (!(Number.isInteger(n[2]) && n[2] >= 21 && n[2] <= 108)) e.push(`${label} ${i + 1}: MIDI ${n[2]}`);
    if (!(n[3] >= 1 && n[3] <= 127)) e.push(`${label} ${i + 1}: velocity ${n[3]}`);
  });
  const end = Math.max(...notes.map((n) => n[0] + n[1]));
  if (end > len + 1e-6) e.push(`${label}s run to beat ${end}, past the ${t.bars} bars (${len} beats)`);
  if (end <= len - bpb(t) + 1e-6) e.push(`the last bar is empty (${label}s end at beat ${end} of ${len})`);
  const poly = polyphony(notes);
  if (poly > 1) e.push(`${poly} ${label}s at once: a melody or bass line plays one at a time`);
}

export function validateTrack(t) {
  const e = [], per = t.time && bpb(t), len = t.bars * per;
  if (!t.id || !t.title || !t.by) e.push('missing id, title or composer');
  if (!['Public domain', 'Original'].includes(t.src)) e.push('source must be Public domain or Original');
  if (!(t.tempo >= 40 && t.tempo <= 220)) e.push('tempo ' + t.tempo + ' outside 40-220');
  const beats = t.type === 'tabla' ? t.time[0] >= 2 && t.time[0] <= 16 : [2, 3, 4, 5, 6, 7].includes(t.time[0]);
  if (!Array.isArray(t.time) || !beats || ![2, 4, 8].includes(t.time[1])) e.push('bad time signature');
  if (![1, 2, 3].includes(t.level)) e.push('difficulty must be 1-3');
  if (!t.tags || !t.tags.length || t.tags.some((g) => !TAGS.includes(g))) e.push('tags must come from ' + TAGS.join(', '));
  if (!(t.bars >= 1)) e.push('no bars');
  if (pitchedType(t)) {
    if (!/^[A-G](#|b)?$/.test(t.key || '')) e.push('bad key ' + t.key);
    else if (t.tonic !== keyPc(t.key)) e.push(`tonic ${t.tonic} is not the pitch class of ${t.key}`);
    if (!SCALE_IV[t.mode]) e.push('missing or unknown mode ' + t.mode);
    const tune = t.type === 'chords' ? t.notes : t.type === 'melody' ? t.notes : null;
    if (tune && tune.length && pc(tune[tune.length - 1][2]) !== t.tonic) e.push(`the tune ends on ${NAMES[pc(tune[tune.length - 1][2])]}, not its tonic ${NAMES[t.tonic]}`);
  } else if (t.tonic !== null || t.mode !== 'none') e.push('an unpitched track needs tonic null and mode "none"');
  if (t.chords) {
    if (t.chords.length !== t.bars) e.push(`${t.chords.length} chord bars for ${t.bars} bars`);
    t.chords.forEach((c, i) => c.split(/\s+/).filter((x) => x && x !== '-').forEach((s) => { if (!CHORD.test(s)) e.push(`bar ${i + 1}: bad chord ${s}`); }));
  }
  if (t.type === 'melody' || t.type === 'bass') {
    if (!t.notes || !t.notes.length) e.push('no notes');
    else {
      checkNotes(t, t.notes, e, 'note');
      if (t.type === 'bass' && t.notes.some((n) => n[2] < 28 || n[2] > 60)) e.push('bass notes outside E1-C4');
    }
    if (t.sargam && t.sargam.length !== t.notes.length) e.push('sargam labels do not match the notes');
  } else if (t.type === 'chords') {
    if (!t.chords) e.push('a chord song needs chords');
    if (!t.strum || !t.strum.length) e.push('no strums');
    else {
      t.strum.forEach((s, i) => {
        if (!['D', 'U'].includes(s[1])) e.push(`strum ${i + 1}: ${s[1]} is not D or U`);
        if (!(s[0] >= 0 && s[0] < len)) e.push(`strum ${i + 1} at beat ${s[0]} is outside the song`);
        if (i && s[0] <= t.strum[i - 1][0]) e.push(`strum ${i + 1}: out of order`);
        if (t.chords && !chordAt(t, s[0])) e.push(`strum ${i + 1}: no chord at beat ${s[0]}`);
      });
    }
    if (t.notes) checkNotes(t, t.notes, e, 'tune note');
  } else if (t.type === 'drums' || t.type === 'tabla') {
    if (!t.hits || !t.hits.length) e.push('no hits');
    else t.hits.forEach((h, i) => {
      if (!(h[0] >= 0 && h[0] < len)) e.push(`hit ${i + 1} at beat ${h[0]} is outside the song`);
      if (i && h[0] < t.hits[i - 1][0]) e.push(`hit ${i + 1}: out of order`);
      if (t.type === 'drums' ? !PADS.includes(h[1]) : !TABLA[h[1]]) e.push(`hit ${i + 1}: unknown ${t.type === 'drums' ? 'pad' : 'bol'} ${h[1]}`);
      if (!(h[2] >= 1 && h[2] <= 127)) e.push(`hit ${i + 1}: velocity ${h[2]}`);
    });
    if (t.type === 'tabla' && (!t.vibhag || t.vibhag.reduce((a, b) => a + b, 0) !== t.time[0] || !t.tali || t.tali.length !== t.vibhag.length)) e.push('vibhags must add up to the matras, with a tali sign each');
    if (t.hits && t.hits.length && Math.max(...t.hits.map((h) => h[0])) < len - per) e.push('the last bar is empty');
  } else e.push('unknown type ' + t.type);
  return e;
}

/* tracks: the files themselves */
function trackRows() {
  let all;
  try { all = loadTracks(); } catch (err) { return [row('songs', '-', false, 'track files: ' + err.message)]; }
  const bad = [], ids = new Set(), md = fs.existsSync(path.join(ROOT, 'TRACKS.md')) ? fs.readFileSync(path.join(ROOT, 'TRACKS.md'), 'utf8') : '';
  for (const t of all) {
    const e = validateTrack(t);
    if (ids.has(t.id)) e.push('duplicate id');
    ids.add(t.id);
    if (!md.includes('| ' + t.title + ' |')) e.push('not listed in TRACKS.md');
    if (e.length) bad.push(`${t.id}: ${e.slice(0, 2).join('; ')}`);
  }
  const size = TRACK_FILES.reduce((a, f) => a + fs.statSync(path.join(ROOT, 'tracks', f + '.json')).size, 0);
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), notCached = TRACK_FILES.filter((f) => !sw.includes(`tracks/${f}.json`));
  const byType = {};
  all.forEach((t) => { byType[t.type] = (byType[t.type] || 0) + 1; });
  return [row('songs', '-', !bad.length && size < 2 * 1024 * 1024 && !notCached.length,
    (bad.length ? bad.slice(0, 4).join(' | ') + ' · ' : '') + `track files: ${all.length} tracks (${Object.entries(byType).map(([k, v]) => v + ' ' + k).join(', ')}), ` +
    `${(size / 1024).toFixed(1)} KB` + (notCached.length ? `; not cached by the service worker: ${notCached.join(', ')}` : ', all cached by the service worker') +
    (bad.length ? '' : `; every bar adds up, no overlaps; every pitched track has its tonic and mode (${[...new Set(all.filter(pitchedType).map((t) => t.mode))].join(', ')}) and its tune ends on the tonic; lengths, tempos, chords, pads and bols valid, all listed in TRACKS.md`),
    { tracks: all.length, kb: +(size / 1024).toFixed(1), bad: bad.length })];
}

// Opens the app with the test hooks on (window.PocketBandTest)
const HOOKS = 'window.__PB_TEST__ = true;';
async function openWithHooks(browser, base, tab, extra, viewport) {
  const cur = await openApp(browser, base, { tab, viewport });
  await cur.page.addInitScript({ content: HOOKS + (extra || '') });
  await cur.page.reload({ waitUntil: 'load' });
  await cur.page.waitForFunction(() => window.PocketBandTest);
  // with storage blocked the app can't remember the instrument and starts at Home
  if (await cur.page.evaluate(() => document.body.dataset.screen) !== 'play') await openFromGallery(cur.page, cur.touch, tab);
  return cur;
}
const pickList = (tabs) => INSTRUMENTS.filter((i) => !tabs || tabs.includes(i.tab));

/* fit: every suitable track on every instrument, in its own key */
async function fitRows(browser, base, workers, tabs) {
  const tasks = pickList(tabs).map((ins) => ({
    tab: ins.tab, check: 'songs', fresh: true,
    run: async () => {
      const cur = await openWithHooks(browser, base, ins.tab);
      try {
        const r = await cur.page.evaluate(async (tab) => {
          const P = window.PocketBandTest, S = P.songs, lib = await S.load(), out = [];
          for (const tr of lib.filter((t) => S.suits(t, tab))) {
            S.open(tr, 'auto'); S.halt();
            const plan = S.state().plan, $ = (id) => document.getElementById(id);
            out.push({ id: tr.id, key: P.TONAL[tab] ? P.TONAL[tab].key : null, scale: P.TONAL[tab] ? P.TONAL[tab].scale : null,
              keyMenu: $('key').offsetParent ? +$('key').value : null, scaleMenu: $('scale').offsetParent ? $('scale').value : null,
              label: $('sgKeyRow').hidden ? null : $('sgKeyName').textContent, n: plan.ev.length, missing: plan.missing, oct: plan.oct,
              ev: plan.ev.map((e) => ({ i: e.i, k: e.k, m: e.m, b: e.b, d: e.d, name: e.c && e.c.name, hit: e.hit, auto: !!e.auto, tg: !!e.tg })) });
            S.close();
          }
          return out;
        }, ins.tab);
        const lib = loadTracks(), errs = [], octs = {};
        let exact = 0;
        // what each track should become on this instrument, worked out here from the track itself
        for (const x of r) {
          const tr = lib.find((t) => t.id === x.id);
          if (pitchedType(tr)) {
            const want = `Song key: ${NAMES[tr.tonic]} ${MODE_LABEL[tr.mode]}`;
            if (x.key !== tr.tonic || x.scale !== tr.mode) errs.push(`${x.id}: the instrument is in ${NAMES[x.key]} ${x.scale}, the song in ${NAMES[tr.tonic]} ${tr.mode}`);
            if (x.keyMenu !== null && (x.keyMenu !== tr.tonic || x.scaleMenu !== tr.mode)) errs.push(`${x.id}: the Key and Scale menus show ${x.keyMenu} ${x.scaleMenu}`);
            if (x.label !== want) errs.push(`${x.id}: labelled "${x.label}", expected "${want}"`);
          }
          if (tr.type === 'melody' || tr.type === 'bass') {
            if (x.n !== tr.notes.length) errs.push(`${x.id}: ${x.n} events for ${tr.notes.length} notes`);
            // the written notes, moved by whole octaves only, all by the same amount
            const moves = new Set(x.ev.map((e) => e.m - tr.notes[e.i][2]));
            if (moves.size !== 1 || [...moves][0] % 12 || [...moves][0] !== 12 * x.oct) errs.push(`${x.id}: notes moved by ${[...moves].join(', ')} semitones (whole octaves only, all the same)`);
            x.ev.forEach((e) => { const n = tr.notes[e.i]; if (!near(e.b, n[0]) || !near(e.d, n[1])) errs.push(`${x.id} note ${e.i + 1}: at beat ${e.b} for ${e.d}, the track says ${n[0]} for ${n[1]}`); });
            octs[x.oct] = (octs[x.oct] || 0) + 1;
            if (!x.oct && moves.size === 1 && [...moves][0] === 0) exact++;
            if (ins.tab === 'piano' && x.oct !== 0) errs.push(`${x.id}: moved ${x.oct} octaves on the piano; native-key playback must be the stored track`);
            if (x.missing && ins.tab !== 'harmonica') errs.push(`${x.id}: ${x.missing} notes with nowhere to play`);
          } else if (tr.type === 'chords') {
            if (x.n !== tr.strum.length) errs.push(`${x.id}: ${x.n} strums for ${tr.strum.length}`);
            x.ev.forEach((e) => { const want = chordName(chordAt(tr, tr.strum[e.i][0]), 0); if (e.name !== want) errs.push(`${x.id} strum ${e.i + 1}: ${e.name}, expected ${want}`); });
            if (x.missing) errs.push(`${x.id}: ${x.missing} strums with no chord button`);
          } else if (tr.type === 'drums') {
            if (x.n !== tr.hits.length) errs.push(`${x.id}: ${x.n} events for ${tr.hits.length} hits`);
            if (x.missing) errs.push(`${x.id}: ${x.missing} hits with no pad`);
          } else {
            const want = tr.hits.reduce((a, h) => a + TABLA[h[1]].length, 0);
            if (x.n !== want) errs.push(`${x.id}: ${x.n} strokes, the bols make ${want}`);
            if (ins.tab === 'tabla1' && x.ev.some((e) => !e.tg && !(e.auto && BAYAN.includes(e.hit)))) errs.push(`${x.id}: a dayan stroke has no zone`);
          }
        }
        const missing = r.filter((x) => x.missing), notes = typeOf(ins.tab) === 'melody' || typeOf(ins.tab) === 'bass';
        const ok = r.length >= 8 && !errs.length;
        const what = { melody: 'notes', bass: 'notes', chords: 'strums', drums: 'hits', tabla: 'strokes' }[typeOf(ins.tab)];
        return row('songs', ins.tab, ok, (errs.length ? errs.slice(0, 3).join('; ') + ' · ' : '') +
          `fit: ${r.length} tracks` + (r[0] && r[0].label ? ', each opening in its own key and mode (Key, Scale and "Song key" label)' : '') +
          (notes ? `, every note the written one ${ins.tab === 'piano' ? 'exactly (native key = the stored track)' : 'moved by whole octaves only (' + Object.entries(octs).map(([o, n]) => n + ' at ' + (o > 0 ? '+' : '') + o).join(', ') + ' octaves; ' + exact + ' exactly as stored)'}` : '') +
          (missing.length ? `; ${what} the ${ins.name.toLowerCase()} doesn't have, played for you: ${missing.map((x) => x.id + ' (' + x.missing + ')').join(', ')}` : `; every one of the ${r.reduce((a, x) => a + x.n, 0)} ${what} has its place`) +
          (r.length < 8 ? '; fewer than 8 tracks' : ''),
          { part: 'fit', tracks: r.length, missing: missing.length });
      } finally { await cur.context.close(); }
    }
  }));
  return pool(browser, base, tasks, workers);
}

/* transpose: every track in every key, through the real Key menu, and the Transpose, Reset and Scale controls */
async function transposeRows(browser, base, workers, tabs) {
  const lib = loadTracks();
  const tasks = pickList(tabs).filter((i) => typeOf(i.tab) !== 'drums' && typeOf(i.tab) !== 'tabla').map((ins) => ({
    tab: ins.tab, check: 'songs', fresh: true,
    run: async () => {
      const cur = await openWithHooks(browser, base, ins.tab);
      try {
        const r = await cur.page.evaluate(async (tab) => {
          const P = window.PocketBandTest, S = P.songs, all = await S.load(), $ = (id) => document.getElementById(id), out = [];
          const choose = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new Event('change')); };
          const snap = () => { const p = S.state().plan; return { key: P.TONAL[tab].key, scale: P.TONAL[tab].scale, label: $('sgKeyName').textContent, tp: $('sgTp').textContent,
            ms: p.ev.map((e) => e.k === 'note' ? e.m : e.c.name), tune: p.tune.map((n) => n.m), menu: +$('key').value }; };
          for (const tr of all.filter((t) => S.suits(t, tab))) {
            S.open(tr, 'auto'); S.halt();
            const keys = [];
            for (let k = 0; k < 12; k++) { choose('key', k); keys.push(snap()); }
            // the Transpose buttons, Reset, and a Scale away from the song's mode: Keep original, then Remap
            S.reset();
            const tpUp = [], other = tr.mode === 'dorian' ? 'major' : 'dorian';
            for (let k = 0; k < 7; k++) { $('sgTpUp').click(); tpUp.push($('sgTp').textContent); }
            const upLimit = $('sgTpUp').disabled;
            $('sgReset').click();
            const reset = snap();
            choose('scale', other);
            const keep = { ...snap(), ask: !$('sgAsk').hidden, keepOn: $('sgKeep').getAttribute('aria-pressed') };
            const canRemap = !$('sgRemap').hidden;
            if (canRemap) $('sgRemap').click();
            const remap = snap();
            out.push({ id: tr.id, keys, tpUp, upLimit, reset, keep, remap, other, canRemap });
            S.close();
          }
          return out;
        }, ins.tab);
        const errs = [];
        let checked = 0;
        const iv = (a) => a.slice(1).map((m, i) => m - a[i]);
        for (const x of r) {
          const tr = lib.find((t) => t.id === x.id), mode = MODE_LABEL[tr.mode], notes = tr.type !== 'chords';
          const orig = notes ? tr.notes.map((n) => n[2]) : tr.notes.map((n) => n[2]);
          x.keys.forEach((k, key) => {
            checked++;
            let d = ((key - tr.tonic) % 12 + 12) % 12; if (d > 6) d -= 12;
            if (k.key !== key || k.menu !== key) errs.push(`${x.id} in ${NAMES[key]}: the instrument went to ${NAMES[k.key]}`);
            if (k.scale !== tr.mode) errs.push(`${x.id} in ${NAMES[key]}: the scale changed to ${k.scale}`);
            if (k.label !== `Song key: ${NAMES[key]} ${mode}`) errs.push(`${x.id} in ${NAMES[key]}: labelled "${k.label}"`);
            const wantTp = d ? `Transposed ${d > 0 ? '+' : '−'}${Math.abs(d)}` : 'Original key';
            if (k.tp !== wantTp && !(Math.abs(d) === 6 && /Transposed [+−]6/.test(k.tp))) errs.push(`${x.id} in ${NAMES[key]}: "${k.tp}", expected "${wantTp}"`);
            const got = notes ? k.ms : k.tune;
            if (iv(got).join() !== iv(orig).join()) errs.push(`${x.id} in ${NAMES[key]}: the intervals changed`);
            const move = got[0] - orig[0];
            if (pc(move) !== pc(key - tr.tonic) || got.some((m, i) => m - orig[i] !== move)) errs.push(`${x.id} in ${NAMES[key]}: notes moved by ${move}, not ${d} semitones plus whole octaves`);
            if (!notes) k.ms.forEach((name, i) => { const want = chordName(chordAt(tr, tr.strum[i][0]), d); if (name !== want && !(Math.abs(d) === 6)) errs.push(`${x.id} in ${NAMES[key]} strum ${i + 1}: ${name}, expected ${want}`); });
          });
          const wantUp = ['+1', '+2', '+3', '+4', '+5', '+6', '+6'].map((v) => 'Transposed ' + v);
          if (x.tpUp.join() !== wantUp.join() || !x.upLimit) errs.push(`${x.id}: Transpose + showed ${x.tpUp.join(', ')}${x.upLimit ? '' : ' and did not stop at +6'}`);
          if (x.reset.tp !== 'Original key' || x.reset.key !== tr.tonic) errs.push(`${x.id}: Reset left "${x.reset.tp}" in ${NAMES[x.reset.key]}`);
          if (!x.keep.ask || x.keep.keepOn !== 'true') errs.push(`${x.id}: changing the Scale did not offer Keep original (on) and Remap`);
          if (x.keep.ms.join() !== x.reset.ms.join()) errs.push(`${x.id}: Keep original changed the notes`);
          if (x.keep.scale !== x.other || !x.keep.label.startsWith(`Song key: ${NAMES[tr.tonic]} ${mode}`)) errs.push(`${x.id}: after the Scale change the label says "${x.keep.label}"`);
          if (x.canRemap && notes) {
            // remapped: each note on the same step of the new mode
            const from = SCALE_IV[tr.mode], to = SCALE_IV[x.other];
            x.remap.ms.forEach((m, i) => {
              const o = x.reset.ms[i], r = pc(o - tr.tonic), st = from.indexOf(r);
              if (st >= 0 && from.length === to.length && m !== o - r + to[st]) errs.push(`${x.id} note ${i + 1}: remapped to ${NAMES[pc(m)]}, step ${st + 1} of ${x.other} is ${NAMES[pc(o - r + to[st])]}`);
            });
          }
        }
        return row('songs', ins.tab, !errs.length && r.length >= 8, (errs.length ? errs.slice(0, 3).join('; ') + ' · ' : '') +
          `transpose: ${r.length} tracks x 12 keys (${checked} fits) through the Key menu: every interval kept, every note moved by the key's semitones plus whole octaves, ` +
          `mode label kept, "Transposed ±n" shown; Transpose + stops at +6, Reset returns to the song key; a new Scale keeps the notes until Remap` + (r.some((x) => x.canRemap) ? ' moves each to the same step of the new mode' : ' (chord songs keep their chords)'),
          { part: 'transpose', tracks: r.length, fits: checked });
      } finally { await cur.context.close(); }
    }
  }));
  return pool(browser, base, tasks, workers);
}

// Runs in the page before the app: an OfflineAudioContext in place of the real one (as on the self-test page), so a
// song renders faster than real time with every event at its exact moment
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

/* autoplay: the sample track rendered offline and measured */
async function autoplayRows(browser, base, workers, tabs) {
  const lib = loadTracks();
  const tasks = pickList(tabs).map((ins) => ({
    tab: ins.tab, check: 'songs', fresh: true,
    run: async () => {
      const type = typeOf(ins.tab), tr = lib.find((t) => t.id === SAMPLE[type]);
      const cur = await openWithHooks(browser, base, ins.tab, OFFLINE);
      const out = [];
      try {
       // in the song's own key, then transposed up two semitones (unpitched tracks once)
       for (const tp of type === 'drums' || type === 'tabla' ? [0] : [0, 2]) {
        const r = await cur.page.evaluate(async ({ tab, id, win, type, tp }) => {
          const P = window.PocketBandTest, S = P.songs, lib = await S.load(), tr = lib.find((t) => t.id === id), PRE = 0.3, SR = 48000;
          P.reset();
          for (const el of ['rev', 'irev']) { const x = document.getElementById(el); if (x) { x.value = 0; x.dispatchEvent(new Event('input')); } }
          P.bw.vib = false; P.sx.vib = false;
          S.state().count = false;
          window.__pbSeconds = PRE + tr.bars * tr.time[0] * 4 / tr.time[1] * 60 / tr.tempo + 2.5; // long enough for the whole song
          P.init(); P.setVolume(1);
          S.open(tr, 'auto'); if (tp) S.transpose(tp); S.halt();
          const sg = S.state(), spb = S.spb(), ev = sg.plan.ev, key = P.TONAL[tab] ? P.TONAL[tab].key : 0;
          sg.plan.tune = []; // only the instrument's own part, so it can be measured alone
          const steps = ev.map((e) => [PRE + e.b * spb, () => S.fire(e, PRE + e.b * spb)]);
          const buf = await window.__pbRender(steps), x = buf.getChannelData(0), y = buf.getChannelData(1), m = new Float32Array(x.length);
          for (let i = 0; i < x.length; i++) m[i] = 0.5 * (x[i] + y[i]);
          let peak = 0; for (let i = 0; i < m.length; i++) peak = Math.max(peak, Math.abs(m[i]));
          const rms = (a, b) => { let s = 0; a = Math.max(0, Math.round(a)); b = Math.round(b); for (let i = a; i < b; i++) s += m[i] * m[i]; return Math.sqrt(s / Math.max(1, b - a)); };
          const at = (e) => PRE + e.b * spb;
          if (type === 'melody' || type === 'bass') return { key, peak, trKey: tr.key, notes: ev.map((e) => {
            // the middle two of four stretches of the note: detuned copies (the bowed strings' chorus) beat slowly, and
            // one stretch can catch them leaning sharp or flat
            const a = (at(e) + Math.min(Math.max(win[0] / 1000, e.d * spb * 0.25), 0.25)) * SR, b = (at(e) + Math.max(win[1] / 1000, Math.min(e.d * spb * 0.85, 0.6))) * SR, fs = [];
            for (let k = 0; k < 4; k++) { const p = PBA.pitch(m, SR, Math.round(a + k * (b - a) / 4), Math.round(a + (k + 1) * (b - a) / 4), type === 'bass' ? 28 : 50, 2600); if (p.f > 0) fs.push(Math.log2(p.f)); }
            fs.sort((p, q) => p - q);
            const mid = fs.length > 2 ? fs.slice(1, -1) : fs;
            return { i: e.i, want: e.m, f: mid.length ? Math.pow(2, mid.reduce((p, q) => p + q, 0) / mid.length) : 0 };
          }) };
          if (type === 'chords') return { key, peak, trKey: tr.key, strums: ev.map((e) => {
            // the strength of each of the 12 notes (any octave, E2 to C6) just after the strum
            const a = Math.round((at(e) + 0.06) * SR), n = Math.round(Math.min(0.25, e.d * spb * 0.9) * SR), w = new Float32Array(n), chroma = new Array(12).fill(0);
            for (let k = 0; k < n; k++) w[k] = m[a + k] * (0.5 - 0.5 * Math.cos(2 * Math.PI * k / (n - 1)));
            for (let q = 40; q <= 84; q++) {
              const f = 440 * Math.pow(2, (q - 69) / 12), cw = 2 * Math.cos(2 * Math.PI * f / SR);
              let s1 = 0, s2 = 0; for (let k = 0; k < n; k++) { const s0 = w[k] + cw * s1 - s2; s2 = s1; s1 = s0; }
              chroma[q % 12] += Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - cw * s1 * s2));
            }
            return { i: e.i, name: e.c.name, chroma, loud: rms(a, a + n) };
          }) };
          // drums and tabla: a hit is heard when the sound jumps at its time
          const times = [...new Set(ev.map((e) => at(e).toFixed(4)))].map(Number);
          return { peak, hits: times.map((t) => ({ t, before: rms((t - 0.012) * SR, (t - 0.001) * SR), after: rms((t + 0.001) * SR, (t + 0.03) * SR) })) };
        }, { tab: ins.tab, id: tr.id, win: ins.win || [60, 150], type, tp });
        const errs = [], dB = (x) => 20 * Math.log10(x + 1e-12), shift = tp;
        let detail;
        if (r.notes) {
          let worst = 0;
          // expected: the written note plus the transpose, moved by one whole number of octaves for the whole song
          const oct = r.notes.length ? Math.round((r.notes[0].want - tr.notes[r.notes[0].i][2] - tp) / 12) : 0;
          r.notes.forEach((n) => {
            const want = tr.notes[n.i][2] + shift + 12 * oct;
            if (want !== n.want) errs.push(`note ${n.i + 1}: plans ${NAMES[pc(n.want)]}${Math.floor(n.want / 12) - 1}, the track says ${NAMES[pc(want)]}${Math.floor(want / 12) - 1}`);
            if (!(n.f > 0)) { errs.push(`note ${n.i + 1}: no pitch`); return; }
            const c = 100 * (midiOf(n.f) - n.want);
            worst = Math.max(worst, Math.abs(c));
            if (Math.abs(c) > 5) errs.push(`note ${n.i + 1} (${NAMES[pc(n.want)]}): ${c.toFixed(1)} cents`);
          });
          detail = `${r.notes.length} notes, each measured within 5 cents of the track's own note${tp ? ' + ' + tp : ''}${oct ? ' (' + (oct > 0 ? '+' : '') + oct + ' octave)' : ''}, worst ${worst.toFixed(1)} cents`;
        } else if (r.strums) {
          const sh = shift > 6 ? shift - 12 : shift;
          let worstShare = 1;
          r.strums.forEach((s) => {
            const sym = chordAt(tr, tr.strum[s.i][0]), want = chordPcs(sym, sh);
            // every note of the chord is clearly there, and the chord's notes carry most of the sound (a bright
            // string's overtones, the fifth above each note, make up the rest)
            const top = Math.max(...s.chroma), total = s.chroma.reduce((a, v) => a + v, 0), share = want.reduce((a, k) => a + s.chroma[k], 0) / total;
            const weak = want.filter((k) => s.chroma[k] < 0.1 * top);
            worstShare = Math.min(worstShare, share);
            if (s.name !== chordName(sym, sh)) errs.push(`strum ${s.i + 1}: plays ${s.name}, expected ${chordName(sym, sh)}`);
            else if (dB(s.loud) < -45) errs.push(`strum ${s.i + 1}: silent`);
            else if (weak.length || share < 0.5) errs.push(`strum ${s.i + 1} (${s.name}): ` + (weak.length ? `${weak.map((k) => NAMES[k]).join(', ')} hardly heard` : `its notes are only ${Math.round(share * 100)}% of the sound`));
          });
          detail = `${r.strums.length} strums, each sounding every note of its chord (the chord's notes at least ${Math.round(worstShare * 100)}% of the sound)`;
        } else {
          let worst = 99;
          r.hits.forEach((h, i) => {
            const jump = dB(h.after) - dB(h.before);
            worst = Math.min(worst, jump);
            if (dB(h.after) < -50 || jump < 1.5) errs.push(`hit ${i + 1} at ${(h.t - 0.3).toFixed(2)} s: ${jump.toFixed(1)} dB jump`);
          });
          detail = `${r.hits.length} hit times, each heard at its moment (smallest jump ${worst.toFixed(1)} dB)`;
        }
        if (dB(r.peak) > -0.5) errs.push(`peak ${dB(r.peak).toFixed(1)} dBFS`);
        out.push(row('songs', ins.tab, !errs.length, (errs.length ? errs.slice(0, 3).join('; ') + ' · ' : '') +
          `auto-play (offline render of "${tr.title}"${r.trKey ? ' in ' + NAMES[r.key] + (tp ? ', transposed +' + tp : ', its own key') : ''}): ${detail}, peak ${dB(r.peak).toFixed(1)} dBFS`, { part: 'autoplay', errors: errs.length }));
       }
       return out;
      } finally { await cur.context.close(); }
    }
  }));
  return pool(browser, base, tasks, workers);
}

async function tapSel(page, touch, sel) {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const b = await page.locator(sel).first().boundingBox();
  await touch.tap(b.x + b.width / 2, b.y + b.height / 2, 40);
}
async function setCount(page, on) { await page.evaluate((on) => { const sg = window.PocketBandTest && window.PocketBandTest.songs.state(); if (sg) sg.count = on; }, on); }

/* timing: a song live on the audio clock */
async function timingRows(browser, base, tabs) {
  const rows = [];
  // A take with a wrong note is played once more, as in the pitch check: a live recording on a busy computer can
  // catch a dropped audio block. A real fault fails both takes.
  for (const tab of ['piano', 'xylo'].filter((t) => !tabs || tabs.includes(t))) for (let take = 1; take <= 2; take++) {
    const ins = INSTRUMENTS.find((i) => i.tab === tab);
    const cur = await openWithHooks(browser, base, tab);
    let failed = false;
    const { page, touch } = cur;
    try {
      await dryReverb(page);
      await tapSel(page, touch, '#songs');
      await page.waitForSelector('.sgitem');
      await setCount(page, false);
      await tapSel(page, touch, `.sgitem[data-id="${SAMPLE.melody}"] [data-go="auto"]`);
      await waitAudio(page);
      const info = await page.evaluate(() => { const sg = window.PocketBandTest.songs.state(); return { t: sg.anchor.time, b: sg.anchor.beat, spb: window.PocketBandTest.songs.spb(), sr: window.__rec.sr, ev: sg.plan.ev.slice(0, 14).map((e) => ({ b: e.b, m: e.m, d: e.d })) }; });
      const last = info.ev[info.ev.length - 1], endF = Math.round((info.t + (last.b - info.b) * info.spb + 0.4) * info.sr);
      await page.waitForFunction((f) => window.__rec.last() >= f, endF, { timeout: 20000, polling: 50 });
      const res = await page.evaluate(({ info, win }) => info.ev.map((e) => {
        const R = window.__rec, t = info.t + (e.b - info.b) * info.spb, f0 = Math.round((t + win[0] / 1000) * info.sr), f1 = Math.round((t + Math.min(win[1] / 1000, e.d * info.spb * 0.9)) * info.sr);
        const x = R.get(f0, f1), p = PBA.pitch(x, info.sr, 0, x.length, 50, 4200);
        // onset: the first 2 ms block from 8 ms before the note's time that rises 10 dB over the 10 ms before it
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
      failed = errs.length > 0;
      if (!failed || take === 2) rows.push(row('songs', tab, !errs.length, (errs.length ? errs.slice(0, 3).join('; ') + ' · ' : '') +
        `timing (live): ${res.length} auto-played notes each sound at their time (worst ${worstT.toFixed(1)} ms) and pitch (worst ${worstC.toFixed(1)} cents)` +
        (take === 2 ? ' (second take)' : ''), { worstMs: +worstT.toFixed(1), take }));
    } catch (e) { failed = true; if (take === 2) rows.push(row('songs', tab, false, 'timing: ' + e.message.split('\n')[0])); }
    await cur.context.close();
    if (!failed) break;
  }
  return rows;
}

// What glows now, from the screen: each glowing target with a point to touch and what it is, and the song's place.
// A key is touched low (where a finger plays it), a drum zone at its label, a fingerboard spot at its dot.
function glowNow() {
  const S = window.PocketBandTest.songs, sg = S.state(), tag = document.querySelector('#sgTag.show');
  if (!sg.on || !sg.wEv) return null;
  const out = [];
  for (const e of sg.wGroup) {
    const tg = e.tg;
    if (!tg) continue;
    let r, x, y, what;
    if (tg.el) {
      if (!tg.el.classList.contains('sgnext')) return { notLit: true, i: e.i };
      if (tg.el instanceof SVGElement) { // a tabla zone: its label is inside it
        const lab = [...tg.el.ownerSVGElement.querySelectorAll('text')].find((t) => t.textContent === e.hit);
        r = lab.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; what = e.hit;
      } else {
        r = tg.el.getBoundingClientRect(); x = r.left + r.width / 2;
        const key = tg.el.classList.contains('key') || tg.el.classList.contains('bkey') || tg.el.classList.contains('mkey');
        y = r.top + r.height * (key ? (tg.el.classList.contains('bkey') || tg.el.classList.contains('sharp') ? 0.6 : 0.8) : 0.5);
        what = tg.el.dataset.pad || (tg.el.dataset.chord !== undefined ? tg.el.textContent : tg.el.innerText.split('\n')[0]);
      }
    } else {
      const dot = document.querySelector('.sgdot.show.next');
      if (!dot) return { notLit: true, i: e.i };
      r = dot.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2;
    }
    let pad = null;
    if (tg.pad) { if (!tg.pad.classList.contains('sgnext')) return { notLit: true, i: e.i }; const pr = tg.pad.getBoundingClientRect(); pad = { x: pr.left + pr.width / 2, y: pr.top + pr.height / 2, dir: +tg.pad.dataset.dir }; }
    out.push({ x, y, what, pad, i: e.i, b: e.b });
  }
  return { targets: out, label: tag ? tag.textContent : '', i: sg.wEv.i, b: sg.wEv.b };
}
const labelPc = (s) => { const m = /^([A-G])([♯♭]?)/.exec(s); return m ? (NAMES.indexOf(m[1] + m[2]) + 12) % 12 : -1; };
// In the page: a key, hole or spot near the glowing one that plays a different note (a wrong key), where to touch it
function wrongNow() {
  const S = window.PocketBandTest.songs, sg = S.state(), e = sg.wGroup && sg.wGroup[0];
  if (!e || e.k !== 'note') return null;
  for (const d of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
    const m = e.m + d;
    if (sg.wGroup.some((g) => ((g.m - m) % 12 + 12) % 12 === 0)) continue;
    const tg = S.target(sg.tab, m);
    if (!tg) continue;
    let x, y;
    if (tg.el) {
      const r = tg.el.getBoundingClientRect(), key = /\b(key|bkey|mkey)\b/.test(tg.el.className);
      x = r.left + r.width / 2; y = r.top + r.height * (key ? (/\b(bkey|sharp)\b/.test(tg.el.className) ? 0.6 : 0.8) : 0.5);
      if (document.elementFromPoint(x, y) !== tg.el && !tg.el.contains(document.elementFromPoint(x, y))) continue;
    } else { const c = S.point(tg); x = c.x; y = c.y; }
    if (x < 2 || x > innerWidth - 2) continue;
    return { x, y, m, i: sg.wEv.i, shakes: sg.shakes || 0 };
  }
  return null;
}
// Close the first-time hint the way a person does
async function hintOk(page, touch) {
  await page.waitForSelector('#sgHint:not([hidden])', { timeout: 5000 });
  await tapSel(page, touch, '#sgHintOk');
  await page.waitForSelector('#sgHint', { state: 'hidden', timeout: 5000 });
}

/* train: through the real sheet and real touches */
async function trainRows(browser, base, workers, tabs) {
  const lib = loadTracks();
  const tasks = pickList(tabs).map((ins) => ({
    tab: ins.tab, check: 'songs', fresh: true,
    run: async () => {
      const type = typeOf(ins.tab), tr = lib.find((t) => t.id === SAMPLE[type]);
      const cur = await openWithHooks(browser, base, ins.tab);
      const { page, touch } = cur, errs = [];
      try {
        await dryReverb(page);
        await setToggle(page, touch, 'bvib', false); await setToggle(page, touch, 'sxvib', false);
        await tapSel(page, touch, '#songs');
        await page.waitForSelector(`.sgitem[data-id="${tr.id}"]`);
        await tapSel(page, touch, `.sgitem[data-id="${tr.id}"] [data-go="train"]`);
        const level = await page.evaluate(() => document.getElementById('sgMode').value);
        if (level !== 'wait') errs.push(`Train me opened at level ${level}, not Wait`);
        await hintOk(page, touch);
        await page.waitForFunction(() => document.querySelector('.stage .sgnext, .sgdot.show.next'));
        const keyEl = await page.evaluate(() => { const k = document.getElementById('key'); return k && k.offsetParent ? +k.value : null; });
        const shift = keyEl === null ? 0 : ((keyEl - keyPc(tr.key)) % 12 + 12) % 12, sh = shift > 6 ? shift - 12 : shift;
        // the events of the track, grouped by beat, as the track itself says
        const groups = [];
        const add = (b, x) => { let g = groups.find((q) => near(q.b, b)); if (!g) groups.push(g = { b, items: [] }); g.items.push(x); };
        if (type === 'melody' || type === 'bass') tr.notes.forEach((n) => add(n[0], { pc: pc(n[2] + shift) }));
        else if (type === 'chords') tr.strum.forEach((s) => add(s[0], { chord: chordName(chordAt(tr, s[0]), sh), dir: s[1] === 'U' ? -1 : 1 }));
        else if (type === 'drums') tr.hits.forEach((h) => add(h[0], { pad: h[1] }));
        else tr.hits.forEach((h) => TABLA[h[1]].forEach((s) => { if (ins.tab === 'tabla2' || !BAYAN.includes(s)) add(h[0], { stroke: s, bol: h[1] }); }));
        groups.sort((a, b) => a.b - b.b);
        const names = ins.tab === 'epad' ? await page.evaluate(() => window.PocketBandTest.EKITS[window.PocketBandTest.ep.kit].pads.map((p) => p[0])) : null;
        let done = 0, worst = 0, wrongs = 0;
        for (const grp of groups) {
          const g = await page.evaluate(glowNow);
          if (!g) { errs.push(`beat ${grp.b}: nothing glows`); break; }
          if (g.notLit) { errs.push(`beat ${grp.b}: event ${g.i + 1} is next but not lit`); break; }
          if (!near(g.b, grp.b)) { errs.push(`beat ${grp.b}: the song is at beat ${g.b}`); break; }
          const it = grp.items, lit = g.targets;
          if (lit.length !== it.length) errs.push(`beat ${grp.b}: ${lit.length} targets glow, the track has ${it.length}`);
          if (type === 'melody' || type === 'bass') {
            if (labelPc(g.label) !== it[0].pc) errs.push(`beat ${grp.b}: labelled ${g.label}, expected ${NAMES[it[0].pc]}`);
            // on the first three notes a wrong key first: it shakes, and the song waits (three slips still leave the
            // pass above 90%, three stars)
            const w = done < 3 ? await page.evaluate(wrongNow) : null;
            if (w) {
              await touch.down(2, w.x, w.y); await sleep(ins.win[1] + 15); await touch.up(2); await sleep(60);
              const after = await page.evaluate(() => { const sg = window.PocketBandTest.songs.state(); return { i: sg.wEv && sg.wEv.i, shakes: sg.shakes || 0 }; });
              if (after.i !== w.i) errs.push(`beat ${grp.b}: a wrong key (${NAMES[pc(w.m)]}) moved the song on`);
              else if (after.shakes <= w.shakes) errs.push(`beat ${grp.b}: a wrong key (${NAMES[pc(w.m)]}) did not shake`);
              else wrongs++;
            }
            const [m] = await playAndMeasure(page, touch, [lit[0]], { hold: ins.win[1] + 15, gap: 40, win: ins.win, fmin: type === 'bass' ? 28 : 40, fmax: ins.tab === 'xylo' ? 4200 : 2600 });
            if (!(m.f > 0)) errs.push(`beat ${grp.b}: touching the glowing target made no sound`);
            else {
              const got = midiOf(m.f); worst = Math.max(worst, Math.abs(100 * (got - Math.round(got))));
              if (pc(Math.round(got)) !== it[0].pc) errs.push(`beat ${grp.b}: the glowing target plays ${NAMES[pc(Math.round(got))]}, expected ${NAMES[it[0].pc]}`);
            }
          } else if (type === 'chords') {
            const t = lit[0];
            if (t.what !== it[0].chord) errs.push(`beat ${grp.b}: the ${t.what} button glows, expected ${it[0].chord}`);
            if (!g.label.startsWith(it[0].chord) || !g.label.includes(it[0].dir > 0 ? '↓' : '↑')) errs.push(`beat ${grp.b}: labelled "${g.label}", expected ${it[0].chord} ${it[0].dir > 0 ? '↓' : '↑'}`);
            if (!t.pad || t.pad.dir !== it[0].dir) errs.push(`beat ${grp.b}: the ${it[0].dir > 0 ? 'Down' : 'Up'} strum pad is not lit`);
            await touch.tap(t.x, t.y, 40); await sleep(30);
            if (t.pad) await touch.tap(t.pad.x, t.pad.y, 40);
          } else {
            const got = lit.map((x) => x.what).sort().join(' ');
            const exp = it.map((x) => type === 'tabla' ? x.stroke : ins.tab === 'epad' ? PAD_NAMES[x.pad].find((n) => names.includes(n)) : x.pad).sort().join(' ');
            if (got !== exp) errs.push(`beat ${grp.b}: ${got} glow, expected ${exp}`);
            if (type === 'tabla' && !g.label.startsWith(it[0].bol)) errs.push(`beat ${grp.b}: labelled "${g.label}", expected ${it[0].bol}`);
            // every glowing pad or zone at once, one finger each
            for (let k = 0; k < lit.length; k++) await touch.down(10 + k, lit[k].x, lit[k].y);
            await sleep(40);
            for (let k = 0; k < lit.length; k++) await touch.up(10 + k);
          }
          await sleep(60);
          done++;
          if (errs.length > 3) break;
        }
        await sleep(200);
        const end = await page.evaluate(() => ({ res: document.getElementById('sgResult').textContent, best: (() => { try { return localStorage.getItem('pb-songs'); } catch (e) { return null; } })() }));
        if (!errs.length && !/★★★/.test(end.res)) errs.push(`finished without three stars ("${end.res}")`);
        if (!errs.length && !(end.best || '').includes(tr.id + '|' + ins.tab + '|wait')) errs.push('best score not saved');
        const what = { melody: 'notes', bass: 'notes', chords: 'strums', drums: 'beats', tabla: 'matras and strokes' }[type];
        return row('songs', ins.tab, !errs.length, (errs.length ? errs.slice(0, 3).join('; ') + ' · ' : '') +
          `train (Wait, "${tr.title}"): ${done} of ${groups.length} ${what}: the right ` +
          ({ melody: 'key, hole or spot glowed and was named; a wrong key first shook and the song waited (' + wrongs + ' times); touching the right one played that note (measured, worst ' + worst.toFixed(1) + ' cents)',
            bass: 'string and fret glowed and was named; a wrong spot first shook and the song waited (' + wrongs + ' times); touching the right one played that note (measured, worst ' + worst.toFixed(1) + ' cents)',
            chords: 'chord button and strum pad glowed, named with the arrow; choosing it and strumming', drums: 'pads glowed; hitting them together',
            tabla: 'zones glowed, named by their bol; striking them' })[type] +
          ` moved the song on; finished with ${end.res || 'no score'}, best score saved`, { part: 'train', steps: done, wrongs });
      } catch (e) { return row('songs', ins.tab, false, 'train: ' + e.message.split('\n')[0]); } finally { await cur.context.close(); }
    }
  }));
  return pool(browser, base, tasks, workers);
}

/* align: the falling bars, the glow and the badges stay on their keys at every screen size */
const VIEWPORTS = [[568, 320], [667, 375], [800, 380], [915, 412], [1280, 720]];
// In the page: one look at the Rhythm strip and the instrument
function alignNow() {
  const S = window.PocketBandTest.songs, sg = S.state(), strip = document.getElementById('sgStrip').getBoundingClientRect(), errs = [];
  const view = [...document.querySelectorAll('.stage .view')].find((v) => v.offsetParent), V = view.getBoundingClientRect();
  const top = (() => { const inner = view.firstElementChild ? view.firstElementChild.getBoundingClientRect() : V; return Math.max(V.top, inner.top); })();
  if (Math.abs(top - strip.bottom) > 12) errs.push(`the hit-line is ${(top - strip.bottom).toFixed(0)} px above the instrument`);
  const byI = {}; sg.plan.ev.forEach((e) => { byI[e.i] = e; });
  let worst = 0, painted = 0;
  const cv = document.getElementById('sgStripCv'), g = cv.getContext('2d'), k = cv.width / strip.width;
  sg.bars.forEach((b) => {
    const e = byI[b.i], c = S.point(e.tg), w = e.tg.el ? e.tg.el.getBoundingClientRect().width : 26, off = Math.abs(b.left + b.x - c.x);
    worst = Math.max(worst, off);
    if (off > 1) errs.push(`bar ${b.i + 1} is ${off.toFixed(1)} px off its ${e.lab} (drawn at ${(b.left + b.x).toFixed(0)}, key at ${c.x.toFixed(0)}, scroll ${view.scrollLeft}/${view.scrollWidth - view.clientWidth}, frame age ${(performance.now() - sg.barsAt).toFixed(0)} ms)`);
    if (b.w > w + 0.5) errs.push(`bar ${b.i + 1} is wider (${b.w.toFixed(0)} px) than its key (${w.toFixed(0)} px)`);
    // and the bar really is painted there, in its key's colour (just above its lower edge, off its label)
    const y = b.y - 3, x = b.x + b.w / 2 - 4;
    if (y > 2 && y < strip.height - 44 && x > 0 && x < strip.width) { // (clear of the feedback words over the hit-line)
      const p = g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data, m = /(\d+)\D+(\d+)\D+(\d+)/.exec(e.tg.col ? e.tg.col.fill : '');
      if (m && Math.max(Math.abs(p[0] - m[1]), Math.abs(p[1] - m[2]), Math.abs(p[2] - m[3])) > 40) errs.push(`bar ${b.i + 1}: the strip shows rgb(${p[0]},${p[1]},${p[2]}) where its ${e.tg.col.fill} bar should be`);
      else painted++;
    }
  });
  // a keyboard's keys stay in order while they glow (a glowing key must not jump out of its place)
  const keys = [...view.querySelectorAll('[data-midi]')].filter((k) => k.closest('.manual') === view.querySelector('[data-midi]').closest('.manual'));
  const xs = keys.map((k) => [+k.dataset.midi, k.getBoundingClientRect()]).sort((a, b) => a[0] - b[0]);
  for (let j = 1; j < xs.length; j++) if (xs[j][1].left + xs[j][1].width / 2 <= xs[j - 1][1].left + xs[j - 1][1].width / 2) { errs.push(`key ${xs[j][0]} is out of place (left of ${xs[j - 1][0]})`); break; }
  // what glows is the next note due (and is on screen)
  sg.glow.forEach((tg) => {
    if (!tg.el) return;
    const r = tg.el.getBoundingClientRect();
    if (r.right < V.left - 1 || r.left > V.right + 1) errs.push('a glowing key is scrolled out of view');
  });
  return { bars: sg.bars.length, painted, worst, errs, glow: sg.glow.length, strip: strip.height };
}
function badgeNow() {
  const S = window.PocketBandTest.songs, sg = S.state(), tag = document.getElementById('sgTag'), errs = [];
  if (!sg.glow.length) return { errs: ['nothing glows in Wait'] };
  const tg = sg.glow[0], t = tag.getBoundingClientRect(), cx = t.left + t.width / 2;
  if (!tag.classList.contains('show')) errs.push('no badge');
  if (tg.el) { const r = tg.el.getBoundingClientRect(); if (cx < r.left - 1 || cx > r.right + 1) errs.push(`the badge (x ${cx.toFixed(0)}) is off its key (${r.left.toFixed(0)}-${r.right.toFixed(0)})`); }
  else { const c = S.point(tg); if (Math.abs(cx - c.x) > 2 && cx > 30 && cx < innerWidth - 30) errs.push('the badge is off its spot'); }
  return { errs, label: tag.textContent };
}
async function alignRows(browser, base, workers, tabs) {
  const lib = loadTracks();
  const melodic = pickList(tabs).filter((i) => typeOf(i.tab) === 'melody' || typeOf(i.tab) === 'bass');
  const tasks = melodic.map((ins) => ({
    tab: ins.tab, check: 'songs', fresh: true,
    run: async () => {
      const id = typeOf(ins.tab) === 'bass' ? 'bs-canon' : ins.tab === 'piano' ? 'danube' : 'ode', errs = [], seen = [];
      let bars = 0, painted = 0, worst = 0, scrolled = false;
      for (const [w, h] of VIEWPORTS) {
        const cur = await openWithHooks(browser, base, ins.tab, 'try { localStorage.setItem("pb-trainhint", "1"); } catch (e) {}', { width: w, height: h });
        try {
          await cur.page.evaluate(async (id) => {
            const P = window.PocketBandTest, S = P.songs, lib = await S.load();
            P.init(); S.open(lib.find((t) => t.id === id), 'train', 'rhythm');
          }, id);
          for (let k = 0; k < 7; k++) {
            await sleep(450);
            const a = await cur.page.evaluate(alignNow);
            bars += a.bars; painted += a.painted; worst = Math.max(worst, a.worst);
            a.errs.forEach((e) => errs.push(`${w}x${h}: ${e}`));
          }
          scrolled = scrolled || await cur.page.evaluate(() => { const v = document.querySelector('.view.zoomed'); return !!v && v.scrollWidth > v.clientWidth + 1; });
          // Wait: the big badge sits on the glowing key
          await cur.page.selectOption('#sgMode', 'wait');
          await sleep(150);
          const b = await cur.page.evaluate(badgeNow);
          b.errs.forEach((e) => errs.push(`${w}x${h} Wait: ${e}`));
          seen.push(`${w}x${h}`);
        } catch (e) { errs.push(`${w}x${h}: ${e.message.split('\n')[0]}`); } finally { await cur.context.close(); }
        if (errs.length > 4) break;
      }
      if (!bars) errs.push('no bars fell');
      else if (painted < bars / 3) errs.push(`only ${painted} of ${bars} bars could be found painted on the strip`);
      return row('songs', ins.tab, !errs.length, (errs.length ? [...new Set(errs)].slice(0, 3).join('; ') + ' · ' : '') +
        `align (Rhythm, "${lib.find((t) => t.id === id).title}", ${seen.join(', ')}): ${bars} falling bars checked, each centred on its target within ${worst.toFixed(1)} px and no wider (${painted} read back from the strip's pixels in their key's colour); ` +
        `the hit-line sits on the instrument; what glows is on screen; the Wait badge sits on its key` + (scrolled ? '; the zoomed keyboard scrolled sideways on the narrow screens and stayed aligned' : ''),
        { part: 'align', bars, worstPx: +worst.toFixed(2) });
    }
  }));
  return pool(browser, base, tasks, workers);
}

/* stop: Stop, closing the song, Home and switching all leave silence */
async function stopRows(browser, base, workers, tabs) {
  const lib = loadTracks();
  const tasks = pickList(tabs).map((ins) => ({
    tab: ins.tab, check: 'songs', fresh: true,
    run: async () => {
      const type = typeOf(ins.tab), id = type === 'melody' ? 'ode' : lib.filter((t) => t.type === type)[1].id;
      const cur = await openWithHooks(browser, base, ins.tab);
      const { page, touch } = cur, res = {};
      try {
        await dryReverb(page);
        const sr = await page.evaluate(() => { window.PocketBandTest.init(); return window.PocketBandTest.ctx().sampleRate; });
        const start = async () => {
          if (await page.evaluate(() => document.body.dataset.screen) !== 'play') await openFromGallery(page, touch, ins.tab);
          await dryReverb(page);
          await tapSel(page, touch, '#songs');
          await page.waitForSelector(`.sgitem[data-id="${id}"]`);
          await setCount(page, false);
          await tapSel(page, touch, `.sgitem[data-id="${id}"] [data-go="auto"]`);
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
          const f0 = await nowFrame(page);
          const during = await stats(page, f0 - Math.round(0.8 * sr), f0);
          await fn();
          const f1 = await nowFrame(page);
          await sleep(1400);
          const s = await stats(page, f1 + Math.round(1.0 * sr), f1 + Math.round(1.25 * sr));
          const v = await page.evaluate(() => window.__pbStats().voices);
          res[way] = { after: Math.max(...s.frames), voices: v, during: during.peak };
        }
        const bad = Object.entries(res).filter(([, r]) => r.after > -60 || r.voices > 0), silent = Object.entries(res).filter(([, r]) => !(r.during > -50));
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
    await hintOk(page, touch);
    for (let i = 0; i < 30; i++) {
      const g = await page.evaluate(glowNow);
      if (!g || !g.targets) break;
      await touch.tap(g.targets[0].x, g.targets[0].y, 90); await sleep(50);
    }
    const res = await page.evaluate(() => document.getElementById('sgResult').textContent);
    if (!/★/.test(res)) errs.push(`no score shown ("${res}")`);
    if (log.errors.length) errs.push('console errors: ' + log.errors.slice(0, 2).join(' / '));
  } catch (e) { errs.push(e.message.split('\n')[0]); }
  await cur.context.close();
  return [row('songs', '-', !errs.length, (errs.length ? errs.join('; ') + ' · ' : '') + 'storage blocked: the sheet opens, a song trains to the end and scores, no errors')];
}

export default async function songs({ browser, base, workers, tabs, progress }) {
  const rows = [];
  rows.push(...trackRows());
  for (const [name, fn] of [['fit', () => fitRows(browser, base, workers, tabs)], ['transpose', () => transposeRows(browser, base, workers, tabs)],
    ['autoplay', () => autoplayRows(browser, base, workers, tabs)],
    ['timing', () => timingRows(browser, base, tabs)], ['train', () => trainRows(browser, base, workers, tabs)], ['align', () => alignRows(browser, base, workers, tabs)],
    ['stop', () => stopRows(browser, base, workers, tabs)], ['storage', () => storageRows(browser, base)]]) {
    if (process.env.SONGS_PARTS && !process.env.SONGS_PARTS.split(',').includes(name)) continue;
    if (progress) progress('songs: ' + name);
    try { rows.push(...await fn()); } catch (e) { rows.push(row('songs', '-', false, name + ' crashed: ' + (e && e.stack || e).split('\n').slice(0, 3).join(' '))); }
  }
  return rows;
}
