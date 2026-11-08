// Hostile input regression: crafted share links, query strings and a booby-trapped notebook file must never
// break startup, pollute prototypes or run script.
const { chromium } = require('playwright');
const BASE = process.env.BASE_ROOT || 'http://localhost:8099';
const enc = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
(async () => {
  const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
  const cases = {
    'share link with mode "constructor"': '/app.html#s=' + enc({ m: 'constructor', f: 'x' }),
    'share link with mode "__proto__"': '/app.html#s=' + enc({ m: '__proto__', f: 'x' }),
    'share link with mode "toString"': '/app.html#s=' + enc({ m: 'toString', f: 'x' }),
    'share link with __proto__ options': '/app.html#s=' + enc({ m: 'derivative', f: 'x^2', o: JSON.parse('{"__proto__":{"polluted":"yes"},"constructor":"x","order":"2"}') }),
    'share link with a 200,000 character input': '/app.html#s=' + enc({ m: 'derivative', f: 'x'.repeat(200000) }),
    'share link that is not an object': '/app.html#s=' + enc(['a', 1]),
    'share link that is null': '/app.html#s=' + enc(null),
    '?tool=constructor': '/app.html?tool=constructor',
    '?tool=__proto__': '/app.html?tool=__proto__',
    '?ask= with 8,000 characters': '/app.html?ask=' + 'x'.repeat(8000),
    '?ask= with HTML': '/app.html?ask=' + encodeURIComponent('<img src=x onerror=alert(1)>'),
    'embed mode with HTML in the input': '/app.html?embed=1#s=' + enc({ m: 'derivative', f: '<img src=x onerror=alert(1)>' }),
  };
  for (const [name, url] of Object.entries(cases)) {
    const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = []; let dialog = false;
    p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { dialog = true; d.dismiss(); });
    await p.goto(BASE + url); let started = true; try { await p.waitForFunction(() => window.__calc, null, { timeout: 10000 }); } catch (e) { started = false; }
    await p.waitForTimeout(300);
    const polluted = started ? await p.evaluate(() => ({}).polluted !== undefined || Object.prototype.polluted !== undefined) : false;
    ok(started && !errs.length && !polluted && !dialog, name + (errs.length ? ': ' + errs[0] : ''));
    if (name.includes('200,000')) ok(started && /too long/.test(await p.textContent('#preview')), 'an oversized input gets a clear message instead of freezing the page');
    await ctx.close();
  }
  // a booby-trapped notebook backup
  const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = []; let dialog = false; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { dialog = true; d.dismiss(); });
  await p.goto(BASE + '/app.html'); await p.waitForFunction(() => window.__calc);
  const evil = { app: 'calculus-suite', notebooks: [{ name: 'x'.repeat(500), items: Array.from({ length: 520 }, (_, i) => ({ s: { m: i % 52 === 0 ? 'constructor' : 'derivative', f: 'x'.repeat(5600), o: JSON.parse('{"__proto__":{"polluted":1},"order":{"a":1},"k":"' + 'y'.repeat(450) + '"}') }, title: '<img src=x onerror=alert(2)>', text: '<script>alert(3)</script>', tex: '\\href{javascript:alert(4)}{x}', note: 'n'.repeat(400) })) }, null, 5, { name: 7, items: [] }] };
  await p.setInputFiles('#projFile', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(evil)) }); await p.waitForTimeout(800);
  const state = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('cs_projects') || 'null'); const items = d ? (d.list || []).flatMap(x => x.items) : []; return { count: items.length, maxF: Math.max(0, ...items.map(i => i.s.f.length)), maxKey: Math.max(0, ...items.map(i => Object.values(i.s.o).reduce((m, v) => Math.max(m, String(v).length), 0))), objectOpts: items.some(i => Object.values(i.s.o).some(v => typeof v !== 'string')), polluted: ({}).polluted !== undefined }; });
  ok(state.count > 0 && state.count <= 500 && state.maxF <= 5000 && state.maxKey <= 400 && !state.objectOpts && !state.polluted && !dialog && !errs.length, `a booby-trapped notebook backup is cleaned and capped (${JSON.stringify(state)})`);
  const big = Buffer.alloc(5e6, 32); await p.setInputFiles('#projFile', { name: 'big.json', mimeType: 'application/json', buffer: big }); await p.waitForTimeout(400); ok(errs.length === 0, 'an oversized backup file is refused without errors');

  // teacher page: a booby-trapped shared-questions link and a booby-trapped question bank must stay inert and capped
  {
    const C = require('../../js/classroom.js').create(require('mathjs')); const P = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    const qs = Array.from({ length: 40 }, (_, i) => ({ type: i % 2 ? 'text' : 'number', prompt: P + ' ' + i, key: i % 2 ? P : '1', points: 1e9, tags: P, rand: i === 0 ? 'a = 1..3' : undefined, hint: P }));
    const link = await C.encodeQuestions(qs); const ctx2 = await b.newContext(); const tp = await ctx2.newPage(); const errs2 = []; let dialog2 = false; tp.on('pageerror', e => errs2.push(e.message)); tp.on('dialog', d => { dialog2 = true; d.dismiss(); });
    await tp.goto(BASE + '/teacher.html#q=' + link.slice(0, 0) + link); await tp.waitForSelector('#importBanner:not([hidden])'); await tp.click('#importNew'); await tp.waitForTimeout(400);
    const inj = await tp.evaluate(() => ({ imgs: document.querySelectorAll('main img').length, scripts: document.querySelectorAll('main script').length, cards: document.querySelectorAll('#qList .qcard').length }));
    ok(!dialog2 && !errs2.length && inj.imgs === 0 && inj.scripts === 0 && inj.cards === 40, 'a shared-questions link full of script payloads is shown as plain text (' + JSON.stringify(inj) + ')');
    await tp.click('#bankSaveAll'); await tp.waitForTimeout(300); ok(!dialog2 && (await tp.$$eval('#bankList img, #bankList script', e => e.length)) === 0, 'the bank shows hostile text without running it');
    const evil = { calculusSuiteBank: 1, questions: Array.from({ length: 900 }, (_, i) => (i % 5 === 0 ? { type: '__proto__', prompt: P, key: '1', constructor: 'x' } : i % 5 === 1 ? JSON.parse('{"type":"number","prompt":"p' + i + '","key":"1","__proto__":{"polluted":"yes"}}') : i % 5 === 2 ? { type: 'number', prompt: 'x'.repeat(5000), key: '1' } : i % 5 === 3 ? { type: 'choice', prompt: 'c' + i, options: ['a'], key: '9' } : { type: 'number', prompt: 'ok ' + i, key: String(i) })) };
    await tp.setInputFiles('#bankFile', { name: 'bank.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(evil)) }); await tp.waitForTimeout(800);
    const st = await tp.evaluate(() => { const bank = JSON.parse(localStorage.getItem('cs_classroom_bank') || '[]'); return { n: bank.length, polluted: ({}).polluted !== undefined, longest: Math.max(0, ...bank.map(e => e.q.prompt.length)) }; });
    ok(!dialog2 && !errs2.length && st.n > 0 && st.n <= 2000 && !st.polluted && st.longest <= 1200, 'an oversized, booby-trapped bank file is cleaned and capped (' + JSON.stringify(st) + ')');
    await ctx2.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
