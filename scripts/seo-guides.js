/* Short guides under /guides/. Prose is written by hand; every worked example is computed by the engine when the
   page is built (scripts/build-seo.js), so the numbers shown can never disagree with the calculator.
   example: [mode, input, options, caption]   formula: LaTeX shown on its own line */
module.exports = [
    {
        slug: 'how-to-find-a-derivative', title: 'How to Find a Derivative: Rules and Examples', h1: 'How to find a derivative',
        description: 'The derivative rules in the order you need them: power, sum, product, quotient and chain rule, each with a worked example you can open and change.',
        lede: 'A derivative tells you how fast a function changes. Almost every derivative you will meet is built from a handful of rules, so the skill is knowing which rule to reach for.',
        tool: 'derivative-calculator',
        sections: [
            { h: 'Start with the standard derivatives', p: ['Memorise a short table: the derivative of xⁿ is n·xⁿ⁻¹, of eˣ is eˣ, of ln x is 1/x, of sin x is cos x and of cos x is −sin x. Everything else is a combination of these.'], formula: '\\frac{d}{dx}x^{n}=n\\,x^{n-1}' },
            { h: 'The sum and constant-multiple rules', p: ['Differentiate term by term, and pull constants out front. The derivative of 3x² + 5x is 6x + 5.'] },
            { h: 'The product rule', p: ['When two functions are multiplied, take the derivative of the first times the second, plus the first times the derivative of the second.'], formula: '(uv)^{\\prime}=u^{\\prime}v+uv^{\\prime}', example: ['derivative', 'x^2*sin(x)', { order: '1' }, 'Differentiate x² sin x: u = x², v = sin x'] },
            { h: 'The quotient rule', p: ['For a fraction, the derivative is (u′v − uv′) divided by v². Check the sign of the numerator: it is the derivative of the top times the bottom, minus the top times the derivative of the bottom.'], formula: '\\left(\\frac{u}{v}\\right)^{\\prime}=\\frac{u^{\\prime}v-uv^{\\prime}}{v^{2}}', example: ['derivative', '(x+1)/(x-1)', { order: '1' }, 'Differentiate (x + 1)/(x − 1)'] },
            { h: 'The chain rule', p: ['When one function sits inside another, differentiate the outside, leave the inside alone, then multiply by the derivative of the inside.'], formula: '\\frac{d}{dx}f(g(x))=f^{\\prime}(g(x))\\,g^{\\prime}(x)', example: ['derivative', 'sin(x^2)', { order: '1' }, 'Differentiate sin(x²)'] },
            { h: 'Check your answer', p: ['A quick check is to compare your formula with the slope of the graph at one or two points. The calculator does this automatically: every derivative is compared with a numerical derivative before it is shown.'] }
        ],
        faq: [['Which rule do I use first?', 'Look at the outermost operation. If it is a product use the product rule, if it is a fraction the quotient rule, and if it is a function of a function the chain rule. Inner pieces are handled the same way.'], ['Can I check my own working?', 'Yes. Type the function into the derivative calculator and compare each step with yours.']],
        related: ['chain-rule-explained', 'implicit-differentiation-explained', 'how-to-find-critical-points']
    },
    {
        slug: 'chain-rule-explained', title: 'The Chain Rule Explained with Examples', h1: 'The chain rule, explained',
        description: 'What the chain rule says, how to spot a composite function, and a method that works every time, with computed examples.',
        lede: 'The chain rule is for functions inside functions, such as sin(x²) or e^(3x+1). It is the rule people most often get wrong, because the inside derivative is easy to forget.',
        tool: 'derivative-calculator',
        sections: [
            { h: 'The idea', p: ['If y depends on u and u depends on x, then a small change in x changes u, which changes y. The rates multiply.'], formula: '\\frac{dy}{dx}=\\frac{dy}{du}\\cdot\\frac{du}{dx}' },
            { h: 'A method that works every time', p: ['Name the inside function u. Differentiate the outside with respect to u, then multiply by du/dx. Finally replace u by the original expression.'], example: ['derivative', 'e^(3x+1)', { order: '1' }, 'Differentiate e^(3x + 1): outside eᵘ, inside u = 3x + 1'] },
            { h: 'Nested layers', p: ['With three layers, such as sin(x²) squared, apply the rule twice, working from the outside in.'], example: ['derivative', 'sin(x^2)^2', { order: '1' }, 'Differentiate sin²(x²)'] },
            { h: 'The usual mistake', p: ['Forgetting to multiply by the derivative of the inside. The derivative of cos(2x) is −2·sin(2x), not −sin(2x).'], example: ['derivative', 'cos(2x)', { order: '1' }, 'Differentiate cos(2x)'] }
        ],
        faq: [['How do I know when to use the chain rule?', 'Whenever the argument of a function is anything other than a plain x: 2x, x², x + 1, eˣ and so on.']],
        related: ['how-to-find-a-derivative', 'u-substitution-explained']
    },
    {
        slug: 'implicit-differentiation-explained', title: 'Implicit Differentiation Explained Step by Step', h1: 'Implicit differentiation, explained',
        description: 'How to find dy/dx when y is not isolated, with the circle and the folium of Descartes worked out and checked.',
        lede: 'Some curves, like the circle x² + y² = 25, cannot be written as a single y = f(x). Implicit differentiation finds the slope anyway, without solving for y.',
        tool: 'implicit-differentiation-calculator',
        sections: [
            { h: 'The three steps', p: ['Differentiate both sides with respect to x. Every time you differentiate a term containing y, multiply by dy/dx (this is the chain rule). Then collect the dy/dx terms on one side and solve.'] },
            { h: 'Example: the circle', p: ['For x² + y² = 25 you get 2x + 2y·y′ = 0, so y′ = −x/y. At the point (3, 4) the slope is −3/4.'], example: ['derivative', 'x^2 + y^2 = 25', { point: '3, 4' }, 'dy/dx for x² + y² = 25 at (3, 4)'] },
            { h: 'Example: a curve with a product', p: ['When x and y are multiplied, the product rule applies as well. The folium x³ + y³ = 6xy is the classic case.'], example: ['derivative', 'x^3 + y^3 = 6*x*y', { point: '3, 3' }, 'dy/dx for x³ + y³ = 6xy at (3, 3)'] },
            { h: 'When the slope is undefined', p: ['If the denominator of dy/dx is zero at a point, the tangent there is vertical, or the curve has a corner or crossing.'] }
        ],
        faq: [['Do I need to solve for y first?', 'No, that is the point of the method. Sometimes it is not even possible.'], ['How do I find the second derivative?', 'Differentiate dy/dx again, replacing each y′ by the first result. The calculator shows this when you ask for order 2.']],
        related: ['how-to-find-a-derivative', 'chain-rule-explained']
    },
    {
        slug: 'integration-by-parts-explained', title: 'Integration by Parts: Formula, LIATE and Examples', h1: 'Integration by parts, explained',
        description: 'The integration by parts formula, how to choose u and dv, and worked examples including x·eˣ and x·ln x.',
        lede: 'Integration by parts undoes the product rule. Use it when the integrand is a product of two different kinds of function, like x·eˣ or x·sin x.',
        tool: 'integral-calculator',
        sections: [
            { h: 'The formula', p: ['Split the integrand into u and dv. Then differentiate u and integrate dv.'], formula: '\\int u\\,dv=uv-\\int v\\,du' },
            { h: 'Choosing u: LIATE', p: ['Pick u from the earliest of: Logarithmic, Inverse trigonometric, Algebraic, Trigonometric, Exponential. Whatever is left is dv. The aim is for ∫v du to be simpler than the original integral.'] },
            { h: 'Example', p: ['For ∫ x·eˣ dx take u = x (algebraic) and dv = eˣ dx. Then du = dx and v = eˣ, which leaves a simple integral.'], example: ['integral', 'x*e^x', {}, '∫ x·eˣ dx'] },
            { h: 'When the logarithm is the whole integrand', p: ['The integral of ln x looks like it has no product, but write it as 1·ln x and take u = ln x.'], example: ['integral', 'ln(x)', {}, '∫ ln x dx'] },
            { h: 'Repeating the method', p: ['For x²·eˣ you apply the method twice, because the first round leaves x·eˣ.'], example: ['integral', 'x^2*e^x', {}, '∫ x²·eˣ dx'] }
        ],
        faq: [['What if the integral comes back to itself?', 'With eˣ·sin x, two rounds of parts give the original integral again; you solve for it algebraically. The calculator handles that case.']],
        related: ['u-substitution-explained', 'partial-fractions-explained']
    },
    {
        slug: 'u-substitution-explained', title: 'u-Substitution: How and When to Use It', h1: 'u-substitution, explained',
        description: 'Recognise when substitution works, choose u, change the differential and the limits, with computed examples.',
        lede: 'Substitution undoes the chain rule. If you can see a function and, somewhere else in the integrand, its derivative, substitution turns a hard integral into an easy one.',
        tool: 'integral-calculator',
        sections: [
            { h: 'Spot the pattern', p: ['In ∫ 2x·cos(x²) dx the inside function x² has derivative 2x, and 2x is sitting right there. That is the signal.'], example: ['integral', '2x*cos(x^2)', {}, '∫ 2x·cos(x²) dx, with u = x²'] },
            { h: 'The steps', p: ['Let u be the inside function. Compute du = u′ dx. Rewrite the whole integral in terms of u, integrate, then replace u by its expression in x.'] },
            { h: 'With a constant factor', p: ['If the derivative is only off by a constant, adjust for it. For ∫ x·e^(x²) dx, du = 2x dx, so x dx = du/2.'], example: ['integral', 'x*e^(x^2)', {}, '∫ x·e^(x²) dx'] },
            { h: 'Definite integrals', p: ['Either change the limits to u-values and never go back to x, or convert back before using the original limits. Mixing the two is the usual error.'] }
        ],
        faq: [['What if there is no derivative of the inside present?', 'Try another technique: parts, partial fractions or a trigonometric identity.']],
        related: ['integration-by-parts-explained', 'chain-rule-explained']
    },
    {
        slug: 'partial-fractions-explained', title: 'Partial Fractions: Method and Worked Examples', h1: 'Partial fractions, explained',
        description: 'How to split a rational function into simpler fractions for integration, covering distinct, repeated and irreducible factors.',
        lede: 'A fraction like 1/(x² − 1) is awkward to integrate, but as a sum of two simple fractions it is easy. Partial fractions is the way to get there.',
        tool: 'partial-fraction-calculator',
        sections: [
            { h: 'Before you start', p: ['The degree of the numerator must be smaller than the degree of the denominator. If it is not, divide first and work with the remainder.'] },
            { h: 'Factor the denominator', p: ['Each distinct linear factor gets a term A/(x − a). A repeated factor (x − a)² gets two terms, A/(x − a) + B/(x − a)². An irreducible quadratic gets a numerator Bx + C.'], example: ['algebra', '1/(x^2-1)', { op: 'apart' }, 'Split 1/(x² − 1)'] },
            { h: 'Repeated factors', p: ['Every power up to the multiplicity needs its own term.'], example: ['algebra', '(3x+5)/(x^2+2x+1)', { op: 'apart' }, 'Split (3x + 5)/(x + 1)²'] },
            { h: 'Irreducible quadratics', p: ['Use a linear numerator over the quadratic.'], example: ['algebra', '1/(x^3+x)', { op: 'apart' }, 'Split 1/(x³ + x)'] },
            { h: 'Then integrate', p: ['Each piece integrates to a logarithm or an arctangent, as in the integral of 1/(x² − 1).'], example: ['integral', '1/(x^2-1)', {}, '∫ 1/(x² − 1) dx'] }
        ],
        faq: [['How do I find A, B and C?', 'Multiply through by the denominator and either compare coefficients or substitute convenient values of x. The calculator checks the result by adding the pieces back together.']],
        related: ['u-substitution-explained', 'laplace-transform-basics']
    },
    {
        slug: 'what-is-a-limit', title: 'What Is a Limit? Meaning, Methods and L’Hôpital’s Rule', h1: 'What is a limit?',
        description: 'The idea of a limit, how to compute common ones by factoring and with L’Hôpital’s rule, and when a limit does not exist.',
        lede: 'A limit asks what value a function is heading towards, not what it is at the point itself. It is the idea that calculus is built on.',
        tool: 'limit-calculator',
        sections: [
            { h: 'The idea', p: ['The limit of f(x) as x approaches a is L if f(x) can be made as close to L as you like by taking x close enough to a, without being equal to a.'], formula: '\\lim_{x\\to a}f(x)=L' },
            { h: 'Try substitution first', p: ['If f is continuous at a, the limit is just f(a). The interesting cases are 0/0 and ∞/∞.'] },
            { h: 'Factor and cancel', p: ['For (x² − 4)/(x − 2) at 2, substitution gives 0/0. Factor the top as (x − 2)(x + 2), cancel, and the limit is 4.'], example: ['limit', '(x^2-4)/(x-2)', { point: '2', direction: 'both' }, 'Limit of (x² − 4)/(x − 2) as x → 2'] },
            { h: 'L’Hôpital’s rule', p: ['For 0/0 or ∞/∞, differentiate the top and bottom separately and take the limit of the new fraction.'], example: ['limit', '(1-cos(x))/x^2', { point: '0', direction: 'both' }, 'Limit of (1 − cos x)/x² as x → 0'] },
            { h: 'Limits at infinity', p: ['Compare growth rates: exponentials beat polynomials, which beat logarithms.'], example: ['limit', 'x/e^x', { point: 'inf', direction: 'both' }, 'Limit of x/eˣ as x → ∞'] },
            { h: 'When a limit does not exist', p: ['If the left and right limits differ, the two-sided limit does not exist. The function |x|/x at 0 jumps from −1 to 1.'], example: ['limit', 'abs(x)/x', { point: '0', direction: 'both' }, 'Limit of |x|/x as x → 0'] }
        ],
        faq: [['Is the limit the same as the value?', 'Only when the function is continuous there. A function can have a limit at a point where it is not even defined.']],
        related: ['how-to-find-a-derivative', 'taylor-series-explained']
    },
    {
        slug: 'taylor-series-explained', title: 'Taylor Series Explained with Examples', h1: 'Taylor series, explained',
        description: 'How a Taylor series builds a polynomial from derivatives, the standard series to know, and how to see how good the approximation is.',
        lede: 'A Taylor series approximates a function by a polynomial that matches its value and derivatives at one point. It is how calculators evaluate sin and eˣ.',
        tool: 'taylor-series-calculator',
        sections: [
            { h: 'The formula', p: ['The coefficient of (x − a)ⁿ is the n-th derivative at a, divided by n!.'], formula: 'f(x)\\approx\\sum_{n=0}^{N}\\frac{f^{(n)}(a)}{n!}(x-a)^{n}' },
            { h: 'Maclaurin series', p: ['When the centre is a = 0 the series is called a Maclaurin series. The ones worth knowing by heart are eˣ, sin x, cos x, 1/(1 − x) and ln(1 + x).'], example: ['series', 'sin(x)', { point: '0', terms: '7' }, 'Maclaurin polynomial of sin x'] },
            { h: 'Away from zero', p: ['Expanding about another point gives a polynomial in (x − a).'], example: ['series', 'e^x', { point: '1', terms: '5' }, 'Taylor polynomial of eˣ about x = 1'] },
            { h: 'How good is it?', p: ['The polynomial is best near the centre and gets worse further away. The plot in the calculator overlays successive partial sums so you can see this.'] },
            { h: 'Radius of convergence', p: ['Some series only converge on an interval. The series for 1/(1 − x) converges only for |x| < 1.'], example: ['series', '1/(1-x)', { point: '0', terms: '7' }, 'Maclaurin polynomial of 1/(1 − x)'] }
        ],
        faq: [['What is the difference from a Maclaurin series?', 'A Maclaurin series is a Taylor series centred at 0.']],
        related: ['what-is-a-limit', 'how-to-find-a-derivative']
    },
    {
        slug: 'how-to-find-critical-points', title: 'How to Find Critical Points, Maxima and Minima', h1: 'How to find critical points and extrema',
        description: 'Use the first and second derivative to find local maxima, minima and inflection points, with a worked example you can open.',
        lede: 'Critical points are where a function stops rising or falling, so they are where maxima and minima hide. The derivative finds them, and the second derivative tells you which is which.',
        tool: 'critical-points-calculator',
        sections: [
            { h: 'Step 1: solve f′(x) = 0', p: ['Critical points occur where the derivative is zero or does not exist. Solve f′(x) = 0 for x.'] },
            { h: 'Step 2: classify with the second derivative', p: ['If f″ is positive at the point, the graph curves upward and it is a local minimum. If f″ is negative it is a local maximum. If f″ is zero the test is inconclusive and you look at the sign of f′ on both sides.'] },
            { h: 'Example', p: ['For f(x) = x³ − 3x we get f′ = 3x² − 3, zero at x = ±1, and f″ = 6x, which is negative at −1 and positive at 1.'], example: ['analysis', 'x^3-3x', { min: '-10', max: '10' }, 'Analysis of x³ − 3x'] },
            { h: 'Inflection points', p: ['Where f″ changes sign the concavity switches. These are inflection points, which can be found in the same analysis.'] },
            { h: 'Functions of two variables', p: ['Set both partial derivatives to zero and classify with the Hessian: positive definite means a minimum, negative definite a maximum, and mixed signs a saddle.'], example: ['multivariable', 'x^3-3*x+y^2', { op: 'critical' }, 'Critical points of x³ − 3x + y²'] }
        ],
        faq: [['Is a critical point always an extremum?', 'No. f(x) = x³ has f′(0) = 0 but no maximum or minimum there.']],
        related: ['how-to-find-a-derivative', 'what-is-a-limit']
    },
    {
        slug: 'riemann-sums-and-definite-integrals', title: 'Riemann Sums and the Definite Integral', h1: 'Riemann sums and the definite integral',
        description: 'How adding thin rectangles leads to the definite integral, how left, right, midpoint and trapezoid sums compare, and the fundamental theorem.',
        lede: 'A definite integral is the area under a curve. A Riemann sum approximates it with rectangles, and the integral is what the sums approach as the rectangles get thinner.',
        tool: 'riemann-sum-calculator',
        sections: [
            { h: 'Adding rectangles', p: ['Split the interval [a, b] into n pieces of width Δx. On each piece draw a rectangle whose height is the function value at the left end, the right end or the midpoint. The total area of the rectangles is the sum.'], formula: '\\int_a^b f(x)\\,dx=\\lim_{n\\to\\infty}\\sum_{i=1}^{n}f(x_i)\\,\\Delta x', example: ['riemann', 'x^2', { lower: '0', upper: '1', n: '8', rule: 'left' }, 'Left sum of x² on [0, 1] with n = 8'] },
            { h: 'Which rule is best?', p: ['Midpoint and trapezoid sums are usually far closer than left or right sums for the same n, and Simpson’s rule is closer still for smooth functions.'], example: ['riemann', 'sin(x)', { lower: '0', upper: 'pi', n: '10', rule: 'mid' }, 'Midpoint sum of sin x on [0, π]'] },
            { h: 'The fundamental theorem', p: ['If F is an antiderivative of f, then the integral from a to b is F(b) − F(a). This turns an infinite sum into a subtraction.'], example: ['integral', 'x^2', { lower: '0', upper: '1' }, 'The exact value of ∫₀¹ x² dx'] },
            { h: 'When there is no antiderivative', p: ['For functions like e^(−x²), numerical rules are the only way to get a value. Increase n until the digits stop changing.'] }
        ],
        faq: [['What does the convergence table show?', 'The same sum for larger n, so you can see how quickly each rule approaches the exact value.']],
        related: ['u-substitution-explained', 'integration-by-parts-explained']
    },
    {
        slug: 'laplace-transform-basics', title: 'Laplace Transform Basics: Table, Method and Examples', h1: 'Laplace transform basics',
        description: 'What the Laplace transform does, the standard table, how to invert it with partial fractions, and a worked example.',
        lede: 'The Laplace transform turns calculus problems in t into algebra problems in s. It is the standard tool for linear differential equations in engineering.',
        tool: 'laplace-transform-calculator',
        sections: [
            { h: 'Definition', p: ['The transform multiplies f(t) by e^(−st) and integrates from 0 to infinity.'], formula: 'F(s)=\\int_0^{\\infty}f(t)\\,e^{-st}\\,dt' },
            { h: 'A small table', p: ['Constants go to 1/s, t to 1/s², and eᵃᵗ to 1/(s − a). Sines and cosines give denominators of the form s² + ω².'], example: ['laplace', 't^2*e^(-3t)', { op: 'laplace' }, 'Transform of t²·e^(−3t)'] },
            { h: 'Shifting', p: ['Multiplying by eᵃᵗ shifts s by a. That is why t²·e^(−3t) has (s + 3) in the denominator.'] },
            { h: 'Going back', p: ['To invert, split F(s) into partial fractions and read each term off the table.'], example: ['laplace', '(s+3)/(s^2+2s+5)', { op: 'inverse' }, 'Inverse transform of (s + 3)/(s² + 2s + 5)'] },
            { h: 'Differential equations', p: ['Transforming y″ + 3y′ + 2y = 0 gives an algebraic equation for Y(s), which you solve and invert.'], example: ['laplace', '0', { op: 'ode', order: '2', a: '3', b: '2', y0: '1', v0: '0' }, 'Solve y″ + 3y′ + 2y = 0, y(0) = 1, y′(0) = 0'] }
        ],
        faq: [['Why use Laplace transforms?', 'They turn derivatives into multiplication by s, which makes linear differential equations with initial conditions algebraic.']],
        related: ['partial-fractions-explained', 'how-to-find-a-derivative']
    },
    {
        slug: 'eigenvalues-and-eigenvectors-explained', title: 'Eigenvalues and Eigenvectors Explained', h1: 'Eigenvalues and eigenvectors, explained',
        description: 'What eigenvalues and eigenvectors mean, how to compute them for a 2×2 matrix, and how to check the answer.',
        lede: 'An eigenvector of a matrix is a direction the matrix only stretches, never turns. The stretch factor is the eigenvalue.',
        tool: 'matrix-calculator',
        sections: [
            { h: 'The definition', p: ['A vector v is an eigenvector of A with eigenvalue λ if multiplying by A gives the same vector scaled by λ.'], formula: 'A\\mathbf{v}=\\lambda\\mathbf{v}' },
            { h: 'Finding eigenvalues', p: ['Rewrite the equation as (A − λI)v = 0. This has a non-zero solution only when the determinant of A − λI is zero. That determinant is a polynomial in λ called the characteristic polynomial.'], example: ['matrix', '2 1 ; 1 2', { op: 'eigen' }, 'Eigenvalues of [[2, 1], [1, 2]]'] },
            { h: 'Finding eigenvectors', p: ['For each eigenvalue, solve (A − λI)v = 0. The solutions form a line (or a plane, when the eigenvalue repeats).'] },
            { h: 'A check you can do by hand', p: ['The sum of the eigenvalues equals the trace of the matrix, and their product equals the determinant.'], example: ['matrix', '2 1 ; 1 2', { op: 'det' }, 'Determinant of the same matrix: 3 = 1 × 3'] },
            { h: 'Rotations and complex eigenvalues', p: ['A rotation has no real direction that stays put, so its eigenvalues are complex.'], example: ['matrix', '0 1 ; -1 0', { op: 'eigen' }, 'Eigenvalues of a quarter-turn rotation'] }
        ],
        faq: [['What if the eigenvalues repeat?', 'Then there may be fewer independent eigenvectors than you expect. The matrix [[1, 1], [0, 1]] has the eigenvalue 1 twice but only one eigenvector direction.']],
        related: ['how-to-find-a-derivative', 'what-is-a-limit']
    }
];
