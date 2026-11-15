#!/usr/bin/env node
/* Builds the search-engine side of the site from the app itself, so nothing can drift out of date:
     tools/<slug>.html   one page per tool: what it does, worked examples computed by the engine, FAQ, structured data
     tools/index.html    the list of every tool page
     sitemap.xml, robots.txt
     the <!-- seo --> blocks in index.html, app.html and teacher.html (canonical link, Open Graph, JSON-LD)
     the static tool index on the home page (<!-- tools:start --> … <!-- tools:end -->)
   The generated files are committed; there is still no build step for deploying.

   Usage:  node scripts/build-seo.js                  rebuild
           node scripts/build-seo.js --url https://example.com   set the public address (stored in site.config.json) and rebuild
           node scripts/build-seo.js --check          exit 1 if any generated file is out of date (used by npm test) */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const math = require('mathjs'), Algebrite = require('algebrite');
const katex = require(path.join(ROOT, 'vendor', 'katex', 'katex.min.js'));
const { readModes } = require('./read-modes.js');
const PAGES = require('./seo-pages.js');

const args = process.argv.slice(2), CHECK = args.includes('--check');
const cfgFile = path.join(ROOT, 'site.config.json');
const cfg = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, 'utf8')) : { url: '' };
const urlArg = args.indexOf('--url');
if (urlArg >= 0) {
    const u = String(args[urlArg + 1] || '').trim().replace(/\/+$/, '');
    if (u && !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(u)) { console.error('The address must look like https://example.com'); process.exit(2); }
    cfg.url = u; fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2) + '\n');
}
const SITE = cfg.url || '';
const NAME = 'Calculus Suite';
const abs = p => (SITE ? SITE + '/' + p.replace(/^\.?\//, '') : '');

const E = require(path.join(ROOT, 'js', 'engine.js')).create(math, Algebrite);
require(path.join(ROOT, 'js', 'extras.js')).install(E, math, Algebrite);
const { modes: MODES } = readModes();

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tex = (t, display) => { try { return katex.renderToString(t, { displayMode: !!display, throwOnError: true, output: 'html' }); } catch (e) { return null; } };
const share = s => Buffer.from(JSON.stringify(s), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ld = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const bySlug = Object.fromEntries(PAGES.map(p => [p.slug, p]));

// where a tool's headline restates the problem, show these result lines instead (or as well)
const PREFER = { ode: /^(Particular solution|General solution|Series solution|Solution)/, analysis: /^(Roots|Local maximum|Local minimum)/, fourier: /^k = [1-3]:/, multivariable: /^(Saddle|Local|Global|Minimum|Maximum|Degenerate)/, graph: /^Intersection/ };
const APPEND = { solve: /^Complex/, calc: /^Integer facts/ };
function runExample(mode, idx) {
    const m = MODES[mode], ex = m && m.examples && m.examples[idx];
    if (!ex) throw new Error(`No example ${mode}[${idx}]`);
    const opts = {}; (m.fields || []).forEach(f => { opts[f.key] = f.def; }); Object.assign(opts, ex.opts || {});
    const s = { m: mode, f: ex.fn, o: opts };
    let answer = '', ok = true;
    try {
        const src = mode === 'graph' ? ex.fn.replace(/(^|[;\n])\s*(y|f\(x\))\s*=/g, '$1') : ex.fn;
        const r = E.run[mode](src, Object.assign({}, opts));
        const main = r.main || (r.items && r.items[0]);
        const line = it => `<code>${esc(((it.label ? it.label + ' ' : '') + it.text).slice(0, 300))}</code>`;
        const pick = re => (r.items || []).filter(it => re.test(it.label || '')).slice(0, 3);
        const preferred = PREFER[mode] ? pick(PREFER[mode]) : [];
        if (preferred.length && !(mode === 'multivariable' && !/^Solve/.test((main && main.label) || ''))) answer = preferred.map(line).join('<br>');
        else if (main) {
            const html = main.tex ? tex(main.tex, false) : null;
            answer = html ? `<span class="tex">${html}</span>` : line(main);
            if (APPEND[mode]) answer += pick(APPEND[mode]).map(it => '<br>' + line(it)).join('');
        }
        const check = (r.meta || []).find(x => /^Verified/.test(x));
        if (check) answer += `<small class="eg-check">✓ ${esc(check.replace(/^Verified:\s*/, 'Checked: '))}</small>`;
    } catch (e) { ok = false; answer = `<span class="eg-note">${esc(e.message)}</span>`; }
    return { label: ex.label, fn: ex.fn, link: `../app.html#s=${share(s)}`, answer, ok };
}

function head({ title, description, canonical, extra }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <meta name="theme-color" content="#f8f7ef">
${canonical ? `    <link rel="canonical" href="${esc(canonical)}">\n` : ''}    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${NAME}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
${canonical ? `    <meta property="og:url" content="${esc(canonical)}">\n` : ''}    <meta property="og:image" content="${esc(abs('og-image.png') || '../og-image.png')}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" href="../icon.svg" type="image/svg+xml">
    <link rel="manifest" href="../manifest.webmanifest">
    <link rel="stylesheet" href="../vendor/katex/katex.min.css">
    <link rel="stylesheet" href="../css/tokens.css">
    <link rel="stylesheet" href="../css/home.css">
    <script src="../js/theme-init.js"></script>
${extra || ''}</head>`;
}

const bar = `    <a class="skip" href="#main">Skip to content</a>
    <header class="bar">
        <a class="wordmark" href="../" aria-label="${NAME}, home"><span class="mark" aria-hidden="true">∫</span><span class="wm-name">${NAME}</span></a>
        <nav class="bar-nav" aria-label="Sections"><a href="./">All tools</a><a href="../teacher.html">Teachers</a><a href="https://github.com/ibrahimalee/calculus-suite" rel="noopener">Source</a></nav>
        <button class="theme" id="themeBtn" type="button" aria-label="Switch colour theme"><span id="themeGlyph" aria-hidden="true">◐</span></button>
        <a class="btn btn-solid bar-cta" href="../app.html">Open the app</a>
    </header>`;
const foot = `    <footer class="foot">
        <div class="wrap foot-in">
            <span>${NAME} · MIT licence · free, no account, works offline</span>
            <span class="foot-links"><a href="../">Home</a><a href="./">All tools</a><a href="../app.html">App</a><a href="../teacher.html">For teachers</a><a href="https://github.com/ibrahimalee/calculus-suite" rel="noopener">GitHub</a></span>
        </div>
    </footer>
    <script src="../js/home.js"></script>
</body>
</html>
`;

function toolPage(p) {
    const m = MODES[p.mode]; if (!m) throw new Error('Unknown mode ' + p.mode);
    const exs = p.examples.map(([mode, i]) => runExample(mode, i));
    const bad = exs.filter(e => !e.ok); if (bad.length) throw new Error(`${p.slug}: example failed: ${bad.map(b => b.fn + ' → ' + b.answer).join('; ')}`);
    const canonical = abs(`tools/${p.slug}.html`);
    let hint = ''; try { const inp = m.input && m.input(); hint = inp && inp.hint ? inp.hint : ''; } catch (e) { /* option-dependent */ }
    const jsonld = [
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: `${p.h1} – ${NAME}`, description: p.description, applicationCategory: 'EducationalApplication', operatingSystem: 'Any (runs in a web browser)', browserRequirements: 'Requires JavaScript', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, ...(SITE ? { url: abs(`app.html?tool=${p.mode}`) } : {}) },
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }
    ];
    if (SITE) jsonld.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: abs('') }, { '@type': 'ListItem', position: 2, name: 'Tools', item: abs('tools/') }, { '@type': 'ListItem', position: 3, name: p.h1, item: canonical }] });
    const related = (p.related || []).filter(s => bySlug[s]).map(s => `<li><a href="${s}.html">${esc(bySlug[s].h1)}</a></li>`).join('');
    return `${head({ title: `${p.title} | ${NAME}`, description: p.description, canonical, extra: jsonld.map(j => '    ' + ld(j) + '\n').join('') })}
<body>
${bar}
    <main id="main" class="wrap tool-page">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="../">Home</a> <span aria-hidden="true">›</span> <a href="./">Tools</a> <span aria-hidden="true">›</span> <span aria-current="page">${esc(p.h1)}</span></nav>
        <h1>${esc(p.h1)}</h1>
        <p class="lede">${esc(p.lede)}</p>
        <p class="cta-row"><a class="btn btn-solid btn-lg" href="../app.html?tool=${p.mode}">Open the ${esc(m.label.toLowerCase())} tool</a><span class="fine">Free, no account. Runs in your browser and works offline.</span></p>

        <section class="sec" aria-labelledby="h-eg">
            <h2 id="h-eg">Worked examples</h2>
            <p>Each answer below was computed by the tool itself. Open one to see the steps and the plot.</p>
            <ol class="eg-table">
${exs.map(e => `                <li><div class="eg-q"><b>${esc(e.label)}</b><code>${esc(e.fn)}</code></div><div class="eg-a">${e.answer}</div><a class="eg-open" href="${esc(e.link)}">Open with steps</a></li>`).join('\n')}
            </ol>
        </section>

        <section class="sec notes" aria-labelledby="h-how">
            <h2 id="h-how">How it works</h2>
${p.how.map(t => `            <p>${esc(t)}</p>`).join('\n')}
            <h3>How the answer is checked</h3>
            <p>${esc(p.check)}</p>
            <h3>Typing your input</h3>
            <ul class="plain">
${[hint, ...(p.tips || [])].filter(Boolean).map(t => `                <li>${esc(t)}</li>`).join('\n')}
            </ul>
        </section>

        <section class="sec notes" aria-labelledby="h-faq">
            <h2 id="h-faq">Questions</h2>
${p.faq.map(([q, a]) => `            <h3>${esc(q)}</h3>\n            <p>${esc(a)}</p>`).join('\n')}
        </section>

        <section class="sec" aria-labelledby="h-rel">
            <h2 id="h-rel">Related tools</h2>
            <ul class="rel">${related}<li><a href="./">All ${PAGES.length} tool pages</a></li></ul>
        </section>
    </main>
${foot}`;
}

function hubPage() {
    const canonical = abs('tools/');
    const groups = readModes().groups;
    const byMode = {}; PAGES.forEach(p => { (byMode[p.mode] = byMode[p.mode] || []).push(p); });
    const listJson = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: PAGES.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.h1, ...(SITE ? { url: abs(`tools/${p.slug}.html`) } : {}) })) };
    return `${head({ title: `All calculus and maths tools | ${NAME}`, description: `Every tool in ${NAME}: derivatives, integrals, limits, series, ODEs, transforms, matrices, statistics and more, each with worked examples and a second check of the answer.`, canonical, extra: '    ' + ld(listJson) + '\n' })}
<body>
${bar}
    <main id="main" class="wrap tool-page">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="../">Home</a> <span aria-hidden="true">›</span> <span aria-current="page">Tools</span></nav>
        <h1>All tools</h1>
        <p class="lede">${Object.keys(MODES).length} tools in one free app. Each page below explains one of them, with worked examples computed by the tool.</p>
${groups.map(([title, ids]) => `        <section class="sec" aria-label="${esc(title)}">
            <h2>${esc(title)}</h2>
            <ul class="hub">
${ids.flatMap(id => byMode[id] || []).map(p => `                <li><a href="${p.slug}.html"><b>${esc(p.h1)}</b><span>${esc(p.description)}</span></a></li>`).join('\n')}
            </ul>
        </section>`).join('\n')}
    </main>
${foot}`;
}

/* ---- the main pages: SEO head blocks and the static home-page index ---- */
function seoBlock(page, title, description, extraLd) {
    const canonical = page === 'index.html' ? abs('') : abs(page);
    const lines = [];
    if (canonical) lines.push(`<link rel="canonical" href="${esc(canonical)}">`, `<meta property="og:url" content="${esc(canonical)}">`);
    lines.push(`<meta property="og:site_name" content="${NAME}">`, `<meta property="og:title" content="${esc(title)}">`, `<meta property="og:description" content="${esc(description)}">`, '<meta property="og:type" content="website">',
        `<meta property="og:image" content="${esc(abs('og-image.png') || 'og-image.png')}">`, '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">', '<meta name="twitter:card" content="summary_large_image">');
    if (extraLd) lines.push(ld(extraLd));
    return '<!-- seo:start (generated by scripts/build-seo.js) -->\n    ' + lines.join('\n    ') + '\n    <!-- seo:end -->';
}
function patch(file, fn) {
    const p = path.join(ROOT, file); const before = fs.readFileSync(p, 'utf8'); const after = fn(before);
    return [file, after];
}
const replaceBlock = (html, start, end, block) => {
    const a = html.indexOf(start), b = html.indexOf(end);
    if (a < 0 || b < a) throw new Error('marker ' + start + ' missing');
    return html.slice(0, a) + block + html.slice(b + end.length);
};
const headMeta = (html, name) => { const m = new RegExp(`<meta name="${name}" content="([^"]*)"`).exec(html); return m ? m[1].replace(/&amp;/g, '&') : ''; };
const titleOf = html => ((/<title>([^<]*)<\/title>/.exec(html) || [])[1] || NAME).replace(/&amp;/g, '&');

const appLd = { '@context': 'https://schema.org', '@type': 'WebApplication', name: NAME, applicationCategory: 'EducationalApplication', operatingSystem: 'Any (runs in a web browser)', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: PAGES.filter(p => p.primary).map(p => p.h1), ...(SITE ? { url: abs('app.html') } : {}) };
const siteLd = { '@context': 'https://schema.org', '@type': 'WebSite', name: NAME, description: 'Step-by-step calculus that checks its answers. Free, offline, open source.', ...(SITE ? { url: abs('') } : {}) };
const primaryOf = Object.fromEntries(PAGES.filter(p => p.primary).map(p => [p.mode, p]));

const outputs = [];
const ensureMarkers = (html, file) => {
    if (html.includes('<!-- seo:start')) return html;
    return html.replace(/(\n\s*<link rel="manifest")/, `\n    <!-- seo:start --><!-- seo:end -->$1`).replace(/(\n\s*<link rel="icon")/, m => (html.includes('<link rel="manifest"') ? m : `\n    <!-- seo:start --><!-- seo:end -->${m}`));
};
outputs.push(patch('index.html', html => {
    html = ensureMarkers(html, 'index.html');
    html = replaceBlock(html, html.indexOf('<!-- seo:start (') >= 0 ? '<!-- seo:start (generated by scripts/build-seo.js) -->' : '<!-- seo:start -->', '<!-- seo:end -->', seoBlock('index.html', titleOf(html), headMeta(html, 'description'), siteLd));
    const ids = readModes().groups.flatMap(g => g[1]);
    const items = ids.map(id => { const m = MODES[id], p = primaryOf[id]; return `<li><a href="${p ? `tools/${p.slug}.html` : `app.html?tool=${id}`}"><span class="g">${esc(m.icon || '')}</span><span><span class="t">${esc(m.label)}</span><span class="d">${esc(p ? p.lede.split('. ')[0].replace(/\.$/, '') : '')}</span></span></a></li>`; });
    html = replaceBlock(html, '<!-- tools:start -->', '<!-- tools:end -->', '<!-- tools:start -->\n                ' + items.join('\n                ') + '\n                <!-- tools:end -->');
    return html.replace(/<span id="toolCount">\d*<\/span>/, `<span id="toolCount">${ids.length}</span>`);
}));
outputs.push(patch('app.html', html => replaceBlock(ensureMarkers(html, 'app.html'), html.includes('<!-- seo:start (') ? '<!-- seo:start (generated by scripts/build-seo.js) -->' : '<!-- seo:start -->', '<!-- seo:end -->', seoBlock('app.html', titleOf(html), headMeta(html, 'description'), appLd))));
outputs.push(patch('teacher.html', html => replaceBlock(ensureMarkers(html, 'teacher.html'), html.includes('<!-- seo:start (') ? '<!-- seo:start (generated by scripts/build-seo.js) -->' : '<!-- seo:start -->', '<!-- seo:end -->', seoBlock('teacher.html', titleOf(html), headMeta(html, 'description'), null))));

PAGES.forEach(p => outputs.push([`tools/${p.slug}.html`, toolPage(p)]));
outputs.push(['tools/index.html', hubPage()]);
const urls = ['', 'app.html', 'teacher.html', 'tools/', ...PAGES.map(p => `tools/${p.slug}.html`)];
outputs.push(['robots.txt', `User-agent: *\nAllow: /\nDisallow: /worksheet.html\n${SITE ? `\nSitemap: ${abs('sitemap.xml')}\n` : ''}`]);
if (SITE) outputs.push(['sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(abs(u))}</loc></url>`).join('\n')}\n</urlset>\n`]);

let stale = [];
for (const [file, content] of outputs) {
    const p = path.join(ROOT, file);
    const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    if (cur === content) continue;
    if (CHECK) { stale.push(file); continue; }
    fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content);
}
if (!SITE && !CHECK && fs.existsSync(path.join(ROOT, 'sitemap.xml'))) fs.unlinkSync(path.join(ROOT, 'sitemap.xml'));
if (CHECK) {
    if (stale.length) { console.error('Out of date (run npm run seo): ' + stale.join(', ')); process.exit(1); }
    console.log('SEO pages are current');
} else {
    require('./sync-csp.js').sync(false);
    console.log(`Built ${PAGES.length} tool pages${SITE ? ' and sitemap.xml for ' + SITE : ' (no public address set: canonical links and sitemap.xml are skipped; run with --url https://your-domain)'}.`);
}
module.exports = { PAGES };
