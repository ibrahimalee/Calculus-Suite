// Home page checks: figure responds, tool index links, ask hand-off, old share links forward, no horizontal overflow.
const { chromium } = require('playwright');
const BASE = process.env.BASE_ROOT || 'http://localhost:8099';
(async () => {
  const b = await chromium.launch(); let bad = 0;
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
  for (const w of [375, 820, 1366]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 800 } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `no horizontal overflow at ${w}px`);
    ok(errs.length === 0, `no page errors at ${w}px`);
    if (w === 1366) {
      await p.mouse.move(420, 240); await p.mouse.move(520, 260);
      const a = await p.textContent('#rX'); await p.mouse.move(700, 260);
      ok(a !== await p.textContent('#rX'), 'figure readout follows the pointer');
      ok(await p.$$eval('#toc a', e => e.length) === 26, 'tool index lists all 26 tools');
      await p.click('#chips button >> nth=0'); await p.waitForURL(/app\.html\?ask=/);
      await p.waitForFunction(() => document.querySelector('#results .result-content'), null, { timeout: 30000 });
      ok(true, 'ask chip opens the app and computes');
      await p.goto(BASE + '/index.html#s=abc'); await p.waitForURL(/app\.html#s=abc/); ok(true, 'old share links forward to the app');
    }
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
