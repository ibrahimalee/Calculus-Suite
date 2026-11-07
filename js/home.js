/* Home page: the interactive figure, the tool index, the ask form and the theme switch.
   Plain JS, no dependencies; the maths here is the closed form of one sample function. */
(function () {
    'use strict';
    var doc = document, NS = 'http://www.w3.org/2000/svg';
    var $ = function (id) { return doc.getElementById(id); };
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- tool index ---------- */
    var TOOLS = [
        ['derivative', '∂', 'Derivative', 'Any order, with the tangent line at a point'],
        ['integral', '∫', 'Integral', 'Definite, improper and indefinite, with the technique named'],
        ['series', 'Σ', 'Taylor series', 'Polynomials about any point, with the error'],
        ['limit', 'lim', 'Limits', 'Two-sided, one-sided and at infinity, with L’Hôpital steps'],
        ['analysis', 'f', 'Analysis', 'Critical points, concavity, asymptotes and sketches'],
        ['ode', 'y′', 'Differential equations', 'First and second order, systems, series solutions'],
        ['multivariable', '∇', 'Multivariable', 'Gradients, Hessians, Jacobians, optimisation'],
        ['graph', '∿', 'Graph & sliders', 'Plot several curves and drive them with sliders'],
        ['riemann', 'Δx', 'Riemann sums', 'Left, right, midpoint and trapezoid, side by side'],
        ['applications', 'V', 'Area & volume', 'Between curves, solids of revolution, arc length'],
        ['root', 'x*', 'Root finding', 'Newton, bisection and secant with every iteration'],
        ['fourier', '∼', 'Fourier series', 'Coefficients and partial sums you can watch converge'],
        ['matrix', '[ ]', 'Matrices', 'Inverse, determinant, eigen-things, decompositions'],
        ['calc', '=', 'Calculator', 'Exact fractions and arbitrary expressions'],
        ['solve', 'x=', 'Equation solver', 'Equations and inequalities, with working'],
        ['algebra', 'p(x)', 'Algebra', 'Partial fractions, long division, factoring, gcd, recurrences'],
        ['sums', 'Σk', 'Sums & series', 'Closed forms, telescoping, and convergence tests'],
        ['laplace', 'ℒ', 'Transforms', 'Laplace, inverse Laplace and Fourier transforms'],
        ['vector', '∮', 'Vector calculus', 'Div, curl, line, surface and flux integrals'],
        ['stats', 'x̄', 'Statistics', 'Summaries, regression and distributions'],
        ['number', '#', 'Number theory', 'Factoring, gcd, modular arithmetic, primes'],
        ['units', '⇄', 'Units', 'Convert and check dimensions'],
        ['complex', 'ℂ', 'Complex numbers', 'Arithmetic, polar form, roots and the plane']
    ];
    var toc = $('toc');
    if (toc) TOOLS.forEach(function (t, i) {
        var li = doc.createElement('li'), a = doc.createElement('a');
        a.href = 'app.html?tool=' + t[0];
        a.innerHTML = '<span class="n"></span><span class="g"></span><span><span class="t"></span><span class="d"></span></span>';
        var s = a.children;
        s[0].textContent = (i < 9 ? '0' : '') + (i + 1);
        s[1].textContent = t[1];
        s[2].children[0].textContent = t[2];
        s[2].children[1].textContent = t[3];
        li.appendChild(a); toc.appendChild(li);
    });

    /* ---------- ask form ---------- */
    var form = $('askForm'), q = $('q'), note = $('askNote');
    if (form) {
        form.addEventListener('submit', function (e) {
            if (!q.value.trim()) { e.preventDefault(); note.textContent = 'Type a question first, or pick one below.'; q.focus(); }
        });
        $('chips').addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (!b) return;
            q.value = b.textContent;
            if (form.requestSubmit) form.requestSubmit(); else form.submit();
        });
    }

    /* ---------- theme ---------- */
    var root = doc.documentElement, glyph = $('themeGlyph');
    function paintGlyph() { glyph.textContent = root.getAttribute('data-theme') === 'dark' ? '☾' : '☀'; }
    paintGlyph();
    $('themeBtn').addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next); paintGlyph();
        try { localStorage.setItem('themeMode', next); localStorage.setItem('theme', next); } catch (e) { /* storage blocked */ }
        var m = doc.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', next === 'dark' ? '#14130f' : '#ece6d8');
    });

    /* ---------- Figure 1 ---------- */
    var svg = $('fig'); if (!svg) return;
    var W = 640, L = 46, R = 624, T = 18, B = 362, XM = 3 * Math.PI, Y0 = -0.6, Y1 = 4.4, BASE = 0;
    var f = function (x) { return Math.sin(x) + 0.35 * x; };
    var df = function (x) { return Math.cos(x) + 0.35; };
    var F = function (x) { return 1 - Math.cos(x) + 0.175 * x * x; };
    var sx = function (x) { return L + x / XM * (R - L); };
    var sy = function (y) { return B - (y - Y0) / (Y1 - Y0) * (B - T); };
    var fmt = function (v) { var s = (Math.abs(v) < 0.005 ? 0 : v).toFixed(2); return s.replace('-', '−'); };
    function el(name, attrs, parent) { var n = doc.createElementNS(NS, name); for (var k in attrs) n.setAttribute(k, attrs[k]); (parent || svg).appendChild(n); return n; }

    var defs = el('defs', {});
    var pat = el('pattern', { id: 'hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: 7, height: 7, fill: 'var(--ok)', 'fill-opacity': '.08' }, pat);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 7, 'class': 'hatch-line' }, pat);
    var clip = el('clipPath', { id: 'plotclip' }, defs); el('rect', { x: L, y: T, width: R - L, height: B - T }, clip);

    var y;
    for (y = 1; y <= 4; y++) { el('line', { x1: L, x2: R, y1: sy(y), y2: sy(y), 'class': 'gr' }); var ty = el('text', { x: L - 8, y: sy(y) + 4, 'text-anchor': 'end' }); ty.textContent = y; }
    ['0', 'π', '2π', '3π'].forEach(function (lab, i) {
        var X = sx(i * Math.PI);
        if (i) el('line', { x1: X, x2: X, y1: T, y2: B, 'class': 'gr' });
        el('line', { x1: X, x2: X, y1: sy(BASE) - 4, y2: sy(BASE) + 4, 'class': 'ax' });
        var t = el('text', { x: X, y: sy(BASE) + 20, 'text-anchor': 'middle' }); t.textContent = lab;
    });
    el('line', { x1: L, x2: R, y1: sy(BASE), y2: sy(BASE), 'class': 'ax' });
    el('line', { x1: L, x2: L, y1: T, y2: B, 'class': 'ax' });
    var t0 = el('text', { x: L - 8, y: sy(0) + 4, 'text-anchor': 'end' }); t0.textContent = '0';

    var N = 240, pts = [], i;
    for (i = 0; i <= N; i++) { var xx = XM * i / N; pts.push([xx, f(xx)]); }
    var area = el('path', { 'class': 'area' });
    var edge = el('path', { 'class': 'area-edge' });
    el('path', { 'class': 'curve', d: pts.map(function (p, k) { return (k ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1); }).join('') });
    var tan = el('line', { 'class': 'tan', 'clip-path': 'url(#plotclip)' });
    var guide = el('line', { 'class': 'guide' });
    var hit = el('g', { 'class': 'hit', tabindex: 0, role: 'slider', 'aria-label': 'Point x on the curve', 'aria-valuemin': 0, 'aria-valuemax': XM.toFixed(2), 'aria-valuenow': 0, style: 'cursor:grab' });
    el('circle', { r: 20, fill: 'transparent' }, hit);
    var pt = el('circle', { 'class': 'pt', r: 7 }, hit);

    var a = 2.4, auto = !reduce, touched = false;
    function draw(v) {
        a = Math.max(0, Math.min(XM, v));
        var fa = f(a), m = df(a), k, d = 'M' + sx(0) + ' ' + sy(0);
        var n = Math.max(2, Math.ceil(N * a / XM));
        for (k = 0; k <= n; k++) { var xv = a * k / n; d += 'L' + sx(xv).toFixed(1) + ' ' + sy(f(xv)).toFixed(1); }
        d += 'L' + sx(a).toFixed(1) + ' ' + sy(0) + 'Z';
        area.setAttribute('d', d);
        edge.setAttribute('d', d.replace(/^M[^L]*/, 'M' + sx(0) + ' ' + sy(0)).replace(/Z$/, ''));
        var h = 1.5;
        tan.setAttribute('x1', sx(a - h)); tan.setAttribute('y1', sy(fa - m * h));
        tan.setAttribute('x2', sx(a + h)); tan.setAttribute('y2', sy(fa + m * h));
        guide.setAttribute('x1', sx(a)); guide.setAttribute('x2', sx(a)); guide.setAttribute('y1', sy(0)); guide.setAttribute('y2', sy(fa));
        pt.setAttribute('cx', sx(a)); pt.setAttribute('cy', sy(fa));
        hit.firstChild.setAttribute('cx', sx(a)); hit.firstChild.setAttribute('cy', sy(fa));
        $('rX').textContent = fmt(a); $('rF').textContent = fmt(fa); $('rD').textContent = fmt(m); $('rI').textContent = fmt(F(a));
        hit.setAttribute('aria-valuenow', a.toFixed(2));
        hit.setAttribute('aria-valuetext', 'x = ' + fmt(a) + ', f = ' + fmt(fa) + ', slope ' + fmt(m) + ', area ' + fmt(F(a)));
    }
    draw(a);

    function take() { if (!touched) { touched = true; auto = false; var h = $('figHint'); if (h) h.textContent = 'Drag, or use ← →'; } }
    function fromEvent(e) { var r = svg.getBoundingClientRect(); return ((e.clientX - r.left) / r.width * W - L) / (R - L) * XM; }
    var down = false;
    svg.addEventListener('pointerdown', function (e) { down = true; take(); try { svg.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } draw(fromEvent(e)); });
    svg.addEventListener('pointermove', function (e) { if (down || e.pointerType === 'mouse') { take(); draw(fromEvent(e)); } });
    svg.addEventListener('pointerup', function () { down = false; });
    svg.addEventListener('pointercancel', function () { down = false; });
    hit.addEventListener('keydown', function (e) {
        var step = e.shiftKey ? 0.5 : 0.1, k = e.key;
        if (k === 'ArrowRight' || k === 'ArrowUp') draw(a + step);
        else if (k === 'ArrowLeft' || k === 'ArrowDown') draw(a - step);
        else if (k === 'Home') draw(0); else if (k === 'End') draw(XM);
        else return;
        e.preventDefault(); take();
    });

    /* idle sweep until the visitor takes over; pauses off-screen and in background tabs */
    var visible = true, t = 0, last = 0;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(svg);
    function tick(ts) {
        if (!auto) return;
        if (visible && !doc.hidden) { t += Math.min(ts - last, 60) / 1000; draw(0.4 + (XM - 0.8) * (0.5 - 0.5 * Math.cos(t * 0.5 + 1.5))); }
        last = ts; requestAnimationFrame(tick);
    }
    if (auto) { var hint = $('figHint'); if (hint) hint.textContent = 'Move over it to take control'; requestAnimationFrame(function (ts) { last = ts; tick(ts); }); }
})();
