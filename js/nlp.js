/*
 * Plain-English input → { mode, fn, opts, say }.
 * Rule based (no AI, no network). Returns null when nothing is recognised.
 * DOM-free, so it is unit-tested in Node.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.NL = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const FN = 'sin|cos|tan|sec|csc|cot|asin|acos|atan|sinh|cosh|tanh|ln|log|exp|sqrt|abs|cbrt';
    const ALIAS = { arcsin: 'asin', arccos: 'acos', arctan: 'atan', arcsinh: 'asinh', arccosh: 'acosh', arctanh: 'atanh', sine: 'sin', cosine: 'cos', tangent: 'tan' };
    const NUM = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };

    /** Turn a phrase such as "sin x times e to the x squared" into "sin(x)*e^(x^2)". */
    function mathify(s) {
        let t = ' ' + String(s).toLowerCase().replace(/(\([^()]*\)|[a-z0-9.]+)!(?!=)/g, 'factorial($1)').replace(/[?!]/g, ' ').replace(/\s+/g, ' ') + ' ';
        t = t.replace(/\b(arcsin|arccos|arctan|arcsinh|arccosh|arctanh|sine|cosine|tangent)\b/g, (m, a) => ALIAS[a]);
        t = t.replace(/\bnatural (log|logarithm)\b/g, 'ln').replace(/\blogarithm\b/g, 'log');
        t = t.replace(/\b(square root|root) of\b/g, 'sqrt of').replace(/\bcube root of\b/g, 'cbrt of');
        t = t.replace(/\binfinity\b|\binfinite\b|∞/g, 'inf');
        t = t.replace(/\bplus\b/g, '+').replace(/\bminus\b|\bless\b|\bnegative\b/g, '-').replace(/\bequals?\b|\bis equal to\b/g, '=');
        t = t.replace(/\b(\w+) (squared)\b/g, '$1^2').replace(/\b(\w+) (cubed)\b/g, '$1^3');
        t = t.replace(/\be to the (-? ?[\w.]+(?:\^[\w.]+)?)/g, 'e^($1)');
        t = t.replace(/\bto the power(?: of)? (\w+)/g, '^$1').replace(/\braised to (?:the )?(?:power )?(?:of )?(\w+)/g, '^$1');
        t = t.replace(/\bto the (\w+)(?: power)?\b(?! of)/g, (m, a) => (/^(\d+|[a-z])$/.test(a) ? '^' + a : m));
        t = t.replace(/\bone over (\w+)/g, '1/$1').replace(/\bmultiplied by\b|\btimes\b/g, '*').replace(/\bdivided by\b|\bover\b/g, '/');
        t = t.replace(/\bplus\b/g, '+').replace(/\bminus\b|\bless\b/g, '-');
        t = t.replace(/\blog base (\w+) of (\w+(?:\^\w+)?)/g, '(log($2)/log($1))');
        for (let i = 0; i < 6; i++) {
            const before = t;
            t = t.replace(new RegExp(`\\b(${FN}|a?(?:sin|cos|tan)h?)(?: of)? (-?[\\w.]+(?:\\^-?[\\w.]+)?)(?![\\w(])`, 'g'), '$1($2)');
            if (t === before) break;
        }
        t = t.replace(/\^\((\w+)\)/g, '^$1').replace(/\be ?\^ ?(\w+)/g, 'e^$1').replace(/\be to (\w+)/g, 'e^$1');
        t = t.replace(/\band\b/g, ' ');
        return t.replace(/\s*([+\-*/^=()])\s*/g, '$1').replace(/\s+/g, ' ').trim();
    }

    const num = w => (w in NUM ? NUM[w] : w in ORD ? ORD[w] : (/^\d+$/.test(w) ? +w : null));
    const limitWord = w => String(w).replace(/\binfinity\b|∞/g, 'inf').replace(/minus\s+inf/, '-inf').replace(/negative\s+inf/, '-inf').replace(/\s+/g, '');

    function matrixFrom(text) {
        const m = text.match(/\[\s*\[.*\]\s*\]|\[.*;.*\]/s);
        if (!m) return null;
        const body = m[0].replace(/^\[+|\]+$/g, '');
        return body.split(/\]\s*,?\s*\[|;/).map(r => r.replace(/[\[\]]/g, '').trim().split(/[\s,]+/).filter(Boolean).join(' ')).join(' ; ');
    }

    function grabVar(t) {
        const m = t.match(/(?:with respect to|wrt|w\.r\.t\.?|in terms of|for|d)\s*\(?\s*([a-z])\s*\)?\s*$/);
        return m ? m[1] : undefined;
    }

    function parse(raw) {
        if (!raw || !String(raw).trim()) return null;
        let t = String(raw).trim().replace(/’|’/g, "'");
        const lower = t.toLowerCase().replace(/(\([^()]*\)|[a-z0-9]+)!/g, 'factorial($1)').replace(/[.?!]+$/g, '');
        const strip = s => s.replace(/^(please |hey |hi )?(can|could|would) you (please )?/, '').replace(/^(please )?(find|calculate|compute|evaluate|determine|work out|give me|tell me|show me|what is|what's|whats|what are|how (do|would) (i|you)|how to)\s+/, '').replace(/^(the )/, '');
        let s = strip(lower);

        // ---- matrices ------------------------------------------------------
        const M = matrixFrom(t);
        if (M) {
            const ops = [['determinant|det\\b', 'det'], ['inverse', 'inverse'], ['eigen', 'eigen'], ['rank', 'rank'], ['transpose', 'transpose'], ['trace', 'trace'], ['row reduc|rref|echelon', 'rref'], ['char(acteristic)? poly', 'charpoly'], ['\\blu\\b', 'lu'], ['\\bqr\\b', 'qr'], ['singular value|\\bsvd\\b', 'svd'], ['diagonali', 'diagonalize'], ['null ?space|kernel', 'nullspace'], ['column space|range of', 'colspace'], ['pseudo', 'pinv'], ['condition number', 'cond'], ['cholesky', 'cholesky']];
            for (const [re, op] of ops) if (new RegExp(re).test(lower)) return { mode: 'matrix', fn: M, opts: { op }, say: `Matrix → ${op}` };
        }

        // ---- ODEs ----------------------------------------------------------
        {
            let q;
            const splitTop = str => { const out = []; let d = 0, cur = ''; for (const ch of str) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.trim()).filter(Boolean); };
            if ((q = s.match(/^(?:solve )?(?:the )?triangle (?:with |given |where )?(.+=.+)$/))) return { mode: 'geometry', fn: q[1].replace(/\s+and\s+/g, ', ').replace(/°|degrees/g, '').trim(), opts: { op: 'triangle', unit: 'deg' }, say: 'Triangle solver' };
            if ((q = s.match(/^(?:classify |identify |analy[sz]e )?(?:the )?(?:conic section|conic|ellipse|hyperbola|parabola)(?: given by| with equation| for| of)? (.+=.+)$/))) return { mode: 'geometry', fn: q[1].trim(), opts: { op: 'conic' }, say: 'Conic section' };
            if ((q = s.match(/^(?:the )?circle (?:through|passing through) (.+\d.*)$/))) return { mode: 'geometry', fn: q[1].trim(), opts: { op: 'circle3' }, say: 'Circle through three points' };
            if ((q = s.match(/^(?:the )?(?:area|perimeter|centroid) of (?:the )?polygon (?:with vertices )?(.+\d.*)$/))) return { mode: 'geometry', fn: q[1].trim(), opts: { op: 'polygon' }, say: 'Polygon' };
            if ((q = s.match(/^(?:the )?(?:truth table|boolean (?:expression|simplification|algebra)|simplify (?:the )?boolean (?:expression )?|minimi[sz]e (?:the )?(?:boolean )?(?:expression |function )?)(?: of| for)? ?(.+)$/)) && /[a-z]/.test(q[1])) return { mode: 'discrete', fn: q[1].trim(), opts: { op: 'truth' }, say: 'Boolean algebra' };
            if ((q = s.match(/^shortest path (?:from )?([a-z0-9_]+) to ([a-z0-9_]+) (?:in|on|for|through) (?:the )?(?:graph )?(.+)$/i))) return { mode: 'discrete', fn: q[3].trim(), opts: { op: 'graph', gsrc: q[1].toUpperCase(), gdst: q[2].toUpperCase() }, say: 'Shortest path' };
            if ((q = s.match(/^(?:the )?(?:minimum spanning tree|mst|graph)(?: of| for| with edges)? (?:the )?(?:graph )?([a-z0-9_]+\s*-+>?\s*[a-z0-9_].+)$/i))) return { mode: 'discrete', fn: q[1].trim(), opts: { op: 'graph', gsrc: '', gdst: '' }, say: 'Graph' };
            if ((q = s.match(/^(?:solve )?(?:the )?(?:linear )?diophantine equation (-?\d*)\s*x\s*([+-]\s*\d*)\s*y\s*=\s*(-?\d+)$/))) { const co = t => { const u = t.replace(/\s+/g, ''); return u === '' || u === '+' ? '1' : u === '-' ? '-1' : u.replace(/^\+/, ''); }; return { mode: 'number', fn: `${co(q[1])}, ${co(q[2])}, ${q[3]}`, opts: { op: 'dioph' }, say: 'Diophantine equation' }; }
            if ((q = s.match(/^(?:the )?continued fraction (?:expansion )?(?:of )?(.+)$/))) return { mode: 'number', fn: q[1].replace(/√\s*/, 'sqrt').replace(/sqrt\s*(\d+)$/, 'sqrt($1)').replace(/\s+/g, ''), opts: { op: 'cfrac' }, say: 'Continued fraction' };
            if ((q = s.match(/^(?:solve )?(?:the )?pell(?:'s)? equation (?:with |for )?(?:d ?= ?|x\^?2 ?- ?)?(\d+)(?:y\^?2 ?= ?1)?$/))) return { mode: 'number', fn: q[1], opts: { op: 'pell' }, say: "Pell's equation" };
            if ((q = s.match(/^(?:the )?(?:smallest )?primitive roots? (?:of|modulo|mod) (\d+)$/))) return { mode: 'number', fn: q[1], opts: { op: 'primroot' }, say: 'Primitive roots' };
            if ((q = s.match(/^(?:the )?(?:legendre|jacobi) symbol \(?\s*(-?\d+)\s*[\/,]\s*(\d+)\s*\)?$/))) return { mode: 'number', fn: `${q[1]}, ${q[2]}`, opts: { op: 'legendre' }, say: 'Legendre symbol' };
            if ((q = s.match(/^(?:the )?(?:number of )?(?:integer )?partitions of (\d+)$/))) return { mode: 'number', fn: q[1], opts: { op: 'partitions' }, say: 'Integer partitions' };
            if ((q = s.match(/^(?:the )?stirling (?:number|numbers)(?: of the second kind)? (?:s\()?(\d+)[ ,]+(\d+)\)?$/))) return { mode: 'number', fn: `${q[1]}, ${q[2]}`, opts: { op: 'stirling' }, say: 'Stirling numbers' };
            if ((q = s.match(/^(?:the )?(?:catalan number|derangements?)(?: of| for| number)? ?(\d+)$/))) return { mode: 'number', fn: q[1], opts: { op: 'combi' }, say: 'Catalan numbers and derangements' };
            if ((q = s.match(/^rsa (?:with )?p ?= ?(\d+),? q ?= ?(\d+),?(?: e ?= ?(\d+),?)? (?:message|m) ?= ?(\d+)$/))) return { mode: 'number', fn: [q[1], q[2], q[3], q[4]].filter(Boolean).join(', '), opts: { op: 'rsa' }, say: 'RSA demo' };
            if ((q = s.match(/^(?:find )?(?:the )?potential (?:function )?(?:of|for) (?:the )?(?:vector )?(?:field )?(?:f ?= ?)?\(?(.+?)\)?$/)) && /,|;/.test(q[1])) return { mode: 'vector', fn: splitTop(q[1].replace(/;/g, ',')).map(mathify).join(' ; '), opts: { op: 'potential', pa: '', pb: '' }, say: 'Potential function' };
        }
        const ndM = s.match(/^(?:numerical|finite[- ]difference) (?:derivative|differentiation)(?: of)? (.+?) at (?:x ?= ?)?(-?[\d.]+|pi[^ ]*)$/);
        if (ndM) return { mode: 'numerical', fn: mathify(ndM[1]), opts: { op: 'diff', dat: ndM[2], dord: '1' }, say: 'Numerical differentiation' };
        const cmpM = s.match(/^compare (?:the )?(?:numerical |ode )?(?:methods|solvers)(?: for| on| of)? (?:y'? ?= ?|dy\/dx ?= ?)(.+?)(?: with y\(0\) ?= ?(-?[\d.]+))?(?: (?:from 0 )?(?:to|until|on \[0,) ?([\d.]+)\]?)?$/);
        if (cmpM) return { mode: 'ode', fn: mathify(cmpM[1]), opts: { odeType: 'methods', x0: '0', xEnd: cmpM[3] || '2', y0: cmpM[2] || '1' }, say: 'Numerical methods lab' };
        let m = s.match(/(?:solve |ode |differential equation )?(?:the )?(?:dy\/dx|y')\s*=\s*(.+)$/);
        if (m) return { mode: 'ode', fn: mathify(m[1]), opts: { odeType: 'first', x0: '0', xEnd: '10', y0: '1' }, say: 'First-order ODE (y(0)=1 assumed)' };
        m = s.match(/(?:solve )?(?:the )?(?:d2y\/dx2|y'')\s*=\s*(.+)$/);
        if (m) return { mode: 'ode', fn: mathify(m[1]).replace(/y'/g, 'yp'), opts: { odeType: 'second', x0: '0', xEnd: '10', y0: '1', v0: '0' }, say: 'Second-order ODE' };

        // ---- Laplace / Fourier transforms ----------------------------------
        m = s.match(/^(inverse laplace(?: transform)?|laplace(?: transform)?|fourier transform) (?:of )?(.+)$/);
        if (m) return { mode: 'laplace', fn: mathify(m[2]), opts: { op: /inverse/.test(m[1]) ? 'inverse' : /fourier/.test(m[1]) ? 'fourier' : 'laplace' }, say: m[1] };

        m = s.match(/^(?:the )?jacobian(?: matrix)?(?: of)? (.+)$/);
        if (m) return { mode: 'vector', fn: mathify(m[1]).replace(/,/g, ' ; '), opts: { op: 'jacobian', vars: '', point: '' }, say: 'Jacobian matrix' };

        // ---- derivatives ---------------------------------------------------
        m = s.match(/^(?:the )?(?:(\w+) )?(?:derivative|differentiate|differentiation)(?: of)? (.+)$/) || s.match(/^d\/d([a-z]) (.+)$/);
        if (m) {
            let order = 1, body = m[2], variable;
            if (m[1] && /^d\/d/.test(s)) variable = m[1];
            else if (m[1]) order = num(m[1]) || 1;
            const nth = body.match(/^(\w+) derivative of (.+)$/);
            if (nth && num(nth[1])) { order = num(nth[1]); body = nth[2]; }
            let point = '';
            const at = body.match(/^(.*?)\s+(?:at|when)\s+(?:[a-z]\s*=\s*|the point )?(-?[\w./^]+)$/);
            if (at) { body = at[1]; point = mathify(at[2]); }
            const wrt = body.match(/^(.*?)\s+(?:with respect to|wrt|w\.r\.t\.?)\s+([a-z])$/);
            if (wrt) { body = wrt[1]; variable = wrt[2]; }
            return { mode: 'derivative', fn: mathify(body.replace(/^of /, '')), opts: { order: String(order), point, variable: variable || '' }, say: `${order > 1 ? order + 'th ' : ''}derivative` };
        }

        // ---- integrals -----------------------------------------------------
        m = s.match(/^(?:the )?(?:definite |indefinite |improper )?(?:integral|integrate|antiderivative|anti-derivative|area under(?: the curve)?)(?: of)? (.+)$/);
        if (m) {
            let body = m[1], lower = '', upper = '', variable;
            const lim = body.match(/^(.*?)\s*(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+)$/);
            if (lim) { body = lim[1]; lower = mathify(limitWord(lim[2])); upper = mathify(limitWord(lim[3])); }
            const wrt = body.match(/^(.*?)\s+(?:with respect to|wrt)\s+([a-z])$/); if (wrt) { body = wrt[1]; variable = wrt[2]; }
            const dx = body.match(/^(.*?)\s*d([a-z])$/); if (dx && dx[1] && /[^a-z]$|\s$|\)$|\d$|[a-z]$/.test(dx[1])) { body = dx[1]; variable = variable || dx[2]; }
            return { mode: 'integral', fn: mathify(body), opts: { method: 'auto', lower, upper, variable: variable || '' }, say: lower || upper ? 'Definite integral' : 'Indefinite integral' };
        }
        m = s.match(/^(?:the )?(?:area|volume) (?:of|under|between) (.+)$/);
        if (m && /from .+ to/.test(m[1])) {
            const lim = m[1].match(/^(.*?)\s*from\s+(.+?)\s+to\s+(.+)$/);
            return { mode: 'integral', fn: mathify(lim[1].replace(/^the curve /, '')), opts: { method: 'auto', lower: mathify(limitWord(lim[2])), upper: mathify(limitWord(lim[3])), variable: '' }, say: 'Area as a definite integral' };
        }

        // ---- limits --------------------------------------------------------
        m = s.match(/^(?:the )?limit(?: of)? (.+?)\s+as\s+([a-z])\s*(?:->|→|approaches|tends to|goes to|going to|→)\s*(.+)$/);
        if (m) {
            let target = m[3], direction = 'both';
            const side = target.match(/^(.*?)\s*(?:from the )?(left|right|above|below|\+|-|⁺|⁻)$/);
            if (side && /(?:from the |^)/.test(target) && / from the | from |\^?[+-]$/.test(' ' + target)) {
                if (/left|below|-|⁻/.test(side[2])) direction = 'left'; else direction = 'right';
                target = side[1].replace(/\s*from( the)?$/, '');
            }
            return { mode: 'limit', fn: mathify(m[1]), opts: { point: mathify(limitWord(target)), direction, variable: m[2] === 'x' ? '' : m[2] }, say: 'Limit' };
        }

        // ---- Taylor series -------------------------------------------------
        m = s.match(/^(?:the )?(taylor|maclaurin|power)(?: series| polynomial| expansion)?(?: of| for)? (.+)$/);
        if (m) {
            let body = m[2], point = m[1] === 'maclaurin' ? '0' : '0', terms = '6';
            const deg = body.match(/^(.*?)\s*(?:up to|to|with|of|degree|order|until)\s+(?:degree |order |n\s*=\s*)?(\w+)(?: terms?| degree| order)?$/);
            if (deg && num(deg[2]) != null) { body = deg[1]; terms = String(num(deg[2])); }
            const at = body.match(/^(.*?)\s*(?:around|about|at|centered at|centred at)\s+(?:[a-z]\s*=\s*)?(.+)$/);
            if (at) { body = at[1]; point = mathify(at[2]); }
            return { mode: 'series', fn: mathify(body), opts: { point, terms, variable: '' }, say: `${m[1]} series` };
        }

        // ---- sums ----------------------------------------------------------
        m = s.match(/^(?:the )?sum of (.+?)\s+from\s+([a-z])\s*=\s*(\w+)\s+to\s+(\w+)$/);
        if (m) return { mode: 'sums', fn: mathify(m[1]), opts: { lower: m[3], upper: limitWord(m[4]), variable: m[2] }, say: 'Series sum' };
        m = s.match(/^(?:does|do) (?:the )?(?:series|sum) (?:of )?(.+?) converge$/);
        if (m) return { mode: 'sums', fn: mathify(m[1]), opts: { lower: '1', upper: 'inf', variable: 'k' }, say: 'Convergence test' };

        // ---- epsilon-delta, chi-square, ANOVA, heat and wave equations ----
        m = s.match(/^(?:epsilon[- ]?delta|ε[- ]?δ)(?: (?:picture|proof|for|of|limit))* (.+?) (?:as x (?:->|→|approaches|goes to|tends to) |near |at x ?= ?|at )(-?[\w./]+)(?: (?:with|for) (?:epsilon|ε)(?: ?= ?| )([\d.]+))?$/);
        if (m) return { mode: 'limit', fn: mathify(m[1]), opts: { task: 'epsdelta', point: m[2], eps: m[3] || '0.1', direction: 'both', variable: '' }, say: 'Epsilon–delta' };
        m = s.match(/^(?:run |do )?(?:a )?chi[- ]?(?:square|squared)(?: test)?(?: (?:of|on|for))? ([\d.,;\s]+?)(?: (?:expected|with expected|against) ([\d.,\s]+))?$/);
        if (m) return { mode: 'stats', fn: m[1].trim(), opts: { op: 'chisq', expected: (m[2] || '').trim(), alpha: '0.05' }, say: 'Chi-square test' };
        m = s.match(/^(?:the )?(laplace|fourier) transform of (.+?(?:\sfor\s|\sif\s|\swhen\s).+)$/);
        if (m && /[;\n]|otherwise/.test(m[2] + ' ;')) return { mode: 'laplace', fn: m[2].split(/\s*;\s*/).map(pc => { const q = /^(.*?)(\s+(?:for|if|when)\s+.*)$/.exec(pc); return q ? mathify(q[1]) + q[2] : pc; }).join(' ; '), opts: { op: m[1] }, say: `${m[1] === 'laplace' ? 'Laplace' : 'Fourier'} transform of a piecewise function` };
        m = s.match(/^(?:the )?(?:equilibri(?:a|um)|fixed points?|critical points?|stability) (?:and stability )?(?:of|for) (?:the )?(?:system )?(?:x'? ?= ?)?(.+?;.+)$/);
        if (m && /\by\b/.test(m[1])) return { mode: 'ode', fn: m[1].split(';').map(x => mathify(x.replace(/^\s*[xy]'?\s*=\s*/, ''))).join(' ; '), opts: { odeType: 'equilibria', range: '4' }, say: 'Equilibria and stability' };
        m = s.match(/^(?:run |do )?(?:a )?wilcoxon(?: signed[- ]?rank)?(?: test)?(?: (?:of|on|for))? ([\d.,;\s-]+)$/);
        if (m) return { mode: 'stats', fn: m[1].trim(), opts: { op: 'wilcoxon', alpha: '0.05' }, say: 'Wilcoxon signed-rank test' };
        m = s.match(/^(?:run |do )?(?:a )?kruskal[- ]?wallis(?: test)?(?: (?:of|on|for))? ([\d.,;\s-]+)$/);
        if (m) return { mode: 'stats', fn: m[1].trim(), opts: { op: 'kruskal', alpha: '0.05' }, say: 'Kruskal–Wallis test' };
        m = s.match(/^(?:the )?(?:phase portrait|classify|stability) (?:of |for )?(?:the )?(?:linear )?(?:system |matrix )?(?:with matrix |a = )?\[?\[?\s*(-?[\d.]+)[,\s]+(-?[\d.]+)\s*\]?\s*[;,]?\s*\[?\s*(-?[\d.]+)[,\s]+(-?[\d.]+)\s*\]?\]?$/);
        if (m) return { mode: 'ode', fn: `${m[1]} ${m[2]} ; ${m[3]} ${m[4]}`, opts: { odeType: 'linear2', range: '4' }, say: 'Phase portrait of a linear system' };
        m = s.match(/^(?:the )?generating function (?:of|for) (?:the )?(?:recurrence |sequence )?(a\s*\(\s*n\s*\)\s*=\s*[^,;]+?)(?:\s*(?:,|;|with|where)\s*(?:a\s*\(\s*0\s*\)\s*=\s*[^,;]+(?:\s*,\s*a\s*\(\s*1\s*\)\s*=\s*[^,;]+)*))?$/);
        if (m) { const init = [...s.matchAll(/a\s*\(\s*(\d)\s*\)\s*=\s*(-?[\d.]+)/g)].sort((a, b) => a[1] - b[1]).map(x => x[2]); return { mode: 'algebra', fn: m[1].replace(/\s+/g, ''), opts: { op: 'gf', init: init.join(', ') || '0, 1' }, say: 'Generating function' }; }
        m = s.match(/^(?:the )?(?:inverse z[- ]?transform|z[- ]?transform inverse|inverse z)(?: of| for)? (.+)$/);
        if (m) return { mode: 'laplace', fn: mathify(m[1]).replace(/\s+/g, ' ').trim(), opts: { op: 'iztrans' }, say: 'Inverse Z-transform' };
        m = s.match(/^(?:the )?z[- ]?transform (?:of |for )?(?:the )?(?:sequence |signal )?(?:x\s*[(\[]n[)\]]\s*=\s*)?(.+)$/);
        if (m) return { mode: 'laplace', fn: mathify(m[1]).replace(/\s+/g, ' ').trim(), opts: { op: 'ztrans' }, say: 'Z-transform' };
        m = s.match(/^(?:solve |analy[sz]e |find the response of )?(?:the )?(?:difference equation|recursion|digital filter|filter) (y\s*[(\[]\s*n\s*[)\]].+?)(?:\s+(?:with|and|for) (?:the )?(?:input|x ?=)\s*(impulse|step|[^,;]+?))?(?:\s+(?:with|and|starting from|initial(?: values?)?)\s+(y\s*[(\[]\s*-\s*1\s*[)\]]\s*=\s*[^;]+))?$/);
        if (m) { const ini = m[3] ? [...m[3].matchAll(/y\s*[(\[]\s*-\s*\d\s*[)\]]\s*=\s*(-?[\d.]+)/g)].map(x => x[1]).join(', ') : ''; return { mode: 'laplace', fn: m[1].replace(/\s+/g, ' ').trim(), opts: { op: 'zdiff', xin: (m[2] || 'step').trim(), init: ini }, say: 'Difference equation' }; }
        m = s.match(/^(?:the )?pad[eé](?: approximants?| approximations?)?(?: of order| \[| of)?\s*\[?\s*(\d+)\s*[\/,]\s*(\d+)\s*\]?\s*(?:approximant |approximation )?(?:of|for) (.+?)(?: (?:about|around|at) (?:x ?= ?)?(-?[\d.]+))?$/);
        if (m) return { mode: 'series', fn: mathify(m[3]), opts: { task: 'pade', pm: m[1], pn: m[2], point: m[4] || '0', prange: '3' }, say: `Padé approximant [${m[1]}/${m[2]}]` };
        m = s.match(/^(?:the )?pad[eé](?: approximants?| approximations?)? (?:of|for) (.+?)(?: (?:about|around|at) (?:x ?= ?)?(-?[\d.]+))?$/);
        if (m) return { mode: 'series', fn: mathify(m[1]), opts: { task: 'pade', pm: '2', pn: '2', point: m[2] || '0', prange: '3' }, say: 'Padé approximant [2/2]' };
        m = s.match(/^(?:the )?m[oö]bius (?:transformation|map)(?: through| sending| taking| mapping| with)? (.+->.+)$/);
        if (m) return { mode: 'complex', fn: m[1].replace(/\s*,\s*(?=[^,]*->)/g, ' ; ').replace(/→/g, '->').trim(), opts: { op: 'mobius', region: 'grid', extent: '2' }, say: 'Möbius transformation' };
        m = s.match(/^(?:the )?(?:conformal map|conformal mapping|image of (?:a |the )?(?:square |polar )?grid under)(?: of| by| given by)? (?:w ?= ?|f\(z\) ?= ?)?(.+)$/);
        if (m) return { mode: 'complex', fn: mathify(m[1]), opts: { op: 'map', region: /polar/.test(s) ? 'polar' : 'grid', extent: '2' }, say: 'Conformal map' };
        m = s.match(/^(?:fit |draw |find )?(?:the )?(not[- ]a[- ]knot |natural |clamped )?cubic spline (?:through|for|of)(?: the points| the data)? (.+)$/);
        if (m && /\d/.test(m[2])) return { mode: 'numerical', fn: m[2].trim(), opts: { op: 'spline', bc: m[1] ? m[1].replace(/[- ]/g, '').trim() : 'natural' }, say: 'Cubic spline' };
        m = s.match(/^(?:the )?(?:interpolating polynomial|lagrange (?:interpolation|polynomial)|newton interpolation|interpolate)(?: through| for| of| the points)? (.+\d.*)$/);
        if (m) return { mode: 'numerical', fn: m[1].trim(), opts: { op: 'lagrange' }, say: 'Polynomial interpolation' };
        m = s.match(/^(?:the )?(?:runge phenomenon|chebyshev nodes|chebyshev interpolation)(?: for| of| with)? (.+?)(?: (?:with )?(?:degree|n) ?=? ?(\d+))?(?: (?:on|over) \[?(-?[\d.]+)[, ]+(-?[\d.]+)\]?)?$/);
        if (m) return { mode: 'numerical', fn: mathify(m[1]), opts: { op: 'chebyshev', n: m[2] || '12', lo: m[3] || '-1', hi: m[4] || '1' }, say: 'Chebyshev nodes' };
        m = s.match(/^compare (?:the )?(?:numerical )?(?:integration|quadrature)(?: rules| methods)?(?: for| of)? (?:the integral of )?(.+?) (?:from|on|over) (-?[\d.]+|pi[^ ]*) to (-?[\d.]+|pi[^ ]*)$/);
        if (m) return { mode: 'numerical', fn: mathify(m[1]), opts: { op: 'quadrature', lo: m[2], hi: m[3] }, say: 'Numerical integration' };
        m = s.match(/^(?:run |do )?(?:a )?mann[- ]?whitney(?: u)?(?: test)?(?: (?:of|on|for))? ([\d.,;\s-]+)$/);
        if (m) return { mode: 'stats', fn: m[1].trim(), opts: { op: 'mannwhitney', alpha: '0.05' }, say: 'Mann–Whitney U test' };
        m = s.match(/^(?:run |do )?(?:a )?(?:one[- ]?way )?anova(?: test)?(?: (?:of|on|for))? ([\d.,;\s-]+)$/);
        if (m) return { mode: 'stats', fn: m[1].trim(), opts: { op: 'anova', alpha: '0.05' }, say: 'One-way ANOVA' };
        m = s.match(/^(?:the )?(heat|wave) equation(?: with| for| on)? (?:initial (?:temperature|shape|profile|condition) )?(?:u\(x,? ?0\) ?= ?)?(.+?)(?: (?:until|for|up to|at) t(?:ime)? ?= ?([\d.]+))?$/);
        if (m) return { mode: 'ode', fn: mathify(m[2]), opts: { odeType: m[1], pdeL: 'pi', pdeT: m[3] || (m[1] === 'heat' ? '1' : '4'), pdeK: '1', pdeV: '0' }, say: m[1] === 'heat' ? 'Heat equation' : 'Wave equation' };

        // ---- Lagrange multipliers, curvature, radius of convergence ----
        m = s.match(/^(gradient descent|newton'?s? method|momentum)(?: on| for| of)? (.+?)(?: (?:starting|starting from|from|start)(?: at| point)?\s*\(?\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)?)?$/);
        if (m && /[xy]/.test(m[2]) && /\by\b|y/.test(m[2])) return { mode: 'multivariable', fn: mathify(m[2]), opts: { op: 'descent', method: /newton/.test(m[1]) ? 'newton' : /momentum/.test(m[1]) ? 'momentum' : 'gd', start: m[3] ? `${m[3]}, ${m[4]}` : '-1.2, 1', lr: '0.1', iters: '30', vars: '' }, say: 'Optimiser visualiser' };
        m = s.match(/^(?:the )?markov chain (?:with|for|of) (?:the )?(?:transition )?(?:matrix )?(\[?\[[\d.\s,;\-/\[\]]+\]?)$/) || s.match(/^(?:the )?stationary distribution of (?:the )?(?:matrix |markov chain )?(\[?\[[\d.\s,;\-/\[\]]+\]?)$/);
        if (m) return { mode: 'stats', fn: m[1].replace(/\],\s*\[/g, ' ; ').replace(/[\[\]]/g, ' ').replace(/,/g, ' ').replace(/\s+/g, ' ').trim(), opts: { op: 'markov', init: '', steps: '10' }, say: 'Markov chain' };
        m = s.match(/^(?:a |the )?(?:(\d+(?:\.\d+)?)\s*%\s*)?confidence interval (?:for|of) (?:a |the )?(?:proportion )?(\d+)\s*(?:out of|of|\/|successes in|in)\s*(\d+)(?: trials?)?$/);
        if (m) return { mode: 'stats', fn: `${m[2]}, ${m[3]}`, opts: { op: 'propci', conf: String((m[1] ? +m[1] : 95) / 100) }, say: 'Confidence interval for a proportion' };
        m = s.match(/^(?:the )?residues? (?:of|for) (.+)$/);
        if (m) return { mode: 'complex', fn: mathify(m[1]), opts: { op: 'residue' }, say: 'Residues' };
        m = s.match(/^(?:the )?contour integral of (.+?) (?:around|over|on) (?:the )?(?:circle )?\|\s*z\s*(?:[-−]\s*([\d.]+))?\s*\|\s*=\s*([\d.]+)$/);
        if (m) return { mode: 'complex', fn: mathify(m[1]), opts: { op: 'contour', cc: m[2] || '0', rad: m[3] }, say: 'Contour integral' };
        m = s.match(/^(?:solve (?:the )?linear program[: ]*)?(maximi[sz]e|minimi[sz]e|max|min)(?: the)? (.+?)\s+(?:subject to|s\.t\.|such that|with constraints?)\s+(.+)$/);
        if (m && /<|>|≤|≥/.test(m[3])) return { mode: 'algebra', fn: `${/^max/.test(m[1]) ? 'max' : 'min'} ${mathify(m[2])} ; ${m[3].split(/\s*(?:,|;|\band\b)\s*/).filter(Boolean).map(c => c.replace(/\s+/g, ' ')).join(' ; ')}`, opts: { op: 'lp' }, say: 'Linear programming' };
        m = s.match(/^(?:use )?lagrange(?: multipliers?)?(?: to)?(?: (?:maximi[sz]e|minimi[sz]e|optimi[sz]e|find the extrema of|extrema of))? (.+?) (?:subject to|with constraint|given|under the constraint|constrained by|where) (.+)$/) || s.match(/^(?:maximi[sz]e|minimi[sz]e|optimi[sz]e) (.+?) subject to (.+)$/);
        if (m && /=/.test(m[2])) return { mode: 'multivariable', fn: mathify(m[1]), opts: { op: 'lagrange', vars: '', constraint: mathify(m[2]), radius: '5' }, say: 'Lagrange multipliers' };
        m = s.match(/^(?:the )?(?:curvature|radius of curvature) of (.+?)(?: (?:at|when) (?:x|t) ?= ?(.+))?$/);
        if (m) return { mode: 'applications', fn: mathify(m[1]).replace(/\s*,\s*/, ' ; '), opts: { op: 'curvature', at: m[2] ? mathify(m[2]) : '0' }, say: 'Curvature' };
        m = s.match(/^(?:the )?(?:radius|interval) of convergence of (?:the )?(?:power )?(?:series )?(.+?)(?: (?:about|around|centred at|centered at) (?:x ?= ?)?(.+))?$/);
        if (m) return { mode: 'sums', fn: mathify(m[1]).replace(/\bn\b/g, 'k'), opts: { task: 'radius', center: m[2] ? mathify(m[2]) : '0', lower: '0' }, say: 'Radius of convergence' };

        // ---- algebra: partial fractions, division, factoring, polynomial gcd, recurrences ----
        m = s.match(/^(?:decompose |split |write )?(?:the )?(?:into )?partial fractions? (?:of|for) (.+)$/) || s.match(/^(?:decompose|split) (.+) into partial fractions?$/);
        if (m) return { mode: 'algebra', fn: mathify(m[1]), opts: { op: 'apart' }, say: 'Partial fractions' };
        m = s.match(/^(?:divide|long division of) (.+?) (?:by|\/|over) (.+)$/);
        if (m && /[a-z]/.test(m[1] + m[2]) && !/\bdx\b/.test(s)) return { mode: 'algebra', fn: `(${mathify(m[1])})/(${mathify(m[2])})`, opts: { op: 'div' }, say: 'Polynomial long division' };
        m = s.match(/^(?:factori[sz]e|factor|expand) (?:the )?(?:expression |polynomial )?(.+)$/);
        if (m && /[a-z]/.test(m[1]) && !/^\d+$/.test(m[1])) return { mode: 'algebra', fn: mathify(m[1]), opts: { op: 'factor' }, say: 'Factor and expand' };
        m = s.match(/^(?:gcd|greatest common divisor|lcm|least common multiple) (?:of )?(.+?) and (.+)$/);
        if (m && /[a-z]/.test(m[1] + m[2])) return { mode: 'algebra', fn: `${mathify(m[1])} ; ${mathify(m[2])}`, opts: { op: 'gcd' }, say: 'Polynomial gcd and lcm' };
        m = s.match(/^(?:solve the )?(?:recurrence|recursion)(?: relation)?:?\s*(a\s*\(\s*n\s*\)\s*=\s*[^,;]+?)(?:\s*(?:,|;|with|where)\s*(?:a\s*\(\s*0\s*\)\s*=\s*[^,;]+(?:\s*,\s*a\s*\(\s*1\s*\)\s*=\s*[^,;]+)*))?$/);
        if (m) { const init = [...s.matchAll(/a\s*\(\s*(\d)\s*\)\s*=\s*(-?[\d.]+)/g)].sort((a, b) => a[1] - b[1]).map(x => x[2]); return { mode: 'algebra', fn: m[1].replace(/\s+/g, ''), opts: { op: 'recur', init: init.join(', ') || '0, 1' }, say: 'Linear recurrence' }; }

        // ---- roots / zeros -------------------------------------------------
        m = s.match(/^(?:the )?(?:roots|zeros|zeroes|solutions|root|zero) of (.+)$/);
        if (m) { const e = mathify(m[1]); return { mode: 'solve', fn: /=|<|>/.test(e) ? e : e + '=0', opts: {}, say: 'Solve f(x) = 0' }; }

        // ---- analysis ------------------------------------------------------
        m = s.match(/^(?:analy[sz]e|study|examine|(?:the )?(?:extrema|maxima|minima|maximum|minimum|critical points|inflection points|asymptotes|turning points|stationary points))(?: of| for)? (.+)$/);
        if (m) return { mode: 'analysis', fn: mathify(m[1].replace(/^the function /, '')), opts: { min: '-10', max: '10' }, say: 'Function analysis' };
        m = s.match(/^where is (.+?) (?:increasing|decreasing|concave.*|convex.*)$/);
        if (m) return { mode: 'analysis', fn: mathify(m[1]), opts: { min: '-10', max: '10' }, say: 'Function analysis' };

        // ---- plots ---------------------------------------------------------
        m = s.match(/^(?:plot|graph|draw|sketch|visuali[sz]e)(?: the)?(?: function| curve)?(?: of)? (.+)$/);
        if (m) return { mode: 'graph', fn: mathify(m[1].replace(/^y\s*=\s*/, '')), opts: {}, say: 'Graph' };

        // ---- units ---------------------------------------------------------
        m = s.match(/^(?:convert )?(-?[\d.]+(?:e-?\d+)?\s*[a-z°/%²³^0-9 ]*?)\s+(?:to|in|into)\s+([a-z°/%²³^0-9]+)$/);
        if (m && /\d\s*[a-z]/.test(m[1].replace(/\s/g, ''))) return { mode: 'units', fn: `${m[1].trim()} to ${m[2]}`, opts: {}, say: 'Unit conversion' };

        // ---- number theory ---------------------------------------------------
        m = s.match(/^(?:prime )?factori[sz]e (?:the number )?(\d+)$|^prime factors? of (\d+)$|^factor (\d+)$/);
        if (m) return { mode: 'number', fn: m[1] || m[2] || m[3], opts: { op: 'factor' }, say: 'Prime factorisation' };
        m = s.match(/^(?:is )?(\d+) (?:a )?prime\??$/);
        if (m) return { mode: 'number', fn: m[1], opts: { op: 'isprime' }, say: 'Primality test' };
        m = s.match(/^(gcd|lcm|greatest common (?:divisor|factor)|least common multiple)(?: of)? (\d+)(?: and |, ?| )(\d+)$/);
        if (m) return { mode: 'number', fn: `${m[2]}, ${m[3]}`, opts: { op: /gcd|greatest/.test(m[1]) ? 'gcd' : 'lcm' }, say: m[1] };
        m = s.match(/^(\d+) (?:choose|c) (\d+)$|^combinations? of (\d+) (?:and|choose|taken) (\d+)$/);
        if (m) return { mode: 'number', fn: `${m[1] || m[3]}, ${m[2] || m[4]}`, opts: { op: 'ncr' }, say: 'Combinations' };
        m = s.match(/^(\d+)(?:th|st|nd|rd)? fibonacci(?: number)?$|^fibonacci(?: number)?(?: of)? (\d+)$/);
        if (m) return { mode: 'number', fn: m[1] || m[2], opts: { op: 'fib' }, say: 'Fibonacci' };

        // ---- statistics ----------------------------------------------------
        m = s.match(/^(?:the )?(mean|average|median|mode|standard deviation|variance|summary statistics|statistics|describe)(?: of)? ([-\d.,\s]+)$/);
        if (m) return { mode: 'stats', fn: m[2].trim(), opts: { op: 'describe' }, say: 'Descriptive statistics' };
        m = s.match(/^(?:linear |quadratic )?regression(?: of| for| on)? (.+)$/);
        if (m) return { mode: 'stats', fn: m[1], opts: { op: 'regression', model: /quadratic/.test(s) ? 'quadratic' : 'linear' }, say: 'Regression' };

        // ---- complex -------------------------------------------------------
        m = s.match(/^(?:domain colou?ring|complex plot|plot (?:the )?complex function)(?: of)? (.+)$/);
        if (m) return { mode: 'complex', fn: mathify(m[1]), opts: { op: 'domain' }, say: 'Complex function plot' };

        // ---- solve ---------------------------------------------------------
        m = s.match(/^(?:solve|find x|find the solutions? (?:of|to))(?: the)?(?: equation| inequality)?(?: for ([a-z]))?:?\s*(.+)$/);
        if (m) {
            let body = m[2].replace(/\s+for\s+([a-z])$/, (x, v) => ''); const e = mathify(body);
            return { mode: 'solve', fn: e, opts: {}, say: 'Equation solver' };
        }
        if (/[a-z0-9)]\s*=\s*[^=]*[a-z0-9(]/.test(s) && /[a-z]/.test(s) && !/\b(plot|graph)\b/.test(s)) return { mode: 'solve', fn: mathify(s), opts: {}, say: 'Equation solver' };

        // ---- arithmetic -----------------------------------------------------
        const e = mathify(s.replace(/^(what is|calculate|compute)\s+/, ''));
        if (e && /^[-+*/^().\w\s]+$/.test(e) && /\b[xyt]\b|\b[xyt]\^|\([xyt]\)/.test(e) && !/[a-z]{4,}\s[a-z]{3,}/.test(e.replace(/(sin|cos|tan|sqrt|abs|exp|log|ln|asin|acos|atan|sinh|cosh|tanh|cbrt|sec|csc|cot)/g, ''))) return { mode: 'graph', fn: e, opts: {}, say: 'Graph' };
        if (e && /^[-+*/^().\d\sa-z,%!]+$/.test(e) && /[\d]/.test(e) && !/\bx\b/.test(e)) return { mode: 'calc', fn: e, opts: {}, say: 'Calculator' };
        return null;
    }

    return { parse, mathify };
});
