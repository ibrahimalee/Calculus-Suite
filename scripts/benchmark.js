/* Accuracy benchmark. Runs the engine on a fixed, seeded set of problems and checks every answer against ground truth
   that does NOT come from the engine: its own small differentiator and integrator written here, known limits, roots
   built from chosen integers, and matrix products. Reports what was right, what the tool said it could not do
   (declined: not a wrong answer), and what was wrong. Anyone can rerun it:  npm run benchmark
   Usage: node scripts/benchmark.js [--quick] [--page]   (--page rewrites accuracy.html and accuracy-results.json) */
const fs = require('fs'), path = require('path');
const math = require('mathjs');
const { createEngine } = require('../lib/index.js');
const engine = createEngine();
const QUICK = process.argv.includes('--quick');
const N = k => QUICK ? Math.max(8, Math.round(k / 8)) : k;

// ---------- seeded random numbers: the same problems every run ----------
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const R = rng(20261123), pick = a => a[Math.floor(R() * a.length)], int = (lo, hi) => lo + Math.floor(R() * (hi - lo + 1));

// ---------- the benchmark's own expression generator, with its own derivative ----------
// Every node carries its text s and the text of its derivative d. Arguments of ln and sqrt always have the form w^2+1,
// so every generated function is smooth and defined for all real x, and the test points can be anywhere.
function atom() { const k = int(0, 2); return k === 0 ? { s: 'x', d: '1' } : k === 1 ? (() => { const c = int(2, 5); return { s: `${c}*x`, d: `${c}` }; })() : (() => { const n = int(2, 4); return { s: `x^${n}`, d: `${n}*x^${n - 1}` }; })(); }
function gen(depth) {
    if (depth <= 0) return atom();
    const kind = pick(['sin', 'cos', 'exp', 'ln', 'sqrt', 'atan', 'pow', 'add', 'sub', 'mul', 'div', 'mul', 'add']);
    const u = gen(depth - 1);
    switch (kind) {
        case 'sin': return { s: `sin(${u.s})`, d: `cos(${u.s})*(${u.d})` };
        case 'cos': return { s: `cos(${u.s})`, d: `-sin(${u.s})*(${u.d})` };
        case 'exp': { const w = { s: `(${u.s})/4`, d: `(${u.d})/4` }; return { s: `exp(${w.s})`, d: `exp(${w.s})*(${w.d})` }; }
        case 'ln': return { s: `ln((${u.s})^2+1)`, d: `2*(${u.s})*(${u.d})/((${u.s})^2+1)` };
        case 'sqrt': return { s: `sqrt((${u.s})^2+1)`, d: `(${u.s})*(${u.d})/sqrt((${u.s})^2+1)` };
        case 'atan': return { s: `atan(${u.s})`, d: `(${u.d})/(1+(${u.s})^2)` };
        case 'pow': { const n = int(2, 3); return { s: `(${u.s})^${n}`, d: `${n}*(${u.s})^${n - 1}*(${u.d})` }; }
        case 'add': { const v = gen(depth - 1); return { s: `${u.s} + ${v.s}`, d: `(${u.d}) + (${v.d})` }; }
        case 'sub': { const v = gen(depth - 1); return { s: `${u.s} - (${v.s})`, d: `(${u.d}) - (${v.d})` }; }
        case 'mul': { const v = gen(depth - 1); return { s: `(${u.s})*(${v.s})`, d: `(${u.d})*(${v.s}) + (${u.s})*(${v.d})` }; }
        default: { const v = gen(depth - 1); return { s: `(${u.s})/((${v.s})^2+1)`, d: `((${u.d})*((${v.s})^2+1) - (${u.s})*2*(${v.s})*(${v.d}))/((${v.s})^2+1)^2` }; }
    }
}
const ev = (src, extra) => { const f = math.compile(src.replace(/\bln\b/g, 'log').replace(/\bC\b/g, '0')); return x => { const y = f.evaluate(Object.assign({ x }, extra)); return typeof y === 'number' ? y : (y && typeof y.re === 'number' && Math.abs(y.im) < 1e-12 ? y.re : NaN); }; };
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * (1 + Math.abs(a) + Math.abs(b));
const PTS = [-1.7, -0.9, -0.31, 0.27, 0.74, 1.35, 2.1];
// independent numerical derivative: 6th-order central difference
const nd6 = (f, x, h) => (-f(x - 3 * h) + 9 * f(x - 2 * h) - 45 * f(x - h) + 45 * f(x + h) - 9 * f(x + 2 * h) + f(x + 3 * h)) / (60 * h);
// returns NaN where the function oscillates too fast for the numerical derivative to be trusted (two step sizes disagree)
const ndiff = (f, x) => { const a = nd6(f, x, 2e-4), b = nd6(f, x, 1e-4); return Math.abs(a - b) <= 1e-7 * (1 + Math.abs(a)) ? b : NaN; };
// independent integral: composite 20-point Gauss–Legendre on 64 panels
const GLX = [-0.9931285991850949, -0.9639719272779138, -0.9122344282513259, -0.8391169718222188, -0.7463319064601508, -0.636053680726515, -0.5108670019508271, -0.3737060887154195, -0.2277858511416451, -0.07652652113349734];
const GLW = [0.01761400713915212, 0.04060142980038694, 0.06267204833410907, 0.08327674157670475, 0.10193011981724044, 0.11819453196151841, 0.1316886384491766, 0.14209610931838204, 0.14917298647260374, 0.15275338713072584];
function nint(f, a, b) { let t = 0; const P = 64, w = (b - a) / P; for (let p = 0; p < P; p++) { const c = a + (p + .5) * w, h = w / 2; for (let i = 0; i < 10; i++) t += GLW[i] * h * (f(c + h * GLX[i]) + f(c - h * GLX[i])); } return t; }

