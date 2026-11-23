// The gradebook's class mistake report in a real browser: wrong answers are sorted into kinds (sign, factor, lost
// solution…), the class summary names the most common one with a teaching tip, and the question table has a column for it.
const { chromium } = require('playwright');
const BASE = process.env.BASE_ROOT || process.env.BASE || 'http://localhost:8099';
(async () => {
  const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } }); const t = await ctx.newPage(); const errs = []; t.on('pageerror', e => errs.push(e.message));
  await t.goto(BASE + '/teacher.html'); await t.waitForSelector('#qList .qcard');
  // a worksheet and six submissions, built the same way the page itself builds them
  const codes = await t.evaluate(() => {
    const C = CalcClassroom.create(math);
    const ws = C.normalise({ id: 'mist0001', title: 'Mistakes', questions: [
      { type: 'expr', prompt: 'Differentiate $\\cos x$', key: '-sin(x)', points: 1 },
      { type: 'list', prompt: 'Solve $x^2 = 5x$', key: '0, 5', points: 1 },
      { type: 'expr', prompt: 'Integrate $e^{2x}$', key: 'e^(2x)/2 + C', points: 1, plusC: true }] });
    localStorage.setItem('cs_classroom_v1', JSON.stringify([ws]));
    const mk = (n, a) => C.makeSubmission(ws, n, a);
    return [mk('Ana', ['sin(x)', '5', 'e^(2x) + C']), mk('Ben', ['sin(x)', '5', 'e^(2x)/2 + C']), mk('Cy', ['sin(x)', '0, 5', '2e^(2x) + C']), mk('Di', ['-sin(x)', '5', 'e^(2x)/2 + C']), mk('Eli', ['sin(x)', '0, 5', 'e^(2x)/2 + C']), mk('Flo', ['-sin(x)', '0, 5', 'e^(2x)/2 + C'])].join('\n');
  });
  await t.reload(); await t.waitForSelector('#qList .qcard'); await t.click('#tabGrade'); await t.fill('#codes', codes); await t.click('#addCodes');
  await t.waitForSelector('#analysis:not([hidden])'); await t.$eval('#analysis summary', e => e.click()); await t.waitForTimeout(300);
  const txt = (await t.textContent('#analysisBody')).replace(/\s+/g, ' ');
  ok(/Most common mistakes across the class/.test(txt), 'the class summary is shown');
  ok(/A sign is flipped\s*4 answers/.test(txt), 'sign slips are counted (4 students)');
  ok(/Solutions are missing\s*3 answers/.test(txt) && /A constant factor is wrong\s*2 answers/.test(txt), 'lost solutions (3) and wrong factors (2) are counted');
  ok(/Look for a minus lost/.test(txt), 'each kind comes with a teaching tip');
  ok(/What went wrong/.test(txt) && /A sign is flipped \(×4\)/.test(txt), 'the question table has a "What went wrong" column');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); process.exit(bad ? 1 : 0);
})();
