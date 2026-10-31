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
| **Multivariable** | Gradient (+ tangent plane, directional derivative), partials, Hessian, Laplacian, critical-point classification, double integrals with variable limits, divergence, curl |

Plus: LaTeX rendering, 2D/3D/contour plots, history, shareable links (`#s=…`), copy as text/LaTeX, dark mode, keyboard shortcuts, example gallery, background worker with timeout.

## Run

Open `index.html` (or `npm run serve` and visit http://localhost:8080). All libraries are vendored in `vendor/` (math.js, Algebrite, Plotly, KaTeX); a CDN fallback is used only if a local file is missing. Deploys as-is to GitHub Pages.

## Develop

```
npm install
npm test        # unit tests for js/engine.js (Node)
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
