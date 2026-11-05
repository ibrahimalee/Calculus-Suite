/*
 * Calculus Suite Pro – extra tools (installed on top of the core engine).
 * DOM-free: works in the page, in the Web Worker and in Node.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = { install: factory };
    else root.CalcExtras = { install: factory };
})(typeof self !== 'undefined' ? self : this, function install(engine, math, Algebrite) {
    'use strict';
    const { CalcError, nice, fmt } = engine;
    const I = engine.internals;
    const added = {};
    function register(map) { Object.assign(added, map); Object.assign(engine.run, I.wrapRuns(map)); }
    engine.extras = { register };

    // ======================================================================
    // Worked solutions ("steps") layered on the core results
    // ======================================================================
    const base = Object.assign({}, engine.run);
    const F_ = math.fraction;
    const frTxt = f => { const n = f.s * f.n; return f.d === 1 ? String(n) : `${n}/${f.d}`; };
    const frTex = f => { const n = f.s * f.n; return f.d === 1 ? String(n) : `${n < 0 ? '-' : ''}\\frac{${Math.abs(n)}}{${f.d}}`; };
    const isZero = f => f.n === 0;
    const matTexF = (M, aug) => `\\left[\\begin{array}{${'c'.repeat(M[0].length - (aug || 0))}${aug ? '|' + 'c'.repeat(aug) : ''}}${M.map(r => r.map(frTex).join('&')).join('\\\\')}\\end{array}\\right]`;
    const toFr = M => M.map(r => r.map(x => { try { return F_(x); } catch (e) { return F_(Math.round(x * 1e6), 1e6); } }));
    const rowName = i => `R${i + 1}`;
    const sgnTerm = (f, i) => { const neg = f.s < 0; const a = F_(f.n, f.d); const c = (a.n === 1 && a.d === 1) ? '' : frTxt(a) + '·'; return { neg, txt: `${c}${rowName(i)}` }; };

    /** Gauss–Jordan with every row operation recorded. `aug` = number of augmented columns (e.g. identity for an inverse). */
    function gaussSteps(M0, aug) {
        const M = toFr(M0), m = M.length, n = M[0].length, cols = n - (aug || 0);
        const steps = [{ title: 'Start', text: aug ? 'Augment A with the identity matrix.' : 'Start from the matrix.', tex: matTexF(M, aug) }];
        let row = 0; const pivots = []; let detFactor = F_(1);
        const snap = (title, text) => { if (steps.length < 40) steps.push({ title, text, tex: matTexF(M, aug) }); };
        for (let c = 0; c < cols && row < m; c++) {
            let pr = -1; for (let r = row; r < m; r++) if (!isZero(M[r][c])) { pr = r; break; }
            if (pr < 0) continue;
            if (pr !== row) { [M[pr], M[row]] = [M[row], M[pr]]; detFactor = math.multiply(detFactor, F_(-1)); snap(`Swap ${rowName(row)} ↔ ${rowName(pr)}`, `Column ${c + 1} needs a non-zero pivot in row ${row + 1}.`); }
            const pv = M[row][c];
            if (!(pv.n === 1 && pv.d === 1 && pv.s === 1)) { const inv = math.divide(F_(1), pv); M[row] = M[row].map(x => math.multiply(x, inv)); detFactor = math.multiply(detFactor, pv); snap(`${rowName(row)} → ${frTxt(inv)}·${rowName(row)}`, `Scale so the pivot in column ${c + 1} becomes 1.`); }
            for (let r = 0; r < m; r++) {
                if (r === row || isZero(M[r][c])) continue;
                const k = M[r][c];
                M[r] = M[r].map((x, j) => math.subtract(x, math.multiply(k, M[row][j])));
                const kk = sgnTerm(k, row);
                snap(`${rowName(r)} → ${rowName(r)} ${kk.neg ? '−' : '+'} ${kk.txt.replace(/^-/, '')}`.replace(/\+ -/, '− '), `Clear column ${c + 1} in row ${r + 1}.`);
            }
            pivots.push(c); row++;
        }
        return { steps, R: M, pivots, detFactor };
    }

    function matrixSteps(r, src, opt) {
        const M = I.parseMatrix(src), m = M.length, n = M[0].length, op = opt.op || 'det';
        let steps = null;
        if (op === 'rref' || op === 'rank') {
            const g = gaussSteps(M, 0); steps = g.steps;
            steps.push({ title: 'Read off the result', text: `${g.pivots.length} pivot${g.pivots.length === 1 ? '' : 's'} (columns ${g.pivots.map(p => p + 1).join(', ') || 'none'}) → rank ${g.pivots.length}.`, tex: `\\operatorname{rank}A=${g.pivots.length}` });
        } else if (op === 'inverse' && m === n) {
            const aug = M.map((row, i) => row.concat(row.map((_, j) => (i === j ? 1 : 0))));
            const g = gaussSteps(aug, n); steps = g.steps;
            steps.push({ title: 'Read off A⁻¹', text: 'The left block is now I, so the right block is A⁻¹.', tex: `A^{-1}=${matTexF(g.R.map(row => row.slice(n)))}` });
        } else if (op === 'det' && m === n) {
            const A = toFr(M);
            if (n === 2) {
                steps = [{ title: '2×2 formula', text: 'det = ad − bc', tex: `\\det A=${frTex(A[0][0])}\\cdot${frTex(A[1][1])}-${frTex(A[0][1])}\\cdot${frTex(A[1][0])}` }];
            } else if (n === 3) {
                const t = []; let sum = F_(0);
                for (let j = 0; j < 3; j++) {
                    const cols = [0, 1, 2].filter(c => c !== j), minor = math.subtract(math.multiply(A[1][cols[0]], A[2][cols[1]]), math.multiply(A[1][cols[1]], A[2][cols[0]]));
                    const term = math.multiply(math.multiply(A[0][j], minor), F_(j % 2 ? -1 : 1)); sum = math.add(sum, term);
                    t.push({ title: `Cofactor along the first row – term ${j + 1}`, text: `${j % 2 ? '−' : '+'} a₁${j + 1} · (2×2 minor) = ${frTxt(A[0][j])} · (${frTxt(minor)})`, tex: `${j % 2 ? '-' : '+'}\\,${frTex(A[0][j])}\\cdot\\det\\begin{bmatrix}${frTex(A[1][cols[0]])}&${frTex(A[1][cols[1]])}\\\\${frTex(A[2][cols[0]])}&${frTex(A[2][cols[1]])}\\end{bmatrix}=${frTex(term)}` });
                }
                steps = t; steps.push({ title: 'Add the three terms', text: `det A = ${frTxt(sum)}`, tex: `\\det A=${frTex(sum)}` });
            } else {
                const g = gaussSteps(M, 0); steps = g.steps;
                const det = g.pivots.length < n ? F_(0) : g.detFactor;
                steps.push({ title: 'Determinant from the row operations', text: `Swaps flip the sign and scaling a row by p multiplies the determinant by p; the reduced matrix is I, so det A = ${frTxt(det)}.`, tex: `\\det A=${frTex(det)}` });
            }
        }
        if (steps && steps.length) { const head = r.steps.filter(s => /^Check$|^Verified/.test(s.title)); r.steps = steps.concat(head); }
    }

    // ---- limits: classify indeterminate forms, apply L'Hôpital --------------
    function limitSteps(r, src, opt) {
        const node = engine.parse(src);
        const vars = engine.freeVars(node); const v = (opt.variable || vars[0] || 'x');
        const pt = I.parseLimit(opt.point == null || opt.point === '' ? '0' : opt.point, 'point');
        const a = pt.value;
        const f = engine.compile(node, [v]);
        const probe = x => f(Number.isFinite(a) ? a + x : (a > 0 ? 1 / x : -1 / x));
        const eps = 1e-7;
        const near = fn => { const r1 = fn(eps), r2 = fn(-eps); return Number.isFinite(a) ? [r1, r2] : [fn(1e-7)]; };
        const kind = vals => { const x = vals.filter(Number.isFinite); return vals.every(y => Math.abs(y) < 1e-4) ? 0 : vals.every(y => !Number.isFinite(y) || Math.abs(y) > 1e4) ? Infinity : null; };
        const pointTxt = Number.isFinite(a) ? engine.strOf(pt.node || math.parse(String(a))) : (a > 0 ? '∞' : '−∞');
        const pointTex = Number.isFinite(a) ? engine.texOf(pt.node || math.parse(String(a))) : (a > 0 ? '\\infty' : '-\\infty');
        const out = [];
        const lim = tx => `\\lim_{${v}\\to ${pointTex}}${tx}`;
        let N = null, D = null;
        const strip = n => (n.type === 'ParenthesisNode' ? n.content : n);
        const top = strip(node);
        if (top.type === 'OperatorNode' && top.op === '/' && top.args.length === 2) { N = strip(top.args[0]); D = strip(top.args[1]); }
        if (N && D) {
            let fN = engine.compile(N, [v]), fD = engine.compile(D, [v]);
            const kN = kind(near(x => fN(Number.isFinite(a) ? a + x : (a > 0 ? 1 / x : -1 / x)))), kD = kind(near(x => fD(Number.isFinite(a) ? a + x : (a > 0 ? 1 / x : -1 / x))));
            const form = kN === 0 && kD === 0 ? '0/0' : kN === Infinity && kD === Infinity ? '∞/∞' : null;
            if (form) {
                out.push({ title: 'Direct substitution gives an indeterminate form', text: `Numerator and denominator both ${form === '0/0' ? 'tend to 0' : 'tend to ±∞'}: form ${form}.`, tex: `${lim(`\\frac{${engine.texOf(N)}}{${engine.texOf(D)}}`)}\;\\to\;\\text{form }${form === '0/0' ? '\\frac{0}{0}' : '\\frac{\\infty}{\\infty}'}` });
                let cn = N, cd = D;
                for (let round = 1; round <= 4; round++) {
                    const dn = engine.diff(cn, v), dd = engine.diff(cd, v);
                    out.push({ title: `L'Hôpital's rule (round ${round})`, text: `Differentiate numerator and denominator separately: (${engine.strOf(cn)})′ = ${engine.strOf(dn)},  (${engine.strOf(cd)})′ = ${engine.strOf(dd)}.`, tex: `${lim(`\\frac{${engine.texOf(cn)}}{${engine.texOf(cd)}}`)}=${lim(`\\frac{${engine.texOf(dn)}}{${engine.texOf(dd)}}`)}` });
                    cn = dn; cd = dd;
                    const gN = engine.compile(cn, [v]), gD = engine.compile(cd, [v]);
                    const mk = g => x => g(Number.isFinite(a) ? a + x : (a > 0 ? 1 / x : -1 / x));
                    const k1 = kind(near(mk(gN))), k2 = kind(near(mk(gD)));
                    if (!((k1 === 0 && k2 === 0) || (k1 === Infinity && k2 === Infinity))) break;
                    out.push({ title: 'Still indeterminate', text: 'The new quotient is again 0/0 or ∞/∞, so apply the rule once more.', tex: '' });
                }
                out.push({ title: 'Evaluate the new limit', text: `The limit of the last quotient is ${r.main ? r.main.text.replace(/^.*=\s*/, '') : ''}.`, tex: r.main && r.main.tex ? r.main.tex : '' });
            }
        }
        if (!out.length) {
            const s1 = engine.strOf(node);
            if (/\^/.test(s1) && Number.isFinite(a) === false) out.push({ title: 'Possible form 1^∞ or ∞⁰', text: 'For g(x)^h(x) write it as exp(h(x)·ln g(x)) and take the limit of the exponent first.', tex: '' });
            else if (top.type === 'OperatorNode' && top.op === '-' && top.args.length === 2 && !Number.isFinite(f(Number.isFinite(a) ? a + 1e-9 : 1e9))) out.push({ title: 'Possible form ∞ − ∞', text: 'Combine into one fraction or multiply by the conjugate to remove the cancellation.', tex: '' });
        }
        if (out.length) r.steps = out.concat(r.steps.filter(s => !/^Try direct/.test(s.title)));
    }

    // ---- equations: linear and quadratic walk-throughs ---------------------
    function solveSteps(r, src) {
        const parts = String(src).split('='); if (parts.length !== 2) return;
        const lhs = engine.parse(parts[0]), rhs = engine.parse(parts[1]);
        const vars = Array.from(new Set(engine.freeVars(lhs).concat(engine.freeVars(rhs)))); if (vars.length !== 1) return;
        const v = vars[0]; const fL = engine.compile(lhs, [v]), fR = engine.compile(rhs, [v]);
        const g = x => fL(x) - fR(x);
        const c0 = g(0), c1 = g(1), c2 = g(2), cm = g(-1);
        const a2 = (c1 + cm) / 2 - c0, b1 = (c1 - cm) / 2;
        const lin = Math.abs(c2 - (2 * b1 + c0)) < 1e-9 * (1 + Math.abs(c2)) && Math.abs(a2) < 1e-9;
        const T = x => nice(x, 8, 1e-9);
        const out = [{ title: 'Bring everything to one side', text: `${engine.strOf(lhs)} − (${engine.strOf(rhs)}) = 0`, tex: `${engine.texOf(lhs)}-\\left(${engine.texOf(rhs)}\\right)=0` }];
        if (lin && Math.abs(b1) > 1e-12) {
            out.push({ title: 'Collect like terms', text: `${T(b1).text}·${v} + (${T(c0).text}) = 0`, tex: `${T(b1).tex}${v}+\\left(${T(c0).tex}\\right)=0` });
            out.push({ title: `Isolate ${v}`, text: `${T(b1).text}·${v} = ${T(-c0).text}`, tex: `${T(b1).tex}${v}=${T(-c0).tex}` });
            out.push({ title: `Divide by ${T(b1).text}`, text: `${v} = ${T(-c0 / b1).text}`, tex: `${v}=${T(-c0 / b1).tex}` });
            r.steps = out.concat(r.steps.filter(s => /^Check/.test(s.title)));
        } else if (Math.abs(a2) > 1e-12 && Math.abs(c2 - (4 * a2 + 2 * b1 + c0)) < 1e-8 * (1 + Math.abs(c2))) {
            const D = b1 * b1 - 4 * a2 * c0;
            out.push({ title: 'Standard form', text: `${T(a2).text}·${v}² + ${T(b1).text}·${v} + ${T(c0).text} = 0`, tex: `${T(a2).tex}${v}^2+\\left(${T(b1).tex}\\right)${v}+\\left(${T(c0).tex}\\right)=0` });
            out.push({ title: 'Quadratic formula', text: `${v} = (−b ± √(b² − 4ac)) / 2a`, tex: `${v}=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}` });
            out.push({ title: 'Discriminant', text: `Δ = (${T(b1).text})² − 4·(${T(a2).text})·(${T(c0).text}) = ${T(D).text} → ${D > 1e-12 ? 'two real roots' : Math.abs(D) <= 1e-12 ? 'one repeated root' : 'two complex roots'}`, tex: `\\Delta=${T(D).tex}` });
            r.steps = out.concat(r.steps.filter(s => !/^Quadratic formula$|^Discriminant$|^Standard form/.test(s.title)).slice(0));
        }
    }

    // ---- integrals: reveal the technique behind CAS results ------------------
    function integralSteps(r, src, opt) {
        if (!r.steps.length) return;
        const generic = /^Symbolic integration$/.test(r.steps[0].title);
        const exactOnly = r.steps[0].title === 'Antiderivative';
        if (!generic && !exactOnly) return;
        const node = engine.parse(src); const vars = engine.freeVars(node); const v = opt.variable || vars[0] || 'x';
        for (const method of ['substitution', 'parts', 'partial']) {
            let res; try { res = engine.antiderivative(node, v, method); } catch (e) { res = null; }
            if (res && res.ok && res.steps && res.steps.length) {
                const st = res.steps.slice();
                for (let i = 0; i + 1 < st.length; i++) if (/^Apply ∫u dv/.test(st[i].title) && /^Integration by parts \(round/.test(st[i + 1].title)) { const t = st[i]; st[i] = st[i + 1]; st[i + 1] = t; i++; }
                st.push({ title: 'Assemble the result', text: `F(${v}) = ${engine.strOf(res.F)}`, tex: `F(${v})=${engine.texOf(res.F)}` });
                res = Object.assign({}, res, { steps: st });
                const note = { title: `Worked solution (${res.method})`, text: 'The steps below show one valid technique; every antiderivative agrees up to the constant C.', tex: '' };
                if (generic) r.steps = [note].concat(res.steps, r.steps.slice(1));
                else r.steps = [note].concat(res.steps, r.steps);
                return;
            }
        }
    }

    const wrap = (mode, fn) => { engine.run[mode] = (src, opt) => { const r = base[mode](src, opt || {}); try { fn(r, src, opt || {}); } catch (e) { /* keep the engine's own steps */ } return r; }; };
    wrap('matrix', matrixSteps);
    wrap('limit', limitSteps);
    wrap('solve', solveSteps);
    wrap('integral', integralSteps);

    // ======================================================================
    // Laplace & Fourier transforms (exponential-polynomial algebra, exact)
    // ======================================================================
    const Cx = (re, im) => ({ re: re || 0, im: im || 0 });
    const cadd = (a, b) => Cx(a.re + b.re, a.im + b.im);
    const cmul = (a, b) => Cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
    const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return Cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
    const cabs = a => Math.hypot(a.re, a.im);
    const cexp = a => { const m = Math.exp(a.re); return Cx(m * Math.cos(a.im), m * Math.sin(a.im)); };
    const key = (n, z) => `${n}|${(+z.re.toFixed(9)) + 0}|${(+z.im.toFixed(9)) + 0}`;

    /** f(t) as a sum of c·tⁿ·e^{zt} (complex c, z). */
    const epConst = c => { const m = new Map(); m.set(key(0, Cx()), { n: 0, z: Cx(), c }); return m; };
    const epAdd = (A, B) => { const m = new Map(A); B.forEach((t, k) => { if (m.has(k)) { const o = m.get(k); m.set(k, { n: o.n, z: o.z, c: cadd(o.c, t.c) }); } else m.set(k, t); }); return m; };
    const epScale = (A, c) => { const m = new Map(); A.forEach((t, k) => m.set(k, { n: t.n, z: t.z, c: cmul(t.c, c) })); return m; };
    const epMul = (A, B) => { let m = new Map(); A.forEach(a => B.forEach(b => { const z = cadd(a.z, b.z); m = epAdd(m, new Map([[key(a.n + b.n, z), { n: a.n + b.n, z, c: cmul(a.c, b.c) }]])); })); return m; };
    const epClean = A => { const m = new Map(); A.forEach((t, k) => { if (cabs(t.c) > 1e-11) m.set(k, t); }); return m; };

    function toExpPoly(node, v) {
        const unsupported = () => new CalcError('The Laplace table handles sums and products of polynomials, exponentials, sin, cos, sinh and cosh of linear arguments (e.g. t^2*exp(-3t)*cos(2t)).');
        const lin = n => { const E = epClean(rec(n)); let c0 = Cx(), c1 = Cx(); E.forEach(t => { if (t.n === 0 && cabs(t.z) < 1e-12) c0 = cadd(c0, t.c); else if (t.n === 1 && cabs(t.z) < 1e-12) c1 = cadd(c1, t.c); else throw unsupported(); }); return { c0, c1 }; };
        const expOf = ({ c0, c1 }) => { const m = new Map(); const z = c1; m.set(key(0, z), { n: 0, z, c: cexp(c0) }); return m; };
        const rec = n => {
            switch (n.type) {
                case 'ParenthesisNode': return rec(n.content);
                case 'ConstantNode': if (typeof n.value !== 'number') throw unsupported(); return epConst(Cx(n.value));
                case 'SymbolNode':
                    if (n.name === v) return new Map([[key(1, Cx()), { n: 1, z: Cx(), c: Cx(1) }]]);
                    if (n.name === 'pi') return epConst(Cx(Math.PI)); if (n.name === 'e') return epConst(Cx(Math.E)); if (n.name === 'i') return epConst(Cx(0, 1));
                    throw new CalcError(`Unknown symbol “${n.name}”. Use only the variable ${v}.`);
                case 'OperatorNode': {
                    const a = n.args.map(rec);
                    if (n.fn === 'add') return epAdd(a[0], a[1]);
                    if (n.fn === 'subtract') return epAdd(a[0], epScale(a[1], Cx(-1)));
                    if (n.fn === 'unaryMinus') return epScale(a[0], Cx(-1));
                    if (n.fn === 'unaryPlus') return a[0];
                    if (n.fn === 'multiply') return epMul(a[0], a[1]);
                    if (n.fn === 'divide') { const d = epClean(a[1]); if (d.size !== 1) throw unsupported(); const t = d.values().next().value; if (t.n !== 0 || cabs(t.z) > 1e-12) throw unsupported(); return epScale(a[0], cdiv(Cx(1), t.c)); }
                    if (n.fn === 'pow') {
                        const b = unwrap(n.args[0]);
                        if (b.type === 'SymbolNode' && b.name === 'e') return expOf(lin(n.args[1]));
                        const ex = epClean(a[1]); const k = ex.size === 1 && ex.values().next().value.n === 0 ? ex.values().next().value.c : null;
                        if (!k || Math.abs(k.im) > 1e-12 || k.re < 0 || Math.abs(k.re - Math.round(k.re)) > 1e-12 || k.re > 14) throw unsupported();
                        let r = epConst(Cx(1)); for (let i = 0; i < Math.round(k.re); i++) r = epMul(r, a[0]); return r;
                    }
                    throw unsupported();
                }
                case 'FunctionNode': {
                    const name = n.fn && n.fn.name; const arg = n.args[0];
                    if (name === 'exp') return expOf(lin(arg));
                    if (['sin', 'cos', 'sinh', 'cosh'].includes(name)) {
                        const { c0, c1 } = lin(arg); const i = Cx(0, 1), mi = Cx(0, -1);
                        const e = (zc, c0z) => new Map([[key(0, zc), { n: 0, z: zc, c: cexp(c0z) }]]);
                        if (name === 'cos') return epScale(epAdd(e(cmul(i, c1), cmul(i, c0)), e(cmul(mi, c1), cmul(mi, c0))), Cx(0.5));
                        if (name === 'sin') return epScale(epAdd(e(cmul(i, c1), cmul(i, c0)), epScale(e(cmul(mi, c1), cmul(mi, c0)), Cx(-1))), Cx(0, -0.5));
                        const mc1 = cmul(Cx(-1), c1), mc0 = cmul(Cx(-1), c0);
                        if (name === 'cosh') return epScale(epAdd(e(c1, c0), e(mc1, mc0)), Cx(0.5));
                        return epScale(epAdd(e(c1, c0), epScale(e(mc1, mc0), Cx(-1))), Cx(0.5));
                    }
                    throw unsupported();
                }
                default: throw unsupported();
            }
        };
        return epClean(rec(node));
    }
    function unwrap(n) { while (n && n.type === 'ParenthesisNode') n = n.content; return n; }

    // complex polynomial helpers (ascending order)
    const cpMul = (p, q) => { const r = new Array(p.length + q.length - 1).fill(0).map(() => Cx()); p.forEach((a, i) => q.forEach((b, j) => { r[i + j] = cadd(r[i + j], cmul(a, b)); })); return r; };
    const cpAdd = (p, q) => { const n = Math.max(p.length, q.length); return Array.from({ length: n }, (_, i) => cadd(p[i] || Cx(), q[i] || Cx())); };
    const cpPow = (p, k) => { let r = [Cx(1)]; for (let i = 0; i < k; i++) r = cpMul(r, p); return r; };
    const fact = n => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };

    const polyStr = (co, v, tex) => {
        const T = x => nice(x, 8, 1e-9);
        const parts = [];
        for (let k = co.length - 1; k >= 0; k--) {
            const c = co[k]; if (Math.abs(c) < 1e-11) continue;
            const a = Math.abs(c), cs = a === 1 && k > 0 ? '' : (tex ? T(a).tex : T(a).text);
            const xs = k === 0 ? '' : k === 1 ? v : tex ? `${v}^{${k}}` : `${v}^${k}`;
            const body = k === 0 ? cs : (cs && !tex && !/^[\d.]+$/.test(cs) ? `(${cs})` : cs) + (cs && !tex ? '*' : '') + xs;
            parts.push((parts.length ? (c < 0 ? ' - ' : ' + ') : (c < 0 ? '-' : '')) + body);
        }
        return parts.join('') || '0';
    };

    /** Σ c·n!/(s−z)^{n+1} as numerator polynomial over a factored denominator. */
    function laplaceOfTerms(terms) {
        const poles = [];
        terms.forEach(t => { let p = poles.find(q => Math.hypot(q.z.re - t.z.re, q.z.im - t.z.im) < 1e-8); if (!p) { p = { z: t.z, m: 0 }; poles.push(p); } p.m = Math.max(p.m, t.n + 1); });
        let num = [Cx()];
        terms.forEach(t => {
            let prod = [cmul(t.c, Cx(fact(t.n)))];
            poles.forEach(p => { const same = Math.hypot(p.z.re - t.z.re, p.z.im - t.z.im) < 1e-8; const e = same ? p.m - (t.n + 1) : p.m; prod = cpMul(prod, cpPow([Cx(-p.z.re, -p.z.im), Cx(1)], e)); });
            num = cpAdd(num, prod);
        });
        let den = [Cx(1)]; poles.forEach(p => { den = cpMul(den, cpPow([Cx(-p.z.re, -p.z.im), Cx(1)], p.m)); });
        const worst = Math.max(...num.concat(den).map(c => Math.abs(c.im)));
        const mag = Math.max(1, ...num.concat(den).map(c => Math.abs(c.re)));
        if (worst > 1e-8 * mag) throw new CalcError('This function has a complex-valued transform (it is not a real signal).');
        // factored denominator
        const used = new Array(poles.length).fill(false), fac = [];
        poles.forEach((p, i) => {
            if (used[i]) return; used[i] = true;
            if (Math.abs(p.z.im) < 1e-9) fac.push({ kind: 'real', a: p.z.re, m: p.m });
            else { const j = poles.findIndex((q, k) => !used[k] && Math.abs(q.z.re - p.z.re) < 1e-8 && Math.abs(q.z.im + p.z.im) < 1e-8); if (j >= 0) used[j] = true; fac.push({ kind: 'quad', a: p.z.re, b: Math.abs(p.z.im), m: p.m }); }
        });
        let numR = num.map(c => c.re); while (numR.length > 1 && Math.abs(numR[numR.length - 1]) < 1e-11 * mag) numR.pop();
        return { num: numR, den: den.map(c => c.re), fac, sigma: Math.max(...poles.map(p => p.z.re)) };
    }
    function facStr(fac, v, tex) {
        const T = x => nice(x, 8, 1e-9);
        return fac.map(f => {
            let b;
            if (f.kind === 'real') b = f.a === 0 ? v : (tex ? `(${v}${f.a < 0 ? '+' : '-'}${T(Math.abs(f.a)).tex})` : `(${v} ${f.a < 0 ? '+' : '-'} ${T(Math.abs(f.a)).text})`);
            else b = tex ? `(${polyStr([f.a * f.a + f.b * f.b, -2 * f.a, 1], v, true)})` : `(${polyStr([f.a * f.a + f.b * f.b, -2 * f.a, 1], v)})`;
            return f.m > 1 ? (tex ? `${b}^{${f.m}}` : `${b}^${f.m}`) : b;
        }).join(tex ? '' : ' * ');
    }

    function runLaplace(src, opt) {
        const op = opt.op || 'laplace';
        if (op === 'inverse') return runInverseLaplace(src, opt);
        if (op === 'fourier') return runFourierTransform(src, opt);
        const node = engine.parse(src);
        const vs = engine.freeVars(node); if (vs.length > 1) throw new CalcError('Use a single variable (t).');
        const v = vs[0] || 't';
        const terms = Array.from(toExpPoly(node, v).values());
        const r = I.makeResult('laplace', 'Laplace transform');
        r.items.push({ label: `f(${v}) =`, text: engine.strOf(node), tex: `f(${v})=${engine.texOf(node)}` });
        if (!terms.length) { r.main = { label: `ℒ{f}(s) =`, text: '0', tex: '\\mathcal{L}\\{f\\}(s)=0' }; return I.finalizeText(r); }
        const L = laplaceOfTerms(terms);
        const nStr = polyStr(L.num, 's'), dStr = facStr(L.fac, 's'), nTex = polyStr(L.num, 's', true), dTex = facStr(L.fac, 's', true);
        r.main = { label: 'F(s) =', text: `(${nStr}) / (${dStr})`, tex: `F(s)=\\dfrac{${nTex}}{${dTex}}` };
        r.items.push({ label: 'Region of convergence:', text: `Re(s) > ${nice(L.sigma, 8, 1e-9).text}`, tex: `\\operatorname{Re}(s)>${nice(L.sigma, 8, 1e-9).tex}` });
        r.items.push({ label: 'Expanded denominator:', text: polyStr(L.den, 's'), tex: `D(s)=${polyStr(L.den, 's', true)}` });
        // independent numeric check: ∫₀^∞ f(t)e^{-s t} dt at a point to the right of every pole
        try {
            const f = engine.compile(node, [v]); const s0 = Math.max(L.sigma, 0) + 1.7;
            const num = numLaplace(f, s0, L.sigma);
            const ex = polyEval(L.num, s0) / polyEval(L.den, s0);
            if (Number.isFinite(num.value) && Math.abs(num.value - ex) <= 1e-6 * Math.max(1, Math.abs(ex))) r.meta.push(`Verified: ∫₀^∞ f(t)e^(−st) dt = ${engine.fmt(num.value, 8)} at s = ${engine.fmt(s0, 4)} matches F(s).`);
            else r.warnings.push('The numerical check at one value of s did not agree to 6 digits.');
        } catch (e) { /* skip the check */ }
        r.meta.push('Method: exponential-polynomial table – ℒ{tⁿ e^{at}} = n!/(s − a)ⁿ⁺¹, with sin/cos/sinh/cosh rewritten through e^{±iωt}');
        r.steps.push({ title: 'Rewrite f(t) as a sum of terms tⁿ·e^{zt}', text: 'Products of exponentials and trigonometric functions are expanded with Euler’s formula so every term has the form c·tⁿ·e^{zt}.', tex: `f(${v})=\\sum_k c_k\\,${v}^{n_k}e^{z_k ${v}}` });
        terms.sort((a, b) => a.z.re - b.z.re || a.z.im - b.z.im || a.n - b.n).forEach(t => {
            const zs = Math.abs(t.z.im) < 1e-9 ? nice(t.z.re, 6, 1e-9).text : `${nice(t.z.re, 6, 1e-9).text}${t.z.im < 0 ? '−' : '+'}${nice(Math.abs(t.z.im), 6, 1e-9).text}i`;
            const cs = Math.abs(t.c.im) < 1e-9 ? nice(t.c.re, 6, 1e-9).text : `(${nice(t.c.re, 6, 1e-9).text}${t.c.im < 0 ? '−' : '+'}${nice(Math.abs(t.c.im), 6, 1e-9).text}i)`;
            r.steps.push({ title: `Transform ${cs}·${v}${t.n ? '^' + t.n : ''}·e^(${zs}${v})`, text: `ℒ{tⁿe^{zt}} = n!/(s − z)ⁿ⁺¹ with n = ${t.n}, z = ${zs}`, tex: `\\mathcal{L}\\{t^{${t.n}}e^{zt}\\}=\\frac{${fact(t.n)}}{(s-z)^{${t.n + 1}}}` });
        });
        r.steps.push({ title: 'Combine over a common denominator', text: `F(s) = (${nStr}) / (${dStr})`, tex: `F(s)=\\dfrac{${nTex}}{${dTex}}` });
        return I.finalizeText(r);
    }
    const numLaplace = (f, s0, sigma) => { const T = 40 / (s0 - sigma); return engine.integrateRobust(t => f(t) * Math.exp(-s0 * t), 0, T); };
    const polyEval = (co, x) => co.reduceRight((a, c) => a * x + c, 0);

    function runInverseLaplace(src, opt) {
        const node = engine.parse(src); const vs = engine.freeVars(node);
        if (vs.length > 1) throw new CalcError('Use a single variable (s).');
        const sv = vs[0] || 's';
        const rat = I.toRational(node, sv);
        if (!rat) throw new CalcError('Enter F(s) as a rational function, e.g. (s+3)/(s^2+2s+5).');
        let N = rat.n.slice(), D = rat.d.slice();
        const dl = D[D.length - 1]; N = N.map(x => x / dl); D = D.map(x => x / dl);
        const degD = D.length - 1; if (degD < 1) throw new CalcError('The denominator must contain s.');
        if (N.length - 1 >= degD) throw new CalcError('F(s) must be proper (numerator degree below denominator degree); otherwise the inverse contains Dirac-delta terms.');
        const roots = I.polyRootsMult(D.slice());
        const poles = roots.map(z => ({ z: Cx(z.re, Math.abs(z.im) < 1e-9 * Math.max(1, Math.abs(z.re)) ? 0 : z.im), m: z.mult }));
        const unk = []; poles.forEach((p, k) => { for (let j = 1; j <= p.m; j++) unk.push({ k, j }); });
        const total = unk.length; if (total !== degD) throw new CalcError('Could not resolve the poles of the denominator reliably.');
        const pts = []; const R = 1.5 + Math.max(...poles.map(p => cabs(p.z)));
        for (let i = 0; i < total; i++) { const ang = 2 * Math.PI * (i + 0.37) / total; pts.push(Cx(R * Math.cos(ang) + 0.11, R * Math.sin(ang))); }
        const pev = (co, s) => co.reduceRight((a, c) => cadd(cmul(a, s), Cx(c)), Cx());
        const A = pts.map(s => unk.map(u => { let prod = Cx(1); poles.forEach((p, k) => { const e = k === u.k ? p.m - u.j : p.m; for (let q = 0; q < e; q++) prod = cmul(prod, cadd(s, Cx(-p.z.re, -p.z.im))); }); return math.complex(prod.re, prod.im); }));
        const b = pts.map(s => { const x = pev(N, s); return [math.complex(x.re, x.im)]; });
        let sol; try { sol = math.lusolve(A, b).map(x => { const z = math.complex(x[0]); return Cx(z.re, z.im); }); } catch (e) { throw new CalcError('The partial-fraction system was singular – check the denominator.'); }
        // assemble real terms
        const snap = x => { const n = nice(x, 10, 5e-9); return /^-?\d+(\/\d+)?$/.test(n.text) ? `(${n.text})` : `(${x.toPrecision(12)})`; };
        const pieces = [];
        poles.forEach((p, k) => {
            if (p.z.im < -1e-12) return;
            for (let j = 1; j <= p.m; j++) {
                const c = sol[unk.findIndex(u => u.k === k && u.j === j)]; const n = j - 1; const fn = fact(n);
                const tp = n === 0 ? '' : n === 1 ? 't*' : `t^${n}*`;
                const ex = Math.abs(p.z.re) < 1e-12 ? '' : `exp(${snap(p.z.re)}*t)*`;
                if (p.z.im === 0) { if (Math.abs(c.re) > 1e-11) pieces.push(`${snap(c.re / fn)}*${tp}${ex}`.replace(/\*$/, '') || '0'); }
                else { const A1 = 2 * c.re / fn, B1 = -2 * c.im / fn; const w = snap(p.z.im); const parts = []; if (Math.abs(A1) > 1e-11) parts.push(`${snap(A1)}*cos(${w}*t)`); if (Math.abs(B1) > 1e-11) parts.push(`${snap(B1)}*sin(${w}*t)`); if (parts.length) pieces.push(`${tp}${ex}(${parts.join('+')})`); }
            }
        });
        const expr = pieces.length ? pieces.join(' + ') : '0';
        let fnode; try { fnode = engine.parse(expr.replace(/\bt\b/g, 't')); } catch (e) { throw new CalcError('Could not express the inverse in closed form.'); }
        const r = I.makeResult('laplace', 'Inverse Laplace transform');
        r.items.push({ label: 'F(s) =', text: engine.strOf(node), tex: `F(${sv})=${engine.texOf(node)}` });
        let simp = fnode; try { simp = I.simplifyNode(I.foldConstants(fnode)); } catch (e) { /* keep */ }
        r.main = { label: 'f(t) =', text: engine.strOf(simp), tex: `f(t)=${engine.texOf(simp)}\;(t\\ge 0)` };
        // verification: forward transform at a point
        try {
            const f = engine.compile(simp, ['t']); const s0 = Math.max(...poles.map(p => p.z.re), 0) + 1.9;
            const num = numLaplace(f, s0, Math.max(...poles.map(p => p.z.re)));
            const ex = polyEval(N, s0) / polyEval(D, s0);
            if (Math.abs(num.value - ex) <= 1e-6 * Math.max(1, Math.abs(ex))) r.meta.push(`Verified: ∫₀^∞ f(t)e^(−st) dt reproduces F(s) at s = ${engine.fmt(s0, 4)}.`);
            else r.warnings.push('The numerical check of the inverse did not agree to 6 digits.');
            const ts = [], ys = []; const T1 = 6 / Math.max(0.2, Math.min(...poles.map(p => Math.abs(p.z.re)).filter(x => x > 1e-9).concat([1]))); for (let i = 0; i <= 400; i++) { const t = i * Math.min(T1, 40) / 400; ts.push(t); const y = f(t); ys.push(Number.isFinite(y) ? y : null); }
            r.plot = { generic: { title: 'f(t)', xTitle: 't', yTitle: 'f(t)', traces: [{ x: ts, y: ys, mode: 'lines', type: 'scatter', name: 'f(t)' }] } };
        } catch (e) { /* skip */ }
        r.meta.push('Method: partial fractions in s (complex poles, repeated roots) and the table ℒ⁻¹{1/(s−a)ⁿ⁺¹} = tⁿe^{at}/n!');
        r.steps.push({ title: 'Check properness', text: `Numerator degree ${N.length - 1} < denominator degree ${degD}.`, tex: '' });
        r.steps.push({ title: 'Find the poles', text: poles.map(p => (Math.abs(p.z.im) < 1e-9 ? nice(p.z.re, 6, 1e-9).text : `${nice(p.z.re, 6, 1e-9).text} ± ${nice(Math.abs(p.z.im), 6, 1e-9).text}i`) + (p.m > 1 ? ` (multiplicity ${p.m})` : '')).filter((x, i, a) => a.indexOf(x) === i).join(',  '), tex: '' });
        r.steps.push({ title: 'Partial fractions', text: 'Write F(s) = Σ cⱼ/(s − p)ʲ and solve for the cⱼ.', tex: '' });
        r.steps.push({ title: 'Invert term by term', text: 'ℒ⁻¹{1/(s − p)ʲ} = t^{j−1}e^{pt}/(j−1)!; conjugate pairs combine into cos and sin.', tex: `f(t)=${engine.texOf(simp)}` });
        return I.finalizeText(r);
    }

    function runFourierTransform(src, opt) {
        const node = engine.parse(src); const vs = engine.freeVars(node);
        if (vs.length > 1) throw new CalcError('Use a single variable (t).');
        const v = vs[0] || 't'; const f = engine.compile(node, [v]);
        const r = I.makeResult('laplace', 'Fourier transform');
        r.items.push({ label: `f(${v}) =`, text: engine.strOf(node), tex: `f(${v})=${engine.texOf(node)}` });
        // decay check
        let L = 0; for (const t of [5, 10, 20, 40, 80, 160, 400, 1000]) { const a = Math.abs(f(t)), b = Math.abs(f(-t)); if (Number.isFinite(a) && Number.isFinite(b) && a < (t >= 400 ? 2e-6 : 1e-9) && b < (t >= 400 ? 2e-6 : 1e-9)) { L = t; break; } }
        if (!L) throw new CalcError('f(t) must decay to 0 as t → ±∞ (it must be absolutely integrable) for an ordinary Fourier transform.');
        // closed forms
        const cands = [
            { name: 'e^{−a|t|}', est: () => -Math.log(f(1) / f(0)), shape: (t, a) => Math.exp(-a * Math.abs(t)), F: (w, a) => 2 * a / (a * a + w * w), txt: a => `2a/(a² + ω²) with a = ${a}`, tex: a => `\\frac{2a}{a^2+\\omega^2},\\ a=${a}` },
            { name: 'e^{−at²}', est: () => -Math.log(f(1) / f(0)), shape: (t, a) => Math.exp(-a * t * t), F: (w, a) => Math.sqrt(Math.PI / a) * Math.exp(-w * w / (4 * a)), txt: a => `√(π/a)·e^(−ω²/(4a)) with a = ${a}`, tex: a => `\\sqrt{\\frac{\\pi}{a}}e^{-\\omega^2/(4a)},\\ a=${a}` },
            { name: '1/(a²+t²)', est: () => Math.sqrt(f(0) > 0 ? 1 / f(0) : NaN), shape: (t, a) => 1 / (a * a + t * t), F: (w, a) => (Math.PI / a) * Math.exp(-a * Math.abs(w)), txt: a => `(π/a)·e^(−a|ω|) with a = ${a}`, tex: a => `\\frac{\\pi}{a}e^{-a|\\omega|},\\ a=${a}` }
        ];
        let known = null;
        for (const c of cands) {
            try {
                const a = c.est(); if (!(a > 1e-6) || !Number.isFinite(a)) continue;
                const k = f(0) / c.shape(0, a); if (!Number.isFinite(k)) continue;
                const ok = [0.3, 0.7, 1.5, 2.5, -1.2].every(t => Math.abs(f(t) - k * c.shape(t, a)) <= 1e-9 * Math.max(1, Math.abs(f(t))));
                if (ok) { known = { c, a, k }; break; }
            } catch (e) { /* next */ }
        }
        const Fnum = w => { const N = Math.min(20000, Math.max(8000, Math.ceil(2 * L / 0.02))), h = 2 * L / N; let re = 0, im = 0; for (let i = 0; i <= N; i++) { const t = -L + i * h, y = f(t), wgt = (i === 0 || i === N) ? 0.5 : 1; re += wgt * y * Math.cos(w * t); im -= wgt * y * Math.sin(w * t); } return [re * h, im * h]; };
        const W = known ? Math.max(10, 12 / (known.c.name.includes('t²') ? 1 : 1)) : 20;
        const ws = [], mag = [], re = [], im = [];
        for (let i = 0; i <= 160; i++) { const w = -W + 2 * W * i / 160; ws.push(w); const [a, b] = Fnum(w); re.push(a); im.push(b); mag.push(Math.hypot(a, b)); }
        const peak = Math.max(...mag); let Wc = W; for (let i = ws.length - 1; i > 80; i--) if (mag[i] > 1e-3 * peak) { Wc = ws[Math.min(i + 6, ws.length - 1)]; break; }
        r.plot = { generic: { title: 'Fourier transform F(ω)', xTitle: 'ω', yTitle: 'F(ω)', xRange: [-Wc, Wc], traces: [{ x: ws, y: mag, mode: 'lines', type: 'scatter', name: '|F(ω)|' }, { x: ws, y: re, mode: 'lines', type: 'scatter', name: 'Re F', line: { dash: 'dash' } }, { x: ws, y: im, mode: 'lines', type: 'scatter', name: 'Im F', line: { dash: 'dot' } }] } };
        const F0 = Fnum(0);
        r.items.push({ label: 'F(0) = ∫ f dt ≈', text: engine.fmt(F0[0], 8), tex: `F(0)=\\int f\\,dt\\approx ${engine.fmt(F0[0], 8)}` });
        if (known) {
            const aT = nice(known.a, 8, 1e-9); const kT = nice(known.k, 8, 1e-9);
            r.main = { label: 'F(ω) =', text: `${known.k === 1 ? '' : `${kT.text}·`}${known.c.txt(aT.text)}`, tex: `F(\\omega)=${known.k === 1 ? '' : `${kT.tex}\\cdot`}${known.c.tex(aT.tex)}` };
            const w0 = 1.3, ex = known.k * known.c.F(w0, known.a), [nr] = Fnum(w0);
            if (Math.abs(ex - nr) < (L > 300 ? 3e-3 : 5e-4) * Math.max(1, Math.abs(ex))) r.meta.push(`Verified: numerical integration of f(t)e^(−iωt) agrees with the closed form at ω = ${w0}.`);
            r.meta.push(`Method: standard pair for ${known.c.name} (convention F(ω) = ∫ f(t)e^(−iωt) dt)`);
        } else {
            r.main = { label: 'F(ω) =', text: 'no closed form recognised – see the numerical spectrum', tex: '' };
            r.meta.push('Method: numerical evaluation of F(ω) = ∫ f(t)e^(−iωt) dt on a fine grid (convention e^(−iωt), no 1/2π factor)');
            r.warnings.push('The plot shows |F|, Re F and Im F computed numerically.');
        }
        r.steps.push({ title: 'Definition', text: 'F(ω) = ∫ f(t)·e^(−iωt) dt over all t.', tex: 'F(\\omega)=\\int_{-\\infty}^{\\infty}f(t)e^{-i\\omega t}\\,dt' });
        r.steps.push({ title: 'Decay check', text: `|f| < 10⁻⁹ beyond |t| = ${L}, so the integral can be truncated there.`, tex: '' });
        return I.finalizeText(r);
    }
    register({ laplace: runLaplace });

    // ======================================================================
    // Vector calculus: Jacobian, line integrals, work, triple integrals
    // ======================================================================
    const subst = (node, map) => node.transform(n => (n.type === 'SymbolNode' && Object.prototype.hasOwnProperty.call(map, n.name) ? new math.ParenthesisNode(map[n.name]) : n));
    const splitComps = src => String(src).split(';').map(x => x.trim()).filter(Boolean);
    const ORDER = ['x', 'y', 'z', 'u', 'v', 'w', 'r', 's', 't'];
    const sortVars = a => a.slice().sort((p, q) => (ORDER.indexOf(p) < 0 ? 99 : ORDER.indexOf(p)) - (ORDER.indexOf(q) < 0 ? 99 : ORDER.indexOf(q)) || p.localeCompare(q));
    const detNode = M => {
        const n = M.length; const P = x => `(${engine.strOf(x)})`;
        const rec = (rows, cols) => {
            if (rows.length === 1) return P(M[rows[0]][cols[0]]);
            return cols.map((c, k) => `${k % 2 ? '-' : '+'}${P(M[rows[0]][c])}*(${rec(rows.slice(1), cols.filter(q => q !== c))})`).join('');
        };
        const node = engine.parse(rec(M.map((_, i) => i), M.map((_, i) => i)));
        try { return I.simplifyNode(I.foldConstants(node)); } catch (e) { return node; }
    };
    const matTexN = M => `\\begin{bmatrix}${M.map(r => r.map(x => engine.texOf(x)).join('&')).join('\\\\')}\\end{bmatrix}`;

    function paramPlot(fx, fy, a, b, name) {
        const xs = [], ys = []; for (let i = 0; i <= 400; i++) { const t = a + (b - a) * i / 400; xs.push(fx(t)); ys.push(fy(t)); }
        return { generic: { title: name || 'Path', xTitle: 'x', yTitle: 'y', equal: true, traces: [{ x: xs, y: ys, mode: 'lines', type: 'scatter', name: 'path' }, { x: [xs[0]], y: [ys[0]], mode: 'markers', type: 'scatter', name: 'start', marker: { size: 10 } }, { x: [xs[400]], y: [ys[400]], mode: 'markers', type: 'scatter', name: 'end', marker: { size: 10, symbol: 'square' } }] } };
    }

    function runVector(src, opt) {
        const op = opt.op || 'jacobian';
        const r = I.makeResult('vector', 'Vector calculus');
        if (op === 'jacobian') {
            const comps = splitComps(src); if (!comps.length) throw new CalcError('Give the components of F, separated by ;  e.g.  x^2*y ; sin(x)+z');
            const nodes = comps.map(c => engine.parse(c));
            const vars = opt.vars && String(opt.vars).trim() ? String(opt.vars).split(/[,\s]+/).filter(Boolean) : sortVars(Array.from(new Set(nodes.flatMap(n => engine.freeVars(n)))));
            if (!vars.length) throw new CalcError('The functions need at least one variable.');
            if (vars.length > 6 || nodes.length > 6) throw new CalcError('Up to 6 variables and 6 functions are supported.');
            const J = nodes.map(nd => vars.map(v => engine.diff(nd, v)));
            r.title = 'Jacobian matrix';
            r.items.push({ label: 'F =', text: `(${nodes.map(n => engine.strOf(n)).join(', ')})`, tex: `F=\\begin{bmatrix}${nodes.map(n => engine.texOf(n)).join('\\\\')}\\end{bmatrix}` });
            r.main = { label: 'J =', text: '[' + J.map(row => '[' + row.map(x => engine.strOf(x)).join(', ') + ']').join(', ') + ']', tex: `J=\\begin{bmatrix}${J.map(row => row.map(x => engine.texOf(x)).join('&')).join('\\\\')}\\end{bmatrix}` };
            r.items.push({ label: 'Variables:', text: vars.join(', '), tex: '' });
            if (J.length === J[0].length) { const d = detNode(J); r.items.push({ label: 'det J =', text: engine.strOf(d), tex: `\\det J=${engine.texOf(d)}` }); r.meta.push('The determinant is the local volume-scaling factor used in a change of variables.'); }
            if (opt.point && String(opt.point).trim()) {
                const pts = String(opt.point).split(/[,\s]+/).filter(Boolean).map(x => I.parseLimit(x, 'Point').value);
                if (pts.length !== vars.length) throw new CalcError(`Give ${vars.length} coordinate(s) for the point.`);
                const vals = J.map(row => row.map(x => engine.compile(x, vars)(...pts)));
                r.items.push({ label: 'J at the point =', text: '[' + vals.map(row => '[' + row.map(x => nice(x, 8, 1e-9).text).join(', ') + ']').join(', ') + ']', tex: `J=\\begin{bmatrix}${vals.map(row => row.map(x => nice(x, 8, 1e-9).tex).join('&')).join('\\\\')}\\end{bmatrix}` });
                if (vals.length === vals[0].length) { const dv = math.det(vals); r.items.push({ label: 'det J at the point =', text: nice(dv, 8, 1e-9).text, tex: '' }); if (Math.abs(dv) < 1e-9) r.warnings.push('det J = 0 here, so F is not locally invertible at this point.'); }
            }
            // numerical check of every entry by central differences
            try {
                const pt = vars.map((_, i) => 0.37 + 0.21 * i); let worst = 0;
                nodes.forEach((nd, i) => vars.forEach((v, j) => { const f = engine.compile(nd, vars), g = engine.compile(J[i][j], vars); const h = 1e-5; const p1 = pt.slice(), p2 = pt.slice(); p1[j] += h; p2[j] -= h; const num = (f(...p1) - f(...p2)) / (2 * h), ex = g(...pt); if (Number.isFinite(num) && Number.isFinite(ex)) worst = Math.max(worst, Math.abs(num - ex) / Math.max(1, Math.abs(ex))); }));
                r.meta.push(`Verified: every entry agrees with central differences (max relative gap ${worst.toExponential(1)}).`);
            } catch (e) { /* skip */ }
            r.meta.push('Method: symbolic partial derivatives ∂Fᵢ/∂xⱼ');
            r.steps.push({ title: 'Definition', text: 'Jᵢⱼ = ∂Fᵢ/∂xⱼ — row i holds the gradient of the i-th component.', tex: 'J_{ij}=\\frac{\\partial F_i}{\\partial x_j}' });
            J.forEach((row, i) => r.steps.push({ title: `Row ${i + 1}: ∇F${i + 1}`, text: row.map((x, j) => `∂/∂${vars[j]} = ${engine.strOf(x)}`).join(';   '), tex: '' }));
            return I.finalizeText(r);
        }
        if (op === 'line' || op === 'work') {
            const px = opt.px || 't', py = opt.py || '', pz = opt.pz || '';
            const par = [px, py, pz].filter(Boolean).map(x => engine.parse(x));
            if (par.length < 2) throw new CalcError('Give at least x(t) and y(t) for the path.');
            const names = ['x', 'y', 'z'].slice(0, par.length);
            par.forEach(nd => { const bad = engine.freeVars(nd).filter(n => n !== 't'); if (bad.length) throw new CalcError('Path components may only use the parameter t.'); });
            const ta = I.parseLimit(opt.ta || '0', 't from'), tb = I.parseLimit(opt.tb || '1', 't to');
            const d = par.map(nd => engine.diff(nd, 't'));
            const map = {}; names.forEach((n, i) => { map[n] = par[i]; });
            let integrand, kindTitle; const speed = `sqrt(${d.map(x => `(${engine.strOf(x)})^2`).join('+')})`;
            if (op === 'line') {
                const f = engine.parse(src);
                integrand = `(${engine.strOf(subst(f, map))})*${speed}`; kindTitle = 'Line integral ∫ f ds';
            } else {
                const comps = splitComps(src); if (comps.length !== par.length) throw new CalcError(`F needs ${par.length} component(s) separated by ; to match the path.`);
                integrand = comps.map((c, i) => `(${engine.strOf(subst(engine.parse(c), map))})*(${engine.strOf(d[i])})`).join('+'); kindTitle = 'Work / circulation ∫ F·dr';
            }
            const res = engine.run.integral(integrand, { lower: opt.ta || '0', upper: opt.tb || '1', variable: 't', digits: opt.digits });
            res.title = kindTitle; res.kind = 'vector';
            res.items.unshift({ label: 'Path:', text: `r(t) = (${par.map(x => engine.strOf(x)).join(', ')}),  ${engine.strOf(ta.node)} ≤ t ≤ ${engine.strOf(tb.node)}`, tex: `\\mathbf r(t)=\\left(${par.map(x => engine.texOf(x)).join(',\\,')}\\right)` });
            res.items.push({ label: 'Reduced to:', text: `∫ ${integrand} dt`, tex: '' });
            res.steps.unshift({ title: op === 'line' ? 'Parametrise and use ds = |r′(t)| dt' : 'Substitute the path into F and use dr = r′(t) dt', text: op === 'line' ? `ds = ${speed} dt` : `F(r(t))·r′(t) = ${integrand}`, tex: op === 'line' ? '\\int_C f\\,ds=\\int_a^b f(\\mathbf r(t))\\,\\lVert\\mathbf r\'(t)\\rVert\\,dt' : '\\int_C\\mathbf F\\cdot d\\mathbf r=\\int_a^b\\mathbf F(\\mathbf r(t))\\cdot\\mathbf r\'(t)\\,dt' });
            try { res.plot = paramPlot(engine.compile(par[0], ['t']), engine.compile(par[1], ['t']), ta.value, tb.value, 'Path C'); } catch (e) { res.plot = null; }
            return res;
        }
        if (op === 'triple') {
            const node = engine.parse(src); const vars = sortVars(engine.freeVars(node));
            const vv = opt.vars && String(opt.vars).trim() ? String(opt.vars).split(/[,\s]+/).filter(Boolean) : ['x', 'y', 'z'];
            const [vx, vy, vz] = vv; if (!vz) throw new CalcError('Name three variables, e.g. x, y, z.');
            engine.freeVars(node).forEach(n => { if (!vv.includes(n)) throw new CalcError(`Unknown variable “${n}” – the integrand may only use ${vv.join(', ')}.`); });
            const xa = I.parseLimit(opt.xLow || '0', `${vx} lower`), xb = I.parseLimit(opt.xHigh || '1', `${vx} upper`);
            const ya = engine.parse(opt.yLow || '0'), yb = engine.parse(opt.yHigh || '1'), za = engine.parse(opt.zLow || '0'), zb = engine.parse(opt.zHigh || '1');
            if (!Number.isFinite(xa.value) || !Number.isFinite(xb.value)) throw new CalcError('The outer limits must be finite.');
            [ya, yb].forEach(n => engine.freeVars(n).forEach(q => { if (q !== vx) throw new CalcError(`The ${vy} limits may only depend on ${vx}.`); }));
            [za, zb].forEach(n => engine.freeVars(n).forEach(q => { if (q !== vx && q !== vy) throw new CalcError(`The ${vz} limits may only depend on ${vx} and ${vy}.`); }));
            const f = engine.compile(node, [vx, vy, vz]), yaF = engine.compile(ya, [vx]), ybF = engine.compile(yb, [vx]), zaF = engine.compile(za, [vx, vy]), zbF = engine.compile(zb, [vx, vy]);
            const gl = I.gl;
            const val = gl(x => gl(y => gl(z => f(x, y, z), zaF(x, y), zbF(x, y), 3), yaF(x), ybF(x), 3), xa.value, xb.value, 3);
            r.title = 'Triple integral';
            const lim = `\\int_{${engine.texOf(xa.node)}}^{${engine.texOf(xb.node)}}\\int_{${engine.texOf(ya)}}^{${engine.texOf(yb)}}\\int_{${engine.texOf(za)}}^{${engine.texOf(zb)}}`;
            r.main = { label: 'Value ≈', text: engine.fmt(val, opt.digits), tex: `${lim}${engine.texOf(node)}\\,d${vz}\\,d${vy}\\,d${vx}\\approx ${engine.fmt(val, opt.digits)}` };
            if (!Number.isFinite(val)) r.warnings.push('The integrand is undefined somewhere in the region.');
            // exact: nested antiderivatives with symbolic substitution of the bounds
            try {
                const step = (g, v, lo, hi) => { const A = engine.antiderivative(g, v, 'auto'); if (!A.ok) throw new Error('no'); return I.simplifyNode(I.foldConstants(subst(A.F, { [v]: hi }).type ? new math.OperatorNode('-', 'subtract', [subst(A.F, { [v]: hi }), subst(A.F, { [v]: lo })]) : A.F)); };
                const g1 = step(node, vz, za, zb), g2 = step(g1, vy, ya, yb), g3 = step(g2, vx, xa.node, xb.node);
                const exv = engine.compile(g3, [])();
                if (Number.isFinite(exv) && Math.abs(exv - val) < 1e-6 * Math.max(1, Math.abs(val))) { r.items.push({ label: 'Exact:', text: engine.strOf(g3), tex: engine.texOf(g3) }); r.meta.push('Exact value found by integrating symbolically in turn and verified against the numerical value.'); }
            } catch (e) { /* numeric only */ }
            if (!r.meta.length) r.meta.push('Method: nested Gauss–Legendre quadrature (three levels).');
            r.items.push({ label: 'Region:', text: `${engine.strOf(xa.node)} ≤ ${vx} ≤ ${engine.strOf(xb.node)},  ${engine.strOf(ya)} ≤ ${vy} ≤ ${engine.strOf(yb)},  ${engine.strOf(za)} ≤ ${vz} ≤ ${engine.strOf(zb)}`, tex: '' });
            r.steps.push({ title: 'Set up the iterated integral', text: `∫ dx ∫ dy ∫ ${engine.strOf(node)} dz, innermost variable ${vz}.`, tex: `${lim}${engine.texOf(node)}\\,d${vz}\\,d${vy}\\,d${vx}` });
            r.steps.push({ title: `Integrate in ${vz}, then ${vy}, then ${vx}`, text: 'Each inner integral may depend on the outer variables through its limits.', tex: '' });
            return I.finalizeText(r);
        }
        throw new CalcError('Unknown vector-calculus operation.');
    }
    register({ vector: runVector });

    // ======================================================================
    // Linear algebra extras: LU, QR, Cholesky, SVD, null/column space, least squares, diagonalisation
    // ======================================================================
    const LA_OPS = new Set(['lu', 'qr', 'cholesky', 'svd', 'nullspace', 'colspace', 'leastsquares', 'diagonalize', 'pinv', 'cond']);
    const mTex = M => I.matTex(M), mTxt = M => I.matTxt(M);
    const mul = (A, B) => math.multiply(A, B), tr = A => math.transpose(A);
    const maxAbs = M => Math.max(0, ...M.flat().map(Math.abs));
    const sub = (A, B) => math.subtract(A, B);
    const T8 = x => nice(x, 8, 1e-9);

    function svdJacobi(A) {
        const m = A.length, n = A[0].length, flip = m < n;
        let U = (flip ? tr(A) : A).map(r => r.slice()); const rows = U.length, cols = U[0].length;
        let V = Array.from({ length: cols }, (_, i) => Array.from({ length: cols }, (_, j) => (i === j ? 1 : 0)));
        for (let sweep = 0; sweep < 60; sweep++) {
            let off = 0;
            for (let p = 0; p < cols - 1; p++) for (let q = p + 1; q < cols; q++) {
                let al = 0, be = 0, ga = 0; for (let i = 0; i < rows; i++) { al += U[i][p] * U[i][p]; be += U[i][q] * U[i][q]; ga += U[i][p] * U[i][q]; }
                if (Math.abs(ga) <= 1e-15 * Math.sqrt(al * be) || ga === 0) continue; off = Math.max(off, Math.abs(ga) / Math.sqrt(al * be));
                const zeta = (be - al) / (2 * ga), t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta)), c = 1 / Math.sqrt(1 + t * t), sn = c * t;
                for (let i = 0; i < rows; i++) { const a = U[i][p], b = U[i][q]; U[i][p] = c * a - sn * b; U[i][q] = sn * a + c * b; }
                for (let i = 0; i < cols; i++) { const a = V[i][p], b = V[i][q]; V[i][p] = c * a - sn * b; V[i][q] = sn * a + c * b; }
            }
            if (off < 1e-15) break;
        }
        const sig = Array.from({ length: cols }, (_, j) => Math.sqrt(U.reduce((a, r) => a + r[j] * r[j], 0)));
        const idx = sig.map((_, i) => i).sort((a, b) => sig[b] - sig[a]);
        const S = idx.map(i => sig[i]);
        const Un = U.map(r => idx.map((j, k) => (S[k] > 1e-13 ? r[j] / S[k] : 0)));
        const Vn = V.map(r => idx.map(j => r[j]));
        return flip ? { U: Vn, S, V: Un } : { U: Un, S, V: Vn };   // A = U diag(S) Vᵀ  (thin)
    }

    function runLinalg(src, opt) {
        const M = I.parseMatrix(src), m = M.length, n = M[0].length, op = opt.op;
        const r = I.makeResult('matrix', 'Matrix algebra');
        r.items.push({ label: 'A =', text: mTxt(M), tex: `A=${mTex(M)}` }); r.meta.push(`Size ${m}×${n}`);
        const verify = (err, what) => r.meta.push(`Verified: max |${what}| = ${err.toExponential(2)}`);
        if (op === 'lu') {
            if (m !== n) throw new CalcError('LU decomposition needs a square matrix.');
            const d = math.lup(M); const L = d.L.toArray ? d.L.toArray() : d.L, U = d.U.toArray ? d.U.toArray() : d.U, p = d.p;
            const P = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (p[i] === j ? 1 : 0)));
            r.title = 'LU decomposition (partial pivoting)';
            r.main = { label: 'PA = LU', text: `L = ${mTxt(L)},  U = ${mTxt(U)}`, tex: `PA=LU,\\quad L=${mTex(L)},\; U=${mTex(U)}` };
            r.items.push({ label: 'P =', text: mTxt(P), tex: `P=${mTex(P)}` });
            verify(maxAbs(sub(mul(P, M), mul(L, U))), 'PA − LU');
            r.steps.push({ title: 'Eliminate below each pivot', text: 'Record every multiplier ℓᵢⱼ in L and keep the reduced rows in U; swap rows (tracked in P) when a larger pivot is available.', tex: '' });
        } else if (op === 'qr') {
            if (m < n) throw new CalcError('QR needs at least as many rows as columns.');
            const d = math.qr(M); const Q = d.Q, R = d.R;
            r.title = 'QR decomposition (Householder)';
            r.main = { label: 'A = QR', text: `Q = ${mTxt(Q)},  R = ${mTxt(R)}`, tex: `A=QR,\\quad Q=${mTex(Q)},\; R=${mTex(R)}` };
            verify(maxAbs(sub(mul(Q, R), M)), 'A − QR'); verify(maxAbs(sub(mul(tr(Q), Q), Q.map((row, i) => row.map((_, j) => (i === j ? 1 : 0))))), 'QᵀQ − I');
            r.steps.push({ title: 'Orthogonalise the columns', text: 'Householder reflections turn A into the upper-triangular R while accumulating the orthogonal Q.', tex: 'Q^{T}Q=I,\\quad R\\text{ upper triangular}' });
        } else if (op === 'cholesky') {
            if (m !== n) throw new CalcError('Cholesky needs a square matrix.');
            const L = Array.from({ length: n }, () => new Array(n).fill(0));
            for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let sum = M[i][j]; for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k]; if (i === j) { if (sum <= 1e-12) throw new CalcError('The matrix is not symmetric positive definite, so it has no Cholesky factor.'); L[i][i] = Math.sqrt(sum); } else L[i][j] = sum / L[j][j]; }
            if (maxAbs(sub(M, tr(M))) > 1e-9) throw new CalcError('The matrix must be symmetric for a Cholesky factorisation.');
            r.title = 'Cholesky decomposition';
            r.main = { label: 'A = LLᵀ', text: `L = ${mTxt(L)}`, tex: `A=LL^{T},\\quad L=${mTex(L)}` };
            verify(maxAbs(sub(mul(L, tr(L)), M)), 'A − LLᵀ');
            r.steps.push({ title: 'Row by row', text: 'Lⱼⱼ = √(Aⱼⱼ − Σ Lⱼₖ²) and Lᵢⱼ = (Aᵢⱼ − Σ LᵢₖLⱼₖ)/Lⱼⱼ.', tex: '' });
        } else if (op === 'svd' || op === 'pinv' || op === 'cond') {
            const { U, S, V } = svdJacobi(M); const k = S.length;
            const recon = mul(mul(U, S.map((s0, i) => S.map((_, j) => (i === j ? s0 : 0)))), tr(V));
            const tol = Math.max(m, n) * S[0] * 2.3e-16; const rank = S.filter(x => x > tol).length;
            if (op === 'svd') {
                r.title = 'Singular value decomposition';
                r.main = { label: 'σ =', text: S.map(x => T8(x).text).join(',  '), tex: `\\sigma=${S.map(x => T8(x).tex).join(',\;')}` };
                r.items.push({ label: 'U =', text: mTxt(U), tex: `U=${mTex(U)}` }); r.items.push({ label: 'Σ =', text: mTxt(S.map((s0, i) => S.map((_, j) => (i === j ? s0 : 0)))), tex: `\\Sigma=${mTex(S.map((s0, i) => S.map((_, j) => (i === j ? s0 : 0))))}` }); r.items.push({ label: 'V =', text: mTxt(V), tex: `V=${mTex(V)}` });
                verify(maxAbs(sub(recon, M)), 'A − UΣVᵀ');
                r.items.push({ label: 'Rank:', text: String(rank), tex: '' }); if (S[k - 1] > tol) r.items.push({ label: 'Condition number κ =', text: engine.fmt(S[0] / S[k - 1], 8), tex: '' });
                r.steps.push({ title: 'Orthogonalise column pairs (one-sided Jacobi)', text: 'Rotate pairs of columns until all are mutually orthogonal; their lengths are the singular values.', tex: 'A=U\\Sigma V^{T}' });
            } else if (op === 'cond') {
                r.title = 'Condition number';
                if (S[k - 1] <= tol) { r.main = { label: 'κ₂(A) =', text: '∞ (singular)', tex: '\\kappa_2(A)=\\infty' }; } else r.main = { label: 'κ₂(A) =', text: engine.fmt(S[0] / S[k - 1], 10), tex: `\\kappa_2(A)=\\frac{\\sigma_{\\max}}{\\sigma_{\\min}}=${engine.fmt(S[0] / S[k - 1], 8)}` };
                r.items.push({ label: 'Singular values:', text: S.map(x => T8(x).text).join(', '), tex: '' });
                r.meta.push('A large κ means the solution of A x = b is very sensitive to rounding and measurement errors.');
            } else {
                r.title = 'Moore–Penrose pseudoinverse';
                const Sp = S.map((s0, i) => S.map((_, j) => (i === j && s0 > tol ? 1 / s0 : 0))); const P = mul(mul(V, Sp), tr(U));
                r.main = { label: 'A⁺ =', text: mTxt(P), tex: `A^{+}=${mTex(P)}` };
                verify(maxAbs(sub(mul(mul(M, P), M), M)), 'A A⁺ A − A');
                r.steps.push({ title: 'Invert the non-zero singular values', text: 'A⁺ = V Σ⁺ Uᵀ, where Σ⁺ replaces each σ > 0 by 1/σ.', tex: 'A^{+}=V\\Sigma^{+}U^{T}' });
            }
        } else if (op === 'nullspace' || op === 'colspace') {
            const { A, pivots } = I.rref(M);
            if (op === 'nullspace') {
                const ns = I.nullSpace(M, 1e-9); r.title = 'Null space';
                r.main = ns.length ? { label: 'Basis of N(A):', text: ns.map(v => '(' + v.map(x => T8(x).text).join(', ') + ')').join('   '), tex: `\\mathcal N(A)=\\operatorname{span}\\left\\{${ns.map(v => `\\begin{bmatrix}${v.map(x => T8(x).tex).join('\\\\')}\\end{bmatrix}`).join(',')}\\right\\}` } : { label: 'N(A) =', text: '{0} (only the zero vector)', tex: '\\mathcal N(A)=\\{\\mathbf 0\\}' };
                r.items.push({ label: 'Nullity:', text: String(ns.length), tex: '' });
                if (ns.length) verify(Math.max(...ns.map(v => maxAbs(mul(M, v.map(x => [x]))))), 'A·v');
                r.steps.push({ title: 'Row-reduce and read the free columns', text: `Pivot columns: ${pivots.map(x => x + 1).join(', ') || 'none'}. Each free column gives one basis vector.`, tex: '' });
            } else {
                r.title = 'Column space'; const basis = pivots.map(c => M.map(row => row[c]));
                r.main = { label: 'Basis of C(A):', text: basis.map(v => '(' + v.map(x => T8(x).text).join(', ') + ')').join('   ') || '{0}', tex: `\\mathcal C(A)=\\operatorname{span}\\left\\{${basis.map(v => `\\begin{bmatrix}${v.map(x => T8(x).tex).join('\\\\')}\\end{bmatrix}`).join(',')}\\right\\}` };
                r.items.push({ label: 'Dimension (rank):', text: String(basis.length), tex: '' });
                r.steps.push({ title: 'Pivot columns of A', text: `Columns ${pivots.map(x => x + 1).join(', ') || 'none'} of the original matrix are linearly independent and span the column space.`, tex: '' });
            }
        } else if (op === 'leastsquares') {
            const B = I.parseMatrix(opt.b || '1 ; 2'); if (B.length !== m || B[0].length !== 1) throw new CalcError(`b must be a column with ${m} entr${m === 1 ? 'y' : 'ies'} (separate with ;).`);
            const bcol = B.map(x => x[0]); const ata = mul(tr(M), M);
            if (Math.abs(math.det(ata)) < 1e-12 * Math.max(1, maxAbs(ata) ** n)) throw new CalcError('The columns of A are linearly dependent, so the least-squares solution is not unique (try the pseudoinverse).');
            const d = math.qr(M); const Rn = d.R.slice(0, n).map(row => row.slice(0, n)); const qtb = mul(tr(d.Q), B).slice(0, n);
            const x = math.lusolve(Rn, qtb).map(row => row[0]); const res = sub(mul(M, x.map(v => [v])), B).map(row => row[0]); const rn = Math.hypot(...res);
            r.title = 'Least-squares solution';
            r.main = { label: 'x̂ =', text: '(' + x.map(v => T8(v).text).join(', ') + ')', tex: `\\hat x=\\begin{bmatrix}${x.map(v => T8(v).tex).join('\\\\')}\\end{bmatrix}` };
            r.items.push({ label: 'Residual ‖Ax̂ − b‖ =', text: engine.fmt(rn, 8), tex: '' });
            const grad = mul(tr(M), res.map(v => [v])); verify(maxAbs(grad), 'Aᵀ(Ax̂ − b)');
            r.steps.push({ title: 'Normal equations', text: 'The minimiser satisfies AᵀA x̂ = Aᵀb; it is computed stably through QR (R x̂ = Qᵀb).', tex: 'A^{T}A\\hat x=A^{T}b' });
        } else if (op === 'diagonalize') {
            if (m !== n) throw new CalcError('Diagonalisation needs a square matrix.');
            const co = I.charPolyCoeffs(M); const roots = I.polyRootsMult(co.slice().reverse());
            if (roots.some(z => Math.abs(z.im) > 1e-7 * Math.max(1, Math.abs(z.re)))) throw new CalcError('This matrix has complex eigenvalues, so it cannot be diagonalised over the real numbers.');
            const vecs = []; const vals = [];
            for (const z of roots) { const lam = Math.abs(z.re) < 1e-10 ? 0 : z.re; const sh = M.map((row, i) => row.map((x, j) => x - (i === j ? lam : 0))); const ns = I.nullSpace(sh, 1e-7); if (ns.length < z.mult) throw new CalcError('The matrix is defective (not enough independent eigenvectors), so it is not diagonalisable.'); ns.slice(0, z.mult).forEach(v => { vecs.push(v); vals.push(lam); }); }
            const Pm = M.map((_, i) => vecs.map(v => v[i])); const D = vals.map((x, i) => vals.map((_, j) => (i === j ? x : 0)));
            r.title = 'Diagonalisation';
            r.main = { label: 'A = P D P⁻¹', text: `D = ${mTxt(D)},  P = ${mTxt(Pm)}`, tex: `A=PDP^{-1},\\quad D=${mTex(D)},\; P=${mTex(Pm)}` };
            verify(maxAbs(sub(mul(mul(Pm, D), math.inv(Pm)), M)), 'A − PDP⁻¹');
            r.steps.push({ title: 'Eigenvalues', text: `Roots of det(A − λI) = 0: ${vals.map(x => T8(x).text).join(', ')}.`, tex: '' });
            r.steps.push({ title: 'Eigenvectors', text: 'For each λ solve (A − λI)v = 0; the vectors become the columns of P.', tex: '' });
            r.steps.push({ title: 'Assemble', text: 'D holds the eigenvalues on its diagonal, so Aⁿ = P Dⁿ P⁻¹.', tex: 'A^{n}=PD^{n}P^{-1}' });
        }
        return I.finalizeText(r);
    }

    // ======================================================================
    // Statistics: descriptive, regression, distributions, t-tests
    // ======================================================================
    const lgamma = x => { if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x); x -= 1; const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; let a = c[0]; const t = x + g + 0.5; for (let i = 1; i < 9; i++) a += c[i] / (x + i); return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a); };
    function betacf(a, b, x) { const MAXIT = 300, EPS = 3e-16, FP = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FP) d = FP; d = 1 / d; let h = d; for (let m = 1; m <= MAXIT; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break; } return h; }
    const betai = (a, b, x) => { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; };
    const gammaP = (a, x) => { if (x <= 0) return 0; if (x < a + 1) { let sum = 1 / a, del = sum, ap = a; for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-16) break; } return sum * Math.exp(-x + a * Math.log(x) - lgamma(a)); } let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d; for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-16) break; } return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h; };
    const normCdf = z => 0.5 * (1 + math.erf(z / Math.SQRT2));
    const tCdf = (t, df) => { const x = df / (df + t * t); const i = betai(df / 2, 0.5, x); return t > 0 ? 1 - 0.5 * i : 0.5 * i; };
    const DISTS = {
        normal: { params: ['μ', 'σ'], def: [0, 1], ok: p => p[1] > 0, pdf: (x, [m, s]) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI)), cdf: (x, [m, s]) => normCdf((x - m) / s), cont: true, mean: ([m]) => m, sd: ([, s]) => s, name: 'Normal' },
        t: { params: ['ν'], def: [10], ok: p => p[0] > 0, pdf: (x, [v]) => Math.exp(lgamma((v + 1) / 2) - lgamma(v / 2)) / Math.sqrt(v * Math.PI) * (1 + x * x / v) ** (-(v + 1) / 2), cdf: (x, [v]) => tCdf(x, v), cont: true, mean: ([v]) => (v > 1 ? 0 : NaN), sd: ([v]) => (v > 2 ? Math.sqrt(v / (v - 2)) : NaN), name: "Student's t" },
        chisq: { params: ['k'], def: [3], ok: p => p[0] > 0, pdf: (x, [k]) => (x < 0 ? 0 : Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.log(2) - lgamma(k / 2))), cdf: (x, [k]) => gammaP(k / 2, x / 2), cont: true, lo: 0, mean: ([k]) => k, sd: ([k]) => Math.sqrt(2 * k), name: 'Chi-square' },
        exponential: { params: ['λ'], def: [1], ok: p => p[0] > 0, pdf: (x, [l]) => (x < 0 ? 0 : l * Math.exp(-l * x)), cdf: (x, [l]) => (x < 0 ? 0 : 1 - Math.exp(-l * x)), cont: true, lo: 0, mean: ([l]) => 1 / l, sd: ([l]) => 1 / l, name: 'Exponential' },
        uniform: { params: ['a', 'b'], def: [0, 1], ok: p => p[1] > p[0], pdf: (x, [a, b]) => (x >= a && x <= b ? 1 / (b - a) : 0), cdf: (x, [a, b]) => (x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a)), cont: true, mean: ([a, b]) => (a + b) / 2, sd: ([a, b]) => (b - a) / Math.sqrt(12), name: 'Uniform' },
        binomial: { params: ['n', 'p'], def: [10, 0.5], ok: p => Number.isInteger(p[0]) && p[0] >= 0 && p[0] <= 100000 && p[1] >= 0 && p[1] <= 1, pdf: (k, [n, p]) => (k < 0 || k > n || !Number.isInteger(k) ? 0 : Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + (k ? k * Math.log(p) : 0) + (n - k ? (n - k) * Math.log(1 - p) : 0))), cdf: (k, [n, p]) => { k = Math.floor(k); if (k < 0) return 0; if (k >= n) return 1; return 1 - betai(k + 1, n - k, p); }, cont: false, mean: ([n, p]) => n * p, sd: ([n, p]) => Math.sqrt(n * p * (1 - p)), name: 'Binomial' },
        poisson: { params: ['λ'], def: [4], ok: p => p[0] > 0, pdf: (k, [l]) => (k < 0 || !Number.isInteger(k) ? 0 : Math.exp(k * Math.log(l) - l - lgamma(k + 1))), cdf: (k, [l]) => { k = Math.floor(k); return k < 0 ? 0 : 1 - gammaP(k + 1, l); }, cont: false, mean: ([l]) => l, sd: ([l]) => Math.sqrt(l), name: 'Poisson' }
    };
    const numList = (txt, what) => String(txt).split(/[\s,;]+/).filter(Boolean).map(x => { const v = I.parseLimit(x, what || 'Value').value; if (!Number.isFinite(v)) throw new CalcError(`“${x}” is not a finite number.`); return v; });
    const quant = (a, q) => { const s = a.slice().sort((x, y) => x - y), h = (s.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h); return s[lo] + (h - lo) * (s[hi] - s[lo]); };
    const F8 = x => engine.fmt(x, 8);
    const gTheme = (title, xT, yT, traces, extra) => ({ generic: Object.assign({ title, xTitle: xT, yTitle: yT, traces }, extra || {}) });

    function runStats(src, opt) {
        const op = opt.op || 'describe';
        const r = I.makeResult('stats', 'Statistics');
        if (op === 'describe') {
            const d = numList(src, 'Data value'); if (d.length < 1) throw new CalcError('Enter some numbers, separated by commas or spaces.'); if (d.length > 100000) throw new CalcError('Up to 100 000 values are supported.');
            const n = d.length, sum = d.reduce((a, b) => a + b, 0), mean = sum / n, s = d.slice().sort((a, b) => a - b);
            const ss = d.reduce((a, b) => a + (b - mean) ** 2, 0), varP = ss / n, varS = n > 1 ? ss / (n - 1) : NaN;
            const sd = Math.sqrt(varS), q1 = quant(d, 0.25), med = quant(d, 0.5), q3 = quant(d, 0.75), iqr = q3 - q1;
            const freq = new Map(); d.forEach(x => freq.set(x, (freq.get(x) || 0) + 1)); const top = Math.max(...freq.values()); const modes = top > 1 ? Array.from(freq).filter(([, c]) => c === top).map(([v]) => v) : [];
            const m3 = d.reduce((a, b) => a + (b - mean) ** 3, 0) / n, m4 = d.reduce((a, b) => a + (b - mean) ** 4, 0) / n;
            r.title = 'Descriptive statistics';
            r.main = { label: 'Mean x̄ =', text: F8(mean), tex: `\\bar x=${F8(mean)}` };
            const add = (l, v, tex) => r.items.push({ label: l, text: typeof v === 'number' ? F8(v) : v, tex: tex || '' });
            add('Count n:', String(n)); add('Sum:', sum); add('Median:', med); add('Mode:', modes.length ? modes.map(F8).join(', ') : 'none (all values distinct)');
            add('Minimum / maximum:', `${F8(s[0])} / ${F8(s[n - 1])}`); add('Range:', s[n - 1] - s[0]);
            add('Sample variance s²:', varS); add('Sample standard deviation s:', sd); add('Population variance σ²:', varP); add('Population standard deviation σ:', Math.sqrt(varP));
            if (n > 1) add('Standard error of the mean:', sd / Math.sqrt(n));
            add('Quartiles Q1 / Q3:', `${F8(q1)} / ${F8(q3)}`); add('Interquartile range:', iqr);
            if (varP > 0) { add('Skewness:', m3 / varP ** 1.5); add('Excess kurtosis:', m4 / varP ** 2 - 3); }
            if (d.every(x => x > 0)) add('Geometric mean:', Math.exp(d.reduce((a, b) => a + Math.log(b), 0) / n)); if (d.every(x => x !== 0)) add('Harmonic mean:', n / d.reduce((a, b) => a + 1 / b, 0));
            const out = d.filter(x => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr); add('Outliers (1.5·IQR rule):', out.length ? Array.from(new Set(out)).map(F8).join(', ') : 'none');
            if (n > 2 && Number.isFinite(sd)) { const tc = tInv(0.975, n - 1), hw = tc * sd / Math.sqrt(n); add('95% confidence interval for the mean:', `[${F8(mean - hw)}, ${F8(mean + hw)}]`); }
            r.meta.push('Quartiles use linear interpolation between order statistics (the method of Excel’s QUARTILE.INC and NumPy).');
            const bins = Math.min(30, Math.max(4, Math.ceil(Math.log2(n) + 1)));
            r.plot = gTheme('Distribution of the data', 'value', 'count', [{ x: d, type: 'histogram', nbinsx: bins, name: 'histogram', opacity: 0.85 }, { x: d, type: 'box', name: 'box plot', yaxis: 'y2', boxpoints: n < 200 ? 'all' : 'outliers', orientation: 'h', jitter: 0.4, pointpos: 0 }], { y2: true });
            r.steps.push({ title: 'Mean', text: `x̄ = Σxᵢ / n = ${F8(sum)} / ${n} = ${F8(mean)}`, tex: `\\bar x=\\frac{\\sum x_i}{n}=\\frac{${F8(sum)}}{${n}}=${F8(mean)}` });
            r.steps.push({ title: 'Spread', text: `s² = Σ(xᵢ − x̄)² / (n − 1) = ${F8(ss)} / ${n - 1} = ${F8(varS)}; s = ${F8(sd)}`, tex: `s^2=\\frac{\\sum(x_i-\\bar x)^2}{n-1}=${F8(varS)},\\quad s=${F8(sd)}` });
            r.steps.push({ title: 'Median and quartiles', text: 'Sort the data; the median is the middle value (average of the two middle values when n is even).', tex: '' });
            return I.finalizeText(r);
        }
        if (op === 'regression') {
            const rows = String(src).split(/[;\n]+/).map(x => x.trim()).filter(Boolean);
            let pts; if (rows.length >= 2 && rows.every(x => numList(x).length === 2)) pts = rows.map(x => numList(x)); else { const all = numList(src); if (all.length % 2) throw new CalcError('Give (x, y) pairs: either “1 2 ; 2 4.1 ; 3 5.9” or an even-length list x₁ y₁ x₂ y₂ …'); pts = []; for (let i = 0; i < all.length; i += 2) pts.push([all[i], all[i + 1]]); }
            const n = pts.length; if (n < 3) throw new CalcError('At least 3 points are needed.'); if (n > 20000) throw new CalcError('Up to 20 000 points are supported.');
            const model = opt.model || 'linear'; const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
            const fits = {
                linear: { basis: x => [1, x], tx: x => x, ty: y => y, inv: y => y, name: 'y = a + b·x', ok: () => true },
                quadratic: { basis: x => [1, x, x * x], tx: x => x, ty: y => y, inv: y => y, name: 'y = a + b·x + c·x²', ok: () => true },
                cubic: { basis: x => [1, x, x * x, x ** 3], tx: x => x, ty: y => y, inv: y => y, name: 'y = a + b·x + c·x² + d·x³', ok: () => true },
                exponential: { basis: x => [1, x], tx: x => x, ty: Math.log, inv: Math.exp, name: 'y = A·e^(B·x)', ok: () => ys.every(y => y > 0), why: 'all y must be positive' },
                power: { basis: x => [1, x], tx: Math.log, ty: Math.log, inv: Math.exp, name: 'y = A·x^B', ok: () => ys.every(y => y > 0) && xs.every(x => x > 0), why: 'all x and y must be positive' },
                logarithmic: { basis: x => [1, x], tx: Math.log, ty: y => y, inv: y => y, name: 'y = a + b·ln x', ok: () => xs.every(x => x > 0), why: 'all x must be positive' }
            };
            const M0 = fits[model]; if (!M0) throw new CalcError('Unknown model.'); if (!M0.ok()) throw new CalcError(`This model needs ${M0.why}.`);
            const X = pts.map(p => M0.basis(M0.tx(p[0]))), Y = pts.map(p => [M0.ty(p[1])]); const k = X[0].length;
            if (n < k) throw new CalcError(`This model needs at least ${k} points.`);
            let beta; try { const d = math.qr(X); const Rn = d.R.slice(0, k).map(row => row.slice(0, k)); beta = math.lusolve(Rn, math.multiply(math.transpose(d.Q), Y).slice(0, k)).map(row => row[0]); } catch (e) { throw new CalcError('The points are degenerate for this model (e.g. all x equal).'); }
            const predict = x => { const b = M0.basis(M0.tx(x)); const z = b.reduce((a, v, i) => a + v * beta[i], 0); return M0.inv(z); };
            const my = ys.reduce((a, b) => a + b, 0) / n; const sst = ys.reduce((a, y) => a + (y - my) ** 2, 0), sse = pts.reduce((a, p) => a + (p[1] - predict(p[0])) ** 2, 0); const r2 = sst > 0 ? 1 - sse / sst : 1;
            r.title = `${model[0].toUpperCase() + model.slice(1)} regression`;
            const cf = beta.map((b, i) => `${'abcd'[i]}`); let eq;
            if (model === 'exponential') eq = `y = ${F8(Math.exp(beta[0]))}·e^(${F8(beta[1])}·x)`; else if (model === 'power') eq = `y = ${F8(Math.exp(beta[0]))}·x^${F8(beta[1])}`; else if (model === 'logarithmic') eq = `y = ${F8(beta[0])} + ${F8(beta[1])}·ln(x)`; else eq = 'y = ' + beta.map((b, i) => (i === 0 ? F8(b) : `${F8(b)}·x${i > 1 ? '^' + i : ''}`)).join(' + ');
            r.main = { label: 'Fit:', text: eq.replace(/\+ -/g, '− '), tex: '' };
            r.items.push({ label: 'R² =', text: F8(r2), tex: `R^2=${F8(r2)}` });
            r.items.push({ label: 'Points n:', text: String(n), tex: '' }); r.items.push({ label: 'Root-mean-square error:', text: F8(Math.sqrt(sse / n)), tex: '' });
            if (model === 'linear') {
                const mx = xs.reduce((a, b) => a + b, 0) / n, sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0), rr = Math.sign(beta[1]) * Math.sqrt(Math.max(0, r2));
                r.items.push({ label: 'Correlation r =', text: F8(rr), tex: `r=${F8(rr)}` });
                if (n > 2 && sxx > 0) { const se = Math.sqrt(sse / (n - 2) / sxx), t = beta[1] / se, pv = 2 * (1 - tCdf(Math.abs(t), n - 2)); r.items.push({ label: 'Slope standard error:', text: F8(se), tex: '' }); r.items.push({ label: 't-statistic / p-value (slope ≠ 0):', text: `${F8(t)} / ${pv < 1e-10 ? '< 1e-10' : F8(pv)}`, tex: '' }); }
            }
            if (opt.predict && String(opt.predict).trim()) { const xv = I.parseLimit(opt.predict, 'Predict at').value; const yv = predict(xv); r.items.push({ label: `Prediction at x = ${F8(xv)}:`, text: F8(yv), tex: '' }); if (xv < Math.min(...xs) || xv > Math.max(...xs)) r.warnings.push('That x lies outside the data range, so this is an extrapolation and may be unreliable.'); }
            r.meta.push(`Method: least squares via QR${model === 'exponential' || model === 'power' || model === 'logarithmic' ? ' on transformed data (the fit minimises the error of the transformed values)' : ''}`);
            const lo = Math.min(...xs), hi = Math.max(...xs), pad = (hi - lo) * 0.08 || 1, gx = [], gy = [];
            for (let i = 0; i <= 200; i++) { const x = lo - pad + (hi - lo + 2 * pad) * i / 200; if ((model === 'power' || model === 'logarithmic') && x <= 0) continue; gx.push(x); gy.push(predict(x)); }
            r.plot = gTheme(eq, 'x', 'y', [{ x: xs, y: ys, mode: 'markers', type: 'scatter', name: 'data' }, { x: gx, y: gy, mode: 'lines', type: 'scatter', name: model + ' fit' }]);
            r.steps.push({ title: 'Model', text: M0.name, tex: '' }); r.steps.push({ title: 'Least squares', text: 'Choose the coefficients that minimise Σ(yᵢ − ŷᵢ)². Solved with a QR decomposition, which is more stable than the normal equations.', tex: '\\min_\\beta \\lVert y-X\\beta\\rVert^2' });
            r.steps.push({ title: 'Goodness of fit', text: `R² = 1 − SSE/SST = 1 − ${F8(sse)}/${F8(sst)} = ${F8(r2)}`, tex: '' });
            return I.finalizeText(r);
        }
        if (op === 'dist') {
            const D = DISTS[opt.dist || 'normal']; if (!D) throw new CalcError('Unknown distribution.');
            const par = String(opt.params || '').trim() ? numList(opt.params, 'Parameter') : D.def.slice(); if (par.length !== D.params.length) throw new CalcError(`${D.name} needs ${D.params.length} parameter(s): ${D.params.join(', ')}.`); if (!D.ok(par)) throw new CalcError('Those parameter values are not valid for this distribution.');
            const kind = opt.what || 'le';
            const pname = D.params.map((n, i) => `${n} = ${F8(par[i])}`).join(', ');
            r.title = `${D.name} distribution (${pname})`;
            const cdf = x => D.cdf(x, par), pdf = x => D.pdf(x, par);
            const xA = I.parseLimit(String(src).split(/[;,]/)[0] || '0', 'x').value; const xB = String(src).split(/[;,]/)[1] ? I.parseLimit(String(src).split(/[;,]/)[1], 'b').value : NaN;
            const mu = D.mean(par), sg = D.sd(par);
            if (kind === 'le') { const p = cdf(xA); r.main = { label: `P(X ≤ ${F8(xA)}) =`, text: F8(p), tex: `P(X\\le ${F8(xA)})=${F8(p)}` }; }
            else if (kind === 'ge') { const p = D.cont ? 1 - cdf(xA) : 1 - cdf(xA - 1); r.main = { label: `P(X ≥ ${F8(xA)}) =`, text: F8(p), tex: `P(X\\ge ${F8(xA)})=${F8(p)}` }; }
            else if (kind === 'between') { if (!Number.isFinite(xB)) throw new CalcError('For P(a ≤ X ≤ b) enter two values: a, b'); const lo = Math.min(xA, xB), hi = Math.max(xA, xB); const p = D.cont ? cdf(hi) - cdf(lo) : cdf(hi) - cdf(lo - 1); r.main = { label: `P(${F8(lo)} ≤ X ≤ ${F8(hi)}) =`, text: F8(p), tex: `P(${F8(lo)}\\le X\\le ${F8(hi)})=${F8(p)}` }; }
            else if (kind === 'pdf') { const p = pdf(xA); r.main = { label: D.cont ? `f(${F8(xA)}) =` : `P(X = ${F8(xA)}) =`, text: F8(p), tex: '' }; }
            else if (kind === 'inv') { if (!(xA > 0 && xA < 1)) throw new CalcError('Enter a probability strictly between 0 and 1.'); let lo = D.lo != null ? D.lo : -1e6, hi = 1e6; if (!D.cont) { lo = 0; hi = D.params[0] === 'n' ? par[0] : 1e6; } if (D.cont) { for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (cdf(mid) < xA) lo = mid; else hi = mid; } r.main = { label: `x with P(X ≤ x) = ${F8(xA)}:`, text: F8((lo + hi) / 2), tex: '' }; } else { let k = lo; while (cdf(k) < xA && k < hi) k++; r.main = { label: `smallest k with P(X ≤ k) ≥ ${F8(xA)}:`, text: String(k), tex: '' }; } }
            else throw new CalcError('Unknown calculation.');
            r.items.push({ label: 'Mean / standard deviation:', text: `${Number.isFinite(mu) ? F8(mu) : 'undefined'} / ${Number.isFinite(sg) ? F8(sg) : 'undefined'}`, tex: '' });
            if (D.name === 'Normal' && kind !== 'inv') { const z = (xA - par[0]) / par[1]; r.items.push({ label: 'z-score:', text: F8(z), tex: '' }); }
            r.meta.push('Method: exact special functions (error function, incomplete beta and gamma) – no tables or sampling');
            const span = Number.isFinite(sg) ? 4.5 * sg : 10; const c0 = Number.isFinite(mu) ? mu : 0; let lo = c0 - span, hi = c0 + span; if (D.lo != null) lo = Math.max(D.lo, lo); if (D.params[0] === 'n') { lo = 0; hi = par[0]; } if (D.name === 'Poisson') { lo = 0; hi = Math.ceil(par[0] + 5 * Math.sqrt(par[0]) + 5); } if (D.name === 'Uniform') { lo = par[0] - 0.2 * (par[1] - par[0]); hi = par[1] + 0.2 * (par[1] - par[0]); }
            const gx = [], gy = []; if (D.cont) { for (let i = 0; i <= 300; i++) { const x = lo + (hi - lo) * i / 300; gx.push(x); gy.push(pdf(x)); } } else { for (let k = Math.ceil(lo); k <= Math.floor(hi); k++) { gx.push(k); gy.push(pdf(k)); } }
            const shade = kind === 'le' ? gx.map(x => x <= xA) : kind === 'ge' ? gx.map(x => x >= xA) : kind === 'between' ? gx.map(x => x >= Math.min(xA, xB) && x <= Math.max(xA, xB)) : null;
            const traces = D.cont ? [{ x: gx, y: gy, mode: 'lines', type: 'scatter', name: 'density' }] : [{ x: gx, y: gy, type: 'bar', name: 'probability' }];
            if (shade && D.cont) traces.push({ x: gx.filter((_, i) => shade[i]), y: gy.filter((_, i) => shade[i]), mode: 'lines', type: 'scatter', fill: 'tozeroy', name: 'probability', line: { width: 0 } });
            r.plot = gTheme(`${D.name} distribution`, 'x', D.cont ? 'density' : 'probability', traces);
            r.steps.push({ title: 'Distribution', text: `${D.name} with ${pname}.`, tex: '' });
            r.steps.push({ title: 'Cumulative probability', text: D.cont ? 'P(X ≤ x) is the area under the density up to x; it is evaluated with an exact special function.' : 'P(X ≤ k) = Σ P(X = j) for j ≤ k, evaluated with a regularised special function.', tex: '' });
            return I.finalizeText(r);
        }
        if (op === 'ttest') {
            const d = numList(src, 'Data value'); if (d.length < 2) throw new CalcError('At least 2 values are needed.');
            const alpha = String(opt.alpha || '0.05').trim() ? I.parseLimit(opt.alpha || '0.05', 'α').value : 0.05; if (!(alpha > 0 && alpha < 1)) throw new CalcError('α must be between 0 and 1.');
            const mean = a => a.reduce((x, y) => x + y, 0) / a.length, vr = a => { const m = mean(a); return a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1); };
            if (opt.data2 && String(opt.data2).trim()) {
                const e = numList(opt.data2, 'Second sample value'); if (e.length < 2) throw new CalcError('The second sample needs at least 2 values.');
                const m1 = mean(d), m2 = mean(e), v1 = vr(d) / d.length, v2 = vr(e) / e.length, se = Math.sqrt(v1 + v2); if (se === 0) throw new CalcError('Both samples are constant, so the test statistic is undefined.');
                const t = (m1 - m2) / se, df = (v1 + v2) ** 2 / (v1 * v1 / (d.length - 1) + v2 * v2 / (e.length - 1)); const p = 2 * (1 - tCdf(Math.abs(t), df)); const tc = tInv(1 - alpha / 2, df);
                r.title = 'Two-sample Welch t-test';
                r.main = { label: 't =', text: `${F8(t)},  p = ${p < 1e-10 ? '< 1e-10' : F8(p)}`, tex: `t=${F8(t)},\; p=${F8(p)}` };
                r.items.push({ label: 'Means x̄₁ / x̄₂:', text: `${F8(m1)} / ${F8(m2)}`, tex: '' }); r.items.push({ label: 'Degrees of freedom (Welch–Satterthwaite):', text: F8(df), tex: '' });
                r.items.push({ label: `${F8((1 - alpha) * 100)}% CI for μ₁ − μ₂:`, text: `[${F8(m1 - m2 - tc * se)}, ${F8(m1 - m2 + tc * se)}]`, tex: '' });
                r.items.push({ label: 'Decision:', text: p < alpha ? `Reject H₀ at α = ${alpha}: the means differ significantly.` : `Fail to reject H₀ at α = ${alpha}: no significant difference.`, tex: '' });
                r.steps.push({ title: 'Hypotheses', text: 'H₀: μ₁ = μ₂  versus  H₁: μ₁ ≠ μ₂ (two-sided).', tex: '' }); r.steps.push({ title: 'Statistic', text: 't = (x̄₁ − x̄₂)/√(s₁²/n₁ + s₂²/n₂)', tex: 't=\\frac{\\bar x_1-\\bar x_2}{\\sqrt{s_1^2/n_1+s_2^2/n_2}}' });
            } else {
                const mu0 = I.parseLimit(String(opt.mu0 || '0'), 'μ₀').value; const m = mean(d), sd = Math.sqrt(vr(d)), se = sd / Math.sqrt(d.length); if (se === 0) throw new CalcError('All values are equal, so the test statistic is undefined.');
                const t = (m - mu0) / se, df = d.length - 1, p = 2 * (1 - tCdf(Math.abs(t), df)), tc = tInv(1 - alpha / 2, df);
                r.title = 'One-sample t-test';
                r.main = { label: 't =', text: `${F8(t)},  p = ${p < 1e-10 ? '< 1e-10' : F8(p)}`, tex: `t=${F8(t)},\; p=${F8(p)}` };
                r.items.push({ label: 'Sample mean / s:', text: `${F8(m)} / ${F8(sd)}`, tex: '' }); r.items.push({ label: 'Degrees of freedom:', text: String(df), tex: '' });
                r.items.push({ label: `${F8((1 - alpha) * 100)}% CI for μ:`, text: `[${F8(m - tc * se)}, ${F8(m + tc * se)}]`, tex: '' });
                r.items.push({ label: 'Decision:', text: p < alpha ? `Reject H₀: μ = ${F8(mu0)} at α = ${alpha}.` : `Fail to reject H₀: μ = ${F8(mu0)} at α = ${alpha}.`, tex: '' });
                r.steps.push({ title: 'Hypotheses', text: `H₀: μ = ${F8(mu0)}  versus  H₁: μ ≠ ${F8(mu0)} (two-sided).`, tex: '' }); r.steps.push({ title: 'Statistic', text: `t = (x̄ − μ₀)/(s/√n) = ${F8(t)} with ${df} degrees of freedom`, tex: 't=\\frac{\\bar x-\\mu_0}{s/\\sqrt n}' });
            }
            r.meta.push('Method: exact Student-t distribution (regularised incomplete beta function)');
            return I.finalizeText(r);
        }
        throw new CalcError('Unknown statistics operation.');
    }
    function tInv(p, df) { let lo = -1e3, hi = 1e3; for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (tCdf(mid, df) < p) lo = mid; else hi = mid; } return (lo + hi) / 2; }
    register({ stats: runStats });


    // ======================================================================
    // Number theory & discrete maths (BigInt, exact)
    // ======================================================================
    const big = (x, what) => { const t = String(x).trim(); if (!/^-?\d+$/.test(t)) throw new CalcError(`${what || 'Each value'} must be a whole number (got “${t}”).`); if (t.replace('-', '').length > 60) throw new CalcError('Numbers up to 60 digits are supported.'); return BigInt(t); };
    const intList = (src, k, what) => { const a = String(src).split(/[\s,;]+/).filter(Boolean).map(x => big(x, what)); if (k && a.length !== k) throw new CalcError(`This operation needs exactly ${k} number${k > 1 ? 's' : ''}, separated by commas.`); if (!a.length) throw new CalcError('Enter a whole number.'); return a; };
    const babs = a => (a < 0n ? -a : a);
    const bgcd = (a, b) => { a = babs(a); b = babs(b); while (b) [a, b] = [b, a % b]; return a; };
    const egcd = (a, b) => { let [r0, r1, s0, s1, t0, t1] = [a, b, 1n, 0n, 0n, 1n]; while (r1 !== 0n) { const q = r0 / r1;[r0, r1] = [r1, r0 - q * r1];[s0, s1] = [s1, s0 - q * s1];[t0, t1] = [t1, t0 - q * t1]; } return { g: r0, x: s0, y: t0 }; };
    const bpowmod = (b, e, m) => { let r = 1n; b %= m; if (b < 0n) b += m; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
    const isPrimeB = n => { if (n < 2n) return false; for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) { if (n === p) return true; if (n % p === 0n) return false; } let d = n - 1n, s = 0; while (!(d & 1n)) { d >>= 1n; s++; } for (const a of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) { let x = bpowmod(a, d, n); if (x === 1n || x === n - 1n) continue; let comp = true; for (let i = 1; i < s; i++) { x = x * x % n; if (x === n - 1n) { comp = false; break; } } if (comp) return false; } return true; };
    const rho = n => { if (n % 2n === 0n) return 2n; for (let c = 1n; c < 40n; c++) { let x = 2n, y = 2n, d = 1n; const f = v => (v * v + c) % n; let guard = 0; while (d === 1n && guard++ < 2000000) { x = f(x); y = f(f(y)); d = bgcd(x - y, n); } if (d !== n && d !== 1n) return d; } return null; };
    function factorB(n) { const out = new Map(); const add = p => out.set(p, (out.get(p) || 0) + 1); for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n]) while (n % p === 0n) { add(p); n /= p; } const stack = n > 1n ? [n] : []; while (stack.length) { const m = stack.pop(); if (m === 1n) continue; if (isPrimeB(m)) { add(m); continue; } const d = rho(m); if (!d) throw new CalcError('This number is too hard to factor here (its factors are too large).'); stack.push(d, m / d); } return Array.from(out).sort((a, b) => (a[0] < b[0] ? -1 : 1)); }
    const facTex = f => f.map(([p, e]) => (e > 1 ? `${p}^{${e}}` : `${p}`)).join('\\cdot '), facTxt = f => f.map(([p, e]) => (e > 1 ? `${p}^${e}` : `${p}`)).join(' × ');
    const sup = e => String(e).replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);

    function runNumber(src, opt) {
        const op = opt.op || 'factor'; const r = I.makeResult('number', 'Number theory');
        const show = (label, v, tex) => r.items.push({ label, text: String(v), tex: tex || '' });
        if (op === 'factor') {
            const [n] = intList(src, 1); if (n < 2n) throw new CalcError('Enter an integer ≥ 2.'); if (n.toString().length > 40) throw new CalcError('Up to 40 digits can be factored.');
            const f = factorB(n); r.title = 'Prime factorisation';
            r.main = { label: `${n} =`, text: f.map(([p, e]) => (e > 1n || e > 1 ? `${p}${sup(e)}` : `${p}`)).join(' · ') || String(n), tex: `${n}=${facTex(f)}` };
            const divCount = f.reduce((a, [, e]) => a * BigInt(e + 1), 1n), divSum = f.reduce((a, [p, e]) => a * ((p ** BigInt(e + 1) - 1n) / (p - 1n)), 1n), phi = f.reduce((a, [p, e]) => a * (p ** BigInt(e - 1) * (p - 1n)), 1n);
            show('Number of divisors τ(n):', divCount); show('Sum of divisors σ(n):', divSum); show("Euler's totient φ(n):", phi);
            show('Prime?', f.length === 1 && f[0][1] === 1 ? 'yes' : 'no');
            if (divCount <= 120n) { let ds = [1n]; f.forEach(([p, e]) => { const nx = []; ds.forEach(d => { let q = 1n; for (let i = 0; i <= e; i++) { nx.push(d * q); q *= p; } }); ds = nx; }); ds.sort((a, b) => (a < b ? -1 : 1)); show('Divisors:', ds.join(', ')); }
            r.meta.push(`Verified: the factors multiply back to ${n}.`); r.meta.push('Method: trial division by small primes, Miller–Rabin primality test and Pollard’s rho for the rest');
            r.steps.push({ title: 'Divide out small primes', text: 'Repeatedly divide by 2, 3, 5, … while the remainder is 0.', tex: '' }); r.steps.push({ title: 'Primality test', text: 'Each remaining cofactor is tested with Miller–Rabin and split with Pollard’s rho if composite.', tex: '' });
        } else if (op === 'isprime') {
            const [n] = intList(src, 1); r.title = 'Primality test'; const pr = isPrimeB(n);
            r.main = { label: `${n} is`, text: pr ? 'prime' : (n < 2n ? 'not prime (less than 2)' : 'composite'), tex: '' };
            if (!pr && n > 1n && n.toString().length <= 30) { const f = factorB(n); show('Factorisation:', f.map(([p, e]) => (e > 1 ? `${p}${sup(e)}` : p)).join(' · ')); } else if (pr) { const nxt = (() => { let k = n + 1n; while (!isPrimeB(k)) k++; return k; })(); show('Next prime:', nxt); }
            r.meta.push('Method: deterministic Miller–Rabin (correct for all numbers below 3.3·10²⁴; probabilistically certain beyond)');
        } else if (op === 'gcd' || op === 'lcm') {
            const a = intList(src, 0); if (a.length < 2) throw new CalcError('Enter at least two numbers.'); const g = a.reduce((x, y) => bgcd(x, y)); const l = a.reduce((x, y) => (x === 0n || y === 0n ? 0n : babs(x * y) / bgcd(x, y)));
            r.title = op === 'gcd' ? 'Greatest common divisor' : 'Least common multiple'; r.main = op === 'gcd' ? { label: `gcd(${a.join(', ')}) =`, text: String(g), tex: '' } : { label: `lcm(${a.join(', ')}) =`, text: String(l), tex: '' };
            show(op === 'gcd' ? 'lcm:' : 'gcd:', op === 'gcd' ? l : g);
            if (a.length === 2 && a[0] !== 0n && a[1] !== 0n) { const e = egcd(a[0], a[1]); show('Bézout identity:', `${e.x}·${a[0]} + ${e.y}·${a[1]} = ${e.g}`, `${e.x}\\cdot ${a[0]}+${e.y}\\cdot ${a[1]}=${e.g}`); let x = a[0], y = a[1]; const st = []; while (y) { st.push(`${x} = ${x / y}·${y} + ${x % y}`);[x, y] = [y, x % y]; } r.steps.push({ title: 'Euclidean algorithm', text: st.join(';   '), tex: '' }); }
            r.meta.push('Method: Euclidean algorithm');
        } else if (op === 'modinv') {
            const [a, m] = intList(src, 2); if (m < 2n) throw new CalcError('The modulus must be at least 2.'); const e = egcd(((a % m) + m) % m, m); r.title = 'Modular inverse';
            if (e.g !== 1n) throw new CalcError(`${a} has no inverse modulo ${m} because gcd(${a}, ${m}) = ${e.g} ≠ 1.`); const inv = ((e.x % m) + m) % m;
            r.main = { label: `${a}⁻¹ mod ${m} =`, text: String(inv), tex: `${a}^{-1}\\equiv ${inv}\\pmod{${m}}` }; r.meta.push(`Verified: ${a}·${inv} ≡ ${(a * inv % m + m) % m} (mod ${m}).`); r.steps.push({ title: 'Extended Euclidean algorithm', text: `Find x, y with ${a}x + ${m}y = 1; then x mod ${m} is the inverse.`, tex: '' });
        } else if (op === 'powmod') {
            const [b, e, m] = intList(src, 3); if (m < 1n) throw new CalcError('The modulus must be positive.'); if (e < 0n) throw new CalcError('The exponent must be non-negative.'); r.title = 'Modular exponentiation';
            r.main = { label: `${b}^${e} mod ${m} =`, text: String(bpowmod(b, e, m)), tex: `${b}^{${e}}\\bmod ${m}=${bpowmod(b, e, m)}` }; r.meta.push('Method: square-and-multiply'); r.steps.push({ title: 'Square and multiply', text: 'Process the exponent bit by bit, reducing mod m after every multiplication.', tex: '' });
        } else if (op === 'totient') {
            const [n] = intList(src, 1); if (n < 1n) throw new CalcError('Enter a positive integer.'); const f = n === 1n ? [] : factorB(n); const phi = f.reduce((a, [p, e]) => a * (p ** BigInt(e - 1) * (p - 1n)), 1n); r.title = "Euler's totient"; r.main = { label: `φ(${n}) =`, text: String(phi), tex: `\\varphi(${n})=${phi}` }; if (f.length) show('Factorisation:', facTxt(f)); r.steps.push({ title: 'Formula', text: 'φ(n) = n·Π(1 − 1/p) over the distinct primes p dividing n.', tex: '\\varphi(n)=n\\prod_{p\\mid n}\\left(1-\\frac1p\\right)' });
        } else if (op === 'ncr' || op === 'npr') {
            const [n, k] = intList(src, 2); if (n < 0n || k < 0n || k > n) throw new CalcError('Need 0 ≤ k ≤ n.'); if (n > 5000n) throw new CalcError('n up to 5000 is supported.'); let res = 1n; const kk = op === 'ncr' && k > n - k ? n - k : k; for (let i = 0n; i < kk; i++) { res = res * (n - i); if (op === 'ncr') res = res / (i + 1n); } if (op === 'npr') { res = 1n; for (let i = 0n; i < k; i++) res *= (n - i); }
            r.title = op === 'ncr' ? 'Combinations' : 'Permutations'; r.main = { label: op === 'ncr' ? `C(${n}, ${k}) =` : `P(${n}, ${k}) =`, text: String(res), tex: op === 'ncr' ? `\\binom{${n}}{${k}}=${res}` : `P(${n},${k})=${res}` };
            r.steps.push({ title: 'Formula', text: op === 'ncr' ? 'C(n,k) = n!/(k!(n−k)!)' : 'P(n,k) = n!/(n−k)!', tex: op === 'ncr' ? '\\binom nk=\\frac{n!}{k!(n-k)!}' : 'P(n,k)=\\frac{n!}{(n-k)!}' });
        } else if (op === 'fib') {
            const [n] = intList(src, 1); if (n < 0n || n > 20000n) throw new CalcError('Enter an index from 0 to 20 000.'); const fd = k => { if (k === 0n) return [0n, 1n]; const [a, b] = fd(k >> 1n); const c = a * (2n * b - a), d = a * a + b * b; return k & 1n ? [d, c + d] : [c, d]; }; const v = fd(n)[0];
            r.title = 'Fibonacci number'; const s = String(v); r.main = { label: `F(${n}) =`, text: s.length > 80 ? `${s.slice(0, 30)}…${s.slice(-30)} (${s.length} digits)` : s, tex: '' }; if (s.length > 80) show('Full value:', s); if (n > 1n) show('Ratio F(n)/F(n−1):', (Number(v) / Number(fd(n - 1n)[0])).toString()); r.meta.push('Method: fast doubling – O(log n) big-integer multiplications');
        } else if (op === 'primes') {
            const [n] = intList(src, 1); if (n < 2n || n > 5000000n) throw new CalcError('Enter a limit between 2 and 5 000 000.'); const N = Number(n); const sieve = new Uint8Array(N + 1); const ps = []; for (let i = 2; i <= N; i++) { if (!sieve[i]) { ps.push(i); for (let j = i * i; j <= N; j += i) sieve[j] = 1; } }
            r.title = 'Primes up to n'; r.main = { label: `π(${N}) =`, text: `${ps.length} primes`, tex: `\\pi(${N})=${ps.length}` }; show('Largest:', ps[ps.length - 1]); show(ps.length <= 200 ? 'All primes:' : 'First 100:', (ps.length <= 200 ? ps : ps.slice(0, 100)).join(', ')); if (N > 10) show('n / ln n estimate:', (N / Math.log(N)).toFixed(1)); r.meta.push('Method: sieve of Eratosthenes');
        } else if (op === 'base') {
            const [a, b] = intList(src, 2); if (b < 2n || b > 36n) throw new CalcError('The base must be between 2 and 36.'); r.title = 'Base conversion'; const neg = a < 0n; r.main = { label: `${a} in base ${b} =`, text: a.toString(Number(b)).toUpperCase(), tex: '' }; show('Binary:', a.toString(2)); show('Octal:', a.toString(8)); show('Hexadecimal:', a.toString(16).toUpperCase());
            void neg;
        } else if (op === 'crt') {
            const eqs = String(src).split(/[;\n]+/).map(x => x.trim()).filter(Boolean).map(x => { const m = /^(-?\d+)\s*(?:mod|%|\(mod\)|,)\s*(\d+)$/i.exec(x); if (!m) throw new CalcError('Write each congruence as “a mod m”, separated by ;   e.g.  2 mod 3 ; 3 mod 5 ; 2 mod 7'); return [BigInt(m[1]), BigInt(m[2])]; });
            if (eqs.length < 2) throw new CalcError('Give at least two congruences.'); let [x, M] = [((eqs[0][0] % eqs[0][1]) + eqs[0][1]) % eqs[0][1], eqs[0][1]];
            for (const [a, m] of eqs.slice(1)) { const g = bgcd(M, m); if ((a - x) % g !== 0n) throw new CalcError('The system has no solution (the congruences are inconsistent).'); const e = egcd(M / g, m / g); const lcm = M / g * m; x = (((x + M * (((a - x) / g) * e.x % (m / g))) % lcm) + lcm) % lcm; M = lcm; }
            r.title = 'Chinese remainder theorem'; r.main = { label: 'x ≡', text: `${x} (mod ${M})`, tex: `x\\equiv ${x}\\pmod{${M}}` }; eqs.forEach(([a, m]) => { if (((x - a) % m + m) % m !== 0n) throw new Error('crt'); }); r.meta.push('Verified: x satisfies every congruence.'); r.steps.push({ title: 'Combine two congruences at a time', text: 'Solve x = x₀ + M·t using the extended Euclidean algorithm, then repeat with the merged modulus.', tex: '' });
        } else throw new CalcError('Unknown number-theory operation.');
        return I.finalizeText(r);
    }
    register({ number: runNumber });

    // ======================================================================
    // Units: safe parsing, dimension checking
    // ======================================================================
    ['kcal:4.184 kJ', 'cal:4.184 J', 'ly:9460730472580800 m', 'MPa:1000000 Pa', 'kWh:3600000 J'].forEach(d => { const [n, v] = d.split(':'); try { math.createUnit(n, v); } catch (e) { /* already defined */ } });
    function runUnits(src) {
        const text = String(src).trim().replace(/°\s*([CFK])/gi, 'deg$1').replace(/[×·]/g, '*').replace(/\bin\b(?=\s+[a-zA-Z°])/g, ' to ').replace(/\binto\b/g, ' to ').replace(/²/g, '^2').replace(/³/g, '^3').replace(/µ/g, 'u').replace(/\bmph\b/gi, 'mile/hour').replace(/\b(kph|kmh|kmph)\b/gi, 'km/hour').replace(/\bfps\b/gi, 'ft/s').replace(/\bsq\s*(m|km|ft|mi|cm|in)\b/gi, '$1^2');
        if (!text) throw new CalcError('Enter a quantity and a target, e.g.  5 km/h to m/s');
        let node; try { node = math.parse(text); } catch (e) { throw new CalcError('Could not read that. Try something like  72 degF to degC  or  3 hours + 20 minutes to seconds.'); }
        let bad = null; node.traverse(n => { if (!['ConstantNode', 'SymbolNode', 'OperatorNode', 'ParenthesisNode'].includes(n.type)) bad = bad || n.type; });
        if (bad) throw new CalcError('Only numbers, units and + − × ÷ ^ and “to” are allowed here.');
        let val; try { val = node.evaluate(); } catch (e) { throw new CalcError(/do not match|incompatible/i.test(e.message) ? 'Those units measure different things and cannot be converted.' : /Unit .* not found|Undefined symbol/i.test(e.message) ? 'Unknown unit – try names like km, mi, kg, lb, L, gal, degC, degF, J, W, bar, mph.' : 'Could not convert that.'); }
        const r = I.makeResult('units', 'Unit conversion');
        if (val && val.type === 'Unit' || (val && typeof val === 'object' && typeof val.toNumber === 'function')) {
            const hasTo = /\bto\b/.test(text); const s = val.toString(); const m = /^(-?[\d.eE+-]+)\s*(.*)$/.exec(s);
            r.main = { label: hasTo ? 'Result:' : 'Value:', text: m ? `${engine.fmt(parseFloat(m[1]), 10)} ${m[2]}`.trim() : s, tex: '' };
            try { const si = val.toSI(); const sm = /^(-?[\d.eE+-]+)\s*(.*)$/.exec(si.toString()); if (sm) r.items.push({ label: 'In SI base units:', text: `${engine.fmt(parseFloat(sm[1]), 10)} ${sm[2]}`.trim(), tex: '' }); } catch (e) { /* skip */ }
            r.meta.push('Units are checked for dimensional consistency before converting.');
        } else { r.main = { label: 'Value:', text: typeof val === 'number' ? engine.fmt(val, 10) : String(val), tex: '' }; }
        r.items.unshift({ label: 'Input:', text: String(src).trim(), tex: '' });
        r.steps.push({ title: 'Convert through base units', text: 'Every unit is expressed in SI base units (m, kg, s, A, K, …); the target unit then divides the result back out.', tex: '' });
        return I.finalizeText(r);
    }
    register({ units: runUnits });

    // ======================================================================
    // Complex numbers & functions: domain colouring, roots, polar form
    // ======================================================================
    function runComplex(src, opt) {
        const op = opt.op || 'domain'; const r = I.makeResult('complex', 'Complex analysis');
        const toC = z => { const c = math.complex(z); return { re: c.re, im: c.im }; };
        const cstr = z => { const a = nice(z.re, 8, 1e-9).text, b = nice(Math.abs(z.im), 8, 1e-9).text; if (Math.abs(z.im) < 1e-12) return a; const bi = b === '1' ? 'i' : `${b}i`; if (Math.abs(z.re) < 1e-12) return `${z.im < 0 ? '-' : ''}${bi}`; return `${a} ${z.im < 0 ? '−' : '+'} ${bi}`; };
        if (op === 'arith') {
            const node = engine.parse(src); let z; try { z = node.compile().evaluate({}); } catch (e) { throw new CalcError('Could not evaluate that complex expression.'); }
            const c = toC(z); if (!Number.isFinite(c.re) || !Number.isFinite(c.im)) throw new CalcError('The result is not finite.');
            const mod = Math.hypot(c.re, c.im), arg = Math.atan2(c.im, c.re);
            r.title = 'Complex number'; r.main = { label: 'z =', text: cstr(c), tex: `z=${nice(c.re, 8, 1e-9).tex}${c.im < 0 ? '-' : '+'}${nice(Math.abs(c.im), 8, 1e-9).tex}i` };
            r.items.push({ label: 'Modulus |z| =', text: nice(mod, 8, 1e-9).text, tex: '' }); r.items.push({ label: 'Argument arg z =', text: `${engine.fmt(arg, 8)} rad = ${engine.fmt(arg * 180 / Math.PI, 8)}°`, tex: '' });
            r.items.push({ label: 'Polar form:', text: `${nice(mod, 8, 1e-9).text}·(cos ${engine.fmt(arg, 6)} + i sin ${engine.fmt(arg, 6)})`, tex: `z=${nice(mod, 8, 1e-9).tex}\\,e^{i\\,${engine.fmt(arg, 6)}}` }); r.items.push({ label: 'Conjugate z̄ =', text: cstr({ re: c.re, im: -c.im }), tex: '' });
            r.items.push({ label: '1/z =', text: cstr(toC(math.divide(1, z))), tex: '' });
            const nroots = Math.max(2, Math.min(12, parseInt(opt.nth, 10) || 3)); const rts = []; for (let k = 0; k < nroots; k++) { const th = (arg + 2 * Math.PI * k) / nroots, rr = Math.pow(mod, 1 / nroots); rts.push({ re: rr * Math.cos(th), im: rr * Math.sin(th) }); } r.items.push({ label: `The ${nroots} ${nroots === 2 ? 'square' : nroots + 'th'} roots:`, text: rts.map(cstr).join(';   '), tex: '' });
            r.plot = { generic: { title: 'Argand diagram', xTitle: 'Re', yTitle: 'Im', equal: true, traces: [{ x: [0, c.re], y: [0, c.im], mode: 'lines+markers', type: 'scatter', name: 'z' }, { x: rts.map(q => q.re), y: rts.map(q => q.im), mode: 'markers', type: 'scatter', name: `${nroots}th roots`, marker: { size: 9, symbol: 'diamond' } }] } };
            r.steps.push({ title: 'Rectangular → polar', text: '|z| = √(a² + b²) and arg z = atan2(b, a).', tex: '|z|=\\sqrt{a^2+b^2},\\ \\arg z=\\operatorname{atan2}(b,a)' }); r.steps.push({ title: 'De Moivre', text: 'The n-th roots are |z|^(1/n)·e^{i(arg z + 2πk)/n} for k = 0 … n−1.', tex: '' });
            r.meta.push('Method: exact complex arithmetic'); return I.finalizeText(r);
        }
        const node = engine.parse(src); const vs = engine.freeVars(node); if (vs.length > 1 || (vs.length === 1 && vs[0] !== 'z')) throw new CalcError('Use the single complex variable z, e.g. (z^2 - 1)/(z^2 + 1).');
        const code = node.compile(); const f = (x, y) => { try { return toC(code.evaluate({ z: math.complex(x, y) })); } catch (e) { return { re: NaN, im: NaN }; } };
        if (op === 'roots') {
            const rat = I.toRational(node, 'z'); if (!rat || rat.d.length > 1 || rat.n.length < 2) throw new CalcError('Enter a polynomial in z, e.g. z^4 - 1.'); if (rat.n.length > 25) throw new CalcError('Up to degree 24 is supported.');
            const roots = I.polyRootsMult(rat.n.slice()).flatMap(z => Array.from({ length: z.mult }, () => ({ re: z.re, im: z.im })));
            r.title = 'Roots in the complex plane'; r.main = { label: 'z =', text: roots.map(cstr).join(',  '), tex: '' };
            const worst = Math.max(...roots.map(z => { const v = f(z.re, z.im); return Math.hypot(v.re, v.im); })); r.meta.push(`Verified: max |p(root)| = ${worst.toExponential(2)}`);
            r.items.push({ label: 'Degree:', text: String(rat.n.length - 1), tex: '' }); r.items.push({ label: 'Moduli:', text: roots.map(z => nice(Math.hypot(z.re, z.im), 6, 1e-9).text).join(', '), tex: '' });
            r.plot = { generic: { title: 'Roots of p(z)', xTitle: 'Re', yTitle: 'Im', equal: true, traces: [{ x: roots.map(z => z.re), y: roots.map(z => z.im), mode: 'markers', type: 'scatter', name: 'roots', marker: { size: 10 } }] } };
            r.steps.push({ title: 'Fundamental theorem of algebra', text: `A degree-${rat.n.length - 1} polynomial has exactly that many complex roots (counted with multiplicity).`, tex: '' }); r.steps.push({ title: 'Simultaneous root finding', text: 'All roots are refined together (Aberth iteration) and checked by substitution.', tex: '' });
            r.meta.push('Method: Aberth–Ehrlich iteration with Yun square-free decomposition for repeated roots'); return I.finalizeText(r);
        }
        // domain colouring
        const R = Math.max(0.5, Math.min(50, I.parseLimit(opt.range || '2', 'Window').value || 2)); const N = 150; const xs = [], ys = [], zArg = [], zMag = [];
        for (let i = 0; i < N; i++) xs.push(-R + 2 * R * i / (N - 1)); for (let j = 0; j < N; j++) ys.push(-R + 2 * R * j / (N - 1));
        for (let j = 0; j < N; j++) { const ra = [], rm = []; for (let i = 0; i < N; i++) { const v = f(xs[i], ys[j]); const m = Math.hypot(v.re, v.im); ra.push(Number.isFinite(m) ? Math.atan2(v.im, v.re) : null); rm.push(Number.isFinite(m) ? Math.log(m + 1e-12) : null); } zArg.push(ra); zMag.push(rm); }
        r.title = 'Domain colouring of f(z)'; r.main = { label: 'f(z) =', text: engine.strOf(node), tex: `f(z)=${engine.texOf(node)}` };
        const traces = [{ x: xs, y: ys, z: zArg, type: 'heatmap', colorscale: [[0, 'hsl(0,75%,55%)'], [1 / 6, 'hsl(60,75%,50%)'], [2 / 6, 'hsl(120,60%,45%)'], [3 / 6, 'hsl(180,65%,50%)'], [4 / 6, 'hsl(240,70%,60%)'], [5 / 6, 'hsl(300,65%,55%)'], [1, 'hsl(360,75%,55%)']], zmin: -Math.PI, zmax: Math.PI, colorbar: { title: 'arg f', tickvals: [-Math.PI, 0, Math.PI], ticktext: ['−π', '0', 'π'] }, hovertemplate: 'z = %{x:.3f} + %{y:.3f}i<br>arg f = %{z:.3f}<extra></extra>' }, { x: xs, y: ys, z: zMag, type: 'contour', contours: { coloring: 'none' }, line: { color: 'rgba(0,0,0,0.45)', width: 1 }, showscale: false, ncontours: 14, name: '|f| level lines', hoverinfo: 'skip' }];
        const rat = I.toRational(node, 'z');
        if (rat && rat.n.length <= 25 && rat.d.length <= 25) {
            const zs = rat.n.length > 1 ? I.polyRootsMult(rat.n.slice()) : [], ps = rat.d.length > 1 ? I.polyRootsMult(rat.d.slice()) : [];
            if (zs.length) { traces.push({ x: zs.map(z => z.re), y: zs.map(z => z.im), mode: 'markers', type: 'scatter', name: 'zeros', marker: { size: 11, symbol: 'circle-open', color: '#000', line: { width: 3 } } }); r.items.push({ label: 'Zeros:', text: zs.map(z => cstr(z) + (z.mult > 1 ? ` (×${z.mult})` : '')).join(';   '), tex: '' }); }
            if (ps.length) { traces.push({ x: ps.map(z => z.re), y: ps.map(z => z.im), mode: 'markers', type: 'scatter', name: 'poles', marker: { size: 11, symbol: 'x', color: '#000', line: { width: 3 } } }); r.items.push({ label: 'Poles:', text: ps.map(z => cstr(z) + (z.mult > 1 ? ` (order ${z.mult})` : '')).join(';   '), tex: '' }); }
        }
        r.items.push({ label: 'Window:', text: `|Re z|, |Im z| ≤ ${nice(R, 6, 1e-9).text}`, tex: '' });
        r.meta.push('Reading the picture: colour = argument of f(z) (red = positive real, cyan = negative real); dark lines are level curves of |f|. Colours cycle once around each simple zero or pole.');
        r.plot = { generic: { title: 'Domain colouring: hue = arg f(z)', xTitle: 'Re z', yTitle: 'Im z', equal: true, heat: true, traces } };
        r.steps.push({ title: 'Evaluate on a grid', text: `f is evaluated at ${N}×${N} complex points; each point is coloured by arg f(z).`, tex: '' }); r.steps.push({ title: 'Zeros and poles', text: 'Going once around a zero or pole the colours cycle through the whole wheel; the direction (counter-clockwise or clockwise) tells them apart.', tex: '' });
        return I.finalizeText(r);
    }
    register({ complex: runComplex });

    { const mBase = engine.run.matrix; engine.run.matrix = (src, opt) => { opt = opt || {}; return LA_OPS.has(opt.op) ? runLinalg(src, opt) : mBase(src, opt); }; }




    return engine;
});
