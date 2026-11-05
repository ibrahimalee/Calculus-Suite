# Third-party software

Calculus Suite Pro itself is MIT licensed (see `LICENSE`). It bundles these components in `vendor/`; each remains under its own licence.

| Component | Version | Licence | Where |
|---|---|---|---|
| [math.js](https://mathjs.org) | 11.11.0 | Apache-2.0 | `vendor/math.min.js` |
| [Algebrite](https://github.com/davidedc/Algebrite) | 1.4.0 | MIT | `vendor/algebrite.min.js` |
| [Plotly.js](https://plotly.com/javascript/) | 4.2.0 | MIT | `vendor/plotly.min.js` |
| [KaTeX](https://katex.org) | 0.19.1 | MIT | `vendor/katex/` |
| [Tesseract.js](https://github.com/naptha/tesseract.js) and `tesseract.js-core` | 5.1.1 | Apache-2.0 | `vendor/tesseract/` (loaded only when *Scan* is used) |
| English trained data (`tessdata_best`, via `@tesseract.js-data/eng`) | 4.0.0 | Apache-2.0 (package: MIT) | `vendor/tesseract/lang/` |
| [Fraunces](https://github.com/undercasetype/Fraunces) (variable) | via `@fontsource-variable/fraunces` 5.3.0 | SIL OFL 1.1 | `vendor/fonts/` |
| [IBM Plex Sans / Mono](https://github.com/IBM/plex) | via `@fontsource` 5.3.0 | SIL OFL 1.1 | `vendor/fonts/` |

Development-only: [axe-core](https://github.com/dequelabs/axe-core) (MPL-2.0) and [Playwright](https://playwright.dev) (Apache-2.0) are used by the test scripts and are not shipped to users.

Full licence texts are in each upstream project; the Apache-2.0 components require that their notices are preserved, which the `*.LICENSE.txt` files and file headers in `vendor/` do.