// ---------- scoring ----------
const cats = {};
function cat(name, blurb) { return cats[name] || (cats[name] = { name, blurb, total: 0, right: 0, declined: 0, wrong: 0, unread: 0, failures: [] }); }
function record(c, outcome, input, detail) { c.total++; c[outcome]++; if ((outcome === 'wrong' || outcome === 'unread') && c.failures.length < 12) c.failures.push({ input, detail: String(detail || '') }); if (outcome === 'declined') (c.declinedList = c.declinedList || []).push(input); }
const DECLINE = /no closed form|could not|cannot|can't|not found|unable|no elementary|does not converge|diverge|undefined/i;
const SLOW = [];
function run(tool, input, opts) { const t = Date.now(); if (process.env.BENCH_VERBOSE) console.error('start', tool, input.slice(0, 160)); try { return { r: engine.run[tool](input, opts || {}) }; } catch (e) { return { err: e }; } finally { const ms = Date.now() - t; if (ms > 1500) SLOW.push({ tool, input, ms }); if (process.env.BENCH_VERBOSE) console.error(tool, ms + 'ms', input.slice(0, 90)); } }

// 1. derivatives -------------------------------------------------------------
(function () {
    const c = cat('Derivatives', 'Random compositions of sin, cos, exp, ln, √, arctan, powers, sums, products and quotients. Each answer is compared with an independent numerical derivative at 7 points.');
    for (let i = 0; i < N(300); i++) {
        const f = gen(int(1, 3)); const fn = ev(f.s); const input = f.s;
        const o = run('derivative', input, {});
        if (o.err) { record(c, DECLINE.test(o.err.message) ? 'declined' : 'wrong', input, o.err.message); continue; }
        let g; try { g = ev(o.r.main.text); } catch (e) { record(c, 'unread', input, o.r.main.text); continue; }
        const bad = PTS.filter(x => { const t = ndiff(fn, x), a = g(x); return Number.isFinite(t) && !close(a, t, 1e-6); });
        record(c, bad.length ? 'wrong' : 'right', input, `${o.r.main.text}  (differs at x = ${bad.join(', ')})`);
    }
})();

