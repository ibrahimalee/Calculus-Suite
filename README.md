# Calculus Suite

A calculus workbook that runs in the browser. You type a function or a question, and it gives the answer, the working, and a second check that the answer is right. There is no server and no build step, and once it has been opened it works offline.

Open `index.html` for the home page or `app.html` for the app. Links such as `app.html?tool=integral` and `app.html?ask=integrate x squared from 0 to 3` open a particular tool or run a question.

## What it covers

There are 26 tools, listed in `js/app.js` (`MODES`) and on the home page:

- **Calculus:** derivatives, integrals (indefinite, definite, improper), Taylor series and Padé approximants, limits, function analysis, Riemann sums, area, volume and arc length, root finding, Fourier series, multivariable and vector calculus.
- **Differential equations:** first and second order, systems, series solutions, slope fields, phase portraits, heat and wave equations, and a lab that compares numerical methods.
- **Algebra and discrete maths:** equation solver, partial fractions, recurrences, sums and series, number theory, logic and graph algorithms, matrices and their decompositions.
- **Other:** Laplace, Fourier and Z-transforms, complex numbers and conformal maps, statistics, numerical methods, geometry, unit conversion.

Around the tools: a plain-English input box (a rule-based parser in `js/nlp.js`, no network and no AI), generated practice problems, a notebook for saving results, sharing by link, embedding, export to Markdown, reading results aloud, Nemeth braille output, and six interface languages. Scanning a printed expression from a photo uses Tesseract in the browser; its 11 MB model is only downloaded the first time someone uses it.

## How the checks work

Each tool tests its own answer a second way and says so in the result. An antiderivative is differentiated back, a factorisation is multiplied out, a root is substituted into the equation, an ODE solution is compared with a numerical one. The line that starts with `Verified:` in a result is that check. When a result can't be checked, or is only numerical, it says that instead.

## Teachers

`teacher.html` builds a worksheet and gives you one link to send. Students open it, answer, and get a short code to send back. You paste the codes into the gradebook and everything is marked in your browser. Nothing is uploaded, and the answer key stays on your device unless you switch on practice mode, which puts it in the link.

Questions can use random numbers per student (made from the student's name), partial credit, time limits, and a shared question bank. A worksheet can be printed with an answer key. This is for homework and low-stakes quizzes: it can't stop a student using another tool, and a code can't prove who wrote it.

## Running it

Open `index.html` or `app.html` directly, or run `npm run serve` and visit http://localhost:8080. The libraries (math.js, Algebrite, Plotly, KaTeX) are in `vendor/`; there is no CDN fallback on purpose. Any static host will serve it as it is. On Vercel, `vercel.json` sets the caching and security headers, including a Content-Security-Policy that allows the inline scripts by hash. If you change an inline script in a page, run `npm run csp` to update those hashes; `npm test` fails when they are stale.

## Tests

```
npm install
npm test                      # unit tests for the engine, parser, classroom code and CSP hashes
npm run serve                 # then, in another shell:
BASE=http://localhost:8080 npm run e2e    # browser tests (needs Playwright's Chromium)
```

## Limits

Symbolic integration is not complete: `e^(x²)` has no elementary antiderivative, and the app says so. Limits, roots and extrema are numerical, not proofs. Closed-form ODE solutions cover linear and separable first-order equations and constant-coefficient second-order ones; everything else is numerical. The Fourier transform is refused for functions that don't decay. The translations have not been reviewed by native speakers, and the plain-English parser only understands English. Braille is an automatic transcription and should be checked by a transcriber before it is used for exams. Scanning reads printed text only and often misreads exponents, so it always shows the text for correction first.

## Licence

MIT. Third-party code and fonts are listed in `THIRD_PARTY_NOTICES.md`. The engine can also be used from Node; see `LIBRARY.md`.
