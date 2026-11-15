const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

test('generated tool pages, robots.txt and SEO blocks are up to date with the app', () => {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-seo.js'), '--check'], { stdio: 'pipe' });
});

test('every tool page has a unique title and description, one h1, structured data, and links that resolve', () => {
    const PAGES = require('../scripts/seo-pages.js');
    const titles = new Set(), descs = new Set();
    for (const p of PAGES) {
        const html = fs.readFileSync(path.join(ROOT, 'tools', p.slug + '.html'), 'utf8');
        const title = (/<title>([^<]+)<\/title>/.exec(html) || [])[1], desc = (/<meta name="description" content="([^"]+)"/.exec(html) || [])[1];
        assert.ok(title && title.length <= 75, p.slug + ': title missing or too long: ' + title);
        assert.ok(desc && desc.length >= 70 && desc.length <= 170, p.slug + ': description length ' + (desc || '').length);
        assert.ok(!titles.has(title) && !descs.has(desc), p.slug + ': duplicate title or description'); titles.add(title); descs.add(desc);
        assert.equal((html.match(/<h1[ >]/g) || []).length, 1, p.slug + ': exactly one h1');
        assert.match(html, /"@type":"FAQPage"/); assert.match(html, /"@type":"WebApplication"/);
        assert.ok(!/class="eg-note"/.test(html), p.slug + ': an example failed to compute');
        for (const m of html.matchAll(/href="([^"#?]+)(?:[#?][^"]*)?"/g)) {
            const href = m[1]; if (/^https?:|^mailto:/.test(href)) continue;
            const target = path.join(ROOT, 'tools', href.endsWith('/') ? href + 'index.html' : href);
            assert.ok(fs.existsSync(target), `${p.slug}: broken link ${href}`);
        }
        for (const ld of html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)) JSON.parse(ld[1]);
    }
});