// 2. indefinite integrals ----------------------------------------------------
(function () {
    const c = cat('Indefinite integrals', 'Integrands that are known to have elementary antiderivatives (they are derivatives of random functions). Each answer is differentiated numerically and compared with the integrand.');
    for (let i = 0; i < N(150); i++) {
        const f = gen(int(1, 2)), input = f.d.replace(/\(\s*1\s*\)/g, '1');
        const fn = ev(input);
        const o = run('integral', input, {});
        if (o.err) { record(c, DECLINE.test(o.err.message) ? 'declined' : 'wrong', input, o.err.message); continue; }
        if (/No closed form|Could not/i.test(o.r.main.text) || (o.r.warnings || []).some(w => /No elementary/i.test(w))) { record(c, 'declined', input, o.r.main.text); continue; }
        let g; try { g = ev(o.r.main.text); } catch (e) { record(c, 'unread', input, o.r.main.text); continue; }
        const bad = PTS.filter(x => { const a = ndiff(g, x), t = fn(x); return Number.isFinite(t) && !close(a, t, 1e-5); });
        record(c, bad.length ? 'wrong' : 'right', input, `${o.r.main.text}  (its derivative differs at x = ${bad.join(', ')})`);
    }
})();

// 3. definite integrals ------------------------------------------------------
(function () {
    const c = cat('Definite integrals', 'Random functions on random finite intervals. Each value is compared with an independent 1,280-point Gauss–Legendre quadrature.');
    for (let i = 0; i < N(120); i++) {
        const f = gen(int(1, 3)), a = pick([-2, -1, -0.5, 0, 0.5, 1]), b = a + pick([0.5, 1, 1.5, 2, 3]); const fn = ev(f.s);
        const input = `${f.s}  from ${a} to ${b}`;
        const o = run('integral', f.s, { lower: String(a), upper: String(b) });
        if (o.err) { record(c, DECLINE.test(o.err.message) ? 'declined' : 'wrong', input, o.err.message); continue; }
        const truth = nint(fn, a, b); let got = NaN; try { got = Number(math.evaluate(String(o.r.main.text).replace(/,/g, ''))); } catch (e) { /* unread */ }
        if (!Number.isFinite(got)) { record(c, 'unread', input, o.r.main.text); continue; }
        record(c, close(got, truth, 2e-5) ? 'right' : 'wrong', input, `${got} vs ${truth}`);
    }
})();

// 4. limits (known values) ---------------------------------------------------
(function () {
    const c = cat('Limits', 'Classic limits with values known from textbooks, including one-sided limits and limits at infinity.');
    const L = [['sin(x)/x', '0', 1], ['(1-cos(x))/x^2', '0', 0.5], ['(e^x-1)/x', '0', 1], ['ln(1+x)/x', '0', 1], ['(1+1/x)^x', 'inf', Math.E], ['(1+x)^(1/x)', '0', Math.E], ['x*sin(1/x)', '0', 0], ['(x^2-1)/(x-1)', '1', 2], ['(sqrt(x+1)-1)/x', '0', 0.5], ['tan(x)/x', '0', 1], ['(sin(3x))/(sin(2x))', '0', 1.5], ['x^2*e^(-x)', 'inf', 0], ['(3x^2+2x)/(x^2-5)', 'inf', 3], ['(x^3-8)/(x-2)', '2', 12], ['(atan(x))/x', '0', 1], ['(x-sin(x))/x^3', '0', 1 / 6], ['(e^(2x)-1)/(3x)', '0', 2 / 3], ['ln(x)/x', 'inf', 0], ['x^(1/x)', 'inf', 1], ['(cos(x)-1)/x', '0', 0], ['sqrt(x^2+x)-x', 'inf', 0.5], ['(2^x-1)/x', '0', Math.LN2], ['x*ln(x)', '0', 0], ['(1-cos(2x))/(x*sin(x))', '0', 2], ['(sin(x)-x)/x^3', '0', -1 / 6], ['(e^x-1-x)/x^2', '0', 0.5], ['x/(x+1)', 'inf', 1], ['(tan(x)-sin(x))/x^3', '0', 0.5], ['(a=1)', '0', null]].filter(r => r[2] !== null);
    L.forEach(([f, p, truth]) => {
        const o = run('limit', f, { point: p });
        if (o.err) { record(c, DECLINE.test(o.err.message) ? 'declined' : 'wrong', `${f} as x → ${p}`, o.err.message); return; }
        let got = NaN; const txt = String(o.r.main.text), approx = /≈\s*(-?[\d.]+(?:e[-+]?\d+)?)/i.exec(txt); try { got = approx ? Number(approx[1]) : Number(math.evaluate(txt.replace(/∞|inf/g, 'Infinity').replace(/π/g, 'pi'))); } catch (e) { /* unread */ }
        if (!Number.isFinite(got)) { record(c, 'unread', `${f} as x → ${p}`, o.r.main.text); return; }
        record(c, close(got, truth, 1e-6) ? 'right' : 'wrong', `${f} as x → ${p}`, `${got} vs ${truth}`);
    });
})();

