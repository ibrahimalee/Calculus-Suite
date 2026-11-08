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
        const urls = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map(m => m[1]).filter(u => !/github\.com\/ibrahimalee/.test(u));
        assert.deepEqual(urls, [], f + ' references external resources');
    }
});
