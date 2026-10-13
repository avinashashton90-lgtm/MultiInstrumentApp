#!/usr/bin/env node
// Draws the Android launcher icons and splash images for Pocket Band from simple shapes, so every size is sharp.
// Runs on every Android build (see .github/workflows/android.yml); the results are also committed so Android Studio works.
// No packages needed: the shapes are drawn with anti-aliased signed distances and saved with Node's own zlib.
//
//   node tools/make-android-icons.mjs                    writes the icons into android/app/src/main/res
//   node tools/make-android-icons.mjs --design=bold      uses the alternative design instead
//   node tools/make-android-icons.mjs --preview=out.png  also saves a preview of both designs
//
// Designs:
//   classic  the existing Pocket Band icon (icon-512.png): five cream keys with a gold middle key on dark green
//   bold     three big keys and two black keys on an orange-to-pink gradient
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const DESIGN = 'classic'; // the design used for the app; --design= overrides it
const SPLASH_BG = '#EFE9DC'; // the app's own background colour (manifest background_color)
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// ---------- colours ----------
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// ---------- shapes (signed distance in pixels: negative inside) ----------
function roundRect(x, y, w, h, r) {
  const cx = x + w / 2, cy = y + h / 2, hw = w / 2 - r, hh = h / 2 - r;
  return (px, py) => {
    const dx = Math.abs(px - cx) - hw, dy = Math.abs(py - cy) - hh;
    const ox = Math.max(dx, 0), oy = Math.max(dy, 0);
    return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r;
  };
}
const circle = (cx, cy, r) => (px, py) => Math.hypot(px - cx, py - cy) - r;
function squircle(cx, cy, r) { // the superellipse many launchers use as their mask
  return (px, py) => {
    const x = Math.abs(px - cx) / r, y = Math.abs(py - cy) / r;
    return (Math.pow(x ** 4 + y ** 4, 0.25) - 1) * r;
  };
}

// ---------- paints ----------
const solid = (hex) => { const c = rgb(hex); return () => c; };
function linear(x0, y0, x1, y1, hex0, hex1) {
  const a = rgb(hex0), b = rgb(hex1), dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
  return (px, py) => {
    const t = Math.min(1, Math.max(0, ((px - x0) * dx + (py - y0) * dy) / len2));
    return a.map((v, i) => v + (b[i] - v) * t);
  };
}

// ---------- canvas ----------
class Canvas {
  constructor(w, h, bg) {
    this.w = w; this.h = h; this.d = new Float32Array(w * h * 4); // premultiplied RGBA, 0..1
    if (bg) this.fill(() => -1e9, solid(bg));
  }
  // Paints a shape. op 'over' paints on top, 'erase' cuts a hole, 'mask' keeps only what is inside.
  fill(sdf, paint, op = 'over', alpha = 1) {
    const d = this.d;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const cov = Math.min(1, Math.max(0, 0.5 - sdf(x + 0.5, y + 0.5))) * alpha;
      const i = (y * this.w + x) * 4;
      if (op === 'mask') { for (let k = 0; k < 4; k++) d[i + k] *= cov; continue; }
      if (cov <= 0) continue;
      if (op === 'erase') { for (let k = 0; k < 4; k++) d[i + k] *= 1 - cov; continue; }
      const c = paint(x + 0.5, y + 0.5);
      for (let k = 0; k < 3; k++) d[i + k] = (c[k] / 255) * cov + d[i + k] * (1 - cov);
      d[i + 3] = cov + d[i + 3] * (1 - cov);
    }
    return this;
  }
  draw(src, ox, oy) { // composites another canvas at a whole-pixel offset
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const tx = x + ox, ty = y + oy;
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
      const s = (y * src.w + x) * 4, t = (ty * this.w + tx) * 4, a = src.d[s + 3];
      for (let k = 0; k < 4; k++) this.d[t + k] = src.d[s + k] + this.d[t + k] * (1 - a);
    }
    return this;
  }
  scaleUp(n) { // nearest-neighbour enlargement, for showing real pixels in the preview
    const c = new Canvas(this.w * n, this.h * n);
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
      const s = (((y / n) | 0) * this.w + ((x / n) | 0)) * 4, t = (y * c.w + x) * 4;
      for (let k = 0; k < 4; k++) c.d[t + k] = this.d[s + k];
    }
    return c;
  }
  png(opaque = false) {
    const ch = opaque ? 3 : 4, row = this.w * ch + 1, raw = Buffer.alloc(row * this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = (y * this.w + x) * 4, a = this.d[i + 3], o = y * row + 1 + x * ch;
      for (let k = 0; k < 3; k++) raw[o + k] = Math.round(Math.min(1, a > 0 ? this.d[i + k] / a : 0) * 255);
      if (!opaque) raw[o + 3] = Math.round(a * 255);
    }
    const head = Buffer.alloc(13);
    head.writeUInt32BE(this.w, 0); head.writeUInt32BE(this.h, 4);
    head[8] = 8; head[9] = opaque ? 2 : 6;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  }
}
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function chunk(type, data) {
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  let c = -1; for (const b of td) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  const out = Buffer.alloc(td.length + 8);
  out.writeUInt32BE(data.length, 0); td.copy(out, 4); out.writeUInt32BE((c ^ -1) >>> 0, td.length + 4);
  return out;
}

