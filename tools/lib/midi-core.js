// MIDI-CORE-BEGIN
// The MIDI reader and track converter shared by the app ("Add my song") and the build tools (tools/midi-to-track.mjs).
// tools/sync-core.mjs pastes the same text into index.html between the MIDI-CORE markers; the tests check they match.
// No libraries: reads a Standard MIDI File (format 0 or 1) and turns one part of it into a Pocket Band track.
var MidiCore = (function () {
  'use strict';
  var NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  // Major-key tonic for each key signature (number of sharps, negative for flats)
  var SF_MAJOR = { '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F', 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#' };
  var SF_MINOR = { '-7': 'Ab', '-6': 'Eb', '-5': 'Bb', '-4': 'F', '-3': 'C', '-2': 'G', '-1': 'D', 0: 'A', 1: 'E', 2: 'B', 3: 'F#', 4: 'C#', 5: 'G#', 6: 'D#', 7: 'A#' };
  var STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  // Krumhansl-Kessler key profiles
  var KK_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  var KK_MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  var EPS = 1e-6;
  function r4(x) { return Math.round(x * 10000) / 10000; }
  function pcOf(name) { return (STEP[name[0]] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0) + 12) % 12; }

  /* ---------- Reading the file ---------- */
  // bytes: Uint8Array. Returns { format, ppq, notes: [{ tr, ch, on, off, m, v }] in ticks, tempos: [[tick, usPerQuarter]],
  // times: [[tick, num, den]], keys: [[tick, sharps, minor]], names: { track: name }, programs: { 'tr:ch': program } }
  function parse(bytes) {
    var p = 0;
    function u8() { if (p >= bytes.length) throw new Error('The file ends too early'); return bytes[p++]; }
    function u16() { return (u8() << 8) | u8(); }
    function u32() { return ((u8() << 24) >>> 0) + (u8() << 16) + (u8() << 8) + u8(); }
    function str(n) { var s = ''; for (var i = 0; i < n; i++) s += String.fromCharCode(u8()); return s; }
    function vlq() { var v = 0, b, k = 0; do { b = u8(); v = (v << 7) | (b & 127); if (++k > 4) throw new Error('Bad length in the file'); } while (b & 128); return v; }
    if (str(4) !== 'MThd') throw new Error('This is not a MIDI file');
    var hlen = u32(), format = u16(), ntr = u16(), div = u16();
    p += hlen - 6;
    if (div & 0x8000) throw new Error('SMPTE timing is not supported');
    var out = { format: format, ppq: div, notes: [], tempos: [], times: [], keys: [], names: {}, programs: {} };
    for (var t = 0; t < ntr && p < bytes.length; t++) {
      var id = str(4), len = u32(), end = p + len;
      if (id !== 'MTrk') { p = end; t--; continue; }
      var tick = 0, run = 0, open = {};
      while (p < end) {
        tick += vlq();
        var st = bytes[p];
        if (st & 0x80) { p++; if (st < 0xf0) run = st; } else st = run;
        if (st === 0xff) {
          var type = u8(), l = vlq(), at = p;
          if (type === 0x51 && l === 3) out.tempos.push([tick, (bytes[p] << 16) | (bytes[p + 1] << 8) | bytes[p + 2]]);
          else if (type === 0x58 && l >= 2) out.times.push([tick, bytes[p], Math.pow(2, bytes[p + 1])]);
          else if (type === 0x59 && l >= 2) out.keys.push([tick, bytes[p] > 127 ? bytes[p] - 256 : bytes[p], bytes[p + 1]]);
          else if (type === 0x03 && out.names[t] === undefined) out.names[t] = str(l);
          p = at + l;
        } else if (st === 0xf0 || st === 0xf7) { p += vlq(); }
        else {
          var hi = st & 0xf0, ch = st & 15, a = u8(), b = (hi === 0xc0 || hi === 0xd0) ? 0 : u8();
          var key = ch + ':' + a;
          if (hi === 0x90 && b > 0) (open[key] = open[key] || []).push({ tr: t, ch: ch, on: tick, m: a, v: b });
          else if (hi === 0x80 || (hi === 0x90 && b === 0)) {
            var q = open[key];
            if (q && q.length) { var n = q.shift(); n.off = tick; if (n.off > n.on) out.notes.push(n); }
          } else if (hi === 0xc0 && out.programs[t + ':' + ch] === undefined) out.programs[t + ':' + ch] = a;
        }
      }
      Object.keys(open).forEach(function (k) { open[k].forEach(function (n) { n.off = tick; if (n.off > n.on) out.notes.push(n); }); });
      p = end;
    }
    out.notes.sort(function (x, y) { return x.on - y.on || y.m - x.m; });
    out.tempos.sort(function (x, y) { return x[0] - y[0]; });
    out.times.sort(function (x, y) { return x[0] - y[0]; });
    out.keys.sort(function (x, y) { return x[0] - y[0]; });
    return out;
  }

  // The parts of a file: one per track and channel that has notes (drum channel 10 left out), with what a person
  // choosing the melody needs to see
  function parts(mid) {
    var map = {}, list = [];
    mid.notes.forEach(function (n) {
      if (n.ch === 9) return;
      var k = n.tr + ':' + n.ch, s = map[k];
      if (!s) { s = map[k] = { key: k, tr: n.tr, ch: n.ch, name: mid.names[n.tr] || '', n: 0, lo: 127, hi: 0, sum: 0, chords: 0, first: n.on }; list.push(s); }
      s.n++; s.lo = Math.min(s.lo, n.m); s.hi = Math.max(s.hi, n.m); s.sum += n.m;
    });
    list.forEach(function (s) {
      s.mean = s.sum / s.n; delete s.sum;
      var ons = {}; mid.notes.forEach(function (n) { if (n.tr === s.tr && n.ch === s.ch) ons[n.on] = (ons[n.on] || 0) + 1; });
      var k = Object.keys(ons); s.chords = k.filter(function (o) { return ons[o] > 1; }).length / Math.max(1, k.length);
      var nm = (s.name || '').replace(/^[\s:]+|[\s:]+$/g, '');
      s.label = (nm || 'Track ' + (s.tr + 1)) + (list.filter(function (x) { return x.tr === s.tr; }).length > 1 ? ' (channel ' + (s.ch + 1) + ')' : '');
    });
    return list;
  }
  // The likeliest melody: the part that sits highest and plays mostly single notes
  function guessMelody(list) {
    var best = null, bs = -1e9;
    list.forEach(function (s) { var sc = s.mean - 20 * s.chords + Math.min(10, s.n / 10); if (sc > bs) { bs = sc; best = s; } });
    return best;
  }
  function partNotes(mid, sel) {
    var keys = [].concat(sel);
    return mid.notes.filter(function (n) { return keys.indexOf(n.tr + ':' + n.ch) >= 0; });
  }

  /* ---------- One line of notes from a part ---------- */
  // top: true keeps the highest note of each chord (a melody), false the lowest (a bass line). A note held under a
  // newer one is cut where the newer one starts, so the line is one note at a time.
  function line(notes, top) {
    var groups = [], g = null;
    notes.slice().sort(function (a, b) { return a.on - b.on; }).forEach(function (n) {
      if (g && n.on === g.on) { if (top ? n.m > g.n.m : n.m < g.n.m) g.n = n; }
      else groups.push(g = { on: n.on, n: n });
    });
    var out = [];
    groups.forEach(function (x, i) {
      var nx = groups[i + 1], off = x.n.off;
      if (nx && nx.on < off) off = nx.on;
      out.push({ on: x.n.on, off: off, m: x.n.m, v: x.n.v, src: x.n });
    });
    return out;
  }

  /* ---------- Timing ---------- */
  function tempoAt(mid, tick) { var us = 500000; mid.tempos.forEach(function (t) { if (t[0] <= tick) us = t[1]; }); return 60000000 / us; }
  function timeAt(mid, tick) { var s = [4, 4]; mid.times.forEach(function (t) { if (t[0] <= tick) s = [t[1], t[2]]; }); return s; }
  function keySigAt(mid, tick) { var k = null; mid.keys.forEach(function (t) { if (t[0] <= tick) k = { sf: t[1], minor: !!t[2] }; }); return k; }
  // Light quantising: an onset or an end moves to the nearest sixteenth or triplet eighth, if one is within a
  // 24th of a beat; otherwise to the nearest 24th. Notes written exactly (an engraved score) don't move at all.
  function snap(b) {
    var a = Math.round(b * 4) / 4, c = Math.round(b * 3) / 3, best = Math.abs(a - b) <= Math.abs(c - b) ? a : c;
    return Math.abs(best - b) <= 1 / 24 + EPS ? best : Math.round(b * 24) / 24;
  }

  /* ---------- Key and mode ---------- */
  // Duration-weighted pitch classes against the Krumhansl-Kessler profiles. A key signature in the file decides
  // between a major key and its relative minor's neighbours: only those two keys are compared then. The last note
  // counts too: a tune that ends on a key's tonic gets a small bonus for that key.
  function corr(w, prof, tonic) {
    var mw = 0, mp = 0, i; for (i = 0; i < 12; i++) { mw += w[i] / 12; mp += prof[i] / 12; }
    var num = 0, dw = 0, dp = 0;
    for (i = 0; i < 12; i++) { var a = w[(i + tonic) % 12] - mw, b = prof[i] - mp; num += a * b; dw += a * a; dp += b * b; }
    return dw && dp ? num / Math.sqrt(dw * dp) : 0;
  }
  function detectKey(notes, sig, lastPc) {
    var w = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    notes.forEach(function (n) { w[n.m % 12] += Math.max(0.05, n.d); });
    var cands = [], best = null, t;
    for (t = 0; t < 12; t++) { cands.push({ tonic: t, mode: 'major' }); cands.push({ tonic: t, mode: 'minor' }); }
    cands.forEach(function (c) {
      c.score = corr(w, c.mode === 'major' ? KK_MAJ : KK_MIN, c.tonic) + (lastPc === c.tonic ? 0.15 : 0);
      // the written key signature, if the notes agree with it: the key it names (its major, or its minor when the file
      // says minor) counts most, the relative key a little
      if (sig && ((c.mode === 'major' && SF_MAJOR[sig.sf] && pcOf(SF_MAJOR[sig.sf]) === c.tonic) || (c.mode === 'minor' && SF_MINOR[sig.sf] && pcOf(SF_MINOR[sig.sf]) === c.tonic))) {
        c.score += (c.mode === 'minor') === sig.minor ? 0.25 : 0.1; c.name = c.mode === 'major' ? SF_MAJOR[sig.sf] : SF_MINOR[sig.sf];
      }
      if (!best || c.score > best.score) best = c;
    });
    if (!best.name) best.name = keyName(best.tonic, best.mode);
    return best;
  }
  // The tonic's name as a key signature would spell it (F major, B♭ major, F♯ minor)
  function keyName(tonic, mode) {
    var maj = mode === 'major' ? tonic : (tonic + 3) % 12;
    var flats = [5, 10, 3, 8, 1, 6].indexOf(maj) >= 0 && maj !== 6;
    return (flats ? NAMES_FLAT : NAMES_SHARP)[tonic];
  }
  function spell(pc, keyNm, mode) {
    var sf = null;
    Object.keys(mode === 'minor' ? SF_MINOR : SF_MAJOR).forEach(function (k) { if ((mode === 'minor' ? SF_MINOR : SF_MAJOR)[k] === keyNm) sf = +k; });
    return (sf !== null && sf < 0 ? NAMES_FLAT : NAMES_SHARP)[pc];
  }

  /* ---------- Chords from the harmony ---------- */
  // For each half bar (each bar in 3/4, 6/8 and shorter bars) the major or minor triad that best covers every
  // sounding note, weighted by how long it sounds, the lowest note counting double. Two halves with the same chord
  // become one. The result is one string a bar, as the track format wants ("C", "G C", "-" for silence).
  var TRI = [{ q: '', iv: [0, 4, 7], pen: 0 }, { q: 'm', iv: [0, 3, 7], pen: 0 }, { q: '7', iv: [0, 4, 7, 10], pen: 0.1 }, { q: 'dim', iv: [0, 3, 6], pen: 0.3 }];
  // diatonic: only the seven chords of the key (what a guitar's chord buttons offer), each span getting the nearest
  var KEY_TRIADS = { major: [[0, ''], [2, 'm'], [4, 'm'], [5, ''], [7, ''], [9, 'm'], [11, 'dim']],
    minor: [[0, 'm'], [2, 'dim'], [3, ''], [5, 'm'], [7, 'm'], [8, ''], [10, '']] };
  function chordsOf(all, bars, per, keyNm, mode, tonic, pickup, diatonic) {
    var out = [], allowed = diatonic ? (KEY_TRIADS[mode] || KEY_TRIADS.major).map(function (d) { return ((d[0] + tonic) % 12) + d[1]; }) : null;
    for (var b = 0; b < bars; b++) {
      var halves = per >= 4 && per % 2 === 0 ? 2 : 1, syms = [];
      for (var h = 0; h < halves; h++) {
        var s = b * per + h * per / halves, e = s + per / halves, w = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], low = null, any = false;
        all.forEach(function (n) {
          var a = Math.max(s, n.b), z = Math.min(e, n.b + n.d);
          if (z - a <= EPS) return;
          any = true; w[n.m % 12] += z - a;
          if (n.b <= s + EPS && (!low || n.m < low.m)) low = n;
        });
        if (!low) all.forEach(function (n) { if (n.b + n.d > s + EPS && n.b < e - EPS && (!low || n.m < low.m)) low = n; });
        if (!any) { syms.push('-'); continue; }
        if (low) w[low.m % 12] += per / halves * 0.5;
        var best = null;
        for (var r = 0; r < 12; r++) TRI.forEach(function (t) {
          if (allowed && allowed.indexOf(r + t.q) < 0) return;
          var sc = 0, tot = 0;
          for (var i = 0; i < 12; i++) { tot += w[i]; if (t.iv.indexOf((i - r + 12) % 12) >= 0) sc += w[i]; }
          sc = sc - 0.6 * (tot - sc) + (low && low.m % 12 === r ? 0.25 * per / halves : 0) - (diatonic && t.q === 'dim' ? 0.8 : t.pen) * per / halves; // a strummer rarely wants the diminished chord
          // chords built on the key's own steps win a tie
          var deg = (r - tonic + 12) % 12, dia = mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10, 11];
          if (dia.indexOf(deg) >= 0) sc += 0.05;
          if (!best || sc > best.sc + EPS) best = { sc: sc, sym: spell(r, keyNm, mode) + t.q };
        });
        syms.push(best.sym);
      }
      // a pickup bar where only the tune's first notes sound has no chord
      if (b === 0 && pickup && pickup.length && all.filter(function (n) { return n.b < per - EPS; }).length <= pickup.length) syms = ['-'];
      if (syms.length === 2 && syms[0] === syms[1]) syms = [syms[0]];
      out.push(syms.join(' '));
    }
    return out;
  }

  /* ---------- Sections ---------- */
  // Splits the bars into sections of 4 to 8 bars, ending each where the tune breathes: a bar whose last note is long
  // (a beat or more) or a rest. Sections of 4 or 8 bars are preferred. Returns [[firstBar, lastBar], ...], 1-based.
  function sections(notes, bars, per) {
    if (bars <= 8) return [[1, bars]];
    var breathe = [];
    for (var b = 1; b <= bars; b++) {
      var s = (b - 1) * per, e = b * per, last = null;
      notes.forEach(function (n) { if (n.b >= s - EPS && n.b < e - EPS) last = n; });
      breathe[b] = !last || last.d >= Math.min(1, per / 2) - EPS || last.b + last.d < e - EPS;
    }
    var cost = [0], from = [];
    for (var i = 1; i <= bars; i++) {
      cost[i] = Infinity;
      for (var len = 2; len <= 8; len++) {
        var j = i - len;
        if (j < 0 || cost[j] === Infinity) continue;
        var c = cost[j] + (len === 4 || len === 8 ? 0 : len < 4 ? (i === bars ? 3 : 20) : 2) + (breathe[i] ? 0 : 4);
        if (c < cost[i]) { cost[i] = c; from[i] = j; }
      }
    }
    var out = [], k = bars;
    while (k > 0) { out.unshift([from[k] + 1, k]); k = from[k]; }
    return out;
  }

  /* ---------- Converting ---------- */
  // opts: melody, bass (part keys "track:channel"; the melody defaults to the likeliest part, the bass to the lowest
  // notes of every other part), start (the file's beat, in quarter notes, where the excerpt's first full bar starts;
  // default: the bar where the melody starts), lead (beats of pickup before it to keep, default 0), bars (full bars
  // to take; default: to the end), tempo (overrides the file's), octave (semitones added, whole octaves), grace
  // (true keeps grace notes; by default notes shorter than a 16th of a beat are ornaments and left out), end (the
  // file's beat after which no new note starts: where a first-time ending is followed by the second one).
  // Returns the track's musical fields and a map back to the file: srcBeat is the file's beat at the track's beat 0.
  function convert(mid, opts) {
    opts = opts || {};
    var list = parts(mid);
    if (!list.length) throw new Error('No notes in this file');
    var mel = opts.melody ? [].concat(opts.melody) : [guessMelody(list).key];
    var ppq = mid.ppq, minLen = opts.grace ? 0 : 1 / 16;
    // the line's notes in beats, not yet quantised (that happens relative to the excerpt's first bar, below)
    function beats(arr, top) {
      return line(arr.filter(function (n) { return (n.off - n.on) / ppq >= minLen - EPS; }), top)
        .map(function (n) { return { b: n.on / ppq, e: n.off / ppq, m: n.m, v: n.v }; });
    }
    var raw = beats(partNotes(mid, mel), true);
    if (!raw.length) throw new Error('The melody part has no notes');
    var start = opts.start;
    if (start === undefined) { var t0 = timeAt(mid, 0), p0 = t0[0] * 4 / t0[1]; start = Math.floor(raw[0].b / p0 + EPS) * p0; }
    var time = timeAt(mid, Math.round(start * ppq)), per = time[0] * 4 / time[1], lead = opts.lead || 0;
    if (lead > per + EPS) throw new Error('The pickup is longer than a bar');
    var last = 0; raw.forEach(function (n) { if (n.e > last) last = n.e; });
    var nb = opts.bars || Math.max(1, Math.ceil((last - start) / per - EPS));
    var from = start - lead, to = Math.min(start + nb * per, opts.end === undefined ? Infinity : opts.end), base = start - (lead > EPS ? per : 0);
    var shift = opts.octave || 0;
    var stop = start + nb * per - base, Q = 1 / 48;
    function cut(arr) {
      return arr.filter(function (n) { return n.b >= from - Q && n.b < to - Q; }).map(function (n) {
        var b = Math.max(0, snap(n.b - base)), e = Math.min(snap(n.e - base), stop);
        return { b: r4(b), d: r4(e - b), m: n.m + shift, v: n.v };
      }).filter(function (n) { return n.d > EPS; });
    }
    var notes = cut(raw);
    if (!notes.length) throw new Error('The melody has no notes in those bars');
    var bars = nb + (lead > EPS ? 1 : 0);
    var others = list.filter(function (s) { return mel.indexOf(s.key) < 0; }).map(function (s) { return s.key; });
    var bassKeys = opts.bass ? [].concat(opts.bass) : others;
    var bass = bassKeys.length ? cut(beats(partNotes(mid, bassKeys), false)) : [];
    var allNotes = cut(mid.notes.filter(function (n) { return n.ch !== 9 && (n.off - n.on) / ppq >= minLen - EPS; })
      .map(function (n) { return { b: n.on / ppq, e: n.off / ppq, m: n.m, v: n.v }; }));
    var tick0 = Math.round(start * ppq);
    var sig = opts.keySig === false ? null : keySigAt(mid, tick0), key = detectKey(allNotes.length ? allNotes : notes, sig, notes[notes.length - 1].m % 12);
    var tempo = opts.tempo || Math.round(tempoAt(mid, tick0));
    return {
      tempo: tempo, time: time, key: key.name, tonic: key.tonic, mode: key.mode, bars: bars,
      notes: notes.map(function (n) { return [n.b, n.d, n.m, Math.max(1, Math.min(127, n.v))]; }),
      low: bass.map(function (n) { return [n.b, n.d, n.m, Math.max(1, Math.min(127, n.v))]; }),
      chords: chordsOf(allNotes, bars, per, key.name, key.mode, key.tonic, lead > EPS ? notes.filter(function (n) { return n.b < per - EPS; }) : []),
      keyChords: chordsOf(allNotes, bars, per, key.name, key.mode, key.tonic, lead > EPS ? notes.filter(function (n) { return n.b < per - EPS; }) : [], true),
      sections: sections(notes, bars, per),
      map: { melody: mel, bass: bassKeys, srcBeat: r4(base), octave: shift, start: start, lead: lead, grace: !!opts.grace, end: opts.end }
    };
  }

  function name(m) { return NAMES_SHARP[m % 12] + (Math.floor(m / 12) - 1); }

  return { parse: parse, parts: parts, guessMelody: guessMelody, partNotes: partNotes, line: line, snap: snap, detectKey: detectKey,
    keyName: keyName, chordsOf: chordsOf, sections: sections, convert: convert, tempoAt: tempoAt, timeAt: timeAt, name: name };
})();
// MIDI-CORE-END
if (typeof module !== 'undefined') module.exports = MidiCore;
