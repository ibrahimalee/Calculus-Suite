// Classroom batch 3 in a real browser: random numbers per student, shuffled choices, partial credit, point overrides,
// class list, question analysis, review sheet, question bank, sharing questions, and printing a worksheet with its key.
const { chromium } = require('playwright');
const BASE = process.env.BASE_ROOT || 'http://localhost:8099';
(async () => {
  const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const errs = []; const watch = (p, tag) => { p.on('pageerror', e => errs.push(tag + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(tag + ': ' + m.text()); }); };
  const t = await ctx.newPage(); watch(t, 'teacher'); await t.goto(BASE + '/teacher.html'); await t.waitForSelector('#qList .qcard');
  const cards = () => t.$$('#qList .qcard');
  await t.fill('#wsTitle', 'Variants quiz');
  // Q1: expression with random numbers
  let c = (await cards())[0]; await (await c.$('select')).selectOption('expr'); c = (await cards())[0];
  await (await c.$('textarea')).fill('Differentiate $@{a}x^3 @{+b}x$'); await (await c.$$('input.in'))[1].fill('@{3*a}*x^2 + @{b}');
  await c.$eval('details.randbox summary', e => e.click()); await c.$eval('textarea[aria-label$="random numbers"]', e => { e.value = 'a = 2..9\nb = -5..5 except 0'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await t.waitForTimeout(150); ok(/Sample version/.test(await c.$eval('.sample', e => e.textContent)) && !/@\{/.test(await c.$eval('.sample', e => e.textContent)), 'the builder shows a sample version with real numbers');
  // a typo in a name is reported
  await c.$eval('input[aria-label$="correct answer"]', e => { e.value = '@{3*aa}*x^2'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await t.waitForTimeout(150);
  ok(/not defined|cannot be worked out/.test(await c.$eval('.err', e => e.textContent)), 'an undefined random name is reported to the teacher');
  await c.$eval('input[aria-label$="correct answer"]', e => { e.value = '@{3*a}*x^2 + @{b}'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  // Q2: multiple choice, Q3: list with partial credit
  await t.click('#addQ'); c = (await cards())[1]; await (await c.$('select')).selectOption('choice'); c = (await cards())[1];
  await (await c.$('textarea')).fill('Which function is even?'); await c.$eval('textarea[aria-label$="choices"]', e => { e.value = 'sin x\ncos x\nx cubed\nx plus one'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await c.$eval('select[aria-label$="correct choice"]', e => { e.value = '1'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await t.click('#addQ'); c = (await cards())[2]; await (await c.$('select')).selectOption('list'); c = (await cards())[2];
  await (await c.$('textarea')).fill('Give the first four primes'); await (await c.$$('input.in'))[1].fill('2, 3, 5, 7');
  await t.check('#wsPartial'); await t.check('#wsShuffleC'); await t.check('#wsShuffleQ');
  await t.click('#linkBtn'); await t.waitForSelector('#linkBox:not([hidden])'); const link = await t.inputValue('#linkOut');

  // ---- two students ----
  const doStudent = async (name, wrongList) => {
    const sc = await b.newContext({ viewport: { width: 1200, height: 900 } }); const s = await sc.newPage(); watch(s, 'student ' + name); await s.goto(link); await s.waitForSelector('#sheet:not([hidden])');
    ok(await s.isVisible('#gate') && !(await s.isVisible('#qs')), name + ': the questions wait behind a name gate');
    await s.click('#startBtn'); ok(/name/i.test(await s.textContent('#gateErr')), name + ': a name is needed to start');
    await s.fill('#stuName', name); await s.click('#startBtn'); await s.waitForSelector('#qs .q');
    ok(await s.$eval('#stuName', e => e.readOnly), name + ': the name is fixed once started');
    const tex = await s.$$eval('#p0 annotation, #p1 annotation, #p2 annotation', els => els.map(e => e.textContent)); const prompts = await s.$$eval('.q-prompt', els => els.map(e => e.textContent));
    ok(prompts.length === 3 && !prompts.some(p => /@\{/.test(p)), name + ': numbers were filled in');
    const calc = tex.find(x => /x\^3/.test(x)); const m = /(-?\d+)x\^3\s*([+-]\s*\d+)x/.exec(calc || ''); ok(!!m, name + ': the derivative question shows real numbers (' + calc + ')');
    const a = +m[1], bb = +m[2].replace(/\s/g, ''); const ids = await s.$$eval('.q-prompt', els => els.map(e => e.id));
    for (const el of await s.$$('#qs .q')) {
      const id = await el.$eval('.q-prompt', e => e.id);
      const txt = await el.$eval('.q-prompt', e => e.textContent);
      if (/Differentiate/.test(txt)) await (await el.$('input.in')).fill(`${3 * a}*x^2 + ${bb}`);
      else if (/even/.test(txt)) { const labs = await el.$$('.choices label'); for (const l of labs) if ((await l.textContent()).trim() === 'cos x') await (await l.$('input')).check(); }
      else if (/primes/.test(txt)) await (await el.$('input.in')).fill(wrongList);
    }
    await s.click('#finishBtn'); await s.waitForSelector('#done:not([hidden])'); const code = await s.inputValue('#codeBox'); await sc.close(); return { code, ids };
  };
  const ada = await doStudent('Ada Lovelace', '2, 3, 5, 9'), bob = await doStudent('Bob Stone', '2, 3, 4, 9');
  // ---- gradebook ----
  await t.click('#toGrade'); await t.fill('#codes', ada.code + '\n' + bob.code); await t.click('#addCodes'); await t.waitForSelector('#grades tbody tr');
  const cells = async () => t.$$eval('#grades tbody tr:not(.sum):not(:has(.detail))', trs => trs.map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim()).join('|')));
  let rows = await cells(); ok(rows.length === 2, 'both students are in the gradebook: ' + rows.join(' // '));
  ok(rows[0].startsWith('Ada Lovelace|✓|✓|0.75|2.75 / 3') && rows[1].startsWith('Bob Stone|✓|✓|0.5|2.5 / 3'), 'each student is graded against their own numbers; partial credit gives 3 of 4 and 2 of 4 entries (' + rows.join(' // ') + ')');
  // override: give Bob's list answer 0.2 and a comment
  const bobBtn = (await t.$$('#grades tbody tr'))[1]; await (await bobBtn.$$('button.cellbtn'))[2].click(); await t.waitForSelector('.ovform');
  ok(/Expected: 2, 3, 5, 7/.test(await t.textContent('.ovform')), 'the adjust panel shows the expected answer');
  await t.fill('.ovform input[type=number]', '0.2'); await t.fill('.ovform input[type=text]', 'order mix-up'); await t.click('.ovform >> text=Set points'); await t.waitForTimeout(200);
  rows = await cells(); ok(rows[1].includes('|0.2*|') && rows[1].includes('2.2 / 3'), 'the override shows with a star and the score follows: ' + rows[1]);
  ok(/Adjusted by you/.test(await t.textContent('.ovform')) , 'the panel reopens and says it was adjusted');
  // roster
  await t.fill('#roster', 'Ada Lovelace\nBob Stone\nCarla Gomez'); ok(/not yet: Carla Gomez/.test(await t.textContent('#rosterNote')), 'the class list shows who has not handed in');
  await t.fill('#roster', 'Ada Lovelace\nBob Ston'); ok(/not on the list: Bob Stone \(did you mean Bob Ston\?\)/.test(await t.textContent('#rosterNote')), 'a misspelt name is matched to the class list');
  // analysis
  await t.click('#analysis summary'); ok(await t.isVisible('#analysisBody table') && (await t.$$('#analysisBody .hbar')).length === 5, 'question analysis with a score histogram');
  // review sheet (the list question was missed by both)
  const nBefore = await t.$$eval('#wsPick option', o => o.length); await t.click('#makeReview'); await t.waitForSelector('#paneBuild:not([hidden])');
  ok((await t.inputValue('#wsTitle')).startsWith('Review: ') && (await t.$$eval('#wsPick option', o => o.length)) === nBefore + 1, 'a review worksheet was created from the missed questions: ' + await t.inputValue('#wsTitle'));
  ok((await cards()).length >= 1, 'it contains the missed question(s)');
  await t.selectOption('#wsPick', { label: (await t.$$eval('#wsPick option', o => o.map(x => x.textContent))).find(x => x.startsWith('Variants quiz')) });
  // ---- bank ----
  await t.fill('#bankTags', 'calculus, week 1'); c = (await cards())[0]; await (await c.$('button:has-text("Save to bank")')).click();
  ok((await t.textContent('#bankCount')) === '(1)' && /calculus, week 1/.test(await t.textContent('#bankList')), 'a question saved to the bank shows its tags');
  await t.click('#bankSaveAll'); ok((await t.textContent('#bankCount')) === '(3)', 'saving the whole worksheet adds the others and skips duplicates');
  await t.fill('#bankSearch', 'primes'); ok((await t.$$('#bankList .bank-row')).length === 1, 'the bank can be searched');
  const before = (await cards()).length; await t.click('#bankList .bank-row button:has-text("Add")'); ok((await cards()).length === before + 1, 'bank questions can be added to the open worksheet');
  // ---- print ----
  await t.evaluate(() => { window.__printed = null; window.print = () => { window.__printed = document.querySelector('.print-root').innerHTML; }; });
  await t.fill('#printNames', 'Ada Lovelace\nBob Stone'); await t.click('#printBtn'); const html = await t.evaluate(() => window.__printed);
  ok(!!html && (html.match(/class="print-page/g) || []).length === 3, 'printing makes one page per named copy plus an answer key');
  ok(html.includes('Ada Lovelace') && html.includes('Bob Stone') && !/@\{/.test(html) && /Answer key/.test(html), 'each copy is named, numbers are filled in, and the key is included');
  // ---- share questions ----
  await t.evaluate(() => { while (document.querySelectorAll('#qList .qcard').length > 3) document.querySelector('#qList .qcard:last-child .btn-danger').click(); });
  await t.click('#shareQ'); await t.waitForSelector('#shareQBox:not([hidden])'); const shared = await t.inputValue('#shareQOut');
  const t2 = await ctx.newPage(); watch(t2, 'colleague'); await t2.goto(shared); await t2.waitForSelector('#importBanner:not([hidden])'); ok(/3 questions shared with you/.test(await t2.textContent('#importTitle')), 'a colleague sees an import banner for the shared questions');
  await t2.click('#importNew'); ok((await t2.$$('#qList .qcard')).length === 3 && (await t2.inputValue('#wsTitle')) === 'Shared questions', 'the shared questions become a new worksheet');
  ok(!(await t2.url()).includes('#q='), 'the share link is cleared from the address bar after importing');
  const bad2 = await ctx.newPage(); watch(bad2, 'bad link'); await bad2.goto(BASE + '/teacher.html#q=zAAAA'); await bad2.waitForSelector('#toast:not([hidden])'); ok(/could not be opened/.test(await bad2.textContent('#toast')), 'a damaged shared link gives a friendly message');
  // ---- phone ----
  const ph = await b.newPage({ viewport: { width: 375, height: 800 } }); await ph.goto(link); await ph.waitForSelector('#sheet:not([hidden])'); ok(await ph.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'the name gate fits a phone');
  const pt = await b.newPage({ viewport: { width: 375, height: 800 } }); await pt.goto(BASE + '/teacher.html'); await pt.waitForTimeout(400); ok(await pt.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'teacher page with the new cards fits a phone');
  ok(errs.length === 0, 'no console or page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(bad ? 1 : 0);
})();
