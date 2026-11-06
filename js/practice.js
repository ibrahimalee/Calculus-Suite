/*
 * Practice mode: generates problems with a verified answer, checks what the student types
 * (numerically, so any equivalent form is accepted) and serves hints from the engine's worked steps.
 * DOM-free: works in the page and in Node (tests).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = { create: factory };
    else root.Practice = { create: factory };
})(typeof self !== 'undefined' ? self : this, function create(engine, math) {
    'use strict';
    const { CalcError } = engine;

    function rngFrom(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    const TOPICS = [
        ['derivative', 'Derivatives'], ['integral', 'Indefinite integrals'], ['definite', 'Definite integrals'], ['limit', 'Limits'],
        ['equation', 'Equations'], ['matrix', 'Matrices'], ['number', 'Number theory'], ['stats', 'Statistics']
    ];

    // ---------- answer checking ----------------------------------------------------
    const SAMPLES = [0.37, 0.91, 1.43, 1.88, 2.31, 0.58, 1.17, 2.74, 3.19, 0.23];
    function parseStudent(txt) {
        const t = String(txt || '').trim();
        if (!t) throw new CalcError('Type your answer first.');
        if (t.length > 300) throw new CalcError('That answer is too long.');
        return engine.parse(t.replace(/^\s*(y|f\(x\)|F\(x\)|f'\(x\)|dy\/dx)\s*=\s*/, ''));
    }
    function sameFunction(studentNode, truthNode, vars) {
        const fs = engine.compile(studentNode, vars), ft = engine.compile(truthNode, vars);
        let ok = 0;
        for (let i = 0; i < SAMPLES.length; i++) {
            const pt = vars.map((_, k) => SAMPLES[(i + 3 * k) % SAMPLES.length]);
            const a = fs(...pt), b = ft(...pt);
            if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
            if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(b))) return false;
            ok++;
        }
        return ok >= 4;
    }
    function constValue(txt) {
        const node = parseStudent(txt);
        if (engine.freeVars(node).length) throw new CalcError('Give a number (fractions, π and e are fine, e.g. 3/4 or pi/2).');
        return engine.compile(node, [])();
    }
    const near = (a, b) => Number.isFinite(a) && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
    const numCheck = truth => ans => { let v; try { v = constValue(ans); } catch (e) { return { ok: false, msg: e.message }; } return near(v, truth) ? { ok: true } : { ok: false, msg: 'Not quite – check your arithmetic and try again.' }; };

    // ---------- generators ----------------------------------------------------------------
    const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
    const nz = (r, a, b) => { let v = 0; while (!v) v = ri(r, a, b); return v; };
    const sgn = (v, first) => (v < 0 ? '-' : (first ? '' : '+')) + (Math.abs(v) === 1 ? '' : Math.abs(v));
    const polyStr = (r, terms) => terms.map(([c, n], i) => { const cs = (c < 0 ? (i ? ' - ' : '-') : (i ? ' + ' : '')) + (Math.abs(c) === 1 && n !== 0 ? '' : Math.abs(c)); return n === 0 ? cs : cs + (Math.abs(c) === 1 ? '' : '*') + (n === 1 ? 'x' : `x^${n}`); }).join('');
    const tex = src => { try { return engine.texOf(engine.parse(src)); } catch (e) { return src; } };
    const stepsOf = (mode, src, opts) => () => { try { return engine.run[mode](src, opts || {}).steps.map(s => ({ title: s.title, text: s.text, tex: s.tex })); } catch (e) { return []; } };

    function genDerivative(level, r) {
        const a = nz(r, -5, 5), b = ri(r, 2, 5), c = nz(r, -4, 4), n = ri(r, 2, 6), m = ri(r, 1, 3);
        const L1 = [() => polyStr(r, [[a, n], [c, m], [ri(r, 1, 9), 0]]), () => `${Math.abs(a)}*x^${n} ${c < 0 ? '-' : '+'} ${Math.abs(c)}*x^${m + 1}`, () => `sqrt(x) + ${Math.abs(a)}*x`];
        const L2 = [() => `${Math.abs(a)}*sin(${b}*x)`, () => `e^(${a}*x)`, () => `x^${n}*sin(x)`, () => `ln(${b}*x + ${Math.abs(c)})`, () => `(${b}*x + ${Math.abs(c)})^${ri(r, 3, 5)}`, () => `x*e^x`, () => `${Math.abs(a)}*cos(x)*x^2`];
        const L3 = [() => `sin(x^2)*e^x`, () => `x/(x^2 + ${b})`, () => `atan(${b}*x)`, () => `sqrt(x^2 + ${b})`, () => `ln(sin(x))`, () => `e^(x^2)*cos(x)`, () => `(x^2 + 1)/(x - ${Math.abs(c)})`, () => `x^2*ln(x)`];
        const src = (level === 1 ? L1 : level === 2 ? L2 : L3)[ri(r, 0, (level === 1 ? L1 : level === 2 ? L2 : L3).length - 1)]();
        const node = engine.parse(src), truth = engine.diff(node, 'x');
        return {
            tex: `\\dfrac{d}{dx}\\left[${engine.texOf(node)}\\right]`, text: `d/dx [ ${src} ]`, input: 'expression', placeholder: 'f′(x) = …',
            answerText: engine.strOf(truth), answerTex: engine.texOf(truth),
            check: ans => { let s; try { s = parseStudent(ans); } catch (e) { return { ok: false, msg: e.message }; } const bad = engine.freeVars(s).filter(v => v !== 'x'); if (bad.length) return { ok: false, msg: `Use only x (found ${bad[0]}).` }; return sameFunction(s, truth, ['x']) ? { ok: true } : { ok: false, msg: 'That is not equal to the derivative. Which rule applies – power, product, quotient or chain?' }; },
            steps: stepsOf('derivative', src)
        };
    }
    function genIntegral(level, r) {
        const a = nz(r, -5, 5), b = ri(r, 2, 5), n = ri(r, 1, 5), c = ri(r, 1, 6);
        const L1 = [() => polyStr(r, [[a, n], [nz(r, -4, 4), 1], [ri(r, 1, 7), 0]]), () => `${Math.abs(a)}*x^${n} + ${c}`, () => `sqrt(x) + ${b}*x^2`];
        const L2 = [() => `${Math.abs(a)}*cos(${b}*x)`, () => `e^(${a}*x)`, () => `1/(${b}*x + ${c})`, () => `sin(${b}*x) + ${c}`, () => `${b}/(x + ${c})`, () => `e^(-x) + x`];
        const L3 = [() => `x*e^x`, () => `x*cos(x)`, () => `2*x*cos(x^2)`, () => `x*ln(x)`, () => `1/(x^2 + ${b * b})`, () => `x*e^(x^2)`, () => `x*sin(${b}*x)`, () => `3*x^2*e^(x^3)`];
        const pool = level === 1 ? L1 : level === 2 ? L2 : L3; const src = pool[ri(r, 0, pool.length - 1)]();
        const node = engine.parse(src); const f = engine.compile(node, ['x']);
        const res = engine.antiderivative(node, 'x', 'auto');
        return {
            tex: `\\displaystyle\\int ${engine.texOf(node)}\\,dx`, text: `∫ ${src} dx`, input: 'expression', placeholder: 'F(x) = …  (you may add + C)',
            answerText: res.ok ? engine.strOf(res.F) + ' + C' : '', answerTex: res.ok ? engine.texOf(res.F) + '+C' : '',
            check: ans => {
                let s; try { s = parseStudent(String(ans).replace(/\s*\+\s*[cC]\s*$/, '')); } catch (e) { return { ok: false, msg: e.message }; }
                const bad = engine.freeVars(s).filter(v => v !== 'x'); if (bad.length) return { ok: false, msg: `Use only x (found ${bad[0]}).` };
                const F = engine.compile(s, ['x']); let good = 0;
                for (const x of SAMPLES) { const h = 1e-5 * Math.max(1, Math.abs(x)); const d = (F(x + h) - F(x - h)) / (2 * h), t = f(x); if (!Number.isFinite(d) || !Number.isFinite(t)) continue; if (Math.abs(d - t) > 1e-4 * Math.max(1, Math.abs(t))) return { ok: false, msg: 'Differentiate your answer: it should give back the original function. Check the sign and constants.' }; good++; }
                return good >= 4 ? { ok: true } : { ok: false, msg: 'Could not test that answer on enough points.' };
            },
            steps: stepsOf('integral', src)
        };
    }
    function genDefinite(level, r) {
        const a = ri(r, 1, 4), k = ri(r, 1, 4);
        const pool = level === 1 ? [() => [`x^${k + 1}`, '0', String(a)], () => [`${k}*x + ${a}`, '0', '2'], () => [`x^2 + ${a}`, '0', '3']]
            : level === 2 ? [() => [`sin(x)`, '0', 'pi'], () => [`e^(${k}*x)`, '0', '1'], () => [`1/x`, '1', String(a + 1)], () => [`cos(${k}*x)`, '0', `pi/${2 * k}`]]
                : [() => [`x*e^x`, '0', '1'], () => [`x*cos(x)`, '0', 'pi/2'], () => [`1/(1 + x^2)`, '0', '1'], () => [`x*ln(x)`, '1', 'e'], () => [`e^(-x)`, '0', 'inf']];
        const [src, lo, hi] = pool[ri(r, 0, pool.length - 1)]();
        const res = engine.run.integral(src, { lower: lo, upper: hi });
        const num = parseFloat(String(res.main.text).replace(/[^\d.eE+-].*$/, '')) ;
        const truth = engine.compile(engine.parse(res.main.text.includes('≈') ? res.main.text.split('≈').pop().trim() : res.main.text.replace(/^.*=\s*/, '')), [])();
        const value = Number.isFinite(truth) ? truth : num;
        const upTex = hi === 'inf' ? '\\infty' : engine.texOf(engine.parse(hi)), loTex = engine.texOf(engine.parse(lo));
        return { tex: `\\displaystyle\\int_{${loTex}}^{${upTex}} ${engine.texOf(engine.parse(src))}\\,dx`, text: `∫ from ${lo} to ${hi} of ${src} dx`, input: 'number', placeholder: 'value (fractions, π, e allowed)', answerText: engine.fmt(value, 8), answerTex: engine.fmt(value, 8), check: numCheck(value), steps: stepsOf('integral', src, { lower: lo, upper: hi }) };
    }
    function genLimit(level, r) {
        const a = nz(r, -4, 4), b = ri(r, 2, 5), c = ri(r, 1, 5), d = ri(r, 1, 6);
        const pool = level === 1 ? [() => [`(x^2 - ${a * a})/(x - ${a})`, String(a)], () => [`(x^2 + ${b}*x)/x`, '0'], () => [`(${c}*x + ${d})/(x + 1)`, '2']]
            : level === 2 ? [() => [`sin(${b}*x)/x`, '0'], () => [`(1 - cos(x))/x^2`, '0'], () => [`(e^(${c}*x) - 1)/x`, '0'], () => [`ln(1 + ${b}*x)/x`, '0'], () => [`tan(${c}*x)/(${d}*x)`, '0']]
                : [() => [`(${b}*x^2 + ${c}*x)/(${d}*x^2 + 3)`, 'inf'], () => [`(1 + ${b}/x)^x`, 'inf'], () => [`sqrt(x^2 + ${b}*x) - x`, 'inf'], () => [`x*sin(${b}/x)`, 'inf'], () => [`(x - sin(x))/x^3`, '0']];
        const [src, pt] = pool[ri(r, 0, pool.length - 1)]();
        const res = engine.run.limit(src, { point: pt, direction: 'both' });
        const text = res.main.text.replace(/^.*=\s*/, '').trim();
        let value; try { value = engine.compile(engine.parse(text), [])(); } catch (e) { value = NaN; }
        if (!Number.isFinite(value)) return genLimit(level, r);
        return { tex: `\\displaystyle\\lim_{x\\to ${pt === 'inf' ? '\\infty' : pt}} ${engine.texOf(engine.parse(src))}`, text: `limit of ${src} as x → ${pt}`, input: 'number', placeholder: 'value (e.g. 1/2, e^2)', answerText: text, answerTex: engine.fmt(value, 8), check: numCheck(value), steps: stepsOf('limit', src, { point: pt }) };
    }
    function genEquation(level, r) {
        let src, roots;
        if (level === 1) { const a = nz(r, -6, 6), x = ri(r, -8, 8), b = ri(r, -9, 9); src = `${sgn(a, true)}*x ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${a * x + b}`.replace('1*x', 'x').replace('-1*x', '-x'); roots = [x]; }
        else if (level === 2) { const p = ri(r, -6, 6), q = ri(r, -6, 6); const s = -(p + q), t = p * q; src = `x^2 ${s < 0 ? '-' : '+'} ${Math.abs(s) === 1 ? '' : Math.abs(s)}x ${t < 0 ? '-' : '+'} ${Math.abs(t)} = 0`.replace(/\+ 0x/g, '').replace(/\+ 0 =/, '='); roots = Array.from(new Set([p, q])); }
        else { const p = ri(r, -4, 4), q = nz(r, 1, 3), s = ri(r, -4, 4), u = nz(r, 1, 3); const A = q * u, B = -(p * u + s * q), C = p * s; src = `${A === 1 ? '' : A}x^2 ${B < 0 ? '-' : '+'} ${Math.abs(B) === 1 ? '' : Math.abs(B)}x ${C < 0 ? '-' : '+'} ${Math.abs(C)} = 0`; roots = Array.from(new Set([p / q, s / u])); }
        const clean = src.replace(/\s+/g, ' ');
        return {
            tex: `${tex(clean.split('=')[0])}=${tex(clean.split('=')[1])}`, text: `Solve ${clean}`, input: 'list', placeholder: level === 1 ? 'x = …' : 'solutions, separated by commas',
            answerText: roots.map(x => engine.fmt(x, 8)).join(', '), answerTex: roots.map(x => engine.fmt(x, 8)).join(',\\;'),
            check: ans => { let vals; try { vals = String(ans).replace(/^\s*x\s*=\s*/, '').split(/[,;]|\band\b/).map(s => s.trim().replace(/^x\s*=\s*/, '')).filter(Boolean).map(constValue); } catch (e) { return { ok: false, msg: e.message }; } if (!vals.length) return { ok: false, msg: 'Type your solution(s).' }; const uniq = Array.from(new Set(vals.map(v => +v.toFixed(8)))); const need = roots.map(x => +x.toFixed(8)); if (uniq.length === need.length && need.every(x => uniq.some(y => Math.abs(x - y) < 1e-6))) return { ok: true }; if (uniq.every(y => need.some(x => Math.abs(x - y) < 1e-6)) && uniq.length < need.length) return { ok: false, msg: 'Correct so far – but there is another solution.' }; return { ok: false, msg: 'Substitute your value back into the equation – does both sides match?' }; },
            steps: stepsOf('solve', clean)
        };
    }
    function genMatrix(level, r) {
        const M = n => Array.from({ length: n }, () => Array.from({ length: n }, () => ri(r, -4, 5)));
        if (level === 3) { let A, d; do { A = M(2); d = A[0][0] * A[1][1] - A[0][1] * A[1][0]; } while (Math.abs(d) !== 1 && Math.abs(d) !== 2 && Math.abs(d) !== 5); const inv = [[A[1][1] / d, -A[0][1] / d], [-A[1][0] / d, A[0][0] / d]]; const s = A.map(x => x.join(' ')).join(' ; '); return { tex: `A^{-1}\\text{ for }A=\\begin{bmatrix}${A.map(x => x.join('&')).join('\\\\')}\\end{bmatrix}`, text: `Inverse of [${s}]`, input: 'matrix', placeholder: 'rows separated by ;  e.g. 1 2 ; 3 4 (fractions ok)', answerText: inv.map(x => x.map(v => engine.fmt(v, 6)).join(' ')).join(' ; '), answerTex: '', check: ans => { let rows; try { rows = String(ans).split(/[;\n]+/).map(x => x.trim()).filter(Boolean).map(x => x.split(/[\s,]+/).filter(Boolean).map(constValue)); } catch (e) { return { ok: false, msg: e.message }; } return rows.length === 2 && rows.every(x => x.length === 2) && rows.every((x, i) => x.every((v, j) => near(v, inv[i][j]))) ? { ok: true } : { ok: false, msg: 'Check: A·A⁻¹ should give the identity matrix.' }; }, steps: stepsOf('matrix', s, { op: 'inverse' }) }; }
        const n = level === 1 ? 2 : 3; const A = M(n); const d = Math.round(math.det(A)); const s = A.map(x => x.join(' ')).join(' ; ');
        return { tex: `\\det\\begin{bmatrix}${A.map(x => x.join('&')).join('\\\\')}\\end{bmatrix}`, text: `Determinant of [${s}]`, input: 'number', placeholder: 'det = …', answerText: String(d), answerTex: String(d), check: numCheck(d), steps: stepsOf('matrix', s, { op: 'det' }) };
    }
    const primes = [2, 3, 5, 7, 11, 13];
    function genNumber(level, r) {
        if (level === 1) { const g = ri(r, 2, 12), a = g * ri(r, 2, 9), b = g * ri(r, 2, 9); const gg = Number((function f(x, y) { return y ? f(y, x % y) : x; })(a, b)); return { tex: `\\gcd(${a},\\,${b})`, text: `gcd(${a}, ${b})`, input: 'number', placeholder: 'gcd = …', answerText: String(gg), answerTex: String(gg), check: numCheck(gg), steps: stepsOf('number', `${a}, ${b}`, { op: 'gcd' }) }; }
        if (level === 2) { const b = ri(r, 2, 12), e = ri(r, 5, 40), m = pick(r, [7, 11, 13, 17, 19]); let v = 1n; for (let i = 0; i < e; i++) v = v * BigInt(b) % BigInt(m); const val = Number(v); return { tex: `${b}^{${e}}\\bmod ${m}`, text: `${b}^${e} mod ${m}`, input: 'number', placeholder: 'remainder', answerText: String(val), answerTex: String(val), check: numCheck(val), steps: stepsOf('number', `${b}, ${e}, ${m}`, { op: 'powmod' }) }; }
        let n = 1; const fs = []; for (let i = 0; i < ri(r, 2, 4); i++) { const p = pick(r, primes); fs.push(p); n *= p; } if (n > 5000) n = 360;
        const ans = engine.run.number(String(n), { op: 'factor' }).main.text;
        return { tex: `\\text{Factor } ${n}`, text: `Prime factorisation of ${n}`, input: 'expression', placeholder: 'e.g. 2^3*3*5', answerText: ans.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, m => '^' + Array.from(m).map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join('')).replace(/ · /g, '*'), answerTex: ans, check: a => { let toks; try { const SUP = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 }; const parts = String(a).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, m => '^' + Array.from(m).map(c => SUP[c]).join('')).replace(/(\d)\s*x\s*(?=\d)/gi, '$1*').replace(/[×·]/g, '*').split('*').map(x => x.trim()).filter(Boolean); toks = parts.map(p => { const m = /^(\d+)(?:\s*\^\s*(\d+))?$/.exec(p); if (!m) throw new CalcError('Write the factorisation as a product like 2^3*3*5.'); return [Number(m[1]), m[2] ? Number(m[2]) : 1]; }); } catch (e) { return { ok: false, msg: e.message }; } const prod = toks.reduce((acc, [p, e]) => acc * Math.pow(p, e), 1); if (prod !== n) return { ok: false, msg: `Your factors multiply to ${prod}, not ${n}.` }; const isP = p => p > 1 && Array.from({ length: Math.floor(Math.sqrt(p)) - 1 }, (_, i) => i + 2).every(d => p % d); return toks.every(([p]) => isP(p)) ? { ok: true } : { ok: false, msg: 'The product is right, but some factors are not prime – keep factoring.' }; }, steps: stepsOf('number', String(n), { op: 'factor' }) };
    }
    const pick = (r, a) => a[Math.floor(r() * a.length)];
    function genStats(level, r) {
        const n = level === 1 ? 5 : level === 2 ? 7 : 8; const d = Array.from({ length: n }, () => ri(r, 1, 20));
        const mean = d.reduce((a, b) => a + b, 0) / n, s = d.slice().sort((a, b) => a - b), med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
        const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
        const kind = level === 1 ? 'mean' : level === 2 ? 'median' : 'sd'; const val = kind === 'mean' ? mean : kind === 'median' ? med : sd;
        const label = kind === 'mean' ? 'the mean' : kind === 'median' ? 'the median' : 'the sample standard deviation (n − 1), to 3 decimals';
        return { tex: `\\text{Data: } ${d.join(',\\;')}`, text: `Find ${label} of ${d.join(', ')}`, input: 'number', placeholder: kind === 'sd' ? '3 decimals is enough' : 'value', answerText: engine.fmt(val, 6), answerTex: engine.fmt(val, 6), prompt: `Find ${label}.`,
            check: a => { let v; try { v = constValue(a); } catch (e) { return { ok: false, msg: e.message }; } const tol = kind === 'sd' ? 0.0051 : 1e-6; return Math.abs(v - val) <= tol * Math.max(1, kind === 'sd' ? 1 : Math.abs(val)) ? { ok: true } : { ok: false, msg: kind === 'median' ? 'Sort the numbers first; the median is the middle one (average the two middle values if n is even).' : 'Not quite – re-check your sums.' }; }, steps: stepsOf('stats', d.join(' '), { op: 'describe' }) };
    }
    const GEN = { derivative: genDerivative, integral: genIntegral, definite: genDefinite, limit: genLimit, equation: genEquation, matrix: genMatrix, number: genNumber, stats: genStats };

    function generate(topic, level, seed) {
        if (!GEN[topic]) throw new CalcError('Unknown topic.');
        level = Math.max(1, Math.min(3, level | 0 || 1));
        for (let attempt = 0; attempt < 12; attempt++) {
            const r = rngFrom((seed >>> 0) + attempt * 7919);
            try { const p = GEN[topic](level, r); p.topic = topic; p.level = level; p.seed = seed; return p; } catch (e) { if (attempt === 11) throw e; }
        }
    }
    return { generate, TOPICS, rngFrom };
});