// 5. equations ---------------------------------------------------------------
(function () {
    const c = cat('Equations', 'Polynomials built from chosen integer roots (the answer must be exactly those roots), and equations with mixed trigonometric and polynomial terms (the answer must match an independent sign-change scan on [−10, 10]).');
    for (let i = 0; i < N(60); i++) {
        const k = int(2, 4); const roots = []; while (roots.length < k) { const r = int(-6, 6); if (!roots.includes(r)) roots.push(r); } roots.sort((a, b) => a - b);
        const poly = roots.reduce((p, r) => { const q = new Array(p.length + 1).fill(0); p.forEach((co, j) => { q[j] += co; q[j + 1] -= r * co; }); return q; }, [1]);
        const input = poly.map((co, j) => co === 0 ? '' : `${co > 0 && j ? '+' : ''}${co}*x^${poly.length - 1 - j}`).join('') + ' = 0';
        const o = run('solve', input, {});
        if (o.err) { record(c, DECLINE.test(o.err.message) ? 'declined' : 'wrong', input, o.err.message); continue; }
        const got = (String(o.r.main.text).match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi) || []).map(Number).sort((a, b) => a - b);
        const uniq = [...new Set(got.map(x => +x.toFixed(8)))];
        record(c, uniq.length === roots.length && uniq.every((x, j) => close(x, roots[j], 1e-6)) ? 'right' : 'wrong', input, `${o.r.main.text}  (expected ${roots.join(', ')})`);
    }
    for (let i = 0; i < N(40); i++) {
        const a = int(1, 3), b = int(1, 4), cc = pick([-2, -1, 0, 1, 2]); const lhs = pick([`${a}*sin(x)`, `${a}*cos(x)`, `${a}*atan(x)`]), rhs = `x/${b} + ${cc}`;
        const input = `${lhs} = ${rhs}`; const f = ev(`(${lhs}) - (${rhs})`);
        const truth = []; let px = -10, py = f(-10); for (let k = 1; k <= 40000; k++) { const x = -10 + k * 0.0005, y = f(x); if (y === 0) truth.push(x); else if (py * y < 0) { let lo = px, hi = x; for (let it = 0; it < 80; it++) { const m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; } truth.push((lo + hi) / 2); } px = x; py = y; }
        const o = run('solve', input, {});
        if (o.err) { record(c, DECLINE.test(o.err.message) ? 'declined' : 'wrong', input, o.err.message); continue; }
        const got = [...new Set((String(o.r.main.text).match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter(x => Math.abs(x) <= 10).map(x => +x.toFixed(5)))].sort((p, q) => p - q);
        record(c, got.length === truth.length && got.every((x, j) => close(x, truth[j], 1e-4)) ? 'right' : 'wrong', input, `${got.join(', ')} vs ${truth.map(x => x.toFixed(5)).join(', ')}`);
    }
})();