// ---------- the designs ----------
// Each glyph is drawn in its own units inside a box; place() maps it into a canvas at (x, y) with a pixel width.
const DESIGNS = {
  classic: {
    // Measured from icon-512.png: keys 51 wide with 5 gaps, 232 tall, corner 10; slots 35 wide, gold key on top
    box: [275, 232],
    background: '#1D2A2A',
    paintBg: () => solid('#1D2A2A'),
    glyph(c, u, mono) {
      for (let i = 0; i < 5; i++) c.fill(u.rect(i * 56, 0, 51, 232, 10), solid('#FFFDF7'));
      for (const x of [53.5, 109.5, 221.5]) c.fill(u.rect(x - 17.5, -20, 35, 160, 8), null, 'erase');
      c.fill(u.rect(112, 0, 51, 232, 10), solid(mono ? '#FFFFFF' : '#F2B134'));
    },
  },
  bold: {
    // Three big keys and two black keys: chunkier, so it still reads as a keyboard at 32 px
    box: [300, 240],
    background: null, // a gradient, drawn as the background layer
    paintBg: (w, h) => linear(0, 0, w, h, '#FF9A1F', '#E5306E'),
    glyph(c, u, mono) {
      for (let i = 0; i < 3; i++) c.fill(u.rect(i * 104, 0, 92, 240, 16), solid('#FFFDF7'));
      for (const x of [98, 202]) {
        c.fill(u.rect(x - 34, -20, 68, 172, 14), null, 'erase'); // a gap round each black key
        if (!mono) c.fill(u.below(0, u.rect(x - 27, -20, 54, 165, 11)), solid('#1D2A2A'));
      }
    },
  },
};

// Draws a design's glyph so its box is `width` px wide, centred on (cx, cy)
function drawGlyph(c, design, cx, cy, width, mono = false) {
  const [bw, bh] = design.box, s = width / bw, ox = cx - width / 2, oy = cy - (bh * s) / 2;
  const u = {
    rect: (x, y, w, h, r) => roundRect(ox + x * s, oy + y * s, w * s, h * s, r * s),
    below: (y, sdf) => (px, py) => Math.max(sdf(px, py), oy + y * s - py), // the part of a shape below a line
  };
  // Drawn on its own layer so the cut-outs only cut the glyph, never the background under it
  const layer = new Canvas(c.w, c.h);
  design.glyph(layer, u, mono);
  return c.draw(layer, 0, 0);
}
const bgPaint = (design, w, h) => design.paintBg(w, h);

// A full icon tile: background shape plus glyph. glyphShare = glyph width as a share of the tile.
function tile(design, size, shape, glyphShare = 0.6) {
  const c = new Canvas(size, size);
  const sdf = shape === 'circle' ? circle(size / 2, size / 2, size / 2)
    : shape === 'squircle' ? squircle(size / 2, size / 2, size / 2)
    : roundRect(0, 0, size, size, size * (shape === 'square' ? 0 : 0.18));
  c.fill(sdf, bgPaint(design, size, size));
  drawGlyph(c, design, size / 2, size / 2, size * glyphShare);
  return c;
}

// Adaptive icon: a 108 dp layer, of which a 72 dp middle shows and a 66 dp circle is always safe.
// The glyph is 50 dp wide, so even its corners stay inside the 66 dp safe circle.
const ADAPT = 108, GLYPH_DP = 50;
function adaptiveForeground(design, k, mono = false) {
  const n = Math.round(ADAPT * k), c = new Canvas(n, n);
  return drawGlyph(c, design, n / 2, n / 2, GLYPH_DP * k, mono);
}
function adaptiveBackground(design, k) {
  const n = Math.round(ADAPT * k);
  return new Canvas(n, n).fill(() => -1e9, bgPaint(design, n, n));
}
// What the launcher shows: the 72 dp middle of both layers, under the launcher's mask
function adaptivePreview(design, size, mask) {
  const k = size / 72, full = Math.round(ADAPT * k), off = Math.round((full - size) / 2);
  const both = adaptiveBackground(design, k).draw(adaptiveForeground(design, k), 0, 0);
  const c = new Canvas(size, size).draw(both, -off, -off);
  const sdf = mask === 'circle' ? circle(size / 2, size / 2, size / 2) : mask === 'squircle'
    ? squircle(size / 2, size / 2, size / 2) : roundRect(0, 0, size, size, size * 0.18);
  return c.fill(sdf, null, 'mask');
}

