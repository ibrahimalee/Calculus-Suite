# Calculus Suite Pro

A calculus workstation that runs entirely in the browser – no backend, no build step, works offline.

> The home page (`index.html`) introduces the app; the calculator itself is `app.html`. Deep links: `app.html?tool=integral` and `app.html?ask=integrate x squared from 0 to 3`.

## Features

| Mode | What it does |
|---|---|
| **Derivative** | Any order, any variable, rule-by-rule explanation (sum / product / quotient / chain / power), tangent line at a point |
| **Integral** | Indefinite (table, partial fractions, u-substitution, by parts, CAS – every result is verified by differentiation) and definite / improper integrals (`inf`, `pi`, endpoint singularities, divergence detection, exact value when available) |
| **Taylor series** | Maclaurin / Taylor polynomials with derivative table and overlay plot |
| **Limit** | Two-sided and one-sided, at finite points and ±∞, with closed-form recognition (`e`, `π`, fractions) |
| **Function analysis** | Roots, extrema, inflection points, vertical/horizontal asymptotes, monotonicity, concavity |
| **Differential equations** | 1st-order (linear & separable closed forms), 2nd-order (constant-coefficient closed form), systems; adaptive RK45, slope fields, phase portraits |
| **Graph & sliders** | Several functions at once, every extra letter becomes a live (animatable) slider, automatic intersections |
| **Riemann sums** | Left / right / midpoint / trapezoid / Simpson with rectangles drawn and a convergence table |
| **Area & volume** | Area between curves, arc length, disk/washer & shell volumes, surface area, average value + mean-value point |
| **Root finding** | Newton, bisection, secant with every iteration shown |
| **Fourier series** | Coefficients, even/odd detection, Gibbs phenomenon, Parseval check |
| **Matrices** | det, exact inverse, eigen-decomposition, rank/RREF, charpoly, solve Ax=b, powers |
| **Calculator** | Variables across lines, `ans`, exact fractions / π / e recognition, complex numbers, prime factorisation, binary & hex |
| **Equation solver** | All real and complex roots of polynomials, numerical roots for anything else, inequalities → interval notation |
| **Lagrange multipliers** (in Multivariable) | Constrained maxima and minima with λ, level curves and the constraint plotted, every candidate checked against ∇f = λ∇g |
| **Curvature** (in Area & volume) | κ, radius and the osculating circle for y = f(x) or a parametric curve, checked against a circle through three nearby points |
| **Radius of convergence** (in Sums & series) | Ratio-test radius for power series and endpoint-by-endpoint verdicts |
| **Epsilon–delta** (in Limits) | For a chosen ε, the largest δ that works, with the ε-band and δ-window drawn and 20,000 points checked |
| **Chi-square and ANOVA** (in Statistics) | Goodness of fit, independence tables, one-way ANOVA with Bonferroni pairwise comparisons; p-values cross-checked by numerical integration |
| **Heat and wave equations** (in ODEs) | Fixed or insulated ends; finite-difference solutions with a surface plot, checked against the exact Fourier sine or cosine series |
| **Piecewise transforms** (in Transforms) | Laplace and Fourier transforms of piecewise functions written as `expression for condition ; …`, with exact closed forms and a numerical-integration check |
| **Phase portraits** (in ODEs) | For x′ = Ax: node / saddle / spiral / centre classification, eigenvalues and eigenvectors, direction field with trajectories and eigenlines, checked against e^(At) |
| **Equilibria and stability** (in ODEs) | Finds the equilibria of a nonlinear 2-D system, classifies each from the Jacobian (saddle, node, spiral, star), draws nullclines, direction field and trajectories; flags centres as inconclusive |
| **Wilcoxon and Kruskal–Wallis** (in Statistics) | Rank-based paired and multi-group tests with exact p-values for small samples and numerical cross-checks |
| **Generating functions** (in Algebra) | Rational A(x) for a linear recurrence, verified on 56 terms |
| **Mann–Whitney U** (in Statistics) | Rank-based comparison of two samples: exact p-values for small samples, tie-corrected normal approximation otherwise |
| **Algebra** | Partial fractions (with a check at 40 points), polynomial long division, factor and expand, polynomial gcd/lcm, closed forms for linear recurrences such as Fibonacci, including extra terms like 3ⁿ or n |
| **Sums & series** (closed forms) | Symbolic upper limits: Σk^p (Faulhaber), polynomial·rᵏ terms such as k·2^k, telescoping sums (1/(k(k+1)), ln(1+1/k), √(k+1)−√k, …) – each closed form is verified against direct summation |
| **ODEs** (3-D) | Systems of three equations get a 3-D direction field (cones) with the solution trajectory, e.g. the Lorenz attractor |
| **ODEs** (series) | Power-series solutions of first- and second-order equations about x₀, checked against RK4 |
| **Sums & series** | Finite sums (exact when possible); infinite series with nth-term / ratio / p-series / alternating tests and accurate values |
| **Multivariable** | Gradient (+ tangent plane, directional derivative), partials, Hessian, Laplacian, critical-point classification, double integrals with variable limits, divergence, curl |
| **Matrices** (extended) | LU, QR, Cholesky, SVD, pseudoinverse, condition number, null/column space, diagonalisation, least squares – each decomposition checks itself (A − LU, QᵀQ − I, …) |
| **Transforms** | Laplace (including u(t−a) and δ(t−a)) and inverse Laplace (complex and repeated poles, verified by numerical integration), ODEs solved by Laplace with substitution check, Fourier transform with standard-pair recognition and spectrum plot |
| **Vector calculus** | Jacobian & determinant, line integrals ∫ f ds, work/circulation ∫ F·dr, triple integrals (exact when possible), Green's and divergence theorems checked on both sides, surface integrals and flux through r(u, v) |
| **Statistics** | Descriptive statistics, regression (linear … exponential, power, log) with R², probability distributions (normal, t, χ², binomial, Poisson …) via exact special functions, one- and two-sample t-tests |
| **Number theory** | Prime factorisation (Pollard rho), Miller–Rabin, gcd with Bézout, modular inverse/power, totient, C(n,k), Fibonacci, sieve, base conversion, Chinese remainder theorem |
| **Units** | Dimension-checked conversions (`72 degF to degC`) through a sandboxed parser |
| **Complex** | Domain colouring of f(z) with zeros/poles, all complex roots, Argand diagram, polar form |

