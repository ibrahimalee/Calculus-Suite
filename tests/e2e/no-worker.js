// Without Web Workers the page computes on its own thread: it must fetch the full engine first and still give full answers.
const { chromium } = require('playwright');
const BASE = process.env.BASE_ROOT || process.env.BASE || 'http://localhost:8099';
(async () => {
    const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
    const p = await (await b.newContext({ serviceWorkers: 'block' })).newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { delete window.Worker; });
    await p.goto(BASE + '/app.html?tool=integral&ask=' + encodeURIComponent('integrate x e^x'));
    await p.waitForSelector('.result-content .tex.rendered', { timeout: 30000 });
    const t = await p.textContent('.result-content');
    ok(/e/.test(t) && /x/.test(t), 'an integral that needs the computer algebra system is answered without a worker');
    ok(/main thread/.test(await p.textContent('#engineStatus')), 'the status bar says it runs on the main thread');
    ok(await p.evaluate(() => typeof window.Algebrite !== 'undefined'), 'the full engine was fetched on demand');
    ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
    await b.close(); process.exit(bad ? 1 : 0);
})();
