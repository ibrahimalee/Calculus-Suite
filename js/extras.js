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

    return engine;
});