// 6. matrices ----------------------------------------------------------------
(function () {
    const c = cat('Matrices', 'Random integer matrices. Determinants are compared with an independent computation; inverses must multiply back to the identity; singular matrices must be reported as singular.');
    const parseM = t => { try { return JSON.parse(String(t).replace(/(-?\d+)\s*\/\s*(\d+)/g, (m, p, q) => String(Number(p) / Number(q)))); } catch (e) { return null; } };
    for (let i = 0; i < N(80); i++) {
        const n = int(2, 3), A = Array.from({ length: n }, () => Array.from({ length: n }, () => int(-5, 5)));
        const input = A.map(r => r.join(' ')).join(' ; '), det = Math.round(math.det(A));
        let o = run('matrix', input, { op: 'det' });
        if (o.err) record(c, 'wrong', `det ${input}`, o.err.message); else record(c, close(Number(math.evaluate(String(o.r.main.text))), det, 1e-9) ? 'right' : 'wrong', `det ${input}`, `${o.r.main.text} vs ${det}`);
        o = run('matrix', input, { op: 'inverse' });
        if (det === 0) { record(c, o.err || /singular|not invertible|no inverse/i.test(o.r.main.text + (o.r.warnings || []).join(' ')) ? 'right' : 'wrong', `inverse of singular ${input}`, o.r && o.r.main.text); continue; }
        if (o.err) { record(c, 'wrong', `inverse ${input}`, o.err.message); continue; }
        const B = parseM(o.r.main.text); if (!B) { record(c, 'unread', `inverse ${input}`, o.r.main.text); continue; }
        const P = math.multiply(A, B), ok = P.every((row, r) => row.every((v, k) => Math.abs(v - (r === k ? 1 : 0)) < 1e-9));
        record(c, ok ? 'right' : 'wrong', `inverse ${input}`, o.r.main.text);
    }
})();

// 7. Taylor series -----------------------------------------------------------
(function () {
    const c = cat('Taylor series', 'Random functions expanded about 0 to order 5. The polynomial must agree with the function at x = 0.02, where the first dropped term is far below the tolerance.');
    for (let i = 0; i < N(60); i++) {
        const u = pick(['x', '2*x', 'x^2', '3*x']), form = pick([`sin(${u})`, `cos(${u})`, `exp(${u})`, `atan(${u})`, `ln(1+${u})`, `1/(1+${u})`, `sqrt(1+${u})`, `x*exp(${u})`, `sin(${u})*cos(x)`, `exp(x)*sin(${u})`]);
        const o = run('series', form, { order: '5', point: '0' });
        if (o.err) { record(c, DECLINE.test(o.err.message) ? 'declined' : 'wrong', form, o.err.message); continue; }
        let g; try { g = ev(String(o.r.main.text).replace(/\b(\d+)\s*\/\s*(\d+)\s*\*/g, '($1/$2)*')); } catch (e) { record(c, 'unread', form, o.r.main.text); continue; }
        const f = ev(form), x0 = 0.02; record(c, close(g(x0), f(x0), 1e-7) ? 'right' : 'wrong', form, `${o.r.main.text}: ${g(x0)} vs ${f(x0)}`);
    }
})();

