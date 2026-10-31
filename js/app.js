/*
 * Calculus Suite Pro – user interface
 *
 * All maths lives in js/engine.js (tested in Node). This file only wires the
 * DOM, plotting, history and sharing around it. Every piece of dynamic text is
 * escaped before it reaches innerHTML.
 */
(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    const engine = Runner.getEngine();

    // ------------------------------------------------------------------
    // Mode definitions
    // ------------------------------------------------------------------
    const OPS_MULTI = [
        ['gradient', 'Gradient ∇f (+ tangent plane, directional derivative)'],
        ['partial', 'Partial derivatives (first & second order)'],
        ['hessian', 'Hessian matrix'],
        ['laplacian', 'Laplacian ∇²f'],
        ['critical', 'Critical points (max / min / saddle)'],
        ['double', 'Double integral ∬ f dy dx'],
        ['divergence', 'Divergence ∇·F (vector field)'],
        ['curl', 'Curl ∇×F (vector field)']
    ];
    const VECTOR_OPS = ['divergence', 'curl'];

    const MODES = {
        derivative: {
            label: '∂ Derivative', icon: '∂',
            input: () => ({ label: 'f(x)', placeholder: 'e.g. x^2 * sin(x)', hint: 'Differentiate any expression. Use another variable via the option below.' }),
            fields: [
                { key: 'order', label: 'Order of derivative', type: 'number', def: '1', min: 1, max: 10 },
                { key: 'point', label: 'Evaluate / tangent line at (optional)', type: 'text', def: '', placeholder: 'e.g. 2 or pi/4' },
                { key: 'variable', label: 'Variable (blank = auto)', type: 'text', def: '', placeholder: 'x' }
            ],
            examples: [
                { label: 'x²·sin(x)', fn: 'x^2*sin(x)', opts: { order: '1', point: '1' } },
                { label: 'Second derivative of eˣ·cos(x)', fn: 'e^x*cos(x)', opts: { order: '2' } },
                { label: 'xˣ (logarithmic differentiation)', fn: 'x^x', opts: { point: '2' } },
                { label: 'arctan(x)·ln(x)', fn: 'atan(x)*ln(x)', opts: {} },
                { label: 'Partial: x²y with respect to y', fn: 'x^2*y', opts: { variable: 'y' } }
            ]
        },
        integral: {
            label: '∫ Integral', icon: '∫',
            input: () => ({ label: 'f(x)', placeholder: 'e.g. x*e^x', hint: 'Leave both limits empty for an indefinite integral. Limits accept pi, e and inf.' }),
            fields: [
                { key: 'method', label: 'Strategy', type: 'select', def: 'auto', options: [['auto', 'Auto (try everything)'], ['substitution', 'U-substitution'], ['parts', 'Integration by parts'], ['partial', 'Partial fractions (rational functions)'], ['cas', 'Computer algebra only']], show: v => !(v.lower || v.upper) },
                { key: 'lower', label: 'Lower limit (optional)', type: 'text', def: '', placeholder: 'e.g. 0 or -inf' },
                { key: 'upper', label: 'Upper limit (optional)', type: 'text', def: '', placeholder: 'e.g. pi or inf' },
                { key: 'variable', label: 'Variable (blank = auto)', type: 'text', def: '', placeholder: 'x' }
            ],
            examples: [
                { label: '∫ x²·sin(x) dx  (by parts)', fn: 'x^2*sin(x)', opts: { lower: '', upper: '' } },
                { label: '∫ 2x·cos(x²) dx  (u-substitution)', fn: '2*x*cos(x^2)', opts: { method: 'substitution', lower: '', upper: '' } },
                { label: '∫ 1/(x²+1) dx', fn: '1/(x^2+1)', opts: { lower: '', upper: '' } },
                { label: '∫₀^π sin(x) dx', fn: 'sin(x)', opts: { lower: '0', upper: 'pi' } },
                { label: 'Gaussian: ∫ e^(−x²) over ℝ', fn: 'e^(-x^2)', opts: { lower: '-inf', upper: 'inf' } },
                { label: 'Improper: ∫₀¹ 1/√x dx', fn: '1/sqrt(x)', opts: { lower: '0', upper: '1' } },
                { label: 'Diverges: ∫₁^∞ 1/x dx', fn: '1/x', opts: { lower: '1', upper: 'inf' } }
            ]
        },
        series: {
            label: 'Σ Taylor series', icon: 'Σ',
            input: () => ({ label: 'f(x)', placeholder: 'e.g. sin(x)', hint: 'Taylor polynomial about a point (Maclaurin series when a = 0).' }),
            fields: [
                { key: 'point', label: 'Expansion point a', type: 'text', def: '0', placeholder: '0' },
                { key: 'terms', label: 'Degree n (1–20)', type: 'number', def: '5', min: 1, max: 20 },
                { key: 'variable', label: 'Variable (blank = auto)', type: 'text', def: '', placeholder: 'x' }
            ],
            examples: [
                { label: 'sin(x) – Maclaurin, degree 7', fn: 'sin(x)', opts: { point: '0', terms: '7' } },
                { label: 'eˣ about x = 1', fn: 'e^x', opts: { point: '1', terms: '5' } },
                { label: '1/(1−x) (geometric series)', fn: '1/(1-x)', opts: { point: '0', terms: '6' } },
                { label: 'ln(x) about x = 1', fn: 'log(x)', opts: { point: '1', terms: '6' } },
                { label: 'cos(x) about π/2', fn: 'cos(x)', opts: { point: 'pi/2', terms: '5' } }
            ]
        },
        limit: {
            label: 'lim Limit', icon: 'lim',
            input: () => ({ label: 'f(x)', placeholder: 'e.g. sin(x)/x', hint: 'Numerical limit analysis from both sides (also at ±∞).' }),
            fields: [
                { key: 'point', label: 'x approaches', type: 'text', def: '0', placeholder: '0, pi, inf, -inf' },
                { key: 'direction', label: 'Direction', type: 'select', def: 'both', options: [['both', 'Two-sided'], ['left', 'From the left (x → a⁻)'], ['right', 'From the right (x → a⁺)']] },
                { key: 'variable', label: 'Variable (blank = auto)', type: 'text', def: '', placeholder: 'x' }
            ],
            examples: [
                { label: 'sin(x)/x as x → 0', fn: 'sin(x)/x', opts: { point: '0', direction: 'both' } },
                { label: '(1 + 1/x)ˣ as x → ∞', fn: '(1+1/x)^x', opts: { point: 'inf', direction: 'both' } },
                { label: '(1 − cos x)/x² as x → 0', fn: '(1-cos(x))/x^2', opts: { point: '0', direction: 'both' } },
                { label: '1/x as x → 0⁺', fn: '1/x', opts: { point: '0', direction: 'right' } },
                { label: '|x|/x as x → 0 (does not exist)', fn: 'abs(x)/x', opts: { point: '0', direction: 'both' } },
                { label: '√(x²+x) − x as x → ∞', fn: 'sqrt(x^2+x)-x', opts: { point: 'inf', direction: 'both' } }
            ]
        },
        analysis: {
            label: '📈 Function analysis', icon: 'f',
            input: () => ({ label: 'f(x)', placeholder: 'e.g. x^3 - 3x', hint: 'Finds roots, extrema, inflection points, asymptotes, monotonicity and concavity.' }),
            fields: [
                { key: 'min', label: 'Search from x =', type: 'text', def: '-10' },
                { key: 'max', label: 'to x =', type: 'text', def: '10' },
                { key: 'variable', label: 'Variable (blank = auto)', type: 'text', def: '', placeholder: 'x' }
            ],
            examples: [
                { label: 'Cubic x³ − 3x', fn: 'x^3-3x', opts: { min: '-10', max: '10' } },
                { label: 'Double well x⁴ − 2x²', fn: 'x^4-2*x^2', opts: { min: '-3', max: '3' } },
                { label: 'Rational 1/(x²−1)', fn: '1/(x^2-1)', opts: { min: '-5', max: '5' } },
                { label: 'x·e^(−x)', fn: 'x*e^(-x)', opts: { min: '-2', max: '8' } },
                { label: 'tan(x) – asymptotes', fn: 'tan(x)', opts: { min: '-5', max: '5' } },
                { label: 'sin(x)/x', fn: 'sin(x)/x', opts: { min: '-15', max: '15' } }
            ]
        },
        ode: {
            label: '∂ Differential equations', icon: 'y′',
            input: v => ({
                first: { label: "y′ = f(x, y)", placeholder: 'e.g. x + y   or   x*y   or   y*(1-y)', hint: 'Right-hand side of dy/dx. Linear and separable equations are solved in closed form; all are solved numerically.' },
                second: { label: "y″ = f(x, y, yp)", placeholder: 'e.g. -y   or   -0.5*yp - 4*y', hint: 'Write y′ as yp. Constant-coefficient homogeneous equations also get a closed form.' },
                system: { label: 'System  x′, y′, (z′) = …  (separate with ;)', placeholder: 'e.g. y ; -x      or      x*(1-0.5*y) ; y*(0.5*x-1)', hint: 'State variables are x, y, z and time is t.' }
            }[v.odeType || 'first']),
            fields: [
                { key: 'odeType', label: 'Equation type', type: 'select', def: 'first', options: [['first', 'First order  y′ = f(x, y)'], ['second', 'Second order  y″ = f(x, y, y′)'], ['system', 'System of ODEs (2–3 equations)']] },
                { key: 'x0', label: 'Start x₀ (or t₀)', type: 'text', def: '0' },
                { key: 'xEnd', label: 'End', type: 'text', def: '10' },
                { key: 'y0', label: 'Initial y(x₀)', type: 'text', def: '1', show: v => v.odeType !== 'system' },
                { key: 'v0', label: "Initial y′(x₀)", type: 'text', def: '0', show: v => v.odeType === 'second' },
                { key: 'initial', label: 'Initial values (x, y, z)', type: 'text', def: '1, 0', show: v => v.odeType === 'system', placeholder: '1, 0' }
            ],
            examples: [
                { label: "Linear: y′ = x + y", fn: 'x+y', opts: { odeType: 'first', x0: '0', xEnd: '3', y0: '1' } },
                { label: "Separable: y′ = x·y", fn: 'x*y', opts: { odeType: 'first', x0: '0', xEnd: '2', y0: '1' } },
                { label: 'Logistic growth: y′ = y(1 − y)', fn: 'y*(1-y)', opts: { odeType: 'first', x0: '0', xEnd: '8', y0: '0.1' } },
                { label: 'No closed form: y′ = sin(x·y)', fn: 'sin(x*y)', opts: { odeType: 'first', x0: '0', xEnd: '10', y0: '1' } },
                { label: 'Spring: y″ = −y', fn: '-y', opts: { odeType: 'second', x0: '0', xEnd: '12', y0: '1', v0: '0' } },
                { label: 'Damped oscillator', fn: '-0.4*yp-4*y', opts: { odeType: 'second', x0: '0', xEnd: '15', y0: '1', v0: '0' } },
                { label: 'Rotation system', fn: 'y ; -x', opts: { odeType: 'system', x0: '0', xEnd: '12', initial: '1, 0' } },
                { label: 'Predator–prey (Lotka–Volterra)', fn: 'x*(1-0.5*y) ; y*(0.5*x-1)', opts: { odeType: 'system', x0: '0', xEnd: '30', initial: '3, 1' } }
            ]
        },
        multivariable: {
            label: '∇ Multivariable', icon: '∇',
            input: v => (VECTOR_OPS.includes(v.op)
                ? { label: 'Vector field  F = (P ; Q ; R)', placeholder: 'e.g. -y ; x     or     x*y ; y*z ; z*x', hint: 'Give 2 or 3 components separated by ;' }
                : { label: 'f(x, y, …)', placeholder: 'e.g. x^2*y + sin(y)', hint: 'A scalar function of two or three variables.' }),
            fields: [
                { key: 'op', label: 'Operation', type: 'select', def: 'gradient', options: OPS_MULTI },
                { key: 'vars', label: 'Variables (comma-separated, blank = auto)', type: 'text', def: '', placeholder: 'x, y' },
                { key: 'point', label: 'Evaluate at point (optional)', type: 'text', def: '', placeholder: 'e.g. 1, 2', show: v => ['gradient', 'divergence'].includes(v.op) },
                { key: 'direction', label: 'Direction vector (optional)', type: 'text', def: '', placeholder: 'e.g. 1, 1', show: v => v.op === 'gradient' },
                { key: 'xLow', label: 'x from', type: 'text', def: '0', show: v => v.op === 'double' },
                { key: 'xHigh', label: 'x to', type: 'text', def: '1', show: v => v.op === 'double' },
                { key: 'yLow', label: 'y from (may depend on x)', type: 'text', def: '0', show: v => v.op === 'double' },
                { key: 'yHigh', label: 'y to (may depend on x)', type: 'text', def: 'x', show: v => v.op === 'double' },
                { key: 'radius', label: 'Search / plot radius', type: 'number', def: '5', show: v => ['critical', 'gradient', 'partial', 'hessian', 'laplacian'].includes(v.op) }
            ],
            examples: [
                { label: 'Gradient of x²y + sin y at (1, 0)', fn: 'x^2*y+sin(y)', opts: { op: 'gradient', vars: '', point: '1, 0', direction: '1, 1' } },
                { label: 'Hessian of x³ − 3xy + y³', fn: 'x^3-3*x*y+y^3', opts: { op: 'hessian', vars: '' } },
                { label: 'Critical points of x³ − 3x + y²', fn: 'x^3-3*x+y^2', opts: { op: 'critical', vars: '', radius: '4' } },
                { label: 'Critical points of sin x · sin y', fn: 'sin(x)*sin(y)', opts: { op: 'critical', vars: '', radius: '3' } },
                { label: 'Double integral of xy over a triangle', fn: 'x*y', opts: { op: 'double', vars: 'x, y', xLow: '0', xHigh: '1', yLow: '0', yHigh: 'x' } },
                { label: 'Area of the unit disc', fn: '1', opts: { op: 'double', vars: 'x, y', xLow: '-1', xHigh: '1', yLow: '-sqrt(1-x^2)', yHigh: 'sqrt(1-x^2)' } },
                { label: 'Laplacian of x² − y² (harmonic)', fn: 'x^2-y^2', opts: { op: 'laplacian', vars: '' } },
                { label: 'Curl of the rotation field (−y, x)', fn: '-y ; x', opts: { op: 'curl', vars: '' } },
                { label: 'Divergence of (xy, yz, zx)', fn: 'x*y ; y*z ; z*x', opts: { op: 'divergence', vars: '' } }
            ]
        }
    };

    const TEMPLATES = [
        ['x²', 'x^2'], ['sin', 'sin(x)'], ['cos', 'cos(x)'], ['eˣ', 'e^x'], ['ln', 'ln(x)'], ['1/x', '1/x'],
        ['√x', 'sqrt(x)'], ['cubic', 'x^3-2*x'], ['tan', 'tan(x)'], ['gauss', 'e^(-x^2)'], ['|x|', 'abs(x)'], ['sinc', 'sin(x)/x']
    ];
    const KEYPAD = [['π', 'pi'], ['e', 'e'], ['^', '^'], ['√', 'sqrt('], ['(', '('], [')', ')'], ['|x|', 'abs('], ['ln', 'ln('], ['sin', 'sin('], ['cos', 'cos('], ['tan', 'tan('], ['∞', 'inf']];

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------
    const state = {
        mode: 'derivative',
        opts: {},          // opts[mode][key] -> string
        result: null,
        liveSpec: null,
        view3d: 'surface',
        busy: false
    };
    Object.keys(MODES).forEach(m => {
        state.opts[m] = {};
        MODES[m].fields.forEach(f => { state.opts[m][f.key] = f.def; });
    });

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const digits = () => parseInt($('precision').value, 10) || 6;
    const resolution = () => parseInt($('resolution').value, 10) || 400;
    const isDark = () => document.body.classList.contains('dark');

    function toast(msg, kind) {
        const t = document.createElement('div');
        t.className = 'toast ' + (kind || '');
        t.textContent = msg;
        t.setAttribute('role', 'status');
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
    }

    // ------------------------------------------------------------------
    // Theme
    // ------------------------------------------------------------------
    function applyTheme(dark) {
        document.body.classList.toggle('dark', dark);
        $('themeToggle').textContent = dark ? '🌙' : '☀️';
        $('themeToggle').setAttribute('aria-pressed', String(dark));
        try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) { /* storage unavailable */ }
    }
    function initTheme() {
        let saved = null;
        try { saved = localStorage.getItem('theme'); } catch (e) { /* ignore */ }
        const dark = saved ? saved === 'dark' : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(dark);
        $('themeToggle').addEventListener('click', () => { applyTheme(!isDark()); refreshActivePlot(); });
    }

    // ------------------------------------------------------------------
    // TeX helpers
    // ------------------------------------------------------------------
    function renderTex(root) {
        root.querySelectorAll('[data-tex]').forEach(el => {
            const tex = el.getAttribute('data-tex');
            if (!tex || typeof katex === 'undefined') return;
            try {
                katex.render(tex, el, { throwOnError: true, displayMode: el.classList.contains('tex-display'), output: 'html' });
                el.classList.add('rendered');
            } catch (e) { /* keep plain-text fallback */ }
        });
    }
    const texSpan = (tex, fallback, display) =>
        tex ? `<span class="tex ${display ? 'tex-display' : ''}" data-tex="${esc(tex)}">${esc(fallback)}</span>` : `<span class="plain">${esc(fallback)}</span>`;

    // ------------------------------------------------------------------
    // Option panel
    // ------------------------------------------------------------------
    function currentValues() { return state.opts[state.mode]; }

    function renderOptions() {
        const mode = MODES[state.mode];
        const vals = currentValues();
        const html = mode.fields.filter(f => !f.show || f.show(vals)).map(f => {
            const id = 'opt_' + f.key;
            let control;
            if (f.type === 'select') {
                control = `<select id="${id}" data-key="${f.key}">${f.options.map(([v, l]) => `<option value="${esc(v)}" ${vals[f.key] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
            } else {
                control = `<input id="${id}" data-key="${f.key}" type="${f.type === 'number' ? 'number' : 'text'}" value="${esc(vals[f.key])}" ` +
                    `placeholder="${esc(f.placeholder || '')}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} autocomplete="off" spellcheck="false">`;
            }
            return `<div class="option-group"><label class="option-label" for="${id}">${esc(f.label)}</label>${control}</div>`;
        }).join('');
        const box = $('modeOptions');
        box.innerHTML = html;
        box.querySelectorAll('[data-key]').forEach(el => {
            const handler = () => {
                vals[el.dataset.key] = el.value;
                const f = mode.fields.find(x => x.key === el.dataset.key);
                const affectsLayout = mode.fields.some(g => g.show) || el.dataset.key === 'odeType' || el.dataset.key === 'op';
                if (el.tagName === 'SELECT' || (affectsLayout && ['lower', 'upper'].includes(f.key))) {
                    const focusKey = el.dataset.key, pos = el.selectionStart;
                    renderOptions();
                    const again = box.querySelector(`[data-key="${focusKey}"]`);
                    if (again && el.tagName !== 'SELECT') { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* number inputs */ } }
                    updateInputLabels();
                    validateInput();
                }
                saveSession();
            };
            el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', handler);
            el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); compute(); } });
        });
    }

    function updateInputLabels() {
        const spec = MODES[state.mode].input(currentValues());
        $('inputLabel').textContent = spec.label;
        $('functionInput').placeholder = spec.placeholder;
        $('inputHint').textContent = spec.hint;
    }

    function setMode(mode, keepInput) {
        if (!MODES[mode]) mode = 'derivative';
        state.mode = mode;
        $('operationMode').value = mode;
        renderOptions();
        updateInputLabels();
        renderExamples();
        if (!keepInput) validateInput();
        saveSession();
    }

    function renderExamples() {
        const sel = $('examples');
        sel.innerHTML = '<option value="">Try an example…</option>' +
            MODES[state.mode].examples.map((e, i) => `<option value="${i}">${esc(e.label)}</option>`).join('');
    }

    function loadExample(i) {
        const ex = MODES[state.mode].examples[i];
        if (!ex) return;
        const vals = currentValues();
        MODES[state.mode].fields.forEach(f => { vals[f.key] = f.def; });
        Object.assign(vals, ex.opts);
        $('functionInput').value = ex.fn;
        renderOptions();
        updateInputLabels();
        validateInput();
        compute();
    }

    // ------------------------------------------------------------------
    // Input validation & live preview
    // ------------------------------------------------------------------
    function splitParts(src) { return src.split(/[;\n]+/).map(s => s.trim()).filter(Boolean); }
    function multiPartMode() {
        const v = currentValues();
        return (state.mode === 'ode' && v.odeType === 'system') || (state.mode === 'multivariable' && VECTOR_OPS.includes(v.op));
    }

    function validateInput() {
        const src = $('functionInput').value;
        const preview = $('preview');
        state.liveSpec = null;
        if (!src.trim()) {
            preview.className = 'preview-box';
            preview.textContent = 'Enter a function to begin…';
            return false;
        }
        try {
            const parts = multiPartMode() ? splitParts(src) : [src];
            const infos = parts.map(p => engine.inspect(p));
            const tex = infos.map(i => i.tex).join(',\\;');
            const vars = [...new Set(infos.flatMap(i => i.vars))];
            const sample = infos.length === 1 && Number.isFinite(infos[0].sampleValue)
                ? ` · f(${vars.length ? vars.map(() => infos[0].sampleAt).join(', ') : ''}) = ${engine.fmt(infos[0].sampleValue, 5)}` : '';
            preview.className = 'preview-box valid';
            preview.innerHTML = `<span class="preview-tex">${texSpan(tex, infos.map(i => i.text).join(' ; '), false)}</span>` +
                `<span class="preview-meta">${vars.length ? 'variables: ' + esc(vars.join(', ')) : 'constant'}${esc(sample)}</span>`;
            renderTex(preview);
            if (infos.length === 1 && !multiPartMode()) state.liveSpec = infos[0];
            return true;
        } catch (e) {
            preview.className = 'preview-box error';
            preview.innerHTML = `<strong>⚠</strong> ${esc(e.message)}`;
            return false;
        }
    }

    // ------------------------------------------------------------------
    // Compute
    // ------------------------------------------------------------------
    function gatherOptions() {
        const vals = Object.assign({}, currentValues());
        vals.digits = digits();
        const m = state.mode;
        if (m === 'ode') {
            vals.odeType = vals.odeType || 'first';
        }
        if (m === 'derivative') vals.variable = (vals.variable || '').trim() || undefined;
        if (m === 'integral' || m === 'series' || m === 'limit' || m === 'analysis') vals.variable = (vals.variable || '').trim() || undefined;
        return vals;
    }

    async function compute() {
        if (state.busy) { Runner.cancel(); return; }
        if (!validateInput()) { showError('Please enter a valid expression first.'); return; }
        const btn = $('computeBtn');
        state.busy = true;
        btn.classList.add('loading');
        btn.innerHTML = '<div class="spinner"></div><span>Cancel</span>';
        $('results').setAttribute('aria-busy', 'true');
        try {
            const src = $('functionInput').value;
            const mode = state.mode === 'multivariable' ? 'multivariable' : state.mode;
            const result = await Runner.run(mode, src, gatherOptions());
            state.result = result;
            displayResult(result);
            switchTab('results');
            pushHistory(result);
            updateShareHash();
            prepareAuxiliaryTabs(result);
        } catch (err) {
            if (err.message !== 'Cancelled') showError(err.message, !err.user);
            else showError('Computation cancelled.');
        } finally {
            state.busy = false;
            btn.classList.remove('loading');
            btn.innerHTML = '<span>🚀</span><span>Compute</span>';
            $('results').removeAttribute('aria-busy');
        }
    }

    function showError(message, unexpected) {
        $('results').innerHTML = `<div class="alert alert-error" role="alert"><span class="alert-icon">⚠</span><div><strong>${unexpected ? 'Unexpected error' : 'Could not compute'}</strong><br>${esc(message)}</div></div>`;
        switchTab('results');
    }

    // ------------------------------------------------------------------
    // Result rendering
    // ------------------------------------------------------------------
    const KIND_ICON = { derivative: '∂', integral: '∫', definite: '∫', series: 'Σ', limit: 'lim', analysis: 'f', ode: 'y′', multivariable: '∇', vector: '∇' };

    function displayResult(r) {
        const rows = r.items.map(i => `
            <div class="result-row">${i.tex && !i.inline ? '' : `<span class="row-label">${esc(i.label)}</span> `}${texSpan(i.tex, i.text, false)}</div>`).join('');
        const html = `
            <div class="result-card">
                <div class="result-title">
                    <div class="result-icon">${esc(KIND_ICON[r.kind] || '=')}</div>
                    <span>${esc(r.title)}</span>
                    <div class="result-actions">
                        <button class="mini-btn" data-act="copy" title="Copy result as text">📋 Copy</button>
                        <button class="mini-btn" data-act="copytex" title="Copy LaTeX">TeX</button>
                        <button class="mini-btn" data-act="share" title="Copy a link to this calculation">🔗 Share</button>
                    </div>
                </div>
                ${r.main ? `<div class="result-content">${r.main.tex ? '' : `<span class="row-label">${esc(r.main.label)}</span> `}${texSpan(r.main.tex, r.main.text, true)}</div>` : ''}
                ${rows ? `<div class="result-rows">${rows}</div>` : ''}
                ${r.meta.length ? `<div class="result-meta">${r.meta.map(m => esc(m)).join('<br>')}</div>` : ''}
                ${r.warnings.map(w => `<div class="alert alert-warning"><span class="alert-icon">ℹ️</span><span>${esc(w)}</span></div>`).join('')}
            </div>`;
        const container = $('results');
        container.innerHTML = html;
        renderTex(container);
        container.querySelector('[data-act="copy"]').addEventListener('click', () => copyText(r.text, 'Result copied'));
        container.querySelector('[data-act="copytex"]').addEventListener('click', () => copyText(r.main && r.main.tex ? r.main.tex : r.text, 'LaTeX copied'));
        container.querySelector('[data-act="share"]').addEventListener('click', shareLink);
        displaySteps(r.steps);
    }

    function displaySteps(steps) {
        const el = $('steps');
        if (!steps || !steps.length) {
            el.classList.remove('show-timeline');
            el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📖</div><h3>No steps for this computation</h3><p>Try a different operation</p></div>';
            return;
        }
        el.classList.add('show-timeline');
        el.innerHTML = steps.map((s, i) => `
            <div class="step-card" style="--delay:${Math.min(i, 12) * 60}ms">
                <div class="step-header"><div class="step-number">${i + 1}</div><div class="step-title">${esc(s.title)}</div></div>
                <div class="step-content">${esc(s.text)}</div>
                ${s.tex ? `<div class="step-tex">${texSpan(s.tex, '', true)}</div>` : ''}
            </div>`).join('');
        renderTex(el);
    }

    async function copyText(text, msg) {
        try {
            await navigator.clipboard.writeText(text);
            toast(msg, 'ok');
        } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = text; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); toast(msg, 'ok'); } catch (e2) { toast('Copy failed', 'err'); }
            ta.remove();
        }
    }

    // ------------------------------------------------------------------
    // Persistence: session, history, share links
    // ------------------------------------------------------------------
    function snapshot() { return { m: state.mode, f: $('functionInput').value, o: state.opts[state.mode] }; }

    function saveSession() {
        try { localStorage.setItem('cs_session', JSON.stringify({ m: state.mode, f: $('functionInput').value, opts: state.opts })); } catch (e) { /* ignore */ }
    }

    function restoreSnapshot(s) {
        if (!s || !MODES[s.m]) return false;
        state.mode = s.m;
        MODES[s.m].fields.forEach(f => { state.opts[s.m][f.key] = f.def; });
        Object.keys(s.o || {}).forEach(k => { if (typeof s.o[k] === 'string') state.opts[s.m][k] = s.o[k]; });
        $('functionInput').value = String(s.f || '');
        setMode(s.m, true);
        validateInput();
        return true;
    }

    function encodeHash(s) { return btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
    function decodeHash(h) {
        try {
            const b = h.replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4)))));
        } catch (e) { return null; }
    }
    function updateShareHash() {
        try { history.replaceState(null, '', '#s=' + encodeHash(snapshot())); } catch (e) { /* file:// restrictions */ }
    }
    function shareLink() {
        const url = location.href.split('#')[0] + '#s=' + encodeHash(snapshot());
        copyText(url, 'Link copied – anyone opening it sees this calculation');
    }

    function getHistory() { try { return JSON.parse(localStorage.getItem('cs_history') || '[]'); } catch (e) { return []; } }
    function pushHistory(result) {
        const entry = { s: snapshot(), t: result.main ? `${result.main.label} ${result.main.text}` : result.title, ts: Date.now() };
        const list = getHistory().filter(h => !(h.s.m === entry.s.m && h.s.f === entry.s.f && JSON.stringify(h.s.o) === JSON.stringify(entry.s.o)));
        list.unshift(entry);
        try { localStorage.setItem('cs_history', JSON.stringify(list.slice(0, 30))); } catch (e) { /* ignore */ }
        renderHistory();
    }
    function renderHistory() {
        const list = getHistory();
        const box = $('historyList');
        if (!list.length) { box.innerHTML = '<div class="history-empty">Your calculations will appear here.</div>'; return; }
        box.innerHTML = list.map((h, i) => `
            <button class="history-item" data-i="${i}" title="${esc(h.t)}">
                <span class="history-mode">${esc((MODES[h.s.m] || {}).icon || '=')}</span>
                <span class="history-fn">${esc(h.s.f.length > 40 ? h.s.f.slice(0, 40) + '…' : h.s.f)}</span>
            </button>`).join('');
        box.querySelectorAll('.history-item').forEach(b => b.addEventListener('click', () => {
            const h = getHistory()[+b.dataset.i];
            if (h && restoreSnapshot(h.s)) compute();
        }));
    }

    // ------------------------------------------------------------------
    // Tabs
    // ------------------------------------------------------------------
    function switchTab(name) {
        document.querySelectorAll('.tab').forEach(t => {
            const on = t.dataset.tab === name;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', String(on));
        });
        document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === name));
        if (name === 'plot') plot2D();
        if (name === 'plot3d') plot3D();
    }
    function activeTab() { const t = document.querySelector('.tab.active'); return t ? t.dataset.tab : 'results'; }
    function refreshActivePlot() { const t = activeTab(); if (t === 'plot') plot2D(); if (t === 'plot3d') plot3D(); }

    function prepareAuxiliaryTabs(result) {
        // Hint which plot tab is meaningful for this result
        const has2d = !!(result.plot || result.plot2field);
        const has3d = !!result.plot3;
        $('tab-plot').classList.toggle('dim', !has2d && !state.liveSpec);
        $('tab-plot3d').classList.toggle('dim', !has3d && !(state.liveSpec && state.liveSpec.vars.length >= 2));
    }

    // ------------------------------------------------------------------
    // Plotting
    // ------------------------------------------------------------------
    const COLORS = ['#007aff', '#ff9500', '#34c759', '#af52de', '#ff3b30', '#5ac8fa'];

    function plotTheme() {
        const dark = isDark();
        return {
            text: dark ? '#f5f5f7' : '#1d1d1f',
            grid: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)',
            zero: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)',
            bg: dark ? 'rgba(10,10,14,0.0)' : 'rgba(255,255,255,0.0)',
            scene: dark ? 'rgba(5,8,15,0.95)' : 'rgba(255,255,255,0.92)'
        };
    }

    function quantile(sorted, q) { return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))]; }

    function sampleCurve(fn, lo, hi, n) {
        const xs = [], ys = [];
        for (let i = 0; i <= n; i++) {
            const x = lo + (hi - lo) * i / n;
            const y = fn(x);
            xs.push(x); ys.push(Number.isFinite(y) ? y : null);
        }
        // break the line across vertical asymptotes (huge jumps with a sign change)
        const finite = ys.filter(y => y !== null).map(Math.abs).sort((a, b) => a - b);
        const med = finite.length ? finite[Math.floor(finite.length / 2)] : 1;
        const thr = Math.max(20 * med, 50);
        for (let i = 1; i < ys.length; i++) {
            const a = ys[i - 1], b = ys[i];
            if (a !== null && b !== null && Math.sign(a) !== Math.sign(b) && Math.abs(a) > thr && Math.abs(b) > thr) {
                ys[i - 1] = null;
            }
        }
        return { xs, ys };
    }

    function arrowSegments(x, y, dx, dy, head) {
        const len = Math.hypot(dx, dy);
        if (!len || !Number.isFinite(len)) return null;
        const ex = x + dx, ey = y + dy, ang = Math.atan2(dy, dx), h = head || len * 0.3;
        return [
            [x, y], [ex, ey],
            [ex - h * Math.cos(ang - 0.45), ey - h * Math.sin(ang - 0.45)], [ex, ey],
            [ex - h * Math.cos(ang + 0.45), ey - h * Math.sin(ang + 0.45)], [ex, ey]
        ];
    }

    function liveSpec2D() {
        const info = state.liveSpec;
        if (!info || info.vars.length > 1) return null;
        const v = info.vars[0] || 'x';
        return { variable: v, curves: [{ name: `f(${v})`, fn: engine.compile(info.node, [v]) }] };
    }

    function plot2D() {
        const div = $('plot2d'), phase = $('plotPhase');
        phase.style.display = 'none';
        const r = state.result;
        let spec = r && r.plot ? r.plot : null;
        let field = r && r.plot2field ? r.plot2field : null;
        if (!spec && !field) spec = liveSpec2D();
        if (!spec && !field) {
            Plotly.purge(div);
            div.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📈</div><h3>Nothing to plot yet</h3><p>${state.liveSpec && state.liveSpec.vars.length > 1 ? 'This expression has several variables – see the 3D tab.' : 'Enter a function of one variable or run a computation.'}</p></div>`;
            return;
        }
        if (div.querySelector('.empty-state')) div.innerHTML = '';
        const th = plotTheme();
        const traces = [], shapes = [], annotations = [];
        let lo, hi;
        const userLo = parseFloat($('xMin').value), userHi = parseFloat($('xMax').value);
        if (field) {
            lo = Number.isFinite(userLo) ? userLo : -5; hi = Number.isFinite(userHi) ? userHi : 5;
        } else if (Number.isFinite(userLo) && Number.isFinite(userHi) && userLo < userHi) {
            lo = userLo; hi = userHi;
        } else if (spec.xRange && Number.isFinite(spec.xRange[0]) && Number.isFinite(spec.xRange[1]) && spec.xRange[0] < spec.xRange[1]) {
            [lo, hi] = spec.xRange;
        } else { lo = -10; hi = 10; }
        const n = Math.min(4000, Math.max(200, resolution() * 2));
        const allY = [];

        if (field) {
            const [vx, vy] = field.vars;
            const N = 15, step = (hi - lo) / (N - 1);
            const mags = [];
            const cells = [];
            for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
                const x = lo + i * step, y = lo + j * step;
                const u = field.fns[0](x, y), w = field.fns[1](x, y);
                if (Number.isFinite(u) && Number.isFinite(w)) { cells.push([x, y, u, w]); mags.push(Math.hypot(u, w)); }
            }
            const maxMag = Math.max(...mags, 1e-12);
            const px = [], py = [];
            cells.forEach(([x, y, u, w]) => {
                const k = 0.8 * step / maxMag;
                const seg = arrowSegments(x, y, u * k, w * k);
                if (seg) { seg.forEach(p => { px.push(p[0]); py.push(p[1]); }); px.push(null); py.push(null); }
            });
            traces.push({ x: px, y: py, mode: 'lines', type: 'scatter', line: { color: COLORS[0], width: 1.6 }, name: 'F', hoverinfo: 'skip' });
            allY.push(lo, hi);
        }

        if (spec) {
            (spec.curves || []).forEach((c, i) => {
                let s;
                if (c.data) {
                    const t0 = c.data.t[0], t1 = c.data.t[c.data.t.length - 1];
                    s = sampleCurve(c.fn, Math.min(t0, t1), Math.max(t0, t1), n);
                } else s = sampleCurve(c.fn, lo, hi, n);
                s.ys.forEach(y => { if (y !== null) allY.push(y); });
                traces.push({
                    x: s.xs, y: s.ys, mode: 'lines', type: 'scatter', name: c.name, connectgaps: false,
                    line: { color: COLORS[i % COLORS.length], width: i === 0 ? 3 : 2.2, dash: c.dash || 'solid' }
                });
            });
            if (spec.shade && spec.shade.fn) {
                const a = Math.max(spec.shade.a, lo), b = Math.min(spec.shade.b, hi);
                if (b > a) {
                    const s = sampleCurve(spec.shade.fn, a, b, Math.max(200, n / 2));
                    traces.push({ x: s.xs, y: s.ys.map(y => (y === null || Math.abs(y) > 1e6 ? null : y)), type: 'scatter', mode: 'lines', fill: 'tozeroy', fillcolor: 'rgba(0,122,255,0.22)', line: { width: 0 }, name: 'area', hoverinfo: 'skip' });
                }
            }
            if (spec.points && spec.points.length) {
                traces.push({
                    x: spec.points.map(p => p.x), y: spec.points.map(p => p.y), mode: 'markers', type: 'scatter', name: 'points of interest',
                    text: spec.points.map(p => p.name), hovertemplate: '%{text}<br>(%{x:.5g}, %{y:.5g})<extra></extra>',
                    marker: { size: 11, color: spec.points.map(p => p.color || COLORS[1]), symbol: spec.points.map(p => (p.open ? 'circle-open' : 'circle')), line: { width: 2, color: spec.points.map(p => p.color || COLORS[1]) } }
                });
                spec.points.forEach(p => allY.push(p.y));
            }
            (spec.vlines || []).forEach(x => shapes.push({ type: 'line', x0: x, x1: x, yref: 'paper', y0: 0, y1: 1, line: { color: '#ff3b30', width: 1.5, dash: 'dash' } }));
            (spec.hlines || []).concat(spec.hline !== undefined ? [spec.hline] : []).forEach(y => shapes.push({ type: 'line', y0: y, y1: y, xref: 'paper', x0: 0, x1: 1, line: { color: '#8e8e93', width: 1.5, dash: 'dot' } }));

            // y-range: clip runaway values near asymptotes
            if (spec.slopeField && spec.slopeField.fn) {
                const ysf = allY.slice().sort((a, b) => a - b);
                const yl = ysf.length ? quantile(ysf, 0) : -1, yh = ysf.length ? quantile(ysf, 1) : 1;
                const padY = (yh - yl) * 0.25 || 1;
                const y0 = yl - padY, y1 = yh + padY;
                const nx = 22, ny = 16, cw = (hi - lo) / nx, ch = (y1 - y0) / ny;
                const px = [], py = [];
                for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
                    const x = lo + i * cw, y = y0 + j * ch, m = spec.slopeField.fn(x, y);
                    if (!Number.isFinite(m)) continue;
                    const mn = m * (hi - lo) / (y1 - y0), norm = Math.hypot(1, mn), hl = 0.38;
                    const ux = (hi - lo) * hl / nx / norm, uy = (y1 - y0) * hl / ny * mn / norm;
                    px.push(x - ux, x + ux, null); py.push(y - uy, y + uy, null);
                }
                traces.unshift({ x: px, y: py, mode: 'lines', type: 'scatter', line: { color: isDark() ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)', width: 1 }, name: 'slope field', hoverinfo: 'skip' });
                allY.push(y0, y1);
            }
        }

        const sorted = allY.filter(Number.isFinite).sort((a, b) => a - b);
        let yRange = null;
        if (sorted.length > 5) {
            const q1 = quantile(sorted, 0.03), q2 = quantile(sorted, 0.97), span = (q2 - q1) || 1;
            if (sorted[sorted.length - 1] - sorted[0] > 6 * span) yRange = [q1 - 0.6 * span, q2 + 0.6 * span];
        }
        const xTitle = field ? field.vars[0] : (spec && spec.variable) || 'x';
        const layout = {
            title: { text: r && r.title && state.result.plot ? r.title : (spec ? 'Graph' : 'Vector field'), font: { size: 16, color: th.text } },
            xaxis: { title: xTitle, gridcolor: th.grid, zerolinecolor: th.zero, color: th.text, range: [lo, hi] },
            yaxis: { title: field ? field.vars[1] : '', gridcolor: th.grid, zerolinecolor: th.zero, color: th.text, ...(yRange ? { range: yRange } : {}), ...(field ? { range: [lo, hi], scaleanchor: 'x' } : {}) },
            paper_bgcolor: th.bg, plot_bgcolor: th.bg, font: { color: th.text },
            margin: { t: 50, r: 30, b: 50, l: 55 }, shapes, annotations,
            legend: { orientation: 'h', y: -0.18 }, hovermode: 'closest'
        };
        Plotly.react(div, traces, layout, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'], toImageButtonOptions: { filename: 'calculus-suite-plot', scale: 2 } });

        // phase portrait for ODE systems
        if (spec && spec.phase) {
            phase.style.display = 'block';
            Plotly.react(phase, [{
                x: spec.phase.x, y: spec.phase.y, mode: 'lines', type: 'scatter', line: { color: COLORS[2], width: 2.5 }, name: 'trajectory'
            }, {
                x: [spec.phase.x[0]], y: [spec.phase.y[0]], mode: 'markers', type: 'scatter', marker: { size: 11, color: COLORS[4] }, name: 'start'
            }], {
                title: { text: `Phase portrait (${spec.phase.labels[0]} vs ${spec.phase.labels[1]})`, font: { size: 15, color: th.text } },
                xaxis: { title: spec.phase.labels[0], gridcolor: th.grid, color: th.text, zerolinecolor: th.zero },
                yaxis: { title: spec.phase.labels[1], gridcolor: th.grid, color: th.text, zerolinecolor: th.zero },
                paper_bgcolor: th.bg, plot_bgcolor: th.bg, font: { color: th.text }, margin: { t: 45, r: 30, b: 50, l: 55 }, legend: { orientation: 'h', y: -0.2 }
            }, { responsive: true, displaylogo: false });
        }
    }

    function plot3D() {
        const div = $('plot3dDiv');
        const r = state.result;
        let spec = r && r.plot3 ? r.plot3 : null;
        if (!spec) {
            const info = state.liveSpec;
            if (info && info.vars.length >= 2) {
                spec = { vars: info.vars.slice(0, 3), fn: engine.compile(info.node, info.vars), live: true };
            }
        }
        const msg = (icon, title, text) => { Plotly.purge(div); div.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${icon}</div><h3>${title}</h3><p>${text}</p></div>`; };
        if (!spec) return msg('🎮', 'No surface to show', 'Enter a function of two variables, e.g. <code>sin(x)*cos(y)</code>, or use the Multivariable mode.');
        if (div.querySelector('.empty-state')) div.innerHTML = '';
        const th = plotTheme();
        const sceneBase = {
            bgcolor: th.scene,
            xaxis: { gridcolor: th.grid, zerolinecolor: th.zero, color: th.text },
            yaxis: { gridcolor: th.grid, zerolinecolor: th.zero, color: th.text },
            zaxis: { gridcolor: th.grid, zerolinecolor: th.zero, color: th.text }
        };
        const baseLayout = { paper_bgcolor: th.scene, font: { color: th.text }, margin: { t: 50, r: 10, b: 10, l: 10 } };
        const config = { responsive: true, displaylogo: false, toImageButtonOptions: { filename: 'calculus-suite-3d', scale: 2 } };

        if (spec.field) { // 3D vector field
            const R = 3, k = 5, xs = [], ys = [], zs = [], us = [], vs = [], ws = [];
            for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) for (let l = 0; l < k; l++) {
                const x = -R + 2 * R * i / (k - 1), y = -R + 2 * R * j / (k - 1), z = -R + 2 * R * l / (k - 1);
                const u = spec.fns[0](x, y, z), v = spec.fns[1](x, y, z), w = spec.fns[2](x, y, z);
                if ([u, v, w].every(Number.isFinite)) { xs.push(x); ys.push(y); zs.push(z); us.push(u); vs.push(v); ws.push(w); }
            }
            Plotly.react(div, [{ type: 'cone', x: xs, y: ys, z: zs, u: us, v: vs, w: ws, sizemode: 'scaled', sizeref: 0.8, colorscale: 'Viridis', showscale: false }],
                { ...baseLayout, title: { text: 'Vector field F', font: { size: 16, color: th.text } }, scene: { ...sceneBase, aspectmode: 'cube' } }, config);
            return;
        }

        let xr, yr;
        if (spec.xRange && spec.yRange) {
            xr = spec.xRange.slice(); yr = spec.yRange.slice();
            if (xr[0] === xr[1]) xr = [xr[0] - 1, xr[1] + 1];
            if (yr[0] === yr[1]) yr = [yr[0] - 1, yr[1] + 1];
        } else { const R = spec.range || 5; xr = [-R, R]; yr = [-R, R]; }
        const grid = Math.min(90, Math.max(25, Math.round(resolution() / 8)));
        const xv = [], yv = [], zv = [];
        for (let i = 0; i <= grid; i++) xv.push(xr[0] + (xr[1] - xr[0]) * i / grid);
        for (let j = 0; j <= grid; j++) yv.push(yr[0] + (yr[1] - yr[0]) * j / grid);
        const extra = new Array(Math.max(0, spec.vars.length - 2)).fill(0);
        let valid = 0;
        for (let j = 0; j <= grid; j++) { // rows follow y, columns follow x (Plotly convention)
            const row = [];
            for (let i = 0; i <= grid; i++) {
                const z = spec.fn(xv[i], yv[j], ...extra);
                if (Number.isFinite(z) && Math.abs(z) < 1e7) { row.push(z); valid++; } else row.push(null);
            }
            zv.push(row);
        }
        if (valid < 25) return msg('⚠', 'Cannot draw this surface', 'The function is undefined on almost the whole domain.');
        const flat = [].concat(...zv).filter(z => z !== null).sort((a, b) => a - b);
        const zlo = flat[0], zhi = flat[flat.length - 1];
        const scale = isDark() ? [[0, '#1d4ed8'], [0.5, '#a855f7'], [1, '#f472b6']] : [[0, '#0f172a'], [0.5, '#2563eb'], [1, '#60a5fa']];
        const traces = [];
        if (state.view3d === 'contour') {
            traces.push({ type: 'contour', x: xv, y: yv, z: zv, colorscale: scale, contours: { showlabels: true }, line: { width: 1 } });
        } else {
            traces.push({ type: 'surface', x: xv, y: yv, z: zv, colorscale: scale, opacity: 0.97, contours: { z: { show: true, usecolormap: true, project: { z: true } } }, lighting: { ambient: 0.55, diffuse: 0.8, specular: 0.25, roughness: 0.6 } });
        }
        if (spec.points && spec.points.length) {
            const col = n => (n === 'local minimum' ? '#34c759' : n === 'local maximum' ? '#ff3b30' : '#ff9500');
            if (state.view3d === 'contour') {
                traces.push({ type: 'scatter', mode: 'markers', x: spec.points.map(p => p.x), y: spec.points.map(p => p.y), text: spec.points.map(p => p.name), marker: { size: 10, color: spec.points.map(p => col(p.name)), line: { width: 2, color: '#fff' } }, name: 'critical points' });
            } else {
                traces.push({ type: 'scatter3d', mode: 'markers', x: spec.points.map(p => p.x), y: spec.points.map(p => p.y), z: spec.points.map(p => p.z), text: spec.points.map(p => p.name), marker: { size: 6, color: spec.points.map(p => col(p.name)), line: { width: 1, color: '#fff' } }, name: 'critical points' });
            }
        }
        const [vx, vy] = spec.vars;
        const layout = state.view3d === 'contour'
            ? { ...baseLayout, title: { text: `Contour map of f(${spec.vars.join(', ')})`, font: { size: 16, color: th.text } }, xaxis: { title: vx, color: th.text }, yaxis: { title: vy, color: th.text, scaleanchor: 'x' }, plot_bgcolor: th.scene, margin: { t: 50, r: 20, b: 50, l: 55 } }
            : { ...baseLayout, title: { text: `f(${spec.vars.join(', ')})`, font: { size: 16, color: th.text } }, scene: { ...sceneBase, xaxis: { ...sceneBase.xaxis, title: vx }, yaxis: { ...sceneBase.yaxis, title: vy }, zaxis: { ...sceneBase.zaxis, title: 'f', range: [zlo - (zhi - zlo) * 0.02, zhi + (zhi - zlo) * 0.02 || 1] }, aspectmode: 'cube' } };
        Plotly.react(div, traces, layout, config);
    }

    // ------------------------------------------------------------------
    // Misc UI
    // ------------------------------------------------------------------
    function insertAtCaret(text) {
        const ta = $('functionInput');
        const s = ta.selectionStart, e = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
        const pos = s + text.length;
        ta.focus(); ta.setSelectionRange(pos, pos);
        validateInput(); saveSession();
    }

    function clearAll() {
        $('functionInput').value = '';
        state.result = null;
        state.liveSpec = null;
        validateInput();
        $('results').innerHTML = '<div class="empty-state"><div class="empty-state-icon">🧮</div><h3>Ready to Compute</h3><p>Enter a function, pick an operation and press <kbd>Ctrl</kbd>+<kbd>Enter</kbd></p></div>';
        displaySteps([]);
        $('steps').classList.remove('show-timeline');
        $('steps').innerHTML = '<div class="empty-state"><div class="empty-state-icon">📖</div><h3>Step-by-Step Solutions</h3><p>The reasoning behind each result appears here</p></div>';
        try { Plotly.purge($('plot2d')); Plotly.purge($('plot3dDiv')); Plotly.purge($('plotPhase')); } catch (e) { /* ignore */ }
        $('plot2d').innerHTML = ''; $('plot3dDiv').innerHTML = ''; $('plotPhase').style.display = 'none';
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
        saveSession();
        $('functionInput').focus();
    }

    function initUI() {
        // mode select
        $('operationMode').innerHTML = Object.keys(MODES).map(k => `<option value="${k}">${esc(MODES[k].label)}</option>`).join('');
        $('operationMode').addEventListener('change', e => { setMode(e.target.value); });

        // templates and keypad
        $('templates').innerHTML = TEMPLATES.map(([l, t], i) => `<button class="template-btn" data-i="${i}" type="button">${esc(l)}</button>`).join('');
        $('templates').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
            $('functionInput').value = TEMPLATES[+b.dataset.i][1];
            validateInput(); saveSession();
        }));
        $('keypad').innerHTML = KEYPAD.map(([l, t], i) => `<button class="key-btn" data-i="${i}" type="button" aria-label="Insert ${esc(t)}">${esc(l)}</button>`).join('');
        $('keypad').querySelectorAll('button').forEach(b => b.addEventListener('click', () => insertAtCaret(KEYPAD[+b.dataset.i][1])));

        $('examples').addEventListener('change', e => { if (e.target.value !== '') loadExample(+e.target.value); e.target.value = ''; });

        let debounce;
        $('functionInput').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => { validateInput(); saveSession(); }, 120); });

        $('precision').addEventListener('input', e => { $('precisionValue').textContent = e.target.value; });
        $('resolution').addEventListener('input', e => { $('resolutionValue').textContent = e.target.value; });
        $('resolution').addEventListener('change', refreshActivePlot);

        $('computeBtn').addEventListener('click', compute);
        $('clearBtn').addEventListener('click', clearAll);
        $('clearHistory').addEventListener('click', () => { try { localStorage.removeItem('cs_history'); } catch (e) { /* ignore */ } renderHistory(); });

        document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
        $('xMin').addEventListener('change', plot2D);
        $('xMax').addEventListener('change', plot2D);
        $('resetRange').addEventListener('click', () => { $('xMin').value = ''; $('xMax').value = ''; plot2D(); });
        document.querySelectorAll('[name="view3d"]').forEach(r => r.addEventListener('change', e => { state.view3d = e.target.value; plot3D(); }));

        // help dialog
        const dlg = $('helpDialog');
        $('helpBtn').addEventListener('click', () => { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); });
        $('helpClose').addEventListener('click', () => { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); });
        dlg.addEventListener('click', e => { if (e.target === dlg && dlg.close) dlg.close(); });

        document.addEventListener('keydown', e => {
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key === 'Enter') { e.preventDefault(); compute(); }
            else if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); clearAll(); }
            else if (e.key === '?' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) { $('helpBtn').click(); }
        });

        window.addEventListener('resize', () => {
            ['plot2d', 'plot3dDiv', 'plotPhase'].forEach(id => { const el = $(id); if (el && el.data) Plotly.Plots.resize(el); });
        });
        window.addEventListener('hashchange', () => {
            const m = /^#s=(.+)$/.exec(location.hash);
            const s = m && decodeHash(m[1]);
            if (s && restoreSnapshot(s)) compute();
        });
    }

    function init() {
        initTheme();
        initUI();
        renderHistory();
        setMode('derivative');

        // restore: share link > last session
        let restored = false;
        const m = /^#s=(.+)$/.exec(location.hash);
        const shared = m && decodeHash(m[1]);
        if (shared && restoreSnapshot(shared)) { restored = true; }
        else {
            try {
                const saved = JSON.parse(localStorage.getItem('cs_session') || 'null');
                if (saved && MODES[saved.m]) {
                    Object.keys(saved.opts || {}).forEach(mode => {
                        if (!MODES[mode]) return;
                        Object.keys(saved.opts[mode]).forEach(k => { if (k in state.opts[mode] && typeof saved.opts[mode][k] === 'string') state.opts[mode][k] = saved.opts[mode][k]; });
                    });
                    $('functionInput').value = saved.f || '';
                    setMode(saved.m, true);
                    validateInput();
                }
            } catch (e) { /* ignore corrupted session */ }
        }
        if (!$('functionInput').value) {
            $('functionInput').value = 'x^2 * sin(x)';
            validateInput();
        }
        Runner.warmUp();
        if (restored) compute();
        $('app').classList.add('ready');
    }

    // Debug/testing hook
    window.__calc = { state, compute, setMode, validateInput };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
