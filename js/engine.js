/*
 * Calculus Suite Pro – computation engine
 *
 * Pure logic, no DOM access. Works in the browser (window.CalcEngine) and in
 * Node (module.exports) so that every feature can be unit-tested.
 *
 *   const engine = CalcEngine.create(math, Algebrite);
 *
 * Every public `run*` function returns a plain "result" object:
 *   { kind, title, main:{label,text,tex}, items:[], meta:[], warnings:[],
 *     steps:[{title,text,tex}], plot:{...}, text }
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = { create: factory };
    } else {
        root.CalcEngine = { create: factory };
    }
})(typeof self !== 'undefined' ? self : this, function create(math, Algebrite) {
    'use strict';

    class CalcError extends Error {}

    // ------------------------------------------------------------------
    // Parsing & validation
    // ------------------------------------------------------------------
    const FUNCS = new Set([
        'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'asin', 'acos', 'atan', 'atan2',
        'sinh', 'cosh', 'tanh', 'sech', 'csch', 'coth', 'asinh', 'acosh', 'atanh',
        'exp', 'log', 'log10', 'log2', 'sqrt', 'cbrt', 'abs', 'sign', 'floor', 'ceil',
        'round', 'min', 'max', 'pow', 'nthRoot', 'erf', 'gamma', 'factorial', 'mod', 'hypot', 'combinations', 'permutations', 'gcd', 'lcm'
    ]);
    const CONSTS = new Set(['pi', 'e', 'tau', 'phi', 'Infinity']);
    const ALLOWED_OPS = new Set(['+', '-', '*', '/', '^', '!', 'mod', '%']);
    const VAR_ORDER = 'xyztuvwrsabcdfghkmnpq';

    const ALIASES = {
        arcsin: 'asin', arccos: 'acos', arctan: 'atan', arcsinh: 'asinh', arccosh: 'acosh',
        arctanh: 'atanh', ln: 'log', lg: 'log10', cosec: 'csc', tg: 'tan', ctg: 'cot',
        sh: 'sinh', ch: 'cosh', th: 'tanh', sgn: 'sign'
    };

    const SUPERSCRIPTS = { '²': '^2', '³': '^3', '⁴': '^4', '⁵': '^5', '⁶': '^6' };

    function clean(src) {
        let s = String(src == null ? '' : src).trim();
        if (!s) return '';
        s = s.replace(/[²³⁴⁵⁶]/g, c => SUPERSCRIPTS[c])
            .replace(/π/g, ' pi ').replace(/∞/g, ' Infinity ')
            .replace(/[×·⋅]/g, '*').replace(/[−–—]/g, '-').replace(/÷/g, '/')
            .replace(/√\s*\(/g, 'sqrt(').replace(/√\s*([A-Za-z0-9_.]+)/g, 'sqrt($1)')
            .replace(/\*\*/g, '^')
            .replace(/\|([^|]+)\|/g, 'abs($1)')
            .replace(/\b(inf|infinity|oo)\b/gi, 'Infinity')
            .replace(/\bE\b(?!\w)/g, 'e');
        s = s.replace(/\b([A-Za-z][A-Za-z0-9]*)\s*\(/g, (m, name) => (ALIASES[name] || name) + '(');
        // sin^2(x) -> (sin(x))^2
        s = s.replace(/\b(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh)\s*\^\s*(\d+)\s*\(([^()]*)\)/g, '($1($3))^$2');
        return s;
    }

    function friendlyError(e) {
        let m = String(e && e.message ? e.message : e);
        m = m.replace(/\s*\(char \d+\)/, '');
        if (/Value expected/i.test(m)) m = 'Incomplete expression – something is missing (check operators and brackets)';
        if (/Parenthesis \) expected/i.test(m)) m = 'Missing closing bracket )';
        return m;
    }

    const S = name => new math.SymbolNode(name);
    const C = value => new math.ConstantNode(value);
    const OP = (o, fn, args, implicit) => new math.OperatorNode(o, fn, args, implicit);

    function validate(node) {
        node.traverse((n, path, parent) => {
            switch (n.type) {
                case 'ConstantNode':
                    if (typeof n.value !== 'number') throw new CalcError('Only numbers are allowed as constants');
                    break;
                case 'SymbolNode': {
                    const isFnName = parent && parent.type === 'FunctionNode' && path === 'fn';
                    if (isFnName) {
                        if (!FUNCS.has(n.name)) throw new CalcError(`Unknown function "${n.name}"`);
                    } else if (FUNCS.has(n.name)) {
                        throw new CalcError(`"${n.name}" needs an argument, e.g. ${n.name}(x)`);
                    } else if (!CONSTS.has(n.name) && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(n.name)) {
                        throw new CalcError(`Invalid symbol "${n.name}"`);
                    }
                    break;
                }
                case 'OperatorNode':
                    if (!ALLOWED_OPS.has(n.op) && !(n.fn === 'unaryMinus' || n.fn === 'unaryPlus' || n.fn === 'factorial')) {
                        throw new CalcError(`Operator "${n.op}" is not supported`);
                    }
                    break;
                case 'ParenthesisNode':
                case 'FunctionNode':
                    break;
                case 'AssignmentNode':
                    throw new CalcError('Enter an expression, not an equation – remove the "="');
                default:
                    throw new CalcError('Unsupported syntax: ' + n.type.replace('Node', ''));
            }
        });
    }

    /** Parse user text into a validated math.js AST. */
    function parse(src) {
        const cleaned = clean(src);
        if (!cleaned) throw new CalcError('Enter an expression');
        let node;
        try {
            node = math.parse(cleaned);
        } catch (e) {
            throw new CalcError(friendlyError(e));
        }
        // `x(x+1)` is parsed as a call of "x" – turn those back into multiplication
        node = node.transform(n => {
            if (n.type === 'FunctionNode') {
                const name = n.fn && n.fn.type === 'SymbolNode' ? n.fn.name : null;
                if (name && FUNCS.has(name)) return n;
                if (name && name.length === 1 && n.args.length === 1) {
                    return OP('*', 'multiply', [S(name), n.args[0]], true);
                }
                if (name) throw new CalcError(`Unknown function "${name}"`);
                if (n.args.length === 1) return OP('*', 'multiply', [n.fn, n.args[0]], true);
                throw new CalcError('Unsupported function call syntax');
            }
            return n;
        });
        validate(node);
        return node;
    }

    function unwrap(n) {
        while (n && n.type === 'ParenthesisNode') n = n.content;
        return n;
    }

    function freeVars(node) {
        const set = new Set();
        node.traverse((n, path, parent) => {
            if (n.type === 'SymbolNode' && !CONSTS.has(n.name) &&
                !(parent && parent.type === 'FunctionNode' && path === 'fn')) set.add(n.name);
        });
        return sortVars([...set]);
    }

    function sortVars(list) {
        const rank = v => { const i = VAR_ORDER.indexOf(v); return v.length === 1 && i >= 0 ? i : 100; };
        return list.slice().sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    }

    function dependsOn(node, v) {
        let found = false;
        node.traverse((n, path, parent) => {
            if (n.type === 'SymbolNode' && n.name === v && !(parent && parent.type === 'FunctionNode' && path === 'fn')) found = true;
        });
        return found;
    }

    function substitute(node, map) {
        return node.transform((n, path, parent) => {
            if (n.type === 'SymbolNode' && Object.prototype.hasOwnProperty.call(map, n.name) &&
                !(parent && parent.type === 'FunctionNode' && path === 'fn')) {
                const r = map[n.name];
                return typeof r === 'number' ? C(r) : (typeof r === 'string' ? S(r) : r.cloneDeep());
            }
            return n;
        });
    }

    // ------------------------------------------------------------------
    // Numeric evaluation
    // ------------------------------------------------------------------
    function toReal(r) {
        if (typeof r === 'number') return r;
        if (r && typeof r === 'object') {
            if (typeof r.re === 'number' && typeof r.im === 'number') {
                return Math.abs(r.im) <= 1e-12 * Math.max(1, Math.abs(r.re)) ? r.re : NaN;
            }
            if (typeof r.toNumber === 'function') return r.toNumber();
        }
        return NaN;
    }

    /** Compile a node into a fast (a,b,...) => number function. */
    function compile(node, vars) {
        const code = node.compile();
        const scope = {};
        const fn = function () {
            for (let i = 0; i < vars.length; i++) scope[vars[i]] = arguments[i];
            try { return toReal(code.evaluate(scope)); } catch (e) { return NaN; }
        };
        fn.vars = vars;
        return fn;
    }

    const SIMPLIFY_RULES = math.simplify.rules.concat([
        'sqrt(n)^2 -> n', 'exp(log(n)) -> n', 'log(exp(n)) -> n', 'sin(n)^2 + cos(n)^2 -> 1', 'cos(n)^2 + sin(n)^2 -> 1',
        'sqrt(n^2) -> abs(n)', 'n1 * sqrt(n2) / sqrt(n2) -> n1'
    ]);

    /** Exact bottom-up folding: integer arithmetic on constants and 0/1 identities (keeps fractions symbolic). */
    function foldConstants(node) {
        const isC = (n, val) => { n = unwrap(n); return n.type === 'ConstantNode' && (val === undefined || n.value === val); };
        const fold = n => {
            if (n.type === 'ParenthesisNode') { const inner = fold(n.content); return inner.type === 'ConstantNode' || inner.type === 'SymbolNode' ? inner : new math.ParenthesisNode(inner); }
            if (n.type !== 'OperatorNode' && n.type !== 'FunctionNode') return n;
            let m = n.map(fold);
            if (m.type !== 'OperatorNode') return m;
            const a = m.args;
            if (a.every(x => unwrap(x).type === 'ConstantNode')) {
                const v0 = a.map(x => { x = unwrap(x); return x.value; });
                let val;
                switch (m.fn) {
                    case 'add': val = v0[0] + v0[1]; break;
                    case 'subtract': val = v0[0] - v0[1]; break;
                    case 'multiply': val = v0[0] * v0[1]; break;
                    case 'divide': val = v0[0] / v0[1]; break;
                    case 'pow': val = Math.abs(v0[1]) <= 64 ? Math.pow(v0[0], v0[1]) : NaN; break;
                    case 'unaryMinus': val = -v0[0]; break;
                    default: val = NaN;
                }
                if (Number.isInteger(val) && Math.abs(val) < 1e15) return val < 0 ? OP('-', 'unaryMinus', [C(-val)]) : C(val);
            }
            switch (m.fn) {
                case 'multiply': if (a.some(x => isC(x, 0))) return C(0); if (isC(a[0], 1)) return a[1]; if (isC(a[1], 1)) return a[0]; break;
                case 'add': if (isC(a[0], 0)) return a[1]; if (isC(a[1], 0)) return a[0]; break;
                case 'subtract': if (isC(a[1], 0)) return a[0]; if (isC(a[0], 0)) return OP('-', 'unaryMinus', [a[1]]); break;
                case 'divide': if (isC(a[0], 0) && !isC(a[1], 0)) return C(0); if (isC(a[1], 1)) return a[0]; break;
                case 'pow': if (isC(a[1], 1)) return a[0]; if (isC(a[1], 0)) return C(1); break;
                default: break;
            }
            return m;
        };
        let cur = node;
        for (let i = 0; i < 3; i++) cur = fold(cur);
        return cur;
    }

    function simplifyNode(n) {
        try { n = foldConstants(n); } catch (e) { /* keep n */ }
        // math.simplify can take tens of seconds on very large trees – skip it when the budget is gone or the tree is huge
        try { n = math.simplifyCore(n); } catch (e) { /* keep n */ }   // fast constant folding: removes 0·x^(−1) style junk
        if (overBudget()) return n;
        let size = 0;
        n.traverse(() => { size++; });
        if (size > 90) return n;
        try { return math.simplify(n, SIMPLIFY_RULES); } catch (e) { return n; }
    }

    /**
     * One differentiation step with extra rules math.js lacks:
     *  - min/max/hypot/atan2/mod are rewritten into differentiable forms,
     *  - sign/floor/ceil/round/fix are piecewise constant (derivative 0 almost everywhere),
     *  - erf'(u) = 2/√π · e^(−u²) · u'.
     * Odd roots (cbrt, nthRoot) are kept real for negative arguments.
     */
    let phCounter = 0;
    function diffOnce(node, v) {
        const holes = []; // {sym, original, deriv|null}
        const FLAT = new Set(['sign', 'floor', 'ceil', 'round', 'fix']);
        const pass1 = node.transform(n => {
            if (n.type === 'OperatorNode' && (n.fn === 'mod' || n.op === '%') && n.args.length === 2) {
                const [a, b] = n.args;
                return OP('-', 'subtract', [a, OP('*', 'multiply', [b, new math.FunctionNode('floor', [OP('/', 'divide', [a, b])])])]);
            }
            if (n.type !== 'FunctionNode' || !n.fn) return n;
            const name = n.fn.name, a = n.args;
            const call = (nm, ...args) => new math.FunctionNode(nm, args);
            const sq = x => OP('^', 'pow', [new math.ParenthesisNode(x), C(2)]);
            if (name === 'hypot' && a.length === 2) return call('sqrt', OP('+', 'add', [sq(a[0]), sq(a[1])]));
            if (name === 'min' && a.length === 2) return OP('/', 'divide', [new math.ParenthesisNode(OP('-', 'subtract', [OP('+', 'add', [a[0], a[1]]), call('abs', OP('-', 'subtract', [a[0], a[1]]))])), C(2)]);
            if (name === 'max' && a.length === 2) return OP('/', 'divide', [new math.ParenthesisNode(OP('+', 'add', [OP('+', 'add', [a[0], a[1]]), call('abs', OP('-', 'subtract', [a[0], a[1]]))])), C(2)]);
            if (name === 'mod' && a.length === 2) return OP('-', 'subtract', [a[0], OP('*', 'multiply', [a[1], call('floor', OP('/', 'divide', [a[0], a[1]]))])]);
            if (name === 'atan2' && a.length === 2) {
                const [y, x] = a;
                return OP('*', 'multiply', [C(2), call('atan', OP('/', 'divide', [y, new math.ParenthesisNode(OP('+', 'add', [call('sqrt', OP('+', 'add', [sq(x), sq(y)])), x]))]))]);
            }
            return n;
        });
        const prep = pass1.transform(n => {
            if (n.type !== 'FunctionNode' || !n.fn) return n;
            const name = n.fn.name, a = n.args;
            const call = (nm, ...args) => new math.FunctionNode(nm, args);
            const sq = x => OP('^', 'pow', [new math.ParenthesisNode(x), C(2)]);
            if ((FLAT.has(name) || name === 'erf') && a.length === 1 && dependsOn(n, v)) {
                const sym = '__h' + (phCounter++);
                holes.push({ sym, original: n, deriv: name === 'erf' ? OP('*', 'multiply', [OP('/', 'divide', [C(2), call('sqrt', S('pi'))]), OP('*', 'multiply', [call('exp', OP('-', 'unaryMinus', [sq(a[0])])), new math.ParenthesisNode(diffOnce(a[0], v))])]) : null });
                return S(sym);
            }
            return n;
        });
        let d;
        try { d = math.derivative(prep, v, { simplify: false }); }
        catch (e) { throw new CalcError('Cannot differentiate: ' + friendlyError(e)); }
        holes.forEach(h => {
            if (!h.deriv) return;
            let dh; try { dh = math.derivative(prep, S(h.sym), { simplify: false }); } catch (e) { return; }
            d = OP('+', 'add', [new math.ParenthesisNode(d), OP('*', 'multiply', [new math.ParenthesisNode(dh), new math.ParenthesisNode(h.deriv)])]);
        });
        const map = {}; holes.forEach(h => { map[h.sym] = h.original; });
        return holes.length ? substitute(d, map) : d;
    }

    /** x^(p/q) with odd q becomes nthRoot(x, q)^p so negative arguments stay real. */
    function realRoots(node) {
        return node.transform(n => {
            if (n.type === 'OperatorNode' && n.fn === 'pow' && dependsOn(n.args[0], '__none__') === false) {
                const e = unwrap(n.args[1]);
                let num = null, den = null;
                if (e.type === 'OperatorNode' && e.fn === 'divide' && unwrap(e.args[0]).type === 'ConstantNode' && unwrap(e.args[1]).type === 'ConstantNode') { num = unwrap(e.args[0]).value; den = unwrap(e.args[1]).value; }
                else if (e.type === 'OperatorNode' && e.fn === 'divide' && unwrap(e.args[0]).type === 'OperatorNode' && unwrap(e.args[0]).fn === 'unaryMinus' && unwrap(unwrap(e.args[0]).args[0]).type === 'ConstantNode' && unwrap(e.args[1]).type === 'ConstantNode') { num = -unwrap(unwrap(e.args[0]).args[0]).value; den = unwrap(e.args[1]).value; }
                else if (e.type === 'OperatorNode' && e.fn === 'unaryMinus' && unwrap(e.args[0]).type === 'OperatorNode' && unwrap(e.args[0]).fn === 'divide') { const q = unwrap(e.args[0]); if (unwrap(q.args[0]).type === 'ConstantNode' && unwrap(q.args[1]).type === 'ConstantNode') { num = -unwrap(q.args[0]).value; den = unwrap(q.args[1]).value; } }
                if (num !== null && Number.isInteger(num) && Number.isInteger(den) && den > 1 && den % 2 === 1) {
                    const root = new math.FunctionNode('nthRoot', [n.args[0], C(den)]);
                    return OP('^', 'pow', [root, C(num)]);
                }
            }
            return n;
        });
    }

    /** n-th derivative via Algebrite's native d(f,x,n); accepted only if it agrees with independent power-series values. */
    function diffViaCAS(node, v, order) {
        if (!Algebrite || order < 2 || overBudget()) return null;
        let size = 0; node.traverse(() => { size++; });
        if (size > 60) return null;
        const others = freeVars(node).filter(q => q !== v);
        let towers = false;   // variable exponents (x^x) make repeated differentiation explode inside the CAS, which cannot be interrupted
        node.traverse(n => { if (n.type === 'OperatorNode' && n.fn === 'pow' && dependsOn(n.args[1], v)) towers = true; });
        if (order > 3 && towers) return null;
        if (order > 9) return null;
        if (others.length || /\^\s*\(?\d{3,}/.test(node.toString())) return null;   // huge exponents make big-integer CAS work crawl
        const out = runAlgebrite(`d(${toAlgebrite(node)}, ${v}, ${order})`);
        const cand = out && fromAlgebrite(out);
        if (!cand) return null;
        const fc = compile(cand, [v]);
        let good = 0;
        let fact = 1; for (let i = 2; i <= order; i++) fact *= i;
        for (const pt of [0.31, 0.77, 1.43, -0.55, 2.2]) {
            let truth;
            try { truth = taylorCoeffs(node, v, pt, order)[order] * fact; } catch (e) { continue; }
            const val = fc(pt);
            if (!Number.isFinite(truth) || !Number.isFinite(val)) continue;
            if (Math.abs(val - truth) > 1e-7 * Math.max(1, Math.abs(truth))) return null;
            good++;
        }
        return good >= 2 ? cand : null;
    }

    function diff(node, v, order) {
        if (!dependsOn(node, v)) return C(0);
        if ((order || 1) > 1) { const fast = diffViaCAS(node, v, order); if (fast) return fast; }
        let r = node;
        const hasOddRoot = /cbrt|nthRoot|\^\s*\(?-?\d+\s*\/\s*\d+/.test(node.toString());
        for (let i = 0; i < (order || 1); i++) {
            let size = 0; r.traverse(() => { size++; });
            if (size > 700) throw new CalcError('This derivative becomes too large to compute (the expression grows exponentially). Try a lower order or a simpler function.');
            r = simplifyNode(diffOnce(r, v));
            if (hasOddRoot) r = realRoots(r);
        }
        return r;
    }

    function numDeriv(f, x) {
        const h = 1e-4 * Math.max(1, Math.abs(x));
        return (-f(x + 2 * h) + 8 * f(x + h) - 8 * f(x - h) + f(x - 2 * h)) / (12 * h);
    }

    // ------------------------------------------------------------------
    // Formatting
    // ------------------------------------------------------------------
    function fmt(x, digits) {
        digits = digits == null ? 6 : digits;
        if (typeof x !== 'number' || Number.isNaN(x)) return 'undefined';
        if (x === Infinity) return '∞';
        if (x === -Infinity) return '-∞';
        if (x === 0) return '0';
        const a = Math.abs(x);
        if (a >= 1e9 || a < 1e-6) return x.toExponential(Math.max(1, digits - 1)).replace(/\.?0+e/, 'e');
        let s = a >= 1 ? x.toFixed(digits) : x.toPrecision(Math.max(1, digits));
        if (s.indexOf('e') < 0 && s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
        return s === '-0' ? '0' : s;
    }

    /** Recognise nice closed forms (integers, fractions, multiples of π). */
    function nice(x, digits, looseTol) {
        if (!Number.isFinite(x)) return { text: fmt(x), tex: x > 0 ? '\\infty' : x < 0 ? '-\\infty' : '\\text{undefined}' };
        const rtol = looseTol || 1e-9;
        const tol = rtol * Math.max(1, Math.abs(x));
        const maxDen = rtol <= 1e-8 ? 100000 : 24;   // looser tolerances would produce false fractions
        const tryFrac = (val) => {
            for (let d = 1; d <= maxDen; d++) {
                const n = Math.round(val * d);
                if (Math.abs(val - n / d) < (d > 1200 ? 1e-13 : d > 24 ? 1e-11 : rtol) * Math.max(1, Math.abs(val))) return [n, d];
            }
            return null;
        };
        if (Math.abs(x) < tol) return { text: '0', tex: '0' };
        const f = tryFrac(x);
        if (f) {
            const [n, d] = f;
            if (d === 1) return { text: String(n), tex: String(n) };
            return { text: `${n}/${d}`, tex: `${n < 0 ? '-' : ''}\\frac{${Math.abs(n)}}{${d}}` };
        }
        const p = tryFrac(x / Math.PI);
        if (p && p[1] <= 12) {
            const [n, d] = p;
            const coef = Math.abs(n) === 1 ? (n < 0 ? '-' : '') : String(n);
            return {
                text: d === 1 ? `${coef}π` : `${coef}π/${d}`,
                tex: d === 1 ? `${coef}\\pi` : `\\frac{${coef}\\pi}{${d}}`
            };
        }
        const s = fmt(x, digits);
        return { text: s, tex: s.replace(/e([+-]?\d+)/, '\\times 10^{$1}') };
    }

    /** Round a numerically-estimated value to a clean number (fractions / zero). */
    function snap(x) {
        if (!Number.isFinite(x)) return x;
        if (Math.abs(x) < 1e-5) return 0;
        for (let d = 1; d <= 24; d++) {
            const n = Math.round(x * d);
            if (Math.abs(x - n / d) < 2e-6 * Math.max(1, Math.abs(x))) return n / d;
        }
        return parseFloat(x.toPrecision(7));
    }

    function texOf(node) {
        try { return node.toTex({ parenthesis: 'auto', implicit: 'hide' }); } catch (e) { return String(node); }
    }
    function strOf(node) {
        const handler = n => (n.type === 'ConstantNode' && typeof n.value === 'number' && Number.isInteger(n.value) && Math.abs(n.value) < 1e15 ? String(n.value) : undefined);
        try { return node.toString({ parenthesis: 'auto', implicit: 'hide', handler }); } catch (e) { return String(node); }
    }

    // ------------------------------------------------------------------
    // Algebrite bridge
    // ------------------------------------------------------------------
    function toAlgebrite(node) {
        const t = node.transform((n, path, parent) => {
            if (n.type === 'FunctionNode') {
                const a = n.args, name = n.fn.name;
                const call = (nm, ...args) => new math.FunctionNode(nm, args);
                switch (name) {
                    case 'asin': case 'acos': case 'atan': case 'asinh': case 'acosh': case 'atanh':
                        return call('arc' + name.slice(1), a[0]);
                    case 'log10': return OP('/', 'divide', [call('log', a[0]), call('log', C(10))]);
                    case 'log2': return OP('/', 'divide', [call('log', a[0]), call('log', C(2))]);
                    case 'sec': return OP('/', 'divide', [C(1), call('cos', a[0])]);
                    case 'csc': return OP('/', 'divide', [C(1), call('sin', a[0])]);
                    case 'cot': return OP('/', 'divide', [call('cos', a[0]), call('sin', a[0])]);
                    case 'cbrt': return OP('^', 'pow', [a[0], OP('/', 'divide', [C(1), C(3)])]);
                    default: return n;
                }
            }
            if (n.type === 'SymbolNode' && !(parent && parent.type === 'FunctionNode' && path === 'fn')) {
                if (n.name === 'tau') return OP('*', 'multiply', [C(2), S('pi')]);
                if (n.name === 'phi') return OP('/', 'divide', [OP('+', 'add', [C(1), new math.FunctionNode('sqrt', [C(5)])]), C(2)]);
            }
            return n;
        });
        return t.toString({ parenthesis: 'all', implicit: 'show' }).replace(/\bInfinity\b/g, 'inf');
    }

    function runAlgebrite(cmd) {
        if (!Algebrite || overBudget() || cmd.length > 420) return null;
        if (/\d{8,}/.test(cmd) || /\d\s*\)?\s*\^\s*\(?\s*\d+(\.\d+)?\s*\)?\s*\^/.test(cmd) || /\^\s*\(?\s*\d{4,}/.test(cmd)) return null;   // constant towers / huge integers: exact bignum arithmetic never returns   // huge inputs can make Algebrite spin for minutes
        try {
            if (typeof Algebrite.clearall === 'function') Algebrite.clearall();
            const out = String(Algebrite.run(cmd)).trim();
            if (!out || /Stop|Unsupported|rror|integral\(|defint\(|taylor\(|nil|sorry|cannot|Parse|syntax|\?/i.test(out)) return null;
            return out;
        } catch (e) {
            return null;
        }
    }

    function fromAlgebrite(str) {
        const s = str.replace(/\barc(sin|cos|tan|sinh|cosh|tanh)\b/g, 'a$1');
        try { return parse(s); } catch (e) { return null; }
    }

    /** Simplify with the CAS but only accept the result if it is numerically equivalent. */
    function casSimplify(node, vars) {
        const out = runAlgebrite(toAlgebrite(node));
        const cand = out && fromAlgebrite(out);
        if (!cand) return simplifyNode(node);
        const a = compile(node, vars), b = compile(cand, vars);
        const pts = [0.3, 0.7, 1.2, 1.9, 0.45];
        let good = 0;
        for (const x of pts) {
            const args = vars.map((_, i) => x + i * 0.17);
            const va = a(...args), vb = b(...args);
            if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
            if (Math.abs(va - vb) > 1e-8 * Math.max(1, Math.abs(va))) return simplifyNode(node);
            good++;
        }
        return good >= 2 ? cand : simplifyNode(node);
    }

    /** Compact an intermediate derivative with the CAS so repeated differentiation does not blow up. */
    function casCompact(node, v) {
        const vars = freeVars(node);
        const out = Algebrite && !overBudget() ? (() => { try { if (typeof Algebrite.clearall === 'function') Algebrite.clearall(); return String(Algebrite.run(toAlgebrite(node))).trim(); } catch (e) { return null; } })() : null;
        if (!out || /Stop|Unsupported|rror|\?/.test(out)) return node;
        const cand = fromAlgebrite(out);
        if (!cand) return node;
        const a = compile(node, vars), b = compile(cand, vars);
        let good = 0;
        for (const x of [0.31, 0.77, 1.21, 1.88, -0.45, -1.3]) {
            const args = vars.map((_, i) => x + 0.11 * i), va = a(...args), vb = b(...args);
            if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
            if (Math.abs(va - vb) > 1e-8 * Math.max(1, Math.abs(va))) return node;
            good++;
        }
        void v;
        return good >= 2 ? cand : node;
    }

    /** Prefer the CAS-simplified form of a result when it is shorter (and numerically identical). */
    function tidy(node, vars) {
        let size = 0; node.traverse(() => { size++; });
        if (size > 70 || size < 4) return node;
        const alt = casSimplify(node, vars);
        return strOf(alt).length < strOf(node).length ? alt : node;
    }

    // ------------------------------------------------------------------
    // Integration (symbolic)
    // ------------------------------------------------------------------
    const TABLE = [
        ['sec(u)^2', 'tan(u)'], ['csc(u)^2', '-cot(u)'], ['sec(u)*tan(u)', 'sec(u)'], ['csc(u)*cot(u)', '-csc(u)'],
        ['sec(u)', 'log(abs(sec(u)+tan(u)))'], ['csc(u)', '-log(abs(csc(u)+cot(u)))'],
        ['tan(u)', '-log(abs(cos(u)))'], ['cot(u)', 'log(abs(sin(u)))'],
        ['sin(u)', '-cos(u)'], ['cos(u)', 'sin(u)'], ['exp(u)', 'exp(u)'],
        ['sinh(u)', 'cosh(u)'], ['cosh(u)', 'sinh(u)'], ['tanh(u)', 'log(cosh(u))'],
        ['1/u', 'log(abs(u))'], ['abs(u)', 'u*abs(u)/2'],
        ['asin(u)', 'u*asin(u)+sqrt(1-u^2)'], ['acos(u)', 'u*acos(u)-sqrt(1-u^2)'],
        ['atan(u)', 'u*atan(u)-log(1+u^2)/2'],
        ['1/(1+u^2)', 'atan(u)'], ['1/sqrt(1-u^2)', 'asin(u)'], ['1/sqrt(u^2+1)', 'asinh(u)'],
        ['sech(u)^2', 'tanh(u)'], ['log(u)', 'u*log(u)-u']
    ].map(([f, F]) => ({ f: math.parse(f), F: math.parse(F), fn: compile(math.parse(f), ['u']) }));

    const SAMPLE_U = [0.37, 0.61, 0.83, -0.29, 1.4, -1.9, 0.12, 2.3, -0.6, 0.45];

    function tableLookup(node, u) {
        const g = compile(node, [u]);
        for (const entry of TABLE) {
            let ratio = null, ok = true, count = 0;
            for (const x of SAMPLE_U) {
                const a = g(x), b = entry.fn(x);
                if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
                count++;
                if (Math.abs(b) < 1e-9) { if (Math.abs(a) > 1e-9) { ok = false; break; } continue; }
                const r = a / b;
                if (ratio === null) ratio = r;
                else if (Math.abs(r - ratio) > 1e-9 * Math.max(1, Math.abs(ratio))) { ok = false; break; }
            }
            if (ok && count >= 4 && ratio !== null && Math.abs(ratio) > 1e-12) {
                let F = substitute(entry.F, { u: S(u) });
                if (Math.abs(ratio - 1) > 1e-12) F = OP('*', 'multiply', [C(ratio), new math.ParenthesisNode(F)]);
                return simplifyNode(F);
            }
        }
        return null;
    }

    function absLogs(node) {
        return node.transform(n => {
            if (n.type === 'FunctionNode' && n.fn.name === 'log' && n.args.length === 1 &&
                !(unwrap(n.args[0]).type === 'FunctionNode' && unwrap(n.args[0]).fn.name === 'abs') &&
                !(n.args[0].type === 'ConstantNode')) {
                return new math.FunctionNode('log', [new math.FunctionNode('abs', [n.args[0]])]);
            }
            return n;
        });
    }

    let deadline = Infinity, budgetMs = 8000;
    const overBudget = () => Date.now() > deadline;

    const CHECK_POINTS = [-3.3, -2.1, -1.3, -0.7, -0.35, 0.35, 0.55, 0.9, 1.4, 2.2, 3.1, 4.6];

    /** Verify d/dv F == f numerically on sample points. */
    function checkAntiderivative(F, f, v) {
        const fF = compile(F, [v]), ff = compile(f, [v]);
        let good = 0, bad = 0;
        for (const x of CHECK_POINTS) {
            const a = numDeriv(fF, x), b = ff(x);
            if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(b) > 1e5) continue;
            if (Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(b))) good++; else bad++;
        }
        return bad === 0 && good >= 3;
    }

    /** ∫ expr d(u) using table + Algebrite. Returns node or null. */
    function integrateBasic(expr, u) {
        if (!dependsOn(expr, u)) return OP('*', 'multiply', [expr, S(u)]);
        const t = tableLookup(expr, u);
        if (t) return t;
        const out = runAlgebrite(`integral(${toAlgebrite(expr)}, ${u})`);
        const F = out && fromAlgebrite(out);
        if (F && checkAntiderivative(F, expr, u)) return F;
        const pf = integrateRational(expr, u);
        return pf ? pf.F : null;
    }

    function collectCandidates(node, v) {
        const seen = new Map();
        const add = g => {
            g = unwrap(g);
            if (!dependsOn(g, v)) return;
            if (g.type === 'SymbolNode') return;
            const k = g.toString();
            if (!seen.has(k)) seen.set(k, g);
        };
        node.traverse(n => {
            if (n.type === 'FunctionNode') { n.args.forEach(add); add(n); }
            if (n.type === 'OperatorNode' && n.op === '^') { add(n.args[0]); add(n.args[1]); if (!dependsOn(n.args[0], v) && dependsOn(n.args[1], v)) add(n); }
            if (n.type === 'OperatorNode' && n.fn === 'divide') add(n.args[1]);
        });
        // try larger (more complex) inner functions first
        return [...seen.values()].sort((a, b) => b.toString().length - a.toString().length);
    }

    function integrateBySubstitution(node, v) {
        for (const g of collectCandidates(node, v).slice(0, 8)) {
            if (overBudget()) return null;
            let dg;
            try { dg = diff(g, v); } catch (e) { continue; }
            if (dg.type === 'ConstantNode' && dg.value === 0) continue;
            const ratio = simplifyNode(OP('/', 'divide', [node, new math.ParenthesisNode(dg)]));
            const gf = compile(g, [v]), probe = [0.37, 0.91, 1.43, 2.17], gvals = probe.map(gf);
            const same = n => { if (n.type === 'SymbolNode' || n.type === 'ConstantNode' || !dependsOn(n, v)) return false; const nf = compile(n, [v]); return probe.every((x, i) => { const y = nf(x); return Number.isFinite(y) && Number.isFinite(gvals[i]) && Math.abs(y - gvals[i]) <= 1e-9 * Math.max(1, Math.abs(y)); }); };
            const replaced = ratio.transform(n => (same(n) ? S('u') : n));
            if (dependsOn(replaced, v)) continue;
            const G = integrateBasic(replaced, 'u');
            if (!G) continue;
            const back = substitute(G, { u: g });
            if (!checkAntiderivative(back, node, v)) continue;
            return { F: back, u: g, du: dg, inner: replaced, G };
        }
        return null;
    }

    function flattenProduct(node) {
        node = unwrap(node);
        if (node.type === 'OperatorNode' && node.fn === 'multiply') return node.args.flatMap(flattenProduct);
        return [node];
    }

    function liateRank(n, v) {
        n = unwrap(n);
        if (n.type === 'FunctionNode') {
            const name = n.fn.name;
            if (name === 'log' || name === 'log10' || name === 'log2') return 0;
            if (/^a(sin|cos|tan)/.test(name)) return 1;
            if (/^(sin|cos|tan|sec|csc|cot)h?$/.test(name)) return 3;
            if (name === 'exp') return 4;
            return 2;
        }
        if (n.type === 'OperatorNode' && n.op === '^' && !dependsOn(n.args[1], v)) return 2;
        if (n.type === 'OperatorNode' && n.op === '^') return 4;
        return 2;
    }

    function integrateByParts(node, v, depth, steps) {
        depth = depth || 0;
        if (depth > 3 || overBudget()) return null;
        let factors = flattenProduct(node);
        const constants = factors.filter(f => !dependsOn(f, v));
        factors = factors.filter(f => dependsOn(f, v));
        let scale = null;
        if (constants.length) scale = constants.length === 1 ? constants[0] : constants.reduce((a, b) => OP('*', 'multiply', [a, b]));
        let uPart, dvPart;
        if (factors.length === 1) {
            uPart = factors[0]; dvPart = C(1);
        } else if (factors.length >= 2) {
            const ranked = factors.map((f, i) => ({ f, i, r: liateRank(f, v) })).sort((a, b) => a.r - b.r || a.i - b.i);
            uPart = ranked[0].f;
            const rest = ranked.slice(1).map(x => x.f);
            dvPart = rest.reduce((a, b) => OP('*', 'multiply', [a, b]));
        } else {
            return null;
        }
        let V = dvPart.type === 'ConstantNode' ? OP('*', 'multiply', [dvPart, S(v)]) : integrateBasic(dvPart, v);
        if (!V) return null;
        V = simplifyNode(V);
        const du = diff(uPart, v);
        const next = simplifyNode(OP('*', 'multiply', [V, du]));
        let rest = integrateBasic(next, v) || integrateByParts(next, v, depth + 1, steps) ;
        if (rest && rest.F) rest = rest.F;
        if (!rest) return null;
        let F = OP('-', 'subtract', [OP('*', 'multiply', [uPart, V]), new math.ParenthesisNode(rest)]);
        if (scale) F = OP('*', 'multiply', [scale, new math.ParenthesisNode(F)]);
        F = simplifyNode(F);
        if (!checkAntiderivative(F, node, v)) return null;
        steps.push({
            title: `Integration by parts (round ${depth + 1})`,
            text: `Choose u = ${strOf(uPart)} and dv = ${strOf(dvPart)} dx (LIATE rule). Then du = ${strOf(du)} dx and v = ${strOf(V)}.`,
            tex: `u=${texOf(uPart)},\\; dv=${texOf(dvPart)}\\,d${v} \\;\\Rightarrow\\; du=${texOf(du)}\\,d${v},\\; v=${texOf(V)}`
        });
        steps.push({
            title: 'Apply ∫u dv = uv − ∫v du',
            text: `The remaining integral is ∫ ${strOf(next)} d${v}.`,
            tex: `\\int ${texOf(next)}\\,d${v}`
        });
        return { F };
    }


    /** Equivalent forms of an integrand that standard methods handle better. */
    function trigRewrites(node, v) {
        const out = [];
        const lin = g => { try { const d = diff(g, v); return d.type === 'ConstantNode' || (!dependsOn(d, v) && Number.isFinite(compile(d, [])())); } catch (e) { return false; } };
        const call = (nm, ...a) => new math.FunctionNode(nm, a);
        const half = x => OP('/', 'divide', [new math.ParenthesisNode(x), C(2)]);
        // tan^2 / cot^2
        const sq = node.transform(n => {
            if (n.type === 'OperatorNode' && n.fn === 'pow' && unwrap(n.args[1]).type === 'ConstantNode' && unwrap(n.args[1]).value === 2) {
                const b = unwrap(n.args[0]);
                if (b.type === 'FunctionNode' && b.fn.name === 'tan') return new math.ParenthesisNode(OP('-', 'subtract', [OP('^', 'pow', [call('sec', b.args[0]), C(2)]), C(1)]));
                if (b.type === 'FunctionNode' && b.fn.name === 'cot') return new math.ParenthesisNode(OP('-', 'subtract', [OP('^', 'pow', [call('csc', b.args[0]), C(2)]), C(1)]));
            }
            return n;
        });
        if (sq.toString() !== node.toString()) out.push({ node: sq, note: 'Rewrite tan² = sec² − 1 (and cot² = csc² − 1)' });
        // product of two sin/cos with linear arguments -> sum
        const f = flattenProduct(node), dep = f.filter(x => dependsOn(x, v)), k = f.filter(x => !dependsOn(x, v));
        const isTrig = x => x.type === 'FunctionNode' && (x.fn.name === 'sin' || x.fn.name === 'cos') && lin(x.args[0]);
        if (dep.length === 2 && dep.every(isTrig)) {
            const [p, q] = dep, A1 = p.args[0], B1 = q.args[0], np = p.fn.name, nq = q.fn.name;
            const plus = call(np === nq ? 'cos' : 'sin', OP('+', 'add', [A1, B1]).cloneDeep()), minus = n => n;
            void plus; void minus;
            let r;
            const sumAB = OP('+', 'add', [A1, B1]), difAB = OP('-', 'subtract', [A1, B1]), difBA = OP('-', 'subtract', [B1, A1]);
            if (np === 'sin' && nq === 'cos') r = half(OP('+', 'add', [call('sin', sumAB), call('sin', difAB)]));
            else if (np === 'cos' && nq === 'sin') r = half(OP('+', 'add', [call('sin', sumAB), call('sin', difBA)]));
            else if (np === 'sin' && nq === 'sin') r = half(OP('-', 'subtract', [call('cos', difAB), call('cos', sumAB)]));
            else r = half(OP('+', 'add', [call('cos', difAB), call('cos', sumAB)]));
            const scaled = k.length ? OP('*', 'multiply', [k.reduce((a, b) => OP('*', 'multiply', [a, b])), r]) : r;
            out.push({ node: scaled, note: 'Product-to-sum identity turns the product into a sum of sines/cosines' });
        }
        return out;
    }

    /** ∫ k·e^(ax+c)·sin/cos(bx+d) dx in closed form (integration by parts twice, solved for the integral). */
    function integrateExpTrig(node, v) {
        const f = flattenProduct(node), dep = f.filter(x => dependsOn(x, v)), k = f.filter(x => !dependsOn(x, v));
        if (dep.length !== 2) return null;
        const expArg = x => {   // exp(L) or c^L  ->  exponent expressed as a linear-in-v node
            x = unwrap(x);
            if (x.type === 'FunctionNode' && x.fn.name === 'exp') return x.args[0];
            if (x.type === 'OperatorNode' && x.fn === 'pow' && !dependsOn(x.args[0], v) && dependsOn(x.args[1], v)) return OP('*', 'multiply', [new math.ParenthesisNode(x.args[1]), new math.FunctionNode('log', [x.args[0]])]);
            return null;
        };
        const ex = dep.find(x => expArg(x)), tr = dep.find(x => x.type === 'FunctionNode' && (x.fn.name === 'sin' || x.fn.name === 'cos'));
        if (!ex || !tr) return null;
        let a, b;
        try { const da = diff(expArg(ex), v), db = diff(tr.args[0], v); if (dependsOn(da, v) || dependsOn(db, v)) return null; a = compile(da, [])(); b = compile(db, [])(); } catch (e) { return null; }
        if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) < 1e-12 || Math.abs(b) < 1e-12) return null;
        const den = a * a + b * b, call = (nm, ...x) => new math.FunctionNode(nm, x);
        const th = tr.args[0];
        const inner = tr.fn.name === 'sin'
            ? OP('-', 'subtract', [OP('*', 'multiply', [C(a), call('sin', th)]), OP('*', 'multiply', [C(b), call('cos', th)])])
            : OP('+', 'add', [OP('*', 'multiply', [C(a), call('cos', th)]), OP('*', 'multiply', [C(b), call('sin', th)])]);
        let F = OP('/', 'divide', [OP('*', 'multiply', [ex, new math.ParenthesisNode(inner)]), C(den)]);
        if (k.length) F = OP('*', 'multiply', [k.reduce((x, y) => OP('*', 'multiply', [x, y])), new math.ParenthesisNode(F)]);
        F = simplifyNode(F);
        if (!checkAntiderivative(F, node, v)) return null;
        return { F, a, b };
    }

    /**
     * Symbolic antiderivative. method: 'auto' | 'substitution' | 'parts' | 'cas'
     * Returns { ok, F (node), method, steps[] } – F has no +C.
     */
    function antiderivative(node, v, method) {
        method = method || 'auto';
        if (deadline === Infinity) deadline = Date.now() + budgetMs;
        try { return antiderivativeInner(node, v, method); } finally { deadline = Infinity; }
    }

    function antiderivativeInner(node, v, method) {
        const steps = [];
        const finish = (F, label, extra) => {
            const fnode = compile(node, [v]);
            const negDomain = CHECK_POINTS.some(x => x < 0 && Number.isFinite(fnode(x)));
            if (negDomain) { const G = absLogs(F); if (checkAntiderivative(G, node, v)) F = G; }
            return { ok: true, F, method: label, steps: (extra || []).concat(steps) };
        };
        if (!dependsOn(node, v)) {
            const F = simplifyNode(OP('*', 'multiply', [node, S(v)]));
            return { ok: true, F, method: 'Constant rule', steps: [{ title: 'Constant rule', text: `∫ c dx = c·x`, tex: `\\int c\\,d${v}=c${v}` }] };
        }
        if (method === 'auto' || method === 'table') {
            const t = tableLookup(node, v);
            if (t) return finish(t, 'Standard integral table', [{ title: 'Standard form', text: 'The integrand matches a known integral.', tex: `\\int ${texOf(node)}\\,d${v}=${texOf(absLogs(t))}` }]);
        }
        if (method === 'auto' || method === 'parts') {
            const et = integrateExpTrig(node, v);
            if (et) return finish(et.F, 'Integration by parts (twice, solved for the integral)', [
                { title: 'Cyclic integration by parts', text: `Integrating e^(ax)·trig twice returns the original integral, so solve for it: with a = ${fmt(et.a)}, b = ${fmt(et.b)} the result carries the factor 1/(a² + b²) = 1/${fmt(et.a * et.a + et.b * et.b)}.`, tex: `\\int e^{ax}\\sin(bx)\\,dx=\\frac{e^{ax}(a\\sin bx-b\\cos bx)}{a^2+b^2}` }
            ]);
        }
        if (method === 'auto' || method === 'partial') {
            const pf = integrateRational(node, v);
            if (pf) return finish(pf.F, 'Partial fractions', pf.steps);
        }
        if (method === 'auto' || method === 'cas') {
            const out = runAlgebrite(`integral(${toAlgebrite(node)}, ${v})`);
            const F = out && fromAlgebrite(out);
            if (F && checkAntiderivative(F, node, v)) {
                const pre = [{ title: 'Symbolic integration', text: 'Applied the computer-algebra integrator (linearity, power rule, standard forms, partial fractions, reduction).', tex: '' }];
                return finish(F, 'Computer algebra (Algebrite)', pre);
            }
        }
        if (method === 'auto' || method === 'substitution') {
            const r = integrateBySubstitution(node, v);
            if (r) {
                const pre = [
                    { title: 'u-substitution', text: `Let u = ${strOf(r.u)}, so du = ${strOf(r.du)} dx.`, tex: `u=${texOf(r.u)},\\quad du=${texOf(r.du)}\\,d${v}` },
                    { title: 'Rewrite in terms of u', text: `The integral becomes ∫ ${strOf(r.inner)} du.`, tex: `\\int ${texOf(r.inner)}\\,du` },
                    { title: 'Integrate', text: `∫ ${strOf(r.inner)} du = ${strOf(absLogs(r.G))}`, tex: `${texOf(absLogs(r.G))}` },
                    { title: 'Substitute back', text: `Replace u with ${strOf(r.u)}.`, tex: `${texOf(absLogs(r.F))}` }
                ];
                return finish(r.F, 'U-substitution', pre);
            }
        }
        if (method === 'auto') {
            for (const rw of trigRewrites(node, v)) {
                const sub = antiderivativeInner(rw.node, v, 'auto');
                if (sub.ok && checkAntiderivative(sub.F, node, v)) return finish(sub.F, sub.method, [{ title: 'Rewrite the integrand', text: rw.note + ': ' + strOf(rw.node), tex: texOf(rw.node) }].concat(sub.steps));
            }
        }
        if (method === 'auto' || method === 'parts') {
            const r = integrateByParts(node, v, 0, steps);
            if (r) {
                steps.reverse();
                return finish(r.F, 'Integration by parts', []);
            }
            steps.length = 0;
        }
        return { ok: false, method, steps: [] };
    }


    // ------------------------------------------------------------------
    // Rational functions: polynomial division + partial fractions
    // ------------------------------------------------------------------
    const polyTrim = p => { p = p.slice(); while (p.length > 1 && Math.abs(p[p.length - 1]) < 1e-13) p.pop(); return p; };
    const polyAdd = (a, b) => { const n = Math.max(a.length, b.length), r = []; for (let i = 0; i < n; i++) r.push((a[i] || 0) + (b[i] || 0)); return polyTrim(r); };
    const polyScale = (a, k) => polyTrim(a.map(c => c * k));
    const polyMul = (a, b) => { const r = new Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] += x * y; })); return polyTrim(r); };
    const polyEval = (p, x) => p.reduceRight((acc, c) => acc * x + c, 0);
    function polyDivMod(n, d) {
        n = polyTrim(n); d = polyTrim(d);
        if (n.length < d.length) return [[0], n];
        const q = new Array(n.length - d.length + 1).fill(0), r = n.slice();
        for (let i = n.length - d.length; i >= 0; i--) {
            const c = r[i + d.length - 1] / d[d.length - 1];
            q[i] = c;
            for (let j = 0; j < d.length; j++) r[i + j] -= c * d[j];
        }
        return [polyTrim(q), polyTrim(r.slice(0, Math.max(1, d.length - 1)))];
    }

    /** AST -> {n, d} polynomial fraction in v, or null when the expression is not rational. */
    function toRational(node, v) {
        const one = [1];
        const make = (n, d) => ({ n: polyTrim(n), d: polyTrim(d) });
        const add = (a, b) => make(polyAdd(polyMul(a.n, b.d), polyMul(b.n, a.d)), polyMul(a.d, b.d));
        const mul = (a, b) => make(polyMul(a.n, b.n), polyMul(a.d, b.d));
        const inv = a => (a.n.length === 1 && Math.abs(a.n[0]) < 1e-14 ? null : make(a.d, a.n));
        const rec = n => {
            n = unwrap(n);
            if (n.type === 'ConstantNode') return make([n.value], one);
            if (n.type === 'SymbolNode') {
                if (n.name === v) return make([0, 1], one);
                if (CONSTS.has(n.name)) { const c = compile(n, [])(); return Number.isFinite(c) ? make([c], one) : null; }
                return null; // other free symbols – treat as non-rational for simplicity
            }
            if (n.type !== 'OperatorNode') return null;
            const a = n.args.map(rec);
            if (a.some(x => !x)) return null;
            switch (n.fn) {
                case 'add': return add(a[0], a[1]);
                case 'subtract': return add(a[0], make(polyScale(a[1].n, -1), a[1].d));
                case 'unaryMinus': return make(polyScale(a[0].n, -1), a[0].d);
                case 'unaryPlus': return a[0];
                case 'multiply': return a.reduce((x, y) => mul(x, y));
                case 'divide': { const iv = inv(a[1]); return iv ? mul(a[0], iv) : null; }
                case 'pow': {
                    const e = unwrap(n.args[1]);
                    if (e.type === 'OperatorNode' && e.fn === 'unaryMinus' && unwrap(e.args[0]).type === 'ConstantNode') {
                        const k = unwrap(e.args[0]).value;
                        if (!Number.isInteger(k) || k > 12) return null;
                        let r = make(one, one); for (let i = 0; i < k; i++) r = mul(r, a[0]);
                        return inv(r);
                    }
                    if (e.type !== 'ConstantNode' || !Number.isInteger(e.value) || e.value < 0 || e.value > 12) return null;
                    let r = make(one, one); for (let i = 0; i < e.value; i++) r = mul(r, a[0]);
                    return r;
                }
                default: return null;
            }
        };
        return rec(node);
    }

    /** All complex roots of a polynomial (Aberth/Durand–Kerner), returned as [{re, im}]. */
    function polyRoots(p) {
        p = polyTrim(p);
        const n = p.length - 1;
        if (n < 1) return [];
        const lead = p[n], c = p.map(x => x / lead);
        const f = z => { let re = 1, im = 0; for (let i = n - 1; i >= 0; i--) { const r2 = re * z[0] - im * z[1] + c[i], i2 = re * z[1] + im * z[0]; re = r2; im = i2; } return [re, im]; };
        const R = 1 + Math.max(...c.slice(0, n).map(Math.abs));
        let z = [];
        for (let k = 0; k < n; k++) { const t = 2 * Math.PI * k / n + 0.4; z.push([R * 0.5 * Math.cos(t), R * 0.5 * Math.sin(t)]); }
        for (let it = 0; it < 2000; it++) {
            let delta = 0;
            for (let i = 0; i < n; i++) {
                const [fr, fi] = f(z[i]);
                let dr = 1, di = 0;
                for (let j = 0; j < n; j++) {
                    if (j === i) continue;
                    const ar = z[i][0] - z[j][0], ai = z[i][1] - z[j][1];
                    const nr = dr * ar - di * ai, ni = dr * ai + di * ar; dr = nr; di = ni;
                }
                const den = dr * dr + di * di || 1e-300;
                const qr = (fr * dr + fi * di) / den, qi = (fi * dr - fr * di) / den;
                z[i] = [z[i][0] - qr, z[i][1] - qi];
                delta = Math.max(delta, Math.hypot(qr, qi));
            }
            if (delta < 1e-15 * Math.max(1, R)) break;
        }
        return z.map(([re, im]) => ({ re, im }));
    }


    // ---- square-free decomposition (Yun) so repeated roots stay exact -----------------
    const trimRel = (p, tol) => { p = p.slice(); const mx = Math.max(...p.map(Math.abs), 0); while (p.length > 1 && Math.abs(p[p.length - 1]) <= tol * mx) p.pop(); return p; };
    const polyDeriv = p => (p.length <= 1 ? [0] : p.slice(1).map((c, i) => c * (i + 1)));
    const polySub = (a, b) => {   // subtraction with cancellation noise removed (relative to the operands)
        const n = Math.max(a.length, b.length), r = [], mx = Math.max(...a.map(Math.abs), ...b.map(Math.abs), 1e-300);
        for (let i = 0; i < n; i++) { const v = (a[i] || 0) - (b[i] || 0); r.push(Math.abs(v) <= 1e-9 * mx ? 0 : v); }
        return r;
    };
    function polyGcd(a, b) {
        const monic = q => { const l = q[q.length - 1]; return q.map(c => c / l); };
        a = trimRel(a, 1e-12); b = trimRel(b, 1e-12);
        if (a.length < b.length) [a, b] = [b, a];
        if (b.length === 1 && Math.abs(b[0]) <= 1e-12 * Math.max(...a.map(Math.abs), 1)) return monic(a);
        a = monic(a); b = monic(b);
        for (let guard = 0; guard < 80; guard++) {
            if (b.length === 1) return [1];                       // non-zero constant remainder: coprime
            const [, rem] = polyDivMod(a, b);
            const size = Math.max(...a.map(Math.abs), ...b.map(Math.abs));
            const r = rem.slice();
            while (r.length > 1 && Math.abs(r[r.length - 1]) <= 1e-8 * size) r.pop();
            if (r.length === 1 && Math.abs(r[0]) <= 1e-8 * size) return b;   // remainder is numerically zero → b is the gcd
            a = b; b = monic(r);
        }
        return [1];
    }
    /** Complex roots with exact multiplicities: [{re, im, mult}] (conjugates listed separately). */
    function polyRootsMult(p) {
        p = trimRel(p, 1e-13);
        const deg = p.length - 1;
        if (deg < 1) return [];
        try {
            let a = polyGcd(p, polyDeriv(p));
            let b = polyDivMod(p, a)[0], c = polyDivMod(polyDeriv(p), a)[0];
            let d = polySub(c, polyDeriv(b));
            const out = []; let i = 1, total = 0;
            while (b.length > 1 && i <= deg) {
                const ai = polyGcd(b, d);
                if (ai.length > 1) {
                    polyRoots(ai).forEach(z => { out.push({ re: z.re, im: z.im, mult: i }); });
                    total += (ai.length - 1) * i;
                }
                b = polyDivMod(b, ai)[0]; c = polyDivMod(d, ai)[0]; d = polySub(c, polyDeriv(b)); i++;
            }
            if (total === deg) {
                // polish every root against the original polynomial using Newton on the square-free part is unnecessary: roots are simple in their factor
                return out;
            }
        } catch (e) { /* fall through to the plain solver */ }
        return polyRoots(p).map(z => ({ re: z.re, im: z.im, mult: 1 }));
    }

    const snapCoef = x => {
        if (!Number.isFinite(x)) return 'NaN';
        for (let k = 1; k <= 60; k++) {
            const n = Math.round(x * k);
            if (Math.abs(x - n / k) < 1e-9 * Math.max(1, Math.abs(x))) return k === 1 ? String(n) : `(${n}/${k})`;
        }
        return `(${x.toPrecision(13)})`;
    };

    function integrateRational(node, v) {
        const rat = toRational(node, v);
        if (!rat) return null;
        const Q0 = rat.d;
        if (Q0.length < 2) return null; // plain polynomial: let the normal pipeline handle it
        const [quo, rem] = polyDivMod(rat.n, Q0);
        const lc = Q0[Q0.length - 1];
        const Qm = polyScale(Q0, 1 / lc);               // monic denominator
        const R = polyScale(rem, 1 / lc);               // remainder / lc over monic Q
        const roots = polyRoots(Qm);
        // group roots
        const groups = []; // {kind:'real', r, m} | {kind:'quad', a, b, m}
        const used = new Array(roots.length).fill(false);
        const scale = Math.max(1, ...roots.map(r => Math.hypot(r.re, r.im)));
        const tol = 1e-4 * scale;
        for (let i = 0; i < roots.length; i++) {
            if (used[i]) continue;
            const cl = [i]; used[i] = true;
            for (let j = i + 1; j < roots.length; j++) if (!used[j] && Math.hypot(roots[j].re - roots[i].re, roots[j].im - roots[i].im) < tol) { cl.push(j); used[j] = true; }
            const re = cl.reduce((s, k) => s + roots[k].re, 0) / cl.length, im = cl.reduce((s, k) => s + roots[k].im, 0) / cl.length;
            if (Math.abs(im) < 1e-7 * scale) groups.push({ kind: 'real', r: Math.abs(re) < 1e-12 ? 0 : re, m: cl.length });
            else if (im > 0) groups.push({ kind: 'quad', a: re, b: im, m: cl.length });
        }
        const degCheck = groups.reduce((s, g) => s + (g.kind === 'real' ? g.m : 2 * g.m), 0);
        if (degCheck !== Qm.length - 1) return null;
        // snap near-integer / simple-fraction roots for cleaner output
        const snapRoot = x => { for (let k = 1; k <= 12; k++) { const n = Math.round(x * k); if (Math.abs(x - n / k) < 1e-8 * Math.max(1, Math.abs(x))) return n / k; } return x; };
        groups.forEach(g => { if (g.kind === 'real') g.r = snapRoot(g.r); else { g.a = snapRoot(g.a); g.b = snapRoot(g.b); } });
        const factorPoly = g => (g.kind === 'real' ? [-g.r, 1] : [g.a * g.a + g.b * g.b, -2 * g.a, 1]);
        const powPoly = (p, k) => { let r = [1]; for (let i = 0; i < k; i++) r = polyMul(r, p); return r; };
        // unknowns
        const cols = [], desc = [];
        groups.forEach((g, gi) => {
            for (let j = 1; j <= g.m; j++) {
                let others = [1];
                groups.forEach((h, hi) => { others = polyMul(others, powPoly(factorPoly(h), hi === gi ? h.m - j : h.m)); });
                if (g.kind === 'real') { cols.push(others); desc.push({ g, j, type: 'A' }); }
                else { cols.push(polyMul(others, [0, 1])); desc.push({ g, j, type: 'B' }); cols.push(others); desc.push({ g, j, type: 'C' }); }
            }
        });
        const N = cols.length;
        const M = [], rhs = [];
        for (let k = 0; k < N; k++) { M.push(cols.map(c => c[k] || 0)); rhs.push([R[k] || 0]); }
        let sol;
        try { sol = math.lusolve(M, rhs).map(r => r[0]); } catch (e) { return null; }
        if (!sol.every(Number.isFinite)) return null;

        // integrate term by term
        const terms = [], steps = [];
        const addTerm = t => terms.push(t);
        if (quo.length > 1 || Math.abs(quo[0]) > 1e-12) {
            quo.forEach((c, k) => { if (Math.abs(c) > 1e-12) addTerm(`${snapCoef(c / (k + 1))}*${v}^${k + 1}`); });
        }
        const coefOf = {};
        desc.forEach((d, i) => { coefOf[`${groups.indexOf(d.g)}_${d.j}_${d.type}`] = sol[i]; });
        const pieces = [];
        groups.forEach((g, gi) => {
            for (let j = 1; j <= g.m; j++) {
                if (g.kind === 'real') {
                    const A = coefOf[`${gi}_${j}_A`];
                    if (Math.abs(A) < 1e-12) continue;
                    const base = g.r === 0 ? v : `(${v} - ${snapCoef(g.r)})`;
                    pieces.push(`${snapCoef(A)}/${j === 1 ? base : base + '^' + j}`);
                    addTerm(j === 1 ? `${snapCoef(A)}*log(abs(${g.r === 0 ? v : `${v} - ${snapCoef(g.r)}`}))` : `${snapCoef(A / (1 - j))}*${base}^${1 - j}`);
                } else {
                    const B = coefOf[`${gi}_${j}_B`], Cc = coefOf[`${gi}_${j}_C`];
                    if (Math.abs(B) < 1e-12 && Math.abs(Cc) < 1e-12) continue;
                    const pq = `(${v}^2 - ${snapCoef(2 * g.a)}*${v} + ${snapCoef(g.a * g.a + g.b * g.b)})`;
                    pieces.push(`(${snapCoef(B)}*${v} + ${snapCoef(Cc)})/${j === 1 ? pq : pq + '^' + j}`);
                    const u = `(${v} - ${snapCoef(g.a)})`, d = g.b, E0 = Cc + B * g.a; // Bx+C = B(x-a) + (C+Ba)
                    const U2D2 = `(${u}^2 + ${snapCoef(d * d)})`;
                    if (Math.abs(B) > 1e-12) addTerm(j === 1 ? `${snapCoef(B / 2)}*log(${U2D2})` : `${snapCoef(B / 2 / (1 - j))}*${U2D2}^${1 - j}`);
                    if (Math.abs(E0) > 1e-12) {
                        // J_j = ∫ du/(u²+d²)^j via reduction formula
                        let J = `(${snapCoef(1 / d)})*atan(${u}/${snapCoef(d)})`;
                        for (let k = 2; k <= j; k++) {
                            J = `(${u}/(${snapCoef(2 * d * d * (k - 1))}*${U2D2}^${k - 1}) + ${snapCoef((2 * k - 3) / (2 * d * d * (k - 1)))}*(${J}))`;
                        }
                        addTerm(`${snapCoef(E0)}*(${J})`);
                    }
                }
            }
        });
        if (!terms.length) return null;
        let F;
        try { F = parse(terms.join(' + ')); } catch (e) { return null; }
        F = simplifyNode(F);
        if (!checkAntiderivative(F, node, v)) return null;
        // explanation
        const polyStr = p => p.map((c, k) => (Math.abs(c) < 1e-12 ? null : `${snapCoef(c)}${k ? '*' + v + (k > 1 ? '^' + k : '') : ''}`)).filter(Boolean).join(' + ').replace(/\+ -/g, '- ') || '0';
        if (quo.length > 1 || Math.abs(quo[0]) > 1e-12) {
            steps.push({ title: 'Polynomial long division', text: `The numerator has degree ≥ the denominator, so divide: quotient ${polyStr(quo)}, remainder ${polyStr(rem)}.`, tex: '' });
        }
        steps.push({
            title: 'Factor the denominator',
            text: 'Roots of the denominator: ' + groups.map(g => (g.kind === 'real' ? `${v} = ${fmt(g.r, 6)}${g.m > 1 ? ` (multiplicity ${g.m})` : ''}` : `${v} = ${fmt(g.a, 6)} ± ${fmt(g.b, 6)}i${g.m > 1 ? ` (multiplicity ${g.m})` : ''}`)).join(', ') + '.',
            tex: ''
        });
        steps.push({ title: 'Partial fraction decomposition', text: `${strOf(node)} = ${quo.length > 1 || Math.abs(quo[0]) > 1e-12 ? polyStr(quo) + ' + ' : ''}${pieces.join(' + ').replace(/\+ -/g, '- ')}`, tex: '' });
        steps.push({ title: 'Integrate term by term', text: 'Simple poles give logarithms, irreducible quadratics give logarithms and arctangents, and repeated factors give powers.', tex: `${texOf(F)}` });
        return { F, steps };
    }

    // ------------------------------------------------------------------
    // Derivative explanation
    // ------------------------------------------------------------------
    const OUTER = {
        sin: 'cos(u)', cos: '-sin(u)', tan: 'sec(u)^2', sec: 'sec(u)*tan(u)', csc: '-csc(u)*cot(u)', cot: '-csc(u)^2',
        asin: '1/sqrt(1-u^2)', acos: '-1/sqrt(1-u^2)', atan: '1/(1+u^2)', sinh: 'cosh(u)', cosh: 'sinh(u)', tanh: 'sech(u)^2',
        exp: 'exp(u)', log: '1/u', sqrt: '1/(2*sqrt(u))', abs: 'u/abs(u)', log10: '1/(u*log(10))', log2: '1/(u*log(2))', cbrt: '1/(3*u^(2/3))'
    };

    function explainDerivative(node, v) {
        const steps = [];
        const D = n => diff(n, v);
        const line = (n, d) => `d/d${v} [ ${strOf(n)} ] = ${strOf(d)}`;
        const texLine = (n, d) => `\\frac{d}{d${v}}\\left[${texOf(n)}\\right]=${texOf(d)}`;
        const push = (title, text, n) => {
            if (steps.length < 14) steps.push({ title, text, tex: texLine(n, D(n)) });
        };
        const trivial = n => { n = unwrap(n); return n.type === 'SymbolNode' || !dependsOn(n, v); };
        const walk = (raw, depth) => {
            const n = unwrap(raw);
            if (depth > 4 || !dependsOn(n, v) || n.type === 'SymbolNode' || n.type === 'ConstantNode') return;
            if (n.type === 'OperatorNode') {
                if (n.fn === 'unaryMinus') { push('Constant multiple (−1)', 'The minus sign factors out of the derivative.', n); walk(n.args[0], depth + 1); return; }
                if (n.fn === 'add' || n.fn === 'subtract') {
                    push(n.fn === 'add' ? 'Sum rule' : 'Difference rule', 'Differentiate each term separately.', n);
                    n.args.forEach(a => walk(a, depth + 1));
                    return;
                }
                if (n.fn === 'multiply') {
                    const dep = n.args.filter(a => dependsOn(a, v));
                    if (dep.length === 1) {
                        push('Constant multiple rule', 'Constants factor out: d/dx[c·f] = c·f′.', n);
                        walk(dep[0], depth + 1);
                    } else {
                        const [a, ...rest] = n.args;
                        const b = rest.length === 1 ? rest[0] : rest.reduce((p, q) => OP('*', 'multiply', [p, q]));
                        push('Product rule', `d/d${v}[u·w] = u′·w + u·w′ with u = ${strOf(a)}, w = ${strOf(b)}.`, n);
                        walk(a, depth + 1); walk(b, depth + 1);
                    }
                    return;
                }
                if (n.fn === 'divide') {
                    const [a, b] = n.args;
                    if (!dependsOn(b, v)) { push('Constant multiple rule', 'Dividing by a constant: differentiate the numerator.', n); walk(a, depth + 1); return; }
                    push('Quotient rule', `d/d${v}[u/w] = (u′·w − u·w′)/w² with u = ${strOf(a)}, w = ${strOf(b)}.`, n);
                    walk(a, depth + 1); walk(b, depth + 1);
                    return;
                }
                if (n.fn === 'pow') {
                    const [b, e] = n.args;
                    if (dependsOn(b, v) && !dependsOn(e, v)) {
                        const simple = unwrap(b).type === 'SymbolNode';
                        push(simple ? 'Power rule' : 'Power rule + chain rule', simple ? `d/d${v}[${v}ⁿ] = n·${v}ⁿ⁻¹.` : `d/d${v}[uⁿ] = n·uⁿ⁻¹·u′ with u = ${strOf(b)}.`, n);
                        walk(b, depth + 1);
                    } else if (!dependsOn(b, v)) {
                        push('Exponential rule', `d/d${v}[aᵘ] = aᵘ·ln(a)·u′ with a = ${strOf(b)}, u = ${strOf(e)}.`, n);
                        walk(e, depth + 1);
                    } else {
                        push('Logarithmic differentiation', 'Write uʷ = e^(w·ln u) and differentiate with the chain and product rules.', n);
                    }
                    return;
                }
                return;
            }
            if (n.type === 'FunctionNode' && n.args.length === 1) {
                const name = n.fn.name;
                const inner = n.args[0];
                if (trivial(inner) || unwrap(inner).type === 'SymbolNode') {
                    push(`Derivative of ${name}`, `d/d${v}[${name}(${v})] = ${OUTER[name] ? OUTER[name].replace(/u/g, v) : "f′"}`, n);
                } else {
                    push('Chain rule', `d/d${v}[${name}(u)] = ${(OUTER[name] || 'f′(u)')}·u′ with u = ${strOf(inner)}.`, n);
                    walk(inner, depth + 1);
                }
            }
        };
        walk(node, 0);
        return steps;
    }

    // ------------------------------------------------------------------
    // Numerical integration (tanh-sinh quadrature)
    // ------------------------------------------------------------------
    /** tanh-sinh quadrature; the error estimate also covers truncation of the (singular) tails. */
    function tanhSinhFinite(f, a, b) {
        const corrected = T => {
            const r = tanhSinhCore(f, a, b, T);
            if (!Number.isFinite(r.value)) return r;
            const d = (b - a) / 2, reach = 2 * d * Math.exp(-Math.PI * Math.sinh(Math.floor(T * 256) / 256));
            let tail = 0;
            for (const side of [-1, 1]) {
                const end = side < 0 ? a : b, ulp = end === 0 ? 0 : Math.pow(2, Math.floor(Math.log2(Math.abs(end))) - 52), cut = Math.max(reach, ulp / 2, 1e-300);   // unreachable sliver ≈ half a floating-point spacing
                const s1 = 10 * cut, s2 = 100 * cut;
                const f1 = f(side < 0 ? a + s1 : b - s1), f2 = f(side < 0 ? a + s2 : b - s2);
                if (!Number.isFinite(f1) || !Number.isFinite(f2) || f1 === 0 || f2 === 0 || Math.sign(f1) !== Math.sign(f2)) continue;
                const pw = -Math.log(Math.abs(f2) / Math.abs(f1)) / Math.log(10);          // |f| ~ C·s^(−pw) near the end
                if (pw > 0.05 && pw < 0.97) tail += Math.sign(f1) * Math.abs(f1) * Math.pow(s1, pw) * Math.pow(cut, 1 - pw) / (1 - pw);
            }
            return { value: r.value + tail, error: r.error };
        };
        const r1 = corrected(4.0), r2 = corrected(3.2);
        if (!Number.isFinite(r1.value)) return r1;
        return { value: r1.value, error: Math.max(r1.error, Math.abs(r1.value - r2.value)) };
    }

    function tanhSinhCore(f, a, b, T) {
        const c = (a + b) / 2, d = (b - a) / 2;
        const point = t => {
            const u = Math.PI / 2 * Math.sinh(t);
            const w = d * Math.PI / 2 * Math.cosh(t) / (Math.cosh(u) * Math.cosh(u));
            if (!isFinite(w)) return 0;
            let x;
            if (t < 0) { const e = Math.exp(2 * u); x = a + 2 * d * e / (1 + e); if (!(x > a)) return 0; }          // distance to the left end is computed directly (no cancellation)
            else if (t > 0) { const e = Math.exp(-2 * u); x = b - 2 * d * e / (1 + e); if (!(x < b)) return 0; }
            else x = c;
            if (!(x > a && x < b)) return 0;
            const y = f(x);
            if (Number.isFinite(y)) return w * y;
            return Math.min(x - a, b - x) < 1e-9 * (b - a) ? 0 : NaN;   // 0/0 style junk right at an endpoint contributes nothing measurable
        };
        let h = 1, sum = 0;
        for (let k = -Math.floor(T); k <= Math.floor(T); k++) sum += point(k * h);
        let prev = h * sum, err = Infinity, cur = prev;
        for (let level = 1; level <= 8; level++) {
            h /= 2;
            let odd = 0;
            for (let k = -Math.floor(T / h) ; k <= Math.floor(T / h); k++) if (k % 2 !== 0) odd += point(k * h);
            sum += odd;
            cur = h * sum;
            err = Math.abs(cur - prev);
            if (Number.isNaN(cur)) return { value: NaN, error: Infinity };
            if (err <= 1e-13 * Math.max(1e-3, Math.abs(cur)) && level >= 3) break;
            prev = cur;
        }
        return { value: cur, error: err };
    }

    function integrateNumeric(f, a, b) {
        if (a === b) return { value: 0, error: 0 };
        if (a > b) { const r = integrateNumeric(f, b, a); return { value: -r.value, error: r.error }; }
        if (Number.isFinite(a) && Number.isFinite(b)) return tanhSinhFinite(f, a, b);
        if (Number.isFinite(a)) { // [a, ∞)
            return tanhSinhFinite(t => { const x = a + t / (1 - t); return f(x) / ((1 - t) * (1 - t)); }, 0, 1);
        }
        if (Number.isFinite(b)) { // (-∞, b]
            return tanhSinhFinite(t => { const x = b - t / (1 - t); return f(x) / ((1 - t) * (1 - t)); }, 0, 1);
        }
        return tanhSinhFinite(t => { const x = t / (1 - t * t); return f(x) * (1 + t * t) / ((1 - t * t) * (1 - t * t)); }, -1, 1);
    }

    /** Integrate with automatic splitting at singular/non-finite interior points. */
    function integrateRobust(f, a, b, extraCuts) {
        const warnings = [];
        if (!(Number.isFinite(a) && Number.isFinite(b))) {
            const r = integrateNumeric(f, a, b);
            return { ...r, warnings };
        }
        const lo = Math.min(a, b), hi = Math.max(a, b), N = 400;
        const cuts = [];
        let prevVal = f(lo + 1e-12 * (hi - lo));
        for (let i = 1; i < N; i++) {
            const x = lo + (hi - lo) * i / N;
            const y = f(x);
            if (!Number.isFinite(y)) cuts.push(x);
            prevVal = y;
        }
        // merge adjacent cuts
        const pts = [lo];
        const allCuts = cuts.concat((extraCuts || []).filter(c => c > lo && c < hi)).sort((p, q) => p - q);
        allCuts.forEach(c => { if (c - pts[pts.length - 1] > (hi - lo) / N * 1.5 || (extraCuts || []).includes(c)) { if (c - pts[pts.length - 1] > 1e-12) pts.push(c); } });
        pts.push(hi);
        if (cuts.length) warnings.push('The function is undefined at some interior points; the integral was split there.');
        let value = 0, error = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const r = tanhSinhFinite(f, pts[i], pts[i + 1]);
            value += r.value; error += r.error;
        }
        if (a > b) value = -value;
        return { value, error, warnings };
    }

    function gaussLegendre(n) {
        const xs = [], ws = [];
        for (let i = 0; i < n; i++) {
            let x = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), pp = 0;
            for (let it = 0; it < 100; it++) {
                let p1 = 1, p2 = 0;
                for (let j = 0; j < n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j + 1) * x * p2 - j * p3) / (j + 1); }
                pp = n * (x * p1 - p2) / (x * x - 1);
                const dx = p1 / pp; x -= dx;
                if (Math.abs(dx) < 1e-15) break;
            }
            xs.push(x); ws.push(2 / ((1 - x * x) * pp * pp));
        }
        return { xs, ws };
    }
    const GL = gaussLegendre(16);

    /**
     * Gauss–Legendre on [a,b] after the smoothstep substitution x = a + (b-a)(3t²-2t³),
     * which clusters nodes at the ends so sqrt-type endpoint behaviour converges fast.
     */
    function gl(f, a, b, panels) {
        panels = panels || 4;
        const L = b - a;
        const g = t => { const x = a + L * t * t * (3 - 2 * t); return f(x) * 6 * L * t * (1 - t); };
        let total = 0;
        const w = 1 / panels;
        for (let p = 0; p < panels; p++) {
            const lo = p * w, c = lo + w / 2, h = w / 2;
            for (let i = 0; i < GL.xs.length; i++) total += GL.ws[i] * h * g(c + h * GL.xs[i]);
        }
        return total;
    }

    // ------------------------------------------------------------------
    // Result builders
    // ------------------------------------------------------------------
    function makeResult(kind, title) {
        return { kind, title, main: null, items: [], meta: [], warnings: [], steps: [], plot: null, text: '', badges: [] };
    }

    const INLINE_LABEL = /^(y-intercept|Roots|Local |Saddle|Flat|Critical points|Inflection|Vertical|As x|Recognised|General solution|Particular solution|Implicit solution|Constants|Monotonicity|Concavity)/;

    function finalizeText(r) {
        // `tex` is normally a complete statement (the UI then hides the label); value-only
        // lines are flagged `inline` so the UI shows "label + value".
        r.items.forEach(i => { if (i.tex && INLINE_LABEL.test(i.label)) i.inline = true; });
        // trust badges are derived from the metadata lines the computation produced
        r.badges = r.badges || [];
        r.meta.forEach(m => {
            let x;
            if ((x = /^Method: (.+)$/.exec(m))) r.badges.push({ kind: 'info', text: x[1].length > 90 ? x[1].slice(0, 87) + '…' : x[1] });
            else if (/^Verified|cross-?checked|verified against/i.test(m)) r.badges.push({ kind: 'ok', text: m.replace(/^Verified: /, 'Verified: ').slice(0, 110) });
        });
        const lines = [r.title];
        if (r.main) lines.push(`${r.main.label} ${r.main.text}`);
        r.items.forEach(i => lines.push(`${i.label} ${i.text}`));
        r.meta.forEach(m => lines.push(m));
        r.warnings.forEach(w => lines.push('Warning: ' + w));
        r.text = lines.join('\n');
        return r;
    }

    // Plot specs must survive postMessage (no functions), so curves carry an
    // expression string (or sampled data) and `hydrate` rebuilds `fn` on the UI thread.
    function curveOf(name, node, vars, dash) {
        vars = Array.isArray(vars) ? vars : [vars];
        return { name, expr: strOf(node), vars, dash, fn: compile(node, vars) };
    }
    function curveExpr(name, exprString, vars, dash) {
        return curveOf(name, math.parse(exprString), vars, dash);
    }
    function hermite(data) {
        const { t, y, dy } = data;
        const dir = t[t.length - 1] >= t[0] ? 1 : -1;
        const lo = Math.min(t[0], t[t.length - 1]), hi = Math.max(t[0], t[t.length - 1]);
        return x => {
            if (x < lo - 1e-12 || x > hi + 1e-12) return NaN;
            let a = 0, b = t.length - 1;
            while (b - a > 1) { const m = (a + b) >> 1; if ((t[m] - x) * dir <= 0) a = m; else b = m; }
            const h = t[b] - t[a];
            if (h === 0) return y[a];
            const u = (x - t[a]) / h, u2 = u * u, u3 = u2 * u;
            return (2 * u3 - 3 * u2 + 1) * y[a] + (u3 - 2 * u2 + u) * h * dy[a] + (-2 * u3 + 3 * u2) * y[b] + (u3 - u2) * h * dy[b];
        };
    }
    function curveData(name, sol, k, dash) {
        const data = { t: sol.t, y: sol.s.map(s => s[k]), dy: sol.ds.map(d => d[k]) };
        return { name, data, dash, fn: hermite(data) };
    }
    function strip(x) {
        if (typeof x === 'function') return undefined;
        if (Array.isArray(x)) return x.map(strip);
        if (x && typeof x === 'object') {
            const o = {};
            Object.keys(x).forEach(k => { const v = strip(x[k]); if (v !== undefined) o[k] = v; });
            return o;
        }
        return x;
    }
    /** JSON/structured-clone friendly copy of a result (drops all functions). */
    function serialize(res) { return strip(res); }
    function fnFromExpr(expr, vars) { return compile(parse(expr), vars); }
    /** Rebuild the numeric functions on a result that came back from a worker. */
    function hydrate(res) {
        const p = res.plot;
        if (p) {
            (p.curves || []).forEach(c => { c.fn = c.data ? hermite(c.data) : fnFromExpr(c.expr, c.vars); });
            if (p.shade) p.shade.fn = fnFromExpr(p.shade.expr, p.shade.vars);
            if (p.slopeField) p.slopeField.fn = fnFromExpr(p.slopeField.expr, ['x', 'y']);
            if (p.shade2) { p.shade2.fFn = fnFromExpr(p.shade2.f, p.shade2.vars); p.shade2.gFn = fnFromExpr(p.shade2.g, p.shade2.vars); }
        }
        if (res.plot3) {
            if (res.plot3.expr) res.plot3.fn = fnFromExpr(res.plot3.expr, res.plot3.vars);
            if (res.plot3.exprs) res.plot3.fns = res.plot3.exprs.map(e => fnFromExpr(e, res.plot3.vars));
        }
        if (res.plot2field) res.plot2field.fns = res.plot2field.exprs.map(e => fnFromExpr(e, res.plot2field.vars));
        return res;
    }

    function parseLimit(src, name) {
        const node = parse(src);
        if (freeVars(node).length) throw new CalcError(`${name} must be a number (e.g. 2, pi/2, -inf)`);
        const val = compile(node, [])();
        if (Number.isNaN(val)) throw new CalcError(`${name} is not a valid number`);
        return { node, value: val };
    }

    function pickVar(node, requested) {
        const vars = freeVars(node);
        if (requested) return requested;
        if (vars.includes('x')) return 'x';
        return vars[0] || 'x';
    }

    function mainOf(label, node, digits) {
        return { label, text: strOf(node), tex: texOf(node) };
    }

    // ------------------------------------------------------------------
    // Modes
    // ------------------------------------------------------------------
    function runDerivative(src, opt) {
        const node = parse(src);
        const v = pickVar(node, opt.variable);
        const order = Math.max(1, Math.min(10, parseInt(opt.order, 10) || 1));
        const d = tidy(diff(node, v, order), freeVars(node));
        const r = makeResult('derivative', order === 1 ? 'First derivative' : order === 2 ? 'Second derivative' : `Derivative of order ${order}`);
        const prime = order <= 3 ? '′'.repeat(order) : `⁽${order}⁾`;
        const texPrime = order <= 3 ? "'".repeat(order) : `^{(${order})}`;
        r.main = { label: `f${prime}(${v}) =`, text: strOf(d), tex: `f${texPrime}(${v})=${texOf(d)}` };
        r.items.push({ label: 'f(' + v + ') =', text: strOf(node), tex: `f(${v})=${texOf(node)}` });
        const vars = freeVars(node);
        if (vars.length > 1) r.meta.push(`Other variables (${vars.filter(x => x !== v).join(', ')}) are treated as constants.`);

        // Steps: explain first derivative; list the chain for higher orders
        if (order === 1) {
            r.steps = explainDerivative(node, v);
        } else {
            let cur = node;
            for (let i = 1; i <= order; i++) {
                const nxt = i === order ? d : diff(node, v, i);   // each order is computed from the original (fast CAS path) – no expression swell
                r.steps.push({ title: `Differentiate (order ${i})`, text: `d/d${v} [ ${strOf(cur)} ] = ${strOf(nxt)}`, tex: `\\frac{d}{d${v}}\\left[${texOf(cur)}\\right]=${texOf(nxt)}` });
                cur = nxt;
            }
        }
        r.steps.push({ title: 'Simplify', text: `Result: ${strOf(d)}`, tex: texOf(d) });

        // independent check of the symbolic result (numerical differentiation for order 1, power-series arithmetic for higher orders)
        if (vars.length <= 1) {
            const fchk = compile(node, [v]), dchk = compile(d, [v]);
            let agree = 0, disagree = 0, fact = 1; for (let q = 2; q <= order; q++) fact *= q;
            for (const x of [0.31, 0.77, -0.55, 1.4, 2.1]) {
                let truth;
                if (order === 1) { const hh = 1e-4 * Math.max(1, Math.abs(x)); truth = (-fchk(x + 2 * hh) + 8 * fchk(x + hh) - 8 * fchk(x - hh) + fchk(x - 2 * hh)) / (12 * hh); }
                else { try { truth = taylorCoeffs(node, v, x, order)[order] * fact; } catch (e) { continue; } }
                const got = dchk(x);
                if (!Number.isFinite(truth) || !Number.isFinite(got)) continue;
                if (Math.abs(got - truth) <= 1e-5 * Math.max(1, Math.abs(truth))) agree++; else disagree++;
            }
            if (agree >= 2 && !disagree) r.meta.push(`Verified: agrees with an independent ${order === 1 ? 'numerical differentiation' : 'power-series computation'} at ${agree} sample points.`);
        }

        // Optional evaluation / tangent line
        const at = (opt.point || '').trim();
        const f = compile(node, [v]);
        const df = compile(d, [v]);
        const curves = [curveOf('f(' + v + ')', node, [v])];
        curves.push(curveOf(order === 1 ? 'f′(' + v + ')' : 'derivative', d, [v], 'dash'));
        const points = [];
        if (at) {
            const p = parseLimit(at, 'Evaluation point');
            const val = df(p.value), f0 = f(p.value);
            if (Number.isFinite(val)) {
                const n = nice(val, opt.digits);
                r.items.push({ label: `f${prime}(${nice(p.value).text}) =`, text: n.text, tex: `f${texPrime}(${nice(p.value).tex})=${n.tex}` });
                if (order === 1 && Number.isFinite(f0)) {
                    const m = val, y0 = f0, x0 = p.value;
                    r.items.push({
                        label: 'Tangent line:',
                        text: `y = ${fmt(y0, opt.digits)} + ${fmt(m, opt.digits)}·(${v} − ${fmt(x0, opt.digits)})`,
                        tex: `y=${fmt(y0, opt.digits)}+${fmt(m, opt.digits)}(${v}-${fmt(x0, opt.digits)})`
                    });
                    curves.push(curveExpr('tangent', `${y0} + (${m})*(${v} - (${x0}))`, [v], 'dot'));
                    points.push({ x: x0, y: y0, name: `(${fmt(x0, 3)}, ${fmt(y0, 3)})` });
                    r.steps.push({ title: 'Evaluate at the point', text: `f${prime}(${fmt(x0, opt.digits)}) = ${fmt(val, opt.digits)}; the tangent line has slope ${fmt(m, opt.digits)}.`, tex: '' });
                }
            } else {
                r.warnings.push(`The derivative is undefined at ${at}.`);
            }
        }
        r.plot = { variable: v, curves, points };
        return finalizeText(r);
    }

    function runIntegral(src, opt) {
        const node = parse(src);
        const v = pickVar(node, opt.variable);
        const method = opt.method || 'auto';
        const hasLimits = (opt.lower || '').trim() !== '' && (opt.upper || '').trim() !== '';
        if ((opt.lower || '').trim() !== '' !== ((opt.upper || '').trim() !== '')) {
            throw new CalcError('Provide both limits for a definite integral, or leave both empty.');
        }
        if (hasLimits) return runDefinite(node, v, opt);

        const res = antiderivative(node, v, method);
        const r = makeResult('integral', 'Indefinite integral');
        const f = compile(node, [v]);
        if (!res.ok) {
            r.main = { label: `∫ f(${v}) d${v}`, text: 'No closed form found', tex: '' };
            r.warnings.push(method === 'auto'
                ? 'No elementary antiderivative was found. Many integrals (e.g. e^(x²)) have none – use the definite integral for a numerical value.'
                : `The "${method}" strategy could not solve this integral. Try "Auto".`);
            r.plot = { variable: v, curves: [curveOf('f(x)', node, [v])] };
            return finalizeText(r);
        }
        const F = res.F;
        r.main = { label: `∫ f(${v}) d${v} =`, text: strOf(F) + ' + C', tex: `\\int ${texOf(node)}\\,d${v}=${texOf(F)}+C` };
        r.meta.push('Method: ' + res.method);
        r.meta.push('Verified: the antiderivative was checked by differentiating it at sample points.');
        r.steps = res.steps.slice();
        r.steps.push({ title: 'Add the constant of integration', text: 'Every antiderivative differs by a constant, so we add + C.', tex: `${texOf(F)}+C` });
        try {
            const check = diff(F, v);
            r.steps.push({ title: 'Check by differentiating', text: `d/d${v} [ ${strOf(F)} ] = ${strOf(check)}, which matches the integrand.`, tex: `\\frac{d}{d${v}}\\left[${texOf(F)}\\right]=${texOf(check)}` });
        } catch (e) {
            r.steps.push({ title: 'Check numerically', text: 'The antiderivative contains a special function; its derivative was verified numerically against the integrand.', tex: '' });
        }
        const Ff = compile(F, [v]);
        r.plot = { variable: v, curves: [curveOf('f(x)', node, [v]), curveOf('F(x) (C = 0)', F, [v], 'dash')] };
        return finalizeText(r);
    }

    function runDefinite(node, v, opt) {
        const a = parseLimit(opt.lower, 'Lower limit'), b = parseLimit(opt.upper, 'Upper limit');
        const f = compile(node, [v]);
        if (a.value === b.value && Number.isFinite(a.value)) {
            const z = makeResult('definite', 'Definite integral');
            z.main = { label: 'Value =', text: '0', tex: `\\int_{${texOf(a.node)}}^{${texOf(b.node)}} ${texOf(node)}\\,d${v}=0` };
            z.meta.push('The limits are equal, so the integral is 0.');
            z.steps.push({ title: 'Equal limits', text: '∫ₐᵃ f(x) dx = 0 for any f.', tex: '' });
            z.plot = { variable: v, curves: [curveOf('f(x)', node, [v])], xRange: rangeFor(a.value, b.value) };
            return finalizeText(z);
        }
        const r = makeResult('definite', Math.abs(a.value) === Infinity || Math.abs(b.value) === Infinity ? 'Improper integral' : 'Definite integral');
        const num = integrateRobust(f, a.value, b.value, kinkPoints(node, v, a.value, b.value));
        r.warnings.push(...num.warnings);
        const limTex = x => (Number.isFinite(x.value) ? texOf(x.node) : (x.value > 0 ? '\\infty' : '-\\infty'));
        const intTex = `\\int_{${limTex(a)}}^{${limTex(b)}} ${texOf(node)}\\,d${v}`;
        const intText = `∫[${strOf(a.node)} → ${strOf(b.node)}] ${strOf(node)} d${v}`;
        const rel = num.error / Math.max(1e-12, Math.abs(num.value));
        const diverges = !Number.isFinite(num.value) || (num.error > 1e-4 && rel > 1e-3);
        if (diverges) {
            r.main = { label: 'Result:', text: 'Diverges or cannot be evaluated numerically', tex: `${intTex}\\;\\text{diverges}` };
            r.warnings.push('The integral appears to diverge (or oscillates without converging).');
            r.plot = { variable: v, curves: [curveOf('f(x)', node, [v])], xRange: rangeFor(a.value, b.value) };
            return finalizeText(r);
        }

        let exact = null;
        const finite = Number.isFinite(a.value) && Number.isFinite(b.value);
        const sym = antiderivative(node, v, opt.method && opt.method !== 'auto' ? opt.method : 'auto');
        if (finite && sym.ok) {
            const Fb = substitute(sym.F, { [v]: b.node }), Fa = substitute(sym.F, { [v]: a.node });
            const diffNode = OP('-', 'subtract', [new math.ParenthesisNode(Fb), new math.ParenthesisNode(Fa)]);
            const val = compile(diffNode, [])();
            if (Number.isFinite(val) && Math.abs(val - num.value) <= 1e-6 * Math.max(1, Math.abs(val))) {
                let ex = null;
                const alg = runAlgebrite(`defint(${toAlgebrite(node)}, ${v}, ${toAlgebrite(a.node)}, ${toAlgebrite(b.node)})`);
                const exNode = alg && fromAlgebrite(alg);
                if (exNode && Math.abs(compile(exNode, [])() - val) <= 1e-9 * Math.max(1, Math.abs(val))) ex = exNode;
                if (!ex) ex = simplifyNode(diffNode);
                exact = { node: ex, F: sym.F, method: sym.method, steps: sym.steps };
            }
        }
        const nv = nice(num.value, opt.digits);
        r.main = { label: 'Value ≈', text: fmt(num.value, opt.digits), tex: `${intTex}\\approx ${fmt(num.value, opt.digits)}` };
        if (exact) {
            const exStr = strOf(exact.node);
            r.items.push({ label: 'Exact:', text: exStr, tex: `${intTex}=${texOf(exact.node)}` });
            r.meta.push('Method: Fundamental Theorem of Calculus (' + exact.method + '), cross-checked numerically');
            r.steps = exact.steps.slice();
            r.steps.push({ title: 'Antiderivative', text: `F(${v}) = ${strOf(exact.F)}`, tex: `F(${v})=${texOf(exact.F)}` });
            r.steps.push({ title: 'Apply the Fundamental Theorem', text: `∫ f dx = F(${strOf(b.node)}) − F(${strOf(a.node)})`, tex: `F(${limTex(b)})-F(${limTex(a)})` });
            r.steps.push({ title: 'Evaluate', text: `= ${exStr} ≈ ${fmt(num.value, opt.digits)}`, tex: `${texOf(exact.node)}\\approx ${fmt(num.value, opt.digits)}` });
        } else {
            r.meta.push('Method: adaptive tanh-sinh quadrature' + (num.error ? ` (estimated error ≈ ${num.error.toExponential(1)})` : ''));
            r.steps.push({ title: 'Set up the integral', text: intText, tex: intTex });
            r.steps.push({ title: 'No elementary antiderivative used', text: 'The value is computed numerically with double-exponential (tanh-sinh) quadrature, which handles endpoint singularities and infinite ranges.', tex: '' });
            r.steps.push({ title: 'Result', text: `≈ ${fmt(num.value, opt.digits)}`, tex: `\\approx ${fmt(num.value, opt.digits)}` });
        }
        if (nv.text !== fmt(num.value, opt.digits) && !exact) r.items.push({ label: 'Recognised as:', text: nv.text, tex: nv.tex });
        r.plot = {
            variable: v, curves: [curveOf('f(x)', node, [v])],
            shade: { expr: strOf(node), vars: [v], fn: f, a: a.value, b: b.value }, xRange: rangeFor(a.value, b.value)
        };
        return finalizeText(r);
    }

    /** Points where |g|, sign(g), min/max switch branches – splitting there keeps quadrature accurate. */
    function kinkPoints(node, v, lo, hi) {
        if (!(Number.isFinite(lo) && Number.isFinite(hi))) return [];
        const pts = [];
        node.traverse(n => {
            if (n.type !== 'FunctionNode') return;
            let g = null;
            if (['floor', 'ceil', 'round', 'fix'].includes(n.fn.name) && n.args.length === 1 && dependsOn(n.args[0], v)) {
                const gg = compile(n.args[0], [v]), glo = gg(lo), ghi = gg(hi);
                if (Number.isFinite(glo) && Number.isFinite(ghi) && Math.abs(glo) < 1e9 && Math.abs(ghi) < 1e9) {
                    const m0 = Math.ceil(Math.min(glo, ghi) - 1), m1 = Math.floor(Math.max(glo, ghi) + 1);
                    if (m1 - m0 < 400) for (let m = m0; m <= m1; m++) for (const off of (n.fn.name === 'round' ? [0.5] : [0])) {
                        signChanges(x => gg(x) - (m + off), Math.min(lo, hi), Math.max(lo, hi), 400).forEach(c => pts.push(c.x));
                    }
                }
                return;
            }
            if ((n.fn.name === 'abs' || n.fn.name === 'sign') && n.args.length === 1) g = n.args[0];
            else if ((n.fn.name === 'min' || n.fn.name === 'max') && n.args.length === 2) g = OP('-', 'subtract', [n.args[0], n.args[1]]);
            if (!g || !dependsOn(g, v)) return;
            const gf = compile(g, [v]);
            signChanges(gf, Math.min(lo, hi), Math.max(lo, hi), 400).forEach(c => pts.push(c.x));
        });
        return pts;
    }

    function rangeFor(a, b) {
        let lo = Number.isFinite(a) ? a : (Number.isFinite(b) ? b - 10 : -10);
        let hi = Number.isFinite(b) ? b : (Number.isFinite(a) ? a + 10 : 10);
        if (lo > hi) [lo, hi] = [hi, lo];
        const pad = Math.max(0.5, (hi - lo) * 0.25);
        return [lo - pad, hi + pad];
    }


    // ------------------------------------------------------------------
    // Truncated power series ("jets"): Taylor coefficients without symbolic differentiation
    // ------------------------------------------------------------------
    function taylorCoeffs(node, v, a, N) {
        const keep = N + 1, len = N + 1 + 12;   // spare terms absorb removable singularities such as sin(x)/x
        const zero = () => new Array(len).fill(0);
        const cst = c => { const r = zero(); r[0] = c; return r; };
        const add = (x, y) => x.map((c, i) => c + y[i]);
        const sub = (x, y) => x.map((c, i) => c - y[i]);
        const scale = (x, k) => x.map(c => c * k);
        const mul = (x, y) => { const r = zero(); for (let i = 0; i < len; i++) { if (x[i] === 0) continue; for (let j = 0; i + j < len; j++) r[i + j] += x[i] * y[j]; } return r; };
        const div = (x, y) => {
            if (y[0] === 0) { // allow exact cancellation of a common leading zero (e.g. sin(x)/x)
                let k = 0; while (k < len && y[k] === 0 && x[k] === 0) k++;
                if (k === len || y[k] === 0) throw new CalcError('Division by zero at the expansion point');
                return div(x.slice(k).concat(new Array(k).fill(NaN)), y.slice(k).concat(new Array(k).fill(NaN)));
            }
            const q = zero();
            for (let n = 0; n < len; n++) { let sum = x[n]; for (let k = 1; k <= n; k++) sum -= y[k] * q[n - k]; q[n] = sum / y[0]; }
            return q;
        };
        const deriv = x => x.slice(1).map((c, i) => c * (i + 1)).concat([NaN]);
        const integ = (w, c0) => { const r = zero(); r[0] = c0; for (let n = 1; n < len; n++) r[n] = w[n - 1] / n; return r; };
        const exp = u => { const e = zero(); e[0] = Math.exp(u[0]); for (let n = 1; n < len; n++) { let sum = 0; for (let k = 1; k <= n; k++) sum += k * u[k] * e[n - k]; e[n] = sum / n; } return e; };
        const log = u => {
            if (!(u[0] > 0)) { if (u[0] < 0) throw new CalcError('log of a negative number at the expansion point'); throw new CalcError('log(0) is not analytic at the expansion point'); }
            const l = zero(); l[0] = Math.log(u[0]);
            for (let n = 1; n < len; n++) { let sum = 0; for (let k = 1; k < n; k++) sum += k * l[k] * u[n - k]; l[n] = (u[n] - sum / n) / u[0]; }
            return l;
        };
        const sincos = (u, hyper) => {
            const s0 = zero(), c0 = zero();
            s0[0] = hyper ? Math.sinh(u[0]) : Math.sin(u[0]); c0[0] = hyper ? Math.cosh(u[0]) : Math.cos(u[0]);
            for (let n = 1; n < len; n++) {
                let ss = 0, cc = 0;
                for (let k = 1; k <= n; k++) { ss += k * u[k] * c0[n - k]; cc += k * u[k] * s0[n - k]; }
                s0[n] = ss / n; c0[n] = (hyper ? cc : -cc) / n;
            }
            return [s0, c0];
        };
        const powConst = (u, al) => {
            if (Number.isInteger(al)) {
                if (u.slice(1).every(c => c === 0)) return cst(Math.pow(u[0], al));          // plain constant
                if (Math.abs(al) > 4096) throw new CalcError('The exponent is too large for a series expansion');
                let e = Math.abs(al), base = u, r = cst(1);                                    // exponentiation by squaring
                while (e > 0) { if (e & 1) r = mul(r, base); e = Math.floor(e / 2); if (e) base = mul(base, base); }
                return al >= 0 ? r : div(cst(1), r);
            }
            if (u[0] === 0) throw new CalcError('Non-integer power of 0 is not analytic at the expansion point');
            if (u[0] < 0) {
                const q = 1 / al;
                if (Number.isInteger(q) && Math.abs(q) % 2 === 1) { const r = powConst(scale(u, -1), al); const sign = Math.pow(-1, Math.round(al * Math.abs(q)) ); void sign; return scale(r, -1); }
                throw new CalcError('A fractional power of a negative number is not real at the expansion point');
            }
            const p = zero(); p[0] = Math.pow(u[0], al);
            for (let n = 1; n < len; n++) { let sum = 0; for (let k = 1; k <= n; k++) sum += (al * k - (n - k)) * u[k] * p[n - k]; p[n] = sum / (n * u[0]); }
            return p;
        };
        const sqrtS = u => powConst(u, 0.5);
        const rec = nd => {
            nd = unwrap(nd);
            if (nd.type === 'ConstantNode') return cst(nd.value);
            if (nd.type === 'SymbolNode') {
                if (nd.name === v) { const r = zero(); r[0] = a; if (len > 1) r[1] = 1; return r; }
                if (CONSTS.has(nd.name)) return cst(compile(nd, [])());
                throw new CalcError(`Unknown symbol ${nd.name}`);
            }
            if (nd.type === 'OperatorNode') {
                const x = nd.args.map(rec);
                switch (nd.fn) {
                    case 'add': return add(x[0], x[1]);
                    case 'subtract': return sub(x[0], x[1]);
                    case 'multiply': return mul(x[0], x[1]);
                    case 'divide': return div(x[0], x[1]);
                    case 'unaryMinus': return scale(x[0], -1);
                    case 'unaryPlus': return x[0];
                    case 'pow': {
                        const e = unwrap(nd.args[1]);
                        if (!dependsOn(e, v)) { const al = compile(e, [])(); if (Number.isFinite(al)) return powConst(x[0], al); }
                        if (!(x[0][0] > 0)) throw new CalcError('Base must be positive for a variable exponent at the expansion point');
                        return exp(mul(x[1], log(x[0])));
                    }
                    default: throw new CalcError(`Operator ${nd.op} is not supported for series`);
                }
            }
            if (nd.type === 'FunctionNode') {
                const name = nd.fn.name, x = nd.args.map(rec), u = x[0];
                switch (name) {
                    case 'exp': return exp(u);
                    case 'log': return log(u);
                    case 'log10': return scale(log(u), 1 / Math.LN10);
                    case 'log2': return scale(log(u), 1 / Math.LN2);
                    case 'sqrt': return sqrtS(u);
                    case 'cbrt': return powConst(u, 1 / 3);
                    case 'nthRoot': return powConst(u, 1 / compile(unwrap(nd.args[1]), [])());
                    case 'sin': return sincos(u, false)[0];
                    case 'cos': return sincos(u, false)[1];
                    case 'sinh': return sincos(u, true)[0];
                    case 'cosh': return sincos(u, true)[1];
                    case 'tan': { const [si, co] = sincos(u, false); return div(si, co); }
                    case 'tanh': { const [si, co] = sincos(u, true); return div(si, co); }
                    case 'sec': return div(cst(1), sincos(u, false)[1]);
                    case 'csc': return div(cst(1), sincos(u, false)[0]);
                    case 'cot': { const [si, co] = sincos(u, false); return div(co, si); }
                    case 'sech': return div(cst(1), sincos(u, true)[1]);
                    case 'csch': return div(cst(1), sincos(u, true)[0]);
                    case 'coth': { const [si, co] = sincos(u, true); return div(co, si); }
                    case 'atan': return integ(div(deriv(u), add(cst(1), mul(u, u))), Math.atan(u[0]));
                    case 'asin': return integ(div(deriv(u), sqrtS(sub(cst(1), mul(u, u)))), Math.asin(u[0]));
                    case 'acos': { const r = integ(div(deriv(u), sqrtS(sub(cst(1), mul(u, u)))), Math.asin(u[0])); const o = scale(r, -1); o[0] = Math.acos(u[0]); return o; }
                    case 'asinh': return integ(div(deriv(u), sqrtS(add(mul(u, u), cst(1)))), Math.asinh(u[0]));
                    case 'acosh': return integ(div(deriv(u), sqrtS(sub(mul(u, u), cst(1)))), Math.acosh(u[0]));
                    case 'atanh': return integ(div(deriv(u), sub(cst(1), mul(u, u))), Math.atanh(u[0]));
                    case 'erf': return integ(scale(mul(exp(scale(mul(u, u), -1)), deriv(u)), 2 / Math.sqrt(Math.PI)), compile(new math.FunctionNode('erf', [C(u[0])]), [])());
                    case 'abs': if (u[0] === 0) throw new CalcError('|x| is not analytic at 0'); return u[0] > 0 ? u : scale(u, -1);
                    default: throw new CalcError(`${name} is not supported for Taylor series`);
                }
            }
            throw new CalcError('Unsupported expression for series');
        };
        const out = rec(node).slice(0, keep);
        if (out.some(c => !Number.isFinite(c))) throw new CalcError('The function is not analytic at the expansion point (a coefficient is undefined)');
        return out;
    }

    // ---------------------------- Series ------------------------------
    function runSeries(src, opt) {
        const node = parse(src);
        const v = pickVar(node, opt.variable);
        const a = opt.point !== undefined && String(opt.point).trim() !== '' ? parseLimit(String(opt.point), 'Expansion point') : { node: C(0), value: 0 };
        if (!Number.isFinite(a.value)) throw new CalcError('Expansion point must be finite');
        const n = Math.max(1, Math.min(20, parseInt(opt.terms, 10) || 5));
        const f = compile(node, [v]);
        const r = makeResult('series', a.value === 0 ? `Maclaurin series (degree ${n})` : `Taylor series about ${v} = ${strOf(a.node)} (degree ${n})`);

        // Coefficients via truncated power-series arithmetic (no symbolic differentiation → no expression swell)
        let cs;
        try { cs = taylorCoeffs(node, v, a.value, n); }
        catch (err) {
            if (!(err instanceof CalcError)) throw err;
            throw new CalcError(err.message.includes('expansion point') || err.message.includes('analytic') ? `No Taylor series at ${v} = ${fmt(a.value)}: ${err.message}` : err.message);
        }
        const coeffs = cs.map((c, k) => ({ k, coef: c, deriv: c * Number(math.factorial(k)) }));

        // Polynomial built directly from the verified coefficients (rationals recognised exactly; no CAS call)
        const numericPoly = x => coeffs.reduce((s, c) => s + c.coef * Math.pow(x - a.value, c.k), 0);
        const baseNode = a.value === 0 ? S(v) : new math.ParenthesisNode(OP('-', 'subtract', [S(v), a.node.type === 'ConstantNode' || a.node.type === 'SymbolNode' ? a.node : new math.ParenthesisNode(a.node)]));
        let polyNode = null;
        coeffs.filter(c => Math.abs(c.coef) > 1e-12 * Math.max(1, ...coeffs.map(q => Math.abs(q.coef)))).sort((p, q) => q.k - p.k).forEach(c => {
            const mag = Math.abs(c.coef);
            let cText = nice(mag, 13, 1e-9).text;
            if (!/^\d+(\/\d+)?$/.test(cText)) { const rc = recogniseConst(mag); cText = rc && !/ln/.test(rc.text) ? rc.text.replace('π²', 'pi^2').replace('π', 'pi').replace('√', 'sqrt') : String(parseFloat(mag.toPrecision(13))); }
            const cNode = parse(cText.replace(/sqrt(\w+)/g, 'sqrt($1)'));
            let term;
            const pw = c.k === 0 ? null : (c.k === 1 ? baseNode : OP('^', 'pow', [baseNode, C(c.k)]));
            if (!pw) term = cNode; else if (Math.abs(mag - 1) < 1e-12) term = pw; else term = OP('*', 'multiply', [cNode, pw]);
            if (!polyNode) polyNode = c.coef < 0 ? OP('-', 'unaryMinus', [term]) : term;
            else polyNode = OP(c.coef < 0 ? '-' : '+', c.coef < 0 ? 'subtract' : 'add', [polyNode, term]);
        });
        if (!polyNode) polyNode = C(0);
        const polyText = strOf(polyNode), polyTex = texOf(polyNode);
        r.main = { label: `T${n}(${v}) =`, text: polyText, tex: `T_{${n}}(${v})=${polyTex}` };
        r.meta.push(`Expansion point a = ${fmt(a.value)}`);
        r.items.push({ label: 'Formula:', text: `Σ f⁽ᵏ⁾(a)/k! · (${v} − a)ᵏ`, tex: `\\sum_{k=0}^{${n}}\\frac{f^{(k)}(a)}{k!}(${v}-a)^k` });
        coeffs.forEach(c => {
            r.steps.push({
                title: `k = ${c.k}`,
                text: `f${c.k === 0 ? '' : '⁽' + c.k + '⁾'}(${fmt(a.value)}) = ${nice(c.deriv, 8).text}  →  coefficient ${nice(c.coef, 8).text}`,
                tex: `f^{(${c.k})}(a)=${nice(c.deriv, 8).tex},\\quad \\frac{f^{(${c.k})}(a)}{${c.k}!}=${nice(c.coef, 8).tex}`
            });
        });
        const tp = numericPoly;
        function polyCurve(name, cs, a0, vname) {
            const expr = cs.map(c => `(${c.coef})*(${vname} - (${a0}))^${c.k}`).join(' + ');
            return curveExpr(name, expr, [vname], 'dash');
        }
        const check = [a.value + 0.25, a.value - 0.25].map(x => ({ x, f: f(x), p: tp(x) })).filter(o => Number.isFinite(o.f));
        if (check.length) {
            const o = check[0];
            r.meta.push(`Check: at ${v} = ${fmt(o.x)}, f = ${fmt(o.f, 6)}, T${n} = ${fmt(o.p, 6)} (error ${Math.abs(o.f - o.p).toExponential(2)})`);
        }
        r.plot = {
            variable: v, curves: [curveOf('f(x)', node, [v]), polyCurve(`T${n}(x)`, coeffs, a.value, v)],
            points: [{ x: a.value, y: f(a.value), name: 'expansion point' }],
            xRange: [a.value - 6, a.value + 6]
        };
        return finalizeText(r);
    }

    // ---------------------------- Limits ------------------------------
    function runLimit(src, opt) {
        const node = parse(src);
        const v = pickVar(node, opt.variable);
        const p = parseLimit(opt.point === undefined || String(opt.point).trim() === '' ? '0' : String(opt.point), 'Limit point');
        const dir = opt.direction || 'both';
        const f = compile(node, [v]);
        const r = makeResult('limit', 'Limit');

        const probe = side => { // side: +1 (from right / toward +∞) or -1
            const vals = [];
            for (let k = 1; k <= 9; k++) {
                const x = Number.isFinite(p.value) ? p.value + side * Math.pow(10, -k) : side * Math.pow(10, k + 1);
                vals.push(f(x));
            }
            return classify(vals);
        };
        const classify = vals => {
            const fin = vals.map(Number.isFinite);
            // overflow to ±Infinity is divergence
            const overflow = vals.find((v, i) => i >= 1 && (v === Infinity || v === -Infinity));
            if (overflow !== undefined) return { type: 'inf', sign: Math.sign(overflow) };
            if (fin.filter(Boolean).length < 4) return { type: 'undefined' };
            // divergence: |f| keeps growing through the well-conditioned range
            const mid = vals.slice(2, 7);
            if (mid.every(Number.isFinite)) {
                let growing = true;
                for (let i = 1; i < mid.length; i++) if (!(Math.abs(mid[i]) > 1.5 * Math.abs(mid[i - 1]) && Math.sign(mid[i]) === Math.sign(mid[0]))) growing = false;
                if (growing && Math.abs(mid[mid.length - 1]) > 1e3) return { type: 'inf', sign: Math.sign(mid[0]) };
            }
            // slow (e.g. logarithmic) divergence: monotone with non-shrinking increments
            if (vals.slice(0, 8).every(Number.isFinite)) {
                const w = vals.slice(1, 8), dd = [];
                for (let i = 1; i < w.length; i++) dd.push(w[i] - w[i - 1]);
                const sg = Math.sign(dd[0]);
                if (sg !== 0 && dd.every(x => Math.sign(x) === sg) && dd.slice(1).every((x, i) => Math.abs(x) >= 0.9 * Math.abs(dd[i])) && Math.abs(w[w.length - 1]) > 12) {
                    return { type: 'inf', sign: Math.sign(w[w.length - 1]) };
                }
                // geometric (power-law) convergence, e.g. sqrt(x) -> 0: extrapolate
                const e = vals.slice(0, 7), de = [];
                for (let i = 1; i < e.length; i++) de.push(e[i] - e[i - 1]);
                const rho = [];
                for (let i = 2; i < de.length; i++) if (de[i - 1] !== 0) rho.push(de[i] / de[i - 1]);
                if (rho.length >= 3 && rho.every(q => q > 0.05 && q < 0.7) && Math.max(...rho) / Math.min(...rho) < 1.6) {
                    const q = rho.reduce((a, b) => a + b, 0) / rho.length;
                    return { type: 'finite', value: e[e.length - 1] + de[de.length - 1] * q / (1 - q) };
                }
            }
            // convergence: pick the most self-consistent neighbouring pair (before rounding noise grows)
            let best = -1, bestDiff = Infinity;
            for (let i = 0; i <= 5; i++) {
                if (!fin[i] || !fin[i + 1]) continue;
                const d = Math.abs(vals[i] - vals[i + 1]);
                if (d <= bestDiff) { bestDiff = d; best = i; }
            }
            if (best >= 0) {
                const v = vals[best + 1];
                if (bestDiff <= 2e-5 * Math.max(1, Math.abs(v))) return { type: 'finite', value: v };
            }
            return fin.slice(-3).every(Boolean) ? { type: 'dne' } : { type: 'undefined' };
        };
        const recognise = x => {
            const n = nice(x, 8, 2e-6);
            if (/^-?\d+(\/\d+)?$/.test(n.text)) return n;              // a clean integer or fraction always wins over exotic constants
            if (/^-?[\d.]+(e[+-]?\d+)?$/.test(n.text) && !Number.isInteger(x)) {
                for (const [name, val, tex] of [['e', Math.E, 'e'], ['1/e', 1 / Math.E, '\\frac{1}{e}'], ['√2', Math.SQRT2, '\\sqrt{2}'], ['√3', Math.sqrt(3), '\\sqrt{3}'], ['ln 2', Math.LN2, '\\ln 2']]) {
                    for (const m of [1, -1]) if (Math.abs(x - m * val) < 1e-6 * Math.max(1, Math.abs(x))) return { text: (m < 0 ? '-' : '') + name, tex: (m < 0 ? '-' : '') + tex };
                }
                for (let d = 1; d <= 6; d++) {
                    const k = Math.round(x * d / Math.E);
                    if (k !== 0 && Math.abs(k) <= 12 && Math.abs(x - k * Math.E / d) < 1e-6 * Math.max(1, Math.abs(x))) return { text: `${k === 1 ? '' : k}e${d > 1 ? '/' + d : ''}`, tex: '' };
                }
            }
            return n;
        };
        const show = o => {
            if (o.type === 'finite') { const n = recognise(o.value); return { text: n.text + (n.text !== fmt(o.value, 8) && !/^-?[\d.\/π]+$/.test(n.text) ? ` ≈ ${fmt(o.value, 6)}` : ''), tex: n.tex || n.text, value: o.value }; }
            if (o.type === 'inf') return { text: o.sign > 0 ? '∞' : '-∞', tex: o.sign > 0 ? '\\infty' : '-\\infty', value: o.sign * Infinity };
            return { text: 'does not exist', tex: '\\text{DNE}', value: NaN };
        };
        const pt = Number.isFinite(p.value) ? texOf(p.node) : (p.value > 0 ? '\\infty' : '-\\infty');
        const head = Number.isFinite(p.value) ? `${v}\\to ${pt}` : `${v}\\to ${pt}`;
        if (!Number.isFinite(p.value)) {
            const o = probe(p.value > 0 ? 1 : -1), s = show(o);
            r.main = { label: 'Limit =', text: s.text, tex: `\\lim_{${head}} ${texOf(node)}=${s.tex}` };
            r.steps.push({ title: 'Evaluate for large |x|', text: `Sampling f at x = ${p.value > 0 ? '' : '−'}10³ … 10¹⁰ to see where it settles.`, tex: '' });
            r.plot = { variable: v, curves: [curveOf('f(x)', node, [v])], xRange: p.value > 0 ? [0, 50] : [-50, 0] };
            if (o.type === 'finite') r.plot.hline = o.value;
        } else {
            const L = probe(-1), R = probe(1);
            const sl = show(L), sr = show(R);
            const sameSide = (L.type === 'finite' && R.type === 'finite' && Math.abs(L.value - R.value) < 1e-5 * Math.max(1, Math.abs(L.value))) ||
                (L.type === 'inf' && R.type === 'inf' && L.sign === R.sign);
            let chosen;
            if (dir === 'left') chosen = { s: sl, o: L, tex: `${v}\\to ${pt}^-` };
            else if (dir === 'right') chosen = { s: sr, o: R, tex: `${v}\\to ${pt}^+` };
            else if (sameSide) chosen = { s: sl, o: L, tex: head };
            else if (L.type === 'undefined' && R.type !== 'undefined') {
                chosen = { s: sr, o: R, tex: `${v}\\to ${pt}^+` };
                r.meta.push(`f is not defined to the left of ${strOf(p.node)}, so the limit is taken from the right.`);
            } else if (R.type === 'undefined' && L.type !== 'undefined') {
                chosen = { s: sl, o: L, tex: `${v}\\to ${pt}^-` };
                r.meta.push(`f is not defined to the right of ${strOf(p.node)}, so the limit is taken from the left.`);
            }
            else chosen = { s: { text: 'does not exist', tex: '\\text{DNE}', value: NaN }, o: { type: 'dne' }, tex: head };
            r.main = { label: 'Limit =', text: chosen.s.text, tex: `\\lim_{${chosen.tex}} ${texOf(node)}=${chosen.s.tex}` };
            r.items.push({ label: `Left (${v} → ${strOf(p.node)}⁻):`, text: sl.text, tex: `\\lim_{${v}\\to ${pt}^-}=${sl.tex}` });
            r.items.push({ label: `Right (${v} → ${strOf(p.node)}⁺):`, text: sr.text, tex: `\\lim_{${v}\\to ${pt}^+}=${sr.tex}` });
            if (dir === 'both' && !sameSide) {
                r.warnings.push(L.type === 'inf' || R.type === 'inf' && L.type !== 'finite' ? 'The one-sided limits differ (or blow up in opposite directions), so the two-sided limit does not exist.' : 'The one-sided limits disagree, so the two-sided limit does not exist.');
            }
            const direct = f(p.value);
            r.steps.push({ title: 'Try direct substitution', text: Number.isFinite(direct) ? `f(${fmt(p.value)}) = ${fmt(direct, 8)} – the function is defined here.` : `f(${fmt(p.value)}) is undefined (e.g. 0/0 or division by zero), so look at nearby values.`, tex: '' });
            r.steps.push({ title: 'Approach from both sides', text: `Evaluate f at ${v} = ${fmt(p.value)} ± 10⁻², 10⁻³, … 10⁻⁹.`, tex: '' });
            r.steps.push({ title: 'Compare', text: `Left → ${sl.text}, right → ${sr.text}.`, tex: '' });
            r.meta.push('Method: numerical sequence analysis (not a formal proof); results are rounded to recognised closed forms where possible.');
            if (chosen.o.type === 'dne' || chosen.o.type === 'undefined') r.meta.push('Very slowly converging limits (e.g. 1/ln x as x→∞) can be reported as "does not exist" by this numerical test.');
            r.plot = {
                variable: v, curves: [curveOf('f(x)', node, [v])],
                points: chosen.o.type === 'finite' ? [{ x: p.value, y: chosen.o.value, name: 'limit', open: true }] : [],
                xRange: [p.value - 5, p.value + 5]
            };
        }
        return finalizeText(r);
    }

    // -------------------------- Analysis ------------------------------
    function bisect(g, lo, hi) {
        let glo = g(lo);
        for (let i = 0; i < 80; i++) {
            const mid = (lo + hi) / 2, gm = g(mid);
            if (!Number.isFinite(gm)) return mid;
            if (Math.sign(gm) === Math.sign(glo)) { lo = mid; glo = gm; } else hi = mid;
            if (hi - lo < 1e-14 * Math.max(1, Math.abs(mid))) break;
        }
        return (lo + hi) / 2;
    }

    function signChanges(g, lo, hi, N) {
        const out = [];
        let px = lo, py = g(lo);
        for (let i = 1; i <= N; i++) {
            const x = lo + (hi - lo) * i / N, y = g(x);
            if (Number.isFinite(py) && Number.isFinite(y)) {
                if (py === 0) out.push({ x: px, exact: true });
                else if (py * y < 0) out.push({ x: bisect(g, px, x), a: px, b: x });
            }
            px = x; py = y;
        }
        return out;
    }

    function dedupe(list, tol) {
        const out = [];
        list.sort((a, b) => a - b).forEach(x => { if (!out.length || Math.abs(x - out[out.length - 1]) > tol) out.push(x); });
        return out;
    }

    function runAnalysis(src, opt) {
        const node = parse(src);
        const v = pickVar(node, opt.variable);
        const lo = opt.min !== undefined && String(opt.min).trim() !== '' ? parseLimit(String(opt.min), 'Minimum').value : -10;
        const hi = opt.max !== undefined && String(opt.max).trim() !== '' ? parseLimit(String(opt.max), 'Maximum').value : 10;
        if (!(Number.isFinite(lo) && Number.isFinite(hi) && lo < hi)) throw new CalcError('Search interval must be finite with min < max');
        const d1 = diff(node, v), d2 = diff(d1, v);
        const f = compile(node, [v]), f1 = compile(d1, [v]), f2 = compile(d2, [v]);
        const N = 4000, span = hi - lo, tol = span * 1e-6;
        const r = makeResult('analysis', 'Function analysis');
        r.main = { label: `Analysis of f(${v}) on [${fmt(lo)}, ${fmt(hi)}]`, text: strOf(node), tex: `f(${v})=${texOf(node)},\\quad ${v}\\in[${fmt(lo)},\\,${fmt(hi)}]` };
        r.items.push({ label: `f′(${v}) =`, text: strOf(d1), tex: `f'(${v})=${texOf(d1)}` });
        r.items.push({ label: `f″(${v}) =`, text: strOf(d2), tex: `f''(${v})=${texOf(d2)}` });

        // vertical asymptotes & roots
        const asymptotes = [], roots = [];
        signChanges(f, lo, hi, N).forEach(c => {
            if (c.exact) { roots.push(c.x); return; }
            const val = Math.abs(f(c.x));
            const sideA = Math.abs(f(c.a)), sideB = Math.abs(f(c.b));
            if (val < 1e-7 * Math.max(1, sideA, sideB) || val < 1e-9) roots.push(c.x); else asymptotes.push(c.x);
        });
        // non-finite isolated points = holes/asymptotes
        for (let i = 0; i <= N; i += 1) {
            const x = lo + span * i / N;
            if (!Number.isFinite(f(x))) {
                // a pole that falls exactly on a sample point: |f| must be growing as we approach it (removable holes stay flat)
                const h = span / N, grows = (dir) => { const n1 = Math.abs(f(x + dir * h)), n2 = Math.abs(f(x + dir * 2 * h)); return Number.isFinite(n1) && Number.isFinite(n2) && n1 > 1.08 * n2 && n1 > 1; };
                if (grows(-1) || grows(1) || Math.abs(f(x - h)) > 1e3 || Math.abs(f(x + h)) > 1e3) {
                    let best = x;   // snap to a "nice" abscissa (k/4 or kπ/4) within a couple of grid steps
                    for (const unit of [0.25, Math.PI / 4]) { const k = Math.round(x / unit) * unit; if (Math.abs(k - x) <= 1.6 * h && Math.abs(k - x) < Math.abs(best - x) + 1e-12 && best === x) best = k; }
                    asymptotes.push(best);
                }
            }
        }
        // double roots: local minima of |f| near zero
        signChanges(f1, lo, hi, N).forEach(c => { if (Math.abs(f(c.x)) < 1e-8 && Number.isFinite(f(c.x))) roots.push(c.x); });
        const stepH = span / N;
        const snapAsym = x => { for (const unit of [0.25, Math.PI / 4]) { const k = Math.round(x / unit) * unit; if (Math.abs(k - x) <= 1.6 * stepH) return k || 0; } return x; };
        const rootList = dedupe(roots, tol), asymList = dedupe(asymptotes.map(snapAsym), tol * 50);

        // critical points
        const crit = [];
        signChanges(f1, lo, hi, N).forEach(c => {
            if (asymList.some(a => Math.abs(a - c.x) < tol * 50)) return;
            const y = f(c.x);
            if (!Number.isFinite(y)) return;
            const s2 = f2(c.x);
            const left = f1(c.x - span * 1e-4), right = f1(c.x + span * 1e-4);
            let type = 'flat point';
            if (left < 0 && right > 0) type = 'local minimum'; else if (left > 0 && right < 0) type = 'local maximum';
            else if (Number.isFinite(s2) && Math.abs(s2) > 1e-9) type = s2 > 0 ? 'local minimum' : 'local maximum';
            crit.push({ x: c.x, y, type });
        });
        const critList = [];
        crit.sort((a, b) => a.x - b.x).forEach(c => { if (!critList.length || Math.abs(c.x - critList[critList.length - 1].x) > tol) critList.push(c); });

        // inflection points
        const infl = [];
        signChanges(f2, lo, hi, N).forEach(c => {
            if (asymList.some(a => Math.abs(a - c.x) < tol * 50)) return;
            const y = f(c.x);
            if (Number.isFinite(y)) infl.push({ x: c.x, y });
        });
        const inflList = [];
        infl.sort((a, b) => a.x - b.x).forEach(c => { if (!inflList.length || Math.abs(c.x - inflList[inflList.length - 1].x) > tol) inflList.push(c); });

        const fmtPt = (x, y) => `(${nice(x, 6).text}, ${nice(y, 6).text})`;
        const texPt = (x, y) => `\\left(${nice(x, 6).tex},\\,${nice(y, 6).tex}\\right)`;
        const y0 = f(0);
        if (lo <= 0 && hi >= 0 && Number.isFinite(y0)) r.items.push({ label: 'y-intercept:', text: fmtPt(0, y0), tex: texPt(0, y0) });
        r.items.push({ label: 'Roots (f = 0):', text: rootList.length ? rootList.map(x => nice(x, 6).text).join(',  ') : 'none in this interval', tex: rootList.length ? rootList.map(x => `${v}=${nice(x, 6).tex}`).join(',\\; ') : '\\text{none}' });
        critList.forEach(c => r.items.push({ label: `${c.type[0].toUpperCase()}${c.type.slice(1)}:`, text: fmtPt(c.x, c.y), tex: texPt(c.x, c.y) }));
        if (!critList.length) r.items.push({ label: 'Critical points:', text: 'none in this interval', tex: '\\text{none}' });
        r.items.push({ label: 'Inflection points:', text: inflList.length ? inflList.map(c => fmtPt(c.x, c.y)).join(',  ') : 'none in this interval', tex: inflList.length ? inflList.map(c => texPt(c.x, c.y)).join(',\\; ') : '\\text{none}' });
        if (asymList.length) r.items.push({ label: 'Vertical asymptotes:', text: asymList.map(x => `${v} = ${nice(x, 6).text}`).join(',  '), tex: asymList.map(x => `${v}=${nice(x, 6).tex}`).join(',\\; ') });

        // end behaviour
        const endBehaviour = side => {
            const xs = [1e3, 1e5, 1e7].map(m => side * m), ys = xs.map(f);
            if (ys.every(Number.isFinite)) {
                if (Math.abs(ys[2] - ys[1]) < 1e-4 * Math.max(1, Math.abs(ys[2]))) return { type: 'asymptote', y: snap(ys[2]) };
                if (Math.abs(ys[2]) > Math.abs(ys[1]) * 1.5 && Math.abs(ys[2]) > 1e4) return { type: 'inf', sign: Math.sign(ys[2]) };
            }
            return { type: 'unknown' };
        };
        const eb = [['-∞', endBehaviour(-1)], ['+∞', endBehaviour(1)]];
        const horizontals = [];
        eb.forEach(([lbl, o]) => {
            if (o.type === 'asymptote') { if (!horizontals.includes(o.y)) horizontals.push(o.y); r.items.push({ label: `As x → ${lbl}:`, text: `f → ${nice(o.y, 6).text}  (horizontal asymptote y = ${nice(o.y, 6).text})`, tex: `y=${nice(o.y, 6).tex}` }); }
            else if (o.type === 'inf') r.items.push({ label: `As x → ${lbl}:`, text: `f → ${o.sign > 0 ? '+∞' : '-∞'}`, tex: `f\\to ${o.sign > 0 ? '+' : '-'}\\infty` });
        });

        // monotonicity
        const bounds = [lo, ...critList.map(c => c.x), hi];
        const mono = [];
        for (let i = 0; i < bounds.length - 1; i++) {
            const m = (bounds[i] + bounds[i + 1]) / 2, s = f1(m);
            if (Number.isFinite(s)) mono.push(`${s > 0 ? 'increasing' : 'decreasing'} on (${nice(bounds[i], 4).text}, ${nice(bounds[i + 1], 4).text})`);
        }
        if (mono.length) r.items.push({ label: 'Monotonicity:', text: mono.join(';  '), tex: '' });
        const cb = [lo, ...inflList.map(c => c.x), hi], conc = [];
        for (let i = 0; i < cb.length - 1; i++) {
            const m = (cb[i] + cb[i + 1]) / 2, s = f2(m);
            if (Number.isFinite(s)) conc.push(`concave ${s > 0 ? 'up' : 'down'} on (${nice(cb[i], 4).text}, ${nice(cb[i + 1], 4).text})`);
        }
        if (conc.length) r.items.push({ label: 'Concavity:', text: conc.join(';  '), tex: '' });

        r.steps.push({ title: 'Roots', text: `Solve f(${v}) = 0 by scanning ${N} sample points for sign changes and refining each by bisection.`, tex: '' });
        r.steps.push({ title: 'Critical points', text: `Solve f′(${v}) = 0 where f′ = ${strOf(d1)}, then classify using the sign change of f′ (or f″).`, tex: `f'(${v})=${texOf(d1)}=0` });
        r.steps.push({ title: 'Inflection points', text: `Find sign changes of f″ = ${strOf(d2)}.`, tex: `f''(${v})=${texOf(d2)}=0` });
        r.steps.push({ title: 'Asymptotes', text: 'Detect poles where |f| blows up, and examine f for very large |x|.', tex: '' });
        r.meta.push('Numerical analysis on the chosen interval; widen the interval to search further.');

        const pts = [];
        rootList.forEach(x => pts.push({ x, y: 0, name: 'root', color: '#34c759' }));
        critList.forEach(c => pts.push({ x: c.x, y: c.y, name: c.type, color: c.type === 'local minimum' ? '#ff3b30' : c.type === 'local maximum' ? '#ff9500' : '#8e8e93' }));
        inflList.forEach(c => pts.push({ x: c.x, y: c.y, name: 'inflection', color: '#af52de' }));
        r.plot = { variable: v, curves: [curveOf('f(x)', node, [v])], points: pts, vlines: asymList, hlines: horizontals, xRange: [lo, hi] };
        return finalizeText(r);
    }

    // ----------------------- Differential equations -------------------
    function rk45(F, t0, s0, t1, maxSteps) {
        // Dormand–Prince adaptive integrator; F(t, s) -> array
        const dir = t1 >= t0 ? 1 : -1;
        const n = s0.length;
        const A = [[], [1 / 5], [3 / 40, 9 / 40], [44 / 45, -56 / 15, 32 / 9], [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
            [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656], [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84]];
        const Cc = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
        const B5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
        const B4 = [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40];
        const ts = [t0], ss = [s0.slice()], ds = [F(t0, s0)];
        const hmax = Math.abs(t1 - t0) / 150;
        let t = t0, s = s0.slice(), h = dir * hmax / 4, status = 'ok';
        const rtol = 1e-8, atol = 1e-10;
        let steps = 0;
        while ((t1 - t) * dir > 1e-14 * Math.max(1, Math.abs(t1))) {
            if (++steps > (maxSteps || 20000)) { status = 'maxsteps'; break; }
            if ((t + h - t1) * dir > 0) h = t1 - t;
            const k = [];
            for (let i = 0; i < 7; i++) {
                const si = s.slice();
                for (let j = 0; j < i; j++) for (let m = 0; m < n; m++) si[m] += h * A[i][j] * k[j][m];
                k.push(F(t + Cc[i] * h, si));
            }
            let err = 0;
            const sNew = s.slice();
            for (let m = 0; m < n; m++) {
                let y5 = s[m], y4 = s[m];
                for (let i = 0; i < 7; i++) { y5 += h * B5[i] * k[i][m]; y4 += h * B4[i] * k[i][m]; }
                sNew[m] = y5;
                err = Math.max(err, Math.abs(y5 - y4) / (atol + rtol * Math.max(Math.abs(s[m]), Math.abs(y5))));
            }
            if (!sNew.every(Number.isFinite)) {
                if (Math.abs(h) < 1e-12) { status = 'blowup'; break; }
                h /= 4; continue;
            }
            if (err <= 1) {
                t += h; s = sNew; ts.push(t); ss.push(s.slice()); ds.push(k[6].slice());
                if (s.some(x => Math.abs(x) > 1e8)) { status = 'blowup'; break; }
            }
            const fac = Math.min(5, Math.max(0.2, 0.9 * Math.pow(err || 1e-10, -0.2)));
            h *= fac;
            if (Math.abs(h) > hmax) h = dir * hmax;
            if (Math.abs(h) < 1e-13 * Math.max(1, Math.abs(t))) { status = 'blowup'; break; }
        }
        return { t: ts, s: ss, ds, status };
    }

    function trySymbolicFirstOrder(fNode, x0, y0, hasIC, opt) {
        // y' = f(x, y)
        const info = { steps: [] };
        let dfy;
        try { dfy = diff(fNode, 'y'); } catch (e) { return null; }
        // --- linear: y' + P(x) y = Q(x)
        if (!dependsOn(dfy, 'y')) {
            const P = simplifyNode(OP('-', 'unaryMinus', [dfy]));
            const Q = simplifyNode(substitute(fNode, { y: 0 }));
            const IP = antiderivative(P, 'x', 'auto');
            if (IP.ok) {
                const mu = simplifyNode(new math.FunctionNode('exp', [IP.F]));
                const muQ = simplifyNode(OP('*', 'multiply', [mu, Q]));
                const qIsZero = muQ.type === 'ConstantNode' && muQ.value === 0;
                const IQ = qIsZero ? { ok: true, F: C(0) } : antiderivative(muQ, 'x', 'auto');
                if (IQ.ok) {
                    const sol = casSimplify(OP('/', 'divide', [new math.ParenthesisNode(OP('+', 'add', [IQ.F, S('C')])), new math.ParenthesisNode(mu)]), ['x', 'C']);
                    info.kind = 'linear';
                    info.general = sol;
                    info.steps.push({ title: 'Recognise a linear first-order ODE', text: `Write it as y′ + P(x)·y = Q(x) with P = ${strOf(P)}, Q = ${strOf(Q)}.`, tex: `y'+\\left(${texOf(P)}\\right)y=${texOf(Q)}` });
                    info.steps.push({ title: 'Integrating factor', text: `μ(x) = exp(∫P dx) = ${strOf(mu)}`, tex: `\\mu(x)=e^{\\int P\\,dx}=${texOf(mu)}` });
                    info.steps.push({ title: 'Multiply and integrate', text: `(μ·y)′ = μ·Q, so μ·y = ∫ ${strOf(muQ)} dx = ${strOf(IQ.F)} + C`, tex: `\\mu y=\\int ${texOf(muQ)}\\,dx=${texOf(IQ.F)}+C` });
                    info.steps.push({ title: 'Solve for y', text: `y = ${strOf(sol)}`, tex: `y=${texOf(sol)}` });
                    if (hasIC) {
                        const muF = compile(mu, ['x']), IQf = compile(IQ.F, ['x']);
                        const Cv = y0 * muF(x0) - IQf(x0);
                        if (Number.isFinite(Cv)) {
                            const part = substitute(sol, { C: Cv });
                            info.particular = casSimplify(part, ['x']);
                            info.steps.push({ title: 'Apply the initial condition', text: `y(${fmt(x0)}) = ${fmt(y0)} gives C = ${fmt(Cv, 8)}.`, tex: `C=${fmt(Cv, 8)}` });
                        }
                    }
                    return info;
                }
            }
        }
        // --- separable: y' = g(x) h(y)
        const x1 = 1.3, y1 = 0.7;
        const f11 = compile(fNode, ['x', 'y'])(x1, y1);
        if (Number.isFinite(f11) && Math.abs(f11) > 1e-9) {
            const g = simplifyNode(OP('/', 'divide', [substitute(fNode, { y: y1 }), C(f11)]));
            const h = simplifyNode(substitute(fNode, { x: x1 }));
            if (!dependsOn(g, 'y') && !dependsOn(h, 'x')) {
                const fn = compile(fNode, ['x', 'y']), gf = compile(g, ['x']), hf = compile(h, ['y']);
                const tests = [[0.4, 1.9], [-0.8, 0.3], [2.1, -1.4], [0.9, 2.2]];
                const sep = tests.every(([a, b]) => { const l = fn(a, b), rr = gf(a) * hf(b); return !Number.isFinite(l) || !Number.isFinite(rr) || Math.abs(l - rr) <= 1e-9 * Math.max(1, Math.abs(l)); });
                if (sep) {
                    const invH = simplifyNode(OP('/', 'divide', [C(1), new math.ParenthesisNode(h)]));
                    const Hy = antiderivative(invH.cloneDeep().transform(n => (n.type === 'SymbolNode' && n.name === 'y' ? S('x') : n)), 'x', 'auto');
                    const Gx = antiderivative(g, 'x', 'auto');
                    if (Hy.ok && Gx.ok) {
                        const Hn = Hy.F.transform(n => (n.type === 'SymbolNode' && n.name === 'x' ? S('y') : n));
                        info.kind = 'separable';
                        info.implicit = { lhs: Hn, rhs: Gx.F };
                        const hs = Hn.toString();
                        if (hs === 'log(abs(y))' || hs === 'log(y)') {
                            info.explicitGeneral = casSimplify(OP('*', 'multiply', [S('C'), new math.FunctionNode('exp', [Gx.F])]), ['x', 'C']);
                            if (hasIC) {
                                const Cv = y0 / Math.exp(compile(Gx.F, ['x'])(x0));
                                if (Number.isFinite(Cv)) info.explicitParticular = casSimplify(OP('*', 'multiply', [C(Cv), new math.FunctionNode('exp', [Gx.F])]), ['x']);
                            }
                        }
                        info.steps.push({ title: 'Recognise a separable ODE', text: `y′ = g(x)·h(y) with g = ${strOf(g)}, h = ${strOf(h)}.`, tex: `\\frac{dy}{dx}=\\left(${texOf(g)}\\right)\\left(${texOf(h)}\\right)` });
                        info.steps.push({ title: 'Separate the variables', text: `dy / (${strOf(h)}) = (${strOf(g)}) dx`, tex: `\\frac{dy}{${texOf(h)}}=\\left(${texOf(g)}\\right)dx` });
                        info.steps.push({ title: 'Integrate both sides', text: `${strOf(Hn)} = ${strOf(Gx.F)} + C`, tex: `${texOf(Hn)}=${texOf(Gx.F)}+C` });
                        if (hasIC) {
                            const Cv = compile(Hn, ['y'])(y0) - compile(Gx.F, ['x'])(x0);
                            if (Number.isFinite(Cv)) {
                                info.constant = Cv;
                                info.steps.push({ title: 'Apply the initial condition', text: `y(${fmt(x0)}) = ${fmt(y0)} gives C = ${fmt(Cv, 8)}.`, tex: `C=${fmt(Cv, 8)}` });
                            }
                        }
                        info.steps.push({ title: 'Note', text: 'Constant solutions y = y₀ with h(y₀) = 0 may also exist and are not covered by the separated form.', tex: '' });
                        return info;
                    }
                }
            }
        }
        return null;
    }

    function trySymbolicSecondOrder(fNode, x0, y0, v0, hasIC) {
        // y'' = f(x, y, yp) with f = -a*yp - b*y
        let fy, fyp;
        try { fy = diff(fNode, 'y'); fyp = diff(fNode, 'yp'); } catch (e) { return null; }
        if (dependsOn(fy, 'x') || dependsOn(fy, 'y') || dependsOn(fy, 'yp') || dependsOn(fyp, 'x') || dependsOn(fyp, 'y') || dependsOn(fyp, 'yp')) return null;
        const b = -compile(fy, [])(), a = -compile(fyp, [])();
        const f0 = compile(fNode, ['x', 'y', 'yp'])(0, 0, 0);
        if (![a, b, f0].every(Number.isFinite) || Math.abs(f0) > 1e-12) return null;
        const info = { kind: 'linear2', steps: [] };
        info.steps.push({ title: 'Recognise a constant-coefficient homogeneous ODE', text: `y″ + ${fmt(a)}·y′ + ${fmt(b)}·y = 0`, tex: `y''+${fmt(a)}y'+${fmt(b)}y=0` });
        info.steps.push({ title: 'Characteristic equation', text: `r² + ${fmt(a)}·r + ${fmt(b)} = 0`, tex: `r^2+${fmt(a)}r+${fmt(b)}=0` });
        const D = a * a - 4 * b;
        let basis, text, tex;
        const r1 = (-a + Math.sqrt(Math.max(D, 0))) / 2, r2 = (-a - Math.sqrt(Math.max(D, 0))) / 2;
        if (Math.abs(D) < 1e-12) {
            const r = -a / 2;
            basis = [x => Math.exp(r * x), x => x * Math.exp(r * x)];
            text = `y = (C₁ + C₂·x)·e^(${fmt(r)}·x)`; tex = `y=(C_1+C_2x)e^{${fmt(r)}x}`;
            info.steps.push({ title: 'Repeated root', text: `r = ${fmt(r)} (double root)`, tex: `r=${fmt(r)}` });
        } else if (D > 0) {
            basis = [x => Math.exp(r1 * x), x => Math.exp(r2 * x)];
            text = `y = C₁·e^(${fmt(r1)}·x) + C₂·e^(${fmt(r2)}·x)`; tex = `y=C_1e^{${fmt(r1)}x}+C_2e^{${fmt(r2)}x}`;
            info.steps.push({ title: 'Two real roots', text: `r₁ = ${fmt(r1)}, r₂ = ${fmt(r2)}`, tex: `r_1=${fmt(r1)},\\;r_2=${fmt(r2)}` });
        } else {
            const al = -a / 2, be = Math.sqrt(-D) / 2;
            basis = [x => Math.exp(al * x) * Math.cos(be * x), x => Math.exp(al * x) * Math.sin(be * x)];
            text = `y = e^(${fmt(al)}·x)·(C₁·cos(${fmt(be)}·x) + C₂·sin(${fmt(be)}·x))`; tex = `y=e^{${fmt(al)}x}\\left(C_1\\cos(${fmt(be)}x)+C_2\\sin(${fmt(be)}x)\\right)`;
            info.steps.push({ title: 'Complex roots', text: `r = ${fmt(al)} ± ${fmt(be)}i`, tex: `r=${fmt(al)}\\pm ${fmt(be)}i` });
        }
        info.generalText = text; info.generalTex = tex;
        if (hasIC) {
            const h = 1e-5;
            const d = (g, x) => (g(x + h) - g(x - h)) / (2 * h);
            const M = [[basis[0](x0), basis[1](x0)], [d(basis[0], x0), d(basis[1], x0)]];
            try {
                const c = math.lusolve(M, [[y0], [v0]]).map(r => r[0]);
                info.constants = c;
                info.steps.push({ title: 'Apply initial conditions', text: `C₁ = ${fmt(c[0], 8)}, C₂ = ${fmt(c[1], 8)}`, tex: `C_1=${fmt(c[0], 8)},\\;C_2=${fmt(c[1], 8)}` });
                info.exactFn = x => c[0] * basis[0](x) + c[1] * basis[1](x);
            } catch (e) { /* singular */ }
        }
        return info;
    }

    function runODE(src, opt) {
        const type = opt.odeType || 'first';
        const x0 = parseLimit(String(opt.x0 === undefined || opt.x0 === '' ? '0' : opt.x0), 'Initial x').value;
        const xEnd = parseLimit(String(opt.xEnd === undefined || opt.xEnd === '' ? '10' : opt.xEnd), 'End value').value;
        if (!Number.isFinite(x0) || !Number.isFinite(xEnd) || x0 === xEnd) throw new CalcError('Initial and end values must be different finite numbers');
        const hasIC = String(opt.y0 === undefined ? '' : opt.y0).trim() !== '';
        const y0 = hasIC ? parseLimit(String(opt.y0), 'y(x₀)').value : 1;
        const r = makeResult('ode', type === 'first' ? 'First-order ODE' : type === 'second' ? 'Second-order ODE' : 'System of ODEs');
        const t0 = x0;

        if (type === 'first') {
            const f = parse(src);
            const bad = freeVars(f).filter(n => n !== 'x' && n !== 'y');
            if (bad.length) throw new CalcError(`First-order ODE: use only x and y (found ${bad.join(', ')})`);
            r.main = { label: "y′ =", text: strOf(f), tex: `\\frac{dy}{dx}=${texOf(f)}` };
            const F = compile(f, ['x', 'y']);
            const sol = rk45((t, s) => [F(t, s[0])], t0, [y0], xEnd);
            const yCurve = curveData('y(x)', sol, 0), yf = yCurve.fn;
            r.meta.push(`Initial condition: y(${fmt(x0)}) = ${fmt(y0)}`);
            r.meta.push('Numerical method: adaptive Dormand–Prince RK45 (error tolerance 1e-8)');
            const sym = trySymbolicFirstOrder(f, x0, y0, hasIC, opt);
            const curves = [];
            if (sym) {
                if (sym.kind === 'linear') {
                    r.items.push({ label: 'General solution:', text: 'y = ' + strOf(sym.general).replace(/^y = /, ''), tex: `y=${texOf(sym.general)}` });
                    if (sym.particular) r.items.push({ label: 'Particular solution:', text: 'y = ' + strOf(sym.particular), tex: `y=${texOf(sym.particular)}` });
                } else {
                    if (sym.explicitGeneral) {
                        r.items.push({ label: 'General solution:', text: 'y = ' + strOf(sym.explicitGeneral), tex: `y=${texOf(sym.explicitGeneral)}` });
                        if (sym.explicitParticular) r.items.push({ label: 'Particular solution:', text: 'y = ' + strOf(sym.explicitParticular), tex: `y=${texOf(sym.explicitParticular)}` });
                    }
                    const c = sym.constant !== undefined ? ` + ${fmt(sym.constant, 8)}`.replace('+ -', '- ') : ' + C';
                    r.items.push({ label: 'Implicit solution:', text: `${strOf(sym.implicit.lhs)} = ${strOf(sym.implicit.rhs)}${c}`, tex: `${texOf(sym.implicit.lhs)}=${texOf(sym.implicit.rhs)}${sym.constant !== undefined ? '+' + fmt(sym.constant, 8) : '+C'}` });
                }
                r.steps = sym.steps;
                const exactNode = sym.particular || sym.explicitParticular;
                if (exactNode) {
                    const ef = compile(exactNode, ['x']);
                    const xs = [0.25, 0.5, 0.75, 1].map(p => x0 + (xEnd - x0) * p * 0.5);
                    const agree = xs.every(x => { const a = ef(x), b = yf(x); return !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(b)); });
                    r.meta.unshift(agree ? 'Analytic solution found and verified against the numerical solution.' : 'Analytic solution found (could not be confirmed numerically on this interval).');
                    if (!agree) r.warnings.push('The analytic and numerical solutions disagree – the analytic form may only be valid on part of the interval.');
                } else {
                    r.meta.unshift('Analytic solution found.');
                }
            } else {
                r.warnings.push('No closed form was found (supported analytic types: linear and separable). Showing the numerical solution.');
                r.steps.push({ title: 'Numerical solution', text: `Integrate y′ = ${strOf(f)} from x = ${fmt(x0)} with y(${fmt(x0)}) = ${fmt(y0)} using adaptive RK45.`, tex: '' });
            }
            r.steps.push({ title: 'Solution values', text: [0, 0.25, 0.5, 0.75, 1].map(p => { const x = x0 + (xEnd - x0) * p; return `y(${fmt(x, 4)}) ≈ ${fmt(yf(x), 6)}`; }).join('   '), tex: '' });
            if (sol.status !== 'ok') r.warnings.push(sol.status === 'blowup' ? `The solution blows up near x ≈ ${fmt(sol.t[sol.t.length - 1], 4)}; integration stopped there.` : 'Step limit reached before the end of the interval.');
            curves.push(yCurve);
            r.plot = { variable: 'x', curves, slopeField: { expr: strOf(f), fn: F }, points: [{ x: x0, y: y0, name: 'initial condition' }], xRange: [Math.min(x0, xEnd), Math.max(x0, xEnd)], yLabel: 'y' };
            return finalizeText(r);
        }

        if (type === 'second') {
            const f = parse(src);
            const bad = freeVars(f).filter(n => !['x', 'y', 'yp'].includes(n));
            if (bad.length) throw new CalcError(`Second-order ODE: use x, y and yp (for y′). Found ${bad.join(', ')}`);
            const v0 = parseLimit(String(opt.v0 === undefined || opt.v0 === '' ? '0' : opt.v0), "y′(x₀)").value;
            r.main = { label: "y″ =", text: strOf(f), tex: `y''=${texOf(f)}` };
            const F = compile(f, ['x', 'y', 'yp']);
            const sol = rk45((t, s) => [s[1], F(t, s[0], s[1])], t0, [y0, v0], xEnd);
            r.meta.push(`Initial conditions: y(${fmt(x0)}) = ${fmt(y0)}, y′(${fmt(x0)}) = ${fmt(v0)}`);
            r.meta.push('Numerical method: adaptive Dormand–Prince RK45 (written as a first-order system)');
            const sym = trySymbolicSecondOrder(f, x0, y0, v0, hasIC);
            if (sym) {
                r.items.push({ label: 'General solution:', text: sym.generalText, tex: sym.generalTex });
                if (sym.constants) r.items.push({ label: 'Constants:', text: `C₁ = ${fmt(sym.constants[0], 8)}, C₂ = ${fmt(sym.constants[1], 8)}`, tex: `C_1=${fmt(sym.constants[0], 8)},\\;C_2=${fmt(sym.constants[1], 8)}` });
                r.steps = sym.steps;
            } else {
                r.warnings.push('No closed form was found (analytic support: y″ + a·y′ + b·y = 0). Showing the numerical solution.');
                r.steps.push({ title: 'Convert to a first-order system', text: "Let u = y, w = y′. Then u′ = w and w′ = f(x, u, w).", tex: "u'=w,\\quad w'=f(x,u,w)" });
            }
            if (sol.status !== 'ok') r.warnings.push('The solution blows up or exceeded the step limit before the end of the interval.');
            r.plot = { variable: 'x', curves: [curveData('y(x)', sol, 0), curveData('y′(x)', sol, 1, 'dash')], points: [{ x: x0, y: y0, name: 'initial condition' }], xRange: [Math.min(x0, xEnd), Math.max(x0, xEnd)] };
            return finalizeText(r);
        }

        // system:  x' = P(t,x,y,z); y' = Q(...)   (components separated by ; or newlines)
        const parts = String(src).split(/[;\n]+/).map(s => s.trim()).filter(Boolean);
        if (parts.length < 2 || parts.length > 3) throw new CalcError('Enter 2–3 equations separated by ;  e.g.  y ; -x   (meaning x′ = y, y′ = −x)');
        const names = ['x', 'y', 'z'].slice(0, parts.length);
        const nodes = parts.map(p => parse(p));
        nodes.forEach(nd => {
            const bad = freeVars(nd).filter(n => n !== 't' && !names.includes(n));
            if (bad.length) throw new CalcError(`System: allowed variables are t, ${names.join(', ')} (found ${bad.join(', ')})`);
        });
        const inits = String(opt.initial === undefined || opt.initial === '' ? names.map(() => '1').join(',') : opt.initial).split(',').map(s => parseLimit(s.trim(), 'Initial value').value);
        if (inits.length !== names.length) throw new CalcError(`Give ${names.length} initial values separated by commas`);
        const fns = nodes.map(nd => compile(nd, ['t', ...names]));
        const sol = rk45((t, s) => fns.map(fn => fn(t, ...s)), t0, inits, xEnd);
        r.main = { label: 'System:', text: names.map((n, i) => `${n}′ = ${strOf(nodes[i])}`).join(';  '), tex: names.map((n, i) => `${n}'=${texOf(nodes[i])}`).join(',\\;') };
        r.meta.push(`Initial values at t = ${fmt(t0)}: ${names.map((n, i) => `${n} = ${fmt(inits[i])}`).join(', ')}`);
        r.meta.push('Numerical method: adaptive Dormand–Prince RK45');
        r.steps.push({ title: 'Vector form', text: `Treat (${names.join(', ')}) as a state vector and integrate the system from t = ${fmt(t0)} to ${fmt(xEnd)}.`, tex: '' });
        const last = sol.s[sol.s.length - 1];
        r.items.push({ label: `State at t = ${fmt(sol.t[sol.t.length - 1], 4)}:`, text: names.map((n, i) => `${n} = ${fmt(last[i], 6)}`).join(', '), tex: '' });
        if (sol.status !== 'ok') r.warnings.push('The solution blows up or exceeded the step limit before the end of the interval.');
        r.plot = {
            variable: 't', curves: names.map((n, i) => curveData(`${n}(t)`, sol, i)),
            phase: names.length >= 2 ? { x: sol.s.map(s => s[0]), y: sol.s.map(s => s[1]), labels: [names[0], names[1]] } : null,
            xRange: [Math.min(t0, xEnd), Math.max(t0, xEnd)]
        };
        return finalizeText(r);
    }

    // ------------------------- Multivariable --------------------------
    function parseVars(opt, nodes) {
        let vars = String(opt.vars || '').split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
        if (!vars.length) {
            const set = new Set();
            nodes.forEach(n => freeVars(n).forEach(x => set.add(x)));
            vars = sortVars([...set]);
            if (vars.length < 2) vars = ['x', 'y'];
        }
        vars.forEach(v => { if (!/^[A-Za-z_]\w*$/.test(v) || CONSTS.has(v) || FUNCS.has(v)) throw new CalcError(`Invalid variable name "${v}"`); });
        return vars;
    }

    function parseVector(src) {
        return String(src).split(/[;\n]+/).map(s => s.trim()).filter(Boolean).map(parse);
    }

    function evalPoint(str, vars) {
        const parts = String(str).split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length !== vars.length) throw new CalcError(`Give ${vars.length} comma-separated coordinates for (${vars.join(', ')})`);
        return parts.map((p, i) => parseLimit(p, 'Point coordinate ' + (i + 1)).value);
    }

    function newtonCritical(grads, hess, vars, R) {
        const n = vars.length;
        const g = grads.map(nd => compile(nd, vars));
        const H = hess.map(row => row.map(nd => compile(nd, vars)));
        const found = [];
        const per = n === 2 ? 9 : 5;
        const starts = [];
        const rec = (idx, cur) => {
            if (idx === n) { starts.push(cur.slice()); return; }
            for (let i = 0; i < per; i++) { cur[idx] = -R + 2 * R * (i + 0.37) / per; rec(idx + 1, cur); }
        };
        rec(0, new Array(n));
        for (const s of starts) {
            let p = s.slice(), ok = false;
            for (let it = 0; it < 60; it++) {
                const gv = g.map(fn => fn(...p));
                if (!gv.every(Number.isFinite)) break;
                const norm = Math.hypot(...gv);
                if (norm < 1e-11) { ok = true; break; }
                const Hv = H.map(row => row.map(fn => fn(...p)));
                if (!Hv.every(row => row.every(Number.isFinite))) break;
                let step;
                try { step = math.lusolve(Hv, gv.map(x => [-x])).map(r => r[0]); } catch (e) { break; }
                if (!step.every(Number.isFinite)) break;
                const mag = Math.hypot(...step);
                const damp = mag > 2 ? 2 / mag : 1;
                p = p.map((x, i) => x + damp * step[i]);
                if (p.some(x => Math.abs(x) > 1e4)) break;
            }
            if (ok && !found.some(q => Math.hypot(...q.map((x, i) => x - p[i])) < 1e-6)) found.push(p);
        }
        return found;
    }

    function runMultivariable(src, opt) {
        const op = opt.op || 'gradient';
        if (op === 'divergence' || op === 'curl' || op === 'field') return runVectorField(src, opt, op);
        const node = parse(src);
        const vars = parseVars(opt, [node]);
        const f = compile(node, vars);
        const lvars = vars.slice(0, 3);
        const r = makeResult('multivariable', '');

        if (op === 'partial' || op === 'gradient') {
            const partials = vars.map(v => diff(node, v));
            r.title = op === 'partial' ? 'Partial derivatives' : 'Gradient vector';
            if (op === 'partial') {
                r.main = { label: `f(${vars.join(', ')}) =`, text: strOf(node), tex: `f=${texOf(node)}` };
                vars.forEach((v, i) => r.items.push({ label: `∂f/∂${v} =`, text: strOf(partials[i]), tex: `\\frac{\\partial f}{\\partial ${v}}=${texOf(partials[i])}` }));
                // second-order mixed partials
                for (let i = 0; i < vars.length; i++) for (let j = i; j < vars.length; j++) {
                    const d2 = diff(partials[i], vars[j]);
                    r.items.push({ label: `∂²f/∂${vars[i]}∂${vars[j]} =`, text: strOf(d2), tex: `\\frac{\\partial^2 f}{\\partial ${vars[i]}\\partial ${vars[j]}}=${texOf(d2)}` });
                }
            } else {
                r.main = { label: '∇f =', text: `( ${partials.map(strOf).join(',  ')} )`, tex: `\\nabla f=\\left(${partials.map(texOf).join(',\\;')}\\right)` };
                r.items.push({ label: 'f =', text: strOf(node), tex: `f=${texOf(node)}` });
            }
            vars.forEach((v, i) => r.steps.push({ title: `Differentiate with respect to ${v}`, text: `Treat ${vars.filter(x => x !== v).join(', ')} as constants: ∂f/∂${v} = ${strOf(partials[i])}`, tex: `\\frac{\\partial f}{\\partial ${v}}=${texOf(partials[i])}` }));
            if (opt.point && String(opt.point).trim()) {
                const pt = evalPoint(opt.point, vars);
                const gv = partials.map(p => compile(p, vars)(...pt));
                const fv = f(...pt);
                r.items.push({ label: `At (${pt.map(x => fmt(x, 4)).join(', ')}):`, text: `f = ${fmt(fv, opt.digits)};  ∇f = (${gv.map(x => fmt(x, opt.digits)).join(', ')});  |∇f| = ${fmt(Math.hypot(...gv), opt.digits)}`, tex: '' });
                if (Number.isFinite(fv) && gv.every(Number.isFinite)) {
                    const terms = vars.map((v, i) => `${fmt(gv[i], opt.digits)}·(${v} − ${fmt(pt[i], opt.digits)})`).join(' + ');
                    r.items.push({ label: 'Tangent (hyper)plane:', text: `z = ${fmt(fv, opt.digits)} + ${terms}`, tex: '' });
                    if (opt.direction && String(opt.direction).trim()) {
                        const dv = evalPoint(opt.direction, vars);
                        const mag = Math.hypot(...dv);
                        if (mag === 0) throw new CalcError('Direction vector must be non-zero');
                        const dd = gv.reduce((s, g, i) => s + g * dv[i] / mag, 0);
                        r.items.push({ label: 'Directional derivative:', text: `D_u f = ∇f · u = ${fmt(dd, opt.digits)}  (u = unit vector along (${dv.join(', ')}))`, tex: '' });
                    }
                    r.steps.push({ title: 'Evaluate at the point', text: `∇f(${pt.map(x => fmt(x, 4)).join(', ')}) = (${gv.map(x => fmt(x, opt.digits)).join(', ')}); it points in the direction of steepest ascent.`, tex: '' });
                }
            }
        } else if (op === 'hessian' || op === 'laplacian') {
            const hess = vars.map(a => vars.map(b => diff(diff(node, a), b)));
            if (op === 'hessian') {
                r.title = 'Hessian matrix';
                r.main = { label: 'H =', text: '[ ' + hess.map(row => '[' + row.map(strOf).join(', ') + ']').join(', ') + ' ]', tex: `H=\\begin{bmatrix}${hess.map(row => row.map(texOf).join('&')).join('\\\\')}\\end{bmatrix}` };
                hess.forEach((row, i) => r.items.push({ label: `Row ${i + 1}:`, text: row.map(strOf).join(',   '), tex: '' }));
                r.steps.push({ title: 'Second-order partials', text: 'H[i][j] = ∂²f / ∂xᵢ∂xⱼ. For continuous second partials the matrix is symmetric.', tex: '' });
            } else {
                const lap = simplifyNode(vars.map((v, i) => hess[i][i]).reduce((a, b) => OP('+', 'add', [a, b])));
                r.title = 'Laplacian';
                r.main = { label: '∇²f =', text: strOf(lap), tex: `\\nabla^2 f=${texOf(lap)}` };
                vars.forEach((v, i) => r.steps.push({ title: `∂²f/∂${v}²`, text: strOf(hess[i][i]), tex: `\\frac{\\partial^2 f}{\\partial ${v}^2}=${texOf(hess[i][i])}` }));
                r.steps.push({ title: 'Add them', text: `∇²f = ${strOf(lap)}`, tex: '' });
                const lf = compile(lap, vars);
                if ([0.3, 1.1, 2].every(a => Math.abs(lf(...vars.map(() => a))) < 1e-9)) r.meta.push('∇²f = 0: f is a harmonic function.');
            }
        } else if (op === 'critical') {
            if (vars.length < 2 || vars.length > 3) throw new CalcError('Critical-point search supports 2 or 3 variables');
            r.title = 'Critical points';
            const grads = vars.map(v => diff(node, v));
            const hess = vars.map(a => grads.map((_, j) => diff(grads[vars.indexOf(a)], vars[j])));
            const R = Math.max(1, Math.abs(parseFloat(opt.radius)) || 6);
            const pts = newtonCritical(grads, hess, vars, R);
            r.main = { label: 'Solve ∇f = 0:', text: grads.map(g => strOf(g) + ' = 0').join(';  '), tex: grads.map((g, i) => `\\frac{\\partial f}{\\partial ${vars[i]}}=${texOf(g)}=0`).join(',\\;') };
            const Hf = hess.map(row => row.map(nd => compile(nd, vars)));
            const classified = [];
            pts.sort((a, b) => a[0] - b[0] || (a[1] || 0) - (b[1] || 0)).forEach(p => {
                const Hv = Hf.map(row => row.map(fn => fn(...p)));
                let type = 'inconclusive';
                try {
                    const ev = math.eigs(Hv).values.map(Number);
                    const eps = 1e-8;
                    if (ev.every(e => e > eps)) type = 'local minimum';
                    else if (ev.every(e => e < -eps)) type = 'local maximum';
                    else if (ev.some(e => e > eps) && ev.some(e => e < -eps)) type = 'saddle point';
                } catch (e) { /* keep inconclusive */ }
                const z = f(...p);
                classified.push({ p, z, type });
                r.items.push({ label: `${type[0].toUpperCase()}${type.slice(1)}:`, text: `(${p.map(x => nice(x, 6).text).join(', ')}),  f = ${nice(z, 6).text}`, tex: '' });
            });
            if (!pts.length) r.warnings.push(`No critical points found within |${vars.join('|, |')}| ≤ ${R}.`);
            r.steps.push({ title: 'Gradient', text: `∇f = ( ${grads.map(strOf).join(', ')} )`, tex: '' });
            r.steps.push({ title: 'Solve ∇f = 0', text: 'Newton\'s method with the exact Hessian from a grid of starting points; duplicates are merged.', tex: '' });
            r.steps.push({ title: 'Second-derivative test', text: 'Classify each point by the eigenvalues of the Hessian: all positive → minimum, all negative → maximum, mixed → saddle.', tex: '' });
            r.plot3 = { vars: lvars, expr: strOf(node), fn: f, points: classified.filter(c => lvars.length === 2).map(c => ({ x: c.p[0], y: c.p[1], z: c.z, name: c.type })), range: R };
            return finalizeText(r);
        } else if (op === 'double') {
            if (vars.length < 2) throw new CalcError('A double integral needs two variables');
            const [vx, vy] = vars;
            const xa = parseLimit(opt.xLow || '0', `${vx} lower`), xb = parseLimit(opt.xHigh || '1', `${vx} upper`);
            const yaN = parse(opt.yLow || '0'), ybN = parse(opt.yHigh || '1');
            [yaN, ybN].forEach(nd => { const bad = freeVars(nd).filter(n => n !== vx); if (bad.length) throw new CalcError(`Inner limits may only depend on ${vx}`); });
            if (!Number.isFinite(xa.value) || !Number.isFinite(xb.value)) throw new CalcError('Outer limits must be finite');
            const yaF = compile(yaN, [vx]), ybF = compile(ybN, [vx]);
            const inner = x => gl(y => f(...vars.map(n => (n === vx ? x : n === vy ? y : 0))), yaF(x), ybF(x), 4);
            const val = gl(inner, xa.value, xb.value, 4);
            r.title = 'Double integral';
            const limTex = `\\int_{${texOf(xa.node)}}^{${texOf(xb.node)}}\\int_{${texOf(yaN)}}^{${texOf(ybN)}}`;
            r.main = { label: 'Value ≈', text: fmt(val, opt.digits), tex: `${limTex} ${texOf(node)}\\,d${vy}\\,d${vx}\\approx ${fmt(val, opt.digits)}` };
            if (!Number.isFinite(val)) r.warnings.push('The integrand is undefined somewhere in the region.');
            let exact = runAlgebrite(`defint(${toAlgebrite(node)}, ${vy}, ${toAlgebrite(yaN)}, ${toAlgebrite(ybN)}, ${vx}, ${toAlgebrite(xa.node)}, ${toAlgebrite(xb.node)})`);
            const exNode = exact && fromAlgebrite(exact);
            if (exNode && vars.length === 2 && Math.abs(compile(exNode, [])() - val) < 1e-6 * Math.max(1, Math.abs(val))) {
                r.items.push({ label: 'Exact:', text: strOf(exNode), tex: `${texOf(exNode)}` });
                r.meta.push('Exact value found symbolically and verified numerically.');
            } else {
                r.meta.push('Method: nested 16-point Gauss–Legendre quadrature with endpoint clustering.');
            }
            r.items.push({ label: 'Region:', text: `${fmt(xa.value)} ≤ ${vx} ≤ ${fmt(xb.value)},  ${strOf(yaN)} ≤ ${vy} ≤ ${strOf(ybN)}`, tex: '' });
            r.steps.push({ title: 'Set up the iterated integral', text: `∫ ${strOf(xa.node)}→${strOf(xb.node)} ( ∫ ${strOf(yaN)}→${strOf(ybN)} ${strOf(node)} d${vy} ) d${vx}`, tex: `${limTex}${texOf(node)}\\,d${vy}\\,d${vx}` });
            const innerSym = antiderivative(node, vy, 'auto');
            if (innerSym.ok) {
                r.steps.push({ title: `Integrate with respect to ${vy} first`, text: `∫ ${strOf(node)} d${vy} = ${strOf(innerSym.F)}  (then apply the ${vy}-limits)`, tex: `\\int ${texOf(node)}\\,d${vy}=${texOf(innerSym.F)}` });
            }
            r.steps.push({ title: `Integrate with respect to ${vx}`, text: `Integrate the result over ${vx} from ${strOf(xa.node)} to ${strOf(xb.node)}.`, tex: '' });
            const ys = [];
            for (let i = 0; i <= 8; i++) { const x = xa.value + (xb.value - xa.value) * i / 8; ys.push(yaF(x), ybF(x)); }
            r.plot3 = { vars: lvars, expr: strOf(node), fn: f, xRange: [xa.value, xb.value], yRange: [Math.min(...ys), Math.max(...ys)] };
            return finalizeText(r);
        } else {
            throw new CalcError('Unknown multivariable operation');
        }

        const range = Math.max(1, Math.abs(parseFloat(opt.radius)) || 5);
        r.plot3 = { vars: lvars, expr: strOf(node), fn: f, range };
        return finalizeText(r);
    }

    function runVectorField(src, opt, op) {
        const comps = parseVector(src);
        if (comps.length < 2 || comps.length > 3) throw new CalcError('Enter a vector field as 2 or 3 components separated by ;  e.g.  -y ; x');
        let vars = String(opt.vars || '').split(/[,\s]+/).filter(Boolean);
        if (!vars.length) vars = ['x', 'y', 'z'].slice(0, comps.length);
        if (vars.length !== comps.length) throw new CalcError(`The field has ${comps.length} components so give ${comps.length} variables`);
        const r = makeResult('vector', op === 'divergence' ? 'Divergence' : op === 'curl' ? 'Curl' : 'Vector field');
        const Ftex = `\\mathbf{F}=\\left(${comps.map(texOf).join(',\\;')}\\right)`;
        r.items.push({ label: 'F =', text: `( ${comps.map(strOf).join(',  ')} )`, tex: Ftex });
        const part = (i, j) => diff(comps[i], vars[j]);
        if (op === 'divergence') {
            const terms = comps.map((_, i) => part(i, i));
            const div = simplifyNode(terms.reduce((a, b) => OP('+', 'add', [a, b])));
            r.main = { label: '∇·F =', text: strOf(div), tex: `\\nabla\\cdot\\mathbf{F}=${texOf(div)}` };
            terms.forEach((t, i) => r.steps.push({ title: `∂F${i + 1}/∂${vars[i]}`, text: strOf(t), tex: `\\frac{\\partial F_${i + 1}}{\\partial ${vars[i]}}=${texOf(t)}` }));
            r.steps.push({ title: 'Add the terms', text: `∇·F = ${strOf(div)}`, tex: '' });
            const df = compile(div, vars);
            if (div.type === 'ConstantNode') r.meta.push(div.value === 0 ? 'Divergence is 0: the field is incompressible (solenoidal).' : `Constant divergence ${div.value}.`);
            if (opt.point && String(opt.point).trim()) {
                const pt = evalPoint(opt.point, vars);
                r.items.push({ label: `At (${pt.map(x => fmt(x, 4)).join(', ')}):`, text: `∇·F = ${fmt(df(...pt), opt.digits)}`, tex: '' });
            }
        } else if (op === 'curl') {
            if (comps.length === 3) {
                const c = [
                    simplifyNode(OP('-', 'subtract', [part(2, 1), part(1, 2)])),
                    simplifyNode(OP('-', 'subtract', [part(0, 2), part(2, 0)])),
                    simplifyNode(OP('-', 'subtract', [part(1, 0), part(0, 1)]))
                ];
                r.main = { label: '∇×F =', text: `( ${c.map(strOf).join(',  ')} )`, tex: `\\nabla\\times\\mathbf{F}=\\left(${c.map(texOf).join(',\\;')}\\right)` };
                r.steps.push({ title: 'Formula', text: '∇×F = (∂F₃/∂y − ∂F₂/∂z,  ∂F₁/∂z − ∂F₃/∂x,  ∂F₂/∂x − ∂F₁/∂y)', tex: '' });
                c.forEach((t, i) => r.steps.push({ title: `Component ${i + 1}`, text: strOf(t), tex: '' }));
                if (c.every(t => t.type === 'ConstantNode' && t.value === 0)) r.meta.push('Curl is zero: the field is irrotational (conservative on simply connected domains).');
            } else {
                const c = simplifyNode(OP('-', 'subtract', [part(1, 0), part(0, 1)]));
                r.main = { label: '∇×F (scalar) =', text: strOf(c), tex: `\\left(\\nabla\\times\\mathbf{F}\\right)_z=${texOf(c)}` };
                r.steps.push({ title: 'Formula', text: '2D curl: ∂F₂/∂x − ∂F₁/∂y', tex: `\\frac{\\partial F_2}{\\partial ${vars[0]}}-\\frac{\\partial F_1}{\\partial ${vars[1]}}` });
                r.steps.push({ title: 'Result', text: strOf(c), tex: texOf(c) });
                if (c.type === 'ConstantNode' && c.value === 0) r.meta.push('Curl is zero: the field is irrotational.');
            }
        } else {
            r.main = { label: 'F =', text: `( ${comps.map(strOf).join(',  ')} )`, tex: Ftex };
        }
        if (comps.length === 2) {
            r.plot2field = { vars, exprs: comps.map(strOf), fns: comps.map(c => compile(c, vars)) };
        }
        r.plot3 = comps.length === 3 ? { vars, exprs: comps.map(strOf), fns: comps.map(c => compile(c, vars)), field: true } : null;
        return finalizeText(r);
    }


    // ------------------------------------------------------------------
    // Shared quadrature helper for the "applications" modes
    // ------------------------------------------------------------------
    function quad(node, v, a, b, aNode, bNode) {
        const f = compile(node, [v]);
        const num = integrateRobust(f, a, b, kinkPoints(node, v, a, b));
        const rel = num.error / Math.max(1e-12, Math.abs(num.value));
        const diverges = !Number.isFinite(num.value) || (num.error > 1e-4 && rel > 1e-3);
        let exact = null;
        if (!diverges && Number.isFinite(a) && Number.isFinite(b)) {
            budgetMs = 3000;
            let sym; try { sym = antiderivative(node, v, 'auto'); } finally { budgetMs = 8000; }
            if (sym.ok) {
                const Fb = substitute(sym.F, { [v]: bNode || b }), Fa = substitute(sym.F, { [v]: aNode || a });
                const dn = OP('-', 'subtract', [new math.ParenthesisNode(Fb), new math.ParenthesisNode(Fa)]);
                const val = compile(dn, [])();
                if (Number.isFinite(val) && Math.abs(val - num.value) <= 1e-6 * Math.max(1, Math.abs(val))) exact = simplifyNode(dn);
            }
        }
        return { value: num.value, error: num.error, warnings: num.warnings, diverges, exact };
    }

    function sameSign(f, g, lo, hi) {
        let pos = 0, neg = 0;
        for (let i = 0; i <= 200; i++) { const x = lo + (hi - lo) * i / 200, d = f(x) - g(x); if (d > 1e-12) pos++; else if (d < -1e-12) neg++; }
        return pos === 0 || neg === 0 ? (pos ? 1 : -1) : 0;
    }

    // ------------------------------- Riemann sums -------------------------------
    function runRiemann(src, opt) {
        const node = parse(src);
        const v = pickVar(node, opt.variable);
        const a = parseLimit(opt.lower === undefined || opt.lower === '' ? '0' : opt.lower, 'Lower limit');
        const b = parseLimit(opt.upper === undefined || opt.upper === '' ? '1' : opt.upper, 'Upper limit');
        if (!Number.isFinite(a.value) || !Number.isFinite(b.value) || a.value >= b.value) throw new CalcError('Use finite limits with lower < upper');
        const rule = opt.rule || 'left';
        let n = Math.max(1, Math.min(100000, parseInt(opt.n, 10) || 8));
        if (rule === 'simpson' && n % 2) n += 1;
        const f = compile(node, [v]);
        const sum = (nn, rl) => {
            const dx = (b.value - a.value) / nn;
            let s0 = 0;
            if (rl === 'simpson') {
                for (let i = 0; i <= nn; i++) s0 += f(a.value + i * dx) * (i === 0 || i === nn ? 1 : i % 2 ? 4 : 2);
                return s0 * dx / 3;
            }
            for (let i = 0; i < nn; i++) {
                const x0 = a.value + i * dx;
                s0 += rl === 'left' ? f(x0) : rl === 'right' ? f(x0 + dx) : rl === 'mid' ? f(x0 + dx / 2) : (f(x0) + f(x0 + dx)) / 2;
            }
            return s0 * dx;
        };
        const approx = sum(n, rule);
        if (!Number.isFinite(approx)) throw new CalcError('The function is undefined somewhere on the interval');
        const q = quad(node, v, a.value, b.value, a.node, b.node);
        const dx = (b.value - a.value) / n;
        const names = { left: 'Left Riemann sum', right: 'Right Riemann sum', mid: 'Midpoint rule', trap: 'Trapezoidal rule', simpson: "Simpson's rule" };
        const r = makeResult('riemann', names[rule]);
        const intTex = `\\int_{${texOf(a.node)}}^{${texOf(b.node)}} ${texOf(node)}\\,d${v}`;
        r.main = { label: 'Approximation ≈', text: fmt(approx, opt.digits), tex: `${intTex}\\approx ${fmt(approx, opt.digits)}` };
        if (!q.diverges) {
            r.items.push({ label: 'Exact integral:', text: q.exact ? strOf(q.exact) + ' ≈ ' + fmt(q.value, opt.digits) : fmt(q.value, opt.digits), tex: q.exact ? `${intTex}=${texOf(q.exact)}\\approx ${fmt(q.value, opt.digits)}` : `${intTex}\\approx ${fmt(q.value, opt.digits)}` });
            r.items.push({ label: 'Error:', text: `${approx - q.value >= 0 ? '+' : ''}${(approx - q.value).toExponential(3)}  (${(Math.abs(approx - q.value) / Math.max(1e-300, Math.abs(q.value)) * 100).toFixed(4)} %)`, tex: '' });
        }
        r.items.push({ label: 'Subintervals:', text: `n = ${n},  Δx = ${fmt(dx, 8)}`, tex: `n=${n},\\quad \\Delta x=\\frac{b-a}{n}=${fmt(dx, 8)}` });
        const conv = [];
        for (let k = 2; k <= 1024 && conv.length < 6; k *= 4) { const val = sum(rule === 'simpson' && k % 2 ? k + 1 : k, rule); conv.push(`n=${k}: ${fmt(val, 8)}`); }
        r.items.push({ label: 'Convergence:', text: conv.join('   '), tex: '' });
        const formula = { left: 'Σ f(xᵢ)·Δx, xᵢ = a + iΔx (i = 0…n−1)', right: 'Σ f(xᵢ)·Δx, xᵢ = a + iΔx (i = 1…n)', mid: 'Σ f(a + (i+½)Δx)·Δx', trap: 'Δx·[½f(x₀) + f(x₁) + … + f(xₙ₋₁) + ½f(xₙ)]', simpson: '(Δx/3)·[f(x₀) + 4f(x₁) + 2f(x₂) + … + 4f(xₙ₋₁) + f(xₙ)]' }[rule];
        r.steps.push({ title: 'Partition the interval', text: `Δx = (${strOf(b.node)} − ${strOf(a.node)}) / ${n} = ${fmt(dx, 8)}`, tex: `\\Delta x=\\frac{b-a}{n}` });
        r.steps.push({ title: 'Apply the rule', text: formula, tex: '' });
        const show = Math.min(n, 5);
        for (let i = 0; i < show; i++) {
            const x0 = a.value + i * dx, xs = rule === 'left' ? x0 : rule === 'right' ? x0 + dx : x0 + dx / 2;
            if (rule !== 'simpson' && rule !== 'trap') r.steps.push({ title: `Term ${i + 1}`, text: `f(${fmt(xs, 6)}) · Δx = ${fmt(f(xs), 6)} · ${fmt(dx, 6)} = ${fmt(f(xs) * dx, 8)}`, tex: '' });
        }
        r.steps.push({ title: 'Add everything up', text: `≈ ${fmt(approx, 10)}`, tex: '' });
        if (!q.diverges) r.steps.push({ title: 'Compare with the exact value', text: `The integral equals ${fmt(q.value, 10)}; error ${(approx - q.value).toExponential(3)}. Doubling n shrinks the error by ~2 (left/right), ~4 (trap/mid) or ~16 (Simpson).`, tex: '' });
        const bars = [];
        if (n <= 400 && (rule === 'left' || rule === 'right' || rule === 'mid')) {
            for (let i = 0; i < n; i++) { const x0 = a.value + i * dx, xs = rule === 'left' ? x0 : rule === 'right' ? x0 + dx : x0 + dx / 2; bars.push({ x0, x1: x0 + dx, y: f(xs) }); }
        }
        const trap = [];
        if (n <= 400 && rule === 'trap') for (let i = 0; i <= n; i++) trap.push({ x: a.value + i * dx, y: f(a.value + i * dx) });
        r.plot = { variable: v, curves: [curveOf('f(x)', node, [v])], bars, trap, xRange: rangeFor(a.value, b.value) };
        return finalizeText(r);
    }

    // ---------------------------- Applications of integration ----------------------------
    function runApplications(src, opt) {
        const fN = parse(src);
        const v = pickVar(fN, opt.variable);
        const gN = opt.g && String(opt.g).trim() ? parse(opt.g) : C(0);
        const a = parseLimit(opt.lower === undefined || opt.lower === '' ? '0' : opt.lower, 'Lower limit');
        const b = parseLimit(opt.upper === undefined || opt.upper === '' ? '1' : opt.upper, 'Upper limit');
        if (!Number.isFinite(a.value) || !Number.isFinite(b.value) || a.value >= b.value) throw new CalcError('Use finite limits with lower < upper');
        const f = compile(fN, [v]), g = compile(gN, [v]);
        const op = opt.op || 'area';
        const sg = sameSign(f, g, a.value, b.value);
        const P = new math.ParenthesisNode(fN), Gp = new math.ParenthesisNode(gN);
        const diffN = OP('-', 'subtract', [P, Gp]);
        let integrand, title, label, text;
        const abs = n => new math.FunctionNode('abs', [n]);
        const absIf = (n, fn) => { const sgn = sameSign(fn, () => 0, a.value, b.value); return sgn > 0 ? n : sgn < 0 ? OP('-', 'unaryMinus', [new math.ParenthesisNode(n)]) : abs(n); };
        const sqrtN = n => new math.FunctionNode('sqrt', [n]);
        const df = () => diff(fN, v);
        const r0 = op;
        if (op === 'area') {
            integrand = sg === 0 ? abs(diffN) : (sg > 0 ? diffN : OP('-', 'unaryMinus', [diffN]));
            title = gN.type === 'ConstantNode' && gN.value === 0 ? 'Area under the curve' : 'Area between curves'; label = 'Area =';
        } else if (op === 'arclength') {
            integrand = sqrtN(OP('+', 'add', [C(1), OP('^', 'pow', [new math.ParenthesisNode(df()), C(2)])]));
            title = 'Arc length'; label = 'Length ='; 
        } else if (op === 'volumex') {
            integrand = OP('*', 'multiply', [S('pi'), absIf(OP('-', 'subtract', [OP('^', 'pow', [P, C(2)]), OP('^', 'pow', [Gp, C(2)])]), x => f(x) * f(x) - g(x) * g(x))]);
            title = 'Volume of revolution about the x-axis'; label = 'Volume =';
        } else if (op === 'volumey') {
            if (a.value < 0) throw new CalcError('Shell method needs x ≥ 0 on the interval');
            integrand = OP('*', 'multiply', [OP('*', 'multiply', [C(2), S('pi')]), OP('*', 'multiply', [S(v), absIf(diffN, x => f(x) - g(x))])]);
            title = 'Volume of revolution about the y-axis (shells)'; label = 'Volume =';
        } else if (op === 'surface') {
            integrand = OP('*', 'multiply', [OP('*', 'multiply', [C(2), S('pi')]), OP('*', 'multiply', [absIf(P, f), sqrtN(OP('+', 'add', [C(1), OP('^', 'pow', [new math.ParenthesisNode(df()), C(2)])]))])]);
            title = 'Surface area of revolution (x-axis)'; label = 'Surface area =';
        } else if (op === 'average') {
            integrand = fN; title = 'Average value of f'; label = 'Average ='; 
        } else throw new CalcError('Unknown operation');
        integrand = simplifyNode(integrand);
        const q = quad(integrand, v, a.value, b.value, a.node, b.node);
        const r = makeResult('applications', title);
        if (q.diverges || !Number.isFinite(q.value)) throw new CalcError('The integral does not converge on this interval');
        r.warnings.push(...q.warnings);
        let value = q.value, exact = q.exact;
        if (op === 'average') {
            value = q.value / (b.value - a.value);
            exact = exact ? simplifyNode(OP('/', 'divide', [new math.ParenthesisNode(exact), new math.ParenthesisNode(OP('-', 'subtract', [b.node, a.node]))])) : null;
        }
        const nv = nice(value, opt.digits);
        const unit = { area: '', arclength: '', volumex: '', volumey: '', surface: '', average: '' }[op];
        r.main = { label, text: (exact ? strOf(exact) + ' ≈ ' : '') + fmt(value, opt.digits), tex: `${exact ? texOf(exact) + '\\approx ' : ''}${fmt(value, opt.digits)}${unit}` };
        r.items.push({ label: 'Integrand:', text: strOf(integrand), tex: `${texOf(integrand)}` });
        r.items.push({ label: 'Interval:', text: `[${strOf(a.node)}, ${strOf(b.node)}]`, tex: '' });
        if (nv.text !== fmt(value, opt.digits) && !exact) r.items.push({ label: 'Recognised as:', text: nv.text, tex: nv.tex });
        const formulas = {
            area: ['A = ∫ |f(x) − g(x)| dx', `A=\\int_a^b \\left|f(x)-g(x)\\right|dx`],
            arclength: ['L = ∫ √(1 + f′(x)²) dx', `L=\\int_a^b\\sqrt{1+\\left(f'(x)\\right)^2}\\,dx`],
            volumex: ['V = π ∫ |f(x)² − g(x)²| dx  (disk / washer)', `V=\\pi\\int_a^b\\left|f(x)^2-g(x)^2\\right|dx`],
            volumey: ['V = 2π ∫ x·|f(x) − g(x)| dx  (cylindrical shells)', `V=2\\pi\\int_a^b x\\,\\left|f(x)-g(x)\\right|dx`],
            surface: ['S = 2π ∫ |f(x)| √(1 + f′(x)²) dx', `S=2\\pi\\int_a^b |f(x)|\\sqrt{1+f'(x)^2}\\,dx`],
            average: ['f_avg = 1/(b − a) · ∫ f(x) dx', `f_{avg}=\\frac{1}{b-a}\\int_a^b f(x)\\,dx`]
        }[op];
        r.steps.push({ title: 'Formula', text: formulas[0], tex: formulas[1] });
        r.steps.push({ title: 'Build the integrand', text: strOf(integrand), tex: texOf(integrand) });
        r.steps.push({ title: exact ? 'Evaluate exactly (FTC)' : 'Evaluate numerically', text: exact ? `= ${strOf(exact)}` : `tanh-sinh quadrature gives ${fmt(value, 10)}`, tex: '' });
        if (op === 'average') {
            const m = [], ff = f;
            signChanges(x => ff(x) - value, a.value, b.value, 800).forEach(c => m.push(c.x));
            if (m.length) { r.items.push({ label: 'Mean-value point(s) c:', text: m.map(c => `c = ${fmt(c, 6)}`).join(',  '), tex: '' }); r.steps.push({ title: 'Mean Value Theorem', text: `f(c) = ${fmt(value, 6)} at ${m.map(c => fmt(c, 5)).join(', ')}`, tex: '' }); }
        }
        const curves = [curveOf('f(x)', fN, [v])];
        if (!(gN.type === 'ConstantNode' && gN.value === 0) && op !== 'arclength' && op !== 'average') curves.push(curveOf('g(x)', gN, [v], 'dash'));
        if (op === 'volumex' || op === 'surface') curves.push(curveOf('−f(x)', OP('-', 'unaryMinus', [P]), [v], 'dot'));
        r.plot = { variable: v, curves, xRange: rangeFor(a.value, b.value) };
        if (op === 'area' || op === 'volumex' || op === 'volumey') r.plot.shade2 = { f: strOf(fN), g: strOf(gN), vars: [v], a: a.value, b: b.value, fFn: f, gFn: g };
        if (op === 'average') { r.plot.shade = { expr: strOf(fN), vars: [v], fn: f, a: a.value, b: b.value }; r.plot.hline = value; }
        return finalizeText(r);
    }

    // --------------------------------- Root finding ---------------------------------
    function runRoot(src, opt) {
        const node = parse(src);
        const v = pickVar(node, opt.variable);
        const f = compile(node, [v]);
        const d = diff(node, v), df = compile(d, [v]);
        const method = opt.method || 'newton';
        const maxIt = Math.max(1, Math.min(60, parseInt(opt.steps, 10) || 12));
        const tol = Math.abs(parseFloat(opt.tol)) || 1e-12;
        const r = makeResult('root', { newton: "Newton's method", bisection: 'Bisection method', secant: 'Secant method' }[method] || 'Root finding');
        const rows = [], segs = [];
        let x;
        if (method === 'newton') {
            x = parseLimit(opt.x0 === undefined || opt.x0 === '' ? '1' : opt.x0, 'Starting guess').value;
            for (let i = 0; i < maxIt; i++) {
                const fx = f(x), dfx = df(x);
                rows.push({ i, x, fx });
                if (!Number.isFinite(fx) || !Number.isFinite(dfx)) { r.warnings.push('The function or its derivative is undefined at an iterate.'); break; }
                if (Math.abs(fx) < tol) break;
                if (Math.abs(dfx) < 1e-14) { r.warnings.push('The derivative is ~0 at an iterate – Newton\'s method cannot continue. Try another starting guess.'); break; }
                const nx = x - fx / dfx;
                segs.push({ x: [x, nx], y: [fx, 0] }); segs.push({ x: [nx, nx], y: [0, f(nx)] });
                x = nx;
                if (i === maxIt - 1) rows.push({ i: i + 1, x, fx: f(x) });
            }
        } else if (method === 'secant') {
            let x0 = parseLimit(opt.x0 === undefined || opt.x0 === '' ? '0' : opt.x0, 'x₀').value, x1 = parseLimit(opt.x1 === undefined || opt.x1 === '' ? '1' : opt.x1, 'x₁').value;
            rows.push({ i: 0, x: x0, fx: f(x0) });
            for (let i = 1; i <= maxIt; i++) {
                const f0 = f(x0), f1 = f(x1);
                rows.push({ i, x: x1, fx: f1 });
                if (!Number.isFinite(f1) || Math.abs(f1) < tol || f1 === f0) break;
                const nx = x1 - f1 * (x1 - x0) / (f1 - f0);
                segs.push({ x: [x0, x1, nx], y: [f0, f1, 0] });
                x0 = x1; x1 = nx;
            }
            x = x1;
        } else {
            let lo = parseLimit(opt.a === undefined || opt.a === '' ? '0' : opt.a, 'a').value, hi = parseLimit(opt.b === undefined || opt.b === '' ? '2' : opt.b, 'b').value;
            if (lo > hi) [lo, hi] = [hi, lo];
            if (!(f(lo) * f(hi) < 0)) throw new CalcError(`f(a) and f(b) must have opposite signs (f(${fmt(lo)}) = ${fmt(f(lo), 4)}, f(${fmt(hi)}) = ${fmt(f(hi), 4)})`);
            const it = Math.max(maxIt, 1);
            for (let i = 0; i < Math.max(it, 60); i++) {
                const mid = (lo + hi) / 2, fm = f(mid);
                rows.push({ i, x: mid, fx: fm, lo, hi });
                if (Math.abs(fm) < tol || (hi - lo) / 2 < tol) { x = mid; break; }
                if (f(lo) * fm < 0) hi = mid; else lo = mid;
                x = mid;
            }
        }
        const last = rows[rows.length - 1];
        const conv = last && Number.isFinite(last.fx) && Math.abs(last.fx) < 1e-8 * Math.max(1, Math.abs(last.x));
        r.main = { label: conv ? 'Root ≈' : 'Last iterate ≈', text: fmt(x, 12), tex: `${v}\\approx ${fmt(x, 12)}` };
        r.items.push({ label: 'f(root):', text: Number.isFinite(f(x)) ? f(x).toExponential(3) : 'undefined', tex: '' });
        if (conv) { const nv = nice(x, 10, 1e-9); if (nv.text !== fmt(x, 12)) r.items.push({ label: 'Recognised as:', text: nv.text, tex: nv.tex }); }
        else r.warnings.push('The iteration did not converge within the step limit.');
        if (method === 'newton') r.items.push({ label: "f′(x) =", text: strOf(d), tex: `f'(${v})=${texOf(d)}` });
        rows.forEach(row => r.steps.push({
            title: `Iteration ${row.i}`,
            text: method === 'bisection' ? `midpoint = ${fmt(row.x, 12)},  f = ${row.fx.toExponential(3)},  interval [${fmt(row.lo, 8)}, ${fmt(row.hi, 8)}]` : `x = ${fmt(row.x, 14)},  f(x) = ${Number.isFinite(row.fx) ? row.fx.toExponential(3) : 'undefined'}`,
            tex: ''
        }));
        if (method === 'newton') r.steps.unshift({ title: 'Iteration formula', text: `xₙ₊₁ = xₙ − f(xₙ)/f′(xₙ)`, tex: `x_{n+1}=x_n-\\frac{f(x_n)}{f'(x_n)}` });
        const pts = rows.map((row, k) => ({ x: row.x, y: 0, name: `x${k}`, color: '#ff9500' }));
        r.plot = { variable: v, curves: [curveOf('f(x)', node, [v])], points: pts, segments: segs, hlines: [0], xRange: [Math.min(...rows.map(q => q.x), x) - 2, Math.max(...rows.map(q => q.x), x) + 2] };
        return finalizeText(r);
    }

    // ---------------------------------- Fourier ----------------------------------
    function runFourier(src, opt) {
        const node = parse(src);
        const v = pickVar(node, opt.variable);
        const a = parseLimit(opt.lower === undefined || opt.lower === '' ? '-pi' : opt.lower, 'Period start');
        const b = parseLimit(opt.upper === undefined || opt.upper === '' ? 'pi' : opt.upper, 'Period end');
        if (!Number.isFinite(a.value) || !Number.isFinite(b.value) || a.value >= b.value) throw new CalcError('Use a finite period with start < end');
        const N = Math.max(1, Math.min(60, parseInt(opt.terms, 10) || 8));
        const T = b.value - a.value, w = 2 * Math.PI / T;
        const f = compile(node, [v]);
        const kinks = kinkPoints(node, v, a.value, b.value);
        const I = fn => integrateRobust(fn, a.value, b.value, kinks).value;
        const a0 = 2 / T * I(f);
        const an = [], bn = [];
        for (let k = 1; k <= N; k++) {
            an.push(2 / T * I(x => f(x) * Math.cos(k * w * x)));
            bn.push(2 / T * I(x => f(x) * Math.sin(k * w * x)));
        }
        if (!Number.isFinite(a0) || !an.every(Number.isFinite) || !bn.every(Number.isFinite)) throw new CalcError('The function is not integrable on the period');
        const clean = x => (Math.abs(x) < 1e-10 ? 0 : x);
        const terms = [`${snapCoef(clean(a0) / 2)}`];
        for (let k = 1; k <= N; k++) {
            if (clean(an[k - 1]) !== 0) terms.push(`${snapCoef(an[k - 1])}*cos(${k * w}*${v})`);
            if (clean(bn[k - 1]) !== 0) terms.push(`${snapCoef(bn[k - 1])}*sin(${k * w}*${v})`);
        }
        const sExpr = terms.join(' + ');
        const sNode = parse(sExpr);
        const sf = compile(sNode, [v]);
        const r = makeResult('fourier', `Fourier series (${N} harmonics)`);
        const cosOnly = bn.every(x => Math.abs(x) < 1e-8), sinOnly = an.every(x => Math.abs(x) < 1e-8) && Math.abs(a0) < 1e-8;
        r.main = { label: `S${N}(${v}) =`, text: `${nice(a0 / 2, 6).text} + Σ (aₖ cos kωx + bₖ sin kωx)`, tex: `S_{${N}}(${v})=\\frac{a_0}{2}+\\sum_{k=1}^{${N}}\\left(a_k\\cos(k\\omega ${v})+b_k\\sin(k\\omega ${v})\\right),\\quad \\omega=\\frac{2\\pi}{${fmt(T, 6)}}` };
        r.items.push({ label: 'Period & frequency:', text: `T = ${fmt(T, 8)},  ω = ${fmt(w, 8)}`, tex: '' });
        r.items.push({ label: 'a₀ / 2 =', text: nice(a0 / 2, 8).text, tex: '' });
        for (let k = 1; k <= Math.min(N, 8); k++) r.items.push({ label: `k = ${k}:`, text: `aₖ = ${nice(clean(an[k - 1]), 6).text},   bₖ = ${nice(clean(bn[k - 1]), 6).text}`, tex: '' });
        if (cosOnly) r.meta.push('All sine coefficients vanish – f is even (cosine series).');
        if (sinOnly) r.meta.push('All cosine coefficients vanish – f is odd (sine series).');
        // error estimate
        let mx = 0; for (let i = 0; i <= 400; i++) { const x = a.value + T * i / 400, d = Math.abs(f(x) - sf(x)); if (Number.isFinite(d)) mx = Math.max(mx, d); }
        r.meta.push(`Max |f − S${N}| on one period ≈ ${fmt(mx, 4)} (larger near jumps – the Gibbs phenomenon).`);
        const Ek = [a0 * a0 / 2 + an.reduce((s0, c) => s0 + c * c, 0) + bn.reduce((s0, c) => s0 + c * c, 0)];
        r.meta.push(`Parseval partial energy: ${fmt(Ek[0] * T / 2, 6)} vs ∫f² = ${fmt(I(x => f(x) * f(x)), 6)}`);
        r.steps.push({ title: 'Period and frequency', text: `T = b − a = ${fmt(T, 8)}, ω = 2π/T`, tex: `\\omega=\\frac{2\\pi}{T}` });
        r.steps.push({ title: 'Coefficient formulas', text: 'a₀ = (2/T)∫f,  aₖ = (2/T)∫f·cos(kωx),  bₖ = (2/T)∫f·sin(kωx)', tex: `a_k=\\frac{2}{T}\\int_a^b f(x)\\cos(k\\omega x)\\,dx,\\quad b_k=\\frac{2}{T}\\int_a^b f(x)\\sin(k\\omega x)\\,dx` });
        r.steps.push({ title: 'Numerical integration', text: `Each coefficient is computed with tanh-sinh quadrature (${2 * N + 1} integrals).`, tex: '' });
        r.steps.push({ title: 'Assemble the partial sum', text: sExpr.length > 220 ? sExpr.slice(0, 220) + ' …' : sExpr, tex: '' });
        const lo = a.value - T, hi = b.value + T, M = 1200, tt = [], yy = [], dy = [];
        const per = x => { let t = ((x - a.value) % T + T) % T; return f(a.value + t); };
        for (let i = 0; i <= M; i++) { const x = lo + (hi - lo) * i / M; tt.push(x); yy.push(per(x)); }
        for (let i = 0; i <= M; i++) dy.push(i === 0 || i === M ? 0 : (yy[i + 1] - yy[i - 1]) / (tt[i + 1] - tt[i - 1]) || 0);
        r.plot = {
            variable: v,
            curves: [{ name: 'f (periodic extension)', data: { t: tt, y: yy.map(y => (Number.isFinite(y) ? y : 0)), dy }, fn: hermite({ t: tt, y: yy, dy }) }, curveOf(`S${N}(x)`, sNode, [v], 'dash')],
            xRange: [lo, hi]
        };
        return finalizeText(r);
    }

    // ----------------------------------- Matrices -----------------------------------
    function parseMatrix(text, what) {
        const rows = String(text).split(/[;\n]+/).map(s => s.trim()).filter(Boolean).map(row => row.split(/[,\s]+/).filter(Boolean));
        if (!rows.length) throw new CalcError(`Enter ${what || 'a matrix'}, e.g.  1 2 ; 3 4`);
        const w = rows[0].length;
        if (rows.some(r => r.length !== w)) throw new CalcError('All rows must have the same number of entries');
        if (rows.length > 8 || w > 8) throw new CalcError('Matrices up to 8×8 are supported');
        return rows.map(r => r.map(c => { const val = parseLimit(c, 'Matrix entry').value; if (!Number.isFinite(val)) throw new CalcError('Matrix entries must be finite numbers'); return val; }));
    }
    const matTex = M => `\\begin{bmatrix}${M.map(r => r.map(x => nice(x, 6, 1e-9).tex).join('&')).join('\\\\')}\\end{bmatrix}`;
    const matTxt = M => '[ ' + M.map(r => '[' + r.map(x => nice(x, 6, 1e-9).text).join(', ') + ']').join(', ') + ' ]';

    function rref(M) {
        const A = M.map(r => r.slice()), m = A.length, n = A[0].length, pivots = [];
        let row = 0;
        for (let c = 0; c < n && row < m; c++) {
            let p = row; for (let i = row + 1; i < m; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
            if (Math.abs(A[p][c]) < 1e-10) continue;
            [A[row], A[p]] = [A[p], A[row]];
            const d = A[row][c]; A[row] = A[row].map(x => x / d);
            for (let i = 0; i < m; i++) if (i !== row) { const f0 = A[i][c]; A[i] = A[i].map((x, j) => x - f0 * A[row][j]); }
            pivots.push(c); row++;
        }
        return { A: A.map(r => r.map(x => (Math.abs(x) < 1e-12 ? 0 : x))), pivots };
    }


    /** Characteristic polynomial coefficients [1, c1, …, cn] of det(λI − A) (Faddeev–LeVerrier). */
    function charPolyCoeffs(M) {
        const n = M.length, I = M.map((row, i) => row.map((_, j) => (i === j ? 1 : 0)));
        let Mk = M.map(row => row.map(() => 0));
        const c = [1];
        for (let k = 1; k <= n; k++) {
            Mk = k === 1 ? I.map(row => row.slice()) : math.add(math.multiply(M, Mk), math.multiply(c[k - 1], I));
            const AMk = math.multiply(M, Mk);
            c.push(-AMk.reduce((s0, row, i) => s0 + row[i], 0) / k);
        }
        return c;
    }

    /** Basis of the null space of M (columns that are free after row reduction). */
    function nullSpace(M, tol) {
        const m = M.length, n = M[0].length;
        const A = M.map(r => r.slice()), pivots = [];
        let row = 0;
        for (let c = 0; c < n && row < m; c++) {
            let p = row; for (let i = row + 1; i < m; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
            if (Math.abs(A[p][c]) < tol) continue;
            [A[row], A[p]] = [A[p], A[row]];
            const d = A[row][c]; A[row] = A[row].map(x => x / d);
            for (let i = 0; i < m; i++) if (i !== row) { const f0 = A[i][c]; A[i] = A[i].map((x, j) => x - f0 * A[row][j]); }
            pivots.push(c); row++;
        }
        const free = []; for (let c = 0; c < n; c++) if (!pivots.includes(c)) free.push(c);
        return free.map(fc => { const v = new Array(n).fill(0); v[fc] = 1; pivots.forEach((pc, r) => { v[pc] = -A[r][fc]; }); return v; });
    }

    function runMatrix(src, opt) {
        const M = parseMatrix(src);
        const m = M.length, n = M[0].length, op = opt.op || 'det';
        const sq = () => { if (m !== n) throw new CalcError('This operation needs a square matrix'); };
        const r = makeResult('matrix', 'Matrix algebra');
        const mm = x => math.matrix(x);
        r.items.push({ label: 'A =', text: matTxt(M), tex: `A=${matTex(M)}` });
        r.meta.push(`Size ${m}×${n}`);
        if (op === 'det') {
            sq(); const d = math.det(M); r.title = 'Determinant';
            r.main = { label: 'det(A) =', text: nice(d, 8, 1e-9).text, tex: `\\det A=${nice(d, 8, 1e-9).tex}` };
            if (Math.abs(d) < 1e-10) r.meta.push('det = 0 → the matrix is singular (not invertible); its rows are linearly dependent.');
            r.steps.push({ title: 'Method', text: m === 2 ? 'For 2×2: ad − bc.' : 'Expand by cofactors / LU decomposition with partial pivoting.', tex: m === 2 ? `\\det\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}=ad-bc` : '' });
            r.steps.push({ title: 'Result', text: nice(d, 10, 1e-9).text, tex: '' });
        } else if (op === 'inverse') {
            sq(); const d = math.det(M); r.title = 'Inverse';
            if (Math.abs(d) < 1e-10) throw new CalcError('The matrix is singular (det = 0) and has no inverse');
            const inv = math.inv(M);
            r.main = { label: 'A⁻¹ =', text: matTxt(inv), tex: `A^{-1}=${matTex(inv)}` };
            r.items.push({ label: 'det(A) =', text: nice(d, 8, 1e-9).text, tex: '' });
            const prod = math.multiply(M, inv); const idErr = Math.max(...prod.flatMap((row, i) => row.map((x, j) => Math.abs(x - (i === j ? 1 : 0)))));
            r.meta.push(`Verified: max |A·A⁻¹ − I| = ${idErr.toExponential(2)}`);
            r.steps.push({ title: 'Gauss–Jordan elimination', text: 'Row-reduce [A | I] until the left block becomes I; the right block is A⁻¹.', tex: '' });
            r.steps.push({ title: 'Check', text: 'A · A⁻¹ = I', tex: '' });
        } else if (op === 'transpose') {
            r.title = 'Transpose'; const t = math.transpose(M);
            r.main = { label: 'Aᵀ =', text: matTxt(t), tex: `A^{T}=${matTex(t)}` };
        } else if (op === 'trace') {
            sq(); const t = M.reduce((s0, row, i) => s0 + row[i], 0); r.title = 'Trace';
            r.main = { label: 'tr(A) =', text: nice(t, 8, 1e-9).text, tex: `\\operatorname{tr}A=${nice(t, 8, 1e-9).tex}` };
        } else if (op === 'rank' || op === 'rref') {
            const { A, pivots } = rref(M); r.title = op === 'rank' ? 'Rank' : 'Reduced row echelon form';
            if (op === 'rank') r.main = { label: 'rank(A) =', text: String(pivots.length), tex: `\\operatorname{rank}A=${pivots.length}` };
            else r.main = { label: 'rref(A) =', text: matTxt(A), tex: `\\operatorname{rref}A=${matTex(A)}` };
            r.items.push({ label: 'Pivot columns:', text: pivots.map(p => p + 1).join(', ') || 'none', tex: '' });
            r.items.push({ label: 'Nullity:', text: String(n - pivots.length), tex: '' });
            r.steps.push({ title: 'Gauss–Jordan elimination', text: 'Swap rows for the largest pivot, scale it to 1 and clear the column.', tex: '' });
            r.steps.push({ title: 'Result', text: `${pivots.length} pivot${pivots.length === 1 ? '' : 's'} → rank ${pivots.length}`, tex: '' });
            if (op === 'rank') r.items.push({ label: 'rref(A) =', text: matTxt(A), tex: `\\operatorname{rref}A=${matTex(A)}` });
        } else if (op === 'eigen') {
            sq(); r.title = 'Eigenvalues & eigenvectors';
            const co = charPolyCoeffs(M);
            const roots = polyRoots(co.slice().reverse());
            const scale = Math.max(1, ...roots.map(z => Math.hypot(z.re, z.im)));
            const used = new Array(roots.length).fill(false), groups = [];
            roots.forEach((z, i) => {
                if (used[i]) return; used[i] = true;
                const members = [z];
                roots.forEach((w, j) => { if (!used[j] && Math.hypot(w.re - z.re, w.im - z.im) < 1e-4 * scale) { used[j] = true; members.push(w); } });
                let re = members.reduce((a, q) => a + q.re, 0) / members.length, im = members.reduce((a, q) => a + q.im, 0) / members.length;
                const sn = x => { try { const nv = nice(x, 9, 5e-8); const val = /^-?\d+(\/\d+)?$/.test(nv.text) ? math.evaluate(nv.text) : x; return Math.abs(val - x) < 1e-7 * scale ? val : x; } catch (e) { return x; } };
                re = sn(re); im = Math.abs(im) < 1e-7 * scale ? 0 : sn(im);
                groups.push({ re, im, alg: members.length });
            });
            // keep one of each conjugate pair for display; the other is implied
            const shown = groups.filter(g => g.im >= 0).sort((a, b) => a.re - b.re || a.im - b.im);
            const fmtL = g => (g.im === 0 ? nice(g.re, 8, 1e-9).text : `${nice(g.re, 6, 1e-9).text} ${'±'} ${nice(Math.abs(g.im), 6, 1e-9).text}i`);
            const fmtT = g => (g.im === 0 ? nice(g.re, 8, 1e-9).tex : `${nice(g.re, 6, 1e-9).tex}\\pm ${nice(Math.abs(g.im), 6, 1e-9).tex}i`);
            r.main = { label: 'λ =', text: shown.map(fmtL).join(',  '), tex: `\\lambda=${shown.map(fmtT).join(',\;')}` };
            let worst = 0, defective = false;
            shown.forEach(g => {
                if (g.im !== 0) { r.items.push({ label: `λ = ${fmtL(g)}:`, text: `complex conjugate pair${g.alg > 1 ? ` (algebraic multiplicity ${g.alg})` : ''} – eigenvectors are complex`, tex: '', inline: true }); return; }
                const sh = M.map((row, i) => row.map((x, j) => (i === j ? x - g.re : x)));
                const basis = nullSpace(sh, 1e-6 * Math.max(1, scale));
                const geo = basis.length;
                if (geo < g.alg) defective = true;
                const vecs = basis.map(v => { const nrm = Math.hypot(...v) || 1; let u = v.map(x => x / nrm); const first = u.find(x => Math.abs(x) > 1e-9); if (first < 0) u = u.map(x => -x); return u; });
                vecs.forEach(u => { const av = math.multiply(M, u); worst = Math.max(worst, Math.max(...av.map((x, i) => Math.abs(x - g.re * u[i])))); });
                r.items.push({ label: `λ = ${fmtL(g)}:`, text: `multiplicity ${g.alg}${geo < g.alg ? ` (only ${geo} independent eigenvector${geo === 1 ? '' : 's'} – defective)` : ''};  ` + (vecs.length ? vecs.map(u => '(' + u.map(x => fmt(x, 5)).join(', ') + ')').join('  ·  ') : 'no real eigenvector found'), tex: '', inline: true });
            });
            const tr = M.reduce((s0, row, i) => s0 + row[i], 0), dt = math.det(M);
            r.meta.push(`Check: Σλ = trace = ${fmt(tr, 6)},  Πλ = det = ${fmt(dt, 6)}`);
            if (worst > 0 || shown.some(g => g.im === 0)) r.meta.push(`Verified: max |A·v − λ·v| = ${worst.toExponential(2)} (eigenvectors normalised to unit length)`);
            if (defective) r.meta.push('This matrix is defective: it does not have a full set of independent eigenvectors, so it is not diagonalisable.');
            else if (!groups.some(g => g.im !== 0)) r.meta.push('The matrix is diagonalisable (a full set of real eigenvectors exists).');
            r.steps.push({ title: 'Characteristic equation', text: 'det(λI − A) = 0 is solved for λ (all complex roots, with multiplicity).', tex: `\\det(\\lambda I-A)=0` });
            r.steps.push({ title: 'Eigenvectors', text: 'For each real λ the null space of (A − λI) is computed by row reduction.', tex: '(A-\\lambda I)\\mathbf{v}=\\mathbf{0}' });
        } else if (op === 'charpoly') {
            sq(); r.title = 'Characteristic polynomial';
            const c = charPolyCoeffs(M);
            const parts = c.map((co, k) => ({ co, pw: n - k })).filter(t => Math.abs(t.co) > 1e-10);
            const fmtTerm = (t, first, tex) => {
                const mag = Math.abs(t.co), sign = t.co < 0 ? '-' : '+', lam = tex ? '\\lambda' : 'λ';
                const body = t.pw === 0 ? nice(mag, 8, 1e-9)[tex ? 'tex' : 'text'] : (Math.abs(mag - 1) < 1e-12 ? '' : nice(mag, 8, 1e-9)[tex ? 'tex' : 'text'] + (tex ? '' : '·')) + lam + (t.pw > 1 ? (tex ? `^{${t.pw}}` : (t.pw === 2 ? '²' : '^' + t.pw)) : '');
                return first ? (t.co < 0 ? '-' : '') + body : ` ${sign} ${body}`;
            };
            r.main = { label: 'p(λ) =', text: parts.map((t, i) => fmtTerm(t, i === 0, false)).join(''), tex: `p(\\lambda)=${parts.map((t, i) => fmtTerm(t, i === 0, true)).join('')}` };
            const ev = polyRoots(c.slice().reverse()); r.meta.push('Roots of p are the eigenvalues: ' + ev.map(z => (Math.abs(z.im) < 1e-9 ? fmt(z.re, 5) : `${fmt(z.re, 4)} ${z.im < 0 ? '−' : '+'} ${fmt(Math.abs(z.im), 4)}i`)).join(', '));
        } else if (op === 'solve') {
            sq(); const b = parseMatrix(opt.b || '', 'a right-hand side b, e.g.  1 ; 2');
            if (b.length !== m || b[0].length !== 1) throw new CalcError(`b must be a column of ${m} numbers separated by ;`);
            r.title = 'Solve A·x = b';
            const d = math.det(M);
            if (Math.abs(d) < 1e-10) throw new CalcError('A is singular – the system has no unique solution (try RREF on the augmented matrix)');
            const x = math.lusolve(M, b).map(rw => rw[0]);
            r.main = { label: 'x =', text: '(' + x.map(t => nice(t, 8, 1e-9).text).join(', ') + ')', tex: `\\mathbf{x}=\\begin{bmatrix}${x.map(t => nice(t, 8, 1e-9).tex).join('\\\\')}\\end{bmatrix}` };
            const res = Math.max(...math.multiply(M, x).map((t, i) => Math.abs(t - b[i][0])));
            r.meta.push(`Verified: max |A·x − b| = ${res.toExponential(2)}`);
            r.steps.push({ title: 'LU decomposition', text: 'Factor A = LU with partial pivoting, then forward- and back-substitute.', tex: '' });
        } else if (op === 'power') {
            sq(); const k = parseInt(opt.power, 10); if (!Number.isInteger(k) || k < -20 || k > 20) throw new CalcError('Power must be an integer between −20 and 20');
            r.title = `Matrix power A^${k}`; const P = k >= 0 ? math.pow(M, k) : math.pow(math.inv(M), -k);
            r.main = { label: `A^${k} =`, text: matTxt(P), tex: `A^{${k}}=${matTex(P)}` };
        } else throw new CalcError('Unknown matrix operation');
        return finalizeText(r);
    }

    // ------------------------------- Multi-function grapher -------------------------------
    function intersections(fa, fb, lo, hi, N) {
        return signChanges(x => fa(x) - fb(x), lo, hi, N || 1500).filter(c => !c.exact || true).map(c => c.x).filter(x => Number.isFinite(fa(x)) && Math.abs(fa(x) - fb(x)) < 1e-6 * Math.max(1, Math.abs(fa(x))));
    }

    function runGraph(src, opt) {
        const parts = String(src).split(/[;\n]+/).map(s => s.trim()).filter(Boolean);
        if (!parts.length) throw new CalcError('Enter one or more functions separated by ;');
        if (parts.length > 8) throw new CalcError('Up to 8 functions at a time');
        const nodes = parts.map(p => parse(p.replace(/^\s*(y|f\(x\)|g\(x\)|h\(x\))\s*=\s*/, '')));
        const all = sortVars([...new Set(nodes.flatMap(freeVars))]);
        const indep = all.includes('x') ? 'x' : (all[0] || 'x');
        const params = all.filter(n => n !== indep);
        if (params.length > 6) throw new CalcError('Up to 6 parameters (sliders) at a time');
        const r = makeResult('graph', parts.length > 1 ? 'Graph of several functions' : 'Graph');
        r.main = { label: '', text: nodes.map(strOf).join(';  '), tex: nodes.map((nd, i) => `f_{${i + 1}}(${indep})=${texOf(nd)}`).join(',\;') };
        const defaults = {}; params.forEach(p => { defaults[p] = 1; });
        nodes.forEach((nd, i) => {
            let d = null; try { if (freeVars(nd).includes(indep)) d = diff(nd, indep); } catch (e) { /* not differentiable */ }
            if (d) r.items.push({ label: `f${i + 1}′ =`, text: strOf(d), tex: `f_{${i + 1}}'(${indep})=${texOf(d)}` });
        });
        if (params.length) r.meta.push(`Parameters: ${params.join(', ')} – drag the sliders under the plot to see the graph respond.`);
        r.steps.push({ title: 'How to explore', text: 'Plot several functions at once, separated by ;. Any extra letter becomes a slider. Intersections are marked automatically, and you can pan/zoom freely.', tex: '' });
        const curves = nodes.map((nd, i) => ({ name: `f${i + 1}(${indep})`, expr: strOf(nd), vars: [indep, ...params], fn: compile(nd, [indep, ...params]) }));
        r.plot = { variable: indep, curves, params: params.map(p => ({ name: p, value: 1, min: -5, max: 5, step: 0.05 })), paramVars: params, interactive: true, xRange: [-10, 10] };
        return finalizeText(r);
    }


    /** Recognise closed forms such as π², π, e, ln 2, √2 (numerical tolerance 1e-9). */
    function recogniseConst(x) {
        if (!Number.isFinite(x) || x === 0) return null;
        const tol = 1e-9 * Math.max(1, Math.abs(x));
        const frac = v => { for (let d = 1; d <= 5000; d++) { const n = Math.round(v * d); if (n !== 0 && Math.abs(v - n / d) < (d > 24 ? 1e-12 : 1e-9) * Math.max(1, Math.abs(v))) return [n, d]; } return null; };
        void tol;
        const cands = [['π²', Math.PI ** 2, '\\pi^2'], ['π', Math.PI, '\\pi'], ['e', Math.E, 'e'], ['ln 2', Math.LN2, '\\ln 2'], ['√2', Math.SQRT2, '\\sqrt{2}'], ['√3', Math.sqrt(3), '\\sqrt{3}'], ['√π', Math.sqrt(Math.PI), '\\sqrt{\\pi}']];
        for (const [name, val, tex] of cands) {
            const f = frac(x / val);
            if (f) {
                const [n, d] = f;
                if (Math.abs(x - n / d * val) > 1e-9 * Math.max(1, Math.abs(x))) continue;
                const co = Math.abs(n) === 1 ? (n < 0 ? '-' : '') : String(n);
                return { text: d === 1 ? `${co}${name}` : `${co}${name}/${d}`, tex: d === 1 ? `${co}${tex}` : `\\frac{${co}${tex}}{${d}}` };
            }
        }
        return null;
    }

    // ------------------------------------ Calculator ------------------------------------
    function runCalc(src, opt) {
        const lines = String(src).split(/\n|;(?![^(]*\))/).map(t => t.trim()).filter(Boolean);
        if (!lines.length) throw new CalcError('Type an expression, e.g.  2^10 + sqrt(2)');
        if (lines.length > 40) throw new CalcError('Up to 40 lines at a time');
        const scope = { deg: Math.PI / 180, ans: 0, i: math.complex(0, 1) };
        const r = makeResult('calc', 'Calculator');
        let last = null;
        const digits = opt.digits || 12;
        lines.forEach((line, idx) => {
            const m = /^([A-Za-z_]\w*)\s*=\s*([^=].*)$/.exec(line);
            const name = m && !FUNCS.has(m[1]) && !CONSTS.has(m[1]) && m[1] !== 'ans' && m[1] !== 'deg' ? m[1] : null;
            if (m && !name) throw new CalcError(`"${m[1]}" is reserved and cannot be assigned`);
            const expr = name ? m[2] : line;
            const node = parse(expr);
            const unknown = freeVars(node).filter(v => !(v in scope));
            if (unknown.length) throw new CalcError(`Line ${idx + 1}: unknown variable ${unknown.join(', ')} – define it first, e.g.  ${unknown[0]} = 3`);
            let val;
            try { val = node.compile().evaluate(Object.assign({}, scope)); } catch (e) { throw new CalcError(`Line ${idx + 1}: ${friendlyError(e)}`); }
            let text, tex = '', num = null;
            if (val && typeof val === 'object' && typeof val.re === 'number' && typeof val.im === 'number') {   // complex: clean up rounding noise
                const sc = Math.max(1, Math.abs(val.re), Math.abs(val.im));
                const re = Math.abs(val.re) < 1e-14 * sc ? 0 : val.re, im = Math.abs(val.im) < 1e-14 * sc ? 0 : val.im;
                val = im === 0 ? re : math.complex(re, im);
            }
            if (typeof val === 'number') {
                num = val;
                const n = nice(val, digits, 1e-12), c = recogniseConst(val);
                text = Number.isFinite(val) ? (Number.isInteger(val) && Math.abs(val) <= 9007199254740992 ? String(val) : fmt(val, digits)) : fmt(val);
                const exact = Number.isInteger(val) ? null : (c ? c.text : (/^-?\d+\/\d+$/.test(n.text) ? n.text : null));
                if (exact) text = `${exact} ≈ ${fmt(val, digits)}`;
                tex = exact ? `${(c ? c.tex : n.tex)}\\approx ${fmt(val, digits)}` : '';
                if (Number.isInteger(val) && Math.abs(val) > 9007199254740992) text = val.toExponential(digits - 1);
                if (val !== 0 && Math.abs(val) < 1e-14 && !name) text = `0   (floating-point noise: ${val.toExponential(3)})`;
            } else {
                text = math.format(val, { precision: 12 });
            }
            if (name) { scope[name] = val; text = `${name} = ${text}`; }
            else scope.ans = val;
            r.items.push({ label: `${idx + 1}.`, text: `${line}   →   ${text}`, tex: '', inline: true });
            last = { text, num, val, name };
        });
        r.main = { label: 'Result =', text: last.text, tex: '' };
        const v = last.num;
        if (v !== null && Number.isInteger(v) && Math.abs(v) < 2 ** 53 && !last.name) {
            const ab = Math.abs(v);
            const facs = [];
            let n = ab; for (let p = 2; p * p <= n && p < 1e7; p++) while (n % p === 0) { facs.push(p); n /= p; } if (n > 1) facs.push(n);
            if (ab > 1) {
                const grouped = {}; facs.forEach(f => { grouped[f] = (grouped[f] || 0) + 1; });
                r.items.push({ label: 'Integer facts:', text: `${facs.length === 1 ? 'prime' : 'composite'}  ·  ${Object.entries(grouped).map(([b, e]) => (e > 1 ? `${b}^${e}` : b)).join(' × ')}  ·  binary ${(v < 0 ? '-' : '') + ab.toString(2)}  ·  hex ${(v < 0 ? '-' : '') + ab.toString(16).toUpperCase()}`, tex: '' });
            }
        } else if (v !== null && Number.isFinite(v) && !last.name) {
            r.items.push({ label: 'Forms:', text: `scientific ${v.toExponential(6)}  ·  ${fmt(v * 180 / Math.PI, 8)}° if radians  ·  ${fmt(v * Math.PI / 180, 8)} rad if degrees`, tex: '' });
        }
        r.meta.push('Variables persist between lines (a = 3), `ans` is the previous result, `deg` converts degrees to radians (sin(30 deg) = 0.5).');
        r.steps.push({ title: 'How it works', text: 'Each line is parsed safely (no code execution) and evaluated with math.js using the variables defined above it.', tex: '' });
        return finalizeText(r);
    }

    // ------------------------------- Equations & inequalities -------------------------------
    function runSolve(src, opt) {
        const text = String(src).trim();
        const m = /^(.*?)(<=|>=|≤|≥|<|>|=)(.*)$/s.exec(text);
        let relation = '=', lhsS = text, rhsS = '0';
        if (m) { relation = m[2]; lhsS = m[1]; rhsS = m[3]; }
        if (!lhsS.trim() || !rhsS.trim()) throw new CalcError('Write an equation like  x^2 - 4 = 0   or an inequality like  x^2 < 4');
        const L = parse(lhsS), R = parse(rhsS);
        const fN = simplifyNode(OP('-', 'subtract', [new math.ParenthesisNode(L), new math.ParenthesisNode(R)]));
        const vars = freeVars(fN);
        if (vars.length > 1) throw new CalcError(`Solve works for one unknown (found ${vars.join(', ')}). For systems use Matrices → Solve A·x = b.`);
        const v = vars[0] || 'x';
        const lo = opt.min !== undefined && String(opt.min).trim() !== '' ? parseLimit(String(opt.min), 'Min').value : -50;
        const hi = opt.max !== undefined && String(opt.max).trim() !== '' ? parseLimit(String(opt.max), 'Max').value : 50;
        const f = compile(fN, [v]);
        const r = makeResult('solve', relation === '=' ? 'Equation solver' : 'Inequality solver');
        const eqTex = `${texOf(L)}${{ '<=': '\\le', '>=': '\\ge', '≤': '\\le', '≥': '\\ge' }[relation] || relation}${texOf(R)}`;
        // roots: exact for polynomials, numerical otherwise
        const rat = toRational(fN, v);
        let realRoots = [], complexRoots = [], exactPoly = false, degree = 0;
        if (rat && rat.d.length === 1 && rat.n.length > 1 && rat.n.length <= 13) {
            exactPoly = true; degree = rat.n.length - 1;
            const rs = polyRootsMult(rat.n), sc = Math.max(1, ...rs.map(z => Math.hypot(z.re, z.im)));
            rs.forEach(z => {
                const re = Math.abs(z.re) < 1e-12 * sc ? 0 : z.re;
                if (Math.abs(z.im) < 1e-9 * sc) realRoots.push({ x: re, mult: z.mult }); else if (z.im > 0) complexRoots.push({ re, im: z.im, mult: z.mult });
            });
            // polish real roots with Newton on the polynomial
            realRoots.filter(q => q.mult === 1).forEach(q => { for (let it = 0; it < 6; it++) { const d = numDeriv(f, q.x); const fx = f(q.x); if (!Number.isFinite(d) || Math.abs(d) < 1e-14) break; const nx = q.x - fx / d; if (!Number.isFinite(nx)) break; q.x = nx; } });
        } else {
            signChanges(f, lo, hi, 8000).forEach(c => { const fx = Math.abs(f(c.x)); if (c.exact || fx < 1e-7) realRoots.push({ x: c.x, mult: 1 }); });
            const f1 = x => numDeriv(f, x);
            signChanges(f1, lo, hi, 4000).forEach(c => { if (Math.abs(f(c.x)) < 1e-9 && !realRoots.some(q => Math.abs(q.x - c.x) < 1e-5)) realRoots.push({ x: c.x, mult: 2 }); });
        }
        if (exactPoly) realRoots.forEach(q => { for (let d = 1; d <= 24; d++) { const nn = Math.round(q.x * d); if (Math.abs(q.x - nn / d) < 5e-9 * Math.max(1, Math.abs(q.x)) && Math.abs(f(nn / d)) <= Math.abs(f(q.x)) * 10 + 1e-12) { q.x = nn / d; break; } } });
        realRoots.sort((a, b) => a.x - b.x);
        const fmtRoot = x => { const c = recogniseConst(x); const n = nice(x, 8, 1e-9); return c && !/^-?\d/.test(n.text.replace('π', '')) ? c : (c && n.text === fmt(x, 8) ? c : n); };
        if (relation === '=') {
            r.main = { label: realRoots.length || complexRoots.length ? 'Solutions:' : 'No solutions', text: realRoots.length ? realRoots.map(q => `${v} = ${fmtRoot(q.x).text}`).join(',  ') : (complexRoots.length ? 'no real solutions' : `none in [${fmt(lo)}, ${fmt(hi)}]`), tex: realRoots.length ? realRoots.map(q => `${v}=${fmtRoot(q.x).tex}`).join(',\;') : '' };
            realRoots.forEach(q => r.items.push({ label: `${v} ≈`, text: `${fmt(q.x, opt.digits || 10)}${q.mult > 1 ? `   (multiplicity ${q.mult})` : ''}   residual ${Math.abs(f(q.x)).toExponential(1)}`, tex: '', inline: true }));
            complexRoots.forEach(z => { const a = fmt(z.re, 8), b = fmt(z.im, 8); r.items.push({ label: 'Complex:', text: `${v} = ${a} ± ${b}i${z.mult > 1 ? `  (multiplicity ${z.mult})` : ''}`, tex: `${v}=${nice(z.re, 8, 1e-9).tex}\\pm ${nice(z.im, 8, 1e-9).tex}i`, inline: true }); });
            if (exactPoly) r.meta.push(`Polynomial of degree ${degree}: ${realRoots.reduce((s0, q) => s0 + q.mult, 0) + 2 * complexRoots.reduce((s0, q) => s0 + q.mult, 0)} roots counted with multiplicity (fundamental theorem of algebra).`);
            else r.meta.push(`Numerical search on [${fmt(lo)}, ${fmt(hi)}] – widen the range with the options to look further.`);
            if (exactPoly && degree === 2) {
                const [c0, c1, c2] = rat.n, D = c1 * c1 - 4 * c2 * c0;
                r.steps.push({ title: 'Quadratic formula', text: `a = ${fmt(c2)}, b = ${fmt(c1)}, c = ${fmt(c0)}`, tex: `x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}` });
                r.steps.push({ title: 'Discriminant', text: `Δ = b² − 4ac = ${fmt(D, 8)} → ${D > 1e-12 ? 'two real roots' : D < -1e-12 ? 'two complex conjugate roots' : 'one repeated root'}`, tex: `\\Delta=${fmt(D, 8)}` });
                if (D > 1e-12) { const sq = Math.sqrt(D), c = recogniseConst(sq); r.steps.push({ title: 'Roots', text: `x = (${fmt(-c1)} ± ${c ? c.text : fmt(sq, 8)}) / ${fmt(2 * c2)}`, tex: '' }); }
            } else if (exactPoly) {
                r.steps.push({ title: 'Polynomial root finding', text: `All ${degree} complex roots are found simultaneously (Aberth iteration) and polished with Newton's method.`, tex: '' });
                const q = rat.n.map((co, k) => (Math.abs(co) < 1e-12 ? null : `${fmt(co, 8)}${k ? v + (k > 1 ? '^' + k : '') : ''}`)).filter(Boolean).reverse().join(' + ').replace(/\+ -/g, '- ');
                r.steps.push({ title: 'Polynomial', text: `${q} = 0`, tex: '' });
            } else {
                r.steps.push({ title: 'Rewrite as f(x) = 0', text: `f(${v}) = ${strOf(fN)}`, tex: `f(${v})=${texOf(fN)}` });
                r.steps.push({ title: 'Scan for sign changes', text: 'Sample the interval densely, bracket every sign change, then refine each root by bisection.', tex: '' });
            }
            r.steps.push({ title: 'Check', text: realRoots.length ? realRoots.map(q => `f(${fmt(q.x, 6)}) = ${f(q.x).toExponential(1)}`).join(';  ') : 'No real root to substitute back.', tex: '' });
        } else {
            const poles = [];
            signChanges(f, lo, hi, 8000).forEach(c => { if (!c.exact && Math.abs(f(c.x)) > 1e-4) poles.push(c.x); });
            const stepG = (hi - lo) / 8000;
            for (let i = 0; i <= 8000; i++) {   // poles that land exactly on a grid point are non-finite, so sign scans skip them
                const x = lo + stepG * i;
                if (!Number.isFinite(f(x)) && (Number.isFinite(f(x - stepG)) || Number.isFinite(f(x + stepG))) && !poles.some(q => Math.abs(q - x) < 3 * stepG)) poles.push(x);
            }
            const crit = [...realRoots.map(q => ({ x: q.x, root: true })), ...poles.map(x => ({ x, root: false }))].sort((a, b) => a.x - b.x);
            const bounds = [-Infinity, ...crit.map(c => c.x), Infinity];
            const incl = relation === '<=' || relation === '>=' || relation === '≤' || relation === '≥';
            const wantPos = relation === '>' || relation === '>=' || relation === '≥';
            const pieces = [];
            for (let i = 0; i < bounds.length - 1; i++) {
                const a = bounds[i], b = bounds[i + 1];
                const mid = Number.isFinite(a) && Number.isFinite(b) ? (a + b) / 2 : Number.isFinite(a) ? a + Math.max(1, Math.abs(a)) : Number.isFinite(b) ? b - Math.max(1, Math.abs(b)) : 0;
                const val = f(mid);
                if (!Number.isFinite(val)) continue;
                if (wantPos ? val > 0 : val < 0) pieces.push({ a, b, ca: crit[i - 1], cb: crit[i] });
            }
            // merge touching intervals (e.g. around a removable root when inclusive)
            const parts = [];
            pieces.forEach(pc => { const last = parts[parts.length - 1]; if (last && incl && last.b === pc.a && last.cb && last.cb.root) { last.b = pc.b; last.cb = pc.cb; } else parts.push(Object.assign({}, pc)); });
            const bt = (x, c, side) => (!Number.isFinite(x) ? ['(', ')'][side] : (incl && c && c.root ? ['[', ']'][side] : ['(', ')'][side]));
            const ft = x => (x === -Infinity ? '-∞' : x === Infinity ? '∞' : nice(x, 6, 1e-9).text);
            const ftx = x => (x === -Infinity ? '-\\infty' : x === Infinity ? '\\infty' : nice(x, 6, 1e-9).tex);
            const isolated = incl ? realRoots.filter(q => !parts.some(pc => q.x >= pc.a && q.x <= pc.b)).map(q => q.x) : [];
            const setText = parts.map(pc => `${bt(pc.a, pc.ca, 0)}${ft(pc.a)}, ${ft(pc.b)}${bt(pc.b, pc.cb, 1)}`).concat(isolated.map(x => `{${ft(x)}}`)).join(' ∪ ') || '∅ (no solution)';
            const setTex = parts.map(pc => `${bt(pc.a, pc.ca, 0)}${ftx(pc.a)},\\,${ftx(pc.b)}${bt(pc.b, pc.cb, 1)}`).concat(isolated.map(x => `\\{${ftx(x)}\\}`)).join('\\cup ') || '\\varnothing';
            r.main = { label: 'Solution set:', text: setText, tex: `${eqTex}\;\\Longleftrightarrow\;${v}\\in ${setTex}` };
            r.items.push({ label: 'Critical points:', text: crit.length ? crit.map(c => `${v} = ${ft(c.x)}${c.root ? '' : ' (undefined)'}`).join(',  ') : 'none', tex: '', inline: true });
            r.steps.push({ title: 'Move everything to one side', text: `f(${v}) = ${strOf(fN)} ${relation === '<' || relation === '<=' || relation === '≤' ? '<' : '>'}${incl ? '=' : ''} 0`, tex: `f(${v})=${texOf(fN)}` });
            r.steps.push({ title: 'Find where f changes sign', text: `Roots and poles split the line into intervals: ${crit.map(c => ft(c.x)).join(', ') || 'none'}.`, tex: '' });
            r.steps.push({ title: 'Test each interval', text: 'Evaluate f at one point in every interval and keep those with the right sign.', tex: '' });
            r.meta.push(`Search range [${fmt(lo)}, ${fmt(hi)}]; behaviour beyond it is extrapolated.`);
        }
        const pts = realRoots.map(q => ({ x: q.x, y: 0, name: 'solution', color: '#16a34a' }));
        const L2 = compile(L, [v]), R2 = compile(R, [v]);
        const hasR = !(R.type === 'ConstantNode' && R.value === 0);
        r.plot = { variable: v, curves: hasR ? [curveOf(`${strOf(L)}`, L, [v]), curveOf(`${strOf(R)}`, R, [v], 'dash')] : [curveOf('f(x)', fN, [v])], points: hasR ? realRoots.map(q => ({ x: q.x, y: L2(q.x), name: 'solution', color: '#16a34a' })) : pts, hlines: hasR ? [] : [0], xRange: realRoots.length ? [Math.min(...realRoots.map(q => q.x)) - 3, Math.max(...realRoots.map(q => q.x)) + 3] : [-10, 10] };
        void R2;
        return finalizeText(r);
    }

    // ------------------------------ Sums & convergence ------------------------------
    function runSum(src, opt) {
        const node = parse(src);
        const vars = freeVars(node);
        const v = opt.variable || (vars.includes('k') ? 'k' : vars.includes('n') ? 'n' : vars[0] || 'k');
        if (vars.some(q => q !== v)) throw new CalcError(`The term may only contain ${v} (found ${vars.filter(q => q !== v).join(', ')})`);
        const a = parseLimit(opt.lower === undefined || opt.lower === '' ? '1' : opt.lower, 'Start');
        const b = parseLimit(opt.upper === undefined || opt.upper === '' ? 'inf' : opt.upper, 'End');
        if (!Number.isInteger(a.value)) throw new CalcError('The start index must be an integer');
        const t = compile(node, [v]);
        const r = makeResult('sum', b.value === Infinity ? 'Infinite series' : 'Finite sum');
        const sigma = `\\sum_{${v}=${a.value}}^{${b.value === Infinity ? '\\infty' : b.value}} ${texOf(node)}`;
        const partial = [];
        if (b.value !== Infinity) {
            if (!Number.isInteger(b.value) || b.value < a.value) throw new CalcError('The end index must be an integer ≥ start');
            if (b.value - a.value > 2e6) throw new CalcError('Too many terms (limit 2,000,000)');
            let S = 0, c = 0;
            for (let k = a.value; k <= b.value; k++) { const y = t(k) - c, tt = S + y; c = (tt - S) - y; S = tt; if (k - a.value < 40) partial.push({ x: k, y: S, name: `S${k}` }); }
            if (!Number.isFinite(S)) throw new CalcError('Some term is undefined in this range');
            const exactAlg = b.value - a.value <= 5000 ? runAlgebrite(`sum(${toAlgebrite(node)}, ${v}, ${a.value}, ${b.value})`) : null;
            const exN = exactAlg && fromAlgebrite(exactAlg);
            const ex = exN ? compile(exN, [])() : NaN;
            const exact = Number.isFinite(ex) && Math.abs(ex - S) < 1e-9 * Math.max(1, Math.abs(S)) ? strOf(exN) : null;
            const Stxt = Number.isInteger(S) && Math.abs(S) < 1e15 ? String(S) : fmt(S, opt.digits || 12);
            r.main = { label: 'Sum =', text: (exact && exact !== Stxt && exN.type !== 'ConstantNode' ? exact + ' ≈ ' : '') + Stxt, tex: `${sigma}=${exact && exN.type !== 'ConstantNode' ? texOf(exN) + '\\approx ' : ''}${Stxt}` };
            r.items.push({ label: 'Number of terms:', text: String(b.value - a.value + 1), tex: '', inline: true });
            r.steps.push({ title: 'Add the terms', text: `${[0, 1, 2].filter(i => a.value + i <= b.value).map(i => `${v}=${a.value + i}: ${fmt(t(a.value + i), 8)}`).join(',  ')}${b.value - a.value > 2 ? ' …' : ''}`, tex: '' });
            r.steps.push({ title: 'Total (compensated summation)', text: fmt(S, 14), tex: '' });
            r.plot = { variable: 'n', curves: [], points: partial, xRange: [a.value - 1, Math.min(b.value, a.value + 40) + 1] };
            return finalizeText(r);
        }
        // ---- infinite series ----
        const terms = []; for (let k = a.value; k < a.value + 60; k++) terms.push(t(k));
        if (!terms.every(Number.isFinite)) throw new CalcError('Some of the first terms are undefined – choose a later start index');
        const big = [1e3, 1e4, 1e5, 1e6].map(k => { const y = t(k); return Number.isNaN(y) ? 0 : y; }), tail = Math.abs(big[3]);
        const verdict = { conv: null, reason: '', absolute: null };
        const tests = [];
        // nth-term test
        if (!Number.isFinite(big[3]) || tail > 1e-3 || (tail > 0.5 * Math.abs(big[1]) && tail > 1e-6)) { verdict.conv = false; verdict.reason = 'nth-term test: the terms do not tend to 0'; tests.push(verdict.reason); }
        else tests.push(`nth-term test: tₖ → 0 (|t| ≈ ${tail.toExponential(1)} at k = 10⁶) – inconclusive on its own`);
        // ratio
        const rat = k => Math.abs(t(k + 1) / t(k));
        const rkAll = [10, 20, 40, 80].map(rat), rk = rkAll.filter(Number.isFinite);
        const L1 = rk[rk.length - 2], L2 = rk[rk.length - 1];
        const ratioOk = rk.length >= 3;
        if (verdict.conv === null && ratioOk) {
            if (L2 < 0.97 && rk.every((x, i) => i === 0 || x <= rk[i - 1] + 0.02)) { verdict.conv = true; verdict.absolute = true; verdict.reason = `ratio test: |tₖ₊₁/tₖ| → ${nice(L2, 4, 1e-3).text} < 1`; tests.push(verdict.reason); }
            else if (L2 > 1.03 && L1 > 1.03) { verdict.conv = false; verdict.reason = `ratio test: |tₖ₊₁/tₖ| → ${fmt(L2, 4)} > 1`; tests.push(verdict.reason); }
            else tests.push(`ratio test: limit ≈ ${fmt(L2, 4)} → inconclusive`);
        }
        // p-series / power-law behaviour
        const env = k => { let m = 0; for (let j = 0; j < 400; j++) m = Math.max(m, Math.abs(t(Math.round(k + k * j / 400)))); return m; };
        const pAt = k => -Math.log(env(2 * k) / env(k)) / Math.log(2);
        const pSeq = [1e3, 1e4, 1e5].map(pAt), pEst = pSeq[2];
        const drifting = pSeq[0] > pSeq[1] + 0.01 && pSeq[1] > pSeq[2] + 0.005;   // log-corrected series: p slowly sinks toward 1
        const pStable = pSeq.every(Number.isFinite) && (Math.abs(pSeq[0] - pSeq[2]) < 0.03 || (Math.abs(pSeq[0] - pSeq[2]) < 0.08 && !drifting));
        const cK = k => k * t(k), harmonicLike = Number.isFinite(cK(1e4)) && Math.abs(cK(1e6)) > 1e-3 && Math.abs(cK(1e6) / cK(1e4) - 1) < 0.02;
        if (verdict.conv === null && Number.isFinite(pEst)) {
            const alt = terms.slice(0, 20).every((x, i, arr) => i === 0 || Math.sign(x) !== Math.sign(arr[i - 1]));
            if (alt && Math.abs(t(1e5 + 1)) <= Math.abs(t(1e5)) * (1 + 1e-9)) {
                verdict.conv = true; verdict.reason = 'alternating series test: signs alternate and |tₖ| decreases to 0';
                tests.push(verdict.reason);
                verdict.absolute = pEst > 1.05 && pStable; tests.push(`absolute convergence: terms behave like k^−${fmt(pEst, 3)} → ${verdict.absolute ? 'absolutely' : 'only conditionally'} convergent`);
            } else if (pEst > 1.05 && pStable) { verdict.conv = true; verdict.absolute = true; verdict.reason = `comparison with a p-series: |tₖ| ~ k^−${fmt(pEst, 3)}, p > 1`; tests.push(verdict.reason); }
            else if (harmonicLike && Math.abs(pEst - 1) < 0.05 && terms.slice(0, 20).every(x => x * terms[0] > 0)) { verdict.conv = false; verdict.reason = 'limit comparison with the harmonic series: k·tₖ tends to a non-zero constant'; tests.push(verdict.reason); }
            else if (pEst < 0.95 && pStable) { verdict.conv = false; verdict.reason = `comparison with a p-series: |tₖ| ~ k^−${fmt(pEst, 3)}, p < 1 (terms eventually same sign: diverges)`; tests.push(verdict.reason); }
            else tests.push(`terms behave like k^−${fmt(pEst, 3)} (borderline p ≈ 1) – compare with 1/(k ln k) type series`);
        }
        // geometric exact
        const q = t(a.value + 1) / t(a.value);
        const geometric = Number.isFinite(q) && terms.slice(0, 12).every((x, i, arr) => i === 0 || Math.abs(x - arr[i - 1] * q) <= 1e-9 * Math.max(Math.abs(x), 1e-300));
        let value = NaN, how = '';
        if (verdict.conv !== false) {
            if (geometric && Math.abs(q) < 1) { value = terms[0] / (1 - q); how = `geometric series: a/(1 − r) with a = ${fmt(terms[0], 8)}, r = ${nice(q, 8, 1e-9).text}`; verdict.conv = true; verdict.absolute = true; tests.unshift(`geometric series with ratio r = ${nice(q, 8, 1e-9).text}, |r| < 1`); }
            else {
                const N = 20000; let S = 0; const ps = [];
                for (let k = a.value; k < a.value + N; k++) { S += t(k); if (k - a.value === N - 3 || k - a.value === N - 2 || k - a.value === N - 1) ps.push(S); }
                const [s1, s2, s3] = ps, den = s3 - 2 * s2 + s1;
                if (verdict.conv && pEst > 1.05 && pStable && !terms.slice(0, 20).every((x, i, arr) => i === 0 || Math.sign(x) !== Math.sign(arr[i - 1]))) { const K = a.value + N, tK = t(K); value = s3 + (pEst < 1.6 ? tK * (K / (pEst - 1) + 0.5) : tK / 2 + integrateNumeric(t, K, Infinity).value - numDeriv(t, K) / 12); how = `partial sum of ${N} terms + Euler–Maclaurin tail (integral of the term function)`; }
                else if (Math.abs(den) > 1e-300) { value = s3 - (s3 - s2) ** 2 / den; how = 'partial sums accelerated with Aitken’s Δ² extrapolation'; }
                else { value = s3; how = `partial sum of ${N} terms`; }
            }
        }
        if (verdict.conv === null) { r.warnings.push('The numerical tests are inconclusive for this series.'); }
        const nv = Number.isFinite(value) ? (recogniseConst(value) || nice(value, 10, 1e-9)) : null;
        if (verdict.conv === false) r.main = { label: 'Diverges', text: `Σ ${strOf(node)} diverges – ${verdict.reason}`, tex: `${sigma}\;\\text{diverges}` };
        else if (Number.isFinite(value)) r.main = { label: 'Sum ≈', text: (nv && nv.text !== fmt(value, 10) ? `${nv.text} ≈ ` : '') + fmt(value, opt.digits || 10), tex: `${sigma}=${nv && nv.text !== fmt(value, 10) ? nv.tex + '\\approx ' : ''}${fmt(value, opt.digits || 10)}` };
        else r.main = { label: 'Convergence:', text: 'undetermined', tex: '' };
        r.items.push({ label: 'Convergence:', text: verdict.conv === true ? (verdict.absolute === false ? 'converges conditionally' : verdict.absolute ? 'converges absolutely' : 'converges') : verdict.conv === false ? 'diverges' : 'undetermined', tex: '', inline: true });
        tests.forEach(tt => r.steps.push({ title: 'Test', text: tt, tex: '' }));
        if (how) r.steps.push({ title: 'Value', text: how, tex: '' });
        r.meta.push('Convergence is judged numerically from the term behaviour at large k – a strong indication, not a proof.');
        let S = 0; for (let k = a.value; k < a.value + 40; k++) { S += t(k); partial.push({ x: k, y: S, name: `S${k}` }); }
        r.plot = { variable: 'n', curves: [], points: partial, hlines: Number.isFinite(value) && verdict.conv ? [value] : [], xRange: [a.value - 1, a.value + 41] };
        return finalizeText(r);
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------
    function inspect(src) {
        const node = parse(src);
        const vars = freeVars(node);
        const f = compile(node, vars);
        const samples = [1, 0.5, 2, 0.1, 3];
        let value = NaN, at = null;
        for (const s of samples) {
            const v = f(...vars.map(() => s));
            if (Number.isFinite(v)) { value = v; at = s; break; }
        }
        return { node, vars, text: strOf(node), tex: texOf(node), sampleValue: value, sampleAt: at };
    }

    function wrapRuns(map) {
        const out = {};
        Object.keys(map).forEach(k => { out[k] = (src, opt) => map[k](src, opt || {}); });
        return out;
    }

    return {
        CalcError, parse, inspect, clean, freeVars, compile, diff, fmt, nice, strOf, texOf,
        serialize, hydrate, intersections, antiderivative, integrateNumeric, integrateRobust, tanhSinhFinite, rk45, checkAntiderivative,
        internals: { taylorCoeffs, gl, runAlgebrite, toAlgebrite, fromAlgebrite, dependsOn, toRational, polyDivMod, polyMul, polyAdd, polyTrim, makeResult, finalizeText, wrapRuns, matTex, matTxt, parseMatrix, rref, polyRoots, polyRootsMult, polyGcd, charPolyCoeffs, nullSpace, parseLimit, curveOf, rangeFor, recogniseConst, validate, simplifyNode, foldConstants },
        run: wrapRuns({
            derivative: runDerivative, integral: runIntegral, series: runSeries, limit: runLimit,
            analysis: runAnalysis, ode: runODE, multivariable: runMultivariable,
            calc: runCalc, solve: runSolve, sums: runSum, riemann: runRiemann, applications: runApplications, root: runRoot, fourier: runFourier, matrix: runMatrix, graph: runGraph
        })
    };
});
