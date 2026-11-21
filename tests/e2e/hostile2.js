// Hostile classroom content: a worksheet link built by someone malicious (script tags, event handlers, KaTeX \href and
// \url with javascript:, giant TeX) must not run anything on the student's page; student codes with the same payloads
// in the name and answers must not run anything on the teacher's gradebook.
const { chromium } = require('playwright');
const BASE = process.env.BASE_ROOT || process.env.BASE || 'http://localhost:8099';
const P = ['<img src=x onerror="window.__pwned=1">', '<script>window.__pwned=1<\/script>', '$\\href{javascript:window.__pwned=1}{click}$', '$\\url{javascript:window.__pwned=1}$', '$\\htmlClass{x}{y}\\includegraphics{x.png}$', '"><svg onload="window.__pwned=1">', '$' + '\\frac{1}{'.repeat(200) + '1' + '}'.repeat(200) + '$'];
(async () => {
    const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
    const ctx = await b.newContext({ serviceWorkers: 'block' });
    const inspect = async p => p.evaluate(() => ({ pwned: !!window.__pwned, imgs: document.querySelectorAll('img[onerror], svg[onload]').length, scripts: [...document.scripts].filter(s => /pwned/.test(s.textContent)).length, jsLinks: [...document.querySelectorAll('a[href]')].filter(a => /^\s*javascript:/i.test(a.getAttribute('href'))).length }));
    const clean = r => !r.pwned && !r.imgs && !r.scripts && !r.jsLinks;

    // 1. the teacher's page makes a link for a worksheet full of payloads
    const t = await ctx.newPage(); let dialogs = 0; t.on('dialog', d => { dialogs++; d.dismiss(); });
    await t.goto(BASE + '/teacher.html'); await t.waitForTimeout(500);
    const ws = { id: 'evil0001', title: P[0] + ' title', instructions: P.join(' '), questions: [
        { type: 'text', prompt: P.join(' '), key: 'a', points: 1, hint: P.join(' ') },
        { type: 'choice', prompt: 'pick ' + P[2], options: [P[0], P[2], P[3], P[5]], key: '1', points: 1 },
        { type: 'expr', prompt: 'Differentiate $@{a}x^2$ ' + P[1], key: '@{2*a}*x', rand: 'a = 2..5', points: 1 }] };
    const link = await t.evaluate(async w => { const C = CalcClassroom.create(math); const n = C.normalise(w); localStorage.setItem('cs_classroom_v1', JSON.stringify([n])); return 'worksheet.html#w=' + await C.encodeStudent(n); }, ws);

    // 2. a student opens it
    const s = await ctx.newPage(); const errs = []; s.on('pageerror', e => errs.push(e.message)); s.on('dialog', d => { dialogs++; d.dismiss(); });
    await s.goto(BASE + '/' + link); await s.waitForTimeout(800);
    if (await s.isVisible('#startBtn')) { await s.fill('#stuName', P[0]); await s.click('#startBtn'); }
    await s.waitForSelector('#qs .q', { timeout: 10000 }); await s.waitForTimeout(500);
    ok(clean(await inspect(s)) && dialogs === 0, 'a malicious worksheet link runs nothing on the student page');
    await s.fill('#a0', P[0] + P[5]).catch(() => { });
    await s.click('#finishBtn'); await s.waitForSelector('#done:not([hidden])'); const code = await s.inputValue('#codeBox');
    ok(clean(await inspect(s)) && dialogs === 0 && errs.length === 0, 'finishing it runs nothing and raises no errors');

    // 3. the teacher grades a code whose name and answers carry payloads
    await t.reload(); await t.waitForTimeout(500); await t.click('#tabGrade');
    await t.fill('#codes', code); await t.click('#addCodes'); await t.waitForTimeout(800);
    const r = await inspect(t);
    ok(clean(r) && dialogs === 0, 'a code full of payloads runs nothing in the gradebook');
    ok(/onerror/.test(await t.textContent('#grades').catch(() => '')) || (await t.isVisible('#tblWrap')), 'the payload is shown as plain text, not markup');
    await b.close(); process.exit(bad ? 1 : 0);
})();