// ---------- write the Android resources ----------
function write(file, buf) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf); }

function writeAndroid(design) {
  const legacyShare = (GLYPH_DP / 72) * 0.92;
  for (const [d, k] of Object.entries(DENS)) {
    const dir = path.join(RES, 'mipmap-' + d);
    write(path.join(dir, 'ic_launcher_foreground.png'), adaptiveForeground(design, k).png());
    write(path.join(dir, 'ic_launcher_monochrome.png'), adaptiveForeground(design, k, true).png());
    const bgFile = path.join(dir, 'ic_launcher_background.png');
    if (design.background) fs.rmSync(bgFile, { force: true });
    else write(bgFile, adaptiveBackground(design, k).png(true));
    // Android 7 and older use these plain 48 dp icons
    write(path.join(dir, 'ic_launcher.png'), tile(design, Math.round(48 * k), 'rounded', legacyShare).png());
    write(path.join(dir, 'ic_launcher_round.png'), tile(design, Math.round(48 * k), 'circle', legacyShare).png());
  }
  const bgRef = design.background ? '@color/ic_launcher_background' : '@mipmap/ic_launcher_background';
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Made by tools/make-android-icons.mjs; edit that script instead of this file -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="${bgRef}"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;
  for (const f of ['ic_launcher.xml', 'ic_launcher_round.xml']) write(path.join(RES, 'mipmap-anydpi-v26', f), xml);
  write(path.join(RES, 'values', 'ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<!-- Made by tools/make-android-icons.mjs; edit that script instead of this file -->
<resources>
    <color name="ic_launcher_background">${design.background || '#E5306E'}</color>
    <color name="splash_background">${SPLASH_BG}</color>
</resources>
`);
  // Splash images for older Android (Android 12 and newer draw the launcher icon on splash_background themselves)
  const splash = (W, H, k) => {
    const c = new Canvas(W, H, SPLASH_BG), n = Math.round(112 * k);
    return c.draw(adaptivePreview(design, n, 'circle'), Math.round((W - n) / 2), Math.round((H - n) / 2));
  };
  for (const [orient, [w, h]] of Object.entries({ land: [480, 320], port: [320, 480] }))
    for (const [d, k] of Object.entries(DENS))
      write(path.join(RES, `drawable-${orient}-${d}`, 'splash.png'), splash(Math.round(w * k), Math.round(h * k), k).png(true));
  write(path.join(RES, 'drawable', 'splash.png'), splash(480, 480, 1).png(true));
}

// ---------- preview: each design under circle, squircle and rounded masks, at real launcher sizes, and the splash ----------
function writePreview(file) {
  const rows = Object.values(DESIGNS), pad = 24, cell = 168;
  const W = pad + 3 * (cell + pad) + 3 * (96 + pad) + 240 + pad, H = pad + rows.length * (cell + pad);
  const c = new Canvas(W, H, '#F4F4F4');
  rows.forEach((design, r) => {
    const y = pad + r * (cell + pad);
    let x = pad;
    for (const m of ['circle', 'squircle', 'rounded']) { c.draw(adaptivePreview(design, cell, m), x, y); x += cell + pad; }
    // Real 48, 36 and 24 px icons (mdpi phone sizes), shown enlarged pixel for pixel
    for (const [s, z] of [[48, 2], [36, 2], [24, 4]]) {
      const big = adaptivePreview(design, s, 'circle').scaleUp(z);
      c.draw(big, x + Math.round((96 - big.w) / 2), y + Math.round((cell - big.h) / 2)); x += 96 + pad;
    }
    const sp = new Canvas(240, cell, SPLASH_BG);
    sp.draw(adaptivePreview(design, 84, 'circle'), 78, Math.round((cell - 84) / 2));
    c.draw(sp, x, y);
  });
  write(file, c.png(true));
}

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const name = arg('design') || DESIGN;
if (!DESIGNS[name]) { console.error(`make-android-icons: unknown design "${name}" (choose ${Object.keys(DESIGNS).join(' or ')})`); process.exit(1); }
writeAndroid(DESIGNS[name]);
console.log(`make-android-icons: wrote the "${name}" launcher icons, round icons, monochrome icons and splash images`);
const prev = arg('preview');
if (prev) { writePreview(path.resolve(prev)); console.log(`make-android-icons: preview saved to ${prev}`); }
