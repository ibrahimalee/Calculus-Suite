/* Content for the static tool pages in /tools/. Each page explains one tool in plain words; its worked
   examples are taken from the app's own example lists ([mode, index]) and computed by the engine at build time.
   `primary` marks the page the home-page index links to for that tool. */
module.exports = [
    {
        slug: 'derivative-calculator', mode: 'derivative', primary: true,
        title: 'Derivative Calculator with Steps',
        description: 'Differentiate any function step by step: product, quotient and chain rule, higher derivatives and the tangent line at a point. Every answer is checked numerically.',
        h1: 'Derivative calculator with steps',
        lede: 'Type a function of x and get its derivative, the rule used at each step, and a check that the answer is right. Ask for the second or third derivative, or for the slope and tangent line at a point.',
        how: [
            'The derivative is built rule by rule: the sum rule, the product and quotient rules, the chain rule and the table of standard derivatives (powers, exponentials, logarithms, trigonometric and inverse trigonometric functions). Each rule that fires becomes a step on the Steps tab, so you can follow the working the way a teacher would write it.',
            'For awkward forms such as xˣ the tool uses logarithmic differentiation. Give a value in "Evaluate / tangent line at" to get f′(a) and the equation of the tangent line, and the plot shows the function, its derivative and the tangent together.'
        ],
        check: 'The symbolic answer is compared with a numerical derivative of your function (central differences) at several sample points. The result says so when they agree, and warns you when they do not.',
        tips: ['Write powers with ^ (x^2), products with * or a space (2x, x sin(x)), and use ln for the natural logarithm.', 'Use the Variable option to differentiate with respect to t, y or any other letter; other letters are treated as constants (a partial derivative).', 'Order can be anything from 1 to 10.'],
        faq: [
            ['Does it show the steps?', 'Yes. Every rule the tool applies (product, quotient, chain, power and the standard derivatives) is listed in order on the Steps tab, with the expression after each step.'],
            ['How do I find the derivative at a point?', 'Type the point in "Evaluate / tangent line at", for example 2 or pi/4. You get f′(a), f(a) and the equation of the tangent line.'],
            ['Can it do implicit differentiation?', 'Yes. Type an equation in x and y, such as x^2 + y^2 = 25, and you get dy/dx. See the implicit differentiation calculator for details.']
        ],
        examples: [['derivative', 0], ['derivative', 1], ['derivative', 2], ['derivative', 3]],
        related: ['implicit-differentiation-calculator', 'partial-derivative-calculator', 'critical-points-calculator', 'taylor-series-calculator']
    },
    {
        slug: 'check-my-math-work', mode: 'check', primary: true,
        title: 'Check My Math Work: Find the First Wrong Step',
        description: 'Type a problem and your own working, one step per line. It finds the first wrong step and says what kind of mistake it is: a sign, a missing factor, a lost solution.',
        h1: 'Check my math work',
        lede: 'Type the problem on the first line and your working underneath, one step per line. You get every step marked right or wrong, the first mistake pointed out, and what kind of mistake it is, without being handed a whole new solution.',
        how: [
            'The first line says what you are doing: d/dx(…) for a derivative, ∫ … dx for an integral, an equation you are solving, or an expression you are simplifying. Each later line is one step of your own working.',
            'Derivative steps are compared with the true derivative; integral steps are differentiated back and compared with the integrand (a leftover ∫ … dx in a by-parts step is understood); equation steps must keep exactly the same solutions; simplification steps must keep the same value.',
            'For the first wrong step it says what went wrong: a flipped sign, a constant factor such as a forgotten chain-rule factor or a missing 1/2, a lost or added term, a solution lost by dividing by x, or a false solution gained by squaring.'
        ],
        check: 'Every step is tested numerically at fourteen values of x, so a wrong step cannot slip through because it happens to look similar. Steps that follow correctly from an earlier mistake are marked separately, so you see the one place where things went wrong.',
        tips: ['Put each step on its own line, or separate steps with =.', 'Write functions with brackets when in doubt, for example sin(2x), and use * if a product is misread.', 'Finish an integral with + C; the checker reminds you if you forget.'],
        faq: [
            ['Does it give me the answer?', 'Only for the step that is wrong, and only on the Steps tab. The point is to find your own mistake, so it shows where and what kind, and you fix it.'],
            ['Which kinds of problems can it check?', 'Derivatives, indefinite integrals (including integration by parts with a leftover integral), equations in one unknown solved line by line, and algebraic simplification and expansion.'],
            ['Can teachers use it?', 'Yes. Paste a student\'s working to find the first error quickly, or use it in class to discuss common mistakes such as (a + b)² = a² + b².']
        ],
        examples: [['check', 0], ['check', 2], ['check', 3], ['check', 4], ['check', 5], ['check', 7]],
        related: ['derivative-calculator', 'integral-calculator', 'equation-solver']
    },
    {
        slug: 'implicit-differentiation-calculator', mode: 'derivative',
        title: 'Implicit Differentiation Calculator (dy/dx)',
        description: 'Find dy/dx for an equation in x and y, such as x² + y² = 25, with the steps, the slope and tangent line at a point, second derivatives and a plot of the curve.',
        h1: 'Implicit differentiation calculator',
        lede: 'Type an equation in x and y and get dy/dx without solving for y first. Add a point to get the slope and the tangent line there, and ask for d²y/dx² if you need it.',
        how: [
            'Everything is moved to one side, F(x, y) = 0. Differentiating both sides with respect to x, and treating y as a function of x, gives F_x + F_y · y′ = 0, so y′ = −F_x / F_y. The steps show F_x and F_y and the rearrangement.',
            'For the second and third derivatives the tool differentiates y′ again, replacing every y′ that appears by the first result. Give a point as "x, y" (for example 3, 4), or just an x value to get every point of the curve with that x. The plot draws the curve itself as the zero contour of F, with the tangent line.'
        ],
        check: 'The tool solves the equation numerically for y just to either side of a point on the curve and compares the resulting slope with the formula. If the point you typed is not on the curve, it tells you by how much the two sides differ.',
        tips: ['Write the equation with a single =, for example x^3 + y^3 = 6xy.', 'If the independent variable is not x, set it in the Variable option; the other letter is the dependent one.', 'Order 1, 2 or 3 is supported for equations.'],
        faq: [
            ['What is implicit differentiation?', 'It finds dy/dx when y is defined by an equation such as x² + y² = 25 rather than by a formula y = f(x). You differentiate both sides with respect to x, using the chain rule on every term that contains y, and solve for dy/dx.'],
            ['What does it mean when F_y = 0 at my point?', 'The formula −F_x / F_y has a zero denominator there, so the tangent is vertical or the curve has a singular point (a cusp or a self-crossing). The result says which point is affected.'],
            ['Can I check my homework answer?', 'Yes. Type the equation and the point; the slope is given as an exact fraction where possible, together with the tangent line.']
        ],
        examples: [['derivative', 5], ['derivative', 6], ['derivative', 7]],
        related: ['derivative-calculator', 'partial-derivative-calculator', 'graphing-calculator']
    },
    {
        slug: 'partial-derivative-calculator', mode: 'multivariable', primary: true,
        title: 'Partial Derivative, Gradient and Hessian Calculator',
        description: 'Partial derivatives, gradients, Hessians, Laplacians, critical points of f(x, y) and double integrals, with steps and checks. Free and runs in your browser.',
        h1: 'Partial derivatives and multivariable calculus',
        lede: 'Work with functions of several variables: partial derivatives, the gradient and directional derivative, the Hessian, critical points and their type, double integrals, divergence and curl.',
        how: [
            'Choose an operation and type f(x, y) or f(x, y, z). The gradient comes with the tangent plane at a point; the Hessian is classified by its eigenvalues to tell minima, maxima and saddle points apart; double integrals accept limits that depend on the other variable.',
            'The 3D plot shows the surface or a contour map, and critical points are marked on it.'
        ],
        check: 'Derivatives are compared with finite differences, critical points are substituted back into the gradient, and double integrals are computed a second way numerically.',
        tips: ['Separate several functions or vector-field components with ;', 'List the variables in the Variables option if they are not x, y, z.', 'Give a point as 1, 0 or 1, 0, 2.'],
        faq: [
            ['How do I get a partial derivative with respect to y?', 'Choose the gradient or partial derivative operation, or in the Derivative tool set Variable to y. All other letters are held constant.'],
            ['Can it find and classify critical points?', 'Yes. It solves ∇f = 0, then uses the Hessian at each point to label it a local minimum, local maximum or saddle point, and flags cases the test cannot decide.']
        ],
        examples: [['multivariable', 0], ['multivariable', 1], ['multivariable', 2], ['multivariable', 4], ['derivative', 4]],
        related: ['lagrange-multipliers-calculator', 'vector-calculus-calculator', 'derivative-calculator']
    },
    {
        slug: 'integral-calculator', mode: 'integral', primary: true,
        title: 'Integral Calculator with Steps (Antiderivatives)',
        description: 'Indefinite integrals with the method named: substitution, integration by parts, partial fractions or a table. Each antiderivative is checked by differentiating it.',
        h1: 'Integral calculator with steps',
        lede: 'Type a function and get its antiderivative, the technique that found it, and a check by differentiation. Add limits to get a definite or improper integral.',
        how: [
            'The tool tries the standard techniques in turn: a table of known integrals, u-substitution, integration by parts, partial fractions for rational functions, and a computer-algebra fallback. The steps name the technique and show the choice of u, or of u and dv.',
            'Some functions, such as e^(x²), have no elementary antiderivative. The tool says so instead of returning something wrong, and can still give definite integrals numerically.'
        ],
        check: 'Every antiderivative is differentiated and compared with your function at many points before it is shown.',
        tips: ['Leave both limits empty for an indefinite integral; the answer includes + C.', 'Use inf and -inf for infinite limits.', 'Use the Variable option for integrals in t, u or another letter.'],
        faq: [
            ['Does it show which method was used?', 'Yes: substitution, by parts, partial fractions or a table entry, with the working on the Steps tab.'],
            ['Why does it say there is no elementary antiderivative?', 'Some integrals, like ∫e^(x²) dx or ∫sin(x)/x dx, cannot be written with the usual functions. That is a mathematical fact, not a limitation of the tool; definite versions can still be computed numerically.']
        ],
        examples: [['integral', 0], ['integral', 1], ['integral', 2]],
        related: ['definite-integral-calculator', 'partial-fraction-calculator', 'riemann-sum-calculator', 'volume-of-revolution-calculator']
    },
    {
        slug: 'definite-integral-calculator', mode: 'integral',
        title: 'Definite and Improper Integral Calculator',
        description: 'Evaluate definite and improper integrals exactly when possible, numerically otherwise, with divergence detection and the shaded area plotted.',
        h1: 'Definite and improper integral calculator',
        lede: 'Give a function and two limits. You get the exact value where one exists (with π, e and fractions recognised), a high-accuracy numerical value otherwise, and a plot of the area.',
        how: [
            'The tool finds an antiderivative and applies the fundamental theorem of calculus. Infinite limits and singular endpoints are handled as limits; integrals that grow without bound are reported as divergent.',
            'When no antiderivative exists in closed form, adaptive numerical integration (tanh-sinh and Gauss–Legendre) gives the value to many digits.'
        ],
        check: 'The exact value is compared with an independent numerical integration, and divergence is confirmed by watching the partial integrals grow.',
        tips: ['Use inf for ∞, for example lower 1 and upper inf.', 'pi, e and expressions such as pi/2 are allowed as limits.'],
        faq: [
            ['Can it tell whether an improper integral converges?', 'Yes. Integrals such as ∫₁^∞ 1/x dx are reported as divergent, and convergent ones such as ∫₀¹ 1/√x dx get their value.'],
            ['Does it give exact answers?', 'Where the antiderivative is known, yes, and common constants are recognised in the numerical value, for example √π for the Gaussian integral.']
        ],
        examples: [['integral', 3], ['integral', 4], ['integral', 5], ['integral', 6]],
        related: ['integral-calculator', 'riemann-sum-calculator', 'volume-of-revolution-calculator']
    },
    {
        slug: 'limit-calculator', mode: 'limit', primary: true,
        title: "Limit Calculator with Steps (L'Hôpital, One-Sided, at ∞)",
        description: "Two-sided and one-sided limits and limits at infinity, with L'Hôpital steps where they apply and an epsilon–delta explorer. Free, in your browser.",
        h1: 'Limit calculator',
        lede: "Find the limit of a function as x approaches a number or infinity, from either side. Indeterminate forms are worked through with L'Hôpital's rule, and limits that do not exist are reported as such.",
        how: [
            "For 0/0 and ∞/∞ forms the tool differentiates numerator and denominator and shows each round of L'Hôpital's rule. Other limits are evaluated by careful numerical approach from both sides, with the value recognised as a fraction, π or e where possible.",
            'The epsilon–delta task finds, for a chosen ε, the largest δ that works, and draws the ε-band and δ-window.'
        ],
        check: 'The left and right approaches are computed separately and compared, so a jump or an infinite limit is caught rather than averaged away.',
        tips: ['Use inf or -inf for limits at infinity.', 'Choose "From the left" or "From the right" for one-sided limits.'],
        faq: [
            ['Does it show the steps?', "Yes, when L'Hôpital's rule applies each round is shown. Otherwise the result explains how the value was found."],
            ['What if the limit does not exist?', 'The tool reports the two one-sided limits when they differ, for example |x|/x at 0, and says the two-sided limit does not exist.']
        ],
        examples: [['limit', 0], ['limit', 4], ['limit', 5], ['limit', 7], ['limit', 8], ['limit', 1]],
        related: ['derivative-calculator', 'series-convergence-calculator', 'taylor-series-calculator']
    },
    {
        slug: 'taylor-series-calculator', mode: 'series', primary: true,
        title: 'Taylor and Maclaurin Series Calculator',
        description: 'Taylor and Maclaurin polynomials about any point, with the derivative table, the error and a plot. Also Padé approximants.',
        h1: 'Taylor and Maclaurin series calculator',
        lede: 'Expand a function as a Taylor polynomial about any point, see the table of derivatives behind each coefficient, and compare the polynomial with the function on a plot.',
        how: [
            'Each coefficient is f⁽ⁿ⁾(a)/n!, computed from exact derivatives. The result lists the polynomial and the derivative table, and the plot overlays successive partial sums so you can see where the approximation is good.',
            'The Padé task gives a rational approximation [L/M], which is often far better than the Taylor polynomial of the same size, with its poles listed.'
        ],
        check: 'The coefficients are compared with numerical derivatives, and the polynomial is checked against the function near the expansion point.',
        tips: ['A Maclaurin series is a Taylor series about 0, the default point.', 'Choose the number of terms; the degree is shown with the result.'],
        faq: [
            ['What is the difference between Taylor and Maclaurin series?', 'A Maclaurin series is a Taylor series centred at 0. Set the point to expand anywhere else.'],
            ['How accurate is the polynomial?', 'The plot shows the function and the polynomial together, and the result estimates the error near the centre.']
        ],
        examples: [['series', 0], ['series', 1], ['series', 2], ['series', 3], ['series', 5]],
        related: ['series-convergence-calculator', 'derivative-calculator', 'limit-calculator']
    },
    {
        slug: 'critical-points-calculator', mode: 'analysis', primary: true,
        title: 'Critical Points, Extrema and Asymptotes Calculator',
        description: 'Find roots, critical points, local maxima and minima, inflection points, asymptotes, and where a function increases or is concave up, with a sketch.',
        h1: 'Function analysis: critical points, extrema and asymptotes',
        lede: 'Everything you need to sketch a curve: roots, critical points and their type, inflection points, vertical and horizontal asymptotes, and the intervals of increase and concavity.',
        how: ['The tool solves f′(x) = 0 and f″(x) = 0 on the interval you choose, classifies each critical point with the derivative tests, and finds asymptotes from limits. The plot marks every feature it found.'],
        check: 'Points are substituted back, and sign changes of f′ and f″ are confirmed numerically on both sides of each point.',
        tips: ['Set the x-range to look for features in a particular interval.', 'Roots and extrema are found numerically and shown to the precision you choose.'],
        faq: [
            ['Are the results exact?', 'Roots and extrema are found numerically and are accurate to many digits; they are not formal proofs. Exact values are shown when they are recognised.'],
            ['Does it find inflection points?', 'Yes, as points where f″ changes sign, with the concavity on each interval.']
        ],
        examples: [['analysis', 0], ['analysis', 1], ['analysis', 2], ['analysis', 3]],
        related: ['derivative-calculator', 'graphing-calculator', 'partial-derivative-calculator']
    },
    {
        slug: 'differential-equation-solver', mode: 'ode', primary: true,
        title: 'Differential Equation Solver (ODEs) with Steps',
        description: 'Solve first- and second-order ODEs in closed form where possible, numerically otherwise, with slope fields, phase portraits, systems and series solutions.',
        h1: 'Differential equation solver',
        lede: 'Solve ordinary differential equations: linear and separable first-order equations, constant-coefficient second-order equations, systems, and anything else numerically, with slope fields and phase portraits.',
        how: [
            'Closed forms are found for linear and separable first-order equations and for constant-coefficient second-order equations, with the integrating factor or characteristic equation shown. Other equations are solved with an adaptive Runge–Kutta method.',
            'Systems get phase portraits, equilibria are classified from the Jacobian, and power-series solutions are available about a point. The heat and wave equations are solved too.'
        ],
        check: 'A closed-form solution is substituted back into the equation, and compared with a numerical solution from the initial condition.',
        tips: ['Type the right-hand side of y′ = f(x, y), for example x + y.', 'For second-order equations use yp for y′.', 'Separate the equations of a system with ;'],
        faq: [
            ['Does it give a formula or numbers?', 'A formula when one exists for the equation type, together with a numerical solution and its plot. Otherwise the numerical solution, clearly labelled.'],
            ['Can it solve systems of ODEs?', 'Yes, including 3-D systems such as the Lorenz equations, with phase portraits and equilibrium classification for 2-D systems.']
        ],
        examples: [['ode', 0], ['ode', 1], ['ode', 2], ['ode', 4], ['ode', 9]],
        related: ['laplace-transform-calculator', 'numerical-methods-calculator', 'derivative-calculator']
    },
    {
        slug: 'laplace-transform-calculator', mode: 'laplace', primary: true,
        title: 'Laplace Transform and Inverse Laplace Calculator',
        description: 'Laplace transforms, inverse transforms by partial fractions, step and delta functions, piecewise inputs and ODEs solved by Laplace. Every result is checked numerically.',
        h1: 'Laplace transform calculator',
        lede: 'Laplace and inverse Laplace transforms, plus Fourier and Z-transforms, with the working shown. Step functions, delta impulses and piecewise functions are supported, and initial-value problems can be solved with the Laplace method.',
        how: [
            'Forward transforms use linearity and the standard table, with shifts for e^(at) and u(t − a). Inverse transforms split F(s) into partial fractions, including repeated and complex poles, and read each term off the table.',
            'The same tool does Fourier transforms with standard-pair recognition and Z-transforms for sequences.'
        ],
        check: 'Forward transforms are checked by integrating e^(−st) f(t) numerically; inverse transforms by transforming the answer back.',
        tips: ['Write u(t-a) for a step and delta(t-a) for an impulse.', 'For piecewise functions write: expression for condition ; …'],
        faq: [
            ['Does it show the region of convergence?', 'Yes, as Re(s) > σ for the transform of f(t).'],
            ['Can it solve an ODE with initial conditions?', 'Yes. Choose the ODE operation, type the equation and give y(0) and y′(0).']
        ],
        examples: [['laplace', 0], ['laplace', 1], ['laplace', 3], ['laplace', 4], ['laplace', 17]],
        related: ['z-transform-calculator', 'differential-equation-solver', 'partial-fraction-calculator']
    },
    {
        slug: 'z-transform-calculator', mode: 'laplace',
        title: 'Z-Transform and Inverse Z-Transform Calculator',
        description: 'Z-transforms of sequences with the region of convergence and poles, inverse Z-transforms by partial fractions, and linear difference equations.',
        h1: 'Z-transform calculator',
        lede: 'Find the Z-transform of a sequence, invert a transform back to a sequence, and solve linear difference equations with their transfer function and stability.',
        how: ['Sequences built from powers, polynomials and sines or cosines are transformed exactly, with poles and the region of convergence. Inverse transforms use partial fractions in z, including repeated and complex poles and impulses.'],
        check: 'Forward transforms are checked by summing the series directly; inverse transforms against long division; difference equations against the recursion.',
        tips: ['Use n as the index, for example 0.5^n or n*2^n.'],
        faq: [['What is the region of convergence?', 'The set of z for which the series converges, |z| > r for a right-sided sequence. It is listed with every transform.']],
        examples: [['laplace', 20], ['laplace', 21], ['laplace', 22]],
        related: ['laplace-transform-calculator', 'fourier-series-calculator']
    },
    {
        slug: 'fourier-series-calculator', mode: 'fourier', primary: true,
        title: 'Fourier Series Calculator with Coefficients',
        description: 'Fourier coefficients, even and odd detection, partial sums you can watch converge, the Gibbs phenomenon and a Parseval check.',
        h1: 'Fourier series calculator',
        lede: 'Compute the Fourier coefficients of a function on an interval and see the partial sums converge, including the overshoot at jumps known as the Gibbs phenomenon.',
        how: ['The coefficients a₀, aₙ and bₙ are computed by integration, using symmetry to skip terms that vanish for even or odd functions. The plot shows the function with successive partial sums.'],
        check: "Parseval's identity is checked: the energy of the function equals the sum of the squared coefficients.",
        tips: ['The default interval is [−π, π]; change it with the limits.'],
        faq: [['What is the Gibbs phenomenon?', 'Near a jump, partial sums overshoot by about 9% of the jump however many terms you take. The square-wave example shows it.']],
        examples: [['fourier', 0], ['fourier', 1], ['fourier', 2], ['fourier', 3]],
        related: ['laplace-transform-calculator', 'z-transform-calculator', 'integral-calculator']
    },
    {
        slug: 'riemann-sum-calculator', mode: 'riemann', primary: true,
        title: 'Riemann Sum Calculator (Left, Right, Midpoint, Trapezoid)',
        description: 'Left, right, midpoint, trapezoid and Simpson sums with the rectangles drawn and a table showing convergence to the integral.',
        h1: 'Riemann sum calculator',
        lede: 'Approximate an integral with left, right, midpoint, trapezoid or Simpson sums, see the rectangles drawn, and watch the sums approach the exact value as n grows.',
        how: ['The interval is split into n equal parts and the chosen rule is applied; the table repeats it for larger n so the convergence and the order of each rule are visible.'],
        check: 'The sums are compared with the exact integral where it is known, so you can see the error of each rule.',
        tips: ['Pick n and the rule in the options; Simpson needs an even n.'],
        faq: [['Which rule is most accurate?', "For smooth functions Simpson's rule is usually best, then midpoint and trapezoid, then left and right sums. The convergence table shows it for your function."]],
        examples: [['riemann', 0], ['riemann', 1], ['riemann', 2], ['riemann', 3]],
        related: ['definite-integral-calculator', 'numerical-methods-calculator', 'integral-calculator']
    },
    {
        slug: 'volume-of-revolution-calculator', mode: 'applications', primary: true,
        title: 'Area Between Curves and Volume of Revolution Calculator',
        description: 'Area between curves, volumes by disks, washers and shells, arc length, surface area, average value and curvature, with plots and checks.',
        h1: 'Area between curves, volumes and arc length',
        lede: 'Applications of integration: the area between two curves, volumes of revolution by disks, washers or shells, arc length, surface area, the average value of a function and curvature.',
        how: ['Intersections are found automatically when you do not give limits. The integral set up for each quantity is shown, then evaluated exactly or numerically.'],
        check: 'Each value is computed a second way numerically, and curvature is compared with the circle through three nearby points.',
        tips: ['For area between curves, give the second function in the extra field.'],
        faq: [['Disks or shells?', 'Both are available: revolve about the x-axis for disks and washers, or about the y-axis for shells.']],
        examples: [['applications', 0], ['applications', 2], ['applications', 3], ['applications', 4], ['applications', 6]],
        related: ['definite-integral-calculator', 'integral-calculator', 'graphing-calculator']
    },
    {
        slug: 'graphing-calculator', mode: 'graph', primary: true,
        title: 'Graphing Calculator with Sliders',
        description: 'Plot several functions at once, turn any extra letter into an animated slider, and find intersections. Free, offline and in your browser.',
        h1: 'Graphing calculator with sliders',
        lede: 'Plot one or several functions, drag sliders for any parameters, animate them, and find where curves cross.',
        how: ['Every letter other than x becomes a slider, so a*sin(b*x) gets sliders for a and b. Intersections between curves are found and listed, and the plot can be saved as an image.'],
        check: 'Intersections are refined numerically and substituted back into both functions.',
        tips: ['Separate several functions with ;', 'Press play next to a slider to animate it.'],
        faq: [['Can I plot more than one function?', 'Yes, separate them with ; and each gets its own colour and legend entry.']],
        examples: [['graph', 0], ['graph', 1], ['graph', 2], ['graph', 5]],
        related: ['critical-points-calculator', 'derivative-calculator', 'equation-solver']
    },
    {
        slug: 'newtons-method-calculator', mode: 'root', primary: true,
        title: "Newton's Method, Bisection and Secant Calculator",
        description: "Find roots with Newton's method, bisection or the secant method, with every iteration in a table and the convergence plotted.",
        h1: "Root finding: Newton's method, bisection and secant",
        lede: "Find a root of f(x) = 0 and see every iteration of Newton's method, bisection or the secant method, including when and why a method fails.",
        how: ['Each method starts from your guess or bracket and records x, f(x) and the change at every step. Newton\'s method uses the exact derivative; bisection keeps a bracket; the secant method needs two starting points.'],
        check: 'The final root is substituted into f, and the rate of convergence is shown in the table.',
        tips: ['Bisection needs an interval [a, b] where f changes sign.'],
        faq: [["Why did Newton's method not converge?", 'It can fail when f′ is zero or small near the iterates, or when there is no real root, as in x² + 1. The example shows what happens.']],
        examples: [['root', 0], ['root', 1], ['root', 2], ['root', 3]],
        related: ['equation-solver', 'numerical-methods-calculator', 'critical-points-calculator']
    },
    {
        slug: 'equation-solver', mode: 'solve', primary: true,
        title: 'Equation and Inequality Solver with Steps',
        description: 'Solve polynomial, rational, trigonometric and transcendental equations and inequalities, with real and complex roots and interval notation.',
        h1: 'Equation and inequality solver',
        lede: 'Solve equations exactly where possible, including complex roots of polynomials, and numerically otherwise. Inequalities are solved to interval notation.',
        how: ['Polynomials are factored and solved exactly, linear and quadratic equations come with a worked solution, and other equations are solved numerically on the interval you choose. Inequalities are solved by finding the critical points and testing each interval.'],
        check: 'Every root is substituted back into the original equation, and each interval of an inequality is tested at an interior point.',
        tips: ['Use < <= > >= for inequalities.', 'Set the search range for equations such as cos(x) = x.'],
        faq: [['Does it find complex roots?', 'Yes, for polynomials, listed with their multiplicity.']],
        examples: [['solve', 0], ['solve', 1], ['solve', 2], ['solve', 3], ['solve', 6], ['solve', 7]],
        related: ['newtons-method-calculator', 'partial-fraction-calculator', 'scientific-calculator']
    },
    {
        slug: 'partial-fraction-calculator', mode: 'algebra', primary: true,
        title: 'Partial Fraction Decomposition Calculator',
        description: 'Partial fractions with repeated and irreducible quadratic factors, polynomial long division, factoring, gcd and recurrence relations.',
        h1: 'Partial fractions and polynomial algebra',
        lede: 'Decompose a rational function into partial fractions, divide polynomials, factor, find gcds, and solve linear recurrences in closed form.',
        how: ['Improper fractions are first divided; the denominator is factored, and the numerators for linear, repeated and irreducible quadratic factors are found exactly.'],
        check: 'The partial fractions are added back together and compared with the original at 40 points.',
        tips: ['Type the rational function as (numerator)/(denominator).'],
        faq: [['What happens with a repeated factor?', 'Each power of the factor gets its own term, for example A/(x+1) + B/(x+1)².']],
        examples: [['algebra', 0], ['algebra', 1], ['algebra', 2], ['algebra', 4], ['algebra', 8]],
        related: ['integral-calculator', 'laplace-transform-calculator', 'equation-solver']
    },
    {
        slug: 'linear-programming-calculator', mode: 'algebra',
        title: 'Linear Programming Calculator (Simplex Method)',
        description: 'Maximise or minimise a linear objective with the two-phase simplex method, shadow prices, the feasible region plotted, and infeasible or unbounded cases explained.',
        h1: 'Linear programming calculator',
        lede: 'Solve a linear program with the simplex method. Two-variable problems get a plot of the feasible region with the optimal corner marked.',
        how: ['The constraints are put in standard form and solved with the two-phase simplex method using Bland\'s rule. Shadow prices show how much the optimum changes per unit of each constraint.'],
        check: 'For small problems every corner point of the feasible region is enumerated and compared with the simplex answer.',
        tips: ['Start with maximise or minimise, then list the constraints separated by ;'],
        faq: [['What if there is no solution?', 'The tool reports whether the problem is infeasible (no point satisfies the constraints) or unbounded (the objective can grow forever).']],
        examples: [['algebra', 14], ['algebra', 15], ['algebra', 16]],
        related: ['matrix-calculator', 'partial-fraction-calculator']
    },
    {
        slug: 'series-convergence-calculator', mode: 'sums', primary: true,
        title: 'Series Convergence Test and Sum Calculator',
        description: 'Test infinite series with the nth-term, ratio, p-series and alternating series tests, find exact sums, radius of convergence and closed forms.',
        h1: 'Series convergence and sums',
        lede: 'Decide whether a series converges, find its exact sum when one is known, compute finite sums and closed forms, and find the radius of convergence of a power series.',
        how: ['The tool applies the nth-term, ratio, p-series and alternating series tests and explains which one decides. Closed forms come from Faulhaber\'s formulas, geometric sums and telescoping.'],
        check: 'Closed forms are compared with direct summation, and limits of sums are checked numerically.',
        tips: ['Use k as the index, for example 1/k^2.', 'Leave the upper limit as inf for an infinite series.'],
        faq: [['Can it find the radius of convergence?', 'Yes, choose the radius task: you get the ratio-test radius and a verdict at each endpoint.']],
        examples: [['sums', 0], ['sums', 5], ['sums', 6], ['sums', 7], ['sums', 8], ['sums', 1]],
        related: ['taylor-series-calculator', 'limit-calculator']
    },
    {
        slug: 'matrix-calculator', mode: 'matrix', primary: true,
        title: 'Matrix Calculator: Determinant, Inverse, Eigenvalues',
        description: 'Determinants, exact inverses, eigenvalues and eigenvectors, rank, RREF, LU, QR and SVD, linear systems and least squares, with row operations shown.',
        h1: 'Matrix calculator',
        lede: 'Determinants, inverses with exact fractions, eigenvalues and eigenvectors, rank and row reduction, decompositions (LU, QR, Cholesky, SVD), linear systems and least squares.',
        how: ['Row reduction is shown operation by operation. Eigenvalues are given exactly for small matrices where possible, and decompositions are printed factor by factor.'],
        check: 'Every decomposition is multiplied back to rebuild the original matrix, and inverses are checked by A·A⁻¹ = I.',
        tips: ['Type rows separated by ; and entries by spaces, for example 2 1 ; 1 2.'],
        faq: [['Does it show row operations?', 'Yes, for inverses, determinants and RREF each row operation is listed with the matrix after it.']],
        examples: [['matrix', 0], ['matrix', 1], ['matrix', 2], ['matrix', 4], ['matrix', 6], ['matrix', 7]],
        related: ['linear-programming-calculator', 'equation-solver']
    },
    {
        slug: 'scientific-calculator', mode: 'calc', primary: true,
        title: 'Online Calculator with Exact Fractions',
        description: 'An online calculator that keeps exact fractions, recognises π and e, handles complex numbers and large integers, and remembers variables across lines.',
        h1: 'Calculator with exact fractions',
        lede: 'A calculator that gives 1/3 + 1/6 = 1/2 rather than 0.5, works with complex numbers and very large integers, and lets you define variables across lines.',
        how: ['Results are kept exact where possible and shown as fractions, roots or multiples of π; a decimal is shown alongside.'],
        check: 'Exact results are compared with the floating-point value.',
        tips: ['Use ans for the previous answer and name = value to define a variable.'],
        faq: [['Can it do complex numbers?', 'Yes, sqrt(-4) gives 2i, and i can be used in any expression.']],
        examples: [['calc', 0], ['calc', 2], ['calc', 3], ['calc', 4], ['calc', 5]],
        related: ['equation-solver', 'complex-number-calculator', 'unit-converter']
    },
    {
        slug: 'statistics-calculator', mode: 'stats', primary: true,
        title: 'Statistics Calculator: Tests, Intervals, Regression',
        description: 'Descriptive statistics, regression, distributions, t-tests, chi-square, ANOVA, nonparametric tests, confidence intervals, Bayes and Markov chains.',
        h1: 'Statistics calculator',
        lede: 'Summarise data, fit regressions, compute probabilities for common distributions and run hypothesis tests, with the formulas and assumptions stated.',
        how: ['Each test reports its statistic, degrees of freedom, p-value and decision at your significance level, in plain words. Exact p-values are used for small samples where they exist.'],
        check: 'p-values are cross-checked by numerical integration of the distribution.',
        tips: ['Separate values with commas or spaces, and groups with ;'],
        faq: [['Which tests are included?', 't-tests, chi-square goodness-of-fit and independence, one-way ANOVA, Wilcoxon, Mann–Whitney and Kruskal–Wallis, and proportion intervals.']],
        examples: [['stats', 19], ['stats', 15], ['stats', 7], ['stats', 18], ['stats', 4]],
        related: ['scientific-calculator', 'number-theory-calculator']
    },
    {
        slug: 'number-theory-calculator', mode: 'number', primary: true,
        title: 'Prime Factorisation, GCD and Modular Arithmetic Calculator',
        description: 'Prime factorisation, primality tests, gcd with Bézout coefficients, modular inverses and powers, CRT, Diophantine equations, continued fractions and Pell equations.',
        h1: 'Number theory calculator',
        lede: 'Factor large integers, test for primes, find gcds with Bézout coefficients, work modulo n, and solve Diophantine and Pell equations.',
        how: ['Factorisation uses trial division and Pollard\'s rho; primality uses Miller–Rabin. The extended Euclidean algorithm is shown step by step.'],
        check: 'Factorisations are multiplied back, and modular answers are verified by substitution.',
        tips: ['Separate several numbers with commas.'],
        faq: [['How large a number can it factor?', 'Numbers far beyond 64 bits are handled with exact big-integer arithmetic; very hard numbers with two large prime factors can take a while.']],
        examples: [['number', 0], ['number', 1], ['number', 2], ['number', 3], ['number', 4], ['number', 9]],
        related: ['scientific-calculator', 'truth-table-generator']
    },
    {
        slug: 'complex-number-calculator', mode: 'complex', primary: true,
        title: 'Complex Number Calculator: Roots, Residues, Plots',
        description: 'Complex arithmetic, polar form, all roots of a polynomial, residues and contour integrals, domain colouring and conformal maps.',
        h1: 'Complex number calculator',
        lede: 'Arithmetic and polar form, all complex roots, residues and contour integrals, real integrals by residues, domain colouring plots, conformal maps and Möbius transformations.',
        how: ['Residues are computed at every pole of a rational function, and contour integrals follow from the residue theorem. Domain colouring shows zeros and poles of f(z) at a glance.'],
        check: 'Contour and real integrals are compared with direct numerical integration.',
        tips: ['Use i for the imaginary unit and z as the variable.'],
        faq: [['Can it evaluate real integrals with residues?', 'Yes, integrals over the whole real line of rational functions, checked numerically.']],
        examples: [['complex', 13], ['complex', 11], ['complex', 0], ['complex', 5]],
        related: ['scientific-calculator', 'laplace-transform-calculator']
    },
    {
        slug: 'vector-calculus-calculator', mode: 'vector', primary: true,
        title: 'Vector Calculus Calculator: Line Integrals and Flux',
        description: "Line integrals, work, Green's and divergence theorems, surface integrals and flux, Jacobians, triple integrals and potential functions.",
        h1: 'Vector calculus calculator',
        lede: "Line integrals and work along a curve, Green's theorem and the divergence theorem checked on both sides, surface area and flux, triple integrals, Jacobians and potential functions.",
        how: ['Curves and surfaces are given parametrically. For conservative fields the tool builds the potential function and evaluates the work as f(B) − f(A).'],
        check: "Green's and divergence theorems are verified by computing both sides; line integrals by numerical integration.",
        tips: ['Separate field components with ;'],
        faq: [['How do I know if a field is conservative?', 'Choose the potential operation: it tests the cross-partials and, if they agree, builds the potential.']],
        examples: [['vector', 0], ['vector', 6], ['vector', 7], ['vector', 11], ['vector', 14]],
        related: ['partial-derivative-calculator', 'lagrange-multipliers-calculator']
    },
    {
        slug: 'lagrange-multipliers-calculator', mode: 'multivariable',
        title: 'Lagrange Multipliers Calculator',
        description: 'Constrained maxima and minima with Lagrange multipliers, every candidate checked against ∇f = λ∇g, with level curves and the constraint plotted.',
        h1: 'Lagrange multipliers calculator',
        lede: 'Find the maximum and minimum of f subject to a constraint g = c. Every candidate point is listed with its λ and the value of f.',
        how: ['The tool solves ∇f = λ∇g together with the constraint, then ranks the candidates by the value of f. For two variables the level curves and the constraint are drawn.'],
        check: 'Each candidate is checked to satisfy ∇f = λ∇g and the constraint.',
        tips: ['Give the constraint as an equation in the Constraint option, for example x^2 + y^2 = 1.'],
        faq: [['Does it handle three variables?', 'Yes, for example optimising x + 2y + 3z on the unit sphere.']],
        examples: [['multivariable', 15], ['multivariable', 16], ['multivariable', 17]],
        related: ['partial-derivative-calculator', 'critical-points-calculator']
    },
    {
        slug: 'unit-converter', mode: 'units', primary: true,
        title: 'Unit Converter with Dimension Checks',
        description: 'Convert speed, temperature, length, volume, pressure, energy and time, with a check that the units are compatible.',
        h1: 'Unit converter',
        lede: 'Convert between units by typing naturally, such as 5 km/h to m/s or 72 degF to degC. Incompatible units are refused with an explanation.',
        how: ['Units are parsed with their dimensions, so compound units such as km/h or kg·m/s² convert correctly.'],
        check: 'The dimensions of both sides are compared before converting.',
        tips: ['Write value unit to unit, for example 1 mile to km.'],
        faq: [['Why does it refuse my conversion?', 'Because the dimensions differ, for example metres to seconds.']],
        examples: [['units', 0], ['units', 1], ['units', 2], ['units', 5], ['units', 6]],
        related: ['scientific-calculator']
    },
    {
        slug: 'numerical-methods-calculator', mode: 'numerical', primary: true,
        title: 'Numerical Methods: Interpolation, Splines, Quadrature',
        description: 'Polynomial interpolation with divided differences, cubic splines, Chebyshev nodes and the Runge phenomenon, quadrature rules and finite differences.',
        h1: 'Numerical methods calculator',
        lede: 'Interpolation through data points, cubic splines, Chebyshev versus equally spaced nodes, a comparison of quadrature rules, and finite-difference derivatives.',
        how: ['Interpolating polynomials are built with divided differences in exact fractions. Splines can be natural, clamped or not-a-knot. Quadrature rules are compared side by side on the same integral.'],
        check: 'Splines are checked for C² continuity at every knot; quadrature results against a high-accuracy value.',
        tips: ['Give points as x, y pairs separated by ;'],
        faq: [['What is the Runge phenomenon?', 'High-degree interpolation at equally spaced points can oscillate wildly near the ends; Chebyshev nodes avoid it. The example shows both.']],
        examples: [['numerical', 0], ['numerical', 3], ['numerical', 6], ['numerical', 8], ['numerical', 11]],
        related: ['riemann-sum-calculator', 'newtons-method-calculator', 'differential-equation-solver']
    },
    {
        slug: 'triangle-solver', mode: 'geometry', primary: true,
        title: 'Triangle Solver and Conic Sections Calculator',
        description: 'Solve triangles from SSS, SAS, ASA, AAS or SSA (the ambiguous case), analyse conic sections, and find circles through three points.',
        h1: 'Triangle solver and geometry',
        lede: 'Solve any triangle from three of its parts, including the ambiguous SSA case with zero, one or two solutions, and analyse conic sections with their foci and axes.',
        how: ['Triangles are solved with the laws of sines and cosines; conics are classified and put in standard form, with rotation removed where needed.'],
        check: 'Solved triangles are checked against both laws and the angle sum; conic foci against the focus–directrix property.',
        tips: ['Give known sides as a, b, c and angles as A, B, C.'],
        faq: [['What is the ambiguous case?', 'With two sides and an angle not between them (SSA) there can be zero, one or two triangles. The tool lists every one.']],
        examples: [['geometry', 0], ['geometry', 1], ['geometry', 3], ['geometry', 5], ['geometry', 10]],
        related: ['scientific-calculator', 'graphing-calculator']
    },
    {
        slug: 'truth-table-generator', mode: 'discrete', primary: true,
        title: 'Truth Table Generator and Boolean Simplifier',
        description: 'Truth tables, tautology tests, canonical forms and Quine–McCluskey minimisation, plus shortest paths, spanning trees and Euler trails for graphs.',
        h1: 'Truth tables, Boolean algebra and graphs',
        lede: 'Generate a truth table, test for a tautology, find the canonical forms and a minimal expression; or run shortest-path and spanning-tree algorithms on a graph.',
        how: ['Boolean expressions are minimised with the Quine–McCluskey method. Graphs are given as weighted edges, and Dijkstra, Kruskal and Prim are run on them.'],
        check: 'The minimal expression is compared with the original on every row of the truth table; Dijkstra is checked against Bellman–Ford, and Kruskal against Prim.',
        tips: ['Use and, or, not, xor, -> or the symbols ∧ ∨ ¬.'],
        faq: [['How large an expression can it handle?', 'Up to a dozen or so variables comfortably; the truth table doubles in size with each variable.']],
        examples: [['discrete', 0], ['discrete', 1], ['discrete', 2], ['discrete', 4], ['discrete', 5]],
        related: ['number-theory-calculator', 'scientific-calculator']
    }
];