### Ask, scan, save

* **Plain-English input** – “integrate x squared from 0 to 3”, “limit of sin x over x as x goes to 0”, “5 km/h to m/s”. A rule-based parser (`js/nlp.js`): no AI, no network; it says plainly when it cannot parse something.
* **Worked solutions** – row operations for matrices, cofactor expansion, L'Hôpital rounds for limits, linear/quadratic equation walk-throughs, and the integration technique (by parts, substitution, partial fractions) behind CAS results.
* **Scan an expression** – the *Scan* button reads printed text from a photo with Tesseract.js, entirely on the device. The ~11 MB recogniser (`vendor/tesseract/`) is fetched only when someone taps Scan, then cached for offline use. Accuracy on superscripts and fractions is limited, so the text is always shown for correction first. Handwriting is not supported.
* **Practice & teaching mode** – the ✦ button opens generated practice problems (derivatives, integrals, limits, equations, matrices, number theory, statistics) with three levels. Answers are checked numerically, so any equivalent form is accepted; hints reveal the engine's worked steps one at a time. *Teaching mode* (Appearance panel) hides answers and steps until you ask.
* **How was this checked?** – every result lists the independent check that was run; **Embed** gives an `<iframe>` code (`?embed=1`) for blogs and LMS pages; **Listen** reads the result aloud; plots carry a text description for screen readers.
* **Braille** – every result has a *Braille* button: mathematics in **Nemeth Code** (US) produced by the Speech Rule Engine, plain words in uncontracted Grade 1. Copy the Unicode braille for a refreshable display, or download a `.brf` file for an embosser. The ~1.2 MB engine is fetched only when the dialog is first opened. It is an automatic transcription, not a certified braille document – have a transcriber check it before exams or publication.
* **Languages** – interface in English, Español, Français, العربية, اردو and हिन्दी (right-to-left layout included). Maths results and step explanations stay in English, and the plain-English parser understands English only. The translations have not been reviewed by native speakers – please help improve `js/i18n.js`.
* **Phones** – collapsible tool picker and a bottom jump bar; 44-px touch targets.
* **Library** – the engine also runs in Node: see `LIBRARY.md`.
* **Notebook** – named projects of saved results with pins and notes, stored on the device; export a notebook as Markdown, back up or import everything as JSON.

