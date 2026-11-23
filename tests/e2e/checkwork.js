// "Check my work" in the real page: the tool is in the list, wrong working is flagged with the diagnosis on the
// Results tab, and correct working is verified. Also opens the tool from a ?tool= link.
const { chromium } = require('playwright');
const BASE = process.env.BASE_ROOT || process.env.BASE || 'http://localhost:8099';
(async () => {
    const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
    const p = await (await b.newContext({ serviceWorkers: 'block', acceptDownloads: true })).newPage(); const errs = [];
    await p.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { (window.__viol = window.__viol || []).push(e.violatedDirective + ' ' + e.blockedURI); }, true)); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/app.html?tool=check'); await p.waitForFunction(() => window.__calc);
    ok(await p.isVisible('.mode-btn[data-mode="check"].active'), 'a ?tool=check link opens the checker');
    ok(await p.evaluate(() => document.getElementById('functionInput').rows >= 6), 'the input is tall enough for several lines of working');
    await p.fill('#functionInput', 'd/dx(cos x)\n= sin x'); await p.click('#computeBtn');
    await p.waitForFunction(() => /First\smistake/.test(document.getElementById('results').textContent), null, { timeout: 15000 }).catch(() => {}); const t1 = (await p.textContent('#results')).replace(/\s+/g, ' ');
    ok(/First mistake/.test(t1) && /sign was flipped/.test(t1), 'a sign slip is found and explained on the Results tab' + (/First mistake/.test(t1) && /sign was flipped/.test(t1) ? '' : ': ' + t1.replace(/\s+/g, ' ').slice(0, 300)));
    await p.click('.more-menu summary'); const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="card"]')]);
    const fs = require('fs'), tmp = require('os').tmpdir() + '/cs-card-' + Date.now() + '.png'; await dl.saveAs(tmp); const png = fs.readFileSync(tmp); fs.unlinkSync(tmp);
    ok(png.length > 8000 && png.slice(1, 4).toString() === 'PNG', '"Save as image" downloads a PNG picture of the result (' + png.length + ' bytes)');
    ok(!(await p.evaluate(() => window.__viol || [])).length, 'making the picture breaks no security-policy rule');
    await p.click('[data-act="practice"]'); await p.waitForSelector('#practiceDialog[open] #pracProblem .prob-id', { timeout: 20000 });
    ok(/Derivatives/.test(await p.textContent('#pracProblem')), 'after a mistake, "Practise similar problems" opens practice on the matching topic');
    await p.keyboard.press('Escape');
    await p.fill('#functionInput', '∫ x e^x dx\n= x e^x - ∫ e^x dx\n= x e^x - e^x + C'); await p.click('#computeBtn');
    await p.waitForFunction(() => /steps are correct/.test(document.getElementById('results').textContent));
    ok(await p.isVisible('.badge.ok'), 'correct integration by parts is verified');
    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close(); process.exit(bad ? 1 : 0);
})();
