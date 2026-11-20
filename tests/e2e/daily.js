// Problem of the day: the same problem for the same date, a streak that grows on consecutive days and resets after a gap.
const { chromium } = require('playwright');
const BASE = process.env.BASE_ROOT || process.env.BASE || 'http://localhost:8099';
(async () => {
  const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
  const p = await (await b.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // the page's idea of "today" is whatever window.__day says, so the test can move through the calendar
  await p.addInitScript(() => { const Real = Date; window.__day = '2026-03-10'; class D extends Real { constructor(...a) { if (a.length) super(...a); else super(new Real(window.__day + 'T12:00:00').getTime()); } static now() { return new Real(window.__day + 'T12:00:00').getTime(); } } window.Date = D; });
  await p.goto(BASE + '/app.html'); await p.waitForFunction(() => window.__calc); await p.click('#practiceBtn');
  const play = async iso => {
    await p.evaluate(d => { window.__day = d; }, iso); await p.click('#pracDaily');
    const head = await p.textContent('#pracProblem .prob-id');
    const answer = await p.evaluate(() => { const topic = document.getElementById('pracTopic').value, level = +document.getElementById('pracLevel').value, t = new Date(); const n = Math.floor(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / 864e5); const E = CalcEngine.create(math, Algebrite); CalcExtras.install(E, math, Algebrite); return Practice.create(E, math).generate(topic, level, n).answerText.replace(/\s*\+\s*C$/, '') + (topic === 'integral' ? ' + C' : ''); });
    await p.fill('#pracAnswer', answer); await p.press('#pracAnswer', 'Enter'); await p.waitForSelector('#pracFeedback.good', { timeout: 5000 });
    return { head, text: await p.textContent('#pracFeedback') };
  };
  const a = await play('2026-03-10'); ok(/Problem of the day · 2026-03-10/.test(a.head), 'the header names the day'); ok(/Daily streak: 1 day\./.test(a.text), 'first day: streak 1');
  const a2 = await play('2026-03-10'); ok(a2.head === a.head, 'the same date gives the same problem'); ok(/Daily streak: 1 day\./.test(a2.text), 'solving the same day again does not count twice');
  const b1 = await play('2026-03-11'); ok(b1.head !== a.head && /Daily streak: 2 days/.test(b1.text), 'next day: a new problem and streak 2');
  const c1 = await play('2026-03-12'); ok(/Daily streak: 3 days/.test(c1.text), 'streak 3');
  const d1 = await play('2026-03-20'); ok(/Daily streak: 1 day\./.test(d1.text), 'after a gap the streak restarts at 1');
  const st = JSON.parse(await p.evaluate(() => localStorage.getItem('cs_daily')));
  ok(st.best === 3 && st.streak === 1 && st.total === 4 && st.last === '2026-03-20', 'the best streak (3) and the number of days (4) are kept');
  ok(/daily streak 1 \(best 3\)/.test(await p.textContent('#pracStats')), 'the practice stats show the daily streak');
  ok(errs.length === 0, 'no page errors');
  await b.close(); process.exit(bad ? 1 : 0);
})();
