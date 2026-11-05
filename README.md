# Calculus Suite Pro

A calculus workstation that runs entirely in the browser – no backend, no build step, works offline.

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
| **Sums & series** | Finite sums (exact when possible); infinite series with nth-term / ratio / p-series / alternating tests and accurate values |
| **Multivariable** | Gradient (+ tangent plane, directional derivative), partials, Hessian, Laplacian, critical-point classification, double integrals with variable limits, divergence, curl |
| **Matrices** (extended) | LU, QR, Cholesky, SVD, pseudoinverse, condition number, null/column space, diagonalisation, least squares – each decomposition checks itself (A − LU, QᵀQ − I, …) |
| **Transforms** | Laplace and inverse Laplace (complex and repeated poles, verified by numerical integration), Fourier transform with standard-pair recognition and spectrum plot |
| **Vector calculus** | Jacobian & determinant, line integrals ∫ f ds, work/circulation ∫ F·dr, triple integrals (exact when possible) |
| **Statistics** | Descriptive statistics, regression (linear … exponential, power, log) with R², probability distributions (normal, t, χ², binomial, Poisson …) via exact special functions, one- and two-sample t-tests |
| **Number theory** | Prime factorisation (Pollard rho), Miller–Rabin, gcd with Bézout, modular inverse/power, totient, C(n,k), Fibonacci, sieve, base conversion, Chinese remainder theorem |
| **Units** | Dimension-checked conversions (`72 degF to degC`) through a sandboxed parser |
| **Complex** | Domain colouring of f(z) with zeros/poles, all complex roots, Argand diagram, polar form |

### Ask, scan, save

* **Plain-English input** – “integrate x squared from 0 to 3”, “limit of sin x over x as x goes to 0”, “5 km/h to m/s”. A rule-based parser (`js/nlp.js`): no AI, no network; it says plainly when it cannot parse something.
* **Worked solutions** – row operations for matrices, cofactor expansion, L'Hôpital rounds for limits, linear/quadratic equation walk-throughs, and the integration technique (by parts, substitution, partial fractions) behind CAS results.
* **Scan an expression** – the *Scan* button reads printed text from a photo with Tesseract.js, entirely on the device. The ~11 MB recogniser (`vendor/tesseract/`) is fetched only when someone taps Scan, then cached for offline use. Accuracy on superscripts and fractions is limited, so the text is always shown for correction first. Handwriting is not supported.
* **Notebook** – named projects of saved results with pins and notes, stored on the device; export a notebook as Markdown, back up or import everything as JSON.

Plus: command palette (`Ctrl+K`), installable offline PWA, Markdown report export, PNG plot export, LaTeX rendering, 2D/3D/contour plots, history, shareable links (`#s=…`), copy as text/LaTeX, dark mode, keyboard shortcuts, example gallery, background worker with timeout.

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
index.html          app shell (CalculusSuite.html redirects here)
js/engine.js        all maths – DOM-free, unit-tested
js/worker.js        runs the engine off the UI thread
js/runner.js        worker management, timeout, inline fallback
js/app.js           UI, plotting, history, sharing
js/lib-guard.js     library loader with fallbacks
tests/              node:test suite
```

## Honest limitations

Symbolic integration is not complete (e.g. `e^(x²)` has no elementary antiderivative; the app says so). Limits, roots and extrema are numerical, not proofs. ODE closed forms cover linear/separable first-order and constant-coefficient homogeneous second-order; everything else is solved numerically. The Laplace table covers sums and products of polynomials, exponentials and sin/cos/sinh/cosh (no step functions or delta impulses). Fourier transforms of non-decaying functions are not ordinary functions and are refused. Image scanning reads printed text only and often mis-reads exponents; always check the recognised text.

## License
MIT
