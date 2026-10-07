// Check 1. The page loads with no console errors and no failed requests; the swipe gallery opens every instrument
// (swiped to and tapped, as a person does) and the Home button brings the gallery back.
import { openApp, openFromGallery, sleep } from '../harness.mjs';
import { INSTRUMENTS } from '../instruments.mjs';
import { row } from '../common.mjs';

// The app's only outside request is its web font; without internet the system font is used instead
const OPTIONAL = /fonts\.(googleapis|gstatic)\.com/;

export default async function load({ browser, base, tabs }) {
  const rows = [];
  const { page, touch, log, context } = await openApp(browser, base, { tab: null });
  await sleep(800);
  const own = (l) => l.filter((x) => !OPTIONAL.test(x));
  const screen = await page.evaluate(() => document.body.dataset.screen);
  const cards = await page.evaluate(() => [...document.querySelectorAll('.card')].map((c) => c.dataset.tab));
  const missing = INSTRUMENTS.filter((i) => !cards.includes(i.tab)).map((i) => i.name);
  rows.push(row('load', '-', screen === 'home' && !own(log.errors).length && !own(log.failed).length && !missing.length,
    [screen !== 'home' ? 'did not start on the gallery' : 'opens on the gallery', `${cards.length} cards`,
      missing.length ? 'missing cards: ' + missing.join(', ') : '',
      own(log.errors).length ? 'console errors: ' + own(log.errors).slice(0, 2).join(' / ') : 'no console errors',
      own(log.failed).length ? 'failed requests: ' + own(log.failed).slice(0, 2).join(' / ') : 'no failed requests',
      log.failed.length > own(log.failed).length ? '(web font not reachable here; the system font is used)' : ''].filter(Boolean).join(', ')));
  for (const ins of INSTRUMENTS) {
    if (tabs && !tabs.includes(ins.tab)) continue;
    const e0 = own(log.errors).length;
    try {
      await openFromGallery(page, touch, ins.tab);
      const name = await page.evaluate(() => document.getElementById('iname').textContent);
      await sleep(150);
      const hb = await page.locator('#home').boundingBox();
      await touch.tap(hb.x + hb.width / 2, hb.y + hb.height / 2);
      await page.waitForFunction(() => document.body.dataset.screen === 'home', null, { timeout: 2000 });
      const errs = own(log.errors).slice(e0);
      rows.push(row('load', ins.tab, name === ins.name && !errs.length,
        name !== ins.name ? `opened "${name}"` : errs.length ? 'console error: ' + errs[0] : 'swiped to, opened from the gallery, Home returned'));
    } catch (e) {
      rows.push(row('load', ins.tab, false, (e.message || String(e)).split('\n')[0]));
    }
  }
  await context.close();

  // The in-app Self-test page (Settings > Self-test): it opens from Settings, its automatic check runs and every
  // instrument passes, the guided sound check plays a note, and the results copy out as text
  if (!tabs) {
    const st = await openApp(browser, base, { tab: '' });
    try {
      const sp = st.page;
      const href = await sp.evaluate(() => { const a = document.getElementById('selftest'); return a && a.getAttribute('href'); });
      await sp.goto(base + href, { waitUntil: 'load' });
      await sp.click('#runAuto');
      await sp.waitForFunction(() => !document.getElementById('runAuto').disabled, null, { timeout: 180000 });
      const res = await sp.evaluate(() => window.__selftest.results().map((r) => ({ name: r.name, pass: r.pass, problems: r.problems })));
      await sp.click('#runSongs');
      await sp.waitForFunction(() => !document.getElementById('runSongs').disabled, null, { timeout: 300000 });
      const songs = await sp.evaluate(() => window.__selftest.songs().map((r) => ({ name: r.name, pass: r.pass, problems: r.problems })));
      const sbad = songs.filter((r) => !r.pass);
      await sp.click('[data-play="piano"]'); await sleep(800);
      const played = await sp.evaluate(() => document.getElementById('guidedStatus').textContent);
      const text = await sp.evaluate(() => window.__selftest.report());
      const bad = res.filter((r) => !r.pass), errs = own(st.log.errors);
      rows.push(row('load', 'selftest', res.length === INSTRUMENTS.length && !bad.length && songs.length === INSTRUMENTS.length && !sbad.length && !played && !errs.length && /1\. Automatic check/.test(text) && /2\. Songs check/.test(text),
        [`Self-test page: automatic check ${res.length - bad.length}/${res.length} passed`, bad.map((r) => r.name + ': ' + r.problems.join('; ')).join(' / '),
          `songs check ${songs.length - sbad.length}/${songs.length} passed`, sbad.map((r) => r.name + ': ' + r.problems.join('; ')).join(' / '),
          played ? 'sound check: ' + played : 'sound check plays', errs.length ? 'console errors: ' + errs[0] : '', 'report copies as text'].filter(Boolean).join(', ')));
    } catch (e) {
      rows.push(row('load', 'selftest', false, 'Self-test page: ' + (e.message || String(e)).split('\n')[0]));
    }
    await st.context.close();
  }
  return rows;
}
