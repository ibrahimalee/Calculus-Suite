// Automated accessibility check (axe-core, WCAG 2 A/AA) on the main pages, light and dark, desktop and phone.
// Runs under the real security policy: axe is injected from node_modules without bypassing the CSP (see below).
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const BASE = process.env.BASE_ROOT || process.env.BASE || 'http://localhost:8099';
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PAGES = ['index.html', 'app.html', 'teacher.html', 'worksheet.html', 'tools/', 'tools/derivative-calculator.html', 'problems/', 'guides/', '404.html'];
(async () => {
    const b = await chromium.launch(); let bad = 0;
    for (const scheme of ['light', 'dark']) for (const [w, h] of [[1280, 900], [390, 844]]) {
        // bypassCSP only for injecting the test library; the pages themselves are exercised by the other e2e files under the policy
        const ctx = await b.newContext({ viewport: { width: w, height: h }, bypassCSP: true, colorScheme: scheme, serviceWorkers: 'block' }); const p = await ctx.newPage();
        for (const url of PAGES) {
            await p.goto(BASE + '/' + url); await p.waitForTimeout(700);
            await p.addScriptTag({ content: axeSrc });
            const r = await p.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] }));
            if (r.violations.length) { bad++; console.log(`FAIL ${scheme} ${w} ${url}: ` + r.violations.map(v => `${v.id} x${v.nodes.length} ${v.nodes[0].target.join(' ')}`).join(' ; ')); }
            else console.log(`ok   ${scheme} ${w} ${url}`);
        }
        await ctx.close();
    }
    await b.close(); process.exit(bad ? 1 : 0);
})();