// 8. Check my work -----------------------------------------------------------
const cw = { correct: { total: 0, ok: 0, falseAlarms: [] }, planted: {} };
(function () {
    const flag = src => { try { const r = engine.run.check(src, {}); return /^First mistake/.test(r.main.label); } catch (e) { return null; } };
    const plant = (type, input, wrong) => { const t = cw.planted[type] || (cw.planted[type] = { total: 0, caught: 0, missed: [] }); const f = flag(wrong); t.total++; if (f) t.caught++; else if (t.missed.length < 6) t.missed.push(input + '  →  ' + wrong.split('\n').pop()); };
    for (let i = 0; i < N(200); i++) {
        const f = gen(int(1, 2)); const head = `d/dx(${f.s})`;
        const forms = [f.d, `1*(${f.d})`, `(${f.d}) + x - x`, `2*(${f.d})/2`];
        forms.forEach(d => { cw.correct.total++; const r = flag(`${head}\n= ${d}`); if (r === false) cw.correct.ok++; else if (cw.correct.falseAlarms.length < 8) cw.correct.falseAlarms.push(`${head} = ${d}`); });
        const dn = ev(f.d), fnn = ev(f.s); if (PTS.every(x => Math.abs(dn(x)) < 1e-9 || Math.abs(fnn(x) - dn(x)) < 1e-9)) continue;   // a function whose derivative is 0 (or equals itself) cannot carry a planted mistake
        const other = gen(int(1, 2)); if (other.d.replace(/\s/g, '') === f.d.replace(/\s/g, '')) continue;
        plant('a flipped sign', f.s, `${head}\n= -(${f.d})`);
        plant('a wrong constant factor', f.s, `${head}\n= 3*(${f.d})`);
        plant('a stray constant added', f.s, `${head}\n= (${f.d}) + 2`);
        plant('the derivative of a different function', f.s, `${head}\n= ${other.d}`);
        plant('the function itself, not its derivative', f.s, `${head}\n= ${f.s}`);
    }
    // equations: a lost solution and a wrong root
    for (let i = 0; i < N(80); i++) {
        const r1 = int(-6, 6); let r2 = int(-6, 6); if (r2 === r1) r2 = r1 + 2; const b = -(r1 + r2), cc = r1 * r2;
        const head = `x^2 ${b === 0 ? '' : (b > 0 ? '+ ' : '- ') + (Math.abs(b) === 1 ? '' : Math.abs(b)) + 'x '}${cc >= 0 ? '+' : '-'} ${Math.abs(cc)} = 0`.replace(/\s+/g, ' ');
        cw.correct.total++; const ok = flag(`${head}\n(x - ${r1})(x - ${r2}) = 0\nx = ${r1} or x = ${r2}`.replace(/- -/g, '+ ')); if (ok === false) cw.correct.ok++; else if (cw.correct.falseAlarms.length < 8) cw.correct.falseAlarms.push(head);
        plant('a solution lost in an equation', head, `${head}\nx = ${r1}`);
        plant('a wrong root in an equation', head, `${head}\nx = ${r1} or x = ${r2 + 1}`);
    }
})();

// ---------- report ----------
const out = Object.values(cats);
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '–';
console.log('\nAccuracy benchmark' + (QUICK ? ' (quick)' : '') + '\n');
console.log('category'.padEnd(22), 'problems'.padStart(8), 'right'.padStart(7), 'declined'.padStart(9), 'wrong'.padStart(6), 'unread'.padStart(7));
out.forEach(c => console.log(c.name.padEnd(22), String(c.total).padStart(8), String(c.right).padStart(7), String(c.declined).padStart(9), String(c.wrong).padStart(6), String(c.unread).padStart(7)));
const tot = out.reduce((a, c) => { ['total', 'right', 'declined', 'wrong', 'unread'].forEach(k => { a[k] += c[k]; }); return a; }, { total: 0, right: 0, declined: 0, wrong: 0, unread: 0 });
console.log('TOTAL'.padEnd(22), String(tot.total).padStart(8), String(tot.right).padStart(7), String(tot.declined).padStart(9), String(tot.wrong).padStart(6), String(tot.unread).padStart(7));
console.log(`\nCheck my work: correct working accepted ${cw.correct.ok}/${cw.correct.total}`);
Object.entries(cw.planted).forEach(([k, v]) => console.log(`  planted mistake, ${k}: caught ${v.caught}/${v.total}`));
out.forEach(c => c.failures.forEach(f => console.log(`  [${c.name}] ${f.input} → ${f.detail}`)));
out.forEach(c => (c.declinedList || []).forEach(d => console.log(`  [declined: ${c.name}] ${d}`)));
cw.correct.falseAlarms.forEach(f => console.log('  [false alarm] ' + f));
Object.entries(cw.planted).forEach(([k, v]) => v.missed.forEach(m => console.log(`  [missed: ${k}] ${m}`)));
if (SLOW.length) { console.log('\nSlow (over 1.5 s):'); SLOW.forEach(x => console.log(`  ${x.ms} ms  ${x.tool}  ${x.input.slice(0, 100)}`)); }
const results = { generated: new Date().toISOString().slice(0, 10), seed: 20261123, quick: QUICK, categories: out, totals: tot, checkMyWork: cw };
module.exports = results;
if (process.argv.includes('--page')) require('./benchmark-page.js')(results);
if (require.main === module && !process.argv.includes('--no-exit')) process.exit(tot.wrong ? 1 : 0);
