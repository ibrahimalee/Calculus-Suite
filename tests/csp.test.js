const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { inlineHashes } = require('../scripts/sync-csp.js');

test('every inline script is allowed by hash in the Content-Security-Policy of every page rule', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
    const want = inlineHashes();
    assert.ok(want.length >= 3, 'expected the inline scripts of the home, teacher and worksheet pages');
    let policies = 0;
    for (const rule of cfg.headers) for (const h of rule.headers) {
        if (h.key !== 'Content-Security-Policy') continue;
        policies++;
        const list = (/script-src ([^;]*)/.exec(h.value) || [])[1] || '';
        for (const hash of want) assert.ok(list.includes(hash), `${rule.source}: missing ${hash} (run npm run csp)`);
        assert.ok(!/'unsafe-inline'/.test(list), `${rule.source}: scripts must not allow 'unsafe-inline'`);
    }
    assert.ok(policies >= 5);
});

test('no page loads a script or stylesheet from another origin', () => {
    for (const f of ['index.html', 'app.html', 'teacher.html', 'worksheet.html']) {
        const html = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
        // resources the page loads: script/img src, and stylesheet, preload, icon and manifest links (canonical links are not loads)
        const urls = [...html.matchAll(/\bsrc="(https?:\/\/[^"]+)"/g), ...html.matchAll(/<link\b(?=[^>]*\brel="(?:stylesheet|preload|modulepreload|icon|apple-touch-icon|manifest)")[^>]*\bhref="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
        assert.deepEqual(urls, [], f + ' references external resources');
    }
});

test('headers: only the app may be framed or use eval; every HTML page has a policy; hardening headers are set', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
    const csp = src => { const r = cfg.headers.find(h => h.source === src && h.headers.some(x => x.key === 'Content-Security-Policy')); return r && r.headers.find(x => x.key === 'Content-Security-Policy').value; };
    for (const src of ['/', '/index.html', '/tools/:path*', '/problems/:path*', '/guides/:path*', '/404.html', '/CalculusSuite.html', '/teacher.html', '/worksheet.html', '/app.html']) assert.ok(csp(src), 'no CSP for ' + src);
    for (const src of ['/', '/index.html', '/tools/:path*', '/problems/:path*', '/guides/:path*', '/404.html']) assert.ok(!/unsafe-eval/.test(csp(src)), src + ' needs no eval');
    for (const src of ['/', '/index.html', '/tools/:path*', '/problems/:path*', '/guides/:path*', '/404.html', '/teacher.html', '/worksheet.html']) assert.match(csp(src), /frame-ancestors 'self'/, src);
    assert.match(csp('/app.html'), /frame-ancestors \*/, 'the calculator is embeddable on purpose');
    for (const src of ['/app.html', '/']) assert.match(csp(src), /upgrade-insecure-requests/);
    const g = cfg.headers.find(h => h.source === '/:path*').headers.map(x => x.key);
    for (const k of ['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Cross-Origin-Opener-Policy']) assert.ok(g.includes(k), k);
    const ign = fs.readFileSync(path.join(__dirname, '..', '.vercelignore'), 'utf8');
    for (const k of ['node_modules', 'tests', 'scripts']) assert.ok(ign.split('\n').includes(k), k + ' must not be deployed');
});
