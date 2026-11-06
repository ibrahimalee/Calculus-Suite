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
            label: 'Derivative', icon: '∂',
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
            label: 'Integral', icon: '∫',
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
            label: 'Taylor series', icon: 'Σ',
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
            label: 'Limits', icon: 'lim',
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
            label: 'Analysis', icon: 'f',
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
            label: 'ODEs', icon: 'y′',
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
                { key: 'series', label: 'Solution method', type: 'select', def: 'no', options: [['no', 'Closed form / numerical (RK45)'], ['yes', 'Power series about x₀']], show: v => v.odeType !== 'system' },
                { key: 'terms', label: 'Series degree (2–14)', type: 'number', def: '8', min: 2, max: 14, show: v => v.odeType !== 'system' && v.series === 'yes' },
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
                { label: 'Power series: y′ = x + y', fn: 'x+y', opts: { odeType: 'first', x0: '0', xEnd: '2', y0: '1', series: 'yes', terms: '8' } },
                { label: 'Power series: y″ = x·y (Airy-type)', fn: 'x*y', opts: { odeType: 'second', x0: '0', xEnd: '2', y0: '1', v0: '0', series: 'yes', terms: '10' } },
                { label: 'Predator–prey (Lotka–Volterra)', fn: 'x*(1-0.5*y) ; y*(0.5*x-1)', opts: { odeType: 'system', x0: '0', xEnd: '30', initial: '3, 1' } }
            ]
        },
        multivariable: {
            label: 'Multivariable', icon: '∇',
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


    MODES.graph = {
        label: 'Graph & sliders', icon: '∿',
        input: () => ({ label: 'Functions  (separate with ;)', placeholder: 'e.g. a*sin(b*x) ; x^2/5', hint: 'Plot several functions at once. Every extra letter (a, b, c…) becomes a live slider; intersections are marked automatically.' }),
        fields: [],
        examples: [
            { label: 'Sine with amplitude & frequency sliders', fn: 'a*sin(b*x)', opts: {} },
            { label: 'Function and its derivative', fn: 'x^3-3*x ; 3*x^2-3', opts: {} },
            { label: 'Intersections: parabola vs line', fn: 'x^2 ; x+2', opts: {} },
            { label: 'Gaussian family', fn: 'a*e^(-b*x^2)', opts: {} },
            { label: 'sin, cos & tan together', fn: 'sin(x) ; cos(x) ; tan(x)', opts: {} },
            { label: 'Damped oscillation', fn: 'e^(-a*x)*cos(b*x) ; e^(-a*x) ; -e^(-a*x)', opts: {} }
        ]
    };
    MODES.riemann = {
        label: 'Riemann sums', icon: 'Δx',
        input: () => ({ label: 'f(x)', placeholder: 'e.g. x^2', hint: 'Visualise how left / right / midpoint / trapezoid / Simpson sums converge to the integral.' }),
        fields: [
            { key: 'lower', label: 'From a', type: 'text', def: '0' },
            { key: 'upper', label: 'To b', type: 'text', def: '1' },
            { key: 'n', label: 'Subintervals n', type: 'number', def: '8', min: 1, max: 100000 },
            { key: 'rule', label: 'Rule', type: 'select', def: 'left', options: [['left', 'Left endpoints'], ['right', 'Right endpoints'], ['mid', 'Midpoint'], ['trap', 'Trapezoidal'], ['simpson', "Simpson's"]] }
        ],
        examples: [
            { label: 'x² on [0,1], left sum, n = 8', fn: 'x^2', opts: { lower: '0', upper: '1', n: '8', rule: 'left' } },
            { label: 'sin x on [0,π], midpoint, n = 10', fn: 'sin(x)', opts: { lower: '0', upper: 'pi', n: '10', rule: 'mid' } },
            { label: 'e^(−x²) on [−2,2], trapezoid, n = 12', fn: 'e^(-x^2)', opts: { lower: '-2', upper: '2', n: '12', rule: 'trap' } },
            { label: '1/x on [1,e], Simpson, n = 6', fn: '1/x', opts: { lower: '1', upper: 'e', n: '6', rule: 'simpson' } }
        ]
    };
    MODES.applications = {
        label: 'Area & volume', icon: 'V',
        input: () => ({ label: 'f(x)', placeholder: 'e.g. sqrt(x)', hint: 'Applications of integration. Add a second curve g(x) for areas between curves and washers.' }),
        fields: [
            { key: 'op', label: 'Quantity', type: 'select', def: 'area', options: [['area', 'Area between curves'], ['arclength', 'Arc length'], ['volumex', 'Volume – revolve about x-axis (disk/washer)'], ['volumey', 'Volume – revolve about y-axis (shells)'], ['surface', 'Surface area of revolution (x-axis)'], ['average', 'Average value & mean-value point']] },
            { key: 'g', label: 'Second curve g(x) (blank = 0)', type: 'text', def: '', placeholder: 'e.g. x^2', show: v => ['area', 'volumex', 'volumey'].includes(v.op) },
            { key: 'lower', label: 'From a', type: 'text', def: '0' },
            { key: 'upper', label: 'To b', type: 'text', def: '1' }
        ],
        examples: [
            { label: 'Area between y = x and y = x²', fn: 'x', opts: { op: 'area', g: 'x^2', lower: '0', upper: '1' } },
            { label: 'Area between sin x and cos x', fn: 'sin(x)', opts: { op: 'area', g: 'cos(x)', lower: '0', upper: 'pi' } },
            { label: 'Volume: revolve √x about the x-axis', fn: 'sqrt(x)', opts: { op: 'volumex', g: '', lower: '0', upper: '4' } },
            { label: 'Volume by shells: y = x(1−x)', fn: 'x*(1-x)', opts: { op: 'volumey', g: '', lower: '0', upper: '1' } },
            { label: 'Arc length of y = x²', fn: 'x^2', opts: { op: 'arclength', lower: '0', upper: '1' } },
            { label: 'Surface area: cone y = x', fn: 'x', opts: { op: 'surface', lower: '0', upper: '1' } },
            { label: 'Average value of x² on [0,3]', fn: 'x^2', opts: { op: 'average', lower: '0', upper: '3' } }
        ]
    };
    MODES.root = {
        label: 'Root finding', icon: 'x*',
        input: () => ({ label: 'f(x) = 0', placeholder: 'e.g. cos(x) - x', hint: "Solve f(x) = 0 iteratively and watch every step. Move terms to one side first." }),
        fields: [
            { key: 'method', label: 'Method', type: 'select', def: 'newton', options: [['newton', "Newton's method"], ['bisection', 'Bisection'], ['secant', 'Secant']] },
            { key: 'x0', label: 'Starting guess x₀', type: 'text', def: '1', show: v => v.method !== 'bisection' },
            { key: 'x1', label: 'Second guess x₁', type: 'text', def: '2', show: v => v.method === 'secant' },
            { key: 'a', label: 'Interval start a', type: 'text', def: '0', show: v => v.method === 'bisection' },
            { key: 'b', label: 'Interval end b', type: 'text', def: '2', show: v => v.method === 'bisection' },
            { key: 'steps', label: 'Max iterations', type: 'number', def: '12', min: 1, max: 60 }
        ],
        examples: [
            { label: "√2 by Newton: x² − 2", fn: 'x^2-2', opts: { method: 'newton', x0: '1', steps: '8' } },
            { label: 'Dottie number: cos x − x (bisection)', fn: 'cos(x)-x', opts: { method: 'bisection', a: '0', b: '1', steps: '40' } },
            { label: 'Secant on x³ − x − 2', fn: 'x^3-x-2', opts: { method: 'secant', x0: '1', x1: '2', steps: '12' } },
            { label: 'Newton failing: x² + 1', fn: 'x^2+1', opts: { method: 'newton', x0: '1', steps: '8' } }
        ]
    };
    MODES.fourier = {
        label: 'Fourier series', icon: '∼',
        input: () => ({ label: 'f(x) on one period', placeholder: 'e.g. x   or   sign(x)', hint: 'Fourier coefficients and the partial-sum approximation of a periodic extension.' }),
        fields: [
            { key: 'lower', label: 'Period starts at', type: 'text', def: '-pi' },
            { key: 'upper', label: 'Period ends at', type: 'text', def: 'pi' },
            { key: 'terms', label: 'Harmonics N (1–60)', type: 'number', def: '8', min: 1, max: 60 }
        ],
        examples: [
            { label: 'Square wave sign(x) – Gibbs phenomenon', fn: 'sign(x)', opts: { lower: '-pi', upper: 'pi', terms: '15' } },
            { label: 'Sawtooth f(x) = x', fn: 'x', opts: { lower: '-pi', upper: 'pi', terms: '10' } },
            { label: 'Triangle wave |x|', fn: 'abs(x)', opts: { lower: '-pi', upper: 'pi', terms: '6' } },
            { label: 'Parabola x² on [−π, π]', fn: 'x^2', opts: { lower: '-pi', upper: 'pi', terms: '5' } }
        ]
    };
    MODES.matrix = {
        label: 'Matrices', icon: '[ ]',
        input: () => ({ label: 'Matrix A  (rows separated by ; or new lines)', placeholder: 'e.g. 2 1 ; 1 3', hint: 'Entries may be numbers or expressions like pi/2. Up to 8×8.' }),
        fields: [
            { key: 'op', label: 'Operation', type: 'select', def: 'det', options: [['det', 'Determinant'], ['inverse', 'Inverse'], ['eigen', 'Eigenvalues & eigenvectors'], ['rank', 'Rank & row-reduced form'], ['rref', 'Reduced row echelon form'], ['transpose', 'Transpose'], ['trace', 'Trace'], ['charpoly', 'Characteristic polynomial'], ['solve', 'Solve A·x = b'], ['power', 'Matrix power Aⁿ'], ['lu', 'LU decomposition'], ['qr', 'QR decomposition'], ['cholesky', 'Cholesky decomposition'], ['svd', 'Singular value decomposition'], ['pinv', 'Pseudoinverse A⁺'], ['cond', 'Condition number'], ['nullspace', 'Null space'], ['colspace', 'Column space'], ['diagonalize', 'Diagonalise A = PDP⁻¹'], ['leastsquares', 'Least-squares A·x ≈ b']] },
            { key: 'b', label: 'Right-hand side b (column, rows split by ;)', type: 'text', def: '1 ; 2', show: v => v.op === 'solve' || v.op === 'leastsquares' },
            { key: 'power', label: 'Exponent n', type: 'number', def: '5', min: -20, max: 20, show: v => v.op === 'power' }
        ],
        examples: [
            { label: 'Determinant of a 3×3', fn: '2 0 1 ; 1 3 2 ; 1 1 4', opts: { op: 'det' } },
            { label: 'Inverse (exact fractions)', fn: '1 2 ; 3 4', opts: { op: 'inverse' } },
            { label: 'Eigenvalues of [[2,1],[1,2]]', fn: '2 1 ; 1 2', opts: { op: 'eigen' } },
            { label: 'Rank of a singular matrix', fn: '1 2 3 ; 4 5 6 ; 7 8 9', opts: { op: 'rank' } },
            { label: 'Solve a linear system', fn: '2 1 ; 1 3', opts: { op: 'solve', b: '3 ; 5' } },
            { label: 'Fibonacci via matrix power', fn: '1 1 ; 1 0', opts: { op: 'power', power: '10' } },
            { label: 'LU decomposition', fn: '4 3 ; 6 3', opts: { op: 'lu' } },
            { label: 'Singular values of a 3×2 matrix', fn: '1 2 ; 3 4 ; 5 6', opts: { op: 'svd' } },
            { label: 'Best-fit line (least squares)', fn: '1 1 ; 1 2 ; 1 3', opts: { op: 'leastsquares', b: '1 ; 2 ; 2' } },
            { label: 'Diagonalise a symmetric matrix', fn: '2 1 ; 1 2', opts: { op: 'diagonalize' } },
            { label: 'Null space of a singular matrix', fn: '1 2 3 ; 4 5 6 ; 7 8 9', opts: { op: 'nullspace' } }
        ]
    };


    MODES.calc = {
        label: 'Calculator', icon: '=',
        input: () => ({ label: 'Expressions  (one per line)', placeholder: 'e.g.  a = 3\nb = a^2 + 1\nsin(30 deg) * b', hint: 'A scientific calculator with variables, ans, exact fractions, π-recognition and integer facts.' }),
        fields: [],
        examples: [
            { label: 'Powers and roots', fn: '2^10 + sqrt(2)', opts: {} },
            { label: 'Variables across lines', fn: 'a = 3\nb = a^2 + 1\nsin(30 deg) * b', opts: {} },
            { label: 'Exact fractions: 1/3 + 1/6', fn: '1/3 + 1/6', opts: {} },
            { label: 'Prime factorisation of 360', fn: '360', opts: {} },
            { label: 'Complex numbers: sqrt(-4)', fn: 'sqrt(-4)', opts: {} },
            { label: 'Combinatorics: C(52,5)', fn: 'combinations(52, 5)', opts: {} }
        ]
    };
    MODES.solve = {
        label: 'Equation solver', icon: 'x=',
        input: () => ({ label: 'Equation or inequality', placeholder: 'e.g. x^2 - 5x + 6 = 0     or     (x-1)/(x+2) >= 0', hint: 'Polynomials give every root (real and complex); other equations are solved numerically. Use <, >, ≤, ≥ for inequalities.' }),
        fields: [
            { key: 'min', label: 'Search from x =', type: 'text', def: '-50' },
            { key: 'max', label: 'to x =', type: 'text', def: '50' }
        ],
        examples: [
            { label: 'Quadratic: x² − 5x + 6 = 0', fn: 'x^2 - 5x + 6 = 0', opts: { min: '-50', max: '50' } },
            { label: 'Complex roots: x² + 1 = 0', fn: 'x^2 + 1 = 0', opts: { min: '-50', max: '50' } },
            { label: 'Cubic: x³ − 2x = 0', fn: 'x^3 - 2x = 0', opts: { min: '-50', max: '50' } },
            { label: 'Transcendental: cos x = x', fn: 'cos(x) = x', opts: { min: '-5', max: '5' } },
            { label: 'Trig: sin x = 0.5 on [0, 7]', fn: 'sin(x) = 0.5', opts: { min: '0', max: '7' } },
            { label: 'e^x = 2x + 5', fn: 'e^x = 2*x + 5', opts: { min: '-5', max: '5' } },
            { label: 'Inequality: x² < 4', fn: 'x^2 < 4', opts: { min: '-50', max: '50' } },
            { label: 'Rational inequality', fn: '(x-1)/(x+2) >= 0', opts: { min: '-50', max: '50' } },
            { label: 'Cubic inequality', fn: 'x^3 - x <= 0', opts: { min: '-50', max: '50' } }
        ]
    };
    MODES.sums = {
        label: 'Sums & series', icon: 'Σk',
        input: () => ({ label: 'Term  tₖ  (variable k or n)', placeholder: 'e.g. 1/k^2', hint: 'Finite sums are exact when possible. Infinite series are tested for convergence (nth-term, ratio, p-series, alternating) and summed accurately.' }),
        fields: [
            { key: 'lower', label: 'Start index', type: 'text', def: '1' },
            { key: 'upper', label: 'End index (inf = infinite, or n for a closed form)', type: 'text', def: 'inf' }
        ],
        examples: [
            { label: 'Basel problem: Σ 1/k²', fn: '1/k^2', opts: { lower: '1', upper: 'inf' } },
            { label: 'Geometric: Σ (1/2)^k', fn: '1/2^k', opts: { lower: '0', upper: 'inf' } },
            { label: 'Alternating harmonic', fn: '(-1)^k/k', opts: { lower: '1', upper: 'inf' } },
            { label: 'Harmonic series (diverges)', fn: '1/k', opts: { lower: '1', upper: 'inf' } },
            { label: 'Telescoping: Σ 1/(k(k+1))', fn: '1/(k*(k+1))', opts: { lower: '1', upper: 'inf' } },
            { label: 'Σ 1/k! = e', fn: '1/factorial(k)', opts: { lower: '0', upper: 'inf' } },
            { label: 'Finite: Σ k² from 1 to 100', fn: 'k^2', opts: { lower: '1', upper: '100' } },
            { label: 'Ratio test: Σ k/2^k', fn: 'k/2^k', opts: { lower: '1', upper: 'inf' } },
            { label: 'Closed form: Σ k² from 1 to n', fn: 'k^2', opts: { lower: '1', upper: 'n' } },
            { label: 'Closed form: Σ k·2^k', fn: 'k*2^k', opts: { lower: '1', upper: 'n' } },
            { label: 'Closed form: Σ (2k−1) from 1 to 2n', fn: '2*k-1', opts: { lower: '1', upper: '2*n' } }
        ]
    };


    MODES.laplace = {
        label: 'Transforms', icon: 'ℒ',
        input: v => ({ laplace: { label: 'f(t)', placeholder: 'e.g. t^2*exp(-3t)*cos(2t)', hint: 'Laplace transform of sums and products of polynomials, exponentials, sin, cos, sinh and cosh.' }, inverse: { label: 'F(s)', placeholder: 'e.g. (s+3)/(s^2+2s+5)', hint: 'A proper rational function of s: partial fractions with complex and repeated poles.' }, fourier: { label: 'f(t)', placeholder: 'e.g. exp(-abs(t))', hint: 'Fourier transform F(ω) = ∫ f(t)e^(−iωt) dt of an absolutely integrable function.' }, ode: { label: 'Forcing function f(t)', placeholder: 'e.g. exp(-t)   (0 for a homogeneous equation)', hint: 'Solves y″ + a·y′ + b·y = f(t) (or y′ + a·y = f(t)) with initial values, using the Laplace transform.' } }[v.op || 'laplace']),
        fields: [
            { key: 'op', label: 'Transform', type: 'select', def: 'laplace', options: [['laplace', 'Laplace  ℒ{f(t)}  (u(t−a) and dirac(t−a) allowed)'], ['inverse', 'Inverse Laplace  ℒ⁻¹{F(s)}'], ['fourier', 'Fourier transform'], ['ode', 'Solve an ODE with Laplace']] },
            { key: 'order', label: 'Order of the ODE', type: 'select', def: '2', options: [['2', 'Second order  y″ + a y′ + b y = f'], ['1', 'First order  y′ + a y = f']], show: v => v.op === 'ode' },
            { key: 'a', label: 'a (coefficient of y′)', type: 'text', def: '3', show: v => v.op === 'ode' },
            { key: 'b', label: 'b (coefficient of y)', type: 'text', def: '2', show: v => v.op === 'ode' && v.order !== '1' },
            { key: 'y0', label: 'y(0)', type: 'text', def: '1', show: v => v.op === 'ode' },
            { key: 'v0', label: 'y′(0)', type: 'text', def: '0', show: v => v.op === 'ode' && v.order !== '1' }
        ],
        examples: [
            { label: 'ℒ{t²·e^(−3t)}', fn: 't^2*exp(-3t)', opts: { op: 'laplace' } },
            { label: 'ℒ{e^(−t)·cos 2t + 3}', fn: 'exp(-t)*cos(2t)+3', opts: { op: 'laplace' } },
            { label: 'ℒ{sin 2t · cos t}', fn: 'sin(2t)*cos(t)', opts: { op: 'laplace' } },
            { label: 'ℒ⁻¹{(s+3)/(s²+2s+5)}', fn: '(s+3)/(s^2+2s+5)', opts: { op: 'inverse' } },
            { label: 'ℒ⁻¹{1/(s(s+1)²)} (repeated pole)', fn: '1/(s*(s+1)^2)', opts: { op: 'inverse' } },
            { label: 'Fourier: e^(−|t|)', fn: 'exp(-abs(t))', opts: { op: 'fourier' } },
            { label: 'Fourier: Gaussian e^(−t²/2)', fn: 'exp(-t^2/2)', opts: { op: 'fourier' } },
            { label: 'Fourier: 1/(1+t²)', fn: '1/(1+t^2)', opts: { op: 'fourier' } },
            { label: 'ℒ{(t−2)·u(t−2)} (delayed ramp)', fn: 'u(t-2)*(t-2)', opts: { op: 'laplace' } },
            { label: 'ℒ{1 − u(t−3)} (a pulse)', fn: '1 - u(t-3)', opts: { op: 'laplace' } },
            { label: 'ℒ{t·u(t−1) + 2δ(t−2)}', fn: 't*u(t-1) + 2*dirac(t-2)', opts: { op: 'laplace' } },
            { label: 'ODE: y″ + 3y′ + 2y = 0, y(0)=1', fn: '0', opts: { op: 'ode', order: '2', a: '3', b: '2', y0: '1', v0: '0' } },
            { label: 'ODE: resonance y″ + 4y = cos 2t', fn: 'cos(2t)', opts: { op: 'ode', order: '2', a: '0', b: '4', y0: '0', v0: '0' } },
            { label: 'ODE: y′ + 2y = 1, y(0)=3', fn: '1', opts: { op: 'ode', order: '1', a: '2', b: '0', y0: '3', v0: '0' } }
        ]
    };
    MODES.vector = {
        label: 'Vector calculus', icon: '∮',
        input: v => ({ jacobian: { label: 'F = (F₁ ; F₂ ; …)', placeholder: 'e.g. x^2*y ; sin(x)+z', hint: 'Components separated by ;  The Jacobian holds every partial derivative ∂Fᵢ/∂xⱼ.' }, line: { label: 'Scalar field f(x, y, z)', placeholder: 'e.g. x^2 + y^2', hint: 'Integrates f along the path with ds = |r′(t)| dt.' }, work: { label: 'Vector field F = (P ; Q ; R)', placeholder: 'e.g. -y ; x', hint: 'Work / circulation ∫ F·dr along the path r(t).' }, triple: { label: 'f(x, y, z)', placeholder: 'e.g. x*y*z', hint: 'Iterated triple integral: z is innermost, then y, then x.' }, green: { label: 'F = (P ; Q)', placeholder: 'e.g. -y ; x', hint: "Compares ∮ P dx + Q dy with ∬ (Qₓ − Pᵧ) dA over the region between two curves y = g₁(x) and y = g₂(x)." }, divergence: { label: 'F = (P ; Q ; R)', placeholder: 'e.g. x ; y ; z', hint: 'Compares ∭ div F dV with the outward flux through the six faces of a box.' }, surface: { label: 'Scalar field f(x, y, z)', placeholder: 'e.g. 1  (area)   or   z^2', hint: 'Integrates f over the parametrised surface r(u, v). Use f = 1 for surface area.' }, flux: { label: 'F = (P ; Q ; R)', placeholder: 'e.g. x ; y ; z', hint: 'Flux through r(u, v) with normal rᵤ × rᵥ.' } }[v.op || 'jacobian']),
        fields: [
            { key: 'op', label: 'Operation', type: 'select', def: 'jacobian', options: [['jacobian', 'Jacobian matrix & determinant'], ['line', 'Line integral of a scalar field ∫ f ds'], ['work', 'Work / circulation ∫ F·dr'], ['triple', 'Triple integral ∭ f dV'], ['green', "Green's theorem (both sides)"], ['divergence', 'Divergence theorem on a box (both sides)'], ['surface', 'Surface integral ∬ f dS'], ['flux', 'Flux ∬ F·n dS through r(u, v)']] },
            { key: 'vars', label: 'Variables (comma-separated, blank = auto)', type: 'text', def: '', placeholder: 'x, y, z', show: v => v.op === 'jacobian' || v.op === 'triple' },
            { key: 'point', label: 'Evaluate at point (optional)', type: 'text', def: '', placeholder: 'e.g. 1, 2', show: v => v.op === 'jacobian' },
            { key: 'px', label: 'x(t) =', type: 'text', def: 'cos(t)', show: v => v.op === 'line' || v.op === 'work' },
            { key: 'py', label: 'y(t) =', type: 'text', def: 'sin(t)', show: v => v.op === 'line' || v.op === 'work' },
            { key: 'pz', label: 'z(t) = (optional)', type: 'text', def: '', show: v => v.op === 'line' || v.op === 'work' },
            { key: 'ta', label: 't from', type: 'text', def: '0', show: v => v.op === 'line' || v.op === 'work' },
            { key: 'tb', label: 't to', type: 'text', def: '2*pi', show: v => v.op === 'line' || v.op === 'work' },
            { key: 'xLow', label: 'x from', type: 'text', def: '0', show: v => ['triple', 'green', 'divergence'].includes(v.op) }, { key: 'xHigh', label: 'x to', type: 'text', def: '1', show: v => ['triple', 'green', 'divergence'].includes(v.op) },
            { key: 'yLow', label: 'y from (may use x)', type: 'text', def: '0', show: v => ['triple', 'green', 'divergence'].includes(v.op) }, { key: 'yHigh', label: 'y to (may use x)', type: 'text', def: 'x', show: v => ['triple', 'green', 'divergence'].includes(v.op) },
            { key: 'zLow', label: 'z from (may use x, y)', type: 'text', def: '0', show: v => ['triple', 'divergence'].includes(v.op) }, { key: 'zHigh', label: 'z to (may use x, y)', type: 'text', def: 'x+y', show: v => ['triple', 'divergence'].includes(v.op) },
            { key: 'sx', label: 'x(u, v) =', type: 'text', def: 'sin(u)*cos(v)', show: v => v.op === 'surface' || v.op === 'flux' }, { key: 'sy', label: 'y(u, v) =', type: 'text', def: 'sin(u)*sin(v)', show: v => v.op === 'surface' || v.op === 'flux' }, { key: 'sz', label: 'z(u, v) =', type: 'text', def: 'cos(u)', show: v => v.op === 'surface' || v.op === 'flux' },
            { key: 'ua', label: 'u from', type: 'text', def: '0', show: v => v.op === 'surface' || v.op === 'flux' }, { key: 'ub', label: 'u to', type: 'text', def: 'pi', show: v => v.op === 'surface' || v.op === 'flux' }, { key: 'va', label: 'v from', type: 'text', def: '0', show: v => v.op === 'surface' || v.op === 'flux' }, { key: 'vb', label: 'v to', type: 'text', def: '2*pi', show: v => v.op === 'surface' || v.op === 'flux' }
        ],
        examples: [
            { label: 'Jacobian of polar → Cartesian', fn: 'r*cos(t) ; r*sin(t)', opts: { op: 'jacobian', vars: 'r, t', point: '' } },
            { label: 'Jacobian of a 3-D map at a point', fn: 'x^2*y ; sin(x)+z ; x*y*z', opts: { op: 'jacobian', vars: '', point: '1, 2, 3' } },
            { label: '∮ (x²+y²) ds around the unit circle', fn: 'x^2+y^2', opts: { op: 'line', px: 'cos(t)', py: 'sin(t)', pz: '', ta: '0', tb: '2*pi' } },
            { label: 'Circulation of (−y, x) on the unit circle', fn: '-y ; x', opts: { op: 'work', px: 'cos(t)', py: 'sin(t)', pz: '', ta: '0', tb: '2*pi' } },
            { label: 'Work of (xy, x+y) along y = x²', fn: 'x*y ; x+y', opts: { op: 'work', px: 't', py: 't^2', pz: '', ta: '0', tb: '1' } },
            { label: 'Line integral along a helix', fn: 'z', opts: { op: 'line', px: 'cos(t)', py: 'sin(t)', pz: 't', ta: '0', tb: 'pi' } },
            { label: '∭ xyz over a tetrahedron-like region', fn: 'x*y*z', opts: { op: 'triple', vars: 'x, y, z', xLow: '0', xHigh: '1', yLow: '0', yHigh: 'x', zLow: '0', zHigh: 'x+y' } },
            { label: "Green's theorem: circulation of (−y, x)", fn: '-y ; x', opts: { op: 'green', xLow: '0', xHigh: '2', yLow: 'x^2/4', yHigh: 'x' } },
            { label: 'Divergence theorem on a box', fn: 'x*y ; y*z ; z*x', opts: { op: 'divergence', xLow: '0', xHigh: '2', yLow: '-1', yHigh: '1', zLow: '1', zHigh: '3' } },
            { label: 'Surface area of the unit sphere', fn: '1', opts: { op: 'surface', sx: 'sin(u)*cos(v)', sy: 'sin(u)*sin(v)', sz: 'cos(u)', ua: '0', ub: 'pi', va: '0', vb: '2*pi' } },
            { label: 'Flux of (x, y, z) through the unit sphere', fn: 'x ; y ; z', opts: { op: 'flux', sx: 'sin(u)*cos(v)', sy: 'sin(u)*sin(v)', sz: 'cos(u)', ua: '0', ub: 'pi', va: '0', vb: '2*pi' } },
            { label: 'Area of a paraboloid patch', fn: '1', opts: { op: 'surface', sx: 'u', sy: 'v', sz: 'u^2+v^2', ua: '-1', ub: '1', va: '-1', vb: '1' } },
            { label: 'Volume of the unit ball', fn: '1', opts: { op: 'triple', vars: 'x, y, z', xLow: '-1', xHigh: '1', yLow: '-sqrt(1-x^2)', yHigh: 'sqrt(1-x^2)', zLow: '-sqrt(1-x^2-y^2)', zHigh: 'sqrt(1-x^2-y^2)' } }
        ]
    };
    MODES.stats = {
        label: 'Statistics', icon: 'x̄',
        input: v => ({ describe: { label: 'Data', placeholder: 'e.g. 2 4 4 4 5 5 7 9', hint: 'Numbers separated by spaces, commas or new lines.' }, regression: { label: 'Data points (x y pairs)', placeholder: 'e.g. 1 2.1 ; 2 3.9 ; 3 6.2 ; 4 7.8', hint: 'Pairs separated by ;  or a flat list x₁ y₁ x₂ y₂ …' }, dist: { label: 'x  (or  a, b  for an interval)', placeholder: 'e.g. 1.96', hint: 'Value(s) at which to evaluate the distribution; for “inverse” enter a probability.' }, ttest: { label: 'Sample', placeholder: 'e.g. 5.1 4.9 5.6 5.8 6.0', hint: 'One sample against μ₀, or add a second sample below for Welch’s test.' } }[v.op || 'describe']),
        fields: [
            { key: 'op', label: 'Tool', type: 'select', def: 'describe', options: [['describe', 'Descriptive statistics'], ['regression', 'Regression & curve fitting'], ['dist', 'Probability distributions'], ['ttest', 't-tests & confidence intervals']] },
            { key: 'model', label: 'Model', type: 'select', def: 'linear', options: [['linear', 'Linear'], ['quadratic', 'Quadratic'], ['cubic', 'Cubic'], ['exponential', 'Exponential  A·e^(Bx)'], ['power', 'Power  A·x^B'], ['logarithmic', 'Logarithmic  a + b·ln x']], show: v => v.op === 'regression' },
            { key: 'predict', label: 'Predict y at x = (optional)', type: 'text', def: '', show: v => v.op === 'regression' },
            { key: 'dist', label: 'Distribution', type: 'select', def: 'normal', options: [['normal', 'Normal (μ, σ)'], ['t', "Student's t (ν)"], ['chisq', 'Chi-square (k)'], ['exponential', 'Exponential (λ)'], ['uniform', 'Uniform (a, b)'], ['binomial', 'Binomial (n, p)'], ['poisson', 'Poisson (λ)']], show: v => v.op === 'dist' },
            { key: 'params', label: 'Parameters (comma-separated)', type: 'text', def: '0, 1', placeholder: 'μ, σ', show: v => v.op === 'dist' },
            { key: 'what', label: 'Calculate', type: 'select', def: 'le', options: [['le', 'P(X ≤ x)'], ['ge', 'P(X ≥ x)'], ['between', 'P(a ≤ X ≤ b)'], ['pdf', 'Density / probability at x'], ['inv', 'Inverse: x for a given probability']], show: v => v.op === 'dist' },
            { key: 'mu0', label: 'Hypothesised mean μ₀', type: 'text', def: '0', show: v => v.op === 'ttest' },
            { key: 'data2', label: 'Second sample (optional – Welch test)', type: 'text', def: '', show: v => v.op === 'ttest' },
            { key: 'alpha', label: 'Significance level α', type: 'text', def: '0.05', show: v => v.op === 'ttest' }
        ],
        examples: [
            { label: 'Summary of a data set', fn: '2 4 4 4 5 5 7 9', opts: { op: 'describe' } },
            { label: 'Linear regression with prediction', fn: '1 2.1 ; 2 3.9 ; 3 6.2 ; 4 7.8 ; 5 10.1', opts: { op: 'regression', model: 'linear', predict: '6' } },
            { label: 'Exponential growth fit', fn: '0 1.1 ; 1 2.7 ; 2 7.4 ; 3 20 ; 4 54.6', opts: { op: 'regression', model: 'exponential', predict: '' } },
            { label: 'Normal: P(Z ≤ 1.96)', fn: '1.96', opts: { op: 'dist', dist: 'normal', params: '0, 1', what: 'le' } },
            { label: 'Normal: 97.5th percentile', fn: '0.975', opts: { op: 'dist', dist: 'normal', params: '0, 1', what: 'inv' } },
            { label: 'Binomial: P(X ≤ 3), n = 10, p = ½', fn: '3', opts: { op: 'dist', dist: 'binomial', params: '10, 0.5', what: 'le' } },
            { label: 'One-sample t-test against μ₀ = 5', fn: '5.1 4.9 5.6 5.8 6.0 5.2 5.9', opts: { op: 'ttest', mu0: '5', data2: '', alpha: '0.05' } },
            { label: 'Welch two-sample test', fn: '5.1 4.9 5.6 5.8 6.0', opts: { op: 'ttest', mu0: '0', data2: '4.1 4.4 3.9 4.8 4.5', alpha: '0.05' } }
        ]
    };
    const NUM_HELP = { factor: ['Integer n', '360', 'Prime factorisation, divisors, φ(n) and σ(n).'], isprime: ['Integer n', '1000000007', 'Deterministic Miller–Rabin.'], gcd: ['Integers (comma-separated)', '48, 18', 'Two or more numbers; two numbers also give the Bézout identity.'], lcm: ['Integers (comma-separated)', '12, 18, 30', 'Least common multiple.'], modinv: ['a, m', '3, 11', 'Inverse of a modulo m.'], powmod: ['a, e, m', '2, 100, 13', 'a^e mod m by square-and-multiply.'], totient: ['Integer n', '360', 'Euler’s totient φ(n).'], ncr: ['n, k', '10, 3', 'Number of combinations C(n, k).'], npr: ['n, k', '10, 3', 'Number of permutations P(n, k).'], fib: ['Index n', '100', 'The n-th Fibonacci number (exact).'], primes: ['Limit n', '100', 'All primes up to n (sieve of Eratosthenes).'], base: ['n, base', '255, 2', 'Convert n to another base (2–36).'], crt: ['Congruences  a mod m ; …', '2 mod 3 ; 3 mod 5 ; 2 mod 7', 'Chinese remainder theorem.'] };
    MODES.number = {
        label: 'Number theory', icon: '#',
        input: v => { const a = NUM_HELP[v.op || 'factor']; return { label: a[0], placeholder: 'e.g. ' + a[1], hint: a[2] }; },
        fields: [{ key: 'op', label: 'Operation', type: 'select', def: 'factor', options: [['factor', 'Prime factorisation'], ['isprime', 'Primality test'], ['gcd', 'GCD (+ Bézout)'], ['lcm', 'LCM'], ['modinv', 'Modular inverse'], ['powmod', 'Modular exponentiation'], ['totient', "Euler's totient φ(n)"], ['ncr', 'Combinations C(n, k)'], ['npr', 'Permutations P(n, k)'], ['fib', 'Fibonacci number'], ['primes', 'Primes up to n'], ['base', 'Base conversion'], ['crt', 'Chinese remainder theorem']] }],
        examples: [
            { label: 'Factorise 360', fn: '360', opts: { op: 'factor' } },
            { label: 'Factorise 600851475143', fn: '600851475143', opts: { op: 'factor' } },
            { label: 'Is 10⁹+7 prime?', fn: '1000000007', opts: { op: 'isprime' } },
            { label: 'gcd(48, 18) with Bézout', fn: '48, 18', opts: { op: 'gcd' } },
            { label: '3⁻¹ mod 11', fn: '3, 11', opts: { op: 'modinv' } },
            { label: '2¹⁰⁰ mod 13', fn: '2, 100, 13', opts: { op: 'powmod' } },
            { label: 'C(52, 5) poker hands', fn: '52, 5', opts: { op: 'ncr' } },
            { label: 'Fibonacci F(200)', fn: '200', opts: { op: 'fib' } },
            { label: 'Chinese remainder theorem', fn: '2 mod 3 ; 3 mod 5 ; 2 mod 7', opts: { op: 'crt' } }
        ]
    };
    MODES.units = {
        label: 'Units', icon: '⇄',
        input: () => ({ label: 'Quantity and target', placeholder: 'e.g. 5 km/h to m/s', hint: 'Length, mass, time, temperature (degC, degF, K), speed, area, volume, energy, power, pressure … with + − × ÷ and “to”.' }),
        fields: [],
        examples: [
            { label: '5 km/h → m/s', fn: '5 km/h to m/s', opts: {} }, { label: '72 °F → °C', fn: '72 degF to degC', opts: {} }, { label: '100 mph → km/h', fn: '100 mph to km/h', opts: {} },
            { label: '3 h 20 min → seconds', fn: '3 hours + 20 minutes to seconds', opts: {} }, { label: '1 mile → km', fn: '1 mile to km', opts: {} }, { label: '2.5 L → US gallons', fn: '2.5 liter to gallon', opts: {} },
            { label: '1 atm → psi', fn: '1 atm to psi', opts: {} }, { label: '500 kcal → kJ', fn: '500 kcal to kJ', opts: {} }
        ]
    };
    MODES.complex = {
        label: 'Complex', icon: 'ℂ',
        input: v => ({ domain: { label: 'f(z)', placeholder: 'e.g. (z^2-1)/(z^2+1)', hint: 'Domain colouring shows the argument of f(z) as hue; zeros and poles are marked for rational functions.' }, roots: { label: 'Polynomial p(z)', placeholder: 'e.g. z^4 - 1', hint: 'All complex roots with multiplicity, plotted in the complex plane.' }, arith: { label: 'Complex expression', placeholder: 'e.g. (3+4i)*(1-2i)/(2+i)', hint: 'Use i for the imaginary unit. Gives rectangular and polar form, roots and the Argand diagram.' } }[v.op || 'domain']),
        fields: [
            { key: 'op', label: 'Tool', type: 'select', def: 'domain', options: [['domain', 'Domain colouring of f(z)'], ['roots', 'Roots of a polynomial'], ['arith', 'Complex arithmetic & polar form']] },
            { key: 'range', label: 'Window half-width', type: 'text', def: '2', show: v => v.op === 'domain' },
            { key: 'nth', label: 'Show n-th roots, n =', type: 'number', def: '3', min: 2, max: 12, show: v => v.op === 'arith' }
        ],
        examples: [
            { label: 'Domain colouring: (z²−1)/(z²+1)', fn: '(z^2-1)/(z^2+1)', opts: { op: 'domain', range: '2' } },
            { label: 'Domain colouring: sin z', fn: 'sin(z)', opts: { op: 'domain', range: '5' } },
            { label: 'Domain colouring: eᶻ', fn: 'exp(z)', opts: { op: 'domain', range: '4' } },
            { label: 'Roots of z⁴ − 1', fn: 'z^4-1', opts: { op: 'roots' } },
            { label: 'Roots of z⁵ + 3z + 1', fn: 'z^5+3z+1', opts: { op: 'roots' } },
            { label: '(3+4i)(1−2i)/(2+i)', fn: '(3+4i)*(1-2i)/(2+i)', opts: { op: 'arith', nth: '3' } }
        ]
    };

    const MODE_GROUPS = [
        ['Core calculus', ['derivative', 'integral', 'limit', 'series', 'analysis']],
        ['Explore & visualise', ['graph', 'riemann', 'applications', 'root', 'fourier']],
        ['Algebra & sums', ['calc', 'solve', 'sums', 'number', 'units', 'stats']],
        ['Advanced', ['ode', 'multivariable', 'vector', 'matrix', 'laplace', 'complex']]
    ];
    const MODE_ORDER = MODE_GROUPS.flatMap(g => g[1]);
    const MODE_DESC = {
        derivative: 'Rules, steps, tangent', integral: 'Symbolic, definite, improper', limit: 'Two-sided & at ∞', series: 'Taylor / Maclaurin', analysis: 'Roots, extrema, asymptotes',
        graph: 'Sliders & intersections', riemann: 'Left, mid, trap, Simpson', applications: 'Area, volume, arc length', root: 'Newton, bisection, secant', fourier: 'Coefficients & Gibbs',
        calc: 'Variables, exact, ans', solve: 'Equations & inequalities', sums: 'Convergence tests', ode: 'Closed form + RK45', multivariable: '∇, Hessian, ∬, curl', matrix: 'det, inverse, eigen, SVD, LU, QR',
        laplace: 'Laplace, inverse, Fourier', vector: 'Jacobian, ∮, work, ∭', stats: 'Describe, fit, distributions', number: 'Factor, gcd, mod, CRT', units: 'Convert anything', complex: 'Domain colouring, roots'
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
        busy: false,
        paramVals: {},
        paramKey: null,
        playing: null
    };
    Object.keys(MODES).forEach(m => {
        state.opts[m] = {};
        MODES[m].fields.forEach(f => { state.opts[m][f.key] = f.def; });
    });

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    // ------------------------------------------------------------------
    // Icons: one consistent stroke-icon set instead of emoji
    // ------------------------------------------------------------------
    const ICON = {
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
        help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5M12 17.5h.01"/>',
        download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
        play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
        trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/>',
        copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
        tex: '<path d="M4 6h8M8 6v12M14 10l6 8M20 10l-6 8"/>',
        link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
        bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
        file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
        camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
        keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
        chart: '<path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/>',
        cube: '<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/>',
        list: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
        grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
        sliders: '<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        check: '<path d="m5 12 5 5 9-10"/>',
        shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
        alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
        info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7.5h.01"/>',
        bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
        palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2.2-.5-1.2.3-2.3 1.6-2.3H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
        sparkle: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
        wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01"/>',
        cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
        x: '<path d="M6 6l12 12M18 6 6 18"/>',
        compass: '<circle cx="12" cy="12" r="10"/><path d="m16 8-2 6-6 2 2-6z"/>',
        command: '<path d="M9 9V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/>'
    };
    const icon = (name, size) => `<svg class="ico" width="${size || 18}" height="${size || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ''}</svg>`;
    function hydrateIcons(root) { (root || document).querySelectorAll('[data-icon]:not([data-done])').forEach(el => { el.innerHTML = icon(el.dataset.icon, +el.dataset.size || 18); el.dataset.done = '1'; }); }

    const digits = () => parseInt($('precision').value, 10) || 6;
    const resolution = () => parseInt($('resolution').value, 10) || 400;
    const isDark = () => document.body.classList.contains('dark');

    function toast(msg, kind) {
        const t = document.createElement('div');
        t.className = 'toast ' + (kind || '');
        t.innerHTML = icon(kind === 'err' ? 'alert' : 'check', 16) + '<span></span>';
        t.lastChild.textContent = msg;
        t.setAttribute('role', 'status');
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
    }

    // ------------------------------------------------------------------
    // Theme
    // ------------------------------------------------------------------
    const ACCENTS = [['indigo', '#6366f1'], ['violet', '#8b5cf6'], ['cyan', '#06b6d4'], ['emerald', '#10b981'], ['amber', '#f59e0b'], ['rose', '#f43f5e']];
    const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };
    let themeMode = 'auto';

    function applyTheme(dark, persistMode) {
        document.body.classList.toggle('dark', dark);
        $('themeToggle').innerHTML = icon(dark ? 'moon' : 'sun');
        $('themeToggle').setAttribute('aria-pressed', String(dark));
        document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#0b0d16' : '#6366f1');
        if (persistMode) { themeMode = persistMode; store.set('themeMode', persistMode); store.set('theme', dark ? 'dark' : 'light'); }
        document.querySelectorAll('#themeSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.theme === themeMode)));
    }
    function systemDark() { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
    function setThemeMode(mode) { applyTheme(mode === 'auto' ? systemDark() : mode === 'dark', mode); refreshActivePlot(); }
    function setAccent(name) {
        if (name === 'indigo') document.body.removeAttribute('data-accent'); else document.body.setAttribute('data-accent', name);
        store.set('accent', name);
        document.querySelectorAll('.swatch').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.accent === name)));
        requestAnimationFrame(moveIndicator);
        refreshActivePlot();
    }
    function initTeaching() {
        const t = $('teachToggle'); if (!t) return;
        let on = false; try { on = localStorage.getItem('cs_teaching') === '1'; } catch (e) { /* blocked */ }
        document.body.classList.toggle('teaching', on); t.checked = on;
        t.addEventListener('change', () => { document.body.classList.toggle('teaching', t.checked); try { localStorage.setItem('cs_teaching', t.checked ? '1' : '0'); } catch (e) { /* blocked */ } if (state.result) { state.stepsShown = 1; displayResult(state.result); } });
    }
    function initTheme() {
        const legacy = store.get('theme');
        themeMode = store.get('themeMode') || (legacy ? legacy : 'auto');
        applyTheme(themeMode === 'auto' ? systemDark() : themeMode === 'dark', null);
        if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (themeMode === 'auto') { applyTheme(systemDark()); refreshActivePlot(); } });
        $('themeToggle').addEventListener('click', () => setThemeMode(isDark() ? 'light' : 'dark'));
        $('accentSwatches').innerHTML = ACCENTS.map(([n, c]) => `<button class="swatch" type="button" data-accent="${n}" style="background:${c}" aria-label="${n} accent" title="${n}" aria-pressed="false"></button>`).join('');
        $('accentSwatches').querySelectorAll('.swatch').forEach(b => b.addEventListener('click', () => setAccent(b.dataset.accent)));
        document.querySelectorAll('#themeSeg button').forEach(b => b.addEventListener('click', () => setThemeMode(b.dataset.theme)));
        setAccent(store.get('accent') || 'indigo');
        const pop = $('appearPop'), btn = $('appearBtn');
        const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
        btn.addEventListener('click', e => { e.stopPropagation(); pop.hidden = !pop.hidden; btn.setAttribute('aria-expanded', String(!pop.hidden)); });
        document.addEventListener('click', e => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) close(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) { close(); btn.focus(); } });
        applyTheme(isDark());
    }

    // sliding tab indicator
    function moveIndicator() {
        const act = document.querySelector('.tab.active'), ind = $('tabIndicator');
        if (!act || !ind) return;
        ind.style.width = act.offsetWidth + 'px';
        ind.style.transform = `translateX(${act.offsetLeft - 5}px)`;
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
        $('optionsPanel').hidden = !html;
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
        document.querySelectorAll('.mode-btn').forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
        renderOptions();
        updateInputLabels();
        renderExamples();
        if (!keepInput) validateInput();
        saveSession();
        updateModeToggle();
    }

    // ---- phones: collapsible tool list + bottom jump bar ----
    const isPhone = () => window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
    function setToolsOpen(open) { const g = $('modeGrid'), t = $('modeToggle'); if (!g || !t) return; g.classList.toggle('collapsed', !open); t.setAttribute('aria-expanded', String(open)); }
    function updateModeToggle() { const n = $('modeToggleName'); if (n && MODES[state.mode]) n.textContent = MODES[state.mode].label; }
    function initPhoneLayout() {
        const t = $('modeToggle'); if (!t) return;
        t.addEventListener('click', () => setToolsOpen($('modeGrid').classList.contains('collapsed')));
        $('modeGrid').addEventListener('click', e => { if (e.target.closest('.mode-btn') && isPhone()) setToolsOpen(false); });
        const apply = () => { if (isPhone()) { if (!state._phoneInit) { setToolsOpen(false); state._phoneInit = true; } } else { setToolsOpen(true); state._phoneInit = false; } };
        apply(); window.addEventListener('resize', apply); updateModeToggle();
        $('bottomNav').addEventListener('click', e => {
            const b = e.target.closest('[data-jump]'); if (!b) return; const w = b.dataset.jump;
            const smooth = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
            if (w === 'tools') { setToolsOpen(true); $('modeToggle').scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }); $('modeToggle').focus({ preventScroll: true }); }
            else if (w === 'input') { $('functionInput').scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' }); $('functionInput').focus({ preventScroll: true }); }
            else if (w === 'result') { document.querySelector('.workspace').scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }); }
            else window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
        });
    }

    function renderModeGrid() {
        $('modeGrid').innerHTML = MODE_GROUPS.map(([title, ids]) => `
            <div class="mode-group">${esc(title)}</div>
            <div class="mode-grid">${ids.map(id => `
                <button class="mode-btn" type="button" data-mode="${id}" aria-pressed="false" title="${esc(MODES[id].label)}${MODE_ORDER.indexOf(id) < 9 ? ' – Alt+' + (MODE_ORDER.indexOf(id) + 1) : ''}">
                    <span class="mode-ico">${esc(MODES[id].icon)}</span>
                    <span class="mode-txt"><b>${esc(MODES[id].label)}</b><small>${esc(MODE_DESC[id])}</small></span>
                </button>`).join('')}</div>`).join('');
        $('modeGrid').querySelectorAll('.mode-btn').forEach(b => b.addEventListener('click', () => { setMode(b.dataset.mode); $('functionInput').focus(); }));
    }

    function renderExamples() {
        const sel = $('examples');
        sel.innerHTML = '<option value="">Try an example…</option>' +
            MODES[state.mode].examples.map((e, i) => `<option value="${i}">${esc(e.label)}</option>`).join('');
    }

    function loadExample(i, mode) {
        if (mode && mode !== state.mode) setMode(mode, true);
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
        return state.mode === 'graph' || (state.mode === 'ode' && v.odeType === 'system') || (state.mode === 'multivariable' && VECTOR_OPS.includes(v.op));
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
            if (state.mode === 'calc' || state.mode === 'solve') {
                const lines = state.mode === 'calc' ? src.split(/\n/).map(l => l.trim()).filter(Boolean) : [src];
                if (state.mode === 'solve') {
                    const mm = /^(.*?)(<=|>=|≤|≥|<|>|=)(.*)$/s.exec(src);
                    const sides = mm ? [mm[1], mm[3]] : [src];
                    const infos2 = sides.map(x => engine.inspect(x));
                    preview.className = 'preview-box valid';
                    preview.innerHTML = `<span class="preview-tex">${texSpan(infos2.map(i => i.tex).join(mm ? ({ '<=': '\\le ', '>=': '\\ge ', '≤': '\\le ', '≥': '\\ge ' }[mm[2]] || mm[2]) : ''), src, false)}</span><span class="preview-meta">unknown: ${esc([...new Set(infos2.flatMap(i => i.vars))].join(', ') || '–')}</span>`;
                    renderTex(preview);
                    return true;
                }
                preview.className = 'preview-box valid';
                preview.innerHTML = `<span class="preview-tex plain">${esc(lines[0] || '')}</span><span class="preview-meta">${lines.length} line${lines.length === 1 ? '' : 's'}</span>`;
                return true;
            }
            if (['number', 'units', 'stats', 'vector'].includes(state.mode) || (state.mode === 'laplace' && /\b(dirac|delta|heaviside|unitstep|step|H|u)\s*\(/.test(src))) {
                preview.className = 'preview-box valid';
                const n = src.split(/[\n;]+/).filter(x => x.trim()).length;
                preview.innerHTML = `<span class="preview-tex plain">${esc(src.length > 160 ? src.slice(0, 160) + '…' : src)}</span><span class="preview-meta">${state.mode === 'stats' ? (src.split(/[\s,;]+/).filter(Boolean).length + ' values') : state.mode === 'vector' ? (n + ' component' + (n === 1 ? '' : 's')) : 'ready'}</span>`;
                return true;
            }
            if (state.mode === 'matrix') {
                const m = engine.run.matrix(src, { op: 'transpose' });
                preview.className = 'preview-box valid';
                preview.innerHTML = `<span class="preview-tex">${texSpan(m.items[0].tex, m.items[0].text, false)}</span><span class="preview-meta">${esc(m.meta[0] || '')}</span>`;
                renderTex(preview);
                return true;
            }
            const stripY = p => (state.mode === 'graph' ? p.replace(/^\s*(y|f\(x\)|g\(x\)|h\(x\))\s*=\s*/, '') : p);
            const parts = (multiPartMode() ? splitParts(src) : [src]).map(stripY);
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
            if (state.mode === 'graph') liveGraph();
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
        if ('variable' in vals) vals.variable = (vals.variable || '').trim() || undefined;
        void m;
        return vals;
    }

    /** Plain-English question → the right tool, filled in and run. */
    function askNL(text) {
        const note = $('askNote');
        const res = window.NL && window.NL.parse(text);
        if (!res || !MODES[res.mode]) { note.textContent = text.trim() ? 'I could not understand that. Try “integrate x squared from 0 to 3” or use a tool directly.' : 'Type a question first.'; note.classList.add('bad'); return; }
        note.classList.remove('bad');
        setMode(res.mode, true);
        const vals = currentValues();
        MODES[res.mode].fields.forEach(f => { vals[f.key] = f.def; });
        Object.assign(vals, res.opts);
        $('functionInput').value = res.fn;
        renderOptions(); updateInputLabels(); validateInput();
        note.textContent = 'Understood as: ' + res.say + ' – ' + res.fn;
        compute();
    }

    async function compute() {
        if (state.busy) { Runner.cancel(); return; }
        if (!validateInput()) { showError('Please enter a valid expression first.'); return; }
        const btn = $('computeBtn');
        state.busy = true;
        btn.classList.add('loading');
        btn.innerHTML = '<div class="spinner"></div><span>Cancel</span>';
        document.body.classList.add('busy');
        const t0 = performance.now();
        $('results').setAttribute('aria-busy', 'true');
        if (activeTab() === 'results') $('results').innerHTML = '<div class="skeleton"><i></i><i></i><i></i><i></i></div>';
        try {
            const src = $('functionInput').value;
            const mode = state.mode;
            const result = mode === 'graph' ? engine.run.graph(src.replace(/(^|[;\n])\s*(y|f\(x\))\s*=/g, '$1'), gatherOptions()) : await Runner.run(mode, src, gatherOptions());
            result.ms = Math.round(performance.now() - t0);
            result.engine = mode === 'graph' ? 'main thread' : (Runner.mode ? Runner.mode() : 'worker');
            state.result = result;
            resetParams(result);
            displayResult(result);
            switchTab(mode === 'graph' ? 'plot' : 'results');
            pushHistory(result);
            updateShareHash();
            prepareAuxiliaryTabs(result);
        } catch (err) {
            if (err.message !== 'Cancelled') showError(err.message, !err.user);
            else showError('Computation cancelled.');
        } finally {
            state.busy = false;
            btn.classList.remove('loading');
            btn.innerHTML = `${icon('play', 17)}<span>Compute</span><kbd>Ctrl ↵</kbd>`;
            document.body.classList.remove('busy');
            $('results').removeAttribute('aria-busy');
        }
    }

    function showError(message, unexpected) {
        $('results').innerHTML = `<div class="alert alert-error" role="alert"><span class="alert-icon">${icon('alert', 20)}</span><div><strong>${unexpected ? 'Unexpected error' : 'Could not compute'}</strong><br>${esc(message)}</div></div>`;
        switchTab('results');
    }

    // ------------------------------------------------------------------
    // Result rendering
    // ------------------------------------------------------------------
    const KIND_ICON = { derivative: '∂', integral: '∫', definite: '∫', series: 'Σ', limit: 'lim', analysis: 'f', ode: 'y′', multivariable: '∇', vector: '∇', graph: '∿', riemann: 'Δx', applications: 'V', root: 'x*', fourier: '∼', matrix: '[ ]', calc: '=', solve: 'x=', sum: 'Σk', laplace: 'ℒ', stats: 'x̄', number: '#', units: '⇄', complex: 'ℂ' };

    /** Metadata lines that are not already shown as trust badges. */
    function metaRest(r) { return r.meta.filter(m => !/^Method: /.test(m) && !/^Verified|cross-?checked|verified against/i.test(m)); }

    function displayResult(r) {
        const rows = r.items.map(i => `
            <div class="result-row">${i.tex && !i.inline ? '' : `<span class="row-label">${esc(i.label)}</span> `}${texSpan(i.tex, i.text, false)}</div>`).join('');
        const html = `
            <div class="result-card">
                <div class="result-kicker">${esc((MODES[state.mode] || {}).label || 'Result')}</div>
                <div class="result-title">
                    <div class="result-icon">${esc(KIND_ICON[r.kind] || '=')}</div>
                    <span>${esc(r.title)}</span>
                    <div class="result-actions">
                        <button class="mini-btn" data-act="copy" title="Copy result as text">${icon('copy', 14)}Copy</button>
                        <button class="mini-btn" data-act="copytex" title="Copy LaTeX">${icon('tex', 14)}LaTeX</button>
                        <button class="mini-btn" data-act="save" title="Save to your notebook">${icon('bookmark', 14)}Save</button>
                        <button class="mini-btn" data-act="share" title="Copy a link to this calculation">${icon('link', 14)}Share</button>
                        <button class="mini-btn" data-act="embed" title="Copy an embed code for a web page or LMS">${icon('link', 14)}Embed</button>
                        ${'speechSynthesis' in window ? `<button class="mini-btn" data-act="listen" title="Read the result aloud">${icon('sparkle', 14)}Listen</button>` : ''}
                        <button class="mini-btn" data-act="export" title="Download a Markdown report">${icon('file', 14)}Export</button>
                    </div>
                </div>
                ${r.main ? `<div class="result-content">${r.main.tex ? '' : `<span class="row-label">${esc(r.main.label)}</span> `}${texSpan(r.main.tex, r.main.text, true)}</div>` : ''}
                ${rows ? `<div class="result-rows">${rows}</div>` : ''}
                ${(r.badges && r.badges.length) ? `<div class="badges">${r.badges.map(b => `<span class="badge ${esc(b.kind)}">${icon(b.kind === 'ok' ? 'shield' : b.kind === 'warn' ? 'alert' : 'info', 14)}${esc(b.text)}</span>`).join('')}</div>` : ''}
                ${checkBox(r)}
                ${metaRest(r).length ? `<div class="result-meta">${metaRest(r).map(m => esc(m)).join('<br>')}</div>` : ''}
                ${r.warnings.map(w => `<div class="alert alert-warning"><span class="alert-icon">${icon('info', 18)}</span><span>${esc(w)}</span></div>`).join('')}
                <div class="result-foot"><span>${icon('bolt', 14)}${r.ms != null ? `${r.ms} ms` : 'instant'}</span><span>${icon('cpu', 14)}${esc(r.engine || 'worker')}</span><span>${icon('clock', 14)}${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></div>
            </div>`;
        const container = $('results');
        container.innerHTML = html;
        renderTex(container);
        container.querySelector('[data-act="copy"]').addEventListener('click', () => copyText(r.text, 'Result copied'));
        container.querySelector('[data-act="copytex"]').addEventListener('click', () => copyText(r.main && r.main.tex ? r.main.tex : r.text, 'LaTeX copied'));
        container.querySelector('[data-act="share"]').addEventListener('click', shareLink);
        container.querySelector('[data-act="save"]').addEventListener('click', saveToNotebook);
        container.querySelector('[data-act="export"]').addEventListener('click', exportReport);
        container.querySelector('[data-act="embed"]').addEventListener('click', embedCode);
        const lb = container.querySelector('[data-act="listen"]'); if (lb) lb.addEventListener('click', () => speakResult(r));
        applyPlotDescription(r);
        state.stepsShown = 1;
        applyTeachingToResult(container);
        displaySteps(r.steps);
    }

    function applyTeachingToResult(container) {
        if (!document.body.classList.contains('teaching')) return;
        const box = container.querySelector('.result-content'); if (!box) return;
        const rows = container.querySelector('.result-rows');
        box.classList.add('teach-hidden'); if (rows) rows.classList.add('teach-hidden');
        const btn = document.createElement('button'); btn.className = 'btn teach-show'; btn.type = 'button'; btn.textContent = 'Try it yourself first – show the answer';
        box.parentNode.insertBefore(btn, box);
        btn.addEventListener('click', () => { box.classList.remove('teach-hidden'); if (rows) rows.classList.remove('teach-hidden'); btn.remove(); });
    }

    function displaySteps(steps) {
        const el = $('steps');
        if (!steps || !steps.length) {
            el.classList.remove('show-timeline');
            el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${icon('list', 34)}</div><h3>No steps for this computation</h3><p>Try a different operation</p></div>`;
            return;
        }
        el.classList.add('show-timeline');
        const teaching = document.body.classList.contains('teaching');
        const shown = teaching ? Math.min(steps.length, state.stepsShown || 1) : steps.length;
        el.innerHTML = steps.slice(0, shown).map((s, i) => `
            <div class="step-card" style="--delay:${Math.min(i, 12) * 60}ms">
                <div class="step-header"><div class="step-number">${i + 1}</div><div class="step-title">${esc(s.title)}</div></div>
                <div class="step-content">${esc(s.text)}</div>
                ${s.tex ? `<div class="step-tex">${texSpan(s.tex, '', true)}</div>` : ''}
            </div>`).join('') + (teaching && shown < steps.length ? `<div class="teach-reveal"><button class="btn" type="button" id="revealNext">Reveal next step (${shown} of ${steps.length})</button><button class="mini-btn" type="button" id="revealAll">Show all</button></div>` : '');
        if (teaching && shown < steps.length) {
            $('revealNext').addEventListener('click', () => { state.stepsShown = shown + 1; displaySteps(steps); });
            $('revealAll').addEventListener('click', () => { state.stepsShown = steps.length; displaySteps(steps); });
        }
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
        moveIndicator();
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
    const COLORS = ['#d2501f', '#3a78c2', '#3f9a62', '#c48a1c', '#8a5cb5', '#7a8594'];

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

    /** Data-driven plots (statistics, transforms, complex plane …): traces come straight from the engine. */
    function renderGeneric(div, g) {
        const th = plotTheme();
        const ax = (title, extra) => Object.assign({ title, gridcolor: th.grid, zerolinecolor: th.zero, color: th.text }, extra || {});
        const layout = {
            title: { text: g.title || '', font: { size: 16, color: th.text } },
            xaxis: ax(g.xTitle, g.xRange ? { range: g.xRange } : (g.equal ? { constrain: 'domain' } : {})),
            yaxis: ax(g.yTitle, g.y2 ? { domain: [0, 0.74] } : (g.equal ? { scaleanchor: 'x', scaleratio: 1 } : {})),
            paper_bgcolor: th.bg, plot_bgcolor: th.bg, font: { color: th.text }, colorway: COLORS,
            margin: { t: 50, r: 30, b: 55, l: 60 }, legend: { orientation: 'h', y: -0.2 }, hovermode: 'closest', bargap: 0.04
        };
        if (g.y2) layout.yaxis2 = ax('', { domain: [0.8, 1], showticklabels: false });
        Plotly.react(div, g.traces, layout, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'], toImageButtonOptions: { filename: 'calculus-suite-plot', scale: 2 } });
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
            div.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${icon('chart', 34)}</div><h3>Nothing to plot yet</h3><p>${state.liveSpec && state.liveSpec.vars.length > 1 ? 'This expression has several variables – see the 3D tab.' : 'Enter a function of one variable or run a computation.'}</p></div>`;
            return;
        }
        if (div.querySelector('.empty-state')) div.innerHTML = '';
        if (spec && spec.generic) { renderGeneric(div, spec.generic); return; }
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
            const pv = (spec.paramVars || []).map(p => state.paramVals[p]);
            const fnOf = c => (pv.length && c.vars && c.vars.length > 1 ? (x => c.fn(x, ...pv)) : c.fn);
            if (spec.params) buildParamBar(spec);
            else $('paramBar').innerHTML = '';
            (spec.curves || []).forEach((c, i) => {
                let s;
                if (c.data) {
                    const t0 = c.data.t[0], t1 = c.data.t[c.data.t.length - 1];
                    s = sampleCurve(c.fn, Math.min(t0, t1), Math.max(t0, t1), n);
                } else s = sampleCurve(fnOf(c), lo, hi, spec.interactive ? Math.min(n, 700) : n);
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
            if (spec.bars && spec.bars.length) {
                traces.push({ type: 'bar', x: spec.bars.map(b => (b.x0 + b.x1) / 2), y: spec.bars.map(b => b.y), width: spec.bars.map(b => b.x1 - b.x0), marker: { color: 'rgba(99,102,241,.28)', line: { color: '#6366f1', width: 1 } }, name: 'rectangles', hovertemplate: 'f ≈ %{y:.5g}<extra></extra>' });
                spec.bars.forEach(b => allY.push(b.y));
            }
            if (spec.trap && spec.trap.length) {
                traces.push({ type: 'scatter', mode: 'lines', x: spec.trap.map(p => p.x), y: spec.trap.map(p => p.y), fill: 'tozeroy', fillcolor: 'rgba(99,102,241,.25)', line: { color: '#6366f1', width: 1.5 }, name: 'trapezoids' });
            }
            if (spec.shade2) {
                const a2 = Math.max(spec.shade2.a, lo), b2 = Math.min(spec.shade2.b, hi), m2 = 240;
                if (b2 > a2) {
                    const xs2 = [], gy = [], fy = [];
                    for (let i = 0; i <= m2; i++) { const x = a2 + (b2 - a2) * i / m2; xs2.push(x); gy.push(spec.shade2.gFn(x)); fy.push(spec.shade2.fFn(x)); }
                    traces.push({ type: 'scatter', mode: 'lines', x: xs2, y: gy, line: { width: 0 }, hoverinfo: 'skip', showlegend: false });
                    traces.push({ type: 'scatter', mode: 'lines', x: xs2, y: fy, fill: 'tonexty', fillcolor: 'rgba(34,211,238,.26)', line: { width: 0 }, name: 'region', hoverinfo: 'skip' });
                }
            }
            (spec.segments || []).forEach(sg => traces.push({ type: 'scatter', mode: 'lines', x: sg.x, y: sg.y, line: { color: '#f59e0b', width: 1.6, dash: 'dot' }, hoverinfo: 'skip', showlegend: false }));
            if (spec.interactive && spec.curves.length > 1) {
                const fns = spec.curves.map(fnOf), ix = [], iy = [];
                for (let a = 0; a < fns.length; a++) for (let b = a + 1; b < fns.length; b++) {
                    Runner.getEngine().intersections(fns[a], fns[b], lo, hi, 1200).slice(0, 12).forEach(x => { ix.push(x); iy.push(fns[a](x)); });
                }
                if (ix.length) traces.push({ type: 'scatter', mode: 'markers', x: ix, y: iy, name: 'intersections', text: ix.map((x, i) => `(${x.toPrecision(5)}, ${iy[i].toPrecision(5)})`), hovertemplate: '%{text}<extra>intersection</extra>', marker: { size: 11, color: '#f43f5e', line: { color: '#fff', width: 2 } } });
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

    // ---------- parameter sliders (graph mode) ----------
    function resetParams(result) {
        stopPlay();
        const p = result && result.plot && result.plot.params;
        state.paramKey = null;
        if (p) p.forEach(q => { if (!(q.name in state.paramVals)) state.paramVals[q.name] = q.value; });
    }
    function buildParamBar(spec) {
        const key = spec.params.map(p => p.name).join(',');
        const bar = $('paramBar');
        if (state.paramKey === key && bar.children.length) return;
        state.paramKey = key;
        bar.innerHTML = spec.params.map((p, i) => `
            <div class="param"><span>${esc(p.name)}</span>
                <input class="slider" type="range" data-p="${esc(p.name)}" min="${p.min}" max="${p.max}" step="${p.step}" value="${state.paramVals[p.name] ?? p.value}" aria-label="Parameter ${esc(p.name)}">
                <output>${(+(state.paramVals[p.name] ?? p.value)).toFixed(2)}</output>
                ${i === 0 ? '<button class="mini-btn" type="button" data-play title="Animate">▶</button>' : '<span></span>'}
            </div>`).join('');
        bar.querySelectorAll('input[data-p]').forEach(inp => inp.addEventListener('input', () => {
            state.paramVals[inp.dataset.p] = parseFloat(inp.value);
            inp.nextElementSibling.textContent = (+inp.value).toFixed(2);
            if (!state.rafPending) { state.rafPending = true; requestAnimationFrame(() => { state.rafPending = false; plot2D(); }); }
        }));
        const play = bar.querySelector('[data-play]');
        if (play) play.addEventListener('click', () => (state.playing ? stopPlay() : startPlay(spec.params[0])));
    }
    function startPlay(p) {
        const btn = document.querySelector('[data-play]'); if (btn) btn.textContent = '❚❚';
        let dir = 1, v = state.paramVals[p.name] ?? p.value;
        state.playing = setInterval(() => {
            v += dir * p.step * 3;
            if (v >= p.max) { v = p.max; dir = -1; } else if (v <= p.min) { v = p.min; dir = 1; }
            state.paramVals[p.name] = v;
            const inp = document.querySelector(`input[data-p="${p.name}"]`);
            if (inp) { inp.value = v; inp.nextElementSibling.textContent = v.toFixed(2); }
            plot2D();
        }, 60);
    }
    function stopPlay() { if (state.playing) { clearInterval(state.playing); state.playing = null; } const btn = document.querySelector('[data-play]'); if (btn) btn.textContent = '▶'; }

    let liveTimer;
    function liveGraph() {
        clearTimeout(liveTimer);
        liveTimer = setTimeout(() => {
            if (state.mode !== 'graph') return;
            try {
                const r = engine.run.graph($('functionInput').value.replace(/(^|[;\n])\s*(y|f\(x\))\s*=/g, '$1'), {});
                state.result = r; resetParams(r);
                if (activeTab() === 'plot') plot2D();
            } catch (e) { /* preview shows the error */ }
        }, 150);
    }

    // ---------- export ----------


    // ------------------------------------------------------------------
    // "How was this checked?", embed code, read-aloud, plot descriptions
    // ------------------------------------------------------------------
    function checkBox(r) {
        const lines = (r.meta || []).filter(m => /^Verified|^Method:|cross-?checked|agree|independent/i.test(m));
        if (!lines.length) return '';
        const explain = { derivative: 'The derivative is compared with a numerical derivative (central differences) at several sample points.', integral: 'An antiderivative is differentiated and compared with the integrand; definite integrals are also evaluated by numerical quadrature.', definite: 'The exact value is compared with an independent numerical integration.', limit: 'The limit is approached from both sides numerically and compared with the closed form.', laplace: 'The transform is checked by numerically integrating f(t)·e^(−st) at a test value of s.', matrix: 'The decomposition is multiplied back together and compared with the original matrix.', stats: 'Probabilities use exact special functions rather than tables or simulation.', number: 'Factorisations are multiplied back; congruences are substituted back.' }[r.kind] || 'The engine compares its answer with an independent calculation, shown below. Results that cannot be checked independently are labelled numerical.';
        return `<details class="check-box"><summary>${icon('shield', 14)}How was this checked?</summary><div class="check-body"><p>${esc(explain)}</p><ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul><p class="check-note">Checks catch most mistakes but are not formal proofs – for anything important, confirm with a second source.</p></div></details>`;
    }

    function embedCode() {
        const url = location.origin + location.pathname + '?embed=1#s=' + encodeHash(snapshot());
        const code = `<iframe src="${url}" width="760" height="560" style="border:1px solid #bbb;max-width:100%" loading="lazy" title="Calculus Suite Pro – ${(state.result && state.result.title || 'calculation').replace(/"/g, '')}"></iframe>`;
        copyText(code, 'Embed code copied – paste it into your page');
    }

    /** Turn maths text into something a speech engine reads naturally. */
    function toSpeech(t) {
        return String(t)
            .replace(/∫/g, ' integral of ').replace(/≈/g, ' is approximately ').replace(/≤/g, ' is at most ').replace(/≥/g, ' is at least ').replace(/→/g, ' tends to ').replace(/∞/g, ' infinity ').replace(/π/g, ' pi ').replace(/√/g, ' square root of ')
            .replace(/\^2\b|²/g, ' squared ').replace(/\^3\b|³/g, ' cubed ').replace(/\^\(?(-?[\w.]+)\)?/g, ' to the power $1 ')
            .replace(/sqrt\(/g, ' square root of (').replace(/\bexp\(/g, ' e to the (').replace(/\bln\(/g, ' natural log of (').replace(/\babs\(/g, ' absolute value of (')
            .replace(/\*/g, ' times ').replace(/\//g, ' over ').replace(/\+/g, ' plus ').replace(/(^|[\s(=])-(?=[\w(])/g, '$1 negative ').replace(/-/g, ' minus ').replace(/=/g, ' equals ')
            .replace(/[()[\]{}]/g, ' ').replace(/\bC\b/g, ' plus C ').replace(/\s+/g, ' ').trim();
    }
    function speakResult(r) {
        const synth = window.speechSynthesis; if (!synth) return;
        if (synth.speaking) { synth.cancel(); return; }
        const parts = [r.title + '.'];
        if (r.main) parts.push(`${toSpeech(r.main.label)} ${toSpeech(r.main.text)}.`);
        r.items.slice(0, 6).forEach(i => parts.push(`${toSpeech(i.label)} ${toSpeech(i.text)}.`));
        r.warnings.forEach(w => parts.push('Note: ' + w));
        const u = new SpeechSynthesisUtterance(parts.join(' ')); u.lang = document.documentElement.lang || 'en'; u.rate = 0.95; synth.speak(u);
    }

    /** A text description of the plot so screen-reader users get the shape of the result. */
    function describePlot(r) {
        const p = r && r.plot; if (!p) return '';
        const fmt = x => engine.fmt(x, 4); const out = [`Graph for ${r.title}.`];
        try {
            if (p.generic) {
                const g = p.generic; out.push(`${g.title || 'Plot'}, horizontal axis ${g.xTitle || 'x'}, vertical axis ${g.yTitle || 'y'}.`);
                g.traces.forEach(t => { const ys = (t.y || []).filter(Number.isFinite); const kind = t.type === 'heatmap' ? 'colour map' : t.type === 'histogram' ? 'histogram' : t.type === 'box' ? 'box plot' : t.mode === 'markers' ? 'scatter points' : 'line'; out.push(`${t.name || 'Series'}: ${kind}${ys.length ? `, ${ys.length} points, values from ${fmt(Math.min(...ys))} to ${fmt(Math.max(...ys))}` : ''}.`); });
            } else if (p.curves && p.curves.length) {
                const lo = p.xRange ? p.xRange[0] : -10, hi = p.xRange ? p.xRange[1] : 10; out.push(`${p.curves.length} curve${p.curves.length > 1 ? 's' : ''} over ${p.variable || 'x'} from ${fmt(lo)} to ${fmt(hi)}.`);
                p.curves.slice(0, 4).forEach(c => { if (!c.fn) return; let mn = Infinity, mx = -Infinity, xm = 0, xM = 0; for (let i = 0; i <= 80; i++) { const x = lo + (hi - lo) * i / 80, y = c.fn(x); if (!Number.isFinite(y)) continue; if (y < mn) { mn = y; xm = x; } if (y > mx) { mx = y; xM = x; } } if (Number.isFinite(mn)) out.push(`${c.name}: lowest sampled value ${fmt(mn)} near ${fmt(xm)}, highest ${fmt(mx)} near ${fmt(xM)}.`); });
                (p.points || []).slice(0, 8).forEach(pt => out.push(`${pt.name || 'Point'} at (${fmt(pt.x)}, ${fmt(pt.y)}).`));
            }
        } catch (e) { /* description is best-effort */ }
        return out.join(' ');
    }
    function applyPlotDescription(r) {
        const desc = describePlot(r), div = $('plot2d'); let el = $('plotDesc');
        if (!el) { el = document.createElement('p'); el.id = 'plotDesc'; el.className = 'sr-only'; div.parentNode.insertBefore(el, div); }
        el.textContent = desc; div.setAttribute('role', 'img'); div.setAttribute('aria-label', desc || 'Plot'); div.setAttribute('aria-describedby', 'plotDesc');
    }
    function initEmbed() {
        if (!/[?&]embed=1\b/.test(location.search)) return;
        document.body.classList.add('embed');
        const a = document.createElement('a'); a.className = 'embed-link'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Open in Calculus Suite ↗';
        a.href = location.origin + location.pathname + location.hash; document.body.appendChild(a);
        window.addEventListener('hashchange', () => { a.href = location.origin + location.pathname + location.hash; });
    }

    // ------------------------------------------------------------------
    // Notebook: named projects of saved results (stored on this device)
    // ------------------------------------------------------------------
    const NB_KEY = 'cs_projects';
    const uid = () => Math.random().toString(36).slice(2, 10);
    function nbLoad() {
        let d = null;
        try { d = JSON.parse(localStorage.getItem(NB_KEY) || 'null'); } catch (e) { d = null; }
        const okItem = i => i && typeof i === 'object' && i.s && typeof i.s === 'object' && MODES[i.s.m] && typeof i.s.f === 'string';
        if (d && Array.isArray(d.list)) {
            d.list = d.list.filter(p => p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string').map(p => ({ id: p.id, name: p.name.slice(0, 40), items: (Array.isArray(p.items) ? p.items : []).filter(okItem).map(i => ({ id: String(i.id || uid()), s: { m: i.s.m, f: i.s.f, o: i.s.o && typeof i.s.o === 'object' ? i.s.o : {} }, title: String(i.title || ''), text: String(i.text || ''), tex: String(i.tex || ''), pinned: !!i.pinned, note: String(i.note || '').slice(0, 300), ts: +i.ts || 0 })) }));
        }
        if (!d || !Array.isArray(d.list) || !d.list.length) d = { cur: null, list: [{ id: uid(), name: 'My notebook', items: [] }] };
        if (!d.list.some(p => p.id === d.cur)) d.cur = d.list[0].id;
        return d;
    }
    let nb = nbLoad();
    function nbSave() { try { localStorage.setItem(NB_KEY, JSON.stringify(nb)); } catch (e) { toast('Could not save – browser storage is full or blocked', 'err'); } }
    const nbCur = () => nb.list.find(p => p.id === nb.cur) || nb.list[0];

    function saveToNotebook() {
        const r = state.result; if (!r) return;
        const p = nbCur();
        const snap = snapshot();
        if (p.items.some(i => JSON.stringify(i.s) === JSON.stringify(snap))) { toast('Already saved in this notebook', 'ok'); return; }
        p.items.unshift({ id: uid(), s: JSON.parse(JSON.stringify(snap)), title: r.title, text: r.main ? `${r.main.label} ${r.main.text}` : r.title, tex: r.main && r.main.tex || '', pinned: false, note: '', ts: Date.now() });
        nbSave(); renderNotebook();
        toast(`Saved to “${p.name}”`, 'ok');
    }

    function renderNotebook() {
        const sel = $('projSelect'); if (!sel) return;
        sel.innerHTML = nb.list.map(p => `<option value="${esc(p.id)}" ${p.id === nb.cur ? 'selected' : ''}>${esc(p.name)} (${p.items.length})</option>`).join('');
        const p = nbCur();
        const items = p.items.map((it, i) => ({ it, i })).sort((a, b) => (b.it.pinned - a.it.pinned) || (b.it.ts - a.it.ts));
        const box = $('projItems');
        if (!items.length) { box.innerHTML = '<div class="history-empty">Nothing saved yet. Press <b>Save</b> on any result.</div>'; return; }
        box.innerHTML = items.map(({ it }) => `
            <div class="nb-item" data-id="${esc(it.id)}">
                <button class="nb-open" type="button" data-nb="open" title="Open and recompute">
                    <span class="history-mode">${esc((MODES[it.s.m] || {}).icon || '=')}</span>
                    <span class="nb-text"><b>${esc(it.s.f.length > 34 ? it.s.f.slice(0, 34) + '…' : it.s.f)}</b><small>${esc(it.text.length > 70 ? it.text.slice(0, 70) + '…' : it.text)}</small>${it.note ? `<em>${esc(it.note)}</em>` : ''}</span>
                </button>
                <div class="nb-tools">
                    <button type="button" class="nb-btn ${it.pinned ? 'on' : ''}" data-nb="pin" aria-label="${it.pinned ? 'Unpin' : 'Pin'}" aria-pressed="${it.pinned}" title="Pin">★</button>
                    <button type="button" class="nb-btn" data-nb="note" aria-label="Edit note" title="Note">✎</button>
                    <button type="button" class="nb-btn" data-nb="del" aria-label="Delete" title="Delete">✕</button>
                </div>
            </div>`).join('');
        box.querySelectorAll('.nb-item').forEach(row => row.addEventListener('click', e => {
            const btn = e.target.closest('[data-nb]'); if (!btn) return;
            const proj = nbCur(); const it = proj.items.find(x => x.id === row.dataset.id); if (!it) return;
            const act = btn.dataset.nb;
            if (act === 'open') { if (restoreSnapshot(it.s)) compute(); }
            else if (act === 'pin') { it.pinned = !it.pinned; }
            else if (act === 'note') { const n = window.prompt('Note for this result:', it.note || ''); if (n === null) return; it.note = n.trim().slice(0, 300); }
            else if (act === 'del') { proj.items = proj.items.filter(x => x.id !== it.id); }
            nbSave(); renderNotebook();
        }));
    }

    function downloadText(name, text, type) {
        const blob = new Blob([text], { type: type || 'text/plain' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    function exportNotebook() {
        const p = nbCur();
        if (!p.items.length) { toast('Save some results first', 'err'); return; }
        const L = [`# ${p.name}`, '', `*Calculus Suite Pro notebook – ${new Date().toISOString().slice(0, 10)}*`, ''];
        p.items.slice().sort((a, b) => (b.pinned - a.pinned) || (a.ts - b.ts)).forEach((it, i) => {
            L.push(`## ${i + 1}. ${it.pinned ? '★ ' : ''}${(MODES[it.s.m] || {}).label || it.s.m}: \`${it.s.f}\``, '');
            const o = Object.keys(it.s.o || {}).filter(k => String(it.s.o[k]).trim() !== '' && k !== 'digits').map(k => `${k} = ${it.s.o[k]}`);
            if (o.length) L.push(`*Options: ${o.join(', ')}*`, '');
            L.push(`**${it.text}**`, '');
            if (it.tex) L.push('$$', it.tex, '$$', '');
            if (it.note) L.push(`> ${it.note}`, '');
        });
        downloadText(`${p.name.replace(/[^\w-]+/g, '_') || 'notebook'}.md`, L.join('\n'), 'text/markdown');
        toast('Notebook exported', 'ok');
    }
    function initNotebook() {
        if (!$('projSelect')) return;
        renderNotebook();
        $('projSelect').addEventListener('change', e => { nb.cur = e.target.value; nbSave(); renderNotebook(); });
        $('projNew').addEventListener('click', () => { const n = window.prompt('Name for the new notebook:', 'Homework'); if (!n || !n.trim()) return; const p = { id: uid(), name: n.trim().slice(0, 40), items: [] }; nb.list.push(p); nb.cur = p.id; nbSave(); renderNotebook(); });
        $('projRename').addEventListener('click', () => { const p = nbCur(); const n = window.prompt('Rename notebook:', p.name); if (!n || !n.trim()) return; p.name = n.trim().slice(0, 40); nbSave(); renderNotebook(); });
        $('projDelete').addEventListener('click', () => {
            const p = nbCur(); if (!window.confirm(`Delete “${p.name}” and its ${p.items.length} saved result(s)?`)) return;
            nb.list = nb.list.filter(x => x.id !== p.id); nb = (nb.list.length ? nb : { cur: null, list: [{ id: uid(), name: 'My notebook', items: [] }] }); nb.cur = nb.list[0].id; nbSave(); renderNotebook();
        });
        $('projExport').addEventListener('click', exportNotebook);
        $('projBackup').addEventListener('click', () => { downloadText(`calculus-suite-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'calculus-suite', version: 1, notebooks: nb.list }, null, 2), 'application/json'); toast('Backup downloaded', 'ok'); });
        $('projImport').addEventListener('click', () => $('projFile').click());
        $('projFile').addEventListener('change', e => {
            const file = e.target.files && e.target.files[0]; if (!file) return;
            const fr = new FileReader();
            fr.onload = () => {
                try {
                    const d = JSON.parse(String(fr.result));
                    if (!d || d.app !== 'calculus-suite' || !Array.isArray(d.notebooks)) throw new Error('bad');
                    let added = 0;
                    d.notebooks.forEach(p => {
                        if (!p || typeof p.name !== 'string' || !Array.isArray(p.items)) return;
                        const items = p.items.filter(i => i && i.s && MODES[i.s.m] && typeof i.s.f === 'string').map(i => ({ id: uid(), s: { m: i.s.m, f: i.s.f, o: i.s.o && typeof i.s.o === 'object' ? i.s.o : {} }, title: String(i.title || ''), text: String(i.text || ''), tex: String(i.tex || ''), pinned: !!i.pinned, note: String(i.note || '').slice(0, 300), ts: +i.ts || Date.now() }));
                        nb.list.push({ id: uid(), name: p.name.slice(0, 40) + ' (imported)', items }); added += items.length;
                    });
                    nbSave(); renderNotebook(); toast(`Imported ${added} result(s)`, 'ok');
                } catch (err) { toast('That file is not a Calculus Suite backup', 'err'); }
                e.target.value = '';
            };
            fr.readAsText(file);
        });
    }

    function exportReport() {
        const r = state.result; if (!r) return;
        const lines = [`# ${r.title}`, '', `*Calculus Suite Pro – ${new Date().toISOString().slice(0, 10)}*`, '', '## Input', '', '```', $('functionInput').value, '```', ''];
        const o = currentValues(); const optLines = Object.keys(o).filter(k => String(o[k]).trim() !== '').map(k => `- ${k}: \`${o[k]}\``);
        if (optLines.length) lines.push('Options:', '', ...optLines, '');
        lines.push('## Result', '');
        if (r.main) lines.push(`**${r.main.label}** ${r.main.text}`, '');
        if (r.main && r.main.tex) lines.push('$$', r.main.tex, '$$', '');
        r.items.forEach(i => lines.push(`- **${i.label}** ${i.text}`));
        if (r.meta.length) lines.push('', ...r.meta.map(m => `> ${m}`));
        r.warnings.forEach(w => lines.push('', `> ⚠ ${w}`));
        if (r.steps.length) { lines.push('', '## Steps', ''); r.steps.forEach((st, i) => { lines.push(`${i + 1}. **${st.title}** – ${st.text}`); if (st.tex) lines.push('   ', '   $$' + st.tex + '$$'); }); }
        const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/markdown' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `calculus-${r.kind}-${Date.now()}.md`; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast('Report downloaded', 'ok');
    }
    function downloadPlot() {
        const t = activeTab();
        const div = t === 'plot3d' ? $('plot3dDiv') : $('plot2d');
        if (!div.data) { toast('Nothing to save yet', 'err'); return; }
        Plotly.downloadImage(div, { format: 'png', filename: 'calculus-suite-plot', scale: 2, width: 1200, height: 720 });
    }

    // ---------- command palette ----------
    function paletteCommands() {
        const cmds = [];
        MODE_ORDER.forEach((id, i) => cmds.push({ group: 'Tools', ico: MODES[id].icon, label: `Open ${MODES[id].label}`, hint: i < 9 ? `Alt+${i + 1}` : '', keys: MODE_DESC[id], run: () => { setMode(id); $('functionInput').focus(); } }));
        const acts = [
            ['Actions', 'play', 'Compute', 'Ctrl+Enter', 'run calculate solve', compute],
            ['Actions', 'trash', 'Clear everything', 'Ctrl+Shift+K', 'reset', clearAll],
            ['Actions', 'palette', 'Toggle dark / light theme', '', 'theme night day', () => { applyTheme(!isDark()); refreshActivePlot(); }],
            ['Actions', 'link', 'Copy share link', '', 'url link', shareLink],
            ['Actions', 'file', 'Export result as Markdown report', '', 'download save report', exportReport],
            ['Actions', 'camera', 'Save current plot as PNG', '', 'image picture download', downloadPlot],
            ['Actions', 'copy', 'Copy result as text', '', 'clipboard', () => state.result && copyText(state.result.text, 'Result copied')],
            ['Actions', 'keyboard', 'Show / hide symbol keypad', '', 'symbols keyboard', toggleKeypad],
            ['Actions', 'clock', 'Clear history', '', 'delete', () => { try { localStorage.removeItem('cs_history'); } catch (e) { /* ignore */ } renderHistory(); }],
            ['Actions', 'help', 'Syntax help & shortcuts', '?', 'documentation', () => $('helpBtn').click()],
            ['Go to', 'grid', 'Results tab', 'Alt+R', '', () => switchTab('results')],
            ['Go to', 'chart', '2D plot tab', 'Alt+P', '', () => switchTab('plot')],
            ['Go to', 'cube', '3D plot tab', 'Alt+D', '', () => switchTab('plot3d')],
            ['Go to', 'list', 'Steps tab', 'Alt+S', '', () => switchTab('steps')]
        ];
        acts.forEach(a => cmds.push({ group: a[0], ico: a[1], label: a[2], hint: a[3], keys: a[4], run: a[5] }));
        if (deferredInstall) cmds.push({ group: 'Actions', ico: 'download', label: 'Install as an app', hint: '', keys: 'pwa', run: installApp });
        MODE_ORDER.forEach(id => MODES[id].examples.forEach((ex, i) => cmds.push({ group: 'Examples', ico: MODES[id].icon, label: `${MODES[id].label}: ${ex.label}`, hint: '', keys: ex.fn, run: () => { setMode(id, true); loadExample(i); } })));
        return cmds;
    }
    let palItems = [], palSel = 0;
    function openPalette() {
        const dlg = $('paletteDialog');
        if (!dlg.open) { dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', ''); }
        $('paletteInput').value = ''; palSel = 0; renderPalette(); $('paletteInput').focus();
    }
    function renderPalette() {
        const q = $('paletteInput').value.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const all = paletteCommands();
        palItems = all.filter(c => { const hay = (c.label + ' ' + (c.keys || '') + ' ' + c.group).toLowerCase(); return q.every(w => hay.includes(w)); }).slice(0, 60);
        palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
        let last = '', html = '';
        palItems.forEach((c, i) => {
            if (c.group !== last) { html += `<div class="palette-group">${esc(c.group)}</div>`; last = c.group; }
            html += `<button class="palette-item ${i === palSel ? 'sel' : ''}" role="option" data-i="${i}"><span class="p-ico">${ICON[c.ico] ? icon(c.ico, 16) : esc(c.ico)}</span><span>${esc(c.label)}</span><small>${esc(c.hint || '')}</small></button>`;
        });
        $('paletteList').innerHTML = html || '<div class="empty-state" style="padding:30px">No matches</div>';
        $('paletteList').querySelectorAll('.palette-item').forEach(b => { b.addEventListener('click', () => runPalette(+b.dataset.i)); b.addEventListener('mousemove', () => { palSel = +b.dataset.i; markPalette(); }); });
        const sel = $('paletteList').querySelector('.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
    }
    function markPalette() { $('paletteList').querySelectorAll('.palette-item').forEach((b, i) => b.classList.toggle('sel', i === palSel)); }
    function runPalette(i) { const c = palItems[i]; if (!c) return; const d = $('paletteDialog'); d.close ? d.close() : d.removeAttribute('open'); setTimeout(c.run, 30); }

    // ---------- install / misc ----------
    let deferredInstall = null;
    function installApp() { if (!deferredInstall) return; deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; $('installBtn').hidden = true; }); }
    function toggleKeypad() { const k = $('keypad'); k.hidden = !k.hidden; $('keypadToggle').setAttribute('aria-expanded', String(!k.hidden)); }

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
        const msg = (ic, title, text) => { Plotly.purge(div); div.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${icon(ic, 34)}</div><h3>${title}</h3><p>${text}</p></div>`; };
        if (!spec) return msg('cube', 'No surface to show', 'Enter a function of two variables, e.g. <code>sin(x)*cos(y)</code>, or use the Multivariable mode.');
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
        if (valid < 25) return msg('alert', 'Cannot draw this surface', 'The function is undefined on almost the whole domain.');
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

    const FEATURED = [
        ['derivative', 0, '∂', 'Differentiate with steps', 'x^2*sin(x)'],
        ['integral', 1, '∫', 'u-substitution, solved', '2x*cos(x^2)'],
        ['graph', 0, '∿', 'Sliders you can animate', 'a*sin(b*x)'],
        ['riemann', 1, 'Δx', 'Watch sums converge', 'sin(x), n = 10'],
        ['ode', 2, 'y′', 'Logistic growth ODE', 'y*(1-y)'],
        ['fourier', 0, '∼', 'Gibbs phenomenon', 'sign(x)'],
        ['multivariable', 2, '∇', 'Critical points & saddles', 'x^3-3x+y^2'],
        ['matrix', 2, '[ ]', 'Eigenvalues, exact', '2 1 ; 1 2'],
        ['solve', 7, 'x=', 'Inequalities → intervals', '(x-1)/(x+2) >= 0'],
        ['sums', 0, 'Σk', 'Convergence tests, exact π²/6', '1/k^2']
    ];

    function welcomeHTML() {
        return `<div class="welcome">
            <h2>Calculus, <span>beautifully</span><br>solved &amp; explained.</h2>
            <p>Sixteen tools, one workspace. Every result comes with the reasoning behind it, live 2D/3D plots, and exact answers wherever they exist. Pick a tile to start – or press <kbd>Ctrl</kbd> <kbd>K</kbd>.</p>
            <div class="tiles">${FEATURED.map((f, i) => `<button class="tile" type="button" data-i="${i}"><span class="t-ico">${esc(f[2])}</span><b>${esc(f[3])}</b><code>${esc(f[4])}</code></button>`).join('')}</div>
            <div class="tips">
                <div class="tip">${icon('command', 20)}<div><b>Command palette</b>Press <kbd>Ctrl</kbd> <kbd>K</kbd> to jump to any tool, example or action.</div></div>
                <div class="tip">${icon('sliders', 20)}<div><b>Live sliders</b>In <em>Graph &amp; sliders</em> every extra letter becomes a draggable, animatable parameter.</div></div>
                <div class="tip">${icon('shield', 20)}<div><b>Verified results</b>Antiderivatives and derivatives are cross-checked independently before you see them.</div></div>
                <div class="tip">${icon('link', 20)}<div><b>Share anything</b>One click copies a link that reproduces the whole calculation.</div></div>
            </div>
        </div>`;
    }
    function showWelcome() {
        const el = $('results');
        el.innerHTML = welcomeHTML();
        el.querySelectorAll('.tile').forEach(t => t.addEventListener('click', () => { const f = FEATURED[+t.dataset.i]; setMode(f[0], true); loadExample(f[1]); }));
        const st = $('steps');
        st.classList.remove('show-timeline');
        st.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${icon('list', 34)}</div><h3>Step-by-step reasoning</h3><p>Run a computation and every step of the solution appears here.</p></div>`;
    }

    function clearAll() {
        $('functionInput').value = '';
        state.result = null;
        state.liveSpec = null;
        validateInput();
        showWelcome();
        try { Plotly.purge($('plot2d')); Plotly.purge($('plot3dDiv')); Plotly.purge($('plotPhase')); } catch (e) { /* ignore */ }
        $('plot2d').innerHTML = ''; $('plot3dDiv').innerHTML = ''; $('plotPhase').style.display = 'none'; $('paramBar').innerHTML = '';
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
        saveSession();
        switchTab('results');
        $('functionInput').focus();
    }

    function initUI() {
        // mode select
        renderModeGrid();

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
        $('askForm').addEventListener('submit', e => { e.preventDefault(); askNL($('askInput').value); });
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

        $('paletteBtn').addEventListener('click', openPalette);
        $('paletteInput').addEventListener('input', () => { palSel = 0; renderPalette(); });
        $('paletteInput').addEventListener('keydown', e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); markPalette(); const s2 = $('paletteList').querySelector('.sel'); if (s2) s2.scrollIntoView({ block: 'nearest' }); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(0, palSel - 1); markPalette(); const s2 = $('paletteList').querySelector('.sel'); if (s2) s2.scrollIntoView({ block: 'nearest' }); }
            else if (e.key === 'Enter') { e.preventDefault(); runPalette(palSel); }
        });
        $('paletteDialog').addEventListener('click', e => { if (e.target === $('paletteDialog')) $('paletteDialog').close(); });
        $('keypadToggle').addEventListener('click', toggleKeypad);
        $('downloadPlot').addEventListener('click', downloadPlot);
        $('installBtn').addEventListener('click', installApp);
        window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('installBtn').hidden = false; });
        if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });

        document.addEventListener('keydown', e => {
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key === 'Enter') { e.preventDefault(); compute(); }
            else if (mod && e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); clearAll(); }
            else if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
            else if (e.altKey && /^[1-9]$/.test(e.key) && MODE_ORDER[+e.key - 1]) { e.preventDefault(); setMode(MODE_ORDER[+e.key - 1]); }
            else if (e.altKey && 'rpds'.includes(e.key.toLowerCase()) && e.key.length === 1) { e.preventDefault(); switchTab({ r: 'results', p: 'plot', d: 'plot3d', s: 'steps' }[e.key.toLowerCase()]); }
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


    // ------------------------------------------------------------------
    // Camera / image input: Tesseract.js is fetched only when the user scans
    // ------------------------------------------------------------------
    let tessPromise = null;
    function loadTesseract() {
        if (tessPromise) return tessPromise;
        tessPromise = new Promise((resolve, reject) => {
            if (window.Tesseract) { resolve(window.Tesseract); return; }
            const sc = document.createElement('script');
            sc.src = 'vendor/tesseract/tesseract.min.js';
            sc.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error('Tesseract missing')));
            sc.onerror = () => { tessPromise = null; reject(new Error('download failed')); };
            document.head.appendChild(sc);
        });
        return tessPromise;
    }
    /** grayscale → contrast stretch → Otsu threshold, so photos of paper OCR cleanly */
    function prepareImage(img, canvas) {
        const max = 1800, k = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        const d = ctx.getImageData(0, 0, w, h), px = d.data, g = new Uint8Array(w * h), hist = new Array(256).fill(0);
        for (let i = 0, j = 0; i < px.length; i += 4, j++) { const v = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]); g[j] = v; hist[v]++; }
        const total = w * h; let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
        let sumB = 0, wB = 0, best = 0, thr = 128;
        for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) * (mB - mF); if (between > best) { best = between; thr = t; } }
        let dark = 0; for (let j = 0; j < g.length; j++) if (g[j] <= thr) dark++;
        const invert = dark > total * 0.5;   // light text on a dark background
        for (let i = 0, j = 0; i < px.length; i += 4, j++) { const on = invert ? g[j] > thr : g[j] <= thr; const v = on ? 0 : 255; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; }
        ctx.putImageData(d, 0, 0);
    }
    function cleanOCR(t) {
        return String(t).replace(/™/g, '^').replace(/\bOto\b/g, '0 to').replace(/(\d)[Oo](?=\s|$|\d|\))/g, '$10').replace(/\bX\b/g, 'x').replace(/[×✕✖·•∙]/g, '*').replace(/÷/g, '/').replace(/[−–—‒]/g, '-').replace(/[“”"‘’`´]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
    }
    function initScan() {
        const dlg = $('scanDialog'); if (!dlg || !$('scanBtn')) return;
        const status = $('scanStatus'), bar = $('scanBar'), fill = $('scanBarFill'), out = $('scanText'), prev = $('scanPreview'), file = $('scanFile');
        const say = (m, bad) => { status.textContent = m; status.classList.toggle('bad', !!bad); };
        const setProgress = f => { bar.hidden = f == null; if (f != null) fill.style.width = Math.round(Math.max(0, Math.min(1, f)) * 100) + '%'; };
        $('scanBtn').addEventListener('click', () => { out.value = ''; prev.hidden = true; setProgress(null); say('No image yet.'); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); });
        $('scanClose').addEventListener('click', () => dlg.close());
        $('scanUse').addEventListener('click', () => { const t = cleanOCR(out.value); if (!t) { say('Nothing to use yet.', true); return; } $('functionInput').value = t; dlg.close(); validateInput(); saveSession(); $('functionInput').focus(); });
        $('scanAsk').addEventListener('click', () => { const t = out.value.trim(); if (!t) { say('Nothing to ask yet.', true); return; } dlg.close(); $('askInput').value = t; askNL(t); });
        let busy = false;
        file.addEventListener('change', async () => {
            const f = file.files && file.files[0]; file.value = '';
            if (!f || busy) return;
            if (!/^image\//.test(f.type)) { say('Please choose an image file.', true); return; }
            if (f.size > 20 * 1024 * 1024) { say('That image is larger than 20 MB – please use a smaller one.', true); return; }
            busy = true; out.value = '';
            try {
                say('Preparing the image…'); setProgress(0.02);
                const url = URL.createObjectURL(f);
                const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('decode')); im.src = url; });
                prepareImage(img, prev); URL.revokeObjectURL(url); prev.hidden = false;
                say('Loading the text recogniser (first use only, about 11 MB)…');
                const T = await loadTesseract();
                const worker = await T.createWorker('eng', 1, {
                    workerPath: 'vendor/tesseract/worker.min.js', corePath: 'vendor/tesseract/', langPath: 'vendor/tesseract/lang/', gzip: true,
                    logger: m => { if (m.status === 'recognizing text') { say(`Reading the text… ${Math.round(m.progress * 100)}%`); setProgress(0.2 + 0.8 * m.progress); } else if (/loading|initializ/.test(m.status)) { setProgress(0.05 + 0.15 * (m.progress || 0)); } }
                });
                try {
                    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
                    const r = await worker.recognize(prev);
                    out.value = cleanOCR(r.data.text);
                    const conf = Math.round(r.data.confidence || 0);
                    say(out.value ? `Done – recognition confidence ${conf}%. Check the text, fix any mistakes, then use it.` : 'No text was found. Try a sharper, well-lit photo with dark print on light paper.', !out.value);
                } finally { try { await worker.terminate(); } catch (e) { /* ignore */ } }
            } catch (err) {
                say(err && /download|importScripts|network|fetch|Failed/i.test(String(err.message || err)) ? 'The recogniser could not be loaded. It needs to download once (about 11 MB) – connect to the internet and try again.' : 'Could not read that image. Try another photo.', true);
            } finally { busy = false; setProgress(null); }
            out.focus();
        });
    }


    // ------------------------------------------------------------------
    // Practice mode (teaching): generated problems, checking, progressive hints
    // ------------------------------------------------------------------
    function initPractice() {
        const dlg = $('practiceDialog'); if (!dlg || !window.Practice) return;
        const P = window.Practice.create(engine, window.math);
        const KEY = 'cs_practice';
        const load = () => { try { const d = JSON.parse(localStorage.getItem(KEY) || '{}'); return { solved: +d.solved || 0, tried: +d.tried || 0, streak: +d.streak || 0, best: +d.best || 0, topic: P.TOPICS.some(t => t[0] === d.topic) ? d.topic : 'derivative', level: [1, 2, 3].includes(+d.level) ? +d.level : 1, seed: Number.isFinite(+d.seed) && +d.seed > 0 ? +d.seed : 1 }; } catch (e) { return { solved: 0, tried: 0, streak: 0, best: 0, topic: 'derivative', level: 1, seed: 1 }; } };
        let st = load(), cur = null, hintsShown = 0, finished = false;
        const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage blocked */ } };
        $('pracTopic').innerHTML = P.TOPICS.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('');
        $('pracTopic').value = st.topic; $('pracLevel').value = String(st.level);
        const stats = () => { $('pracStats').textContent = `Solved ${st.solved} of ${st.tried} · streak ${st.streak} · best streak ${st.best}`; };
        const texLine = (t, display) => `<span class="${display ? 'tex-display ' : ''}tex" data-tex="${esc(t)}"></span>`;
        const draw = el => { renderTex(el); };
        function next(sameSeed) {
            st.topic = $('pracTopic').value; st.level = +$('pracLevel').value; if (!sameSeed) st.seed = (st.seed % 999999) + 1; save();
            try { cur = P.generate(st.topic, st.level, st.seed); } catch (e) { $('pracProblem').textContent = 'Could not create a problem. Try another topic.'; return; }
            hintsShown = 0; finished = false; $('pracHints').innerHTML = ''; $('pracFeedback').textContent = ''; $('pracFeedback').className = 'practice-feedback'; $('pracAnswer').value = ''; $('pracPreview').innerHTML = ''; $('pracAnswer').placeholder = cur.placeholder || 'Your answer'; $('pracAnswer').disabled = false;
            $('pracProblem').innerHTML = `<div class="prob-id">Problem #${st.seed} · ${esc(P.TOPICS.find(t => t[0] === st.topic)[1])} · level ${st.level}</div><div class="prob-body">${texLine(cur.tex, true)}</div>${cur.prompt ? `<div class="prob-prompt">${esc(cur.prompt)}</div>` : (st.topic === 'derivative' ? '<div class="prob-prompt">Differentiate.</div>' : st.topic === 'integral' ? '<div class="prob-prompt">Find an antiderivative.</div>' : '')}`;
            draw($('pracProblem')); stats(); $('pracAnswer').focus();
        }
        function showSteps(n) {
            const steps = cur.steps().filter(s => s.text || s.tex).slice(0, n);
            $('pracHints').innerHTML = steps.map(s => `<li><b>${esc(s.title)}</b> – ${esc(s.text)}${s.tex ? `<div>${texLine(s.tex, false)}</div>` : ''}</li>`).join('');
            draw($('pracHints'));
            return steps.length;
        }
        $('practiceBtn').addEventListener('click', () => { if (!cur) next(true); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); $('pracAnswer').focus(); });
        $('practiceClose').addEventListener('click', () => dlg.close());
        $('pracNew').addEventListener('click', () => next(false));
        $('pracTopic').addEventListener('change', () => next(true)); $('pracLevel').addEventListener('change', () => next(true));
        $('pracAnswer').addEventListener('input', () => {
            const v = $('pracAnswer').value, box = $('pracPreview');
            if (!cur || !v.trim() || !['expression', 'number'].includes(cur.input)) { box.innerHTML = ''; return; }
            try { const info = engine.inspect(v.replace(/\s*\+\s*[cC]\s*$/, '')); box.innerHTML = `<span class="tex" data-tex="${esc(info.tex)}"></span>`; draw(box); } catch (e) { box.textContent = ''; }
        });
        $('pracForm').addEventListener('submit', e => {
            e.preventDefault(); if (!cur || finished) return;
            const fb = $('pracFeedback'); let r;
            try { r = cur.check($('pracAnswer').value); } catch (err) { r = { ok: false, msg: err.message }; }
            if (r.ok) {
                finished = true; st.tried++; st.solved++; st.streak++; st.best = Math.max(st.best, st.streak); save(); stats();
                fb.className = 'practice-feedback good'; fb.textContent = hintsShown ? `Correct! (with ${hintsShown} hint${hintsShown === 1 ? '' : 's'}) Press “New problem” for the next one.` : 'Correct! Press “New problem” for the next one.';
                $('pracAnswer').disabled = true;
            } else { fb.className = 'practice-feedback bad'; fb.textContent = r.msg || 'Not quite – try again, or ask for a hint.'; st.streak = 0; save(); stats(); }
        });
        $('pracHint').addEventListener('click', () => {
            if (!cur) return; const total = cur.steps().filter(s => s.text || s.tex).length;
            if (!total) { $('pracFeedback').className = 'practice-feedback'; $('pracFeedback').textContent = 'No hints are available for this problem – try “Show solution”.'; return; }
            hintsShown = Math.min(total, hintsShown + 1); showSteps(hintsShown);
            if (hintsShown === total) $('pracFeedback').textContent = 'That was the last hint. Use “Show solution” to see the answer.';
        });
        $('pracSolution').addEventListener('click', () => {
            if (!cur) return;
            if (!finished) { finished = true; st.tried++; st.streak = 0; save(); stats(); }
            showSteps(99); $('pracAnswer').disabled = true;
            const fb = $('pracFeedback'); fb.className = 'practice-feedback'; fb.innerHTML = `Answer: ${cur.answerTex ? texLine(cur.answerTex, false) : esc(cur.answerText)}`; draw(fb);
        });
        stats();
    }

    function init() {
        initEmbed();
        initPhoneLayout();
        initNotebook();
        initPractice();
        initScan();
        initTheme();
        initTeaching();
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
        hydrateIcons();
        moveIndicator();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveIndicator);
        window.addEventListener('resize', moveIndicator);
        Runner.warmUp().then(ok => {
            $('engineDot').classList.add('on');
            $('engineStatus').textContent = ok ? 'Engine ready · background worker' : 'Engine ready · main thread';
        });
        if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
            navigator.serviceWorker.ready.then(() => { $('offlineStatus').innerHTML = icon('wifi', 14) + ' Ready to work offline'; hydrateIcons(); }).catch(() => {});
        } else $('offlineStatus').textContent = 'Offline install needs http(s)';
        if (restored) compute(); else showWelcome();
        $('app').classList.add('ready');
        if (window.I18N) window.I18N.init();
    }

    // Debug/testing hook
    window.__calc = { state, compute, setMode, validateInput };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