Plus: command palette (`Ctrl+K`), installable offline PWA, Markdown report export, PNG plot export, LaTeX rendering, 2D/3D/contour plots, history, shareable links (`#s=…`), copy as text/LaTeX, dark mode, keyboard shortcuts, example gallery, background worker with timeout.

## For teachers: worksheets without accounts

Open `teacher.html`. Build a worksheet (write questions, or generate practice problems with checked answers), press **Create the student link**, and send that one link. Students see only the questions: no calculator unless you allow one. When they finish they get a short `CSW1.…` code to send back. Paste the codes into the **Gradebook** tab and everything is marked on your device, with a class average, per-question percentages and a CSV export.

- Question types: number, formula (any equivalent form, optional "+C"), multiple choice, short text, list of numbers, matrix, prime factorisation.
- Nothing is uploaded. The answer key lives in your browser (and in files you export), not in the student link.
- **Practice mode** puts the key in the link so students get instant ✓/✗; a curious student could read it, so use it for practice only.
- This is for homework, practice and low-stakes quizzes. It cannot stop a student using another tool, and a code cannot prove who wrote it.
- **QR code** for the student link (put it on a slide or print it); **time limits** with a start gate, a countdown that survives reloads, automatic lock and code at zero, and time used shown in the gradebook and CSV. The timer runs in the student's browser, so it is a guide, not a proctor.
- Answers typed by students are never executed: they are parsed by a whitelist of maths functions only.

## Design & trust

- A single stroke-icon set, light / dark / auto themes and six accent colours (Appearance menu), a sliding tab indicator, loading progress bar and live engine status.
- Every result carries trust badges (e.g. *Verified: the antiderivative was checked by differentiating it*) and shows how long it took and where it ran.
- WCAG 2.x AA contrast verified with axe-core in every theme/accent combination; keyboard-first (`Ctrl+K` palette, `Alt+1…9`, `Alt+R/P/D/S`).

## Run

Open `index.html` (or `npm run serve` and visit http://localhost:8080). All libraries are vendored in `vendor/` (math.js, Algebrite, Plotly, KaTeX); a CDN fallback is used only if a local file is missing. Deploys as-is to GitHub Pages.

## Deploy to Vercel

The app is a static site (`vercel.json` sets caching, security headers and the service-worker rules).

```
npm i -g vercel
vercel --prod        # run from the repository root; accept the defaults
```

or import the GitHub repository at <https://vercel.com/new> (Framework Preset: *Other*; no build command needed). Vercel deploys the repository's production branch – merge the work branch into `main`, or choose it as the production branch in *Project → Settings → Git*.

## Develop

```
npm install
npm test        # unit tests for js/engine.js (Node)
npm run serve   # then, in another shell:  BASE=http://localhost:8080 npm run e2e   (Playwright UI checks)
```

```
index.html          home page
app.html            the calculator app (CalculusSuite.html redirects here)
js/engine.js        all maths – DOM-free, unit-tested
js/worker.js        runs the engine off the UI thread
js/runner.js        worker management, timeout, inline fallback
js/app.js           UI, plotting, history, sharing
js/lib-guard.js     library loader with fallbacks
tests/              node:test suite
```

## Honest limitations

Symbolic integration is not complete (e.g. `e^(x²)` has no elementary antiderivative; the app says so). Limits, roots and extrema are numerical, not proofs. ODE closed forms cover linear/separable first-order and constant-coefficient homogeneous second-order; everything else is solved numerically. The Laplace table covers sums and products of polynomials, exponentials and sin/cos/sinh/cosh (no step functions or delta impulses). Fourier transforms of non-decaying functions are not ordinary functions and are refused. Braille lines break only at spaces (Nemeth line-breaking rules are not applied) and text outside the maths is Grade 1 only. Image scanning reads printed text only and often mis-reads exponents; always check the recognised text.

## License
MIT
