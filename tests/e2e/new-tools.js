// Runs every example of the newer tools through the real UI (worker) and checks results, plots and console errors.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const MODES = ['laplace', 'vector', 'stats', 'number', 'units', 'complex', 'matrix'];
(async () => {
    const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await p.goto(BASE); await p.waitForTimeout(1500);
    let fail = 0, ok = 0;
    for (const mode of MODES) {
        await p.click(`[data-mode="${mode}"]`);
        const n = await p.locator('#examples option').count();
        for (let i = 1; i < n; i++) {
            await p.selectOption('#examples', { index: i }); await p.waitForTimeout(150);
            await p.waitForFunction(() => !document.getElementById('computeBtn').classList.contains('loading'), null, { timeout: 30000 });
            await p.waitForTimeout(250);
            const label = (await p.locator('#examples option').nth(i).textContent()).trim();
            const bad = await p.locator('#results .alert-error').count();
            const card = await p.locator('#results .result-card').count();
            let plotOk = 'n/a';
            if (card && !bad) { await p.click('#tab-plot'); await p.waitForTimeout(300); plotOk = await p.evaluate(() => { const d = document.getElementById('plot2d'); return d.querySelector('.empty-state') ? 'empty' : (d.data && d.data.length ? 'ok' : 'none'); }); await p.click('#tab-results'); }
            const good = card && !bad;
            if (good) ok++; else { fail++; console.log('FAIL', mode, label, bad ? (await p.locator('#results .alert-error').first().textContent()).slice(0, 120) : 'no card'); }
            if (good && plotOk === 'none') console.log('  note: no plot data for', mode, label);
        }
    }
    console.log(`${ok} examples ok, ${fail} failed`);
    if (errs.length) { console.log('console errors:', errs.slice(0, 5)); fail++; }
    await b.close(); process.exit(fail ? 1 : 0);
})();
