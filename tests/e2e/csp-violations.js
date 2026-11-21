// Runs the main features under the real Content-Security-Policy and fails on any violation report, so a library that
// quietly needs eval (or anything else the policy forbids) is caught even when it fails silently.
const { chromium } = require('playwright');
const BASE = process.env.BASE_ROOT || process.env.BASE || 'http://localhost:8099';
(async () => {
    const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
    const v = [];
    const page = async () => {
        const p = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } })).newPage();
        await p.exposeFunction('__csp', x => v.push(x));
        await p.addInitScript(() => document.addEventListener('securitypolicyviolation', e => window.__csp(`${location.pathname}: ${e.violatedDirective} ${e.blockedURI} ${(e.sourceFile || '').split('/').pop()}:${e.lineNumber}`), true));
        return p;
    };
    const app = await page();
    await app.goto(BASE + '/app.html'); await app.waitForFunction(() => window.__calc);
    for (const [tool, q] of [['integral', 'x*e^x'], ['series', 'sin(x)'], ['ode', 'y*(1-y)'], ['algebra', '(x+1)/(x^2-4)'], ['matrix', '2 1 ; 1 2'], ['complex', 'z^2+1']]) {
        await app.evaluate(([t, s]) => { window.__calc.setMode(t); document.getElementById('functionInput').value = s; }, [tool, q]);
        await app.click('#computeBtn'); await app.waitForTimeout(1500);
    }
    await app.evaluate(() => { window.__calc.setMode('graph'); document.getElementById('functionInput').value = 'sin(x)'; }); await app.click('#computeBtn');
    await app.click('[data-tab="plot"]'); await app.waitForSelector('#plot .main-svg', { timeout: 20000 });
    await app.evaluate(() => { window.__calc.setMode('multivariable'); document.getElementById('functionInput').value = 'sin(x)*cos(y)'; }); await app.click('#computeBtn'); await app.waitForTimeout(1500);
    await app.click('[data-tab="plot3d"]'); await app.waitForTimeout(3000);
    await app.click('#practiceBtn'); await app.waitForSelector('#pracProblem .prob-id', { timeout: 20000 }); await app.keyboard.press('Escape');
    ok(await app.evaluate(() => !!document.querySelector('#plot .main-svg')), 'the 2D plot was drawn (so Plotly really ran)');
    const t = await page();
    await t.goto(BASE + '/teacher.html'); await t.click('#exampleBtn'); await t.click('#linkBtn'); await t.waitForSelector('#linkBox:not([hidden])');
    const link = await t.inputValue('#linkOut');
    const s = await page();
    await s.goto(link.replace(/^https?:\/\/[^/]+/, BASE)); await s.waitForTimeout(800);
    if (await s.isVisible('#startBtn')) { await s.fill('#stuName', 'Test Student'); await s.click('#startBtn'); }
    await s.waitForSelector('#qs .q');
    ok(v.length === 0, 'no Content-Security-Policy violations on the app, teacher and student pages' + (v.length ? ': ' + v.slice(0, 5).join(' | ') : ''));
    await b.close(); process.exit(bad ? 1 : 0);
})();
