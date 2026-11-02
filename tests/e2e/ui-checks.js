/*
 * Browser-level checks (Playwright). Not part of `npm test`; run with:
 *   npm run serve &   (serves http://localhost:8080)   then   BASE=http://localhost:8080 node tests/e2e/ui-checks.js
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8099';
let failed = 0;
const check = (name, ok, extra) => { if (!ok) failed++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  → ' + (extra === undefined ? '' : JSON.stringify(extra)))); };

(async () => {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    const errors = [], dialogs = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
    const ready = async () => { await page.waitForFunction(() => window.__calc); await page.waitForTimeout(400); };
    const idle = async () => { await page.waitForFunction(() => !document.querySelector('#computeBtn').classList.contains('loading'), null, { timeout: 40000 }); await page.waitForTimeout(250); };
    const mode = async m => { await page.click(`.mode-btn[data-mode="${m}"]`); };

    await page.goto(BASE + '/index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready();

    // 1. share-link round trip (unicode included)
    await mode('derivative');
    await page.fill('#functionInput', 'π x² + sin(x)');
    await page.fill('#opt_point', '1');
    await page.click('#computeBtn'); await idle();
    const before = await page.textContent('#results .result-content');
    const hash = await page.evaluate(() => location.hash);
    check('share hash is written after compute', /^#s=/.test(hash), hash);
    const p2 = await ctx.newPage(); p2.on('pageerror', e => errors.push('p2:' + e.message));
    await p2.goto(BASE + '/index.html' + hash); await p2.waitForFunction(() => window.__calc); await p2.waitForFunction(() => document.querySelector('#results .result-content'), null, { timeout: 30000 });
    const after = await p2.textContent('#results .result-content');
    check('share link reproduces the exact result', before === after, { before, after });
    check('share link restores the input text', (await p2.inputValue('#functionInput')) === 'π x² + sin(x)');
    await p2.close();

    // 2. XSS attempts are inert
    for (const evil of ['<img src=x onerror=alert(1)>', '"><script>alert(2)</script>', "x'); alert(3); ('", '<svg onload=alert(4)>']) {
        await page.fill('#functionInput', evil); await page.waitForTimeout(250);
        await page.click('#computeBtn'); await idle();
    }
    check('no dialog fired for hostile input', dialogs.length === 0, dialogs);
    check('hostile input is shown as escaped text, not markup', (await page.$$('#preview img, #results img, #results svg[onload], #preview script')).length === 0);

    // 3. options persist when switching modes and back
    await mode('integral'); await page.fill('#opt_lower', '0'); await page.fill('#opt_upper', 'pi');
    await mode('series'); await mode('integral');
    check('integral options survive a round trip through another mode', (await page.inputValue('#opt_upper')) === 'pi');

    // 4. history restores a calculation
    await page.fill('#functionInput', 'sin(x)'); await page.click('#computeBtn'); await idle();
    await mode('derivative'); await page.fill('#functionInput', 'cos(x)'); await page.fill('#opt_point', ''); await page.click('#computeBtn'); await idle();
    await page.click('#historyList .history-item >> nth=1'); await idle();
    check('history item restores mode and input', (await page.inputValue('#functionInput')) === 'sin(x)' && (await page.evaluate(() => document.querySelector('.mode-btn.active').dataset.mode)) === 'integral');

    // 5. theme persists across reload
    await page.click('#themeToggle'); const dark = await page.evaluate(() => document.body.classList.contains('dark'));
    await page.reload(); await ready();
    check('theme choice persists', (await page.evaluate(() => document.body.classList.contains('dark'))) === dark);

    // 6. graph sliders really change the plot
    await mode('graph'); await page.fill('#functionInput', 'a*sin(b*x)'); await page.click('#computeBtn'); await idle(); await page.waitForTimeout(500);
    const y1 = await page.evaluate(() => Math.max(...document.getElementById('plot2d').data[0].y.filter(v => v !== null)));
    await page.evaluate(() => { const s = document.querySelector('input[data-p="a"]'); s.value = 3; s.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(400);
    const y2 = await page.evaluate(() => Math.max(...document.getElementById('plot2d').data[0].y.filter(v => v !== null)));
    check('moving the amplitude slider re-plots (max y 1 → 3)', Math.abs(y1 - 1) < 0.01 && Math.abs(y2 - 3) < 0.05, { y1, y2 });

    // 7. keyboard: palette + shortcuts
    await page.keyboard.press('Control+k'); await page.waitForTimeout(250);
    check('Ctrl+K opens the command palette', await page.evaluate(() => document.getElementById('paletteDialog').open));
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.keyboard.press('Alt+3'); await page.waitForTimeout(200);
    check('Alt+3 switches to the 3rd tool', (await page.evaluate(() => document.querySelector('.mode-btn.active').dataset.mode)) === 'limit');

    // 7b. the background worker really runs (it silently failed once: Algebrite needs `window`)
    check('computations run in the background worker', (await page.textContent('#engineStatus')).includes('background worker'), await page.textContent('#engineStatus'));
    await mode('fourier'); await page.fill('#functionInput', 'sin(300*x)*sign(sin(37*x))'); await page.fill('#opt_terms', '60');     // ~24 s of work
    await page.click('#computeBtn'); await page.waitForTimeout(400); await page.click('#computeBtn'); await idle();   // second click = cancel
    check('cancel stops a running computation', /cancelled/i.test(await page.textContent('#results')), (await page.textContent('#results')).slice(0, 80));
    await mode('integral'); await page.fill('#functionInput', 'x^2'); await page.fill('#opt_lower', ''); await page.fill('#opt_upper', ''); await page.click('#computeBtn'); await idle();
    check('worker recovers after a cancel', /x\s*3|x3|\/3/.test((await page.textContent('#results .result-content')).replace(/\s/g, '')), (await page.textContent('#results .result-content')).slice(0, 80));
    check('results report the worker as the engine', (await page.textContent('.result-foot')).includes('background worker'));

    // 8. no horizontal overflow at phone width in any mode
    const m = await browser.newPage({ viewport: { width: 375, height: 800 } }); await m.goto(BASE + '/index.html'); await m.waitForFunction(() => window.__calc); await m.waitForTimeout(500);
    const modes = await m.evaluate(() => [...document.querySelectorAll('.mode-btn')].map(b => b.dataset.mode));
    const overflowing = [];
    for (const md of modes) { await m.click(`.mode-btn[data-mode="${md}"]`); await m.selectOption('#examples', '0'); await m.waitForFunction(() => !document.querySelector('#computeBtn').classList.contains('loading'), null, { timeout: 40000 }); await m.waitForTimeout(350);
        const o = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 1) overflowing.push(md + ':' + o); }
    check('no horizontal page overflow on a 375px phone in any tool', overflowing.length === 0, overflowing);

    // 9. resilience: corrupted saved state and garbage share links must not break start-up
    const bad = await browser.newContext({ viewport: { width: 1200, height: 900 } }); const bp = await bad.newPage(); const badErrors = [];
    bp.on('pageerror', e => badErrors.push(e.message));
    await bp.addInitScript(() => { try { localStorage.setItem('cs_session', '{not json'); localStorage.setItem('cs_history', '[1,2,'); localStorage.setItem('accent', 'nonsense'); localStorage.setItem('themeMode', 42); } catch (e) { /* ignore */ } });
    for (const hash of ['', '#s=!!!notbase64!!!', '#s=' + Buffer.from('{"m":"nope","f":1}').toString('base64'), '#s=' + Buffer.from('{"m":"integral","f":"<b>x</b>","o":{"lower":{"a":1}}}').toString('base64')]) {
        await bp.goto(BASE + '/index.html' + hash); await bp.waitForFunction(() => window.__calc, null, { timeout: 15000 }); await bp.waitForTimeout(600);
    }
    check('app starts with corrupted storage and malformed share links', badErrors.length === 0 && (await bp.$$('.mode-btn')).length === 16, badErrors);
    await bad.close();

    // 10. rapid interaction: hammering Compute and switching tools mid-computation must leave the UI usable
    await page.goto(BASE + '/index.html'); await ready(); await mode('integral'); await page.fill('#functionInput', 'x*e^x');
    for (let i = 0; i < 6; i++) { await page.click('#computeBtn', { noWaitAfter: true }); await page.waitForTimeout(30); }
    await mode('derivative'); await mode('limit'); await mode('integral'); await idle();
    await page.fill('#functionInput', 'x^3'); await page.click('#computeBtn'); await idle();
    check('UI recovers after rapid clicks and mode switching', /x/.test(await page.textContent('#results .result-content')) && !(await page.$('#computeBtn.loading')));

    // 11. very long expression stays responsive
    const long = Array.from({ length: 400 }, (_, i) => `${i + 1}*x`).join('+');
    await mode('derivative'); const t0 = Date.now(); await page.fill('#functionInput', long); await page.click('#computeBtn'); await idle();
    check('a 400-term expression is handled in reasonable time', Date.now() - t0 < 20000, Date.now() - t0);

    check('no uncaught page errors / console errors', errors.length === 0, errors.slice(0, 5));
    await browser.close();
    console.log(failed ? `\n${failed} check(s) failed` : '\nall UI checks passed');
    process.exit(failed ? 1 : 0);
})();
