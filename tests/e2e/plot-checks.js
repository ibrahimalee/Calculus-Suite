const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1300, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('' + (process.env.BASE || 'http://localhost:8099') + '/index.html'); await page.waitForFunction(() => window.__calc); await page.waitForTimeout(500);
  let bad = 0; const report = (n, ok, x) => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok ? '' : ' → ' + JSON.stringify(x))); };
  const idle = async () => { await page.waitForFunction(() => !document.querySelector('#computeBtn').classList.contains('loading'), null, { timeout: 30000 }); await page.waitForTimeout(500); };
  await page.click('.mode-btn[data-mode="graph"]');
  for (const f of ['sqrt(x)', 'ln(x)', '1/x', 'tan(x)', 'abs(x)', 'floor(x)', 'sign(x)', 'sin(1/x)', 'x^x', 'e^(x^2)', 'sin(x) ; 1/x ; sqrt(x)', 'a*x^2+b', 'x^(1/3)', 'acos(x)', 'gamma(x)']) {
    await page.fill('#functionInput', f); await page.click('#computeBtn'); await idle();
    const info = await page.evaluate(() => { const d = document.getElementById('plot2d'); const tr = (d.data || []); return { traces: tr.length, pts: tr.reduce((s, t) => s + (t.y ? t.y.filter(v => v !== null && Number.isFinite(v)).length : 0), 0), err: !!document.querySelector('#results .alert-error') }; });
    report(`graph "${f}" draws finite points`, info.traces > 0 && info.pts > 20 || /gamma|acos/.test(f) && !info.err, info);
  }
  // 3D with non-xy variable names and degenerate inputs
  await page.click('.mode-btn[data-mode="derivative"]');
  for (const [f, expectSurface] of [['u*v', true], ['sin(r)*cos(t)', true], ['x^2', false], ['sqrt(1-x^2-y^2)', true], ['1/(x^2+y^2)', true], ['x*y*z', true]]) {
    await page.fill('#functionInput', f); await page.waitForTimeout(300); await page.click('#tab-plot3d'); await page.waitForTimeout(900);
    const r = await page.evaluate(() => { const d = document.getElementById('plot3dDiv'); return { surface: !!(d.data && d.data[0] && d.data[0].type === 'surface'), msg: !!d.querySelector('.empty-state') }; });
    report(`3D "${f}" ${expectSurface ? 'draws a surface' : 'explains it needs 2 variables'}`, expectSurface ? r.surface : r.msg, r);
    await page.click('#tab-results');
  }
  // ODE slope field + phase plot extremes
  await page.click('.mode-btn[data-mode="ode"]');
  for (const [f, o] of [['y^2', { y0: '1', xEnd: '3' }], ['100*y*(1-y)', { y0: '0.01', xEnd: '2' }], ['sin(x*y)', { y0: '5', xEnd: '20' }]]) {
    await page.fill('#functionInput', f); await page.fill('#opt_y0', o.y0); await page.fill('#opt_xEnd', o.xEnd); await page.click('#computeBtn'); await idle(); await page.click('#tab-plot'); await page.waitForTimeout(700);
    const r = await page.evaluate(() => { const d = document.getElementById('plot2d'); return { traces: (d.data || []).length, finite: (d.data || []).every(t => !t.y || t.y.every(v => v === null || Number.isFinite(v))) }; });
    report(`ODE "${f}" plots with finite data`, r.traces > 0 && r.finite, r); await page.click('#tab-results');
  }
  report('no console/page errors while plotting awkward functions', errs.length === 0, errs.slice(0, 4));
  await b.close(); process.exit(bad ? 1 : 0);
})();
