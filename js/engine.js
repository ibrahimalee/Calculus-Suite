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
        'round', 'min', 'max', 'pow', 'nthRoot', 'erf', 'gamma', 'factorial', 'mod', 'hypot'
    ]);
    const CONSTS = new Set(['pi', 'e', 'tau', 'phi', 'Infinity']);
    const ALLOWED_OPS = new Set(['+', '-', '*', '/', '^', '!']);
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
            .replace(/π/g, 'pi').replace(/∞/g, 'Infinity')
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

    function simplifyNode(n) {
        try { return math.simplify(n); } catch (e) { return n; }
    }

    function diff(node, v, order) {
        let r = node;
        for (let i = 0; i < (order || 1); i++) {
            try {
                r = math.derivative(r, v);
            } catch (e) {
                throw new CalcError('Cannot differentiate: ' + friendlyError(e));
            }
            r = simplifyNode(r);
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
        const tryFrac = (val) => {
            for (let d = 1; d <= 24; d++) {
                const n = Math.round(val * d);
                if (Math.abs(val - n / d) < rtol * Math.max(1, Math.abs(val))) return [n, d];
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
        try { return node.toString({ parenthesis: 'auto', implicit: 'hide' }); } catch (e) { return String(node); }
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
        if (!Algebrite) return null;
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

    let deadline = Infinity;
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
        if (!out) return null;
        const F = fromAlgebrite(out);
        return F && checkAntiderivative(F, expr, u) ? F : null;
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
            if (n.type === 'FunctionNode') n.args.forEach(add);
            if (n.type === 'OperatorNode' && n.op === '^') { add(n.args[0]); add(n.args[1]); }
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
            const gs = g.toString();
            const replaced = ratio.transform(n => (n.toString() === gs ? S('u') : n));
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

    /**
     * Symbolic antiderivative. method: 'auto' | 'substitution' | 'parts' | 'cas'
     * Returns { ok, F (node), method, steps[] } – F has no +C.
     */
    function antiderivative(node, v, method) {
        method = method || 'auto';
        if (deadline === Infinity) deadline = Date.now() + 8000;
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
        const r1 = tanhSinhCore(f, a, b, 3.4), r2 = tanhSinhCore(f, a, b, 2.8);
        if (!Number.isFinite(r1.value)) return r1;
        return { value: r1.value, error: Math.max(r1.error, Math.abs(r1.value - r2.value)) };
    }

    function tanhSinhCore(f, a, b, T) {
        const c = (a + b) / 2, d = (b - a) / 2;
        const point = t => {
            const u = Math.PI / 2 * Math.sinh(t);
            const x = c + d * Math.tanh(u);
            const w = d * Math.PI / 2 * Math.cosh(t) / (Math.cosh(u) * Math.cosh(u));
            if (!(x > a && x < b) || !isFinite(w)) return 0;
            const y = f(x);
            return Number.isFinite(y) ? w * y : NaN;
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
        return { kind, title, main: null, items: [], meta: [], warnings: [], steps: [], plot: null, text: '' };
    }

    const INLINE_LABEL = /^(y-intercept|Roots|Local |Saddle|Flat|Critical points|Inflection|Vertical|As x|Recognised|General solution|Particular solution|Implicit solution|Constants|Monotonicity|Concavity)/;

    function finalizeText(r) {
        // `tex` is normally a complete statement (the UI then hides the label); value-only
        // lines are flagged `inline` so the UI shows "label + value".
        r.items.forEach(i => { if (i.tex && INLINE_LABEL.test(i.label)) i.inline = true; });
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
        const d = diff(node, v, order);
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
                const nxt = diff(cur, v);
                r.steps.push({ title: `Differentiate (order ${i})`, text: `d/d${v} [ ${strOf(cur)} ] = ${strOf(nxt)}`, tex: `\\frac{d}{d${v}}\\left[${texOf(cur)}\\right]=${texOf(nxt)}` });
                cur = nxt;
            }
        }
        r.steps.push({ title: 'Simplify', text: `Result: ${strOf(d)}`, tex: texOf(d) });

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
        const r = makeResult('definite', Math.abs(a.value) === Infinity || Math.abs(b.value) === Infinity ? 'Improper integral' : 'Definite integral');
        const num = integrateRobust(f, a.value, b.value, kinkPoints(node, v, a.value, b.value));
        r.warnings.push(...num.warnings);
        const limTex = x => (Number.isFinite(x.value) ? texOf(x.node) : (x.value > 0 ? '\\infty' : '-\\infty'));
        const intTex = `\\int_{${limTex(a)}}^{${limTex(b)}} ${texOf(node)}\\,d${v}`;
        const intText = `∫[${strOf(a.node)} → ${strOf(b.node)}] ${strOf(node)} d${v}`;
        const rel = num.error / Math.max(1e-12, Math.abs(num.value));
        const diverges = !Number.isFinite(num.value) || Math.abs(num.value) > 1e9 || (num.error > 1e-4 && rel > 1e-3);
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

    // ---------------------------- Series ------------------------------
    function runSeries(src, opt) {
        const node = parse(src);
        const v = pickVar(node, opt.variable);
        const a = opt.point !== undefined && String(opt.point).trim() !== '' ? parseLimit(String(opt.point), 'Expansion point') : { node: C(0), value: 0 };
        if (!Number.isFinite(a.value)) throw new CalcError('Expansion point must be finite');
        const n = Math.max(1, Math.min(20, parseInt(opt.terms, 10) || 5));
        const f = compile(node, [v]);
        const r = makeResult('series', a.value === 0 ? `Maclaurin series (degree ${n})` : `Taylor series about ${v} = ${strOf(a.node)} (degree ${n})`);

        // Derivative table (numeric values, exact where Algebrite helps)
        const coeffs = [];
        let cur = node;
        for (let k = 0; k <= n; k++) {
            if (k > 0) cur = diff(cur, v);
            const val = compile(cur, [v])(a.value);
            if (!Number.isFinite(val)) {
                throw new CalcError(`f is not differentiable ${k === 0 ? '' : k + ' times '}at ${v} = ${fmt(a.value)}, so no Taylor series exists there.`);
            }
            coeffs.push({ k, deriv: val, coef: val / Number(math.factorial(k)) });
        }

        // exact polynomial via Algebrite when possible
        let polyNode = null;
        const aStr = toAlgebrite(a.node);
        const out = runAlgebrite(`taylor(${toAlgebrite(node)}, ${v}, ${n}, ${aStr})`);
        const parsed = out && fromAlgebrite(out);
        const numericPoly = x => coeffs.reduce((s, c) => s + c.coef * Math.pow(x - a.value, c.k), 0);
        if (parsed && a.value === 0) {
            const pf = compile(parsed, [v]);
            if ([0.1, 0.3, -0.2, 0.5].every(dx => Math.abs(pf(a.value + dx) - numericPoly(a.value + dx)) <= 1e-8 * Math.max(1, Math.abs(numericPoly(a.value + dx))))) polyNode = parsed;
        }
        let polyText, polyTex;
        if (polyNode) {
            polyText = strOf(polyNode); polyTex = texOf(polyNode);
        } else {
            const parts = coeffs.filter(c => Math.abs(c.coef) > 1e-12).map(c => {
                const cs = nice(c.coef, 6).text;
                const base = a.value === 0 ? v : `(${v} - ${fmt(a.value)})`;
                return c.k === 0 ? cs : (c.k === 1 ? `${cs}*${base}` : `${cs}*${base}^${c.k}`);
            });
            polyText = parts.join(' + ').replace(/\+ -/g, '- ') || '0';
            polyTex = polyText;
        }
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
            if (/^-?[\d.]+(e[+-]?\d+)?$/.test(n.text) && !Number.isInteger(x)) {
                for (const [name, val, tex] of [['e', Math.E, 'e'], ['1/e', 1 / Math.E, '\\frac{1}{e}'], ['√2', Math.SQRT2, '\\sqrt{2}'], ['√3', Math.sqrt(3), '\\sqrt{3}'], ['ln 2', Math.LN2, '\\ln 2']]) {
                    for (const m of [1, -1]) if (Math.abs(x - m * val) < 1e-6 * Math.max(1, Math.abs(x))) return { text: (m < 0 ? '-' : '') + name, tex: (m < 0 ? '-' : '') + tex };
                }
                for (let d = 1; d <= 6; d++) {
                    const k = Math.round(x * d / Math.E);
                    if (k !== 0 && Math.abs(x - k * Math.E / d) < 1e-6 * Math.max(1, Math.abs(x))) return { text: `${k === 1 ? '' : k}e${d > 1 ? '/' + d : ''}`, tex: '' };
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
            if (!Number.isFinite(f(x)) && Number.isFinite(f(x - span / N)) !== false) {
                const left = f(x - span / N), right = f(x + span / N);
                if (Math.abs(left) > 1e3 || Math.abs(right) > 1e3) asymptotes.push(x);
            }
        }
        // double roots: local minima of |f| near zero
        signChanges(f1, lo, hi, N).forEach(c => { if (Math.abs(f(c.x)) < 1e-8 && Number.isFinite(f(c.x))) roots.push(c.x); });
        const rootList = dedupe(roots, tol), asymList = dedupe(asymptotes, tol * 50);

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

    return {
        CalcError, parse, inspect, clean, freeVars, compile, diff, fmt, nice, strOf, texOf,
        serialize, hydrate, antiderivative, integrateNumeric, integrateRobust, tanhSinhFinite, rk45, checkAntiderivative,
        run: {
            derivative: runDerivative, integral: runIntegral, series: runSeries, limit: runLimit,
            analysis: runAnalysis, ode: runODE, multivariable: runMultivariable
        }
    };
});
