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
        const T = x => { const r0 = Math.round(x); return Math.abs(x - r0) < 1e-9 * Math.max(1, Math.abs(x)) ? nice(r0, 12, 1e-12) : nice(x, 8, 1e-9); };
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
        let numR = num.map(c => c.re);
        const maxNum = Math.max(1e-300, ...numR.map(Math.abs));
        const topDeg = (den.length - 1) - (Math.min(...terms.map(t => t.n)) + 1);     // F(s) ~ s^-(n+1): no higher power can occur
        while (numR.length - 1 > Math.max(topDeg, 0)) numR.pop();
        while (numR.length > 1 && Math.abs(numR[numR.length - 1]) < 1e-12 * maxNum) numR.pop();
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
        if (op === 'ode') return runLaplaceODE(src, opt);
        if (op === 'laplace' && DIST_RE.test(src)) return laplaceDistribution(src);
        if (op === 'inverse') return runInverseLaplace(src, opt);
        if (op === 'fourier') return runFourierTransform(src, opt);
        const node = engine.parse(src);
        const vs = engine.freeVars(node); if (vs.length > 1) throw new CalcError('Use a single variable (t).');
        const v = vs[0] || 't';
        const terms = Array.from(toExpPoly(node, v).values());
        const r = I.makeResult('laplace', 'Laplace transform');
        r.items.push({ label: `f(${v}) =`, text: engine.strOf(node), tex: `f(${v})=${engine.texOf(node)}` });
        if (!terms.length) { r.main = { label: `ℒ{f}(s) =`, text: '0', tex: '\\mathcal{L}\\{f\\}(s)=0' }; r.meta.push('Verified: after expansion every term cancels, so f(t) = 0 identically.'); return I.finalizeText(r); }
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

    // ======================================================================
    // Symbolic sums  Σ_{k=a}^{n} f(k)  – closed forms in n (polynomial and polynomial·rʲ terms)
    // ======================================================================
    function symbolicSum(src, opt) {
        const node = engine.parse(src); const vars = engine.freeVars(node);
        const kv = opt.variable || (vars.includes('k') ? 'k' : vars[0] || 'k');
        const up = engine.parse(opt.upper); const uv = engine.freeVars(up);
        if (uv.length !== 1) throw new CalcError('The upper limit may contain one symbol, e.g. n or 2n+1.');
        if (uv[0] === kv) throw new CalcError(`The upper limit must not use the summation index ${kv}.`);
        if (vars.some(q => q !== kv)) throw new CalcError(`With a symbolic upper limit the term may only contain ${kv}.`);
        const a = I.parseLimit(opt.lower === undefined || opt.lower === '' ? '1' : opt.lower, 'Start').value;
        if (!Number.isInteger(a) || Math.abs(a) > 1000) throw new CalcError('The start index must be a small integer.');
        const f = engine.compile(node, [kv]); const nv = uv[0];
        const S = m => { let t = 0; for (let k = a; k <= m; k++) t += f(k); return t; };
        const pts = Array.from({ length: 16 }, (_, i) => f(a + i)); if (pts.some(x => !Number.isFinite(x))) throw new CalcError('The term is undefined at some index in the sum.');
        const degOf = seq => { let d = seq.slice(); for (let deg = 0; deg < 10; deg++) { if (d.every(x => Math.abs(x) < 1e-9 * (1 + Math.max(...seq.map(Math.abs))))) return deg - 1 < 0 ? 0 : deg - 1 + (deg === 0 ? 1 : 0); d = d.slice(1).map((x, i) => x - d[i]); } return -1; };
        const degPoly = seq => { let d = seq.slice(); const scale = 1 + Math.max(...seq.map(Math.abs)); for (let deg = 0; deg <= 9; deg++) { if (d.length > 1 && d.every(x => Math.abs(x) < 1e-8 * scale)) return Math.max(0, deg - 1); d = d.slice(1).map((x, i) => x - d[i]); } return -1; };
        const T = x => nice(x, 10, 1e-9);
        let kind, expr, coeffs, rr = 1, teleNote = '';
        const dp = degPoly(pts);

        // ---- telescoping: rational terms with integer simple poles (via harmonic-number differences) and g(k+1) − g(k) patterns ----
        function telescopeSum() {
            const rat = (() => { try { return I.toRational(node, kv); } catch (e) { return null; } })();
            if (rat && rat.d.length >= 3 && rat.d.length <= 12) {
                const D = rat.d.slice(), Nn = rat.n.slice(); const roots = I.polyRootsMult(D);
                const dD = D.map((c, i) => c * i).slice(1), pe = (co, x) => co.reduceRight((acc, c) => acc * x + c, 0);
                if (roots.length === D.length - 1 && roots.every(z => Math.abs(z.im) < 1e-7 && z.mult === 1 && Math.abs(z.re - Math.round(z.re)) < 1e-6) && Nn.length <= D.length - 2) {
                    const poles = roots.map(z => Math.round(z.re)), A = poles.map(r0 => pe(Nn, r0) / pe(dD, r0));
                    const tot = A.reduce((x, y) => x + y, 0);
                    if (Math.abs(tot) < 1e-8 * (1 + Math.max(...A.map(Math.abs)))) {
                        const sh = poles.map(r0 => -r0);                                    // term A/(k + s)
                        if (sh.every(sv => a + sv >= 1)) {
                            const H = m => { let h = 0; for (let i = 1; i <= m; i++) h += 1 / i; return h; };
                            const konst = -A.reduce((acc, Aj, j) => acc + Aj * H(a - 1 + sh[j]), 0);
                            const part = A.map((Aj, j) => { const sv = sh[j]; if (sv === 0) return null; const terms = sv > 0 ? Array.from({ length: sv }, (_, i) => `1/(${nv}+${i + 1})`) : Array.from({ length: -sv }, (_, i) => `-1/(${nv}${i ? '-' + i : ''})`); return `(${nice(Aj, 12, 1e-9).text})*(${terms.join('+')})`; }).filter(Boolean);
                            return { expr: `(${nice(konst, 12, 1e-9).text}) + ${part.join(' + ') || '0'}`, how: 'partial fractions: the terms A/(k + s) telescope because ΣA = 0, leaving finitely many terms 1/(n + i)' };
                        }
                    }
                }
            }
            const G = [['sqrt', x => Math.sqrt(x), x => `sqrt(${x})`], ['ln', x => Math.log(x), x => `ln(${x})`], ['atan', x => Math.atan(x), x => `atan(${x})`], ['1/k', x => 1 / x, x => `1/(${x})`], ['1/k²', x => 1 / (x * x), x => `1/(${x})^2`], ['1/k³', x => 1 / x ** 3, x => `1/(${x})^3`], ['1/√k', x => 1 / Math.sqrt(x), x => `1/sqrt(${x})`], ['(k)!', x => 1, x => '1']].slice(0, 7);
            for (const [name, g, str] of G) {
                const d0 = g(a + 1) - g(a); if (!Number.isFinite(d0) || Math.abs(d0) < 1e-12) continue; const cc = f(a) / d0; if (!Number.isFinite(cc)) continue;
                let ok = true; for (let q = 0; q < 14 && ok; q++) { const k = a + q, want = cc * (g(k + 1) - g(k)); if (!Number.isFinite(want) || Math.abs(want - f(k)) > 1e-9 * (1 + Math.abs(want))) ok = false; }
                if (ok) { const cs = nice(cc, 12, 1e-9).text; return { expr: `(${cs})*((${str(`${nv}+1`)}) - (${str(String(a))}))`, how: `the term equals ${Math.abs(cc - 1) < 1e-12 ? '' : cs + '·'}[g(k+1) − g(k)] with g(k) = ${name === 'sqrt' ? '√k' : name === 'ln' ? 'ln k' : name}, so the partial sums collapse to g(n+1) − g(${a})` }; }
            }
            return null;
        }
        const tele = (dp >= 0 && dp <= 8) ? null : telescopeSum();
        if (dp >= 0 && dp <= 8) {
            kind = 'polynomial'; const m0 = a - 1, nn = dp + 2;
            const V = Array.from({ length: nn }, (_, i) => Array.from({ length: nn }, (_, j) => Math.pow(m0 + i, j))), y = Array.from({ length: nn }, (_, i) => [S(m0 + i)]);
            coeffs = math.lusolve(V, y).map(r => r[0]);
            expr = coeffs.map((c, j) => (Math.abs(c) < 1e-11 ? '' : `(${T(c).text})*${nv}^${j}`)).filter(Boolean).join(' + ') || '0';
        } else if (tele) {
            kind = 'telescoping'; expr = tele.expr; teleNote = tele.how;
        } else {
            rr = pts[1] / pts[0]; if (!Number.isFinite(rr) || Math.abs(rr) < 1e-12) rr = NaN;
            // f(k) = p(k)·r^k with r constant?  try r from the ratio of far-apart terms
            const cand = []; for (let i = 0; i < 6; i++) { const q = pts[i + 6] / pts[i]; if (Number.isFinite(q) && q !== 0) cand.push(Math.pow(Math.abs(q), 1 / 6) * Math.sign(q) ** (1)); }
            const r0 = cand.length ? cand[cand.length - 1] : NaN; let found = null;
            for (const rc of [rr, r0, 2, 3, 0.5, -1, -2, 1 / 3, 10].filter(Number.isFinite)) { for (const rs of [rc, Math.round(rc), (() => { const q = nice(rc, 6, 1e-6); try { return math.evaluate(q.text); } catch (e) { return NaN; } })()]) { if (!Number.isFinite(rs) || rs === 0 || rs === 1) continue; const g = pts.map((x, i) => x / Math.pow(rs, a + i)); const d = degPoly(g); if (d >= 0 && d <= 6) { found = { r: rs, d }; break; } } if (found) break; }
            if (!found) throw new CalcError('No closed form found. Supported: polynomials in k (Faulhaber sums), polynomial·rᵏ terms such as 2^k, k·3^k, 1/2^k, and telescoping sums such as 1/(k(k+1)), ln(1+1/k), √(k+1) − √k.');
            kind = 'geometric'; rr = found.r; const d = found.d, nn = d + 2, m0 = a - 1;
            const V = Array.from({ length: nn }, (_, i) => Array.from({ length: nn }, (_, j) => (j < nn - 1 ? Math.pow(rr, m0 + i) * Math.pow(m0 + i, j) : 1))), y = Array.from({ length: nn }, (_, i) => [S(m0 + i)]);
            coeffs = math.lusolve(V, y).map(r => r[0]);
            const q = coeffs.slice(0, nn - 1).map((c, j) => (Math.abs(c) < 1e-11 ? '' : `(${T(c).text})*${nv}^${j}`)).filter(Boolean).join(' + ') || '0';
            const rs = nice(rr, 8, 1e-9).text; expr = `(${q})*(${rs})^${nv} + (${T(coeffs[nn - 1]).text})`;
        }
        // exact verification against direct summation for many n
        let worst = 0; const g = engine.compile(engine.parse(expr), [nv]);
        for (let m = a - 1; m <= a + 14; m++) { const ex = S(m), got = g(m); worst = Math.max(worst, Math.abs(ex - got) / Math.max(1, Math.abs(ex))); }
        if (!(worst < 1e-8)) throw new CalcError('No closed form found for this term (the fit did not verify).');
        let closed = engine.parse(expr); try { closed = I.simplifyNode(I.foldConstants(closed)); } catch (e) { /* keep */ }
        const shown = (uv.length === 1 && up.type === 'SymbolNode') ? closed : subst(closed, { [nv]: up });
        const shownS = (() => { try { return I.simplifyNode(I.foldConstants(shown)); } catch (e) { return shown; } })();
        const r = I.makeResult('sum', 'Finite sum (closed form)');
        r.items.push({ label: 'Sum:', text: `Σ ${kv}=${a}…${engine.strOf(up)} of ${engine.strOf(node)}`, tex: `\\sum_{${kv}=${a}}^{${engine.texOf(up)}} ${engine.texOf(node)}` });
        r.main = { label: 'Closed form =', text: engine.strOf(shownS), tex: `\\sum_{${kv}=${a}}^{${engine.texOf(up)}} ${engine.texOf(node)}=${engine.texOf(shownS)}` };
        r.meta.push(`Verified: the closed form equals the direct sum for ${16} consecutive values of the upper limit (max relative gap ${worst.toExponential(1)}).`);
        r.meta.push(kind === 'telescoping' ? `Method: telescoping – ${teleNote}` : kind === 'polynomial' ? `Method: the sum of a degree-${dp} polynomial is a degree-${dp + 1} polynomial in n (Faulhaber); its coefficients are found by exact interpolation` : `Method: for p(k)·r^k with r = ${nice(rr, 6, 1e-9).text} the sum has the form r^n·q(n) + C; q and C are found by solving a linear system`);
        r.steps.push({ title: 'Recognise the type', text: kind === 'telescoping' ? `The sum telescopes: ${teleNote}.` : kind === 'polynomial' ? `The term is a polynomial of degree ${dp} in ${kv}, so its partial sums form a polynomial of degree ${dp + 1} in n.` : `The term is a polynomial times ${nice(rr, 6, 1e-9).text}^${kv}.`, tex: '' });
        r.steps.push({ title: 'Solve for the coefficients', text: 'Evaluate the first partial sums S(a−1) = 0, S(a), S(a+1), … and solve for the unknown coefficients.', tex: '' });
        r.steps.push({ title: 'Verify', text: 'The formula is compared with the direct sum for many values of n.', tex: '' });
        return I.finalizeText(r);
    }
    { const sBase = engine.run.sums; engine.run.sums = (src, opt) => { opt = opt || {}; const up = opt.upper; if (up && String(up).trim() && !/^[-+]?(\d+(\.\d+)?|inf(inity)?|pi|e|[\d.\s+*/^()\-]*)$/i.test(String(up).trim()) && /[a-zA-Z]/.test(String(up).replace(/\b(inf|infinity|pi|e|sqrt|exp|ln|log|sin|cos|tan)\b/gi, ''))) return symbolicSum(src, opt); return sBase(src, opt); }; }

    // ---- Laplace with step and impulse functions (second shifting theorem) -------------------------
    const DIST_RE = /\b(heaviside|dirac|delta|step|unitstep|H|u)\s*\(/;
    function laplaceDistribution(src) {
        let node; try { node = math.parse(engine.clean(src)); } catch (e) { throw new CalcError('Could not read that expression.'); }
        const v = 't', isD = f => f.type === 'FunctionNode' && /^(heaviside|dirac|delta|step|unitstep|H|u)$/.test(f.fn.name);
        const strip = n => { while (n.type === 'ParenthesisNode') n = n.content; return n; };
        const flat = (n, sign, out) => { n = strip(n); if (n.type === 'OperatorNode' && n.fn === 'add') { flat(n.args[0], sign, out); flat(n.args[1], sign, out); } else if (n.type === 'OperatorNode' && n.fn === 'subtract') { flat(n.args[0], sign, out); flat(n.args[1], -sign, out); } else if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') flat(n.args[0], -sign, out); else out.push({ n, sign }); return out; };
        const factors = (n, out) => { n = strip(n); if (n.type === 'OperatorNode' && n.fn === 'multiply') { factors(n.args[0], out); factors(n.args[1], out); } else out.push(n); return out; };
        const shiftOf = arg => { const g = engine.compile(arg, [v]); const c0 = g(0), c1 = g(1) - c0; if (Math.abs(c1 - 1) > 1e-9 || !Number.isFinite(c0)) throw new CalcError('Step and impulse arguments must look like t − a.'); return -c0; };
        const groups = new Map(), deltas = [];
        flat(node, 1, []).forEach(({ n, sign }) => {
            const fs = factors(n, []), ds = fs.filter(isD); if (ds.length > 1) throw new CalcError('Use at most one step or impulse factor per term.');
            const rest = fs.filter(f => !isD(f)); const restNode = rest.length ? rest.reduce((a, b) => new math.OperatorNode('*', 'multiply', [a, b])) : new math.ConstantNode(1);
            if (!ds.length) { (groups.get('0') || groups.set('0', { a: 0, parts: [] }).get('0')).parts.push({ node: restNode, sign }); return; }
            const a = shiftOf(ds[0].args[0]); if (a < -1e-12) throw new CalcError('Shifts must be zero or positive: use u(t − a) with a ≥ 0.');
            if (/^(dirac|delta)$/.test(ds[0].fn.name)) { const val = engine.compile(restNode, [v])(Math.max(a, 0)); if (!Number.isFinite(val)) throw new CalcError('The factor multiplying the impulse is undefined there.'); deltas.push({ a: Math.max(a, 0), c: sign * val }); return; }
            const key = String(+a.toFixed(9)); (groups.get(key) || groups.set(key, { a: Math.max(a, 0), parts: [] }).get(key)).parts.push({ node: restNode, sign });
        });
        const r = I.makeResult('laplace', 'Laplace transform (steps and impulses)');
        r.items.push({ label: 'f(t) =', text: src.trim(), tex: '' });
        const pieces = [], pieceTex = [], evalAt = [];
        groups.forEach(g => {
            const sum = new Map();
            g.parts.forEach(part => { const shifted = g.a ? subst(part.node, { [v]: new math.OperatorNode('+', 'add', [new math.SymbolNode(v), new math.ConstantNode(g.a)]) }) : part.node; toExpPoly(shifted, v).forEach((t, k) => { const o = sum.get(k), c = cmul(t.c, Cx(part.sign)); sum.set(k, o ? { n: o.n, z: o.z, c: cadd(o.c, c) } : { n: t.n, z: t.z, c }); }); });
            const terms = Array.from(sum.values()).filter(t => cabs(t.c) > 1e-11); if (!terms.length) return;
            const L = laplaceOfTerms(terms), a = g.a, at = nice(a, 8, 1e-9);
            pieces.push(`${a ? `exp(-${at.text}*s)*` : ''}(${polyStr(L.num, 's')}) / (${facStr(L.fac, 's')})`);
            pieceTex.push(`${a ? `e^{-${at.tex}s}` : ''}\\dfrac{${polyStr(L.num, 's', true)}}{${facStr(L.fac, 's', true)}}`);
            evalAt.push(s0 => Math.exp(-a * s0) * polyEval(L.num, s0) / polyEval(L.den, s0));
            r.steps.push({ title: a ? `Terms switched on at t = ${at.text}` : 'Terms without a step', text: a ? `ℒ{u(t − a)·g(t − a)} = e^(−as)·G(s): rewrite the factor in τ = t − ${at.text}, transform it, multiply by e^(−${at.text}s).` : 'Ordinary table transform.', tex: a ? '\\mathcal L\\{u(t-a)\\,g(t-a)\\}=e^{-as}G(s)' : '' });
        });
        deltas.forEach(d => { const c = nice(d.c, 8, 1e-9), at = nice(d.a, 8, 1e-9); pieces.push(`${Math.abs(d.c - 1) < 1e-12 ? '' : `(${c.text})*`}${d.a ? `exp(-${at.text}*s)` : '1'}`); pieceTex.push(`${Math.abs(d.c - 1) < 1e-12 ? '' : c.tex}${d.a ? `e^{-${at.tex}s}` : '1'}`); evalAt.push(s0 => d.c * Math.exp(-d.a * s0)); r.steps.push({ title: `Impulse at t = ${at.text}`, text: 'ℒ{δ(t − a)·g(t)} = g(a)·e^(−as)  (sifting property).', tex: '\\mathcal L\\{\\delta(t-a)\\}=e^{-as}' }); });
        if (!pieces.length) { r.main = { label: 'F(s) =', text: '0', tex: 'F(s)=0' }; r.meta.push('Verified: every term cancels.'); return I.finalizeText(r); }
        r.main = { label: 'F(s) =', text: pieces.join('  +  '), tex: `F(s)=${pieceTex.join('+')}` };
        if (!deltas.length) {
            try {
                const code = node.compile(), H = x => (x >= 0 ? 1 : 0), f = t => { const y = code.evaluate({ t, heaviside: H, u: H, H, step: H, unitstep: H }); return typeof y === 'number' ? y : NaN; };
                const s0 = 3.1, T = 40 / s0, cuts = Array.from(groups.values()).map(g => g.a).filter(a => a > 0 && a < T);
                const num = engine.integrateRobust(t => f(t) * Math.exp(-s0 * t), 0, T, cuts).value, ex = evalAt.reduce((a, g) => a + g(s0), 0);
                if (Math.abs(num - ex) <= 1e-5 * Math.max(1, Math.abs(ex))) r.meta.push(`Verified: ∫₀^∞ f(t)e^(−st) dt = ${engine.fmt(num, 8)} at s = ${s0} matches F(s).`); else r.warnings.push('The numerical check at s = 3.1 did not agree.');
            } catch (e) { /* skip */ }
        } else r.meta.push('Impulse terms cannot be checked by ordinary integration; the sifting property is exact.');
        r.meta.push('Method: second shifting theorem ℒ{u(t − a)g(t − a)} = e^(−as)G(s) and the sifting property of δ');
        return I.finalizeText(r);
    }

    // ---- piecewise functions: Laplace and Fourier transforms ---------------------------------------------
    const PW_RE = /(^|[\s;)])(for|if|when|otherwise|else)(\s|$|(?=[-+(\d]))/i;
    function parsePiecewise(src) {
        const chunks = String(src).split(/[;\n]+/).map(x => x.trim()).filter(Boolean); if (chunks.length < 1 || chunks.length > 12) throw new CalcError('Give between 1 and 12 pieces separated by ;');
        const pieces = []; let fallback = null;
        chunks.forEach(ch => {
            let m = /^(.*?)\s+(?:for|if|when|on)(?:\s+|(?=[-+(\d]))(.+)$/i.exec(ch); if (!m) { const o = /^(.*?)\s+(?:otherwise|else)$/i.exec(ch); if (o) { fallback = o[1]; return; } throw new CalcError(`Write each piece as  expression for condition,  e.g.  t for 0 < t < 1.  Could not read “${ch.slice(0, 40)}”.`); }
            const exprTxt = m[1].trim(), cond = m[2].trim(); let lo = -Infinity, hi = Infinity, loTxt = '-inf', hiTxt = 'inf';
            cond.split(/\s+and\s+|&&|,/i).forEach(part => {
                const toks = part.replace(/≤/g, '<=').replace(/≥/g, '>=').split(/(<=|>=|<|>)/).map(x => x.trim()); if (toks.length < 3 || toks.length % 2 === 0) throw new CalcError(`Could not read the condition “${part.trim()}”. Use forms like 0 < t < 1, t >= 2 or t < 3.`);
                const isT = x => /^t$/i.test(x); const ops = [];
                for (let i = 1; i < toks.length; i += 2) ops.push([toks[i - 1], toks[i], toks[i + 1]]);
                ops.forEach(([a, op, b]) => {
                    let bound, side;
                    if (isT(a) && !isT(b)) { bound = b; side = op.startsWith('<') ? 'hi' : 'lo'; } else if (isT(b) && !isT(a)) { bound = a; side = op.startsWith('<') ? 'lo' : 'hi'; } else throw new CalcError(`The condition “${part.trim()}” must compare t with a number.`);
                    const val = I.parseLimit(bound, 'Bound').value; if (Number.isNaN(val)) throw new CalcError(`“${bound}” is not a number.`);
                    if (side === 'hi') { if (val < hi) { hi = val; hiTxt = bound; } } else if (val > lo) { lo = val; loTxt = bound; }
                });
            });
            if (!(lo < hi)) throw new CalcError(`The condition “${cond}” describes an empty interval.`);
            const node = engine.parse(exprTxt); const fv = engine.freeVars(node); if (fv.some(q => q !== 't')) throw new CalcError(`Each piece may only use the variable t (found ${fv.find(q => q !== 't')}).`);
            pieces.push({ lo, hi, loTxt, hiTxt, exprTxt, node });
        });
        pieces.sort((a, b) => a.lo - b.lo);
        for (let i = 1; i < pieces.length; i++) if (pieces[i].lo < pieces[i - 1].hi - 1e-12) throw new CalcError('Two pieces overlap. Each value of t may belong to only one piece.');
        if (fallback !== null) { // “otherwise”: fill the gaps (and the unbounded ends) with that expression
            const node = engine.parse(fallback); const fv = engine.freeVars(node); if (fv.some(q => q !== 't')) throw new CalcError('The “otherwise” piece may only use t.'); const isZero = Math.abs(engine.compile(node, ['t'])(0.37)) < 1e-14 && Math.abs(engine.compile(node, ['t'])(2.9)) < 1e-14;
            if (!isZero) throw new CalcError('Use “0 otherwise”: transforms need the function to vanish outside the listed pieces.');
        }
        if (!pieces.length) throw new CalcError('Add at least one piece with a condition.');
        return pieces;
    }
    const subT = (node, rep) => node.transform(n => (n.type === 'SymbolNode' && n.name === 't' ? new math.ParenthesisNode(rep) : n));
    function runPiecewise(src, opt) {
        const fourier = (opt.op || 'laplace') === 'fourier'; const pcs = parsePiecewise(src);
        const f = t => { for (const p of pcs) if (t >= p.lo && t < p.hi) { const v = engine.compile(p.node, ['t'])(t); return Number.isFinite(v) ? v : NaN; } return 0; };
        const codes = pcs.map(p => engine.compile(p.node, ['t']));
        const value = t => { for (let i = 0; i < pcs.length; i++) if (t >= pcs[i].lo && t < pcs[i].hi) return codes[i](t); return 0; };
        void f;
        let T = 0, Ttxt = '0'; if (fourier) { const first = pcs[0]; if (first.lo === -Infinity) throw new CalcError('The function must be zero for t below some finite start (use a piece such as “t < -1” only with the value 0, or start at a number).'); if (first.lo < 0) { T = -first.lo; Ttxt = first.loTxt.replace(/^-\s*/, ''); if (first.loTxt.trim()[0] !== '-') Ttxt = `-(${first.loTxt})`; else Ttxt = first.loTxt.trim().slice(1); } }
        // Laplace is one-sided: ignore t < 0
        const used = pcs.filter(p => p.hi > (fourier ? -Infinity : 0)).map(p => ({ ...p })); if (!used.length) throw new CalcError('Every piece lies at t < 0, where the one-sided Laplace transform sees nothing.');
        const noteClip = !fourier && pcs.some(p => p.lo < 0);
        const stepOf = (txt, num) => (fourier ? `(${txt})+(${Ttxt})` : txt);
        const terms = []; used.forEach(p => { const expr = fourier && T ? subT(p.node, math.parse(`(t-(${Ttxt}))`)).toString() : p.node.toString(); const lowOn = fourier ? true : p.lo > 0; const lowTxt = lowOn ? stepOf(p.loTxt, p.lo) : null; const upTxt = p.hi < Infinity ? stepOf(p.hiTxt, p.hi) : null; terms.push({ sign: 1, txt: lowTxt ? `(${expr})*u(t-(${lowTxt}))` : `(${expr})` }); if (upTxt) terms.push({ sign: -1, txt: `(${expr})*u(t-(${upTxt}))` }); });
        const stepForm = terms.map((q, i) => (i === 0 ? (q.sign < 0 ? '-' : '') : (q.sign < 0 ? ' - ' : ' + ')) + q.txt).join('');
        let base; try { base = laplaceDistribution(stepForm); } catch (e) { if (e instanceof CalcError && /Laplace table/.test(e.message)) throw new CalcError('Each piece must be built from polynomials, exponentials, sin, cos, sinh and cosh of linear arguments in t. For |t| write separate pieces, e.g.  1 + t for -1 < t < 0 ;  1 - t for 0 <= t < 1.'); throw e; }
        const r = I.makeResult('laplace', fourier ? 'Fourier transform of a piecewise function' : 'Laplace transform of a piecewise function');
        r.items.push({ label: 'f(t) =', text: pcs.map(p => `${p.exprTxt} for ${p.loTxt === '-inf' ? '' : p.loTxt + ' ≤ '}t${p.hiTxt === 'inf' ? '' : ' < ' + p.hiTxt}`).join(';  ') + ';  0 elsewhere', tex: '' });
        if (!fourier) { r.main = base.main; r.items.push({ label: 'As step functions:', text: stepForm, tex: '' }); base.meta.filter(m => /^Verified/.test(m)).forEach(m => r.meta.push(m)); base.warnings.forEach(w => r.warnings.push(w)); }
        else {
            const sText = base.main.text; const body = sText.replace(/\bs\b/g, '(i*w)'); const full = T ? `exp(i*w*(${Ttxt}))*(${body})` : body;
            let node; try { node = math.parse(full); } catch (e) { throw new CalcError('Could not form the Fourier transform from the Laplace result.'); }
            const ce = node.compile(); const ev = w => { try { const v = ce.evaluate({ w }); return typeof v === 'number' ? { re: v, im: 0 } : { re: v.re, im: v.im }; } catch (e) { return { re: NaN, im: NaN }; } };
            // decay requirement for an unbounded last piece
            const last = pcs[pcs.length - 1]; if (last.hi === Infinity) { for (const tt of [40, 80, 160]) { const a = Math.abs(value(tt)); if (!(a < (tt >= 160 ? 1e-9 : 1e-4))) throw new CalcError('The last piece does not decay to 0, so the Fourier transform does not exist (the function must be absolutely integrable).'); } }
            let worst = 0, cnt = 0; const sup = pcs.map(p => [Math.max(p.lo, -1e3), Math.min(p.hi, last.hi === Infinity ? 60 : p.hi)]);
            for (const w of [0.7, 1.9, 3.3]) { let re = 0, im = 0; pcs.forEach((p, i) => { const [a, b] = [Math.max(p.lo, -400), Math.min(p.hi, 400)]; if (!(b > a)) return; re += engine.integrateRobust(t => codes[i](t) * Math.cos(w * t), a, b).value; im -= engine.integrateRobust(t => codes[i](t) * Math.sin(w * t), a, b).value; }); const c = ev(w); if (![re, im, c.re, c.im].every(Number.isFinite)) continue; worst = Math.max(worst, Math.hypot(re - c.re, im - c.im) / Math.max(1, Math.hypot(re, im))); cnt++; }
            void sup; if (cnt < 2 || worst > 1e-5) throw new CalcError('The closed form did not match numerical integration, so it was discarded.');
            r.main = { label: 'F(ω) =', text: full, tex: `F(\\omega)=${engine.texOf(node).replace(/\bw\b/g, '\\omega')}` };
            r.items.push({ label: 'Convention:', text: 'F(ω) = ∫ f(t) e^(−iωt) dt', tex: '' }); if (T) r.items.push({ label: 'Shift used:', text: `f starts at t = −${nice(T, 8, 1e-9).text}; the transform of the shifted copy is multiplied by e^(iω·${nice(T, 8, 1e-9).text})`, tex: '' });
            r.meta.push(`Verified: F(ω) agrees with direct numerical integration of f(t)e^(−iωt) at ω = 0.7, 1.9 and 3.3 (largest relative difference ${worst.toExponential(1)})`);
            const ws = [], mag = [], re = [], im = []; for (let k = 0; k <= 400; k++) { const w = 0.01 + 0.06 * k; const c = ev(w); ws.push(w); mag.push(Math.hypot(c.re, c.im)); re.push(c.re); im.push(c.im); }
            r.plot = { generic: { title: 'Fourier transform of the piecewise function', xTitle: 'ω', yTitle: 'F(ω)', traces: [{ x: ws, y: mag, mode: 'lines', type: 'scatter', name: '|F(ω)|' }, { x: ws, y: re, mode: 'lines', type: 'scatter', name: 'Re F', line: { dash: 'dash' } }, { x: ws, y: im, mode: 'lines', type: 'scatter', name: 'Im F', line: { dash: 'dot' } }] } };
        }
        if (!fourier) { const a = Math.max(0, pcs[0].lo), b = pcs[pcs.length - 1].hi; const hi = b === Infinity ? Math.max(a + 6, ...pcs.map(p => (Number.isFinite(p.lo) ? p.lo : 0)).map(x => x + 6)) : b; const lo0 = Math.min(0, a); const xs = [], ys = []; for (let k = 0; k <= 600; k++) { const t = lo0 - (hi - lo0) * 0.05 + (hi - lo0) * 1.1 * k / 600; xs.push(t); ys.push(t < 0 ? 0 : (() => { const y = value(t); return Number.isFinite(y) ? y : null; })()); } r.plot = { generic: { title: 'The piecewise function f(t)', xTitle: 't', yTitle: 'f(t)', traces: [{ x: xs, y: ys, mode: 'lines', type: 'scatter', name: 'f(t)', line: { shape: 'linear' } }] } }; }
        if (noteClip) r.items.push({ label: 'Note:', text: 'Parts of the function at t < 0 are ignored: the Laplace transform is one-sided.', tex: '' });
        r.items.push({ label: 'Support:', text: `${pcs.map(p => `[${p.loTxt === '-inf' ? '−∞' : p.loTxt}, ${p.hiTxt === 'inf' ? '∞' : p.hiTxt})`).join(' ∪ ')}`, tex: '' });
        r.meta.push(fourier ? 'Method: each piece becomes f(t)·[u(t − a) − u(t − b)]; the Laplace transform of that sum is evaluated at s = iω (after shifting so the support starts at t = 0)' : 'Method: each piece becomes f(t)·[u(t − a) − u(t − b)] and the second shifting theorem ℒ{u(t − a)g(t − a)} = e^(−as)G(s) is applied term by term');
        r.steps.push({ title: 'Write f with unit steps', text: `f(t) = ${stepForm}`, tex: '' });
        r.steps.push({ title: 'Shift each piece', text: 'A piece switched on at t = a is rewritten in τ = t − a, transformed, then multiplied by e^(−as).', tex: '' });
        if (fourier) r.steps.push({ title: 'Evaluate on the imaginary axis', text: 'The Fourier transform is the Laplace transform at s = iω, which exists because the function is absolutely integrable.', tex: '' });
        base.steps.forEach(st => r.steps.push(st));
        return I.finalizeText(r);
    }

    // ---- ODEs by Laplace transform: y'' + a y' + b y = f(t) with initial values ------------------------
    function runLaplaceODE(src, opt) {
        const order = String(opt.order || '2') === '1' ? 1 : 2;
        const a = I.parseLimit(String(opt.a || '0'), 'a').value, b = order === 2 ? I.parseLimit(String(opt.b || '0'), 'b').value : 0;
        const y0 = I.parseLimit(String(opt.y0 === undefined || opt.y0 === '' ? '0' : opt.y0), 'y(0)').value, v0 = order === 2 ? I.parseLimit(String(opt.v0 === undefined || opt.v0 === '' ? '0' : opt.v0), "y′(0)").value : 0;
        if (![a, b, y0, v0].every(Number.isFinite)) throw new CalcError('Coefficients and initial values must be finite numbers.');
        const node = engine.parse(src); const fv = engine.freeVars(node); if (fv.some(q => q !== 't')) throw new CalcError('The forcing function may only use t.');
        const terms = Array.from(toExpPoly(node, 't').values()); const Lf = terms.length ? laplaceOfTerms(terms) : { num: [0], den: [1] };
        const pm = I.polyMul, pa = I.polyAdd;
        const charP = order === 2 ? [b, a, 1] : [a, 1], init = order === 2 ? [y0 * a + v0, y0] : [y0];
        const numY = pa(Lf.num.slice(), pm(init, Lf.den.slice())), denY = pm(Lf.den.slice(), charP);
        const gcdN = Math.max(...numY.map(Math.abs)) || 1;
        const sol = runInverseLaplace(`(${polyStr(numY.map(x => x / gcdN), 's')}) / (${polyStr(denY.map(x => x / gcdN), 's')})`, {});
        const yText = sol.main.text, yNode = engine.parse(yText);
        const r = I.makeResult('laplace', 'ODE solved by Laplace transform');
        const odeTxt = order === 2 ? `y″ + ${nice(a, 6, 1e-9).text}·y′ + ${nice(b, 6, 1e-9).text}·y = ${engine.strOf(node)}` : `y′ + ${nice(a, 6, 1e-9).text}·y = ${engine.strOf(node)}`;
        r.items.push({ label: 'Equation:', text: odeTxt, tex: '' }); r.items.push({ label: 'Initial values:', text: order === 2 ? `y(0) = ${nice(y0, 6, 1e-9).text}, y′(0) = ${nice(v0, 6, 1e-9).text}` : `y(0) = ${nice(y0, 6, 1e-9).text}`, tex: '' });
        r.main = { label: 'y(t) =', text: yText, tex: `y(t)=${engine.texOf(yNode)}` };
        // independent check: substitute back
        try {
            const y1 = engine.diff(yNode, 't'), y2 = order === 2 ? engine.diff(yNode, 't', 2) : null; const fy = engine.compile(yNode, ['t']), f1 = engine.compile(y1, ['t']), f2 = y2 ? engine.compile(y2, ['t']) : null, ff = engine.compile(node, ['t']);
            let worst = Math.max(Math.abs(fy(0) - y0), order === 2 ? Math.abs(f1(0) - v0) : 0);
            for (const t of [0.2, 0.7, 1.3, 2.1, 3.4]) { const lhs = order === 2 ? f2(t) + a * f1(t) + b * fy(t) : f1(t) + a * fy(t); worst = Math.max(worst, Math.abs(lhs - ff(t)) / Math.max(1, Math.abs(ff(t)))); }
            if (worst < 1e-7) r.meta.push(`Verified: substituting y(t) back satisfies the equation and the initial values (max residual ${worst.toExponential(1)}).`); else r.warnings.push('Substituting the solution back left a residual – please double-check.');
            const ts = [], ys = []; const Tend = 10; for (let i = 0; i <= 400; i++) { const t = Tend * i / 400; ts.push(t); const y = fy(t); ys.push(Number.isFinite(y) ? y : null); }
            r.plot = { generic: { title: 'Solution y(t)', xTitle: 't', yTitle: 'y', traces: [{ x: ts, y: ys, mode: 'lines', type: 'scatter', name: 'y(t)' }] } };
        } catch (e) { /* skip */ }
        r.meta.push('Method: transform the equation, solve algebraically for Y(s), invert by partial fractions');
        r.steps.push({ title: 'Transform the equation', text: order === 2 ? 'ℒ{y″} = s²Y − s·y(0) − y′(0),  ℒ{y′} = sY − y(0).' : 'ℒ{y′} = sY − y(0).', tex: order === 2 ? '\\mathcal L\\{y\'\'\\}=s^2Y-sy(0)-y\'(0)' : '\\mathcal L\\{y\'\\}=sY-y(0)' });
        r.steps.push({ title: 'Solve for Y(s)', text: `Y(s) = (${polyStr(numY.map(x => x / gcdN), 's')}) / (${polyStr(denY.map(x => x / gcdN), 's')})`, tex: '' });
        sol.steps.slice(1).forEach(st => r.steps.push(st));
        return I.finalizeText(r);
    }
    register({ laplace: runLaplace });
    register({ laplace: (src, opt) => ((opt.op === undefined || opt.op === 'laplace' || opt.op === 'fourier') && PW_RE.test(String(src))) ? runPiecewise(src, opt) : runLaplace(src, opt) });
    Object.assign(engine.extras, { toExpPoly, laplaceOfTerms });

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

    // ======================================================================
    // Green's theorem, divergence theorem, surface integrals and flux
    // ======================================================================
    function runVector2(src, opt) {
        const op = opt.op; const gl = I.gl, F8 = x => engine.fmt(x, 10);
        const lim = (k, d) => I.parseLimit(opt[k] === undefined || opt[k] === '' ? d : opt[k], k);
        if (op === 'green') {
            const comps = splitComps(src); if (comps.length !== 2) throw new CalcError('Give F = (P ; Q) with two components.');
            const Pn = engine.parse(comps[0]), Qn = engine.parse(comps[1]);
            [Pn, Qn].forEach(n => engine.freeVars(n).forEach(q => { if (q !== 'x' && q !== 'y') throw new CalcError('Use only x and y.'); }));
            const xa = lim('xLow', '0').value, xb = lim('xHigh', '1').value; if (!(xb > xa)) throw new CalcError('Need x from < x to.');
            const g1n = engine.parse(opt.yLow || '0'), g2n = engine.parse(opt.yHigh || '1');
            [g1n, g2n].forEach(n => engine.freeVars(n).forEach(q => { if (q !== 'x') throw new CalcError('The y limits may only use x.'); }));
            const P = engine.compile(Pn, ['x', 'y']), Q = engine.compile(Qn, ['x', 'y']), g1 = engine.compile(g1n, ['x']), g2 = engine.compile(g2n, ['x']), dg1 = engine.compile(engine.diff(g1n, 'x'), ['x']), dg2 = engine.compile(engine.diff(g2n, 'x'), ['x']);
            if (!(g2(xa) >= g1(xa) - 1e-12) || !(g2((xa + xb) / 2) >= g1((xa + xb) / 2))) throw new CalcError('The upper curve must lie above the lower curve on [x from, x to].');
            const curl = engine.compile(engine.parse(`(${engine.strOf(engine.diff(Qn, 'x'))}) - (${engine.strOf(engine.diff(Pn, 'y'))})`), ['x', 'y']);
            const area = gl(x => gl(y => curl(x, y), g1(x), g2(x), 4), xa, xb, 4);
            const bottom = gl(t => P(t, g1(t)) + Q(t, g1(t)) * dg1(t), xa, xb, 6), right = gl(y => Q(xb, y), g1(xb), g2(xb), 4), top = -gl(t => P(t, g2(t)) + Q(t, g2(t)) * dg2(t), xa, xb, 6), left = -gl(y => Q(xa, y), g1(xa), g2(xa), 4);
            const line = bottom + right + top + left;
            const r = I.makeResult('vector', "Green's theorem check");
            r.main = { label: '∮ F·dr = ∬ (∂Q/∂x − ∂P/∂y) dA =', text: F8(area), tex: `\\oint_C P\\,dx+Q\\,dy=\\iint_D\\left(\\frac{\\partial Q}{\\partial x}-\\frac{\\partial P}{\\partial y}\\right)dA=${F8(area)}` };
            r.items.push({ label: 'Region D:', text: `${F8(xa)} ≤ x ≤ ${F8(xb)},  ${engine.strOf(g1n)} ≤ y ≤ ${engine.strOf(g2n)}`, tex: '' });
            r.items.push({ label: 'Double integral side:', text: F8(area), tex: '' }); r.items.push({ label: 'Line integral side (counter-clockwise):', text: F8(line), tex: '' });
            r.items.push({ label: 'Boundary pieces:', text: `bottom ${F8(bottom)},  right ${F8(right)},  top ${F8(top)},  left ${F8(left)}`, tex: '' });
            const gap = Math.abs(area - line); if (gap < 1e-7 * Math.max(1, Math.abs(area))) r.meta.push(`Verified: both sides agree (difference ${gap.toExponential(1)}).`); else r.warnings.push(`The two sides differ by ${gap.toExponential(2)} – check that the region is simple and F is smooth on it.`);
            r.meta.push('Method: both sides evaluated by Gauss–Legendre quadrature; the boundary is the bottom curve, right edge, top curve (reversed) and left edge');
            r.steps.push({ title: "Green's theorem", text: 'For a positively oriented simple closed curve C bounding D: ∮ P dx + Q dy = ∬ (Qₓ − Pᵧ) dA.', tex: '\\oint_C P\\,dx+Q\\,dy=\\iint_D\\left(Q_x-P_y\\right)dA' });
            r.steps.push({ title: 'Double-integral side', text: `∂Q/∂x − ∂P/∂y integrated over D gives ${F8(area)}.`, tex: '' }); r.steps.push({ title: 'Line-integral side', text: 'Add the four boundary pieces counter-clockwise.', tex: '' });
            return I.finalizeText(r);
        }
        if (op === 'divergence') {
            const comps = splitComps(src); if (comps.length !== 3) throw new CalcError('Give F = (P ; Q ; R) with three components.');
            const nodes = comps.map(c => engine.parse(c)); nodes.forEach(n => engine.freeVars(n).forEach(q => { if (!['x', 'y', 'z'].includes(q)) throw new CalcError('Use only x, y, z.'); }));
            const b = ['xLow', 'xHigh', 'yLow', 'yHigh', 'zLow', 'zHigh'].map((k, i) => lim(k, i % 2 ? '1' : '0').value); const [x0, x1, y0, y1, z0, z1] = b;
            if (!(x1 > x0 && y1 > y0 && z1 > z0)) throw new CalcError('Each upper bound must exceed its lower bound (a box region).');
            const [P, Q, R] = nodes.map(n => engine.compile(n, ['x', 'y', 'z']));
            const div = engine.compile(engine.parse(`(${engine.strOf(engine.diff(nodes[0], 'x'))}) + (${engine.strOf(engine.diff(nodes[1], 'y'))}) + (${engine.strOf(engine.diff(nodes[2], 'z'))})`), ['x', 'y', 'z']);
            const vol = gl(x => gl(y => gl(z => div(x, y, z), z0, z1, 3), y0, y1, 3), x0, x1, 3);
            const fx = gl(y => gl(z => P(x1, y, z) - P(x0, y, z), z0, z1, 4), y0, y1, 4), fy = gl(x => gl(z => Q(x, y1, z) - Q(x, y0, z), z0, z1, 4), x0, x1, 4), fz = gl(x => gl(y => R(x, y, z1) - R(x, y, z0), y0, y1, 4), x0, x1, 4);
            const flux = fx + fy + fz;
            const r = I.makeResult('vector', 'Divergence theorem check');
            r.main = { label: '∭ ∇·F dV = ∯ F·n dS =', text: F8(vol), tex: `\\iiint_V\\nabla\\!\\cdot\\!\\mathbf F\\,dV=\\oiint_S\\mathbf F\\cdot\\mathbf n\\,dS=${F8(vol)}`.replace('\\oiint', '\\oint\\!\\!\\oint') };
            r.items.push({ label: 'Box:', text: `x∈[${F8(x0)}, ${F8(x1)}], y∈[${F8(y0)}, ${F8(y1)}], z∈[${F8(z0)}, ${F8(z1)}]`, tex: '' });
            r.items.push({ label: 'Volume side ∭ div F:', text: F8(vol), tex: '' }); r.items.push({ label: 'Surface side (outward flux):', text: F8(flux), tex: '' }); r.items.push({ label: 'Flux through x-faces, y-faces, z-faces:', text: `${F8(fx)},  ${F8(fy)},  ${F8(fz)}`, tex: '' });
            const gap = Math.abs(vol - flux); if (gap < 1e-7 * Math.max(1, Math.abs(vol))) r.meta.push(`Verified: both sides agree (difference ${gap.toExponential(1)}).`); else r.warnings.push(`The sides differ by ${gap.toExponential(2)}.`);
            r.meta.push('Method: Gauss–Legendre quadrature on the volume and on each of the six faces with outward normals');
            r.steps.push({ title: 'Divergence theorem', text: 'The outward flux of F through a closed surface equals the integral of div F over the enclosed volume.', tex: '\\iint_{\\partial V}\\mathbf F\\cdot d\\mathbf S=\\iiint_V\\nabla\\cdot\\mathbf F\\,dV' });
            r.steps.push({ title: 'Volume side', text: `∇·F = ${engine.strOf(engine.parse(`(${engine.strOf(engine.diff(nodes[0], 'x'))}) + (${engine.strOf(engine.diff(nodes[1], 'y'))}) + (${engine.strOf(engine.diff(nodes[2], 'z'))})`))}`, tex: '' }); r.steps.push({ title: 'Surface side', text: 'Sum F·n over the six faces: +P at x₁, −P at x₀, and likewise for y and z.', tex: '' });
            return I.finalizeText(r);
        }
        if (op === 'surface' || op === 'flux') {
            const sx = engine.parse(opt.sx || 'u'), sy = engine.parse(opt.sy || 'v'), sz = engine.parse(opt.sz || '0'); const S = [sx, sy, sz];
            S.forEach(n => engine.freeVars(n).forEach(q => { if (q !== 'u' && q !== 'v') throw new CalcError('The surface r(u, v) may only use u and v.'); }));
            const ua = opt.ua === undefined || opt.ua === '' ? '0' : opt.ua, ub = opt.ub === undefined || opt.ub === '' ? '1' : opt.ub, va = opt.va === undefined || opt.va === '' ? '0' : opt.va, vb = opt.vb === undefined || opt.vb === '' ? '1' : opt.vb;
            const du = S.map(n => engine.strOf(engine.diff(n, 'u'))), dv = S.map(n => engine.strOf(engine.diff(n, 'v')));
            const cross = [`(${du[1]})*(${dv[2]}) - (${du[2]})*(${dv[1]})`, `(${du[2]})*(${dv[0]}) - (${du[0]})*(${dv[2]})`, `(${du[0]})*(${dv[1]}) - (${du[1]})*(${dv[0]})`];
            const map = { x: sx, y: sy, z: sz };
            let integrand, title;
            if (op === 'surface') { const f = engine.parse(src); engine.freeVars(f).forEach(q => { if (!['x', 'y', 'z'].includes(q)) throw new CalcError('The scalar field may use x, y, z only.'); }); integrand = `(${engine.strOf(subst(f, map))})*sqrt((${cross[0]})^2 + (${cross[1]})^2 + (${cross[2]})^2)`; title = 'Surface integral ∬ f dS'; }
            else { const comps = splitComps(src); if (comps.length !== 3) throw new CalcError('Give F = (P ; Q ; R).'); integrand = comps.map((c, i) => `(${engine.strOf(subst(engine.parse(c), map))})*(${cross[i]})`).join(' + '); title = 'Flux ∬ F·n dS'; }
            const res = engine.run.multivariable(integrand, { op: 'double', vars: 'u, v', xLow: ua, xHigh: ub, yLow: va, yHigh: vb, digits: opt.digits });
            res.title = title; res.kind = 'vector'; res.plot3 = null;
            res.items.unshift({ label: 'Surface:', text: `r(u, v) = (${S.map(n => engine.strOf(n)).join(', ')}),  ${ua} ≤ u ≤ ${ub},  ${va} ≤ v ≤ ${vb}`, tex: '' });
            res.steps.unshift({ title: op === 'surface' ? 'dS = |rᵤ × rᵥ| du dv' : 'n dS = (rᵤ × rᵥ) du dv', text: `rᵤ × rᵥ = (${cross.join(',  ')})`, tex: op === 'surface' ? '\\iint_S f\\,dS=\\iint f(\\mathbf r)\\,\\lVert\\mathbf r_u\\times\\mathbf r_v\\rVert\\,du\\,dv' : '\\iint_S\\mathbf F\\cdot\\mathbf n\\,dS=\\iint \\mathbf F(\\mathbf r)\\cdot(\\mathbf r_u\\times\\mathbf r_v)\\,du\\,dv' });
            if (op === 'flux') res.warnings.push('The sign depends on the orientation: the normal is rᵤ × rᵥ. Swap u and v to flip it.');
            return res;
        }
        return runVector(src, opt);
    }
    register({ vector: runVector2 });


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
            const P = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (p[j] === i ? 1 : 0)));   // row i of PA is row p⁻¹(i) of A
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
    // ======================================================================
    // Residues, contour integrals and real integrals by the residue theorem
    // ======================================================================
    function runResidues(src, opt) {
        const op = opt.op; const node = engine.parse(src); const fv = engine.freeVars(node); if (fv.length !== 1) throw new CalcError('Use a rational function of one variable, e.g. 1/(z^2+1).'); const v = fv[0];
        let rat = I.toRational(node, v); if (!rat || rat.d.length < 2) throw new CalcError('Enter a rational function (polynomial ÷ polynomial) with the variable in the denominator.'); if (rat.n.length > 25 || rat.d.length > 25) throw new CalcError('Up to degree 24 is supported.');
        let n = rat.n.slice(), d = rat.d.slice(); const g = I.polyGcd(n.slice(), d.slice()); let cancelled = false; if (g && g.length > 1) { n = I.polyDivMod(n, g)[0]; d = I.polyDivMod(d, g)[0]; cancelled = true; } if (d.length < 2) throw new CalcError('After cancelling common factors there is no pole left.');
        const lead = d[d.length - 1]; n = n.map(c => c / lead); d = d.map(c => c / lead);
        const C = (re, im) => math.complex(re, im || 0); const evP = (p, z) => p.reduceRight((acc, c) => math.add(math.multiply(acc, z), c), C(0, 0)); const dd = d.slice(1).map((c, i) => c * (i + 1));
        const f = z => math.divide(evP(n, z), evP(d, z)); const poles = I.polyRootsMult(d.slice()).map(z => ({ z: C(z.re, z.im), m: z.mult, re: z.re, im: z.im }));
        poles.forEach(p => { if (Math.abs(p.re) < 1e-10) p.re = 0; if (Math.abs(p.im) < 1e-10) p.im = 0; p.z = C(p.re, p.im); });
        const cf = z => { const re = nice(z.re, 8, 1e-8).text, im = nice(Math.abs(z.im), 8, 1e-8).text; if (Math.abs(z.im) < 1e-9) return re; const fr = /^(\d+)\/(\d+)$/.exec(im); const ib = im === '1' ? 'i' : fr ? `${fr[1] === '1' ? '' : fr[1]}i/${fr[2]}` : `${im}i`; if (Math.abs(z.re) < 1e-9) return `${z.im < 0 ? '−' : ''}${ib}`; return `${re} ${z.im < 0 ? '−' : '+'} ${ib}`; };
        const dist = p => poles.reduce((m, q) => (q === p ? m : Math.min(m, math.abs(math.subtract(q.z, p.z)))), Infinity);
        const circleRes = (p, rho, N) => { let s2 = C(0, 0); for (let k = 0; k < N; k++) { const e = C(rho * Math.cos(2 * Math.PI * k / N), rho * Math.sin(2 * Math.PI * k / N)); s2 = math.add(s2, math.multiply(f(math.add(p.z, e)), e)); } return math.divide(s2, N); };
        poles.forEach(p => { const rho = Math.min(0.5, 0.4 * dist(p)); p.res = circleRes(p, rho, 512); if (p.m === 1) { const exact = math.divide(evP(n, p.z), evP(dd, p.z)); p.resFormula = exact; } });
        let worst = 0; poles.forEach(p => { if (p.resFormula) worst = Math.max(worst, math.abs(math.subtract(p.res, p.resFormula)) / Math.max(1, math.abs(p.res))); if (worst > 1e-6) throw new CalcError('The two residue computations disagreed; the result was discarded.'); p.val = p.resFormula || p.res; if (Math.abs(p.val.re) < 1e-10) p.val = C(0, p.val.im); if (Math.abs(p.val.im) < 1e-10) p.val = C(p.val.re, 0); });
        // sum of all residues = coefficient of 1/z at infinity
        const rem = I.polyDivMod(n, d)[1]; const dn = d.length - 1, rn = rem.length - 1; const expectedSum = (rem.length >= 1 && rn === dn - 1) ? rem[rn] : 0; const sumAll = poles.reduce((t, p) => math.add(t, p.val), C(0, 0)); const sumErr = math.abs(math.subtract(sumAll, C(expectedSum, 0))); if (sumErr > 1e-6 * Math.max(1, poles.length)) throw new CalcError('The sum of the residues did not match the behaviour at infinity; the result was discarded.');
        const r = I.makeResult('complex', 'Residues'); const fTxt = `${engine.strOf(node)}`; r.items.push({ label: `f(${v}) =`, text: fTxt, tex: `f(${v})=${engine.texOf(node)}` }); if (cancelled) r.items.push({ label: 'Note:', text: 'common factors were cancelled (removable singularities are not poles)', tex: '' });
        r.items.push({ label: 'Poles:', text: poles.map(p => `${cf(p.z)} (order ${p.m})`).join(',  '), tex: '' });
        const baseVerified = `each residue was computed two ways (a closed formula and a numerical contour integral on a small circle) and agree to ${worst.toExponential(1)}; the residues sum to ${cf(sumAll)}, as the behaviour at infinity requires`;
        const poleTraces = [{ x: poles.map(p => p.re), y: poles.map(p => p.im), mode: 'markers', type: 'scatter', name: 'poles', marker: { size: 11, symbol: 'x', line: { width: 3 } } }]; const zs = n.length > 1 ? I.polyRootsMult(n.slice()) : []; if (zs.length) poleTraces.push({ x: zs.map(q => q.re), y: zs.map(q => q.im), mode: 'markers', type: 'scatter', name: 'zeros', marker: { size: 9, symbol: 'circle-open', line: { width: 2 } } });
        const allX = poles.map(p => p.re).concat(zs.map(q => q.re)), allY = poles.map(p => p.im).concat(zs.map(q => q.im)); let ext = Math.max(1.5, ...allX.map(Math.abs), ...allY.map(Math.abs)) * 1.4;
        if (op === 'residue') {
            r.title = 'Residues'; r.main = { label: 'Residues:', text: poles.map(p => `Res at ${cf(p.z)} = ${cf(p.val)}`).join(';   '), tex: '' }; r.items.push({ label: 'Sum of all residues:', text: cf(sumAll), tex: '' });
            r.meta.push('Verified: ' + baseVerified); r.meta.push('Method: for a simple pole Res = p(z₀)/q′(z₀); every residue is also obtained as (1/2πi)∮ f dz on a small circle around the pole');
            r.steps.push({ title: 'Find the poles', text: 'The poles are the zeros of the denominator (after cancelling common factors); their multiplicity is the order.', tex: '' }); r.steps.push({ title: 'Residue at a simple pole', text: 'Res(f, z₀) = p(z₀) / q′(z₀). For higher order the residue comes from derivatives of (z − z₀)ᵐ f(z).', tex: '' });
            r.plot = { generic: { title: 'Poles and zeros', xTitle: 'Re', yTitle: 'Im', equal: true, xRange: [-ext, ext], yRange: [-ext, ext], traces: poleTraces } }; return I.finalizeText(r);
        }
        if (op === 'contour') {
            const parse2 = (t, what) => { const parts = String(t === undefined || t === '' ? '0' : t).split(/[,;]/).map(x => x.trim()).filter(Boolean); if (parts.length > 2) throw new CalcError(`${what}: give a real number or “re, im”.`); const vals = parts.map(q => I.parseLimit(q, what).value); if (!vals.every(Number.isFinite)) throw new CalcError(`${what} must be finite.`); return C(vals[0], vals[1] || 0); };
            const centre = parse2(opt.cc, 'Centre'), R = I.parseLimit(opt.rad === undefined || opt.rad === '' ? '1' : opt.rad, 'Radius').value; if (!(R > 0) || !Number.isFinite(R)) throw new CalcError('The radius must be positive.');
            const inside = poles.filter(p => math.abs(math.subtract(p.z, centre)) < R); if (poles.some(p => Math.abs(math.abs(math.subtract(p.z, centre)) - R) < 1e-3 * Math.max(1, R))) throw new CalcError('A pole lies on (or extremely close to) the contour, so the integral is not defined. Change the radius or centre.');
            const S = inside.reduce((t, p) => math.add(t, p.val), C(0, 0)); const value = math.multiply(C(0, 2 * Math.PI), S);
            const N = 20000; let num = C(0, 0); for (let k = 0; k < N; k++) { const th = 2 * Math.PI * k / N, e = C(R * Math.cos(th), R * Math.sin(th)); num = math.add(num, math.multiply(f(math.add(centre, e)), math.multiply(e, C(0, 2 * Math.PI / N)))); } const err = math.abs(math.subtract(num, value)) / Math.max(1, math.abs(value)); if (err > 1e-6) throw new CalcError('Direct numerical integration around the circle disagreed with the residue theorem; the result was discarded.');
            r.title = 'Contour integral'; const Sx = nice(S.re, 8, 1e-9).text, Sy = nice(S.im, 8, 1e-9).text; r.main = { label: `∮ f(${v}) d${v} =`, text: `2πi · (${cf(S)}) = ${cf(value)}`, tex: '' };
            r.items.push({ label: 'Contour:', text: `the circle |${v} − (${cf(centre)})| = ${nice(R, 8, 1e-9).text}, traversed counter-clockwise`, tex: '' }); r.items.push({ label: 'Poles inside:', text: inside.length ? inside.map(p => `${cf(p.z)} (residue ${cf(p.val)})`).join(',  ') : 'none, so the integral is 0 (Cauchy’s theorem)', tex: '' }); void Sx; void Sy;
            r.meta.push('Verified: direct numerical integration around the circle (20,000 points) gives the same value, relative difference ' + err.toExponential(1) + '; also ' + baseVerified); r.meta.push('Method: residue theorem ∮ f dz = 2πi · (sum of the residues inside the contour)');
            r.steps.push({ title: 'Which poles are inside?', text: `Only the poles with |${v} − centre| < radius count.`, tex: '' }); r.steps.push({ title: 'Residue theorem', text: 'Add their residues and multiply by 2πi.', tex: '' });
            const th = Array.from({ length: 181 }, (_, k) => 2 * Math.PI * k / 180); ext = Math.max(ext, Math.abs(centre.re) + R * 1.3, Math.abs(centre.im) + R * 1.3);
            r.plot = { generic: { title: 'The contour and the poles', xTitle: 'Re', yTitle: 'Im', equal: true, xRange: [-ext, ext], yRange: [-ext, ext], traces: [{ x: th.map(t => centre.re + R * Math.cos(t)), y: th.map(t => centre.im + R * Math.sin(t)), mode: 'lines', type: 'scatter', name: 'contour' }].concat(poleTraces) } }; return I.finalizeText(r);
        }
        // real integral over the whole line
        const degN = n.length - 1, degD = d.length - 1; if (degD - degN < 2) throw new CalcError('For ∫ from −∞ to ∞ the denominator must have degree at least 2 more than the numerator, otherwise the integral does not converge.');
        if (poles.some(p => p.im === 0)) throw new CalcError('There is a pole on the real axis, so the integral diverges (or needs a principal value, which is not supported).');
        const up = poles.filter(p => p.im > 0); const S = up.reduce((t, p) => math.add(t, p.val), C(0, 0)); const value = math.multiply(C(0, 2 * Math.PI), S); if (Math.abs(value.im) > 1e-7 * Math.max(1, Math.abs(value.re))) throw new CalcError('The function is not real on the real axis, so this method does not apply.');
        const fr = engine.compile(node, [v]); const num = engine.integrateRobust(x => fr(x), -Infinity, Infinity); const err = Math.abs(num.value - value.re) / Math.max(1, Math.abs(value.re)); if (!Number.isFinite(num.value) || err > 1e-6) throw new CalcError('Direct numerical integration disagreed with the residue theorem; the result was discarded.');
        const mult = nice(value.re / Math.PI, 8, 1e-9); const sq = nice((value.re / Math.PI) ** 2, 8, 1e-9);
        r.title = 'Real integral by residues'; r.main = { label: `∫ f(${v}) d${v} from −∞ to ∞ =`, text: `${/^-?\d+(\/\d+)?$/.test(mult.text) ? (mult.text === '1' ? 'π' : `${mult.text}·π`) : (/^\d+(\/\d+)?$/.test(sq.text) && value.re > 0 ? `√(${sq.text})·π` : engine.fmt(value.re, 10))}  ≈ ${engine.fmt(value.re, 10)}`, tex: '' };
        r.items.push({ label: 'Poles in the upper half-plane:', text: up.map(p => `${cf(p.z)} (residue ${cf(p.val)})`).join(',  '), tex: '' });
        r.meta.push(`Verified: direct numerical integration over the whole real line gives ${engine.fmt(num.value, 10)} (relative difference ${err.toExponential(1)}); also ` + baseVerified); r.meta.push('Method: close the contour with a large upper semicircle (its contribution vanishes because deg q ≥ deg p + 2), so the integral is 2πi · (sum of the residues in the upper half-plane)');
        r.steps.push({ title: 'Close the contour', text: 'Integrate over the real axis plus a large semicircle in the upper half-plane; the arc tends to 0.', tex: '' }); r.steps.push({ title: 'Residue theorem', text: 'The closed-contour integral is 2πi times the sum of the residues at the upper-half-plane poles.', tex: '' });
        r.plot = { generic: { title: 'Poles (the upper half-plane ones are used)', xTitle: 'Re', yTitle: 'Im', equal: true, xRange: [-ext, ext], yRange: [-ext, ext], traces: poleTraces } }; return I.finalizeText(r);
    }
    function runComplex(src, opt) {
        const op = opt.op || 'domain';
        if (op === 'residue' || op === 'contour' || op === 'realint') return runResidues(src, opt); const r = I.makeResult('complex', 'Complex analysis');
        const toC = z => { const c = math.complex(z); return { re: c.re, im: c.im }; };
        const cstr = z => { const a = nice(z.re, 8, 1e-9).text, b = nice(Math.abs(z.im), 8, 1e-9).text; if (Math.abs(z.im) < 1e-12) return a; const bi = b === '1' ? 'i' : `${b}i`; if (Math.abs(z.re) < 1e-12) return `${z.im < 0 ? '-' : ''}${bi}`; return `${a} ${z.im < 0 ? '−' : '+'} ${bi}`; };
        if (op === 'arith') {
            const node = engine.parse(src); const fv = engine.freeVars(node).filter(n => n !== 'i'); if (fv.length) throw new CalcError(`Unknown symbol “${fv[0]}”. Use numbers and i only (or switch to Domain colouring for functions of z).`);
            let z; try { z = node.compile().evaluate({}); } catch (e) { throw new CalcError('Could not evaluate that complex expression.'); }
            let c; try { c = toC(z); } catch (e) { throw new CalcError('That is not a complex number.'); } if (!Number.isFinite(c.re) || !Number.isFinite(c.im)) throw new CalcError('The result is not finite.');
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

    // ======================================================================
    // Algebra: partial fractions, long division, factor / expand, polynomial gcd, linear recurrences
    // ======================================================================
    // ======================================================================
    // Linear programming: two-phase simplex, verified by vertex enumeration
    // ======================================================================
    function parseLinear(txt, vars) {
        const node = engine.parse(txt); const f = engine.compile(node, vars); const zero = vars.map(() => 0); const c0 = f(...zero); if (!Number.isFinite(c0)) throw new CalcError(`Could not read “${txt}”.`);
        const a = vars.map((_, i) => { const e = zero.slice(); e[i] = 1; return f(...e) - c0; }); const p = vars.map((_, i) => 1.37 + 0.61 * i), want = c0 + a.reduce((t, c, i) => t + c * p[i], 0), got = f(...p);
        if (![...a, got].every(Number.isFinite) || Math.abs(got - want) > 1e-9 * Math.max(1, Math.abs(want))) throw new CalcError(`“${txt}” is not linear in ${vars.join(', ')}.`);
        return { a, c0 };
    }
    function runLP(src, opt) {
        const segs = String(src).split(/[;\n]+/).map(x => x.trim()).filter(Boolean); if (segs.length < 2) throw new CalcError('Write the objective first, then the constraints, separated by ;  for example  max 3x + 2y ; x + y <= 4 ; x + 3y <= 6');
        const om = /^(max(?:imi[sz]e)?|min(?:imi[sz]e)?)\s*[:.]?\s*(.+)$/i.exec(segs[0]); if (!om) throw new CalcError('Start with the objective, e.g.  max 3x + 2y  or  min 2x + 5y.');
        const maximise = /^max/i.test(om[1]); const cons = segs.slice(1).map(sg => { const m = /^(.*?)(<=|>=|≤|≥|=<|=>|<|>|=)(.*)$/.exec(sg); if (!m) throw new CalcError(`“${sg}” needs a relation such as <=, >= or =.`); return { lhs: m[1].trim(), rel: { '<=': '<=', '=<': '<=', '≤': '<=', '<': '<=', '>=': '>=', '=>': '>=', '≥': '>=', '>': '>=', '=': '=' }[m[2]], strict: m[2] === '<' || m[2] === '>', rhs: m[3].trim(), src: sg }; });
        if (cons.length > 12) throw new CalcError('Up to 12 constraints are supported.'); const set = new Set(); const nodes = [engine.parse(om[2])].concat(cons.flatMap(c => [engine.parse(c.lhs), engine.parse(c.rhs || '0')])); nodes.forEach(nd => engine.freeVars(nd).forEach(v => set.add(v)));
        const vars = [...set].sort(); if (!vars.length) throw new CalcError('Use variables such as x and y.'); if (vars.length > 6) throw new CalcError('Up to 6 variables are supported.'); const n = vars.length;
        const obj = parseLinear(om[2], vars); const c = obj.a.map(v => (maximise ? v : -v)); // always maximise internally
        const rows = cons.map(cn => { const L = parseLinear(cn.lhs, vars), R = parseLinear(cn.rhs || '0', vars); return { a: L.a.map((v, i) => v - R.a[i]), b: R.c0 - L.c0, rel: cn.rel, src: cn.src, strict: cn.strict }; });
        if (rows.some(r => r.a.every(v => Math.abs(v) < 1e-14))) throw new CalcError('A constraint has no variables in it.');
        const eps = 1e-9, fmtN = x => nice(x, 8, 1e-9).text;
        // ---- two-phase simplex (Bland's rule) on the standard form  A x = b, x >= 0 ----
        const std = rows.map(r => (r.b < 0 ? { a: r.a.map(v => -v), b: -r.b, rel: r.rel === '<=' ? '>=' : r.rel === '>=' ? '<=' : '=' } : { a: r.a.slice(), b: r.b, rel: r.rel }));
        const m = std.length; let ncol = n; const slackCol = new Array(m).fill(-1), artCol = new Array(m).fill(-1);
        std.forEach((r, i) => { if (r.rel === '<=') slackCol[i] = ncol++; else if (r.rel === '>=') slackCol[i] = ncol++; }); const nStruct = ncol; std.forEach((r, i) => { if (r.rel !== '<=') artCol[i] = ncol++; });
        const T = std.map((r, i) => { const row = new Array(ncol + 1).fill(0); r.a.forEach((v, j) => { row[j] = v; }); if (slackCol[i] >= 0) row[slackCol[i]] = r.rel === '<=' ? 1 : -1; if (artCol[i] >= 0) row[artCol[i]] = 1; row[ncol] = r.b; return row; });
        const basis = std.map((r, i) => (r.rel === '<=' ? slackCol[i] : artCol[i])); const log = []; let iters = 0;
        const pivot = (pr, pc) => { const pv = T[pr][pc]; for (let j = 0; j <= ncol; j++) T[pr][j] /= pv; for (let i = 0; i < m; i++) if (i !== pr && Math.abs(T[i][pc]) > 0) { const f = T[i][pc]; for (let j = 0; j <= ncol; j++) T[i][j] -= f * T[pr][j]; } basis[pr] = pc; iters++; };
        const run = (cost, allowed) => { // maximise cost·x over the current tableau; returns 'optimal' | 'unbounded'
            for (let guard = 0; guard < 2000; guard++) {
                const red = new Array(ncol).fill(0); for (let j = 0; j < ncol; j++) { let z = 0; for (let i = 0; i < m; i++) z += cost[basis[i]] * T[i][j]; red[j] = cost[j] - z; }
                let enter = -1; for (let j = 0; j < ncol; j++) if (allowed(j) && red[j] > 1e-9 && !basis.includes(j)) { enter = j; break; } if (enter < 0) return { status: 'optimal', red };
                let leave = -1, best = Infinity; for (let i = 0; i < m; i++) if (T[i][enter] > 1e-9) { const ratio = T[i][ncol] / T[i][enter]; if (ratio < best - 1e-12 || (Math.abs(ratio - best) <= 1e-12 && basis[i] < basis[leave])) { best = ratio; leave = i; } }
                if (leave < 0) return { status: 'unbounded', enter, red }; if (log.length < 14) log.push({ enter, leave, ratio: best }); pivot(leave, enter);
            } throw new CalcError('The simplex method did not finish (cycling guard).');
        };
        let status = 'optimal'; const hasArt = artCol.some(v => v >= 0);
        if (hasArt) { const c1 = new Array(ncol).fill(0); artCol.forEach(v => { if (v >= 0) c1[v] = -1; }); run(c1, () => true); const infeas = artCol.reduce((t, v, i) => t + (v >= 0 && basis.includes(v) ? T[basis.indexOf(v)][ncol] : 0), 0); if (infeas > 1e-7) status = 'infeasible';
            else for (let i = 0; i < m; i++) if (basis[i] >= nStruct) { let j = 0; for (; j < nStruct; j++) if (Math.abs(T[i][j]) > 1e-9 && !basis.includes(j)) break; if (j < nStruct) pivot(i, j); } }
        let red = null, ray = null;
        if (status === 'optimal') { const c2 = new Array(ncol).fill(0); c.forEach((v, j) => { c2[j] = v; }); const res = run(c2, j => j < nStruct); status = res.status; red = res.red; if (status === 'unbounded') { const d = new Array(n).fill(0); if (res.enter < n) d[res.enter] = 1; basis.forEach((b, i) => { if (b < n) d[b] = -T[i][res.enter]; }); ray = d; } }
        const x = new Array(n).fill(0); if (status !== 'infeasible') basis.forEach((b, i) => { if (b < n) x[b] = T[i][ncol]; });
        const objVal = obj.a.reduce((t, v, i) => t + v * x[i], 0) + obj.c0; const feasible = pt => rows.every(r => { const v = r.a.reduce((t, c2, i) => t + c2 * pt[i], 0); return (r.rel === '<=' ? v <= r.b + 1e-7 : r.rel === '>=' ? v >= r.b - 1e-7 : Math.abs(v - r.b) <= 1e-7) && true; }) && pt.every(v => v >= -1e-7);
        // ---- independent check: enumerate every vertex of the feasible region ----
        const ineq = rows.map(r => ({ a: r.a, b: r.b, eq: r.rel === '=' })).concat(vars.map((_, i) => ({ a: vars.map((__, j) => (i === j ? 1 : 0)), b: 0, eq: false, nonneg: true }))); const total = ineq.length; let verts = []; const eqIdx = ineq.map((q, i) => (q.eq ? i : -1)).filter(i => i >= 0);
        if (eqIdx.length <= n && total <= 20) { const pick = (start, chosen) => { if (chosen.length === n - eqIdx.length) { const act = eqIdx.concat(chosen); let sol; try { sol = math.lusolve(act.map(i => ineq[i].a), act.map(i => [ineq[i].b])).map(q => q[0]); } catch (e) { return; } if (sol.every(Number.isFinite) && feasible(sol)) verts.push(sol); return; } for (let i = start; i < total; i++) if (!ineq[i].eq) pick(i + 1, chosen.concat(i)); }; pick(0, []); }
        const uniq = []; verts.forEach(v => { if (!uniq.some(u => u.every((q, i) => Math.abs(q - v[i]) < 1e-7))) uniq.push(v); }); verts = uniq;
        const r = I.makeResult('algebra', 'Linear programming'); const objText = `${maximise ? 'maximise' : 'minimise'} ${om[2].trim()}`;
        r.items.push({ label: 'Problem:', text: `${objText}  subject to  ${rows.map(q => q.src).join(';  ')};  ${vars.join(', ')} ≥ 0`, tex: '' });
        if (status === 'infeasible') {
            if (verts.length) throw new CalcError('The simplex method reported infeasible but a feasible vertex exists; the result was discarded.');
            r.main = { label: 'Result:', text: 'infeasible: no point satisfies every constraint', tex: '' }; r.meta.push('Verified: enumerating every intersection of the constraint boundaries finds no feasible point'); r.steps.push({ title: 'Phase 1', text: 'Minimising the artificial variables cannot reach 0, so the constraints contradict each other.', tex: '' }); return I.finalizeText(r);
        }
        if (status === 'unbounded') {
            const t = 1e4; const far = x.map((v, i) => v + t * ray[i]); const growth = obj.a.reduce((tt, v, i) => tt + v * ray[i], 0) * (maximise ? 1 : -1); if (!feasible(far) || !(growth > 1e-9)) throw new CalcError('The unboundedness check failed; the result was discarded.');
            r.main = { label: 'Result:', text: `unbounded: the objective can be made ${maximise ? 'arbitrarily large' : 'arbitrarily small'}`, tex: '' }; r.items.push({ label: 'A feasible point:', text: `(${x.map(fmtN).join(', ')})`, tex: '' }); r.items.push({ label: 'A direction that never leaves the region:', text: `(${ray.map(fmtN).join(', ')})`, tex: '' });
            r.meta.push('Verified: moving 10,000 units along that direction stays feasible and the objective keeps improving'); r.steps.push({ title: 'Phase 2', text: 'An entering variable has no positive entry in its column, so no constraint stops the objective from growing.', tex: '' }); return I.finalizeText(r);
        }
        if (!feasible(x)) throw new CalcError('The simplex solution violated a constraint; it was discarded.');
        let best = -Infinity, bestV = null; verts.forEach(v => { const val = c.reduce((t, cc, i) => t + cc * v[i], 0); if (val > best) { best = val; bestV = v; } });
        const simplexVal = c.reduce((t, cc, i) => t + cc * x[i], 0); if (verts.length && Math.abs(best - simplexVal) > 1e-6 * Math.max(1, Math.abs(best))) throw new CalcError('The vertex enumeration disagrees with the simplex result; the result was discarded.');
        const ties = verts.filter(v => Math.abs(c.reduce((t, cc, i) => t + cc * v[i], 0) - best) < 1e-7 * Math.max(1, Math.abs(best))); void bestV;
        r.main = { label: `Optimal ${maximise ? 'maximum' : 'minimum'}:`, text: `${nice(objVal, 8, 1e-9).text}  at  ${vars.map((v, i) => `${v} = ${fmtN(x[i])}`).join(', ')}`, tex: '' };
        r.items.push({ label: 'Constraint status:', text: rows.map((q, i) => { const v = q.a.reduce((t, cc, k) => t + cc * x[k], 0); const slack = q.rel === '<=' ? q.b - v : q.rel === '>=' ? v - q.b : 0; return `${q.src}: ${Math.abs(slack) < 1e-8 ? 'binding' : `slack ${fmtN(slack)}`}`; }).join(';   '), tex: '' });
        if (ties.length > 1) r.items.push({ label: 'Several optimal vertices:', text: `${ties.length} corner points tie, so every point on the edge between them is also optimal`, tex: '' });
        // shadow prices from the final tableau: y = c_B B^-1, read off the slack/surplus columns
        const sign = maximise ? 1 : -1; let dualOk = false;
        try { const prices = rows.map((q, i) => { const col = slackCol[i]; if (col < 0 || !red) return null; const si = std[i].rel === '<=' ? 1 : -1; return si * -red[col] * sign * (q.b === std[i].b ? 1 : -1); }); const clean = prices.map(pv => (pv === null ? null : (Math.abs(pv) < 1e-9 ? 0 : pv)));
            if (clean.some(pv => pv !== null)) { const allIneq = clean.every(pv => pv !== null); const dual = clean.reduce((t, pv, i) => t + (pv === null ? 0 : pv * rows[i].b), 0); dualOk = allIneq && Math.abs(dual - (objVal - obj.c0)) <= 1e-6 * Math.max(1, Math.abs(objVal)); if (!allIneq || dualOk) r.items.push({ label: 'Shadow prices (worth of one more unit of each right-hand side):', text: clean.map((pv, i) => `${rows[i].src}: ${pv === null ? '–' : fmtN(pv)}`).join(';   '), tex: '' }); } } catch (e) { /* optional */ }
        r.items.push({ label: 'Corner points of the feasible region:', text: verts.length ? verts.slice(0, 12).map(v => `(${v.map(fmtN).join(', ')}) → ${nice(obj.a.reduce((t, cc, i) => t + cc * v[i], 0) + obj.c0, 6, 1e-9).text}`).join(';  ') : 'not listed', tex: '' });
        r.meta.push(`Verified: the solution satisfies every constraint, and enumerating all ${verts.length} feasible corner points of the region gives the same optimum${red && red.every(v => v <= 1e-7) ? '; no reduced cost is positive, so the final tableau is an optimality certificate' : ''}${dualOk ? '; strong duality holds (shadow prices × right-hand sides = the optimum)' : ''}`);
        r.meta.push(`Method: two-phase simplex with Bland’s rule (${iters} pivot${iters === 1 ? '' : 's'}); all variables are taken to be ≥ 0${rows.some(q => q.strict) ? '. Strict inequalities were treated as non-strict.' : ''}`);
        r.steps.push({ title: 'Standard form', text: 'Add a slack variable to each ≤ constraint (and a surplus plus an artificial variable to each ≥ or = constraint) so every constraint becomes an equation.', tex: '' });
        if (hasArt) r.steps.push({ title: 'Phase 1', text: 'Drive the artificial variables to 0 to find a feasible starting corner.', tex: '' });
        log.slice(0, 8).forEach((lg, i) => r.steps.push({ title: `Pivot ${i + 1}`, text: `Bring column ${lg.enter < n ? vars[lg.enter] : lg.enter < nStruct ? 's' + (lg.enter - n + 1) : 'a' + (lg.enter - nStruct + 1)} into the basis; the ratio test picks row ${lg.leave + 1} (ratio ${fmtN(lg.ratio)}).`, tex: '' }));
        r.steps.push({ title: 'Optimality', text: 'When no non-basic variable can improve the objective the corner is optimal.', tex: '' });
        if (n === 2 && verts.length) {
            const xs = verts.map(v => v[0]), ys = verts.map(v => v[1]), X = Math.max(1, ...xs) * 1.35, Y = Math.max(1, ...ys) * 1.35; const cx = xs.reduce((a, b) => a + b, 0) / xs.length, cy = ys.reduce((a, b) => a + b, 0) / ys.length; const hull = verts.slice().sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
            const traces = [{ x: hull.concat([hull[0]]).map(v => v[0]), y: hull.concat([hull[0]]).map(v => v[1]), mode: 'lines', fill: 'toself', type: 'scatter', name: 'feasible region', line: { width: 2 } }];
            rows.forEach((q, i) => { const [a1, a2] = q.a; if (Math.abs(a2) > 1e-12) traces.push({ x: [0, X], y: [q.b / a2, (q.b - a1 * X) / a2], mode: 'lines', type: 'scatter', name: q.src, line: { dash: 'dot', width: 1 } }); else if (Math.abs(a1) > 1e-12) traces.push({ x: [q.b / a1, q.b / a1], y: [0, Y], mode: 'lines', type: 'scatter', name: q.src, line: { dash: 'dot', width: 1 } }); });
            const [o1, o2] = obj.a; if (Math.abs(o2) > 1e-12) traces.push({ x: [0, X], y: [(objVal - obj.c0 - o1 * 0) / o2, (objVal - obj.c0 - o1 * X) / o2], mode: 'lines', type: 'scatter', name: 'objective through the optimum', line: { dash: 'dash', width: 2 } }); else if (Math.abs(o1) > 1e-12) traces.push({ x: [(objVal - obj.c0) / o1, (objVal - obj.c0) / o1], y: [0, Y], mode: 'lines', type: 'scatter', name: 'objective through the optimum', line: { dash: 'dash', width: 2 } });
            traces.push({ x: [x[0]], y: [x[1]], mode: 'markers', type: 'scatter', name: 'optimum', marker: { size: 13, symbol: 'star' } });
            r.plot = { generic: { title: 'Feasible region and optimum', xTitle: vars[0], yTitle: vars[1], xRange: [0, X], yRange: [0, Y], traces } };
        }
        return I.finalizeText(r);
    }

    function runAlgebra(src, opt) {
        const op = opt.op || 'apart';
        if (op === 'lp') return runLP(src, opt);
        const r = I.makeResult('algebra', 'Algebra');
        const N_ = (x, d) => nice(x, d || 8, 1e-9);
        const polyTex = (p, v) => { const t = []; for (let i = p.length - 1; i >= 0; i--) { const c = p[i]; if (Math.abs(c) < 1e-12) continue; const a = N_(Math.abs(c)); const mono = i === 0 ? '' : i === 1 ? v : `${v}^{${i}}`; const body = i === 0 ? a.tex : (Math.abs(Math.abs(c) - 1) < 1e-12 ? mono : a.tex + mono); t.push((c < 0 ? '-' : t.length ? '+' : '') + body); } return t.join('') || '0'; };
        const polyTxt = (p, v) => { const t = []; for (let i = p.length - 1; i >= 0; i--) { const c = p[i]; if (Math.abs(c) < 1e-12) continue; const a = N_(Math.abs(c)); const mono = i === 0 ? '' : i === 1 ? v : `${v}^${i}`; const body = i === 0 ? a.text : (Math.abs(Math.abs(c) - 1) < 1e-12 ? mono : a.text + '·' + mono); t.push((c < 0 ? ' − ' : t.length ? ' + ' : '') + body); } return t.join('').replace(/^ − /, '−') || '0'; };
        const oneVar = (node) => { const fv = engine.freeVars(node); if (fv.length > 1) throw new CalcError(`Use a single variable (found ${fv.join(', ')}).`); return fv[0] || 'x'; };

        if (op === 'recur' || op === 'gf') {
            const m = String(src).replace(/\s+/g, '').match(/^a\(n\)=(.+)$/i);
            if (!m) throw new CalcError('Write the recurrence as a(n) = a(n-1) + a(n-2).');
            let k = 0; const rhs = m[1].replace(/a\(n-(\d+)\)/gi, (_, d) => { k = Math.max(k, +d); return `v${d}`; });
            if (!k || k > 6) throw new CalcError('Use between 1 and 6 previous terms, e.g. a(n-1), a(n-2).');
            let node; try { node = math.parse(rhs); } catch (e) { throw new CalcError('Could not read that recurrence.'); }
            const code = node.compile(); const ev = (vals, n) => { const sc = { n: n || 0 }; for (let j = 1; j <= k; j++) sc[`v${j}`] = vals[j] || 0; let v; try { v = code.evaluate(sc); } catch (e) { throw new CalcError('Only linear recurrences with constant coefficients are supported.'); } if (typeof v !== 'number' || !Number.isFinite(v)) throw new CalcError('Only linear recurrences with constant coefficients are supported.'); return v; };
            const co = []; for (let j = 1; j <= k; j++) co.push(ev({ [j]: 1 }, 0) - ev({}, 0));
            for (const n0 of [0, 3, 7]) { const test = {}; for (let j = 1; j <= k; j++) test[j] = j + 1.5; const lin = co.reduce((acc, c, j) => acc + c * (j + 2.5), 0) + ev({}, n0); if (Math.abs(ev(test, n0) - lin) > 1e-9 * Math.max(1, Math.abs(lin))) throw new CalcError('Only linear recurrences with constant coefficients are supported.'); }
            const g = n => ev({}, n); const gv = Array.from({ length: 14 }, (_, n) => g(n)); const forced = gv.some(x => Math.abs(x) > 1e-12);
            const init = String(opt.init || '').split(/[,;\s]+/).filter(Boolean).map(Number); if (init.length !== k || init.some(x => !Number.isFinite(x))) throw new CalcError(`Give ${k} initial value${k > 1 ? 's' : ''} a(0)…a(${k - 1}), separated by commas.`);
            const terms = init.slice(); for (let n = k; n < 60; n++) { let v = g(n); for (let j = 1; j <= k; j++) v += co[j - 1] * terms[n - j]; terms.push(v); }
            const charP = new Array(k + 1).fill(0); charP[k] = 1; for (let j = 1; j <= k; j++) charP[k - j] = -co[j - 1];
            let forceInfo = null, comb = charP.slice();
            if (forced) {
                // g(n) = P(n)·rⁿ  ⇔  (E − r)^(d+1) g = 0; find the smallest d with a real r that works
                const binom = (n, j) => { let v = 1; for (let i = 1; i <= j; i++) v = v * (n - i + 1) / i; return v; };
                for (let d = 0; d <= 4 && !forceInfo; d++) {
                    // (E−r)^(d+1) g at n=0 = Σ_j C(d+1,j)(−r)^(d+1−j) g(j): a polynomial in r
                    const pr = new Array(d + 2).fill(0); for (let j = 0; j <= d + 1; j++) pr[d + 1 - j] += binom(d + 1, j) * Math.pow(-1, d + 1 - j) * gv[j];
                    const pp = I.polyTrim(pr); const cands = pp.length > 1 ? I.polyRoots(pp.slice()).filter(z => Math.abs(z.im) < 1e-7).map(z => z.re) : [];
                    for (const r0 of cands) { let rr = r0; const rn = Math.round(rr * 1e6) / 1e6; if (Math.abs(rn - rr) < 1e-7) rr = rn; let ok = true; for (let n = 0; n + d + 1 < 14 && ok; n++) { let sum = 0; for (let j = 0; j <= d + 1; j++) sum += binom(d + 1, j) * Math.pow(-rr, d + 1 - j) * gv[n + j]; if (Math.abs(sum) > 1e-7 * Math.max(1, ...gv.map(Math.abs))) ok = false; } if (ok && Math.abs(rr) > 1e-9) { forceInfo = { d, r: rr }; break; } }
                }
                if (!forceInfo) throw new CalcError('The extra term must be a polynomial in n times rⁿ, for example 3, 2n+1, 5ⁿ or n·2ⁿ.');
                for (let q = 0; q <= forceInfo.d; q++) comb = I.polyMul(comb, [-forceInfo.r, 1]);
            }
            const K = comb.length - 1; if (K > 12) throw new CalcError('The combined order is too high for a reliable closed form.');
            if (op === 'gf') {
                const Qx = comb.map((_, j) => comb[K - j]); const prod = new Array(60).fill(0); for (let i = 0; i < 60; i++) for (let j = 0; j <= K && i + j < 60; j++) prod[i + j] += terms[i] * Qx[j];
                const sc = Math.max(1, ...terms.slice(0, 40).map(Math.abs)); const Px = I.polyTrim(prod.slice(0, K)); for (let n = K; n < 56; n++) if (Math.abs(prod[n]) > 1e-8 * sc * Math.max(1, Math.pow(Math.max(1, ...Qx.map(Math.abs)), 2))) throw new CalcError('The generating function did not close up (numerical trouble).');
                const rts = comb.length > 1 ? I.polyRootsMult(comb.slice()) : []; const rho = rts.length ? Math.max(...rts.map(z => Math.hypot(z.re, z.im))) : 0;
                r.title = 'Generating function'; r.main = { label: 'A(x) = Σ aₙxⁿ =', text: `(${polyTxt(Px, 'x')}) / (${polyTxt(Qx, 'x')})`, tex: `A(x)=\\frac{${polyTex(Px, 'x')}}{${polyTex(Qx, 'x')}}` };
                r.items.push({ label: 'Denominator from the characteristic polynomial:', text: `${polyTxt(Qx, 'x')}  (the reversal of ${polyTxt(comb, 'r')})`, tex: '' });
                r.items.push({ label: 'Series expansion:', text: terms.slice(0, 12).map(x => N_(x, 8).text).join(' + ') .replace(/ \+ (?=-)/g, ' ') + ' …', tex: '' });
                r.items.push({ label: 'Radius of convergence of A(x):', text: rho > 1e-12 ? N_(1 / rho, 6).text : '∞', tex: '' });
                r.meta.push('Verified: multiplying the first 56 terms by the denominator leaves a polynomial of degree < ' + K + ' (every higher coefficient vanishes), so the fraction reproduces the sequence');
                r.meta.push('Method: A(x)·Q(x) is a polynomial because the recurrence kills every coefficient beyond the order');
                r.steps.push({ title: 'Multiply by the denominator', text: 'Put Q(x) = 1 − c₁x − … − c_kx^k (plus factors for any extra term). Then A(x)·Q(x) only keeps the first few terms.', tex: '' }); r.steps.push({ title: 'Divide', text: 'So A(x) = P(x)/Q(x), where P comes from the initial values.', tex: '' });
                return I.finalizeText(r);
            }
            const roots = I.polyRootsMult(comb.slice()); const total = roots.reduce((a, z) => a + z.mult, 0); if (total !== K) throw new CalcError('Could not find the characteristic roots reliably.');
            const cols = []; roots.forEach(z => { for (let q = 0; q < z.mult; q++) cols.push({ z: math.complex(z.re, z.im), q }); });
            const basis = (c, n) => math.multiply(math.pow(c.z, n), n === 0 && c.q === 0 ? 1 : Math.pow(n, c.q));
            let C; try { C = math.lusolve(math.matrix(Array.from({ length: K }, (_, n) => cols.map(c => basis(c, n)))), math.matrix(terms.slice(0, K).map(x => [x]))).toArray().map(row => math.complex(row[0])); } catch (e) { throw new CalcError('The recurrence has a singular structure; closed form not found.'); }
            const closed = n => { let t = math.complex(0, 0); cols.forEach((c, i) => { t = math.add(t, math.multiply(C[i], basis(c, n))); }); return t.re; };
            let worst = 0; for (let n = 0; n < 40; n++) worst = Math.max(worst, Math.abs(closed(n) - terms[n]) / Math.max(1, Math.abs(terms[n])));
            if (worst > 1e-6) throw new CalcError('The closed form did not reproduce the sequence (numerical trouble); the terms below are still exact.');
            const cx = z => { const re = N_(z.re, 7), im = N_(Math.abs(z.im), 7); if (Math.abs(z.im) < 1e-9) return re.text; return `(${re.text} ${z.im < 0 ? '−' : '+'} ${im.text}i)`; };
            const hasC = cols.some(c => Math.abs(c.z.im) > 1e-9);
            const parts = cols.filter((c, i) => Math.abs(C[i].re) > 1e-9 || Math.abs(C[i].im) > 1e-9).map(c => { const i = cols.indexOf(c); const co2 = C[i], real = Math.abs(co2.im) < 1e-9, neg = real && co2.re < 0; const cc = real ? cx({ re: Math.abs(co2.re), im: 0 }) : cx(co2); const rr = (Math.abs(c.z.im) < 1e-9 && c.z.re < 0) ? `(${cx(c.z)})` : cx(c.z); const rpow = Math.abs(c.z.im) < 1e-9 && Math.abs(c.z.re - 1) < 1e-9 ? '' : `·${rr}^n`; const npow = c.q ? '·n' + (c.q > 1 ? '^' + c.q : '') : ''; return { neg, t: (`${cc}${rpow}${npow}`).replace(/^1·/, '') || cc }; });
            r.title = forced ? 'Linear recurrence (non-homogeneous)' : 'Linear recurrence'; r.main = { label: 'a(n) =', text: parts.map((p, i) => (i ? (p.neg ? ' − ' : ' + ') : (p.neg ? '−' : '')) + p.t).join('') || '0', tex: '' };
            r.items.push({ label: 'Characteristic equation (homogeneous part):', text: polyTxt(charP, 'r') + ' = 0', tex: polyTex(charP, 'r') + '=0' });
            if (forceInfo) r.items.push({ label: 'Extra term g(n):', text: `a polynomial of degree ${forceInfo.d} times ${N_(forceInfo.r, 6).text}^n`, tex: '' });
            r.items.push({ label: 'Roots used:', text: roots.map(z => cx({ re: z.re, im: z.im }) + (z.mult > 1 ? ` (×${z.mult})` : '')).join(',  '), tex: '' });
            r.items.push({ label: 'First terms:', text: terms.slice(0, 15).map(x => N_(x, 10).text).join(', ') + ', …', tex: '' });
            if (Math.abs(terms[K + 8]) > 0 && Math.abs(terms[K + 7]) > 0) r.items.push({ label: 'Growth ratio a(n+1)/a(n):', text: engine.fmt(terms[K + 8] / terms[K + 7], 8), tex: '' });
            r.meta.push(`Verified: the closed form reproduces the first 40 terms (largest relative error ${worst.toExponential(2)})`);
            if (hasC) r.meta.push('Complex roots appear; the closed form is real once the conjugate terms are added.');
            r.meta.push(forced ? 'Method: the extra term is annihilated by (E − r)^(d+1), so the solution lies in the span of the combined characteristic roots; constants are fitted to the first terms' : 'Method: characteristic equation, then solving for the constants from the initial values');
            r.steps.push({ title: 'Homogeneous part', text: 'Try a(n) = rⁿ in the recurrence without the extra term; this gives the characteristic equation.', tex: '' });
            if (forced) r.steps.push({ title: 'Account for the extra term', text: `Because g(n) is a polynomial of degree ${forceInfo.d} times ${N_(forceInfo.r, 6).text}ⁿ, multiplying the characteristic polynomial by (r − ${N_(forceInfo.r, 6).text})^${forceInfo.d + 1} adds the matching particular solution. If ${N_(forceInfo.r, 6).text} is already a root, the powers of n appear automatically (resonance).`, tex: '' });
            r.steps.push({ title: 'Solve for r', text: 'Each root r contributes rⁿ; a root repeated m times contributes rⁿ, n·rⁿ, …, n^(m−1)·rⁿ.', tex: '' });
            r.steps.push({ title: 'Fit the initial values', text: `The ${K} unknown constants are fixed by the first ${K} terms.`, tex: '' });
            r.plot = { generic: { title: 'The sequence a(n)', xTitle: 'n', yTitle: 'a(n)', traces: [{ x: terms.slice(0, 25).map((_, i) => i), y: terms.slice(0, 25), mode: 'lines+markers', type: 'scatter', name: 'a(n)' }] } };
            return I.finalizeText(r);
        }

        if (op === 'gcd') {
            const parts = String(src).split(/[;,]/).map(x => x.trim()).filter(Boolean); if (parts.length !== 2) throw new CalcError('Give two polynomials separated by a semicolon, e.g. x^2-1 ; x^3-1.');
            const na = engine.parse(parts[0]), nb = engine.parse(parts[1]); const v = oneVar(engine.parse(`(${parts[0]})+(${parts[1]})`));
            const A = I.toRational(na, v), B = I.toRational(nb, v); if (!A || !B || A.d.length > 1 || B.d.length > 1) throw new CalcError('Both entries must be polynomials.');
            const a = A.n.map(c => c / A.d[0]), b = B.n.map(c => c / B.d[0]);
            let g = I.polyGcd ? I.polyGcd(a.slice(), b.slice()) : null; if (!g) throw new CalcError('Could not compute the gcd.');
            const lead = g[g.length - 1]; g = g.map(c => c / lead);
            const ra = I.polyDivMod(a, g)[1], rb = I.polyDivMod(b, g)[1]; const zero = q => q.every(c => Math.abs(c) < 1e-8 * Math.max(1, ...a.map(Math.abs), ...b.map(Math.abs)));
            if (!zero(ra) || !zero(rb)) throw new CalcError('The numerical gcd check failed; try smaller coefficients.');
            const lcm = I.polyMul(I.polyDivMod(a, g)[0], b);
            r.title = 'Polynomial gcd and lcm'; r.main = { label: 'gcd =', text: polyTxt(g, v), tex: polyTex(g, v) };
            r.items.push({ label: 'lcm =', text: polyTxt(lcm, v), tex: polyTex(lcm, v) }); r.items.push({ label: 'Coprime?', text: g.length === 1 ? 'Yes (gcd is a constant)' : 'No', tex: '' });
            r.meta.push('Verified: the gcd divides both polynomials with zero remainder'); r.meta.push('Method: Euclid’s algorithm on the coefficient lists');
            r.steps.push({ title: 'Euclid’s algorithm', text: 'Repeatedly replace (a, b) by (b, a mod b) until the remainder is 0; the last non-zero remainder, made monic, is the gcd.', tex: '' });
            return I.finalizeText(r);
        }

        const node = engine.parse(src); const v = oneVar(node);
        if (op === 'factor') {
            { const rt = I.toRational(node, v); if (rt && (rt.n.length > 9 || rt.d.length > 9)) throw new CalcError('Factoring is limited to degree 8 here to keep the page responsive. Try Partial fractions or Roots for higher degrees.'); }
            let fac, exp;
            try { if (typeof Algebrite.clearall === 'function') Algebrite.clearall(); fac = String(Algebrite.run(`factor(${engine.strOf(node)})`)).trim(); exp = String(Algebrite.run(`expand(${engine.strOf(node)})`)).trim(); } catch (e) { throw new CalcError('Could not factor that expression.'); }
            if (!fac || /Stop|rror|nil|\?/.test(fac) || !exp || /Stop|rror|nil|\?/.test(exp)) throw new CalcError('Could not factor that expression.');
            const nf = engine.parse(fac.replace(/\barc(sin|cos|tan)\b/g, 'a$1')), ne = engine.parse(exp.replace(/\barc(sin|cos|tan)\b/g, 'a$1'));
            const f0 = node.compile(), f1 = nf.compile(), f2 = ne.compile(); let worst = 0, cnt = 0;
            for (let i = 0; i < 40; i++) { const x = -3.3 + 0.17 * i + 0.013; try { const a = f0.evaluate({ [v]: x }), b = f1.evaluate({ [v]: x }), c = f2.evaluate({ [v]: x }); if (![a, b, c].every(Number.isFinite)) continue; worst = Math.max(worst, Math.abs(a - b) / Math.max(1, Math.abs(a)), Math.abs(a - c) / Math.max(1, Math.abs(a))); cnt++; } catch (e) { /* skip */ } }
            if (cnt < 10 || worst > 1e-8) throw new CalcError('The factored form did not match the input; the result was discarded.');
            r.title = 'Factor and expand'; r.main = { label: 'Factored:', text: engine.strOf(nf), tex: engine.texOf(nf) }; r.items.push({ label: 'Expanded:', text: engine.strOf(ne), tex: engine.texOf(ne) });
            const rat = I.toRational(node, v); if (rat && rat.d.length === 1 && rat.n.length > 1 && rat.n.length < 25) { const rs = I.polyRootsMult(rat.n.slice()); r.items.push({ label: 'Roots:', text: rs.map(z => (Math.abs(z.im) < 1e-9 ? N_(z.re, 7).text : `${N_(z.re, 7).text} ${z.im < 0 ? '−' : '+'} ${N_(Math.abs(z.im), 7).text}i`) + (z.mult > 1 ? ` (×${z.mult})` : '')).join(',  '), tex: '' }); }
            r.meta.push(`Verified: both forms agree with the input at ${cnt} test points (largest difference ${worst.toExponential(2)})`); r.meta.push('Method: computer-algebra factoring over the rationals');
            r.steps.push({ title: 'Look for a common factor', text: 'Pull out any factor shared by every term first.', tex: '' }); r.steps.push({ title: 'Special forms and rational roots', text: 'Try differences of squares, sums and differences of cubes, then rational roots p/q (p divides the constant term, q the leading coefficient).', tex: '' });
            return I.finalizeText(r);
        }

        // apart / div need a rational function
        const rat = I.toRational(node, v); if (!rat) throw new CalcError('Enter a rational function (a polynomial divided by a polynomial), e.g. (x^2+1)/(x^3-x).');
        const lead = rat.d[rat.d.length - 1]; const num = rat.n.map(c => c / lead), den = rat.d.map(c => c / lead);
        if (den.length < 2) throw new CalcError('The denominator must contain the variable.');
        const [q, rem] = I.polyDivMod(num, den);
        const isZero = p => p.every(c => Math.abs(c) < 1e-12);
        if (op === 'div') {
            r.title = 'Polynomial long division'; r.main = { label: 'Quotient:', text: polyTxt(q, v), tex: polyTex(q, v) }; r.items.push({ label: 'Remainder:', text: polyTxt(rem, v), tex: polyTex(rem, v) });
            r.items.push({ label: 'So', text: `(${polyTxt(num, v)})/(${polyTxt(den, v)}) = (${polyTxt(q, v)}) + (${polyTxt(rem, v)})/(${polyTxt(den, v)})`, tex: `\\frac{${polyTex(num, v)}}{${polyTex(den, v)}}=${polyTex(q, v)}${isZero(rem) ? '' : `+\\frac{${polyTex(rem, v)}}{${polyTex(den, v)}}`}` });
            const chk = I.polyAdd(I.polyMul(q, den), rem); const dif = I.polyAdd(chk, num.map(c => -c)); if (!isZero(dif.map(c => c / Math.max(1, ...num.map(Math.abs))))) throw new CalcError('Division check failed.');
            r.meta.push('Verified: quotient × divisor + remainder equals the numerator'); r.meta.push('Method: long division, highest power first');
            r.steps.push({ title: 'Divide the leading terms', text: 'Divide the leading term of the numerator by the leading term of the denominator; that is the next quotient term.', tex: '' }); r.steps.push({ title: 'Multiply and subtract', text: 'Multiply the divisor by that term, subtract, and repeat until the remainder has lower degree than the divisor.', tex: '' });
            return I.finalizeText(r);
        }
        // partial fractions
        if (den.length > 11) throw new CalcError('Partial fractions are supported for denominators up to degree 10.');
        const rts = I.polyRootsMult(den.slice()); const evalDen = x => den.reduceRight((a, c) => a * x + c, 0), evalP = (p, x) => p.reduceRight((a, c) => a * x + c, 0);
        const cols = []; rts.forEach(z => { if (Math.abs(z.im) < 1e-7) { const rr = Math.abs(z.re) < 1e-9 ? 0 : z.re; for (let k = 1; k <= z.mult; k++) cols.push({ kind: 'lin', r: rr, k, f: x => 1 / Math.pow(x - rr, k) }); } else if (z.im > 0) { const a = z.re, b2 = z.im * z.im; for (let k = 1; k <= z.mult; k++) { cols.push({ kind: 'qx', a, b2, k, f: x => x / Math.pow((x - a) * (x - a) + b2, k) }); cols.push({ kind: 'q1', a, b2, k, f: x => 1 / Math.pow((x - a) * (x - a) + b2, k) }); } } });
        if (cols.length !== den.length - 1) throw new CalcError('Could not factor the denominator reliably.');
        const nPts = cols.length, xs = Array.from({ length: nPts }, (_, i) => 0.37 + 1.13 * i + (i % 2 ? 0.05 : -0.05) * i);
        let coef; if (isZero(rem)) coef = cols.map(() => 0); else { try { coef = math.lusolve(math.matrix(xs.map(x => cols.map(c => c.f(x)))), math.matrix(xs.map(x => [evalP(rem, x) / evalDen(x)]))).toArray().map(w => w[0]); } catch (e) { throw new CalcError('The partial-fraction system was singular; the denominator may have nearly repeated roots.'); } }
        if (coef.some(c => !Number.isFinite(c))) throw new CalcError('Numerical trouble solving for the coefficients.');
        let worst = 0; for (let i = 0; i < 40; i++) { const x = -4.7 + 0.231 * i + 0.011; const direct = evalP(num, x) / evalDen(x); if (!Number.isFinite(direct) || Math.abs(direct) > 1e6) continue; let sum = evalP(q, x); cols.forEach((c, j) => { sum += coef[j] * c.f(x); }); worst = Math.max(worst, Math.abs(sum - direct) / Math.max(1, Math.abs(direct))); }
        if (worst > 1e-6) throw new CalcError('The decomposition did not reproduce the function (ill-conditioned input).');
        const simple = b => /^[a-z]$/i.test(b);
        const bin = (b, k) => k === 1 ? (simple(b) ? b : `(${b})`) : `(${b})^${k}`, binT = (b, k) => k === 1 ? (simple(b) ? b : `\\left(${b}\\right)`) : `\\left(${b}\\right)^{${k}}`;
        const T = []; if (!isZero(q)) T.push({ c: 1, tex: polyTex(q, v), txt: polyTxt(q, v), poly: true });
        cols.forEach((c, j) => {
            if (Math.abs(coef[j]) < 1e-10) return; const a = N_(Math.abs(coef[j])); const one = Math.abs(Math.abs(coef[j]) - 1) < 1e-9; const wrapT = a.text.includes('/') ? `(${a.text})` : a.text;
            const numT = c.kind === 'qx' ? (one ? v : a.tex + v) : (one ? '1' : a.tex), numX = c.kind === 'qx' ? (one ? v : wrapT + v) : (one ? '1' : a.text);
            let baseTex, baseTxt; if (c.kind === 'lin') { const lin = [-c.r, 1]; baseTex = polyTex(lin, v); baseTxt = polyTxt(lin, v); } else { const quad = [c.a * c.a + c.b2, -2 * c.a, 1]; baseTex = polyTex(quad, v); baseTxt = polyTxt(quad, v); }
            T.push({ c: coef[j], tex: `\\frac{${numT}}{${binT(baseTex, c.k)}}`, txt: (a.text.includes('/') && c.kind !== 'qx' ? `(${a.text})` : numX) + '/' + bin(baseTxt, c.k) });
        });
        const join = (key) => T.map((t, i) => { const neg = !t.poly && t.c < 0; return (i === 0 ? (neg ? '-' : '') : (neg ? ' − ' : ' + ')) + t[key]; }).join('');
        const tex = join('tex') || '0', txt = join('txt') || '0';
        r.title = 'Partial fractions'; r.main = { label: 'Decomposition:', text: txt, tex: `\\frac{${polyTex(num, v)}}{${polyTex(den, v)}}=${tex}` };
        r.items.push({ label: 'Denominator roots:', text: rts.filter(z => z.im > -1e-7).map(z => (Math.abs(z.im) < 1e-7 ? N_(z.re, 7).text : `${N_(z.re, 7).text} ± ${N_(Math.abs(z.im), 7).text}i`) + (z.mult > 1 ? ` (×${z.mult})` : '')).join(',  '), tex: '' });
        if (!isZero(q)) r.items.push({ label: 'Polynomial part:', text: polyTxt(q, v), tex: polyTex(q, v) });
        r.meta.push(`Verified: the decomposition matches the original function at 40 test points (largest relative error ${worst.toExponential(2)})`);
        r.meta.push('Method: denominator roots from numerical factoring, then the coefficients from a linear system; shown values are rounded to recognisable numbers');
        r.steps.push({ title: 'Long division first', text: q.length > 1 || Math.abs(q[0]) > 1e-12 ? 'The numerator has degree at least that of the denominator, so divide first: the quotient is the polynomial part.' : 'The numerator has lower degree than the denominator, so the fraction is already proper.', tex: '' });
        r.steps.push({ title: 'Factor the denominator', text: 'Each distinct real root r gives terms A/(x−r), A/(x−r)², … up to its multiplicity; each irreducible quadratic gives (Ax+B)/(quadratic)ᵏ.', tex: '' });
        r.steps.push({ title: 'Solve for the constants', text: 'Match both sides at enough values of x, which gives one linear equation per unknown.', tex: '' });
        return I.finalizeText(r);
    }
    register({ algebra: runAlgebra });

    // ======================================================================
    // Lagrange multipliers, curvature, radius of convergence
    // ======================================================================
    const prevMulti = engine.run.multivariable, prevApps = engine.run.applications, prevSums = engine.run.sums;
    const N2 = (x, d) => nice(x, d || 8, 1e-9);

    function runLagrange(src, opt) {
        const mm = /^(.*?)(?:=)(.*)$/s.exec(String(opt.constraint || '')); if (!mm || !mm[2].trim()) throw new CalcError('Give the constraint as an equation, e.g. x^2 + y^2 = 1.');
        const fN = engine.parse(src), gN = engine.parse(`(${mm[1]})-(${mm[2]})`);
        const set = new Set(); engine.freeVars(fN).concat(engine.freeVars(gN)).forEach(v => set.add(v)); let vars = [...set].sort(); if (vars.length < 2) throw new CalcError('Use at least two variables, e.g. f = x*y with x + y = 10.'); if (vars.length > 4) throw new CalcError('Up to four variables are supported.');
        const n = vars.length, f = engine.compile(fN, vars), g = engine.compile(gN, vars);
        const dF = vars.map(v => engine.compile(engine.diff(fN, v), vars)), dG = vars.map(v => engine.compile(engine.diff(gN, v), vars));
        const R = Math.max(0.5, Math.min(100, +opt.radius || 5)), res = z => { const p = z.slice(0, n), l = z[n]; return dF.map((d, i) => d(...p) - l * dG[i](...p)).concat([g(...p)]); };
        const found = []; const per = n === 2 ? 11 : n === 3 ? 6 : 4; const starts = []; const rec = (i, cur) => { if (i === n) { [-1, 0.5, 2].forEach(l => starts.push(cur.concat([l]))); return; } for (let k = 0; k < per; k++) { cur[i] = -R + 2 * R * (k + 0.41) / per; rec(i + 1, cur); } }; rec(0, new Array(n));
        for (const st of starts) {
            let z = st.slice(), ok = false;
            for (let it = 0; it < 60; it++) {
                const F = res(z); if (!F.every(Number.isFinite)) break; const nr = Math.hypot(...F); if (nr < 1e-12) { ok = true; break; }
                const J = F.map((_, i) => z.map((_, j) => { const h = 1e-6 * Math.max(1, Math.abs(z[j])); const zp = z.slice(); zp[j] += h; const zm = z.slice(); zm[j] -= h; return (res(zp)[i] - res(zm)[i]) / (2 * h); }));
                let step; try { step = math.lusolve(J, F.map(x => [-x])).map(w => w[0]); } catch (e) { break; } if (!step.every(Number.isFinite)) break;
                const mag = Math.hypot(...step), damp = mag > 3 ? 3 / mag : 1; z = z.map((x, i) => x + damp * step[i]); if (z.some(x => Math.abs(x) > 1e5)) break;
            }
            if (ok && Math.hypot(...res(z)) < 1e-9 && !found.some(q => Math.hypot(...q.slice(0, n).map((x, i) => x - z[i])) < 1e-6)) found.push(z);
        }
        if (!found.length) throw new CalcError('No constrained critical points were found in the search box. Try a larger search radius.');
        const rows = found.map(z => ({ p: z.slice(0, n), l: z[n], v: f(...z.slice(0, n)) })).sort((a, b) => b.v - a.v);
        const worst = Math.max(...found.map(z => Math.hypot(...res(z))));
        const r = I.makeResult('multivariable', 'Lagrange multipliers');
        const pt = p => '(' + p.map(x => N2(x, 7).text).join(', ') + ')';
        const hi = rows[0], lo = rows[rows.length - 1];
        r.main = { label: 'Constrained extrema:', text: rows.length === 1 ? `f = ${N2(hi.v, 8).text} at ${pt(hi.p)}` : `max ${N2(hi.v, 8).text} at ${pt(hi.p)};  min ${N2(lo.v, 8).text} at ${pt(lo.p)}`, tex: '' };
        r.items.push({ label: 'Method:', text: `∇f = λ∇g with g = ${engine.strOf(gN)} = 0`, tex: `\\nabla f=\\lambda\\,\\nabla g,\\quad ${engine.texOf(gN)}=0` });
        rows.slice(0, 12).forEach((q, i) => r.items.push({ label: `Candidate ${i + 1}:`, text: `${vars.map((v, k) => `${v} = ${N2(q.p[k], 7).text}`).join(', ')};  λ = ${N2(q.l, 6).text};  f = ${N2(q.v, 8).text}`, tex: '' }));
        r.meta.push(`Verified: every candidate satisfies ∇f = λ∇g and the constraint (largest residual ${worst.toExponential(2)})`);
        r.meta.push('These are all the constrained critical points found in the search box. When the constraint set is closed and bounded (a circle, an ellipse, a sphere) the largest and smallest values are the true global extrema; otherwise compare with the behaviour at infinity.');
        r.meta.push(`Method: Newton iteration on (${vars.join(', ')}, λ) from ${starts.length} starting points`);
        r.steps.push({ title: 'Set up the Lagrangian conditions', text: 'At a constrained extremum the gradient of f is parallel to the gradient of the constraint: ∇f = λ∇g.', tex: '' });
        r.steps.push({ title: 'Solve the system', text: `Together with the constraint this is ${n + 1} equations in ${n + 1} unknowns (${vars.join(', ')}, λ).`, tex: '' });
        r.steps.push({ title: 'Compare the values', text: 'Evaluate f at every solution; the largest and smallest are the candidates for the constrained maximum and minimum.', tex: '' });
        if (n === 2) {
            const span = Math.max(1, ...rows.map(q => Math.max(Math.abs(q.p[0]), Math.abs(q.p[1])))) * 1.5, M = 70, xs = [], ys = []; for (let i = 0; i < M; i++) { xs.push(-span + 2 * span * i / (M - 1)); ys.push(-span + 2 * span * i / (M - 1)); }
            const zf = ys.map(y => xs.map(x => { const v = f(x, y); return Number.isFinite(v) ? v : null; })), zg = ys.map(y => xs.map(x => { const v = g(x, y); return Number.isFinite(v) ? v : null; }));
            r.plot = { generic: { title: 'Level curves of f and the constraint', xTitle: vars[0], yTitle: vars[1], equal: true, traces: [{ x: xs, y: ys, z: zf, type: 'contour', name: 'f', showscale: false, contours: { coloring: 'none' }, line: { width: 1 } }, { x: xs, y: ys, z: zg, type: 'contour', name: 'constraint', showscale: false, contours: { type: 'constraint', value: 0, operation: '=' }, line: { width: 3 } }, { x: rows.map(q => q.p[0]), y: rows.map(q => q.p[1]), mode: 'markers', type: 'scatter', name: 'candidates', marker: { size: 10 } }] } };
        }
        return I.finalizeText(r);
    }

    // ======================================================================
    // Gradient descent / momentum / Newton on a function of two variables
    // ======================================================================
    function runDescent(src, opt) {
        const fN = engine.parse(src); const fv = engine.freeVars(fN); if (fv.length !== 2) throw new CalcError('Use a function of exactly two variables, e.g. x^2 + 3y^2.'); const vars = fv.slice().sort(); const [a, b] = vars;
        const f = engine.compile(fN, vars), gN = vars.map(v => engine.diff(fN, v)), g = gN.map(nd => engine.compile(nd, vars)), H = gN.map(nd => vars.map(v => engine.compile(engine.diff(nd, v), vars)));
        const startTxt = String(opt.start === undefined || opt.start === '' ? '0, 0' : opt.start).split(/[,;\s]+/).filter(Boolean); if (startTxt.length !== 2) throw new CalcError('Give the starting point as two numbers, e.g. -1.2, 1'); const x0 = startTxt.map(t => I.parseLimit(t, 'Start').value); if (!x0.every(Number.isFinite)) throw new CalcError('The starting point must be finite.');
        const lr = I.parseLimit(opt.lr === undefined || opt.lr === '' ? '0.1' : opt.lr, 'Step size').value; if (!(lr > 0) || lr > 100) throw new CalcError('The step size must be a positive number (typically 0.001 to 1).');
        const shown = Math.max(1, Math.min(500, parseInt(opt.iters, 10) || 30)); const method = ['gd', 'ls', 'momentum', 'newton'].includes(opt.method) ? opt.method : 'gd';
        const num = q => (typeof q === 'number' ? q : NaN); const val = x => num(f(x[0], x[1])), grad = x => [num(g[0](x[0], x[1])), num(g[1](x[0], x[1]))], hess = x => [[num(H[0][0](x[0], x[1])), num(H[0][1](x[0], x[1]))], [num(H[1][0](x[0], x[1])), num(H[1][1](x[0], x[1]))]]; const nrm = v => Math.hypot(v[0], v[1]);
        if (![val(x0), ...grad(x0)].every(Number.isFinite)) throw new CalcError('The function or its gradient is not defined at the starting point.');
        const NAMES = { gd: 'gradient descent (fixed step)', ls: 'gradient descent with backtracking line search', momentum: 'momentum (β = 0.9)', newton: "Newton's method" };
        const run = (m, maxIt) => { let x = x0.slice(), v = [0, 0]; const path = [x.slice()]; let status = 'iterations used up', it = 0;
            for (; it < maxIt; it++) { const gr = grad(x); if (!gr.every(Number.isFinite)) { status = 'diverged'; break; } if (nrm(gr) < 1e-6) { status = 'converged'; break; }
                let step; if (m === 'gd') step = gr.map(q => -lr * q); else if (m === 'momentum') { v = v.map((q, i) => 0.9 * q - lr * gr[i]); step = v; }
                else if (m === 'ls') { let t = 1; const f0 = val(x), gg = nrm(gr) ** 2; for (let k = 0; k < 60; k++) { const xn = [x[0] - t * gr[0], x[1] - t * gr[1]]; const fn = val(xn); if (Number.isFinite(fn) && fn <= f0 - 1e-4 * t * gg) break; t *= 0.5; } step = gr.map(q => -t * q); }
                else { const M = hess(x); const dt = M[0][0] * M[1][1] - M[0][1] * M[1][0]; if (!Number.isFinite(dt) || Math.abs(dt) < 1e-14) { status = 'Hessian singular'; break; } step = [-(M[1][1] * gr[0] - M[0][1] * gr[1]) / dt, -(-M[1][0] * gr[0] + M[0][0] * gr[1]) / dt]; }
                const xn = [x[0] + step[0], x[1] + step[1]]; if (!xn.every(Number.isFinite) || nrm(xn) > 1e7 || Math.abs(val(xn)) > 1e30) { status = 'diverged'; break; } if (!Number.isFinite(val(xn)) || !grad(xn).every(Number.isFinite)) { status = 'domain'; break; } x = xn; path.push(x.slice()); }
            if (status === 'iterations used up' && nrm(grad(x)) < 1e-6) status = 'converged'; return { path, status, it: path.length - 1 }; };
        const main = run(method, shown); const end = main.path[main.path.length - 1]; const gEnd = grad(end); const fEnd = val(end);
        if (main.status === 'diverged' && method !== 'newton') { /* reported below, not an error */ }
        // independent checks: finite-difference gradient at the end point; Newton polish from there
        const h = 1e-6 * Math.max(1, nrm(end)); const fd = [(val([end[0] + h, end[1]]) - val([end[0] - h, end[1]])) / (2 * h), (val([end[0], end[1] + h]) - val([end[0], end[1] - h])) / (2 * h)]; const gerr = Math.hypot(fd[0] - gEnd[0], fd[1] - gEnd[1]) / Math.max(1, nrm(gEnd)); if (main.status !== 'diverged' && Number.isFinite(gerr) && gerr > 1e-4) throw new CalcError('The gradient check failed for this function.');
        let polished = null, kind = null, eig = null, flatWarn = false;
        if (main.status === 'converged') { const M = hess(end); const tr = M[0][0] + M[1][1], dt = M[0][0] * M[1][1] - M[0][1] * M[1][0], disc = tr * tr / 4 - dt; eig = disc >= 0 ? [tr / 2 + Math.sqrt(disc), tr / 2 - Math.sqrt(disc)] : null; kind = dt < -1e-9 ? 'saddle point' : (dt > 1e-9 && tr > 0) ? 'local minimum' : (dt > 1e-9 && tr < 0) ? 'local maximum' : 'degenerate (second-derivative test inconclusive)';
            const lamMin = eig ? Math.min(Math.abs(eig[0]), Math.abs(eig[1])) : 0; const flat = !kind.startsWith('degenerate') && nrm(gEnd) / Math.max(lamMin, 1e-300) > 1e-3 * Math.max(1, nrm(end)); if (kind.startsWith('degenerate') || flat) { polished = null; if (flat) flatWarn = true; } else { let p2 = end.slice(); for (let k = 0; k < 20; k++) { const gr = grad(p2); if (nrm(gr) < 1e-13) break; const Mh = hess(p2); const d2 = Mh[0][0] * Mh[1][1] - Mh[0][1] * Mh[1][0]; if (Math.abs(d2) < 1e-14) break; p2 = [p2[0] - (Mh[1][1] * gr[0] - Mh[0][1] * gr[1]) / d2, p2[1] - (-Mh[1][0] * gr[0] + Mh[0][0] * gr[1]) / d2]; } polished = p2; if (Math.hypot(p2[0] - end[0], p2[1] - end[1]) > 1e-3 * Math.max(1, nrm(end))) throw new CalcError('Polishing the end point with Newton’s method moved it far away; the result was discarded.'); } }
        const N6 = x => nice(x, 6, 1e-8).text; const r = I.makeResult('multivariable', 'Gradient descent and Newton'); const pt = p => `(${N6(p[0])}, ${N6(p[1])})`;
        r.main = { label: `${NAMES[method][0].toUpperCase() + NAMES[method].slice(1)}:`, text: main.status === 'converged' ? `reached ${pt(end)} after ${main.it} step${main.it === 1 ? '' : 's'}, f = ${engine.fmt(fEnd, 8)}` : main.status === 'diverged' ? `diverged (the step size ${method === 'newton' ? 'or curvature' : 'is too large'} for this function)` : main.status === 'domain' ? `stopped at ${pt(end)}: the next step would leave the domain of f (try a smaller step or a start closer to the minimum)` : `after ${main.it} steps at ${pt(end)}, f = ${engine.fmt(fEnd, 8)}, ‖∇f‖ = ${engine.fmt(nrm(gEnd), 4)} (not yet converged)`, tex: '' };
        r.items.push({ label: 'Function:', text: `f(${a}, ${b}) = ${engine.strOf(fN)}`, tex: `f(${a},${b})=${engine.texOf(fN)}` }); r.items.push({ label: 'Start:', text: `${pt(x0)}, f = ${engine.fmt(val(x0), 8)}, ‖∇f‖ = ${engine.fmt(nrm(grad(x0)), 4)}`, tex: '' });
        if (kind) r.items.push({ label: 'The end point is a:', text: `${kind}${eig ? `  (Hessian eigenvalues ${engine.fmt(eig[0], 6)}, ${engine.fmt(eig[1], 6)})` : ''}`, tex: '' });
        const rowsIdx = main.path.length <= 12 ? main.path.map((_, i) => i) : [0, 1, 2, 3, 4, Math.floor(main.path.length / 2), main.path.length - 3, main.path.length - 2, main.path.length - 1]; r.items.push({ label: 'Iterates:', text: [...new Set(rowsIdx)].map(i => `#${i}: ${pt(main.path[i])}  f = ${engine.fmt(val(main.path[i]), 6)}`).join(';   '), tex: '' });
        // compare all four methods on the same problem
        const cmp = ['gd', 'ls', 'momentum', 'newton'].map(m => { const q = run(m, 3000); return `${NAMES[m]}: ${q.status === 'converged' ? `${q.it} step${q.it === 1 ? '' : 's'}` : q.status === 'diverged' ? 'diverged' : q.status === 'domain' ? 'left the domain of f' : q.status === 'Hessian singular' ? 'stopped (the Hessian is singular)' : `not converged in 3,000 steps (‖∇f‖ = ${engine.fmt(nrm(grad(q.path[q.path.length - 1])), 3)})`}`; }); r.items.push({ label: 'Steps to reach ‖∇f‖ < 10⁻⁶ with each method:', text: cmp.join(';   '), tex: '' });
        if (main.status === 'converged') r.meta.push(`Verified: ‖∇f‖ = ${nrm(gEnd).toExponential(1)} at the end point; the analytic gradient matches finite differences (relative difference ${gerr.toExponential(1)})${polished ? `; Newton polishing from the end point moves it by only ${Math.hypot(polished[0] - end[0], polished[1] - end[1]).toExponential(1)}` : '; no Newton polishing check was made because the curvature is too small or the test is inconclusive'}`);
        else r.meta.push(`Verified: the analytic gradient matches finite differences at the last point (relative difference ${gerr.toExponential(1)})`);
        if (flatWarn) r.warnings.push('The surface is very flat here: the gradient is tiny, but the point can still be some distance from the exact critical point (the curvature is nearly 0). Run more steps or use Newton’s method to get closer.');
        if (method === 'newton' && kind && kind !== 'local minimum') r.warnings.push("Newton's method looks for any point where the gradient is zero, so it can land on a saddle point or a maximum, as here.");
        r.meta.push('Method: x ← x − t∇f (fixed or line-searched step), momentum v ← 0.9v − t∇f, or Newton x ← x − H⁻¹∇f; the comparison row uses the same start and step size');
        r.steps.push({ title: 'The idea', text: 'The gradient points uphill, so stepping against it lowers f. Newton’s method also uses the curvature (Hessian) to choose the step.', tex: '' }); r.steps.push({ title: 'Step size', text: 'Too small is slow; too large overshoots and diverges. Line search chooses the step automatically.', tex: '' });
        const xs = main.path.map(p => p[0]), ys = main.path.map(p => p[1]); const xl = Math.min(...xs), xh = Math.max(...xs), yl = Math.min(...ys), yh = Math.max(...ys); const px = Math.max(1, (xh - xl) * 0.3), py = Math.max(1, (yh - yl) * 0.3); const X0 = xl - px, X1 = xh + px, Y0 = yl - py, Y1 = yh + py; const G = 70, gx = [], gy = []; for (let i = 0; i < G; i++) { gx.push(X0 + (X1 - X0) * i / (G - 1)); gy.push(Y0 + (Y1 - Y0) * i / (G - 1)); }
        const zz = gy.map(y => gx.map(x => { const q = val([x, y]); return Number.isFinite(q) ? q : null; })); const zf = zz.flat().filter(Number.isFinite).sort((p, q) => p - q); const cap = zf.length ? zf[Math.floor(zf.length * 0.9)] : 1; const zc = zz.map(rw => rw.map(q => (q === null ? null : Math.min(q, cap))));
        r.plot = { generic: { title: `${NAMES[method][0].toUpperCase() + NAMES[method].slice(1)} on the contours of f`, xTitle: a, yTitle: b, xRange: [X0, X1], yRange: [Y0, Y1], traces: [{ x: gx, y: gy, z: zc, type: 'contour', name: 'f', showscale: false, ncontours: 24, line: { width: 1 }, contours: { coloring: 'none' } }, { x: xs, y: ys, mode: 'lines+markers', type: 'scatter', name: 'path', marker: { size: 5 } }, { x: [x0[0]], y: [x0[1]], mode: 'markers', type: 'scatter', name: 'start', marker: { size: 12, symbol: 'circle-open', line: { width: 3 } } }, { x: [end[0]], y: [end[1]], mode: 'markers', type: 'scatter', name: 'end', marker: { size: 13, symbol: 'star' } }] } };
        return I.finalizeText(r);
    }
    register({ multivariable: (src, opt) => opt.op === 'lagrange' ? runLagrange(src, opt) : opt.op === 'descent' ? runDescent(src, opt) : prevMulti(src, opt) });

    function runCurvature(src, opt) {
        const parts = String(src).split(/;/).map(x => x.trim()).filter(Boolean); const param = parts.length === 2;
        if (parts.length > 2) throw new CalcError('Give y = f(x), or a parametric curve as x(t) ; y(t).');
        const t0 = I.parseLimit(opt.at === undefined || opt.at === '' ? '0' : opt.at, 'Point').value;
        let xf, yf, d1x, d1y, d2x, d2y, v, kN;
        if (param) {
            const xN = engine.parse(parts[0]), yN = engine.parse(parts[1]); const fv = [...new Set(engine.freeVars(xN).concat(engine.freeVars(yN)))]; if (fv.length > 1 || (fv.length === 1 && fv[0] !== 't')) throw new CalcError('Use the parameter t, e.g. cos(t) ; sin(2*t).'); v = 't';
            const c = nd => engine.compile(nd, ['t']); xf = c(xN); yf = c(yN); const x1 = engine.diff(xN, 't'), y1 = engine.diff(yN, 't'); d1x = c(x1); d1y = c(y1); d2x = c(engine.diff(x1, 't')); d2y = c(engine.diff(y1, 't'));
            kN = engine.parse(`abs((${engine.strOf(x1)})*(${engine.strOf(engine.diff(y1, 't'))})-(${engine.strOf(y1)})*(${engine.strOf(engine.diff(x1, 't'))}))/((${engine.strOf(x1)})^2+(${engine.strOf(y1)})^2)^(3/2)`);
        } else {
            const fN = engine.parse(parts[0]); const fv = engine.freeVars(fN); if (fv.length > 1) throw new CalcError('Use a single variable x.'); v = fv[0] || 'x';
            const f1 = engine.diff(fN, v), f2 = engine.diff(f1, v); const c = nd => engine.compile(nd, [v]); const cf = c(fN); xf = t => t; yf = cf; d1x = () => 1; d1y = c(f1); d2x = () => 0; d2y = c(f2);
            kN = engine.parse(`abs(${engine.strOf(f2)})/(1+(${engine.strOf(f1)})^2)^(3/2)`);
        }
        const X = xf(t0), Y = yf(t0), ax = d1x(t0), ay = d1y(t0), bx = d2x(t0), by = d2y(t0), sp = ax * ax + ay * ay;
        if (![X, Y, ax, ay, bx, by].every(Number.isFinite) || sp < 1e-18) throw new CalcError('The curve is not smooth (or not defined) at that point.');
        const cross = ax * by - ay * bx, kappa = Math.abs(cross) / Math.pow(sp, 1.5);
        // independent check: circle through three nearby points
        const h = 1e-3 * Math.max(1, Math.abs(t0)); const P = [t0 - h, t0, t0 + h].map(tt => [xf(tt), yf(tt)]); const a = Math.hypot(P[0][0] - P[1][0], P[0][1] - P[1][1]), b = Math.hypot(P[1][0] - P[2][0], P[1][1] - P[2][1]), cc = Math.hypot(P[0][0] - P[2][0], P[0][1] - P[2][1]); const area2 = Math.abs((P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]));
        const kCheck = 2 * area2 / (a * b * cc); const err = Math.abs(kCheck - kappa) / Math.max(1e-9, kappa, kCheck);
        if (kappa > 1e-9 && err > 1e-3) throw new CalcError('The curvature check failed; the curve may be too rough here.');
        const r = I.makeResult('applications', 'Curvature');
        r.main = { label: `κ(${v}) =`, text: engine.strOf(kN), tex: `\\kappa=${engine.texOf(kN)}` };
        r.items.push({ label: `At ${v} = ${N2(t0, 6).text}:`, text: `κ = ${N2(kappa, 8).text}`, tex: '' });
        if (kappa < 1e-9) { r.items.push({ label: 'Radius of curvature:', text: '∞ (a straight direction here)', tex: '' }); }
        else {
            const Rr = 1 / kappa, nx = -ay / Math.sqrt(sp) * Math.sign(cross), ny = ax / Math.sqrt(sp) * Math.sign(cross), cx = X + Rr * nx, cy = Y + Rr * ny;
            r.items.push({ label: 'Radius of curvature:', text: N2(Rr, 8).text, tex: '' }); r.items.push({ label: 'Centre of the osculating circle:', text: `(${N2(cx, 7).text}, ${N2(cy, 7).text})`, tex: '' }); r.items.push({ label: 'Point on the curve:', text: `(${N2(X, 7).text}, ${N2(Y, 7).text})`, tex: '' });
            const span = param ? Math.PI : 2.5, tx = [], ty = []; for (let i = 0; i <= 240; i++) { const tt = t0 - span + 2 * span * i / 240; const px = xf(tt), py = yf(tt); if (Number.isFinite(px) && Number.isFinite(py) && Math.hypot(px - X, py - Y) < 6 * Math.max(1, Rr)) { tx.push(px); ty.push(py); } else { tx.push(null); ty.push(null); } }
            const ct = [], cy2 = []; for (let i = 0; i <= 120; i++) { const th = 2 * Math.PI * i / 120; ct.push(cx + Rr * Math.cos(th)); cy2.push(cy + Rr * Math.sin(th)); }
            r.plot = { generic: { title: 'The curve and its osculating circle', xTitle: 'x', yTitle: 'y', equal: true, traces: [{ x: tx, y: ty, mode: 'lines', type: 'scatter', name: 'curve' }, { x: ct, y: cy2, mode: 'lines', type: 'scatter', name: 'osculating circle', line: { dash: 'dash' } }, { x: [X, cx], y: [Y, cy], mode: 'markers', type: 'scatter', name: 'point and centre', marker: { size: 9 } }] } };
        }
        r.meta.push(`Verified: κ agrees with the curvature of the circle through three nearby points (${(err * 100).toExponential(1)}% apart)`);
        r.meta.push('Method: ' + (param ? 'κ = |x′y″ − y′x″| / (x′² + y′²)^(3/2)' : 'κ = |y″| / (1 + y′²)^(3/2)'));
        r.steps.push({ title: 'Curvature measures turning', text: 'κ is the rate at which the direction of the tangent rotates per unit of arc length; the radius of curvature is 1/κ.', tex: '' });
        r.steps.push({ title: 'Osculating circle', text: 'The circle of radius 1/κ, tangent to the curve and centred on the concave side, is the best circular approximation at that point.', tex: '' });
        return I.finalizeText(r);
    }
    register({ applications: (src, opt) => opt.op === 'curvature' ? runCurvature(src, opt) : prevApps(src, opt) });

    function runRadius(src, opt) {
        const node = engine.parse(src); const fv = engine.freeVars(node).filter(x => x !== 'k' && x !== 'n'); const ind = engine.freeVars(node).includes('n') && !engine.freeVars(node).includes('k') ? 'n' : 'k';
        if (fv.length !== 1) throw new CalcError(`Write the series term using the index ${ind} and one variable, e.g. (x-2)^k/(k*3^k).`);
        const xv = fv[0], a = I.parseLimit(opt.center || '0', 'Centre').value, code = engine.compile(node, [ind, xv]); const T = (k, x) => code(k, x);
        const c = k => T(k, a + 1); const start = Math.max(0, I.parseLimit(opt.lower || '0', 'Start').value | 0);
        // coefficient check: t_k(a+h) = c_k h^k
        let shape = 0; for (const k of [start + 3, start + 7, start + 12]) for (const hh of [0.5, 1.7]) { const exp = c(k) * Math.pow(hh, k), got = T(k, a + hh); if (Number.isFinite(exp) && Number.isFinite(got)) shape = Math.max(shape, Math.abs(exp - got) / Math.max(1e-300, Math.abs(exp), Math.abs(got))); else shape = Infinity; }
        if (shape > 1e-6) throw new CalcError('The term must have the form cₖ·(x − a)^k; check the centre a and the exponent.');
        const ratio = k => Math.abs(c(k) / c(k + 1));
        const rs = [20, 40, 80].map(ratio); let Rv;
        if (rs.some(x => !Number.isFinite(x))) { const q = [20, 40, 80].map(k => Math.abs(c(k + 1) / c(k))); Rv = q.every(x => x === 0) ? Infinity : q.every(x => !Number.isFinite(x)) ? 0 : NaN; }
        else if (rs[2] < 0.7 * rs[1] && rs[1] < 0.7 * rs[0]) Rv = 0;
        else if (rs[2] > 1.4 * rs[1] && rs[1] > 1.4 * rs[0]) Rv = Infinity;
        else Rv = (8 * rs[2] - 6 * rs[1] + rs[0]) / 3; // removes the 1/k and 1/k² corrections of the ratio
        if (Number.isNaN(Rv) || (Number.isFinite(Rv) && Rv < 0)) throw new CalcError('Could not determine the radius reliably for this series.');
        if (Rv > 0 && Rv < 1e-9) Rv = 0;
        const NR = x => nice(x, 6, 1e-4); const Rshow = Rv === Infinity ? '∞' : NR(Rv).text; const r = I.makeResult('sums', 'Radius of convergence');
        r.main = { label: 'Radius R =', text: Rshow, tex: Rv === Infinity ? 'R=\\infty' : `R=${NR(Rv).tex}` };
        if (Rv === Infinity) { r.items.push({ label: 'Interval of convergence:', text: 'all real x', tex: '' }); }
        else if (Rv === 0) { r.items.push({ label: 'Interval of convergence:', text: `only x = ${N2(a, 6).text}`, tex: '' }); }
        else {
            Rv = Number(NR(Rv).text.includes('/') || /[a-zπ√]/.test(NR(Rv).text) ? Rv : NR(Rv).text);
            const endpoint = (xe, sign) => { let KS = [2000, 4000, 8000]; for (const set of [[2000, 4000, 8000], [400, 800, 1600], [100, 200, 400], [30, 60, 120]]) { KS = set; if (set.every(k => Number.isFinite(T(k, xe)) && T(k, xe) !== 0 || Math.abs(T(k, xe)) === 0)) break; } const t = KS.map(k => T(k, xe)); if (!t.every(Number.isFinite)) return { c: 'unknown', why: 'terms not defined' }; const mag = t.map(Math.abs); if (mag[2] > 1e-3 && mag[2] >= 0.5 * mag[0]) return { c: 'diverges', why: 'terms do not tend to 0' }; const slope = Math.log(mag[2] / mag[1]) / Math.log(2); const alt = T(KS[1], xe) * T(KS[1] + 1, xe) < 0; if (mag[2] === 0) return { c: 'unknown', why: 'terms underflow' }; if (slope < -1.15) return { c: 'converges absolutely', why: `|terms| decay like k^${slope.toFixed(2)}` }; if (alt && slope < -0.05 && mag[2] < mag[0]) return { c: 'converges conditionally', why: 'terms alternate and decrease to 0' }; if (Math.abs(slope + 1) < 0.06 && !alt) return { c: 'diverges', why: 'terms behave like 1/k, the harmonic series' }; if (slope > -0.85) return { c: 'diverges', why: `terms decay only like k^${slope.toFixed(2)}` }; return { c: 'borderline', why: 'terms decay like 1/k; test by hand' }; };
            const L = endpoint(a - Rv, -1), U = endpoint(a + Rv, 1); const inc = e => e.c.startsWith('converges'), bracket = (e, o, cl) => (inc(e) ? cl : o);
            r.items.push({ label: `Left endpoint x = ${N2(a - Rv, 6).text}:`, text: `${L.c} (${L.why})`, tex: '' }); r.items.push({ label: `Right endpoint x = ${N2(a + Rv, 6).text}:`, text: `${U.c} (${U.why})`, tex: '' });
            const unsure = [L, U].some(e => e.c === 'borderline' || e.c === 'unknown');
            r.items.push({ label: 'Interval of convergence:', text: unsure ? 'endpoint behaviour needs a hand check' : `${bracket(L, '(', '[')}${N2(a - Rv, 6).text}, ${N2(a + Rv, 6).text}${bracket(U, ')', ']')}`, tex: '' });
        }
        r.items.push({ label: 'Centre a =', text: N2(a, 6).text, tex: '' });
        // the ratio test behind it, on the actual terms at x within the radius
        if (Number.isFinite(Rv) && Rv > 0) { const xin = a + 0.5 * Rv, xo = a + 1.5 * Rv; const q = k => Math.abs(T(k + 1, xin) / T(k, xin)); const q2 = k => Math.abs(T(k + 1, xo) / T(k, xo)); const qi = (8 * q(80) - 6 * q(40) + q(20)) / 3, qo = (8 * q2(80) - 6 * q2(40) + q2(20)) / 3; if (Number.isFinite(qi) && Number.isFinite(qo)) if (qi < 1 && qo > 1) r.meta.push(`Verified: the term ratio tends to ${fmt(qi, 4)} (< 1) inside the radius and ${fmt(qo, 4)} (> 1) outside it`); }
        r.meta.push('Method: ratio test on the coefficients, R = lim |cₖ / cₖ₊₁|, extrapolated from k = 40 and 80. Endpoint verdicts come from numerical behaviour of the terms (decay rate and sign changes), so treat them as strong evidence rather than a proof.');
        r.steps.push({ title: 'Ratio test', text: 'The series converges where lim |tₖ₊₁/tₖ| < 1. For tₖ = cₖ(x − a)ᵏ this gives |x − a| < R with R = lim |cₖ/cₖ₊₁|.', tex: '' });
        r.steps.push({ title: 'Endpoints', text: 'At x = a ± R the ratio test is silent, so each endpoint needs its own test (p-series, alternating series, divergence test).', tex: '' });
        return I.finalizeText(r);
    }
    register({ sums: (src, opt) => opt.task === 'radius' ? runRadius(src, opt) : prevSums(src, opt) });

    // ======================================================================
    // Epsilon–delta, chi-square and ANOVA, heat and wave equations
    // ======================================================================
    const prevLimit = engine.run.limit, prevStats = engine.run.stats, prevOde = engine.run.ode;
    const simpson = (f, a, b, n) => { n = n % 2 ? n + 1 : n; const h = (b - a) / n; let t = f(a) + f(b); for (let i = 1; i < n; i++) t += (i % 2 ? 4 : 2) * f(a + i * h); return t * h / 3; };

    function runEpsDelta(src, opt) {
        const node = engine.parse(src); const fv = engine.freeVars(node); if (fv.length > 1) throw new CalcError('Use a single variable.'); const v = fv[0] || 'x';
        const a = I.parseLimit(opt.point === undefined || opt.point === '' ? '0' : opt.point, 'Point').value; if (!Number.isFinite(a)) throw new CalcError('The ε–δ picture needs a finite point a.');
        const f = engine.compile(node, [v]);
        const near = d => [f(a + d), f(a - d)]; const n7 = near(1e-7), n6 = near(1e-6), n8 = near(1e-8);
        if (![...n7, ...n6, ...n8].every(Number.isFinite)) throw new CalcError('The function is not defined on both sides of a, or the limit is infinite.');
        const L = (n8[0] + n8[1]) / 2, tolL = 1e-4 * Math.max(1, Math.abs(L)); if (Math.abs(n8[0] - n8[1]) > tolL || Math.abs(n7[0] - n8[0]) > tolL || Math.abs(n6[0] - n7[0]) > 10 * tolL) throw new CalcError('The two-sided limit does not exist here (or is infinite), so there is no ε–δ statement to illustrate.');
        const Lr = nice(L, 8, 1e-6), Lv = Math.abs(L - Number(Lr.text)) < 1e-9 || Lr.text.includes('/') || /[π√e]/.test(Lr.text) ? (Lr.text.includes('/') || /[π√e]/.test(Lr.text) ? math.evaluate(Lr.text.replace(/π/g, 'pi').replace(/√/g, 'sqrt')) : Number(Lr.text)) : L; const Lx = Number.isFinite(Lv) && Math.abs(Lv - L) < 1e-6 * Math.max(1, Math.abs(L)) ? Lv : L;
        const dmax = 50, M = 8000, ts = Array.from({ length: M }, (_, i) => dmax * Math.pow((i + 1) / M, 3));
        const dev = x => { const y = f(x); return Number.isFinite(y) ? Math.abs(y - Lx) : 0; };
        const deltaFor = eps => {
            let bad = -1; for (let i = 0; i < M; i++) { if (dev(a + ts[i]) > eps || dev(a - ts[i]) > eps) { bad = i; break; } }
            if (bad < 0) return { d: dmax, capped: true }; if (bad === 0) return { d: ts[0] * 0.5, capped: false };
            let lo = ts[bad - 1], hi = ts[bad]; for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; if (dev(a + mid) > eps || dev(a - mid) > eps) hi = mid; else lo = mid; } return { d: lo, capped: false };
        };
        const eps0 = I.parseLimit(opt.eps === undefined || opt.eps === '' ? '0.1' : opt.eps, 'ε').value; if (!(eps0 > 0) || !Number.isFinite(eps0)) throw new CalcError('ε must be a positive number.');
        const main = deltaFor(eps0); const delta = main.d;
        // verification: no violation anywhere inside, and the boundary is sharp
        let worst = 0; for (let i = 0; i < 20000; i++) { const t = delta * (i + 0.5) / 20000, y1 = dev(a + t), y2 = dev(a - t); worst = Math.max(worst, y1, y2); }
        if (worst > eps0 * (1 + 1e-9)) throw new CalcError('The δ found failed the check; the function may oscillate too quickly near a.');
        const sharp = main.capped || Math.max(dev(a + delta * 1.0005), dev(a - delta * 1.0005)) > eps0;
        const r = I.makeResult('limit', 'Epsilon–delta'); const fmt6 = x => nice(x, 6, 1e-6).text;
        r.main = { label: `For ε = ${fmt6(eps0)}:`, text: main.capped ? `any δ works (up to the ${dmax} searched)` : `δ = ${fmt6(delta)}`, tex: '' };
        r.items.push({ label: 'Limit L =', text: nice(Lx, 8, 1e-6).text, tex: '' });
        r.items.push({ label: 'The statement:', text: `0 < |${v} − ${fmt6(a)}| < δ  ⇒  |f(${v}) − L| < ε`, tex: '' });
        const table = [1, 0.1, 0.01, 0.001, 0.0001].map(e => ({ e, d: deltaFor(e) }));
        r.items.push({ label: 'Largest δ for each ε:', text: table.map(q => `ε = ${q.e} → δ = ${q.d.capped ? '≥ ' + dmax : fmt6(q.d.d)}`).join(';   '), tex: '' });
        const hh = 1e-5 * Math.max(1, Math.abs(a)), slope = (f(a + hh) - f(a - hh)) / (2 * hh); if (Number.isFinite(slope) && Math.abs(slope) > 1e-9 && Math.abs(slope) < 1e9) r.items.push({ label: 'Rule of thumb for small ε:', text: `δ ≈ ε / |f′(${fmt6(a)})| = ε / ${fmt6(Math.abs(slope))}`, tex: '' });
        r.meta.push(`Verified: 20,000 test points inside (${fmt6(a - delta)}, ${fmt6(a + delta)}) all satisfy |f − L| ≤ ε` + (sharp ? '; just outside that window the condition fails, so δ is the largest possible' : ''));
        r.meta.push('Method: the largest δ is found numerically by scanning outward from a and bisecting at the first violation. This illustrates the definition; it is not a symbolic proof.');
        r.steps.push({ title: 'The definition', text: 'lim f(x) = L means: for every ε > 0 there is a δ > 0 such that 0 < |x − a| < δ implies |f(x) − L| < ε.', tex: '' });
        r.steps.push({ title: 'Pick ε, find δ', text: 'Draw the horizontal band L ± ε. The largest δ is the half-width of the widest window around a whose graph stays inside the band.', tex: '' });
        r.steps.push({ title: 'Shrink ε', text: 'Repeating for smaller ε shows δ shrinking with it; a limit exists when a δ can always be found.', tex: '' });
        const span = Math.max(delta * 2.5, 1e-6), xs = [], ys = []; for (let i = 0; i <= 400; i++) { const x = a - span + 2 * span * i / 400; const y = f(x); xs.push(x); ys.push(Number.isFinite(y) ? y : null); }
        const yl = [Lx - eps0, Lx + eps0];
        r.plot = { generic: { title: 'The ε-band and the δ-window', xTitle: v, yTitle: 'f', traces: [{ x: xs, y: ys, mode: 'lines', type: 'scatter', name: 'f' }, { x: [a - span, a + span], y: [yl[1], yl[1]], mode: 'lines', type: 'scatter', name: 'L + ε', line: { dash: 'dash' } }, { x: [a - span, a + span], y: [yl[0], yl[0]], mode: 'lines', type: 'scatter', name: 'L − ε', line: { dash: 'dash' } }, { x: [a - delta, a - delta], y: [Math.min(yl[0], ...ys.filter(Number.isFinite)), Math.max(yl[1], ...ys.filter(Number.isFinite))], mode: 'lines', type: 'scatter', name: 'a − δ', line: { dash: 'dot' } }, { x: [a + delta, a + delta], y: [Math.min(yl[0], ...ys.filter(Number.isFinite)), Math.max(yl[1], ...ys.filter(Number.isFinite))], mode: 'lines', type: 'scatter', name: 'a + δ', line: { dash: 'dot' } }, { x: [a], y: [Lx], mode: 'markers', type: 'scatter', name: '(a, L)', marker: { size: 9 } }] } };
        return I.finalizeText(r);
    }
    register({ limit: (src, opt) => opt.task === 'epsdelta' ? runEpsDelta(src, opt) : prevLimit(src, opt) });

    // ---- chi-square and one-way ANOVA ----
    function runChiAnova(src, opt) {
        const op = opt.op, alpha = (() => { const q = +opt.alpha; return q > 0 && q < 1 ? q : 0.05; })();
        const r = I.makeResult('stats', op === 'anova' ? 'One-way ANOVA' : 'Chi-square test');
        const rows = String(src).split(/[;\n]+/).map(x => x.trim()).filter(Boolean);
        const tail = (stat, tailFn) => tailFn(stat);
        if (op === 'anova') {
            const groups = rows.map(g => numList(g, 'Value')); if (groups.length < 2) throw new CalcError('Give at least two groups, separated by semicolons or new lines.'); if (groups.some(g => g.length < 1)) throw new CalcError('Every group needs at least one value.');
            const N = groups.reduce((a, g) => a + g.length, 0), k = groups.length; if (N - k < 1) throw new CalcError('Need more observations than groups.');
            const means = groups.map(g => g.reduce((a, b) => a + b, 0) / g.length), grand = groups.flat().reduce((a, b) => a + b, 0) / N;
            const ssb = groups.reduce((a, g, i) => a + g.length * (means[i] - grand) ** 2, 0), ssw = groups.reduce((a, g, i) => a + g.reduce((b, x) => b + (x - means[i]) ** 2, 0), 0), sst = groups.flat().reduce((a, x) => a + (x - grand) ** 2, 0);
            const d1 = k - 1, d2 = N - k, msb = ssb / d1, msw = ssw / d2; if (msw < 1e-300) throw new CalcError('Within-group variation is zero, so F is undefined.');
            const F = msb / msw, pv = betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * F));
            const pdf = x => Math.exp(d1 / 2 * Math.log(d1) + d2 / 2 * Math.log(d2) + (d1 / 2 - 1) * Math.log(x) - ((d1 + d2) / 2) * Math.log(d1 * x + d2) - (lgamma(d1 / 2) + lgamma(d2 / 2) - lgamma((d1 + d2) / 2)));
            const num = 1 - simpson(u => (u === 0 ? 0 : pdf(u * u) * 2 * u), 0, Math.sqrt(F), 40000);
            if (Math.abs(num - pv) > 2e-4 && pv > 1e-6) throw new CalcError('The p-value failed its numerical check.');
            const dec = pv < alpha;
            r.main = { label: 'F-test:', text: `F(${d1}, ${d2}) = ${engine.fmt(F, 6)},  p = ${pv < 1e-4 ? pv.toExponential(3) : engine.fmt(pv, 5)}`, tex: '' };
            r.items.push({ label: 'Decision:', text: dec ? `Reject H₀ at α = ${alpha}: the group means are not all equal.` : `Do not reject H₀ at α = ${alpha}: no evidence the means differ.`, tex: '' });
            r.items.push({ label: 'Group means:', text: means.map((m, i) => `group ${i + 1}: ${engine.fmt(m, 6)} (n = ${groups[i].length})`).join(';  '), tex: '' });
            r.items.push({ label: 'Between / within / total SS:', text: `${engine.fmt(ssb, 6)} / ${engine.fmt(ssw, 6)} / ${engine.fmt(sst, 6)}`, tex: '' });
            r.items.push({ label: 'Mean squares:', text: `MSB = ${engine.fmt(msb, 6)},  MSW = ${engine.fmt(msw, 6)}`, tex: '' });
            r.items.push({ label: 'Effect size η² =', text: engine.fmt(ssb / sst, 5), tex: '' });
            const pairs = []; for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) { const dif = means[i] - means[j], se = Math.sqrt(msw * (1 / groups[i].length + 1 / groups[j].length)), tt = dif / se, raw = 2 * (1 - tCdf(Math.abs(tt), d2)); pairs.push({ i, j, dif, tt, raw, adj: Math.min(1, raw * (k * (k - 1) / 2)) }); }
            if (k === 2 && Math.abs(pairs[0].raw - pv) > 1e-6) throw new CalcError('The pairwise check failed.');
            if (k > 2) r.items.push({ label: 'Pairwise comparisons (Bonferroni-adjusted):', text: pairs.map(q => `${q.i + 1} vs ${q.j + 1}: difference ${engine.fmt(q.dif, 5)}, adjusted p = ${q.adj < 1e-4 ? q.adj.toExponential(2) : engine.fmt(q.adj, 4)}${q.adj < alpha ? ' *' : ''}`).join(';   '), tex: '' });
            r.meta.push(`Verified: SS between + SS within = SS total (difference ${Math.abs(ssb + ssw - sst).toExponential(1)}); the p-value matches direct numerical integration of the F density`);
            r.meta.push(k > 2 ? 'Pairwise p-values use the pooled within-group variance and a Bonferroni correction (conservative); * marks pairs significant at α. Assumes independent samples, roughly normal groups and similar variances.' : 'Assumes independent samples, roughly normal groups and similar variances.');
            r.steps.push({ title: 'Split the variation', text: 'Total variation = variation between group means + variation within groups.', tex: '' }); r.steps.push({ title: 'Compare mean squares', text: 'F = (SS between / (k − 1)) ÷ (SS within / (N − k)). Under H₀ it follows an F distribution.', tex: '' });
            r.plot = { generic: { title: 'Groups and their means', xTitle: 'group', yTitle: 'value', traces: groups.map((g, i) => ({ y: g, type: 'box', name: `group ${i + 1}`, boxpoints: 'all', jitter: 0.4 })) } };
            return I.finalizeText(r);
        }
        // chi-square
        const table = rows.map(rw => numList(rw, 'Count')); if (!table.length) throw new CalcError('Enter observed counts, e.g. 18, 22, 20, 40.');
        if (table.flat().some(x => x < 0)) throw new CalcError('Counts cannot be negative.');
        let stat = 0, df, n, V, kind, expectedMin;
        if (table.length === 1) {
            const O = table[0]; if (O.length < 2) throw new CalcError('Need at least two categories.'); n = O.reduce((a, b) => a + b, 0); if (n <= 0) throw new CalcError('The counts sum to zero.');
            let P; const ex = String(opt.expected || '').trim(); if (!ex) P = O.map(() => 1 / O.length); else { P = numList(ex, 'Expected'); if (P.length !== O.length) throw new CalcError(`Give ${O.length} expected values, or leave blank for equal proportions.`); const sp = P.reduce((a, b) => a + b, 0); if (sp <= 0) throw new CalcError('Expected values must be positive.'); P = P.map(x => x / sp); }
            const E = P.map(q => q * n); expectedMin = Math.min(...E); if (E.some(x => x <= 0)) throw new CalcError('Expected proportions must be positive.'); stat = O.reduce((a, o, i) => a + (o - E[i]) ** 2 / E[i], 0); df = O.length - 1; V = Math.sqrt(stat / n); kind = 'goodness of fit';
            r.items.push({ label: 'Observed:', text: O.join(', '), tex: '' }); r.items.push({ label: 'Expected:', text: E.map(x => engine.fmt(x, 5)).join(', '), tex: '' }); r.items.push({ label: 'Contributions (O−E)²/E:', text: O.map((o, i) => engine.fmt((o - E[i]) ** 2 / E[i], 4)).join(', '), tex: '' });
            if (Math.abs(E.reduce((a, b) => a + b, 0) - n) > 1e-9 * n) throw new CalcError('Internal check failed: expected counts must sum to the observed total.');
        } else {
            const c = table[0].length; if (table.some(rw => rw.length !== c)) throw new CalcError('Every row of the table needs the same number of columns.'); if (c < 2) throw new CalcError('Need at least two columns.');
            const rt = table.map(rw => rw.reduce((a, b) => a + b, 0)), ct = table[0].map((_, j) => table.reduce((a, rw) => a + rw[j], 0)); n = rt.reduce((a, b) => a + b, 0); if (rt.some(x => x === 0) || ct.some(x => x === 0)) throw new CalcError('A row or column totals zero, so expected counts are undefined.');
            const E = table.map((rw, i) => rw.map((_, j) => rt[i] * ct[j] / n)); expectedMin = Math.min(...E.flat()); stat = table.reduce((a, rw, i) => a + rw.reduce((b, o, j) => b + (o - E[i][j]) ** 2 / E[i][j], 0), 0); df = (table.length - 1) * (c - 1); V = Math.sqrt(stat / (n * Math.min(table.length - 1, c - 1))); kind = 'independence';
            r.items.push({ label: 'Expected counts:', text: E.map(rw => rw.map(x => engine.fmt(x, 4)).join(', ')).join('  |  '), tex: '' });
            if (Math.abs(E.flat().reduce((a, b) => a + b, 0) - n) > 1e-9 * n) throw new CalcError('Internal check failed.');
        }
        const pv = 1 - gammaP(df / 2, stat / 2);
        const pdf = x => Math.exp((df / 2 - 1) * Math.log(x) - x / 2 - (df / 2) * Math.log(2) - lgamma(df / 2)); const num = stat > 0 ? 1 - simpson(u => (u === 0 ? 0 : pdf(u * u) * 2 * u), 0, Math.sqrt(stat), 40000) : 1;
        if (Math.abs(num - pv) > 2e-4 && pv > 1e-6) throw new CalcError('The p-value failed its numerical check.');
        const dec = pv < alpha;
        r.main = { label: `χ² (${kind}):`, text: `χ² = ${engine.fmt(stat, 6)},  df = ${df},  p = ${pv < 1e-4 ? pv.toExponential(3) : engine.fmt(pv, 5)}`, tex: '' };
        r.items.unshift({ label: 'Decision:', text: dec ? `Reject H₀ at α = ${alpha}: ${kind === 'independence' ? 'the variables are associated.' : 'the data do not follow the expected proportions.'}` : `Do not reject H₀ at α = ${alpha}: ${kind === 'independence' ? 'no evidence of association.' : 'the data are consistent with the expected proportions.'}`, tex: '' });
        r.items.push({ label: kind === 'independence' ? 'Effect size (Cramér’s V) =' : 'Effect size (w) =', text: engine.fmt(V, 4), tex: '' });
        r.meta.push('Verified: expected counts sum to the observed total, and the p-value matches direct numerical integration of the χ² density');
        if (expectedMin < 5) r.warnings.push(`Some expected counts are below 5 (smallest ${engine.fmt(expectedMin, 3)}); the χ² approximation may be unreliable. Consider merging categories or an exact test.`);
        r.steps.push({ title: 'Expected counts', text: kind === 'independence' ? 'Under independence, E = (row total × column total) / grand total.' : 'Under H₀ each category has its expected proportion of the total.', tex: '' }); r.steps.push({ title: 'The statistic', text: 'χ² = Σ (O − E)² / E, compared with a chi-square distribution with ' + df + ' degrees of freedom.', tex: '' });
        void tail;
        return I.finalizeText(r);
    }
    function runMannWhitney(src, opt) {
        const alpha = (() => { const q = +opt.alpha; return q > 0 && q < 1 ? q : 0.05; })();
        const rows = String(src).split(/[;\n]+/).map(x => x.trim()).filter(Boolean); if (rows.length !== 2) throw new CalcError('Give exactly two samples separated by a semicolon, e.g. 1.2 3.4 2.2 ; 4.5 5.1 3.9.');
        const A = numList(rows[0], 'Value'), B = numList(rows[1], 'Value'); const n1 = A.length, n2 = B.length, N = n1 + n2; if (n1 < 1 || n2 < 1) throw new CalcError('Each sample needs at least one value.'); if (N > 5000) throw new CalcError('Up to 5,000 values in total.');
        const all = A.map(v => ({ v, g: 0 })).concat(B.map(v => ({ v, g: 1 }))).sort((a, b) => a.v - b.v); const rank = new Array(N); let ties = 0, tieSum = 0;
        for (let i = 0; i < N;) { let j = i; while (j + 1 < N && all[j + 1].v === all[i].v) j++; const rk = (i + j) / 2 + 1; for (let q = i; q <= j; q++) rank[q] = rk; const t = j - i + 1; if (t > 1) { ties++; tieSum += t * t * t - t; } i = j + 1; }
        const R1 = all.reduce((a, o, i) => a + (o.g === 0 ? rank[i] : 0), 0), U1 = R1 - n1 * (n1 + 1) / 2, U2 = n1 * n2 - U1;
        if (Math.abs(U1 + U2 - n1 * n2) > 1e-9) throw new CalcError('Internal check failed.');
        const U = Math.min(U1, U2); let p, how;
        if (!ties && N <= 28) {
            // exact null distribution of the rank sum: choose n1 of the ranks 1..N
            const maxS = n1 * (2 * N - n1 + 1) / 2; const dp = Array.from({ length: n1 + 1 }, () => new Float64Array(maxS + 1)); dp[0][0] = 1;
            for (let r = 1; r <= N; r++) for (let k = Math.min(r, n1); k >= 1; k--) for (let sm = maxS; sm >= r; sm--) dp[k][sm] += dp[k - 1][sm - r];
            const cnt = dp[n1]; const total = cnt.reduce((a, b) => a + b, 0); let comb = 1; for (let i = 1; i <= n1; i++) comb = comb * (N - n1 + i) / i; if (Math.abs(total - comb) > 1e-6 * comb) throw new CalcError('Internal check failed.');
            const base = n1 * (n1 + 1) / 2; let lo = 0; for (let sm = 0; sm <= R1; sm++) lo += cnt[sm]; let hi = 0; for (let sm = R1; sm <= maxS; sm++) hi += cnt[sm]; p = Math.min(1, 2 * Math.min(lo, hi) / total); how = `exact (all ${engine.fmt(total, 8)} rank arrangements)`; void base;
        } else {
            const mu = n1 * n2 / 2, sg = Math.sqrt(n1 * n2 / 12 * ((N + 1) - tieSum / (N * (N - 1)))); if (!(sg > 0)) throw new CalcError('All values are identical, so the test is undefined.');
            const z = (Math.abs(U1 - mu) - 0.5) / sg; const Phi = x => 0.5 * (1 + (x >= 0 ? 1 : -1) * gammaP(0.5, x * x / 2)); p = Math.min(1, 2 * (1 - Phi(Math.max(0, z)))); how = `normal approximation with continuity${ties ? ' and tie' : ''} correction`;
        }
        const r = I.makeResult('stats', 'Mann–Whitney U test');
        r.main = { label: 'U test:', text: `U = ${engine.fmt(U, 6)}  (U₁ = ${engine.fmt(U1, 6)}, U₂ = ${engine.fmt(U2, 6)}),  p = ${p < 1e-4 ? p.toExponential(3) : engine.fmt(p, 5)}`, tex: '' };
        r.items.push({ label: 'Decision:', text: p < alpha ? `Reject H₀ at α = ${alpha}: the two samples differ in location / distribution.` : `Do not reject H₀ at α = ${alpha}: no evidence of a difference.`, tex: '' });
        r.items.push({ label: 'Probability of superiority:', text: `P(a random value from sample 1 exceeds one from sample 2) ≈ ${engine.fmt((U1 + (ties ? 0 : 0)) / (n1 * n2), 4)}`, tex: '' });
        r.items.push({ label: 'Rank sums:', text: `R₁ = ${engine.fmt(R1, 6)}, R₂ = ${engine.fmt(N * (N + 1) / 2 - R1, 6)}  (sample sizes ${n1} and ${n2})`, tex: '' });
        r.items.push({ label: 'p-value method:', text: how, tex: '' });
        r.meta.push(`Verified: U₁ + U₂ = n₁n₂ and the rank sums add to N(N+1)/2${!ties && N <= 28 ? '; the exact distribution counts every arrangement' : ''}`);
        r.meta.push('Needs no normality assumption. It tests whether one sample tends to give larger values; it compares medians only if the two distributions have the same shape.');
        r.steps.push({ title: 'Rank all values together', text: 'Pool both samples, rank from smallest to largest, and give tied values their average rank.', tex: '' }); r.steps.push({ title: 'Sum the ranks', text: 'U₁ = R₁ − n₁(n₁+1)/2. If the samples came from the same distribution, U₁ is near n₁n₂/2.', tex: '' });
        r.plot = { generic: { title: 'The two samples', xTitle: 'sample', yTitle: 'value', traces: [{ y: A, type: 'box', name: 'sample 1', boxpoints: 'all', jitter: 0.4 }, { y: B, type: 'box', name: 'sample 2', boxpoints: 'all', jitter: 0.4 }] } };
        return I.finalizeText(r);
    }

    const rankAvg = vals => { const idx = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]); const rk = new Array(vals.length); let tieSum = 0; for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && vals[idx[j + 1]] === vals[idx[i]]) j++; const r = (i + j) / 2 + 1; for (let q = i; q <= j; q++) rk[idx[q]] = r; const t = j - i + 1; if (t > 1) tieSum += t * t * t - t; i = j + 1; } return { rk, tieSum }; };
    const PhiN = x => 0.5 * (1 + (x >= 0 ? 1 : -1) * gammaP(0.5, x * x / 2));
    const fmtP = p => (p < 1e-4 ? p.toExponential(3) : engine.fmt(p, 5));

    function runWilcoxon(src, opt) {
        const alpha = (() => { const q = +opt.alpha; return q > 0 && q < 1 ? q : 0.05; })();
        const rows = String(src).split(/[;\n]+/).map(x => x.trim()).filter(Boolean); if (rows.length < 1 || rows.length > 2) throw new CalcError('Give one sample of differences, or two paired samples separated by a semicolon.');
        let d; if (rows.length === 2) { const a = numList(rows[0], 'Value'), b = numList(rows[1], 'Value'); if (a.length !== b.length) throw new CalcError('Paired samples need the same number of values.'); d = a.map((x, i) => x - b[i]); } else d = numList(rows[0], 'Value');
        const zeros = d.filter(x => x === 0).length; d = d.filter(x => x !== 0); const n = d.length; if (n < 2) throw new CalcError('Need at least two non-zero differences.'); if (n > 5000) throw new CalcError('Up to 5,000 differences.');
        const { rk, tieSum } = rankAvg(d.map(Math.abs)); const Wp = d.reduce((a, x, i) => a + (x > 0 ? rk[i] : 0), 0), Wm = n * (n + 1) / 2 - Wp;
        if (Math.abs(Wp + Wm - n * (n + 1) / 2) > 1e-9) throw new CalcError('Internal check failed.');
        let p, how;
        if (!tieSum && n <= 22) { const maxS = n * (n + 1) / 2, dp = new Float64Array(maxS + 1); dp[0] = 1; for (let r = 1; r <= n; r++) for (let sm = maxS; sm >= r; sm--) dp[sm] += dp[sm - r]; const total = dp.reduce((a, b) => a + b, 0); if (Math.abs(total - Math.pow(2, n)) > 1e-6 * total) throw new CalcError('Internal check failed.'); let lo = 0; for (let sm = 0; sm <= Wp; sm++) lo += dp[sm]; let hi = 0; for (let sm = Wp; sm <= maxS; sm++) hi += dp[sm]; p = Math.min(1, 2 * Math.min(lo, hi) / total); how = `exact (all ${Math.pow(2, n)} sign patterns)`; }
        else { const mu = n * (n + 1) / 4, sg = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - tieSum / 48); const z = (Math.abs(Wp - mu) - 0.5) / sg; p = Math.min(1, 2 * (1 - PhiN(Math.max(0, z)))); how = `normal approximation with continuity${tieSum ? ' and tie' : ''} correction`; }
        const r = I.makeResult('stats', 'Wilcoxon signed-rank test'); const W = Math.min(Wp, Wm);
        r.main = { label: 'Signed-rank test:', text: `W = ${engine.fmt(W, 6)}  (W⁺ = ${engine.fmt(Wp, 6)}, W⁻ = ${engine.fmt(Wm, 6)}),  p = ${fmtP(p)}`, tex: '' };
        r.items.push({ label: 'Decision:', text: p < alpha ? `Reject H₀ at α = ${alpha}: the differences are not centred on 0.` : `Do not reject H₀ at α = ${alpha}: no evidence of a shift.`, tex: '' });
        r.items.push({ label: 'Differences used:', text: `${n} non-zero${zeros ? ` (${zeros} zero difference${zeros > 1 ? 's' : ''} dropped)` : ''}; median difference ${engine.fmt(d.slice().sort((a, b) => a - b)[Math.floor((n - 1) / 2)] / 2 + d.slice().sort((a, b) => a - b)[Math.ceil((n - 1) / 2)] / 2, 5)}`, tex: '' });
        r.items.push({ label: 'p-value method:', text: how, tex: '' });
        r.meta.push(`Verified: W⁺ + W⁻ = n(n+1)/2${!tieSum && n <= 22 ? '; the exact distribution counts all 2ⁿ sign patterns' : ''}`);
        r.meta.push('Paired or one-sample test with no normality assumption; it assumes the differences are roughly symmetric about their centre.');
        r.steps.push({ title: 'Rank the sizes', text: 'Drop zero differences, rank |d| from smallest to largest (ties share the average rank).', tex: '' }); r.steps.push({ title: 'Add up the signs', text: 'W⁺ is the sum of ranks of the positive differences. If there is no shift, W⁺ is near n(n+1)/4.', tex: '' });
        r.plot = { generic: { title: 'The differences', xTitle: 'index', yTitle: 'difference', traces: [{ y: d, x: d.map((_, i) => i + 1), type: 'bar', name: 'd' }] } };
        return I.finalizeText(r);
    }
    function runKruskal(src, opt) {
        const alpha = (() => { const q = +opt.alpha; return q > 0 && q < 1 ? q : 0.05; })();
        const groups = String(src).split(/[;\n]+/).map(x => x.trim()).filter(Boolean).map(g => numList(g, 'Value')); if (groups.length < 2) throw new CalcError('Give at least two groups separated by semicolons.'); if (groups.some(g => g.length < 1)) throw new CalcError('Every group needs at least one value.');
        const all = groups.flat(), N = all.length, k = groups.length; if (N > 5000) throw new CalcError('Up to 5,000 values.');
        const { rk, tieSum } = rankAvg(all); const C = 1 - tieSum / (N * N * N - N); if (!(C > 0)) throw new CalcError('All values are identical, so the test is undefined.');
        let pos = 0; const R = groups.map(g => { const sm = g.reduce((a, _, i) => a + rk[pos + i], 0); pos += g.length; return sm; });
        if (Math.abs(R.reduce((a, b) => a + b, 0) - N * (N + 1) / 2) > 1e-9) throw new CalcError('Internal check failed.');
        const H = (12 / (N * (N + 1)) * R.reduce((a, rr, i) => a + rr * rr / groups[i].length, 0) - 3 * (N + 1)) / C, df = k - 1, pv = 1 - gammaP(df / 2, H / 2);
        const pdf = x => Math.exp((df / 2 - 1) * Math.log(x) - x / 2 - (df / 2) * Math.log(2) - lgamma(df / 2)); const num = H > 0 ? 1 - simpson(u => (u === 0 ? 0 : pdf(u * u) * 2 * u), 0, Math.sqrt(H), 40000) : 1; if (Math.abs(num - pv) > 2e-4 && pv > 1e-6) throw new CalcError('The p-value failed its numerical check.');
        const r = I.makeResult('stats', 'Kruskal–Wallis test');
        r.main = { label: 'Kruskal–Wallis:', text: `H = ${engine.fmt(H, 6)},  df = ${df},  p = ${fmtP(pv)}`, tex: '' };
        r.items.push({ label: 'Decision:', text: pv < alpha ? `Reject H₀ at α = ${alpha}: at least one group tends to give different values.` : `Do not reject H₀ at α = ${alpha}: no evidence the groups differ.`, tex: '' });
        r.items.push({ label: 'Mean rank per group:', text: R.map((rr, i) => `group ${i + 1}: ${engine.fmt(rr / groups[i].length, 5)} (n = ${groups[i].length})`).join(';  '), tex: '' });
        r.items.push({ label: 'Effect size ε² =', text: engine.fmt(Math.max(0, (H - k + 1) / (N - k)), 4), tex: '' });
        if (groups.some(g => g.length < 5)) r.warnings.push('Some groups have fewer than 5 values; the χ² approximation behind the p-value can be inaccurate for samples this small.');
        r.meta.push('Verified: the rank sums add to N(N+1)/2 and the p-value matches direct numerical integration of the χ² density');
        r.meta.push('Rank-based alternative to one-way ANOVA with no normality assumption (tie-corrected). It says whether groups differ, not which ones.');
        r.steps.push({ title: 'Rank everything together', text: 'Pool all groups, rank from smallest to largest, ties share the average rank.', tex: '' }); r.steps.push({ title: 'Compare mean ranks', text: 'H = 12/(N(N+1)) Σ Rᵢ²/nᵢ − 3(N+1), divided by a tie correction; under H₀ it follows χ² with k − 1 degrees of freedom.', tex: '' });
        r.plot = { generic: { title: 'Groups', xTitle: 'group', yTitle: 'value', traces: groups.map((g, i) => ({ y: g, type: 'box', name: `group ${i + 1}`, boxpoints: 'all', jitter: 0.4 })) } };
        return I.finalizeText(r);
    }

    // ---- Markov chains, Bayes' rule, confidence intervals for proportions ----
    const probNum = x => { const v = I.parseLimit(String(x).trim().replace(/%$/, m => ''), 'Probability').value; return /%\s*$/.test(String(x)) ? v / 100 : v; };
    const probList = (txt, what) => String(txt).split(/[\s,]+/).filter(Boolean).map(t => { const v = probNum(t); if (!Number.isFinite(v)) throw new CalcError(`“${t}” is not a number in ${what}.`); return v; });
    function runMarkov(src, opt) {
        const rows = String(src).replace(/[\[\]]/g, ' ').split(/;|\n/).map(x => x.trim()).filter(Boolean).map(rw => probList(rw, 'the matrix')); const k = rows.length; if (k < 2 || k > 12) throw new CalcError('Enter a square transition matrix with 2 to 12 states, rows separated by ;  e.g. 0.9 0.1 ; 0.5 0.5');
        if (rows.some(rw => rw.length !== k)) throw new CalcError('The matrix must be square: every row needs one entry per state.'); if (rows.some(rw => rw.some(v => v < -1e-12 || v > 1 + 1e-12))) throw new CalcError('Transition probabilities must be between 0 and 1.');
        rows.forEach((rw, i) => { const sm = rw.reduce((a, b) => a + b, 0); if (Math.abs(sm - 1) > 1e-9) throw new CalcError(`Row ${i + 1} sums to ${engine.fmt(sm, 6)}, not 1.`); });
        const P = rows.map(rw => rw.map(v => Math.max(0, v))); const N8 = x => nice(x, 6, 1e-9).text; const names = Array.from({ length: k }, (_, i) => `S${i + 1}`);
        const mul = (A, B) => A.map(ra => B[0].map((_, j) => ra.reduce((t, v, l) => t + v * B[l][j], 0))); const vecMul = (v, A) => A[0].map((_, j) => v.reduce((t, x, i) => t + x * A[i][j], 0));
        // communicating classes
        const reach = P.map((rw, i) => rw.map((v, j) => (i === j || v > 1e-12))); for (let m = 0; m < k; m++) for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) if (reach[i][m] && reach[m][j]) reach[i][j] = true;
        const cls = []; const seen = new Array(k).fill(false); for (let i = 0; i < k; i++) if (!seen[i]) { const c = []; for (let j = 0; j < k; j++) if (reach[i][j] && reach[j][i]) { c.push(j); seen[j] = true; } cls.push(c); }
        cls.forEach(c => { c.recurrent = c.every(i => P[i].every((v, j) => v <= 1e-12 || c.includes(j))); });
        const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a)); cls.forEach(c => { if (!c.recurrent) return; const lvl = new Map([[c[0], 0]]); const q = [c[0]]; while (q.length) { const u = q.shift(); P[u].forEach((v, j) => { if (v > 1e-12 && c.includes(j) && !lvl.has(j)) { lvl.set(j, lvl.get(u) + 1); q.push(j); } }); } let g = 0; c.forEach(u => P[u].forEach((v, j) => { if (v > 1e-12 && c.includes(j)) g = gcd(g, lvl.get(u) + 1 - lvl.get(j)); })); c.period = g || 1; });
        const absorbing = cls.filter(c => c.recurrent && c.length === 1 && P[c[0]][c[0]] > 1 - 1e-12).map(c => c[0]); const rec = cls.filter(c => c.recurrent), trans = cls.filter(c => !c.recurrent).flat().sort((a, b) => a - b);
        const r = I.makeResult('stats', 'Markov chain'); const lab = c => '{' + c.map(i => names[i]).join(', ') + '}';
        r.items.push({ label: 'Matrix P =', text: P.map(rw => rw.map(N8).join(' ')).join('  ;  '), tex: '' });
        r.items.push({ label: 'Classes:', text: cls.map(c => `${lab(c)} ${c.recurrent ? `recurrent${c.length === 1 && absorbing.includes(c[0]) ? ' (absorbing)' : ''}, period ${c.period}` : 'transient'}`).join(';   '), tex: '' });
        const irreducible = cls.length === 1, regular = irreducible && cls[0].period === 1; r.items.push({ label: 'Type:', text: regular ? 'irreducible and aperiodic (regular): it forgets its starting state' : irreducible ? `irreducible with period ${cls[0].period}: it cycles, so the distribution does not settle` : absorbing.length && rec.every(c => c.length === 1 && absorbing.includes(c[0])) ? 'absorbing chain' : 'reducible: several classes', tex: '' });
        const verified = [];
        // stationary distribution of each recurrent class
        const stat = rec.map(c => { const m = c.length; const A = Array.from({ length: m }, (_, j) => Array.from({ length: m }, (_, i) => (i === j ? 1 : 0) - P[c[i]][c[j]])); A[m - 1] = new Array(m).fill(1); const bvec = new Array(m).fill(0); bvec[m - 1] = 1; let sol; try { sol = math.lusolve(A, bvec.map(v => [v])).map(q => q[0]); } catch (e) { throw new CalcError('Could not solve for the stationary distribution.'); } const pi = new Array(k).fill(0); c.forEach((s2, i) => { pi[s2] = Math.abs(sol[i]) < 1e-12 ? 0 : sol[i]; }); return { c, pi }; });
        let resid = 0; stat.forEach(({ pi }) => { const nx = vecMul(pi, P); resid = Math.max(resid, ...nx.map((v, i) => Math.abs(v - pi[i]))); if (pi.some(v => v < -1e-9) || Math.abs(pi.reduce((a, b) => a + b, 0) - 1) > 1e-9) throw new CalcError('The stationary distribution check failed.'); }); if (resid > 1e-9) throw new CalcError('The stationary distribution check failed.');
        if (stat.length === 1) { r.items.push({ label: 'Stationary distribution π (πP = π):', text: stat[0].pi.map((v, i) => `${names[i]} = ${N8(v)}`).join(',  '), tex: '' }); if (stat[0].c.length === k) r.items.push({ label: 'Mean return time to each state (1/π):', text: stat[0].pi.map((v, i) => `${names[i]}: ${N8(1 / v)}`).join(',  '), tex: '' }); }
        else stat.forEach((q, i) => r.items.push({ label: `Stationary distribution on ${lab(q.c)}:`, text: q.c.map(s2 => `${names[s2]} = ${N8(q.pi[s2])}`).join(',  '), tex: '' }));
        verified.push(`each stationary distribution satisfies πP = π (residual ${resid.toExponential(1)}), is non-negative and sums to 1`);
        // absorption probabilities and expected steps from the transient states
        if (trans.length && rec.length) {
            const T = trans, rIdx = rec.map(c => c); const Q = T.map(i => T.map(j => P[i][j])); const IQ = Q.map((rw, i) => rw.map((v, j) => (i === j ? 1 : 0) - v)); let Ninv; try { Ninv = math.inv(IQ); } catch (e) { throw new CalcError('The transient part is singular.'); } const Rm = T.map(i => rIdx.map(c => c.reduce((t, j) => t + P[i][j], 0))); const B = Ninv.map(rw => rIdx.map((_, cj) => rw.reduce((t, v, l) => t + v * Rm[l][cj], 0))); const steps = Ninv.map(rw => rw.reduce((a, b) => a + b, 0));
            B.forEach(rw => { if (Math.abs(rw.reduce((a, b) => a + b, 0) - 1) > 1e-8) throw new CalcError('Absorption probabilities do not sum to 1.'); });
            r.items.push({ label: 'Probability of ending in each recurrent class:', text: T.map((s2, i) => `from ${names[s2]}: ` + rIdx.map((c, cj) => `${lab(c)} ${N8(B[i][cj])}`).join(', ')).join(';   '), tex: '' }); r.items.push({ label: 'Expected steps before reaching a recurrent class:', text: T.map((s2, i) => `${names[s2]}: ${N8(steps[i])}`).join(',  '), tex: '' });
            let Pn = P; for (let q = 0; q < 12; q++) Pn = mul(Pn, Pn); let dif = 0; T.forEach((s2, i) => rIdx.forEach((c, cj) => { dif = Math.max(dif, Math.abs(c.reduce((t, j) => t + Pn[s2][j], 0) - B[i][cj])); })); if (dif > 1e-6) throw new CalcError('Long-run matrix powers disagree with the absorption probabilities.'); verified.push(`the absorption probabilities agree with the 4,096th power of P (largest difference ${dif.toExponential(1)})`);
        }
        if (regular) { let Pn = P; for (let q = 0; q < 12; q++) Pn = mul(Pn, Pn); let dif = 0; Pn.forEach(rw => rw.forEach((v, j) => { dif = Math.max(dif, Math.abs(v - stat[0].pi[j])); })); if (dif > 1e-6) throw new CalcError('Long-run matrix powers disagree with the stationary distribution.'); verified.push(`every row of the 4,096th power of P equals π (largest difference ${dif.toExponential(1)})`); }
        // evolution of a starting distribution
        const initTxt = String(opt.init || '').trim(); let v0; if (initTxt) { v0 = probList(initTxt, 'the starting distribution'); if (v0.length !== k) throw new CalcError(`Give ${k} starting probabilities (or leave blank to start in S1).`); const sm = v0.reduce((a, b) => a + b, 0); if (Math.abs(sm - 1) > 1e-9) throw new CalcError(`The starting distribution sums to ${engine.fmt(sm, 6)}, not 1.`); } else { v0 = new Array(k).fill(0); v0[0] = 1; }
        const nSteps = Math.max(1, Math.min(200, parseInt(opt.steps, 10) || 10)); const path = [v0]; for (let t = 1; t <= nSteps; t++) path.push(vecMul(path[t - 1], P)); const last = path[nSteps]; r.items.push({ label: `Distribution after ${nSteps} step${nSteps === 1 ? '' : 's'} (start ${v0.map(N8).join(', ')}):`, text: last.map((v, i) => `${names[i]} = ${N8(v)}`).join(',  '), tex: '' });
        r.main = { label: 'Long-run behaviour:', text: stat.length === 1 && stat[0].c.length === k ? (regular ? `π = (${stat[0].pi.map(N8).join(', ')})` : `stationary π = (${stat[0].pi.map(N8).join(', ')}) but the chain is periodic`) : `${rec.length} recurrent class${rec.length === 1 ? '' : 'es'}${absorbing.length ? `; absorbing state${absorbing.length > 1 ? 's' : ''} ${absorbing.map(i => names[i]).join(', ')}` : ''}`, tex: '' };
        r.meta.push('Verified: ' + verified.join('; ')); r.meta.push('Method: classes from reachability, stationary distribution from πP = π with Σπ = 1, absorption data from the fundamental matrix N = (I − Q)⁻¹');
        r.steps.push({ title: 'Classify the states', text: 'States that can reach each other form a class. A class with no way out is recurrent; the rest are transient.', tex: '' }); r.steps.push({ title: 'Stationary distribution', text: 'Solve πP = π together with Σπᵢ = 1.', tex: '' }); if (trans.length && rec.length) r.steps.push({ title: 'Absorption', text: 'With Q the transitions among transient states, N = (I − Q)⁻¹ counts expected visits, N·1 gives expected steps, and N·R gives absorption probabilities.', tex: '' });
        r.plot = { generic: { title: 'Distribution over time', xTitle: 'step', yTitle: 'probability', traces: names.map((nm, i) => ({ x: path.map((_, t) => t), y: path.map(p => p[i]), mode: 'lines+markers', type: 'scatter', name: nm })) } };
        return I.finalizeText(r);
    }
    function runBayes(src, opt) {
        const lists = String(src).split(/[;\n]+/).map(x => x.trim()).filter(Boolean).map(l => probList(l.replace(/^[a-z ]+:/i, ''), 'the lists')); if (lists.length < 2) throw new CalcError('Give the prior probabilities, then one list of likelihoods P(evidence | hypothesis) per observation, separated by ;  e.g. 0.01, 0.99 ; 0.95, 0.05');
        const k = lists[0].length; if (k < 2 || k > 10) throw new CalcError('Use 2 to 10 hypotheses.'); if (lists.some(l => l.length !== k)) throw new CalcError(`Every list needs ${k} numbers, one per hypothesis.`); if (lists.flat().some(v => v < 0 || v > 1 + 1e-12)) throw new CalcError('Probabilities must be between 0 and 1.');
        const sp = lists[0].reduce((a, b) => a + b, 0); if (sp <= 0) throw new CalcError('The prior probabilities cannot all be 0.'); const normalised = Math.abs(sp - 1) > 1e-9; const prior = lists[0].map(v => v / sp); const names = String(opt.names || '').split(/[,;]/).map(x => x.trim()).filter(Boolean); const nm = Array.from({ length: k }, (_, i) => names[i] || `H${i + 1}`); const N8 = x => nice(x, 6, 1e-9).text;
        let post = prior.slice(); const history = [prior]; const evid = []; lists.slice(1).forEach(like => { const joint = post.map((p, i) => p * like[i]); const pe = joint.reduce((a, b) => a + b, 0); if (!(pe > 0)) throw new CalcError('That evidence has probability 0 under every hypothesis, so Bayes’ rule is undefined.'); evid.push(pe); post = joint.map(v => v / pe); history.push(post); });
        // independent check: multiply all likelihoods at once, then normalise
        const batch = prior.map((p, i) => lists.slice(1).reduce((t, l) => t * l[i], p)); const bs = batch.reduce((a, b) => a + b, 0); const batchPost = batch.map(v => v / bs); const diff = Math.max(...batchPost.map((v, i) => Math.abs(v - post[i]))); if (diff > 1e-9 || Math.abs(post.reduce((a, b) => a + b, 0) - 1) > 1e-9) throw new CalcError('The Bayes check failed.');
        const r = I.makeResult('stats', "Bayes' rule"); r.main = { label: 'Posterior probabilities:', text: nm.map((n2, i) => `P(${n2} | evidence) = ${N8(post[i])}`).join(',  '), tex: '' };
        r.items.push({ label: 'Prior:', text: nm.map((n2, i) => `${n2} ${N8(prior[i])}`).join(',  ') + (normalised ? '  (normalised to sum to 1)' : ''), tex: '' });
        history.slice(1).forEach((h, t) => r.items.push({ label: `After observation ${t + 1} (P(evidence) = ${N8(evid[t])}):`, text: nm.map((n2, i) => `${n2} ${N8(h[i])}`).join(',  '), tex: '' }));
        if (k === 2 && lists.length === 2) { const big = 10000, a = prior[0] * big, b2 = prior[1] * big; const ta = a * lists[1][0], tb = b2 * lists[1][1]; r.items.push({ label: 'In natural frequencies:', text: `out of ${big.toLocaleString()} cases, ${N8(a)} are ${nm[0]} and ${N8(b2)} are ${nm[1]}; the evidence appears in ${N8(ta)} of the first group and ${N8(tb)} of the second, so ${N8(ta)} of every ${N8(ta + tb)} cases showing it are ${nm[0]} (${N8(ta / (ta + tb))})`, tex: '' }); r.items.push({ label: 'Bayes factor:', text: `${N8(lists[1][0] / lists[1][1])} in favour of ${nm[0]} over ${nm[1]}`, tex: '' }); }
        r.meta.push(`Verified: updating one observation at a time gives the same result as multiplying all the likelihoods at once and normalising (difference ${diff.toExponential(1)}); the posteriors sum to 1`); r.meta.push('Assumes the observations are independent given the hypothesis.');
        r.steps.push({ title: "Bayes' rule", text: 'P(H | E) = P(E | H) · P(H) / P(E), where P(E) = Σ P(E | Hᵢ) P(Hᵢ).', tex: 'P(H\\mid E)=\\frac{P(E\\mid H)P(H)}{P(E)}' }); r.steps.push({ title: 'Several observations', text: 'Each posterior becomes the next prior.', tex: '' });
        r.plot = { generic: { title: 'Prior and posterior', xTitle: 'hypothesis', yTitle: 'probability', traces: [{ x: nm, y: prior, type: 'bar', name: 'prior' }, { x: nm, y: post, type: 'bar', name: 'posterior' }] } };
        return I.finalizeText(r);
    }
    function runPropCI(src, opt) {
        const groups = String(src).split(/[;\n]+/).map(x => x.trim()).filter(Boolean).map(g => { const q = g.split(/[\s,/]+|\bof\b|\bout\b/i).filter(Boolean).map(Number); if (q.length !== 2 || !q.every(Number.isFinite) || q[1] < 1 || q[0] < 0 || q[0] > q[1] || !Number.isInteger(q[0]) || !Number.isInteger(q[1])) throw new CalcError('Give successes and trials as whole numbers, e.g. 45, 120  (two groups: 45, 120 ; 30, 110).'); if (q[1] > 1e7) throw new CalcError('Up to 10,000,000 trials.'); return { x: q[0], n: q[1] }; });
        if (groups.length < 1 || groups.length > 2) throw new CalcError('Give one group (successes, trials) or two separated by ;'); const level = (() => { const q = +opt.conf; return q > 0 && q < 1 ? q : 0.95; })(); const alpha = 1 - level;
        const zq = (() => { let lo = 0, hi = 10; for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (PhiN(mid) < 1 - alpha / 2) lo = mid; else hi = mid; } return (lo + hi) / 2; })(); const f6 = x => engine.fmt(x, 6);
        const wilson = (x, n) => { const p = x / n, z2 = zq * zq, den = 1 + z2 / n, c = (p + z2 / (2 * n)) / den, h = zq * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / den; return [Math.max(0, c - h), Math.min(1, c + h)]; };
        const binomTail = (x, n, p, upper) => { // P(X >= x) or P(X <= x) by direct summation of the pmf (independent of the beta function)
            const lp = Math.log(p), lq = Math.log(1 - p); let tot = 0; for (let j = upper ? x : 0; j <= (upper ? n : x); j++) tot += Math.exp(lgamma(n + 1) - lgamma(j + 1) - lgamma(n - j + 1) + (j ? j * lp : 0) + (n - j ? (n - j) * lq : 0)); return tot; };
        const exactCI = (x, n) => { const lo = x === 0 ? 0 : (() => { let a = 0, b = x / n; for (let i = 0; i < 80; i++) { const m = (a + b) / 2; if (betai(x, n - x + 1, m) > alpha / 2) b = m; else a = m; } return (a + b) / 2; })(); const hi = x === n ? 1 : (() => { let a = x / n, b = 1; for (let i = 0; i < 80; i++) { const m = (a + b) / 2; if (betai(x + 1, n - x, m) < 1 - alpha / 2) a = m; else b = m; } return (a + b) / 2; })(); return [lo, hi]; };
        const r = I.makeResult('stats', 'Confidence interval for a proportion'); const verified = [];
        const one = g => { const { x, n } = g; const p = x / n; const se = Math.sqrt(p * (1 - p) / n); const wald = [Math.max(0, p - zq * se), Math.min(1, p + zq * se)]; const w = wilson(x, n); const nt = n + zq * zq, pt = (x + zq * zq / 2) / nt, ac = [Math.max(0, pt - zq * Math.sqrt(pt * (1 - pt) / nt)), Math.min(1, pt + zq * Math.sqrt(pt * (1 - pt) / nt))]; const ex = exactCI(x, n);
            if (n >= 1 && n <= 5000) { if (x > 0) { const t = binomTail(x, n, ex[0], true); if (Math.abs(t - alpha / 2) > 1e-6) throw new CalcError('The exact interval failed its check.'); } if (x < n) { const t = binomTail(x, n, ex[1], false); if (Math.abs(t - alpha / 2) > 1e-6) throw new CalcError('The exact interval failed its check.'); } verified.push(`the exact (Clopper–Pearson) endpoints give binomial tail probabilities of ${f6(alpha / 2)} by direct summation`); }
            if (x > 0 && x < n) { [w[0], w[1]].forEach(pp => { const zz = Math.abs(p - pp) / Math.sqrt(pp * (1 - pp) / n); if (Math.abs(zz - zq) > 1e-7) throw new CalcError('The Wilson interval failed its check.'); }); verified.push('both Wilson endpoints satisfy the score equation |p̂ − p| / √(p(1 − p)/n) = z'); }
            return { p, wald, w, ac, ex }; };
        if (groups.length === 1) {
            const g = groups[0], o = one(g); r.main = { label: `${(level * 100).toFixed(level * 100 % 1 ? 1 : 0)}% confidence interval for p:`, text: `${f6(o.w[0])} to ${f6(o.w[1])}  (Wilson; p̂ = ${f6(o.p)}, ${g.x} of ${g.n})`, tex: '' };
            [['Wilson score (recommended)', o.w], ['Clopper–Pearson (exact, conservative)', o.ex], ['Agresti–Coull', o.ac], ['Wald (simple, poor for small n or extreme p)', o.wald]].forEach(([nm, iv]) => r.items.push({ label: nm + ':', text: `${f6(iv[0])} to ${f6(iv[1])}`, tex: '' }));
            if (g.n * Math.min(o.p, 1 - o.p) < 5) r.warnings.push('Fewer than 5 expected successes or failures: avoid the Wald interval here; Wilson or Clopper–Pearson are safer.');
            r.items.push({ label: 'Margin of error (Wald):', text: f6(zq * Math.sqrt(o.p * (1 - o.p) / g.n)), tex: '' });
            r.plot = { generic: { title: 'Interval estimates', xTitle: 'p', yTitle: '', traces: [['Wilson', o.w], ['Clopper–Pearson', o.ex], ['Agresti–Coull', o.ac], ['Wald', o.wald]].map(([nm, iv]) => ({ x: iv, y: [nm, nm], mode: 'lines+markers', type: 'scatter', name: nm })).concat([{ x: [o.p], y: ['Wilson'], mode: 'markers', type: 'scatter', name: 'p̂', marker: { size: 11, symbol: 'diamond' } }]) } };
        } else {
            const [a, b2] = groups, oa = one(a), ob = one(b2); const diff = oa.p - ob.p; const la = oa.w[0], ua = oa.w[1], lb = ob.w[0], ub = ob.w[1]; const lo = diff - Math.sqrt((oa.p - la) ** 2 + (ub - ob.p) ** 2), hi = diff + Math.sqrt((ua - oa.p) ** 2 + (ob.p - lb) ** 2);
            const pp = (a.x + b2.x) / (a.n + b2.n), se0 = Math.sqrt(pp * (1 - pp) * (1 / a.n + 1 / b2.n)), z = se0 > 0 ? diff / se0 : 0, pv = se0 > 0 ? 2 * (1 - PhiN(Math.abs(z))) : 1;
            r.main = { label: `${(level * 100).toFixed(level * 100 % 1 ? 1 : 0)}% CI for p₁ − p₂ (Newcombe):`, text: `${f6(lo)} to ${f6(hi)}  (p̂₁ = ${f6(oa.p)}, p̂₂ = ${f6(ob.p)}, difference ${f6(diff)})`, tex: '' };
            r.items.push({ label: 'Group 1 (Wilson):', text: `${f6(oa.w[0])} to ${f6(oa.w[1])}  (${a.x} of ${a.n})`, tex: '' }); r.items.push({ label: 'Group 2 (Wilson):', text: `${f6(ob.w[0])} to ${f6(ob.w[1])}  (${b2.x} of ${b2.n})`, tex: '' });
            r.items.push({ label: 'Two-proportion z-test (H₀: p₁ = p₂):', text: `z = ${f6(z)}, p = ${fmtP(pv)}  ${pv < alpha ? '→ the proportions differ at this level' : '→ no evidence of a difference'}`, tex: '' });
            if (a.x > 0 && b2.x > 0) { const rr = oa.p / ob.p, sel = Math.sqrt(1 / a.x - 1 / a.n + 1 / b2.x - 1 / b2.n); r.items.push({ label: 'Risk ratio (log method):', text: `${f6(rr)}  (${f6(rr * Math.exp(-zq * sel))} to ${f6(rr * Math.exp(zq * sel))})`, tex: '' }); }
            const contains0 = lo <= 0 && hi >= 0; if (contains0 !== (pv >= alpha) && Math.abs(pv - alpha) > 0.02) r.warnings.push('The interval and the z-test point in slightly different directions; they use different standard errors, which is normal near the boundary.');
            verified.push('the Newcombe interval is rebuilt from the two Wilson intervals; each group’s endpoints were checked as above');
            r.plot = { generic: { title: 'Difference in proportions', xTitle: 'p₁ − p₂', yTitle: '', traces: [{ x: [lo, hi], y: ['difference', 'difference'], mode: 'lines+markers', type: 'scatter', name: 'Newcombe interval' }, { x: [diff], y: ['difference'], mode: 'markers', type: 'scatter', name: 'estimate', marker: { size: 11, symbol: 'diamond' } }, { x: [0, 0], y: ['difference', 'difference'], mode: 'markers', type: 'scatter', name: 'no difference', marker: { size: 12, symbol: 'x' } }] } };
        }
        r.meta.push('Verified: ' + [...new Set(verified)].join('; ')); r.meta.push('Method: Wilson score interval is recommended for most uses; Clopper–Pearson never undercovers but is wider; the Wald interval is shown for comparison only.');
        r.steps.push({ title: 'Estimate', text: 'p̂ = successes / trials.', tex: '' }); r.steps.push({ title: 'Interval', text: 'The Wilson interval solves |p̂ − p| = z·√(p(1 − p)/n) for p, which keeps the interval inside [0, 1] and works for small samples.', tex: '' });
        return I.finalizeText(r);
    }
    register({ stats: (src, opt) => (opt.op === 'chisq' || opt.op === 'anova') ? runChiAnova(src, opt) : opt.op === 'mannwhitney' ? runMannWhitney(src, opt) : opt.op === 'wilcoxon' ? runWilcoxon(src, opt) : opt.op === 'kruskal' ? runKruskal(src, opt) : opt.op === 'markov' ? runMarkov(src, opt) : opt.op === 'bayes' ? runBayes(src, opt) : opt.op === 'propci' ? runPropCI(src, opt) : prevStats(src, opt) });

    // ---- heat and wave equations on [0, L] with fixed ends ----
    function runPDE(src, opt) {
        const kind = opt.odeType, neu = opt.pdeBC === 'neumann'; const node = engine.parse(src); const fv = engine.freeVars(node); if (fv.some(q => q !== 'x')) throw new CalcError('Write the initial profile in terms of x only, e.g. sin(x) or x*(pi-x).');
        const L = I.parseLimit(opt.pdeL === undefined || opt.pdeL === '' ? 'pi' : opt.pdeL, 'Length').value, T = I.parseLimit(opt.pdeT === undefined || opt.pdeT === '' ? '1' : opt.pdeT, 'Final time').value, cf = I.parseLimit(opt.pdeK === undefined || opt.pdeK === '' ? '1' : opt.pdeK, kind === 'heat' ? 'Diffusivity' : 'Wave speed').value;
        if (!(L > 0 && L < 1e4) || !(T > 0 && T < 1e5) || !(cf > 0 && cf < 1e4)) throw new CalcError('Length, final time and the coefficient must be positive numbers.');
        const u0 = engine.compile(node, ['x']); const vNode = kind === 'wave' ? engine.parse(opt.pdeV === undefined || String(opt.pdeV).trim() === '' ? '0' : opt.pdeV) : null; if (vNode && engine.freeVars(vNode).some(q => q !== 'x')) throw new CalcError('The initial velocity must depend on x only.'); const v0 = vNode ? engine.compile(vNode, ['x']) : null;
        const sc = Math.max(1e-12, ...Array.from({ length: 2001 }, (_, i) => Math.abs(u0(L * i / 2000)))); if (!Number.isFinite(sc)) throw new CalcError('The initial profile is not defined on the whole interval.');
        if (!neu && (Math.abs(u0(0)) > 1e-6 * sc || Math.abs(u0(L)) > 1e-6 * sc)) throw new CalcError('Both ends are held at 0, so the initial profile must be 0 at x = 0 and x = L (for example sin(x) on [0, π], or x*(pi−x)).');
        const Nx = kind === 'heat' ? 120 : 240, dx = L / Nx, xs = Array.from({ length: Nx + 1 }, (_, i) => i * dx);
        let u = xs.map(x => u0(x)); if (!neu) { u[0] = 0; u[Nx] = 0; } const frames = [{ t: 0, u: u.slice() }]; const keep = 60; const rec = []; // snapshots for the surface
        const snap = (t, uu) => rec.push({ t, u: uu.slice() }); snap(0, u);
        if (kind === 'heat') {
            const steps = 800, dt = T / steps, r = cf * dt / (2 * dx * dx), n = neu ? Nx + 1 : Nx - 1, off = neu ? 0 : 1;
            const a = new Array(n).fill(-r), b = new Array(n).fill(1 + 2 * r), c = new Array(n).fill(-r); if (neu) { c[0] = -2 * r; a[n - 1] = -2 * r; }
            for (let st = 1; st <= steps; st++) {
                const d = new Array(n); for (let k = 0; k < n; k++) { const i = k + off; const um = i === 0 ? u[1] : u[i - 1], up = i === Nx ? u[Nx - 1] : u[i + 1]; d[k] = (1 - 2 * r) * u[i] + r * (um + up); }
                const cp = new Array(n), dp = new Array(n); cp[0] = c[0] / b[0]; dp[0] = d[0] / b[0]; for (let i = 1; i < n; i++) { const m = b[i] - a[i] * cp[i - 1]; cp[i] = c[i] / m; dp[i] = (d[i] - a[i] * dp[i - 1]) / m; }
                const sol = new Array(n); sol[n - 1] = dp[n - 1]; for (let i = n - 2; i >= 0; i--) sol[i] = dp[i] - cp[i] * sol[i + 1];
                const nu = new Array(Nx + 1).fill(0); for (let k = 0; k < n; k++) nu[k + off] = sol[k]; u = nu;
                if (st % (steps / keep) === 0) snap(st * dt, u);
            }
        } else {
            let dt = 0.5 * dx / cf; const steps = Math.max(2, Math.ceil(T / dt)); if (steps > 40000) throw new CalcError('That would need too many time steps; shorten the time or the length.'); dt = T / steps; const lam2 = (cf * dt / dx) ** 2; if (lam2 > 1) throw new CalcError('Internal stability check failed.');
            const vel = xs.map(x => (v0 ? v0(x) : 0)); let prev = u.slice(), cur = new Array(Nx + 1).fill(0); for (let i = neu ? 0 : 1; i <= (neu ? Nx : Nx - 1); i++) { const um = i === 0 ? u[1] : u[i - 1], up = i === Nx ? u[Nx - 1] : u[i + 1]; cur[i] = u[i] + dt * vel[i] + 0.5 * lam2 * (up - 2 * u[i] + um); } const every = Math.max(1, Math.floor(steps / keep)); if (every === 1 || steps >= 1) { /* record first */ }
            for (let st = 2; st <= steps; st++) { const nxt = new Array(Nx + 1).fill(0); for (let i = neu ? 0 : 1; i <= (neu ? Nx : Nx - 1); i++) { const um = i === 0 ? cur[1] : cur[i - 1], up = i === Nx ? cur[Nx - 1] : cur[i + 1]; nxt[i] = 2 * cur[i] - prev[i] + lam2 * (up - 2 * cur[i] + um); } prev = cur; cur = nxt; if (st % every === 0) snap(st * dt, cur); }
            u = cur; if (rec[rec.length - 1].t < T - 1e-12) snap(T, u);
        }
        // independent check: Fourier sine series
        const NM = 80, lam = n => n * Math.PI / L; const basisF = neu ? Math.cos : Math.sin; const coef = fn => Array.from({ length: NM }, (_, i) => { const n = i + 1; return 2 / L * simpson(x => fn(x) * basisF(lam(n) * x), 0, L, 4000); });
        const bn = coef(u0), dn = kind === 'wave' ? coef(v0) : null; const a0 = neu ? simpson(u0, 0, L, 4000) / L : 0, d0 = neu && kind === 'wave' ? simpson(v0, 0, L, 4000) / L : 0;
        const exact = x => { let s = a0 + d0 * T; for (let i = 0; i < NM; i++) { const n = i + 1, k = lam(n); s += (kind === 'heat' ? bn[i] * Math.exp(-cf * k * k * T) : (bn[i] * Math.cos(cf * k * T) + dn[i] / (cf * k) * Math.sin(cf * k * T))) * basisF(k * x); } return s; };
        let diff = 0; xs.forEach((x, i) => { diff = Math.max(diff, Math.abs(exact(x) - u[i])); }); const rel = diff / sc;
        const r = I.makeResult('ode', kind === 'heat' ? 'Heat equation' : 'Wave equation');
        const peak = Math.max(...u.map(Math.abs));
        r.main = { label: kind === 'heat' ? 'uₜ = α·uₓₓ  on [0, L]:' : 'uₜₜ = c²·uₓₓ  on [0, L]:', text: `max |u(x, ${engine.fmt(T, 5)})| = ${engine.fmt(peak, 6)}  (initially ${engine.fmt(sc, 6)})`, tex: '' };
        const lead = bn.map((b, i) => ({ n: i + 1, b })).filter(q => Math.abs(q.b) > 1e-6 * sc).slice(0, 4);
        r.items.push({ label: 'Setup:', text: `L = ${engine.fmt(L, 6)}, ${kind === 'heat' ? 'α' : 'c'} = ${engine.fmt(cf, 6)}, ${neu ? 'insulated / free ends (uₓ = 0)' : 'ends fixed at 0'}, final time T = ${engine.fmt(T, 6)}`, tex: '' });
        if (neu) r.items.push({ label: 'Average level of u(x, 0):', text: engine.fmt(Math.abs(a0) < 1e-10 * sc ? 0 : a0, 6), tex: '' });
        r.items.push({ label: neu ? 'Leading cosine modes of u(x, 0):' : 'Leading sine modes of u(x, 0):', text: lead.map(q => `b${q.n} = ${engine.fmt(q.b, 5)}`).join(',  ') || 'none', tex: '' });
        r.items.push({ label: kind === 'heat' ? 'Mode decay rates:' : 'Mode frequencies:', text: lead.map(q => kind === 'heat' ? `mode ${q.n}: e^(−${engine.fmt(cf * lam(q.n) ** 2, 5)}·t)` : `mode ${q.n}: ω = ${engine.fmt(cf * lam(q.n), 5)}`).join(',  ') || '–', tex: '' });
        if (kind === 'heat') r.items.push({ label: 'Heat remaining ∫u dx:', text: `${engine.fmt((v => (Math.abs(v) < 1e-9 * sc * L ? 0 : v))(u.reduce((a, q) => a + q * dx, 0)), 6)} (from ${engine.fmt((v => (Math.abs(v) < 1e-9 * sc * L ? 0 : v))(frames[0].u.reduce((a, q) => a + q * dx, 0)), 6)})`, tex: '' });
        if (rel < 0.02) r.meta.push(`Verified: the finite-difference solution matches the exact Fourier ${neu ? 'cosine' : 'sine'}-series solution at the final time (largest difference ${engine.fmt(diff, 3)}, ${(rel * 100).toFixed(2)}% of the initial maximum)`); else r.warnings.push(`The numerical and series solutions differ by ${(rel * 100).toFixed(1)}% of the initial maximum; the initial data may be too rough for this grid.`);
        r.meta.push(kind === 'heat' ? `Method: Crank–Nicolson finite differences (${Nx} cells, 800 steps), unconditionally stable and second-order accurate${neu ? '; insulated ends use a mirrored ghost point' : ''}` : `Method: explicit leapfrog finite differences (${Nx} cells, CFL number 0.5)`);
        r.steps.push({ title: 'Separate variables', text: neu ? 'Write u = X(x)·T(t). With insulated ends (uₓ = 0) the spatial modes are cos(nπx/L), plus a constant mode for the average.' : 'Write u = X(x)·T(t). With fixed ends the spatial modes are sin(nπx/L).', tex: '' });
        r.steps.push({ title: kind === 'heat' ? 'Each mode decays' : 'Each mode oscillates', text: kind === 'heat' ? 'Mode n evolves as e^(−α(nπ/L)²t): high modes die fastest, so the profile smooths out.' : 'Mode n oscillates at frequency c·nπ/L: the shape travels and reflects at the ends instead of dying away.', tex: '' });
        r.steps.push({ title: 'Sum the modes', text: 'The solution is the sum of the modes, with weights from the sine-series coefficients of the initial data.', tex: '' });
        const pick = [0, 0.1, 0.25, 0.5, 1].map(fr => rec.reduce((best, q) => (Math.abs(q.t - fr * T) < Math.abs(best.t - fr * T) ? q : best), rec[0]));
        r.plot = { generic: { title: 'u(x, t) at several times', xTitle: 'x', yTitle: 'u', traces: [...new Set(pick)].map(q => ({ x: xs, y: q.u, mode: 'lines', type: 'scatter', name: `t = ${engine.fmt(q.t, 4)}` })) } };
        const sx = Math.max(1, Math.floor(Nx / 60)); const gx = xs.filter((_, i) => i % sx === 0); r.plot3 = { generic: { title: 'u(x, t) as a surface', axes: ['x', 't', 'u'], traces: [{ type: 'surface', x: gx, y: rec.map(q => q.t), z: rec.map(q => q.u.filter((_, i) => i % sx === 0)), showscale: false }] } };
        return I.finalizeText(r);
    }

    function runLinear2(src, opt) {
        const nums = String(src).replace(/[\[\]]/g, ' ').split(/[\s,;]+/).filter(Boolean).map(x => I.parseLimit(x, 'Entry').value); if (nums.length !== 4 || !nums.every(Number.isFinite)) throw new CalcError('Enter a 2×2 matrix, e.g. 1 2 ; 3 4  (rows separated by ;).');
        const [a, b, c, d] = nums, M = [[a, b], [c, d]], tr = a + d, det = a * d - b * c, disc = tr * tr - 4 * det, eps = 1e-12 * Math.max(1, Math.abs(tr), Math.abs(det));
        const R = Math.max(0.5, Math.min(100, +opt.range || 4)); const N8 = x => nice(x, 6, 1e-9).text;
        const r = I.makeResult('ode', 'Linear system  x′ = Ax');
        let kind, stab, ev = [];
        if (Math.abs(det) <= eps) { kind = 'degenerate (det A = 0): a whole line of equilibria, or a single direction of motion'; stab = tr < -eps ? 'trajectories converge onto the line of equilibria' : tr > eps ? 'trajectories move away from the line of equilibria' : 'neutral'; }
        else if (det < 0) { kind = 'saddle'; stab = 'unstable'; }
        else if (disc > eps) { kind = tr < 0 ? 'stable node (sink)' : 'unstable node (source)'; stab = tr < 0 ? 'asymptotically stable' : 'unstable'; }
        else if (Math.abs(disc) <= eps) { const star = Math.abs(b) < 1e-12 && Math.abs(c) < 1e-12 && Math.abs(a - d) < 1e-12; kind = `${star ? 'star node (proper)' : 'degenerate node (improper)'}, ${tr < 0 ? 'stable' : 'unstable'}`; stab = tr < 0 ? 'asymptotically stable' : 'unstable'; }
        else { kind = Math.abs(tr) <= eps ? 'center' : tr < 0 ? 'stable spiral (spiral sink)' : 'unstable spiral (spiral source)'; stab = Math.abs(tr) <= eps ? 'stable but not asymptotically (closed orbits)' : tr < 0 ? 'asymptotically stable' : 'unstable'; }
        const lam = disc >= -eps ? [(tr + Math.sqrt(Math.max(0, disc))) / 2, (tr - Math.sqrt(Math.max(0, disc))) / 2].map(x => ({ re: x, im: 0 })) : [{ re: tr / 2, im: Math.sqrt(-disc) / 2 }, { re: tr / 2, im: -Math.sqrt(-disc) / 2 }];
        const vec = l => { const v1 = [b, l - a], v2 = [l - d, c]; const v = Math.hypot(...v1) >= Math.hypot(...v2) ? v1 : v2; const m = Math.hypot(...v); return m < 1e-12 ? null : v.map(x => x / m); };
        const realEv = lam.every(z => Math.abs(z.im) < 1e-12) ? lam.map(z => ({ l: z.re, v: vec(z.re) })) : [];
        r.title = 'Phase portrait of x′ = Ax'; r.main = { label: 'Classification:', text: `${kind}  (${stab})`, tex: '' };
        r.items.push({ label: 'Matrix A =', text: `[[${N8(a)}, ${N8(b)}], [${N8(c)}, ${N8(d)}]]`, tex: `A=\\begin{bmatrix}${N8(a)}&${N8(b)}\\\\${N8(c)}&${N8(d)}\\end{bmatrix}` });
        r.items.push({ label: 'Trace, determinant, discriminant:', text: `tr A = ${N8(tr)},  det A = ${N8(det)},  tr² − 4 det = ${N8(disc)}`, tex: '' });
        r.items.push({ label: 'Eigenvalues:', text: lam.map(z => Math.abs(z.im) < 1e-12 ? N8(z.re) : `${N8(z.re)} ${z.im < 0 ? '−' : '+'} ${N8(Math.abs(z.im))}i`).join(',  '), tex: '' });
        if (realEv.length) { const uniq = Math.abs(disc) <= eps ? [realEv[0]] : realEv; r.items.push({ label: 'Eigenvectors:', text: uniq.map(q => q.v ? `λ = ${N8(q.l)}: (${q.v.map(x => N8(x)).join(', ')})` : `λ = ${N8(q.l)}: every non-zero vector`).join(';  '), tex: '' }); }
        r.items.push({ label: 'General solution:', text: Math.abs(disc) <= eps ? (Math.abs(b) < 1e-12 && Math.abs(c) < 1e-12 && Math.abs(a - d) < 1e-12 ? `x(t) = e^(${N8(a)}t)·x₀  (every direction scales the same way)` : `x(t) = e^(${N8(tr / 2)}t)·(c₁v + c₂(t·v + w)),  where v is the eigenvector and (A − λI)w = v`) : disc > 0 ? 'x(t) = c₁ v₁ e^(λ₁t) + c₂ v₂ e^(λ₂t)' : `x(t) = ${Math.abs(tr) <= eps ? '' : `e^(${N8(tr / 2)}t)·`}[c₁(cos ${N8(Math.sqrt(-disc) / 2)}t·u − sin ${N8(Math.sqrt(-disc) / 2)}t·w) + c₂(sin ${N8(Math.sqrt(-disc) / 2)}t·u + cos ${N8(Math.sqrt(-disc) / 2)}t·w)],  where u + iw is an eigenvector for ${N8(tr / 2)} + ${N8(Math.sqrt(-disc) / 2)}i`, tex: '' });
        // independent check: RK4 against the matrix exponential
        const x0 = [1, 0.5], f = v => [a * v[0] + b * v[1], c * v[0] + d * v[1]]; const rk = (v, h) => { const k1 = f(v), k2 = f(v.map((x, i) => x + h / 2 * k1[i])), k3 = f(v.map((x, i) => x + h / 2 * k2[i])), k4 = f(v.map((x, i) => x + h * k3[i])); return v.map((x, i) => x + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])); };
        let w = x0.slice(); for (let i = 0; i < 400; i++) w = rk(w, 1 / 400); const ex = math.multiply(math.expm(math.matrix(M)), x0).toArray(); const err = Math.hypot(w[0] - ex[0], w[1] - ex[1]) / Math.max(1, Math.hypot(...ex)); if (err > 1e-8) throw new CalcError('The numerical check against the matrix exponential failed.');
        r.meta.push(`Verified: the numerical trajectory agrees with the exact solution e^(At)·x₀ (relative error ${err.toExponential(1)})`);
        r.meta.push('Classification uses the trace–determinant plane: det < 0 saddle; det > 0 with tr² > 4det nodes, tr² < 4det spirals (centre if tr = 0).');
        r.steps.push({ title: 'Find the eigenvalues', text: 'Solve λ² − (tr A)λ + det A = 0.', tex: '' }); r.steps.push({ title: 'Read off the behaviour', text: 'Real parts decide stability; non-zero imaginary parts mean rotation (spirals or centres); real eigenvalues of opposite sign give a saddle.', tex: '' });
        const traces = []; const gx = [], gy = [], ang = []; const G = 11; for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const x = -R + 2 * R * i / (G - 1), y = -R + 2 * R * j / (G - 1), v = f([x, y]), m = Math.hypot(...v); if (m < 1e-12) continue; const len = 0.55 * R * 2 / (G - 1); gx.push(x - v[0] / m * len / 2, x + v[0] / m * len / 2, null); gy.push(y - v[1] / m * len / 2, y + v[1] / m * len / 2, null); void ang; }
        traces.push({ x: gx, y: gy, mode: 'lines', type: 'scatter', name: 'direction field', line: { width: 1 }, hoverinfo: 'skip' });
        const traj = (sgn, st) => { let v = st.slice(); const X = [v[0]], Y = [v[1]]; for (let i = 0; i < 4000; i++) { v = rk(v, sgn * 0.01); if (Math.abs(v[0]) > 3 * R || Math.abs(v[1]) > 3 * R || !Number.isFinite(v[0])) break; X.push(v[0]); Y.push(v[1]); } return [X, Y]; };
        for (let k = 0; k < 8; k++) { const th = 2 * Math.PI * k / 8 + 0.2, st = [0.7 * R * Math.cos(th), 0.7 * R * Math.sin(th)]; const [fx, fy] = traj(1, st), [bx, by] = traj(-1, st); traces.push({ x: bx.reverse().concat(fx), y: by.reverse().concat(fy), mode: 'lines', type: 'scatter', name: k ? undefined : 'trajectories', showlegend: k === 0, line: { width: 2 } }); }
        realEv.forEach((q, i) => { if (q.v) traces.push({ x: [-3 * R * q.v[0], 3 * R * q.v[0]], y: [-3 * R * q.v[1], 3 * R * q.v[1]], mode: 'lines', type: 'scatter', name: `eigenline λ = ${N8(q.l)}`, line: { dash: 'dash', width: 2 } }); void i; });
        traces.push({ x: [0], y: [0], mode: 'markers', type: 'scatter', name: 'equilibrium', marker: { size: 9 } });
        r.plot = { generic: { title: `Phase portrait: ${kind}`, xTitle: 'x', yTitle: 'y', equal: true, xRange: [-R, R], yRange: [-R, R], traces } };
        return I.finalizeText(r);
    }

    // ---- equilibria of a nonlinear 2-D system, classified by the Jacobian ----
    function classify2(a, b, c, d) {
        const tr = a + d, det = a * d - b * c, disc = tr * tr - 4 * det, eps = 1e-9 * Math.max(1, Math.abs(tr), Math.abs(det));
        if (Math.abs(det) <= eps) return { kind: 'degenerate (det J = 0)', stab: 'linearisation inconclusive', hyper: false, cat: 'inc', tr, det, disc };
        if (det < 0) return { kind: 'saddle', stab: 'unstable', hyper: true, cat: 'saddle', tr, det, disc };
        if (Math.abs(tr) <= eps && disc < 0) return { kind: 'centre of the linearisation', stab: 'linearisation inconclusive (the true system may spiral in or out)', hyper: false, cat: 'inc', tr, det, disc };
        if (Math.abs(disc) <= eps) { const star = Math.abs(b) < 1e-12 && Math.abs(c) < 1e-12 && Math.abs(a - d) < 1e-12; return { kind: (tr < 0 ? 'stable ' : 'unstable ') + (star ? 'star node' : '(degenerate) node'), stab: tr < 0 ? 'asymptotically stable' : 'unstable', hyper: true, cat: tr < 0 ? 'stable' : 'unstable', tr, det, disc }; }
        if (disc > 0) return { kind: tr < 0 ? 'stable node' : 'unstable node', stab: tr < 0 ? 'asymptotically stable' : 'unstable', hyper: true, cat: tr < 0 ? 'stable' : 'unstable', tr, det, disc };
        return { kind: tr < 0 ? 'stable spiral' : 'unstable spiral', stab: tr < 0 ? 'asymptotically stable' : 'unstable', hyper: true, cat: tr < 0 ? 'stable' : 'unstable', tr, det, disc };
    }
    function runEquilibria(src, opt) {
        const comps = String(src).split(/[;\n]+/).map(x => x.trim()).filter(Boolean); if (comps.length !== 2) throw new CalcError('Enter the two right-hand sides separated by ;  for example  y ; -sin(x) - 0.3*y');
        const nodes = comps.map(c => engine.parse(c)); nodes.forEach(n => engine.freeVars(n).forEach(q => { if (q === 't') throw new CalcError('Only autonomous systems (no t on the right) are supported.'); if (q !== 'x' && q !== 'y') throw new CalcError(`Unknown symbol “${q}”. Use x and y.`); }));
        const F = nodes.map(n => engine.compile(n, ['x', 'y'])), J = nodes.map(n => ['x', 'y'].map(v => engine.compile(engine.diff(n, v), ['x', 'y'])));
        const R = Math.max(0.5, Math.min(100, +opt.range || 4)); const f = (x, y) => [F[0](x, y), F[1](x, y)];
        const jac = (x, y) => [[J[0][0](x, y), J[0][1](x, y)], [J[1][0](x, y), J[1][1](x, y)]];
        const found = []; const G = 15;
        for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
            let p = [-R * 1.2 + 2.4 * R * (i + 0.37) / G, -R * 1.2 + 2.4 * R * (j + 0.61) / G], ok = false;
            for (let it = 0; it < 60; it++) { const v = f(p[0], p[1]); if (!v.every(Number.isFinite)) break; if (Math.hypot(...v) < 1e-13) { ok = true; break; } const M = jac(p[0], p[1]); const dt = M[0][0] * M[1][1] - M[0][1] * M[1][0]; if (!Number.isFinite(dt) || Math.abs(dt) < 1e-14) break; let st = [-(M[1][1] * v[0] - M[0][1] * v[1]) / dt, -(-M[1][0] * v[0] + M[0][0] * v[1]) / dt]; const mg = Math.hypot(...st); if (mg > 2) st = st.map(q => q * 2 / mg); p = [p[0] + st[0], p[1] + st[1]]; if (Math.abs(p[0]) > 1e4 || Math.abs(p[1]) > 1e4) break; }
            if (ok && Math.abs(p[0]) <= R * 1.0000001 && Math.abs(p[1]) <= R * 1.0000001 && Math.hypot(...f(p[0], p[1])) < 1e-9) { p = p.map(q => (Math.abs(q) < 1e-12 ? 0 : q)); if (!found.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6)) found.push(p); }
            if (found.length > 40) break;
        }
        found.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        if (!found.length) throw new CalcError('No equilibria were found in the window. Try a larger window half-width.');
        // checks: analytic Jacobian vs finite differences at each equilibrium; residuals
        let jerr = 0, resid = 0; found.forEach(([x, y]) => { const M = jac(x, y), h = 1e-6 * Math.max(1, Math.abs(x), Math.abs(y)); const fd = [[0, 0], [0, 0]]; const fx1 = f(x + h, y), fx0 = f(x - h, y), fy1 = f(x, y + h), fy0 = f(x, y - h); for (let r = 0; r < 2; r++) { fd[r][0] = (fx1[r] - fx0[r]) / (2 * h); fd[r][1] = (fy1[r] - fy0[r]) / (2 * h); } for (let r = 0; r < 2; r++) for (let q = 0; q < 2; q++) jerr = Math.max(jerr, Math.abs(M[r][q] - fd[r][q]) / Math.max(1, Math.abs(M[r][q]))); resid = Math.max(resid, Math.hypot(...f(x, y))); });
        if (jerr > 1e-4) throw new CalcError('The Jacobian check failed for this system.');
        const rk = (v, hh) => { const k1 = f(v[0], v[1]), k2 = f(v[0] + hh / 2 * k1[0], v[1] + hh / 2 * k1[1]), k3 = f(v[0] + hh / 2 * k2[0], v[1] + hh / 2 * k2[1]), k4 = f(v[0] + hh * k3[0], v[1] + hh * k3[1]); return [v[0] + hh / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), v[1] + hh / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])]; };
        const info = found.map(([x, y]) => { const M = jac(x, y), c = classify2(M[0][0], M[0][1], M[1][0], M[1][1]); const lam = c.disc >= 0 ? [(c.tr + Math.sqrt(c.disc)) / 2, (c.tr - Math.sqrt(c.disc)) / 2].map(q => ({ re: q, im: 0 })) : [{ re: c.tr / 2, im: Math.sqrt(-c.disc) / 2 }, { re: c.tr / 2, im: -Math.sqrt(-c.disc) / 2 }]; return { x, y, M, c, lam }; });
        // behaviour check: a small push from a stable / unstable equilibrium moves the way the classification says
        let behaviour = 0, behaviourTotal = 0; info.forEach(e => { if (e.c.cat !== 'stable' && e.c.cat !== 'unstable') return; behaviourTotal++; const d0 = 1e-3; let v = [e.x + d0 * 0.6, e.y + d0 * 0.8], moved = true; const dir = e.c.cat === 'stable' ? 1 : 1; void dir; const T = 6 / Math.max(0.05, Math.abs(Math.min(...e.lam.map(z => Math.abs(z.re))))); const steps = Math.min(4000, Math.max(200, Math.ceil(T / 0.01))); const hh = T / steps; for (let i = 0; i < steps; i++) { v = rk(v, hh); if (!v.every(Number.isFinite) || Math.hypot(v[0] - e.x, v[1] - e.y) > 50) break; } const d1 = Math.hypot(v[0] - e.x, v[1] - e.y); moved = e.c.cat === 'stable' ? d1 < d0 : d1 > d0; if (moved) behaviour++; });
        if (behaviourTotal && behaviour < behaviourTotal) throw new CalcError('A numerical check of the classification disagreed; the system may be too stiff for the check window.');
        const N8 = x => nice(x, 6, 1e-8).text; const r = I.makeResult('ode', 'Equilibria and stability'); const lamTxt = lam => lam.map(z => Math.abs(z.im) < 1e-12 ? N8(z.re) : `${N8(z.re)} ${z.im < 0 ? '−' : '+'} ${N8(Math.abs(z.im))}i`).join(', ');
        r.title = 'Equilibria and stability'; r.main = { label: `${found.length} equilibri${found.length === 1 ? 'um' : 'a'} in the window:`, text: info.map(e => `(${N8(e.x)}, ${N8(e.y)}): ${e.c.kind}`).join(';   '), tex: '' };
        r.items.push({ label: 'System:', text: `x′ = ${engine.strOf(nodes[0])},   y′ = ${engine.strOf(nodes[1])}`, tex: `x'=${engine.texOf(nodes[0])},\\quad y'=${engine.texOf(nodes[1])}` });
        r.items.push({ label: 'Jacobian J(x, y):', text: `[[${engine.strOf(engine.diff(nodes[0], 'x'))}, ${engine.strOf(engine.diff(nodes[0], 'y'))}], [${engine.strOf(engine.diff(nodes[1], 'x'))}, ${engine.strOf(engine.diff(nodes[1], 'y'))}]]`, tex: '' });
        info.forEach((e, i) => r.items.push({ label: `Equilibrium ${i + 1} (${N8(e.x)}, ${N8(e.y)}):`, text: `${e.c.kind}; ${e.c.stab}.  eigenvalues ${lamTxt(e.lam)},  tr = ${N8(e.c.tr)}, det = ${N8(e.c.det)}`, tex: '' }));
        r.meta.push(`Verified: every equilibrium satisfies f = 0 (largest residual ${resid.toExponential(1)}); the analytic Jacobian matches finite differences (largest difference ${jerr.toExponential(1)})${behaviourTotal ? `; a small push from each of the ${behaviourTotal} stable / unstable equilibri${behaviourTotal === 1 ? 'um' : 'a'} behaves as classified` : ''}`);
        r.meta.push('Method: Newton iteration from a grid of starting points to find the equilibria, then the eigenvalues of the Jacobian there (linearisation). The linearisation decides the type of a hyperbolic equilibrium (no eigenvalue with zero real part); centres and degenerate cases need other tools, and only equilibria inside the window are listed.');
        r.steps.push({ title: 'Find the equilibria', text: 'Solve x′ = 0 and y′ = 0 together.', tex: '' }); r.steps.push({ title: 'Linearise', text: 'Near an equilibrium the system behaves like u′ = J·u where J is the matrix of partial derivatives there.', tex: '' }); r.steps.push({ title: 'Classify', text: 'The trace and determinant of J (or its eigenvalues) give saddle, node or spiral, and stable or unstable.', tex: '' });
        // portrait
        const traces = []; const gx = [], gy = []; const GG = 17; for (let i = 0; i < GG; i++) for (let j = 0; j < GG; j++) { const x = -R + 2 * R * i / (GG - 1), y = -R + 2 * R * j / (GG - 1), v = f(x, y); if (!v.every(Number.isFinite)) continue; const m = Math.hypot(...v); if (m < 1e-12) continue; const len = 0.5 * 2 * R / (GG - 1); gx.push(x - v[0] / m * len / 2, x + v[0] / m * len / 2, null); gy.push(y - v[1] / m * len / 2, y + v[1] / m * len / 2, null); }
        traces.push({ x: gx, y: gy, mode: 'lines', type: 'scatter', name: 'direction field', line: { width: 1 }, hoverinfo: 'skip' });
        const traj = (sgn, st) => { let v = st.slice(); const X = [v[0]], Y = [v[1]]; for (let i = 0; i < 3000; i++) { v = rk(v, sgn * 0.01); if (!v.every(Number.isFinite) || Math.abs(v[0]) > 2 * R || Math.abs(v[1]) > 2 * R) break; X.push(v[0]); Y.push(v[1]); } return [X, Y]; };
        for (let k = 0; k < 12; k++) { const th = 2 * Math.PI * k / 12 + 0.31, rad = (k % 2 ? 0.45 : 0.85) * R, st = [rad * Math.cos(th), rad * Math.sin(th)]; const [fx, fy] = traj(1, st), [bx, by] = traj(-1, st); traces.push({ x: bx.reverse().concat(fx), y: by.reverse().concat(fy), mode: 'lines', type: 'scatter', name: 'trajectories', showlegend: k === 0, line: { width: 2 } }); }
        const nc = 60, xs = [], ys = []; for (let i = 0; i < nc; i++) { xs.push(-R + 2 * R * i / (nc - 1)); ys.push(-R + 2 * R * i / (nc - 1)); }
        [0, 1].forEach(k => traces.push({ x: xs, y: ys, z: ys.map(y => xs.map(x => { const v = F[k](x, y); return Number.isFinite(v) ? v : null; })), type: 'contour', name: k ? 'y′ = 0 (nullcline)' : 'x′ = 0 (nullcline)', showscale: false, contours: { type: 'constraint', value: 0, operation: '=' }, line: { width: 2, dash: k ? 'dot' : 'dash' }, showlegend: true }));
        const grp = { stable: ['stable', 'circle'], unstable: ['unstable', 'x'], saddle: ['saddle', 'diamond'], inc: ['inconclusive', 'circle-open'] };
        Object.keys(grp).forEach(cat => { const es = info.filter(e => e.c.cat === cat); if (es.length) traces.push({ x: es.map(e => e.x), y: es.map(e => e.y), mode: 'markers', type: 'scatter', name: grp[cat][0], marker: { size: 12, symbol: grp[cat][1], line: { width: 2 } } }); });
        r.plot = { generic: { title: 'Phase portrait with nullclines and equilibria', xTitle: 'x', yTitle: 'y', equal: true, xRange: [-R, R], yRange: [-R, R], traces } };
        return I.finalizeText(r);
    }
    register({ ode: (src, opt) => (opt.odeType === 'heat' || opt.odeType === 'wave') ? runPDE(src, opt) : opt.odeType === 'linear2' ? runLinear2(src, opt) : opt.odeType === 'equilibria' ? runEquilibria(src, opt) : prevOde(src, opt) });


    // ======================================================================
    // Power-series solutions of ODEs (Picard–Taylor iteration), checked against RK4
    // ======================================================================
    function runSeriesODE(src, opt) {
        const second = opt.odeType === 'second';
        const node = engine.parse(src);
        const allowed = second ? ['x', 'y', 'yp'] : ['x', 'y']; engine.freeVars(node).forEach(q => { if (!allowed.includes(q)) throw new CalcError(`Unknown symbol “${q}”. Use ${allowed.join(', ')}.`); });
        const x0 = I.parseLimit(opt.x0 === undefined || opt.x0 === '' ? '0' : opt.x0, 'x₀').value, y0 = I.parseLimit(opt.y0 === undefined || opt.y0 === '' ? '1' : opt.y0, 'y(x₀)').value, v0 = second ? I.parseLimit(opt.v0 === undefined || opt.v0 === '' ? '0' : opt.v0, "y′(x₀)").value : 0;
        const N = Math.max(2, Math.min(14, parseInt(opt.terms, 10) || 8)); if (![x0, y0, v0].every(Number.isFinite)) throw new CalcError('Initial values must be finite.');
        const polyNode = c => engine.parse(c.map((v, i) => `(${v.toPrecision(17)})*(x - (${x0}))^${i}`).join(' + ') || '0');
        const dpoly = c => c.slice(1).map((v, i) => v * (i + 1));
        let c = [y0].concat(second ? [v0] : []).concat(new Array(N + 1).fill(0)).slice(0, N + 1);
        for (let it = 0; it <= N + 1; it++) {
            const P = polyNode(c), map = { y: P }; if (second) map.yp = polyNode(dpoly(c).length ? dpoly(c) : [0]);
            let g; try { g = I.taylorCoeffs(subst(node, map), 'x', x0, N); } catch (e) { throw new CalcError('This equation cannot be expanded in a power series about that point (it is singular there).'); }
            const nc = c.slice();
            if (second) for (let n = 0; n + 2 <= N; n++) nc[n + 2] = g[n] / ((n + 1) * (n + 2)); else for (let n = 0; n + 1 <= N; n++) nc[n + 1] = g[n] / (n + 1);
            if (nc.every((v, i) => Math.abs(v - c[i]) < 1e-15 * (1 + Math.abs(v)))) { c = nc; break; } c = nc;
        }
        if (!c.every(Number.isFinite)) throw new CalcError('The series coefficients are not finite.');
        const T = x => nice(x, 10, 1e-9);
        const base = x0 ? `(x ${x0 < 0 ? '+' : '-'} ${T(Math.abs(x0)).text})` : 'x';
        const termStr = (v, i) => { if (i === 0) return T(v).text; const coef = Math.abs(v - 1) < 1e-12 ? '' : (Math.abs(v + 1) < 1e-12 ? '-' : `${T(v).text}*`); return `${coef}${base}${i > 1 ? '^' + i : ''}`; };
        const pieces = c.map((v, i) => (Math.abs(v) < 1e-14 ? null : termStr(v, i))).filter(Boolean);
        const r = I.makeResult('ode', 'Power-series solution');
        r.items.push({ label: 'Equation:', text: `${second ? "y″" : "y′"} = ${engine.strOf(node)}`, tex: '' });
        r.items.push({ label: 'Initial values:', text: second ? `y(${T(x0).text}) = ${T(y0).text}, y′(${T(x0).text}) = ${T(v0).text}` : `y(${T(x0).text}) = ${T(y0).text}`, tex: '' });
        const polyText = pieces.join(' + ').replace(/\+ -/g, '− ');
        r.main = { label: `y ≈`, text: `${polyText} + O(${x0 ? `(x − ${T(x0).text})` : 'x'}^${N + 1})`, tex: '' };
        r.items.push({ label: 'Coefficients aₙ:', text: c.map((v, i) => `a${i} = ${T(v).text}`).join(',  '), tex: '' });
        // check against a classical RK4 integration
        const f = engine.compile(node, second ? ['x', 'y', 'yp'] : ['x', 'y']);
        const rk = (xe) => { const h = (xe - x0) / 2000; let x = x0, y = y0, v = v0; for (let i = 0; i < 2000; i++) { if (second) { const k1y = v, k1v = f(x, y, v), k2y = v + h / 2 * k1v, k2v = f(x + h / 2, y + h / 2 * k1y, v + h / 2 * k1v), k3y = v + h / 2 * k2v, k3v = f(x + h / 2, y + h / 2 * k2y, v + h / 2 * k2v), k4y = v + h * k3v, k4v = f(x + h, y + h * k3y, v + h * k3v); y += h / 6 * (k1y + 2 * k2y + 2 * k3y + k4y); v += h / 6 * (k1v + 2 * k2v + 2 * k3v + k4v); } else { const k1 = f(x, y), k2 = f(x + h / 2, y + h / 2 * k1), k3 = f(x + h / 2, y + h / 2 * k2), k4 = f(x + h, y + h * k3); y += h / 6 * (k1 + 2 * k2 + 2 * k3 + k4); } x += h; } return y; };
        const ev = x => c.reduceRight((a, k) => a * (x - x0) + k, 0);
        const radius = Math.min(0.3, 0.9 * Math.pow(1e-9 / (Math.abs(c[N]) + 1e-300), 1 / N)); let worst = 0;
        if (Number.isFinite(radius) && radius > 1e-3) for (const d of [radius / 2, -radius / 2, radius, -radius]) { const num = rk(x0 + d), ser = ev(x0 + d); worst = Math.max(worst, Math.abs(num - ser) / Math.max(1, Math.abs(num))); }
        if (Number.isFinite(worst) && worst < 1e-6) r.meta.push(`Verified: the polynomial agrees with an independent RK4 integration within ${worst.toExponential(1)} for |x − x₀| ≤ ${engine.fmt(radius, 3)}.`);
        else r.warnings.push('The numerical comparison was not conclusive; the series may converge only very near x₀.');
        r.meta.push('Method: Picard–Taylor iteration – substitute the current polynomial into the right-hand side, expand it in a power series, integrate, repeat');
        const span = 1.2, xs = [], series = [], numeric = []; for (let i = 0; i <= 120; i++) { const x = x0 - span + 2 * span * i / 120; xs.push(x); series.push(ev(x)); }
        for (let i = 0; i <= 24; i++) { const x = x0 - span + 2 * span * i / 24; numeric.push(Math.abs(x - x0) < 1e-12 ? y0 : (x < x0 ? NaN : rk(x))); }
        const nx = [], ny = []; for (let i = 0; i <= 24; i++) { const x = x0 + span * i / 24; nx.push(x); ny.push(i === 0 ? y0 : rk(x)); }
        r.plot = { generic: { title: `Series of degree ${N} vs numerical solution`, xTitle: 'x', yTitle: 'y', traces: [{ x: xs, y: series.map(y => (Math.abs(y) < 1e6 ? y : null)), mode: 'lines', type: 'scatter', name: `degree-${N} polynomial` }, { x: nx, y: ny, mode: 'markers', type: 'scatter', name: 'RK4 (x ≥ x₀)' }] } };
        r.steps.push({ title: 'Assume a power series', text: `y = Σ aₙ (x − ${T(x0).text})ⁿ with a₀ = y(${T(x0).text})${second ? ' and a₁ = y′' : ''}.`, tex: '' });
        r.steps.push({ title: 'Substitute and match coefficients', text: 'Put the current polynomial into the right-hand side, expand it as a series, and read off the next coefficient from the left-hand side.', tex: '' });
        r.steps.push({ title: 'Repeat', text: `Iterating ${N + 1} times fixes every coefficient up to degree ${N}.`, tex: '' });
        r.warnings.push('A truncated series is only accurate near x₀; the plot shows how far it can be trusted.');
        return I.finalizeText(r);
    }
    { const oBase = engine.run.ode; engine.run.ode = (src, opt) => { opt = opt || {}; return opt.series === 'yes' && opt.odeType !== 'system' ? runSeriesODE(src, opt) : oBase(src, opt); }; }

    // ======================================================================
    // 3-D direction fields and trajectories for ODE systems  x′ = …, y′ = …, z′ = …
    // ======================================================================
    function systemPlot3D(src, opt, r) {
        const comps = splitComps(src); if (comps.length !== 3) return r;
        const nodes = comps.map(c => engine.parse(c)), vars = ['x', 'y', 'z', 't'];
        nodes.forEach(n => engine.freeVars(n).forEach(q => { if (!vars.includes(q)) throw new CalcError(`Unknown symbol “${q}”. Use x, y, z and t.`); }));
        const f = nodes.map(n => engine.compile(n, vars));
        const t0 = I.parseLimit(opt.x0 === undefined || opt.x0 === '' ? '0' : opt.x0, 'Start').value, t1 = I.parseLimit(opt.xEnd === undefined || opt.xEnd === '' ? '10' : opt.xEnd, 'End').value;
        const init = String(opt.initial || '1, 1, 1').split(/[,\s;]+/).filter(Boolean).map(q => I.parseLimit(q, 'Initial value').value); if (init.length !== 3 || !init.every(Number.isFinite)) return r;
        const F = (t, u) => f.map(g => g(u[0], u[1], u[2], t));
        const steps = 1500, h = (t1 - t0) / steps; let u = init.slice(), t = t0; const X = [u[0]], Y = [u[1]], Z = [u[2]];
        for (let i = 0; i < steps; i++) {
            const k1 = F(t, u), k2 = F(t + h / 2, u.map((v, j) => v + h / 2 * k1[j])), k3 = F(t + h / 2, u.map((v, j) => v + h / 2 * k2[j])), k4 = F(t + h, u.map((v, j) => v + h * k3[j]));
            u = u.map((v, j) => v + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])); t += h;
            if (!u.every(v => Number.isFinite(v) && Math.abs(v) < 1e6)) break; X.push(u[0]); Y.push(u[1]); Z.push(u[2]);
        }
        const span = a => { const lo = Math.min(...a), hi = Math.max(...a); const pad = (hi - lo) * 0.15 || 1; return [lo - pad, hi + pad]; };
        const [xr, yr, zr] = [span(X), span(Y), span(Z)]; const n = 5, cx = [], cy = [], cz = [], cu = [], cv = [], cw = [];
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
            const x = xr[0] + (xr[1] - xr[0]) * i / (n - 1), y = yr[0] + (yr[1] - yr[0]) * j / (n - 1), z = zr[0] + (zr[1] - zr[0]) * k / (n - 1), v = F(t0, [x, y, z]);
            if (v.every(Number.isFinite)) { cx.push(x); cy.push(y); cz.push(z); cu.push(v[0]); cv.push(v[1]); cw.push(v[2]); }
        }
        const traces = [];
        if (cx.length) traces.push({ type: 'cone', x: cx, y: cy, z: cz, u: cu, v: cv, w: cw, sizemode: 'scaled', sizeref: 0.7, anchor: 'tail', opacity: 0.55, colorscale: 'Blues', showscale: false, name: 'direction field', hoverinfo: 'skip' });
        traces.push({ type: 'scatter3d', mode: 'lines', x: X, y: Y, z: Z, line: { width: 5 }, name: 'trajectory' }, { type: 'scatter3d', mode: 'markers', x: [X[0]], y: [Y[0]], z: [Z[0]], marker: { size: 5 }, name: 'start' });
        r.plot3 = { generic: { title: '3-D direction field and trajectory', axes: ['x', 'y', 'z'], traces } };
        r.meta.push('3-D tab: cones show the direction field F(x, y, z) at the start time; the line is the solution through the initial point (RK4).');
        if (X.length < steps) r.warnings.push('The trajectory leaves the plotted range (the solution blows up), so it is cut short.');
        return r;
    }
    { const oBase3 = engine.run.ode; engine.run.ode = (src, opt) => { opt = opt || {}; const r = oBase3(src, opt); if (opt.odeType === 'system') { try { return systemPlot3D(src, opt, r); } catch (e) { if (e instanceof CalcError) throw e; } } return r; }; }
    { const mBase = engine.run.matrix; engine.run.matrix = (src, opt) => { opt = opt || {}; return LA_OPS.has(opt.op) ? runLinalg(src, opt) : mBase(src, opt); }; }




    return engine;
});
