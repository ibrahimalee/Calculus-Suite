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

test('the web app manifest has working shortcuts, and the 404 page is noindex with no inline script', () => {
    const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
    assert.ok(man.shortcuts.length >= 4 && man.id && man.categories.length);
    const { readModes } = require('../scripts/read-modes.js'); const modes = readModes().modes;
    for (const s of man.shortcuts) {
        assert.ok(s.name && s.url.startsWith('./'), s.name);
        const t = /[?&]tool=(\w+)/.exec(s.url); if (t) assert.ok(modes[t[1]], 'unknown tool in shortcut ' + s.url); else assert.ok(fs.existsSync(path.join(ROOT, s.url.replace(/^\.\//, '').split('?')[0])), s.url);
    }
    const nf = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
    assert.match(nf, /<meta name="robots" content="noindex">/);
    assert.ok(!/<script(?![^>]*\bsrc=)/.test(nf), '404.html must not contain inline scripts (they would be blocked by the CSP)');
});

test('problem and guide pages: unique titles and descriptions, one h1, valid structured data, no broken links, real answers', () => {
    const titles = new Set(); let n = 0;
    for (const dir of ['problems', 'guides']) for (const f of fs.readdirSync(path.join(ROOT, dir)).filter(x => x.endsWith('.html'))) {
        n++;
        const html = fs.readFileSync(path.join(ROOT, dir, f), 'utf8');
        const title = (/<title>([^<]+)<\/title>/.exec(html) || [])[1], desc = (/<meta name="description" content="([^"]+)"/.exec(html) || [])[1];
        assert.ok(title && title.length <= 110 && desc && desc.length >= 40 && desc.length <= 175, `${dir}/${f}: title/description length`);
        assert.ok(!titles.has(title), `${dir}/${f}: duplicate title`); titles.add(title);
        assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${dir}/${f}: one h1`);
        assert.ok(!/NaN|[=≈:] undefined|\[object/.test(html.split('<main')[1] || ''), `${dir}/${f}: placeholder text on the page`);
        if (f !== 'index.html' && dir === 'problems') { assert.match(html, /class="prob-a"/); assert.ok(/class="katex"/.test(html) || /<code>/.test(html), f + ': no answer shown'); }
        for (const m of html.matchAll(/href="([^"#?]+)(?:[#?][^"]*)?"/g)) {
            const href = m[1]; if (/^https?:|^mailto:/.test(href)) continue;
            const target = path.join(ROOT, dir, href.endsWith('/') ? href + 'index.html' : href);
            assert.ok(fs.existsSync(target), `${dir}/${f}: broken link ${href}`);
        }
        for (const ld of html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)) JSON.parse(ld[1]);
    }
    assert.ok(n >= 300, 'expected hundreds of problem pages, found ' + n);
});
