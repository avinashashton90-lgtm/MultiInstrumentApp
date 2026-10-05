// Every instrument the app has, and how a test plays it. Add a row here when an instrument is added: the whole
// suite (load, gallery, pitch, loudness, stuck notes, note limit, performance, self-test) picks it up.
//   kind: 'row' (a row of note buttons), 'board' (strings with snap points), 'keys' (a keyboard with scale lock),
//         'chords' (chord buttons and strings), 'perc' (no pitch)
//   pitched: has key and scale. brass: breath-driven brass or reed (spectral and crackle checks).
//   hold: how long a test note is held (ms). win: the part of a note measured for pitch, ms after touch-down.
export const INSTRUMENTS = [
  { tab: 'piano', name: 'Piano', kind: 'keys', pitched: true, win: [70, 200] },
  { tab: 'drums', name: 'Drums', kind: 'perc' },
  { tab: 'guitar', name: 'Guitar', kind: 'chords', pitched: true, win: [60, 220], strum: true },
  { tab: 'flute', name: 'Flute', kind: 'row', pitched: true, win: [110, 220] },
  { tab: 'tabla2', name: 'Tabla (dual)', kind: 'perc' },
  { tab: 'tabla1', name: 'Tabla (single)', kind: 'perc' },
  { tab: 'epad', name: 'Electric drum pad', kind: 'perc' },
  { tab: 'harmonica', name: 'Harmonica', kind: 'row', pitched: true, win: [90, 220] },
  { tab: 'violin', name: 'Violin', kind: 'board', pitched: true, win: [110, 230], bowed: true },
  { tab: 'cello', name: 'Cello', kind: 'board', pitched: true, win: [150, 260], bowed: true },
  { tab: 'horn', name: 'French horn', kind: 'row', pitched: true, win: [150, 260], brass: true },
  { tab: 'trumpet', name: 'Trumpet', kind: 'row', pitched: true, win: [110, 230], brass: true },
  { tab: 'viola', name: 'Viola', kind: 'board', pitched: true, win: [130, 250], bowed: true },
  { tab: 'organ', name: 'Pipe organ', kind: 'keys', pitched: true, win: [90, 220] },
  { tab: 'sax', name: 'Saxophone', kind: 'row', pitched: true, win: [120, 240], brass: true },
  { tab: 'xylo', name: 'Xylophone', kind: 'row', pitched: true, win: [12, 110] },
  { tab: 'synth', name: 'Synth', kind: 'keys', pitched: true, win: [80, 210] },
  { tab: 'ebass', name: 'Electric bass', kind: 'board', pitched: true, win: [60, 220] },
  { tab: 'rhythm', name: 'Rhythm guitar', kind: 'chords', pitched: true, win: [40, 200], strum: true }
];
export const PITCHED = INSTRUMENTS.filter((i) => i.pitched);
export const byTab = (tab) => INSTRUMENTS.find((i) => i.tab === tab);

// In the page: where to touch for each playable note of the current key and scale, with the label it shows.
// Runs with page.evaluate(noteTargets, { tab, lock }). Only reads the screen, as a person would.
export function noteTargets({ tab }) {
  const $ = (s) => document.querySelector(s), all = (s, r) => [...(r || document).querySelectorAll(s)];
  const ctr = (el, fy = 0.5) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * fy }; };
  const txt = (el) => (el.querySelector('b') || el).firstChild ? ((el.querySelector('b') || el).firstChild.textContent || '').trim() : '';
  const out = [];
  const push = (el, fy, label, info) => { const c = ctr(el, fy); out.push({ x: c.x, y: c.y, label: label === undefined ? txt(el) : label, info: info || '' }); };
  if (tab === 'piano' || tab === 'organ' || tab === 'synth') {
    // every key of one octave from the root, and the top root: scale keys play themselves, the others (with
    // Scale lock on) the nearest scale note
    const sel = { piano: '#piano', organ: '#man0', synth: '#synKeys' }[tab];
    const keys = all(sel + ' [data-midi]').sort((a, b) => +a.dataset.midi - +b.dataset.midi);
    const r0 = keys.findIndex((k) => k.classList.contains('root'));
    keys.slice(r0, r0 + 13).forEach((k) => {
      const black = k.classList.contains('bkey') || k.classList.contains('sharp');
      const c = ctr(k, tab === 'piano' ? (black ? 0.4 : 0.8) : 0.6);
      out.push({ x: c.x, y: c.y, label: k.dataset.name, info: k.classList.contains('insc') ? 'scale key' : 'off-scale key', midi: +k.dataset.midi, insc: k.classList.contains('insc') });
    });
  } else if (tab === 'harmonica') {
    all('#harp .hcol').slice(0, 5).forEach((c, i) => {
      push(c.children[0], 0.5, c.children[0].firstChild.textContent.trim(), 'blow ' + (i + 1));
      push(c.children[2], 0.5, c.children[2].firstChild.textContent.trim(), 'draw ' + (i + 1));
    });
  } else if (tab === 'violin' || tab === 'viola' || tab === 'cello' || tab === 'ebass') {
    const rows = all(tab === 'ebass' ? '#ebass .brow' : '#bowed .brow'), row = rows[tab === 'ebass' ? 3 : 1];
    const rr = row.getBoundingClientRect();
    all(tab === 'ebass' ? '.fmark' : '.bmark', row).forEach((mk) => { const c = ctr(mk); out.push({ x: c.x, y: rr.top + rr.height / 2, label: mk.querySelector('b').textContent.trim(), info: 'string ' + (tab === 'ebass' ? 4 : 2) }); });
  } else if (tab === 'guitar') {
    all('#neck .gstr').forEach((s, i) => { if (!s.classList.contains('mute')) push(s, 0.5, s.lastChild.textContent.trim(), 'string ' + (i + 1)); });
  } else if (tab === 'rhythm') {
    const r = $('#rneck').getBoundingClientRect();
    out.push({ x: r.left + r.width * 0.5, y: r.top + r.height * 0.5, label: $('#rchords [aria-pressed="true"]').textContent.trim(), info: 'strum' });
  } else {
    const cells = all({ flute: '#flute .fcell', horn: '#horn .hcell', trumpet: '#tptRow .wcell', sax: '#saxRow .wcell', xylo: '#xylo .xbar' }[tab]);
    const n = cells.findIndex((c, i) => i > 0 && c.classList.contains('root')) + 1 || cells.length;
    cells.slice(0, n).forEach((c) => push(c, tab === 'xylo' ? 0.6 : 0.55, c.firstChild.textContent.trim()));
  }
  return out;
}
