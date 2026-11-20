// Print / PDF: the button prepares a header (tool, input, date), draws the plot, sets a sensible title and calls print.
const { chromium } = require('playwright');
const BASE = process.env.BASE_ROOT || process.env.BASE || 'http://localhost:8099';
(async () => {
  const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
  const p = await (await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__printed = 0; window.__titleAtPrint = ''; window.print = () => { window.__printed++; window.__titleAtPrint = document.title; window.dispatchEvent(new Event('afterprint')); }; });
  await p.goto(BASE + '/app.html'); await p.waitForFunction(() => window.__calc);
  await p.click('[data-act="print"]').catch(() => { });
  await p.click('#computeBtn'); await p.waitForSelector('#results .result-content');
  const before = await p.title();
  await p.click('[data-act="print"]'); await p.waitForFunction(() => window.__printed === 1, null, { timeout: 15000 });
  ok(true, 'the Print / PDF button calls print once');
  ok((await p.textContent('#printHead .print-title')).includes('Derivative'), 'the print header names the tool and the result');
  ok((await p.textContent('#printHead .print-input')).includes('x^2'), 'the print header shows the input');
  ok(/^Calculus Suite – /.test(await p.evaluate(() => window.__titleAtPrint)), 'the page title becomes the PDF file name while printing');
  ok((await p.title()) === before, 'the title is restored afterwards');
  ok(await p.$('#plot2d.js-plotly-plot') !== null, 'the plot is drawn for the printout');
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('printHead')).display === 'none'), 'the header is hidden on screen');
  await p.emulateMedia({ media: 'print' });
  const vis = await p.evaluate(() => ['.appbar', '.sidebar', '.tabs', '.result-actions', '.bottom-nav'].map(s => { const e = document.querySelector(s); return e ? getComputedStyle(e).display : 'none'; }));
  ok(vis.every(d => d === 'none'), 'app chrome is hidden in print');
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('printHead')).display !== 'none' && getComputedStyle(document.getElementById('plot3d')).display === 'none'), 'print shows the header and hides the empty 3D tab');
  ok(errs.length === 0, 'no page errors');
  await b.close(); process.exit(bad ? 1 : 0);
})();
