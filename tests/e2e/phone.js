// Phone layout: long answers wrap instead of being cut off, the More menu stays on screen, the home question box keeps its height.
const { chromium } = require('playwright');
const BASE = process.env.BASE_ROOT || process.env.BASE || 'http://localhost:8099';
(async () => {
    const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
    const p = await (await b.newContext({ viewport: { width: 375, height: 740 }, serviceWorkers: 'block' })).newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/app.html?tool=integral&ask=' + encodeURIComponent('integrate x^2 sin(x)'));
    await p.waitForSelector('.result-content .tex.rendered', { timeout: 20000 });
    const fit = await p.evaluate(() => { const el = document.querySelector('.result-content .tex-display'), box = el.querySelector('.katex-display') || el; return { wrap: el.classList.contains('tex-wrap'), over: box.scrollWidth - box.clientWidth }; });
    ok(fit.wrap && fit.over <= 1, 'a long answer wraps onto more lines on a phone (overflow ' + fit.over + 'px)');
    await p.click('.more-menu summary'); await p.waitForTimeout(150);
    const r = await p.evaluate(() => { const x = document.querySelector('.more-list').getBoundingClientRect(); return { l: x.left, r: x.right }; });
    ok(r.l >= 0 && r.r <= 375, 'the More menu opens fully on screen');
    await p.click('[data-act="copytex"]');
    ok(!(await p.evaluate(() => document.querySelector('.more-menu').open)), 'choosing an item closes the menu');
    await p.goto(BASE + '/index.html');
    ok((await p.evaluate(() => document.getElementById('q').getBoundingClientRect().height)) >= 44, 'the home question box keeps its height on a phone');
    ok(errs.length === 0, 'no page errors');
    await b.close(); process.exit(bad ? 1 : 0);
})();
