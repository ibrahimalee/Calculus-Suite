// Classroom flow: build a worksheet, open the student link, answer, get a code, grade it in the gradebook.
const { chromium } = require('playwright');
const BASE = process.env.BASE_ROOT || 'http://localhost:8099';
(async () => {
  const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const t = await ctx.newPage(); const errs = []; t.on('pageerror', e => errs.push(e.message)); t.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await t.goto(BASE + '/teacher.html'); await t.waitForSelector('#qList .qcard');
  await t.fill('#wsTitle', 'Quiz <b>1</b>'); await t.fill('#wsInstr', 'Be careful.');
  const cards = () => t.$$('#qList .qcard');
  // question 1: number
  let c = (await cards())[0]; await (await c.$('textarea')).fill('What is $\\int_0^3 x^2\\,dx$?'); await (await c.$$('input.in'))[1].fill('9');
  // question 2: expression that accepts any constant of integration
  await t.click('#addQ'); c = (await cards())[1]; await (await c.$('select')).selectOption('expr'); c = (await cards())[1];
  await (await c.$('textarea')).fill('Integrate $2x$'); await (await c.$$('input.in'))[1].fill('x^2 + C'); await c.$eval('input[type=checkbox]', e => e.click());
  // three generated practice problems
  await t.selectOption('#genTopic', 'derivative'); await t.fill('#genCount', '3'); await t.click('#genBtn');
  ok((await cards()).length === 5, 'builder holds 2 written + 3 generated questions');
  await t.click('#linkBtn'); await t.waitForSelector('#linkBox:not([hidden])'); const link = await t.inputValue('#linkOut');
  ok(/worksheet\.html#w=[zr]/.test(link), 'student link created');
  ok(!link.includes('x%5E2') && !link.includes('x^2+C'), 'the answer key is not readable in the link');
  // student
  const s = await ctx.newPage(); s.on('pageerror', e => errs.push('student: ' + e.message)); await s.goto(link); await s.waitForSelector('#sheet:not([hidden])');
  ok((await s.textContent('#wsTitle')) === 'Quiz <b>1</b>', 'title shown as text (no HTML injection)');
  ok((await s.$$('#qs .q')).length === 5 && (await s.$$('.katex')).length > 0, 'five questions with maths rendered');
  await s.click('#finishBtn'); ok((await s.textContent('#finishErr')).includes('name'), 'a name is required');
  await s.fill('#stuName', 'Ada Lovelace'); await s.fill('#a0', '18/2'); await s.fill('#a1', 'x^2 + 5'); await s.fill('#a2', '2*x');
  await s.click('#finishBtn'); await s.waitForSelector('#done:not([hidden])'); const code = await s.inputValue('#codeBox');
  ok(/^CSW1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/.test(code), 'submission code produced');
  await s.reload(); await s.waitForSelector('#sheet:not([hidden])'); ok((await s.inputValue('#a0')) === '18/2' && (await s.inputValue('#stuName')) === 'Ada Lovelace', 'answers survive a refresh');
  // teacher grades (code split across lines, surrounded by chatter)
  await t.click('#tabGrade'); await t.fill('#codes', 'hello team\n' + code.slice(0, 30) + '\n' + code.slice(30) + '\nthanks'); await t.click('#addCodes');
  await t.waitForSelector('#grades tbody tr'); ok(/Ada Lovelace/.test(await t.textContent('#grades tbody tr')), 'student appears in the gradebook');
  const marks = await t.$$eval('#grades tbody tr:first-child .cellbtn', e => e.map(x => x.textContent)); ok(marks[0] === '✓' && marks[1] === '✓', 'number and expression (+C) marked correct: ' + marks.join(''));
  ok(/\d \/ 5/.test(await t.textContent('#grades tbody tr:first-child td:nth-last-child(2)')), 'score shown');
  await t.click('#grades tbody tr:first-child .cellbtn'); ok((await t.$$('#grades .detail')).length === 1, 'clicking a mark shows what the student typed');
  await t.fill('#codes', 'CSW1.abc.00000000'); await t.click('#addCodes'); ok(/unreadable|damaged|checksum|typo/i.test(await t.textContent('#gradeErr')), 'a damaged code is reported, not graded');
  const [dl] = await Promise.all([t.waitForEvent('download'), t.click('#csvBtn')]); ok(/-grades\.csv$/.test(dl.suggestedFilename()), 'CSV download');
  // practice mode shows verdicts
  await t.click('#tabBuild'); await t.check('#wsSelf'); await t.click('#linkBtn'); await t.waitForSelector('#linkBox:not([hidden])'); const link2 = await t.inputValue('#linkOut');
  const s2 = await (await b.newContext()).newPage(); await s2.goto(link2); await s2.waitForSelector('#sheet:not([hidden])'); await s2.fill('#stuName', 'Bo'); await s2.fill('#a0', '9'); await s2.click('#checkBtn');
    ok((await s2.textContent('#v0')).includes('Correct') && (await s2.textContent('#v1')).includes('No answer'), 'practice mode checks answers on the page');
  // timed worksheet: gate, countdown, automatic lock and code at zero, time shown in the gradebook
  await t.uncheck('#wsSelf'); await t.fill('#wsTime', '2'); await t.click('#linkBtn'); await t.waitForSelector('#linkBox:not([hidden])'); const link3 = await t.inputValue('#linkOut');
  ok(await t.isVisible('#qrBox'), 'the QR code is drawn for the student link');
  const tctx = await b.newContext(); const st = await tctx.newPage(); await st.clock.install({ time: new Date('2030-01-01T10:00:00') }); await st.goto(link3); await st.waitForSelector('#gate:not([hidden])');
  ok(!(await st.isVisible('#qs')), 'questions stay hidden until the timer is started');
  await st.click('#startBtn'); ok((await st.textContent('#gateErr')).includes('name'), 'starting needs a name');
  await st.fill('#stuName', 'Timed Tim'); await st.click('#startBtn'); await st.waitForSelector('#qs', { state: 'visible' });
  ok((await st.textContent('#timerText')).trim() === '2:00', 'timer starts at the limit');
  await st.fill('#a0', '9'); await st.clock.runFor(61000); ok(/^(0:5\d)$/.test((await st.textContent('#timerText')).trim()) && /danger/.test(await st.getAttribute('#timerBar', 'class')), 'timer counts down and warns in the last minute');
  await st.reload(); await st.waitForSelector('#timerText'); await st.clock.runFor(1000); ok(/^0:[45]\d$/.test((await st.textContent('#timerText')).trim()), 'the timer keeps running across a reload');
  await st.clock.runFor(70000); await st.waitForSelector('#done:not([hidden])'); const lateCode = await st.inputValue('#codeBox');
  ok(/^CSW1\./.test(lateCode) && (await st.$$eval('#qs input, #qs textarea', e => e.every(x => x.disabled))), 'at zero the answers lock and the code is made automatically');
  await st.reload(); await st.waitForSelector('#done:not([hidden])'); ok((await st.inputValue('#codeBox')) === lateCode, 'a finished timed attempt cannot be restarted by reloading');
  const tctx2 = await b.newContext(); const st2 = await tctx2.newPage(); await st2.clock.install({ time: new Date('2030-01-01T10:00:00') }); await st2.goto(link3); await st2.waitForSelector('#gate:not([hidden])');
  await st2.fill('#stuName', 'Quick Quinn'); await st2.click('#startBtn'); await st2.fill('#a0', '9'); await st2.clock.runFor(30000); st2.once('dialog', d => d.accept()); await st2.click('#finishBtn'); await st2.waitForSelector('#done:not([hidden])'); const earlyCode = await st2.inputValue('#codeBox');
  await t.click('#tabGrade'); await t.fill('#codes', lateCode + '\n' + earlyCode); await t.click('#addCodes'); await t.waitForSelector('#grades tbody tr');
  const rows = await t.$$eval('#grades tbody tr:not(.sum):not(:has(.detail))', trs => trs.map(r => r.textContent));
  ok(rows.some(r => /Timed Tim/.test(r) && /ran out/.test(r)) && rows.some(r => /Quick Quinn/.test(r) && /0:30/.test(r) && !/ran out/.test(r)), 'the gradebook shows time used and who ran out: ' + rows.map(r => r.slice(-22)).join(' | '));
  // bad / truncated links
  const s3 = await ctx.newPage(); await s3.goto(BASE + '/worksheet.html#w=' + link.split('#w=')[1].slice(0, 40)); await s3.waitForSelector('#problem:not([hidden])'); ok(true, 'a truncated link shows a friendly message');
  const s4 = await ctx.newPage(); await s4.goto(BASE + '/worksheet.html'); await s4.waitForSelector('#problem:not([hidden])'); ok(true, 'a missing link shows a friendly message');
  // phone layout
  const ph = await b.newPage({ viewport: { width: 375, height: 800 } }); await ph.goto(link); await ph.waitForSelector('#sheet:not([hidden])'); ok(await ph.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'student page fits a phone');
  const pt = await b.newPage({ viewport: { width: 375, height: 800 } }); await pt.goto(BASE + '/teacher.html'); await pt.waitForTimeout(400); ok(await pt.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'teacher page fits a phone');
  ok(errs.length === 0, 'no console or page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(bad ? 1 : 0);
})();
