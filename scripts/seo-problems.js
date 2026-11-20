/* The problems that get their own page under /problems/. Each family says how to run the engine and how to word
   the page; the build (scripts/build-seo.js) computes every answer, steps and check with the real engine and skips
   anything that fails, so a page can never show a wrong or empty result. Add a line here and run `npm run seo`. */
const plain = s => String(s).replace(/\*/g, ' ').replace(/\s+/g, ' ').trim();
const lim = (a, b) => `from ${plain(a)} to ${plain(b)}`;

module.exports = [
    {
        id: 'derivatives', group: 'Derivatives', mode: 'derivative', tool: 'derivative-calculator',
        intro: 'The derivative measures how fast a function changes. The working below names every rule used (sum, product, quotient, chain and the standard derivatives) and the answer is compared with a numerical derivative before it is shown.',
        h1: f => `Derivative of ${plain(f)}`, q: (f, tex) => `\\frac{d}{dx}\\left[${tex}\\right]`,
        opts: () => ({ order: '1' }),
        items: ['x^5', 'sqrt(x)', '1/x', 'x^(1/3)', '1/sqrt(x)', 'e^x', 'e^(2x)', 'e^(-x)', 'e^(-x^2)', '2^x', 'ln(x)', 'ln(2x)', 'ln(x^2+1)', 'log10(x)', 'sin(x)', 'cos(x)', 'tan(x)', 'sec(x)', 'cot(x)', 'sin(2x)', 'cos(3x)', 'sin(x^2)', 'sin(x)^2', 'cos(x)^2', 'x*sin(x)', 'x*e^x', 'x*ln(x)', 'x^2*e^x', 'x^2*sin(x)', 'x^2*cos(x)', 'e^x*sin(x)', 'e^x*cos(x)', 'e^(-x)*sin(x)', 'sin(x)*cos(x)', 'ln(x)/x', 'x/(x+1)', '(x+1)/(x-1)', '1/(x^2+1)', 'x/(x^2+1)', 'sin(x)/x', 'e^x/x', '(x^2+1)/(x^2-1)', 'sqrt(x^2+1)', 'sqrt(1-x^2)', 'x*sqrt(x+1)', 'atan(x)', 'asin(x)', 'acos(x)', 'atan(2x)', 'x*atan(x)', 'sinh(x)', 'cosh(x)', 'tanh(x)', 'x^x', 'x^sin(x)', 'ln(sin(x))', 'e^(sin(x))', 'sin(e^x)', '(2x+1)^5', '(x^2+3)^4', 'cos(x)/sin(x)', 'tan(x)*sec(x)']
    },
    {
        id: 'second-derivatives', group: 'Derivatives', mode: 'derivative', tool: 'derivative-calculator',
        intro: 'A second derivative is the derivative of the derivative. It tells you about concavity: where it is positive the graph curves upward, where it is negative it curves downward.',
        h1: f => `Second derivative of ${plain(f)}`, q: (f, tex) => `\\frac{d^{2}}{dx^{2}}\\left[${tex}\\right]`,
        opts: () => ({ order: '2' }),
        items: ['x^4', 'x^3-3x', 'sin(x)', 'cos(x)', 'e^x', 'e^(2x)', 'ln(x)', 'x*e^x', 'x^2*sin(x)', '1/x', 'sqrt(x)', 'tan(x)', 'atan(x)', 'x*ln(x)', 'e^(-x^2)']
    },
    {
        id: 'implicit', group: 'Derivatives', mode: 'derivative', tool: 'implicit-differentiation-calculator',
        intro: 'When y is defined by an equation instead of a formula, differentiate both sides with respect to x, apply the chain rule to every term containing y, and solve for dy/dx.',
        h1: f => `Implicit differentiation of ${plain(f)}`, q: (f, tex) => `\\text{find }\\frac{dy}{dx}\\text{ if }${tex}`,
        opts: () => ({ order: '1' }),
        items: ['x^2 + y^2 = 25', 'x^2 + y^2 = 1', 'x^2 + y^2 = 4', 'x^3 + y^3 = 6*x*y', 'x*y = 1', 'x*y = 4', 'x^2 + x*y + y^2 = 3', 'x^2 - y^2 = 1', 'x^2/9 + y^2/4 = 1', 'e^y = x', 'sin(x*y) = x', 'y^2 = x^3', 'x^3 + y^3 = 8', 'x^2*y + y^3 = 10', 'ln(x*y) = x + y']
    },
    {
        id: 'integrals', group: 'Integrals', mode: 'integral', tool: 'integral-calculator',
        intro: 'An antiderivative is a function whose derivative is the one you were given. The working names the technique (table, substitution, by parts or partial fractions) and every answer is differentiated back to confirm it.',
        h1: f => `Integral of ${plain(f)}`, q: (f, tex) => `\\int ${tex}\\,dx`,
        opts: () => ({}),
        items: ['x^2', 'x^3+2x', '1/x', '1/x^2', 'sqrt(x)', 'e^x', 'e^(2x)', 'e^(-x)', '2^x', 'sin(x)', 'cos(x)', 'tan(x)', 'sec(x)^2', 'sin(2x)', 'cos(3x)', 'sin(x)^2', 'cos(x)^2', 'sin(x)^3', 'sin(x)*cos(x)', 'tan(x)^2', 'sec(x)', '1/(x^2+1)', '1/(x^2+4)', '1/(x^2-1)', '1/(x^2-4)', '1/sqrt(1-x^2)', '1/sqrt(x^2+1)', 'x/(x^2+1)', 'x*e^x', 'x*e^(-x)', 'x^2*e^x', 'x*sin(x)', 'x*cos(x)', 'x^2*sin(x)', 'x*ln(x)', 'ln(x)', 'ln(x)^2', 'x^2*ln(x)', 'e^x*sin(x)', 'e^x*cos(x)', 'x*atan(x)', 'atan(x)', 'asin(x)', '2x*cos(x^2)', 'x*e^(x^2)', 'x/sqrt(x^2+1)', 'x*sqrt(x+1)', '1/(x*ln(x))', '(2x+1)^4', '1/(x^2+x-2)', '(x+1)/(x^2+2x+5)', '1/(x^2+2x+5)', 'x^3/(x^2+1)', '1/(1+e^x)']
    },
    {
        id: 'definite-integrals', group: 'Integrals', mode: 'integral', tool: 'definite-integral-calculator',
        intro: 'A definite integral is the signed area between a curve and the x-axis. It is found from an antiderivative and the fundamental theorem of calculus, or numerically when no antiderivative exists, and the value is checked a second way.',
        h1: ([f, a, b]) => `Integral of ${plain(f)} ${lim(a, b)}`, q: ([f, a, b], tex) => `\\int_{${a === '-inf' ? '-\\infty' : a === 'inf' ? '\\infty' : a}}^{${b === 'inf' ? '\\infty' : b === 'pi' ? '\\pi' : b}} ${tex}\\,dx`,
        input: it => it[0], expr: it => it[0], opts: it => ({ lower: it[1], upper: it[2] }),
        items: [['x^2', '0', '1'], ['x^2', '-1', '1'], ['sin(x)', '0', 'pi'], ['cos(x)', '0', 'pi/2'], ['sin(x)^2', '0', 'pi'], ['e^x', '0', '1'], ['1/x', '1', 'e'], ['1/(x^2+1)', '0', '1'], ['sqrt(x)', '0', '4'], ['x*e^x', '0', '1'], ['ln(x)', '1', 'e'], ['x*sin(x)', '0', 'pi'], ['1/x^2', '1', 'inf'], ['e^(-x)', '0', 'inf'], ['e^(-x^2)', '-inf', 'inf'], ['1/sqrt(x)', '0', '1'], ['1/(x^2+1)', '-inf', 'inf'], ['1/x', '1', 'inf'], ['x^3', '0', '2'], ['1/(1+x)', '0', '1']]
    },
    {
        id: 'limits', group: 'Limits', mode: 'limit', tool: 'limit-calculator',
        intro: "A limit describes what a function approaches near a point or at infinity. Indeterminate forms such as 0/0 are worked through with L'Hôpital's rule, and the left and right approaches are compared so jumps and infinite limits are not missed.",
        h1: ([f, a, d]) => `Limit of ${plain(f)} as x approaches ${a === 'inf' ? 'infinity' : plain(a)}${d === 'right' ? ' from the right' : d === 'left' ? ' from the left' : ''}`,
        q: ([f, a, d], tex) => `\\lim_{x\\to ${a === 'inf' ? '\\infty' : a}${d === 'right' ? '^{+}' : d === 'left' ? '^{-}' : ''}} ${tex}`,
        input: it => it[0], expr: it => it[0], opts: it => ({ point: it[1], direction: it[2] || 'both' }),
        items: [['sin(x)/x', '0'], ['(1-cos(x))/x^2', '0'], ['(e^x-1)/x', '0'], ['ln(1+x)/x', '0'], ['tan(x)/x', '0'], ['(sin(x)-x)/x^3', '0'], ['(x^2-1)/(x-1)', '1'], ['(x^2-4)/(x-2)', '2'], ['(x^3-8)/(x-2)', '2'], ['(1+1/x)^x', 'inf'], ['(1+x)^(1/x)', '0'], ['x*ln(x)', '0', 'right'], ['x^x', '0', 'right'], ['1/x', '0', 'right'], ['1/x', '0', 'left'], ['sqrt(x^2+x)-x', 'inf'], ['(3x^2+1)/(2x^2-5)', 'inf'], ['x/e^x', 'inf'], ['ln(x)/x', 'inf'], ['e^(-x)', 'inf'], ['atan(x)', 'inf'], ['(sqrt(x+1)-1)/x', '0'], ['abs(x)/x', '0'], ['(x^2+3x)/x', '0']]
    },
    {
        id: 'taylor', group: 'Series', mode: 'series', tool: 'taylor-series-calculator',
        intro: 'A Taylor series rewrites a function as a polynomial built from its derivatives at a point. Each coefficient is f⁽ⁿ⁾(a)/n!, and the plot shows how the polynomial hugs the function near the centre.',
        h1: f => `Taylor series of ${plain(f)}`, q: (f, tex) => `${tex}\\;\\approx\\;T_{n}(x)`,
        opts: () => ({ point: '0', terms: '7' }),
        items: ['e^x', 'sin(x)', 'cos(x)', 'ln(1+x)', '1/(1-x)', 'atan(x)', 'sqrt(1+x)', '(1+x)^3', 'tan(x)', 'sinh(x)', 'cosh(x)', 'e^(-x^2)', 'x*e^x', '1/(1+x)', 'e^x*cos(x)', 'ln(1-x)', '1/(1+x^2)', 'asin(x)']
    },
    {
        id: 'laplace', group: 'Transforms', mode: 'laplace', tool: 'laplace-transform-calculator',
        intro: 'The Laplace transform turns a function of t into a function of s, which turns differential equations into algebra. The answer is built term by term from the standard table and checked by integrating e^(−st)·f(t) numerically.',
        h1: f => `Laplace transform of ${plain(f)}`, q: (f, tex) => `\\mathcal{L}\\left\\{${tex}\\right\\}`,
        opts: () => ({ op: 'laplace' }),
        items: ['1', 't', 't^2', 't^3', 'e^(-2t)', 'e^(3t)', 'sin(2t)', 'cos(3t)', 't*e^(-t)', 't^2*e^(-3t)', 'e^(-t)*sin(2t)', 'e^(-t)*cos(t)', 'sinh(2t)', 'cosh(t)', 't*sin(t)', 't*cos(2t)', 'sin(t)*cos(t)', 't*e^(2t)', 'sin(t)^2', 'e^(2t)*cos(3t)']
    },
    {
        id: 'inverse-laplace', group: 'Transforms', mode: 'laplace', tool: 'laplace-transform-calculator',
        intro: 'The inverse Laplace transform recovers f(t) from F(s). The fraction is split into partial fractions (including repeated and complex poles) and each piece is read off the table; the result is transformed back to confirm it.',
        h1: f => `Inverse Laplace transform of ${plain(f)}`, q: (f, tex) => `\\mathcal{L}^{-1}\\left\\{${tex}\\right\\}`,
        opts: () => ({ op: 'inverse' }),
        items: ['1/s', '1/s^2', '1/(s+2)', '1/(s^2+4)', 's/(s^2+9)', '1/(s-3)^2', '1/(s*(s+1))', '(s+3)/(s^2+2s+5)', '1/(s^2+2s+5)', '1/(s^2-1)', '1/(s^2*(s+1))', 's/((s+1)*(s+2))', '1/(s*(s+1)^2)', '2/(s^3)', '(s+1)/(s^2+2s+2)']
    },
    {
        id: 'equations', group: 'Equations', mode: 'solve', tool: 'equation-solver',
        intro: 'Polynomial equations are factored and solved exactly (with complex roots where needed); other equations are solved numerically on a range. Every root is substituted back into the original equation, and inequalities are tested interval by interval.',
        h1: f => `Solve ${plain(f).replace(/\s*([<>=]+)\s*/g, ' $1 ')}`, q: (f, tex) => tex,
        opts: () => ({ min: '-50', max: '50' }),
        items: ['x^2-5x+6=0', 'x^2+x-6=0', 'x^2-4=0', 'x^2+1=0', '2x+3=7', '3x-5=2x+1', 'x^2+2x+1=0', 'x^3-x=0', 'x^3-6x^2+11x-6=0', 'x^4-1=0', 'x^2-2x-1=0', '2x^2+3x-2=0', 'x^2-9=0', 'x^3-8=0', 'x^4-5x^2+4=0', 'sin(x)=0.5', 'cos(x)=x', 'e^x=3', 'ln(x)=2', 'x^2<4', 'x^2-5x+6>0', '(x-1)/(x+2)>=0', 'x^2-x-2<=0', 'x^3-x>0']
    },
    {
        id: 'matrices', group: 'Matrices', mode: 'matrix', tool: 'matrix-calculator',
        intro: 'Every matrix operation is worked row by row, and the result is verified: a determinant against a second expansion, an inverse by multiplying it with the original, eigenvalues by substituting back.',
        h1: ([op, m]) => `${{ det: 'Determinant', inverse: 'Inverse', eigen: 'Eigenvalues and eigenvectors', rank: 'Rank', lu: 'LU decomposition' }[op]} of the matrix ${'[' + m.split(';').map(r => '[' + r.trim().split(/\s+/).join(', ') + ']').join(', ') + ']'}`,
        q: ([op, m], tex) => tex, input: it => it[1], opts: it => ({ op: it[0] }),
        items: [['det', '1 2 ; 3 4'], ['det', '2 0 ; 1 3'], ['det', '1 2 3 ; 4 5 6 ; 7 8 10'], ['det', '2 1 0 ; 1 3 1 ; 0 1 2'], ['det', '3 1 2 ; 0 4 1 ; 2 0 5'], ['inverse', '1 2 ; 3 4'], ['inverse', '2 1 ; 5 3'], ['inverse', '1 2 3 ; 0 1 4 ; 5 6 0'], ['inverse', '2 0 ; 0 4'], ['eigen', '2 1 ; 1 2'], ['eigen', '1 2 ; 3 4'], ['eigen', '4 1 ; 2 3'], ['eigen', '2 0 ; 0 3'], ['eigen', '0 1 ; -1 0'], ['eigen', '1 1 ; 0 1'], ['rank', '1 2 3 ; 2 4 6 ; 1 0 1'], ['lu', '4 3 ; 6 3'], ['lu', '2 1 1 ; 4 3 3 ; 8 7 9']]
    },
    {
        id: 'algebra', group: 'Algebra', mode: 'algebra', tool: 'partial-fraction-calculator',
        intro: 'Rational functions are split into partial fractions, and polynomials are factored exactly. The pieces are added back together and compared with the original at many points.',
        h1: ([op, f]) => `${{ apart: 'Partial fractions of', factor: 'Factor' }[op]} ${plain(f)}`, q: ([op, f], tex) => tex, input: it => it[1], opts: it => ({ op: it[0] }),
        items: [['apart', '1/(x^2-1)'], ['apart', '1/(x*(x+1))'], ['apart', '(3x+5)/(x^2+2x+1)'], ['apart', '(x^2+1)/(x^3-x)'], ['apart', '1/(x^3+x)'], ['apart', '(2x+3)/(x^2+3x+2)'], ['apart', 'x^3/(x^2+1)'], ['apart', '(x+1)/(x^2-4)'], ['factor', 'x^2-1'], ['factor', 'x^3-1'], ['factor', 'x^4-1'], ['factor', 'x^2+5x+6'], ['factor', 'x^3-6x^2+11x-6'], ['factor', 'x^4-16'], ['factor', 'x^3+8']]
    },
    {
        id: 'numbers', group: 'Number theory', mode: 'number', tool: 'number-theory-calculator',
        intro: 'Large integers are factored with trial division and Pollard’s rho, and primality is tested with Miller–Rabin. Every factorisation is multiplied back to confirm it.',
        h1: ([op, v]) => (op === 'factor' ? `Prime factorisation of ${v}` : op === 'isprime' ? `Is ${v} a prime number?` : `Greatest common divisor of ${v}`),
        q: ([op, v], tex) => (op === 'factor' ? `${v}=\\;?` : op === 'isprime' ? `\\text{is }${v}\\text{ prime?}` : `\\gcd(${v})`), input: it => it[1], opts: it => ({ op: it[0] }),
        items: [...[12, 36, 60, 100, 144, 360, 1001, 2024, 10000, 123456, 999999, 600851475143].map(n => ['factor', String(n)]), ...[97, 221, 561, 1009, 7919, 1000000007].map(n => ['isprime', String(n)]), ...['12, 18', '48, 18', '100, 75', '270, 192', '17, 5'].map(p => ['gcd', p])]
    },
    {
        id: 'series', group: 'Series', mode: 'sums', tool: 'series-convergence-calculator',
        intro: 'Series are tested with the nth-term, ratio, p-series and alternating series tests, and closed forms are checked against direct summation.',
        h1: ([f, lo, hi]) => `Sum of the series ${plain(f)} from k = ${lo} to ${hi === 'inf' ? 'infinity' : hi}`, q: ([f, lo, hi], tex) => `\\sum_{k=${lo}}^{${hi === 'inf' ? '\\infty' : hi}} ${tex}`,
        input: it => it[0], expr: it => it[0], opts: it => ({ task: 'sum', lower: it[1], upper: it[2] }),
        items: [['1/k^2', '1', 'inf'], ['1/2^k', '0', 'inf'], ['(-1)^k/k', '1', 'inf'], ['1/k', '1', 'inf'], ['1/(k*(k+1))', '1', 'inf'], ['1/k!', '0', 'inf'], ['k/2^k', '1', 'inf'], ['1/k^3', '1', 'inf'], ['(1/3)^k', '0', 'inf'], ['k^2', '1', '100'], ['k', '1', '100'], ['2^k', '0', '10'], ['1/(k^2+k)', '1', 'inf']]
    },
    {
        id: 'odes', group: 'Differential equations', mode: 'ode', tool: 'differential-equation-solver',
        intro: 'First-order equations are solved in closed form when they are linear or separable, with the integrating factor or the separation shown, and the solution is substituted back into the equation.',
        h1: f => `Solve the differential equation y′ = ${String(f).replace(/\*/g, '·')}`, q: (f, tex) => `y'=${tex}`,
        opts: () => ({ odeType: 'first', x0: '0', xEnd: '3', y0: '1' }),
        items: ['x+y', 'x*y', 'y', '2y', 'y*(1-y)', 'x', 'x^2', 'y/x', 'x-y', '-y', 'sin(x)', 'e^x', '3*y-6', 'x*y^2']
    },
    {
        id: 'complex', group: 'Complex numbers', mode: 'complex', tool: 'complex-number-calculator',
        intro: 'The roots of a polynomial are found numerically and shown exactly where recognised, and each root is substituted back into the polynomial.',
        h1: f => `Roots of ${plain(f)}`, q: (f, tex) => `${tex}=0`, opts: () => ({ op: 'roots' }),
        items: ['z^2+1', 'z^3-1', 'z^4+4', 'z^2+2z+5', 'z^4-1', 'z^3+8', 'z^2-2z+2', 'z^5-1']
    }
];
