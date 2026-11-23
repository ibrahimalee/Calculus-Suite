/* Writes accuracy.html and accuracy-results.json from a benchmark run (node scripts/benchmark.js --page). Every number on the
   page comes from the results, so the page cannot disagree with the benchmark. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pct = (a, b) => b ? (100 * a / b).toFixed(1).replace(/\.0$/, '') + '%' : '–';
const cfg = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8')); } catch (e) { return {}; } })();
const URL_ = (cfg.url || '').replace(/\/$/, '');

module.exports = function (R) {
    const T = R.totals, cm = R.checkMyWork;
    const planted = Object.entries(cm.planted), pl = planted.reduce((a, [, v]) => ({ total: a.total + v.total, caught: a.caught + v.caught }), { total: 0, caught: 0 });
    const declinedAll = R.categories.flatMap(c => c.declinedList || []);
    const rows = R.categories.map(c => `<tr><th scope="row">${esc(c.name)}</th><td>${c.total}</td><td>${c.right}</td><td>${c.declined}</td><td>${c.wrong}</td><td>${c.unread}</td></tr>`).join('');
    const total = `<tr class="tot"><th scope="row">All</th><td>${T.total}</td><td>${T.right}</td><td>${T.declined}</td><td>${T.wrong}</td><td>${T.unread}</td></tr>`;
    const prows = planted.map(([k, v]) => `<tr><th scope="row">${esc(k[0].toUpperCase() + k.slice(1))}</th><td>${v.total}</td><td>${v.caught}</td><td>${pct(v.caught, v.total)}</td></tr>`).join('');
    const notes = R.categories.map(c => `<li><b>${esc(c.name)}.</b> ${esc(c.blurb)}</li>`).join('');
    const fails = R.categories.flatMap(c => c.failures.map(f => `<li><b>${esc(c.name)}:</b> <code>${esc(f.input)}</code> → ${esc(f.detail)}</li>`));
    const headline = T.wrong === 0
        ? `Of ${T.total} problems, <b>${T.right} were answered correctly</b>, <b>${T.declined} were declined</b> with an explanation, and <b>none were answered wrongly</b>.`
        : `Of ${T.total} problems, <b>${T.right} were answered correctly</b>, <b>${T.declined} were declined</b> with an explanation, and <b>${T.wrong} were answered wrongly</b> (listed below).`;
    const title = 'Accuracy: how often the answers are right', desc = `We tested ${T.total} calculus and algebra problems against independent ground truth and published every number, including the failures. Rerun it yourself.`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}">
    <meta name="theme-color" content="#f3f1ec">
${URL_ ? `    <link rel="canonical" href="${URL_}/accuracy.html">\n` : ''}    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${esc(cfg.name || 'Calculus Suite')}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(desc)}">
    <link rel="icon" href="icon.svg" type="image/svg+xml">
    <link rel="manifest" href="manifest.webmanifest">
    <link rel="stylesheet" href="css/tokens.css">
    <link rel="stylesheet" href="css/home.css">
    <script src="js/theme-init.js"></script>
</head>
<body>
    <a class="skip" href="#main">Skip to content</a>
    <header class="bar">
        <a class="wordmark" href="./" aria-label="Calculus Suite, home"><span class="mark" aria-hidden="true">∫</span><span class="wm-name">Calculus Suite</span></a>
        <nav class="bar-nav" aria-label="Sections"><a href="tools/">Tools</a><a href="problems/">Problems</a><a href="guides/">Guides</a><a href="teacher.html">Teachers</a><a href="accuracy.html" aria-current="page">Accuracy</a></nav>
        <button class="theme" id="themeBtn" type="button" aria-label="Switch colour theme"><span id="themeGlyph" aria-hidden="true">◐</span></button>
        <a class="btn btn-solid bar-cta" href="app.html">Open the app</a>
    </header>
    <main id="main" class="wrap tool-page">
        <p class="crumbs"><a href="./">Home</a> › Accuracy</p>
        <h1>How often is it right?</h1>
        <p class="lede">${headline} Every number on this page is produced by a script anyone can run, against answers the engine did not supply.</p>

        <section class="sec" aria-labelledby="h-res">
            <p class="kicker"><b>01</b> Results</p>
            <h2 id="h-res">The numbers</h2>
            <div class="tbl-scroll" tabindex="0" role="region" aria-label="Results table, scrollable"><table class="acc">
                <thead><tr><th scope="col">Kind of problem</th><th scope="col">Problems</th><th scope="col">Right</th><th scope="col">Declined</th><th scope="col">Wrong</th><th scope="col">Unread</th></tr></thead>
                <tbody>${rows}${total}</tbody>
            </table></div>
            <p><b>Declined</b> means the tool said it could not do it (for example “no closed form found”), which is the honest answer, so it is not counted as wrong. <b>Unread</b> means the test script could not read the tool’s output, so the problem is not scored either way.</p>
${declinedAll.length ? `            <h3>What it declined</h3>\n            <p>These are some of the ${declinedAll.length} integrals it said it could not do. Each has an elementary answer (it is a derivative of a known function), so they are gaps to close, not impossible problems:</p>\n            <ul class="plain">${declinedAll.slice(0, 6).map(d => `<li><code>${esc(d)}</code></li>`).join('')}</ul>\n` : ''}
${fails.length ? `            <h3>Every failure</h3>\n            <ul class="plain">${fails.join('')}</ul>` : '            <p>There were no wrong answers in this run.</p>'}
        </section>

        <section class="sec" aria-labelledby="h-cw">
            <p class="kicker"><b>02</b> Check my work</p>
            <h2 id="h-cw">Does it catch real mistakes, and leave correct work alone?</h2>
            <p><a href="tools/check-my-math-work.html">Check my work</a> was given ${cm.correct.total} correct solutions, written in several equivalent ways, and ${pl.total} solutions with one planted mistake. It accepted <b>${cm.correct.ok} of ${cm.correct.total}</b> correct solutions and caught <b>${pl.caught} of ${pl.total}</b> planted mistakes.</p>
            <div class="tbl-scroll" tabindex="0" role="region" aria-label="Results table, scrollable"><table class="acc">
                <thead><tr><th scope="col">Planted mistake</th><th scope="col">Tried</th><th scope="col">Caught</th><th scope="col">Rate</th></tr></thead>
                <tbody>${prows}</tbody>
            </table></div>
        </section>

        <section class="sec notes" aria-labelledby="h-ocr">
            <p class="kicker"><b>03</b> Photos</p>
            <h2 id="h-ocr">Reading working from a photo</h2>
            <p>The “Scan a photo” button reads printed or typed maths on your device and puts the text in the box for you to check. We measured how well it does on eight short worked solutions: <b>92.8%</b> of characters correct in clean print, <b>86.8%</b> in a slanted serif font and <b>72.4%</b> in a handwriting-like style, with <b>3</b>, <b>2</b> and <b>0</b> of 8 solutions read perfectly. Even clean print can lose an exponent or a minus sign, and a misread character would look like a mistake in your working. So the app does not claim to read handwriting, it always shows you the text to correct before it is used, and it says so in the scan window. The test is <code>scripts/ocr-benchmark.js</code> in the repository.</p>
        </section>

        <section class="sec notes" aria-labelledby="h-how">
            <p class="kicker"><b>04</b> Method</p>
            <h2 id="h-how">How it is tested</h2>
            <p>The problems are generated from a fixed random seed (${R.seed}), so every run uses the same ones. The right answers never come from the engine being tested: the test script has its own differentiator, its own numerical integrator, known textbook limits, roots built from chosen integers, and matrix products to check inverses.</p>
            <ul class="plain">${notes}</ul>
            <h3>What this does not show</h3>
            <p>It does not prove the tool is right on every input. The problems are random compositions of standard functions and classic textbook cases, not a sample of everything students meet, and a numerical check can in principle miss an answer that is wrong only at a point or two. Treat it as strong evidence, not a guarantee, and report anything you find: <a href="https://github.com/ibrahimalee/calculus-suite/issues" rel="noopener">open an issue</a> with the input.</p>
            <h3>Run it yourself</h3>
            <pre class="cmd" tabindex="0" aria-label="Commands to run the benchmark">git clone https://github.com/ibrahimalee/calculus-suite\ncd calculus-suite\nnpm install\nnpm run benchmark</pre>
            <p class="fine">Last run: ${esc(R.generated)}${R.quick ? ' (quick set)' : ''}. The raw results are in <a href="accuracy-results.json">accuracy-results.json</a>.</p>
        </section>
    </main>
    <footer class="foot">
        <div class="wrap foot-in">
            <span>Calculus Suite · MIT licence · free, no account, works offline</span>
            <span class="foot-links"><a href="./">Home</a><a href="tools/">All tools</a><a href="problems/">Worked problems</a><a href="guides/">Guides</a><a href="app.html">App</a><a href="teacher.html">For teachers</a></span>
        </div>
    </footer>
    <script src="js/home.js"></script>
</body>
</html>
`;
    fs.writeFileSync(path.join(ROOT, 'accuracy.html'), html);
    fs.writeFileSync(path.join(ROOT, 'accuracy-results.json'), JSON.stringify({ generated: R.generated, seed: R.seed, totals: R.totals, categories: R.categories.map(({ name, total, right, declined, wrong, unread }) => ({ name, total, right, declined, wrong, unread })), checkMyWork: { correctAccepted: `${cm.correct.ok}/${cm.correct.total}`, planted: Object.fromEntries(planted.map(([k, v]) => [k, `${v.caught}/${v.total}`])) } }, null, 2) + '\n');
    console.log('\nWrote accuracy.html and accuracy-results.json');
};
