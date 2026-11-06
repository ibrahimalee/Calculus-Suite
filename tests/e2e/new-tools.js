// Runs every example of the newer tools through the real UI (worker) and checks results, plots and console errors.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const MODES = ['laplace', 'vector', 'stats', 'number', 'units', 'complex', 'matrix', 'ode', 'sums'];
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
    // camera/image input: the recogniser must not be fetched until the user scans, and must read printed text
    {
        const reqs = []; p.on('request', r => reqs.push(r.url()));
        const lazy = !reqs.some(u => /tesseract/.test(u));
        const mk = await (await b.newContext({ viewport: { width: 900, height: 200 } })).newPage();
        await mk.setContent('<body style="margin:0;background:#fff"><div style="font:64px Arial;padding:50px;color:#111">sin(x)/x</div></body>');
        const file = require('os').tmpdir() + '/cs-scan-test.png'; await mk.screenshot({ path: file });
        await p.click('#scanBtn'); await p.setInputFiles('#scanFile', file);
        await p.waitForFunction(() => /Done|No text|Could not|could not/.test(document.getElementById('scanStatus').textContent), null, { timeout: 120000 });
        const text = await p.inputValue('#scanText');
        const read = /sin\s*\(x\)\s*\/\s*x/i.test(text);
        console.log(`scan: lazy-loaded=${lazy}, text=${JSON.stringify(text)}`);
        if (!lazy || !read) { fail++; console.log('FAIL scan check'); } else ok++;
        await p.click('#scanClose');
    }
    // practice mode: every topic must accept its own answer through the real UI and persist the score
    {
        await p.click('#practiceBtn'); await p.waitForTimeout(300);
        const topics = await p.$$eval('#pracTopic option', o => o.map(x => x.value));
        for (const t of topics) for (const lvl of ['1', '3']) {
            await p.selectOption('#pracTopic', t); await p.selectOption('#pracLevel', lvl); await p.waitForTimeout(200);
            const id = await p.evaluate(() => +/#(\d+)/.exec(document.querySelector('#pracProblem .prob-id').textContent)[1]);
            const ans = await p.evaluate(([t, l, id]) => { const E = CalcEngine.create(math, Algebrite); CalcExtras.install(E, math, Algebrite); return Practice.create(E, math).generate(t, +l, id).answerText.replace(/\s*\+\s*C$/, ''); }, [t, lvl, id]);
            await p.fill('#pracAnswer', ans + (t === 'integral' ? ' + C' : '')); await p.press('#pracAnswer', 'Enter'); await p.waitForTimeout(150);
            const good = await p.locator('#pracFeedback.good').count();
            if (good) ok++; else { fail++; console.log('FAIL practice', t, lvl, JSON.stringify(ans), (await p.textContent('#pracFeedback')).slice(0, 80)); }
            await p.click('#pracHint'); await p.waitForTimeout(100);
        }
        const stat = await p.textContent('#pracStats'); console.log('practice stats:', stat);
        await p.click('#practiceClose');
    }
    // interface languages: switching translates the chrome, sets text direction and can be undone
    {
        const pick = async l => { await p.click('#appearBtn'); await p.selectOption('#langSelect', l); await p.waitForTimeout(300); await p.keyboard.press('Escape'); };
        await pick('es'); const es = (await p.textContent('#tab-results')).trim();
        await pick('ar'); const dir = await p.evaluate(() => document.documentElement.dir); const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        await pick('en'); const en = (await p.textContent('#tab-results')).trim();
        const good = es === 'Resultados' && dir === 'rtl' && over <= 1 && en === 'Results';
        console.log(`i18n: es=${es} dir=${dir} overflow=${over} back=${en}`); if (good) ok++; else { fail++; console.log('FAIL i18n'); }
    }
    console.log(`${ok} examples ok, ${fail} failed`);
    if (errs.length) { console.log('console errors:', errs.slice(0, 5)); fail++; }
    await b.close(); process.exit(fail ? 1 : 0);
})();
