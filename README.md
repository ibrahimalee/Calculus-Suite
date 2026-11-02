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

Symbolic integration is not complete (e.g. `e^(x²)` has no elementary antiderivative; the app says so). Limits, roots and extrema are numerical, not proofs. ODE closed forms cover linear/separable first-order and constant-coefficient homogeneous second-order; everything else is solved numerically.

## License
MIT
