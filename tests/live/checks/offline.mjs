// Check 10. Offline and install: after one visit the service worker has cached the app, and with the network cut
// the app still opens, an instrument still plays and the Self-test page still loads. The manifest must be valid
// (name, start URL, display, 192 and 512 px icons that really are those sizes) and the service worker's cache
// version must match the version the app shows in Settings.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, openApp, sleep, waitAudio, openFromGallery } from '../harness.mjs';
import { row } from '../common.mjs';
import { noteTargets } from '../instruments.mjs';

export default async function offline({ browser, base }) {
  const rows = [], errs = [], info = [];
  // versions on disk
  const swV = +(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/pocket-band-v(\d+)/) || [])[1];
  const appV = +(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/APP_VERSION = (\d+)/) || [])[1];
  if (!swV || swV !== appV) errs.push(`sw.js cache is v${swV} but index.html says APP_VERSION ${appV}`);
  const files = JSON.parse((fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/FILES = (\[[^\]]*\])/) || [])[1].replace(/'/g, '"'));
  const missing = files.filter((f) => f !== './' && !fs.existsSync(path.join(ROOT, f)));
  if (missing.length) errs.push('sw.js lists files that do not exist: ' + missing.join(', '));

  const cur = await openApp(browser, base, { tab: '', serviceWorkers: 'allow' });
  const { page, context, touch } = cur;
  try {
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) { await page.reload({ waitUntil: 'load' }); await page.evaluate(() => navigator.serviceWorker.ready); }
    const st = await page.evaluate(async () => {
      const keys = await caches.keys(), out = { keys, version: window.__pbStats().version, shown: document.getElementById('ver').textContent, cached: [] };
      for (const k of keys) { const c = await caches.open(k); out.cached.push(...(await c.keys()).map((r) => new URL(r.url).pathname)); }
      return out;
    });
    const want = 'pocket-band-v' + st.version;
    if (!st.keys.includes(want)) errs.push(`cache ${want} not found (have ${st.keys.join(', ') || 'none'})`);
    if (st.shown !== 'v' + st.version) errs.push(`Settings shows ${st.shown}, the app is v${st.version}`);
    const notCached = files.filter((f) => f !== './' && !st.cached.some((p) => p.endsWith(f.slice(1))));
    if (notCached.length) errs.push('not cached after the first visit: ' + notCached.join(', '));
    info.push(`cache ${st.keys.join(', ')} holds ${st.cached.length} files, Settings shows ${st.shown}`);

    // the manifest
    const man = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]');
      if (!link) return { error: 'no <link rel="manifest">' };
      const res = await fetch(link.href), m = await res.json(), icons = [];
      for (const ic of m.icons || []) {
        const img = new Image(); img.src = new URL(ic.src, link.href).href;
        await img.decode().catch(() => {});
        icons.push({ src: ic.src, sizes: ic.sizes, w: img.naturalWidth, h: img.naturalHeight });
      }
      return { m, icons };
    });
    if (man.error) errs.push(man.error);
    else {
      for (const k of ['name', 'short_name', 'start_url', 'display']) if (!man.m[k]) errs.push(`manifest has no ${k}`);
      for (const s of ['192x192', '512x512']) if (!man.icons.some((i) => i.sizes === s)) errs.push(`manifest has no ${s} icon`);
      for (const i of man.icons) if (i.sizes !== `${i.w}x${i.h}`) errs.push(`icon ${i.src} says ${i.sizes} but is ${i.w}x${i.h}`);
      info.push(`manifest OK (${man.m.display}, ${man.icons.length} icons)`);
    }

    // cut the network: the app, an instrument and the self-test must still work
    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    if (await page.evaluate(() => document.body.dataset.screen) !== 'home') errs.push('offline: the app did not open on Home');
    await openFromGallery(page, touch, 'piano');
    const t = await page.evaluate(noteTargets, { tab: 'piano' });
    await touch.tap(t[0].x, t[0].y, 200);
    await waitAudio(page);
    const f = await page.evaluate(() => window.__rec.now());
    await touch.down(1, t[4].x, t[4].y); await sleep(300); await touch.up(1);
    const lvl = await page.evaluate((f) => { const x = window.__rec.get(f, window.__rec.now()); let p = 0; for (const v of x) p = Math.max(p, Math.abs(v)); return 20 * Math.log10(p + 1e-9); }, f);
    if (lvl < -40) errs.push(`offline: the piano made no sound (${lvl.toFixed(0)} dBFS)`);
    else info.push(`offline: opens, piano plays (${lvl.toFixed(0)} dBFS peak)`);
    const sp = await context.newPage();
    const resp = await sp.goto(base + 'selftest.html', { waitUntil: 'load' }).catch((e) => ({ status: () => 0, err: e.message }));
    const title = await sp.title().catch(() => '');
    if (!/self-test/i.test(title)) errs.push(`offline: selftest.html did not load (${resp && resp.status ? resp.status() : '?'})`);
    else info.push('Self-test page loads offline');
    await context.setOffline(false);
  } catch (e) {
    errs.push('error: ' + e.message.split('\n')[0]);
  }
  await context.close();
  rows.push(row('offline', '-', !errs.length, (errs.length ? errs.join('; ') + ' · ' : '') + info.join(', ')));
  return rows;
}
