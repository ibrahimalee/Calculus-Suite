# Contributing

Thank you for helping! This is a static, offline-capable web app with **no build step**.

```bash
npm install          # dev dependencies only (tests)
npm run serve        # http://localhost:8080
npm test             # unit tests (Node)
python3 -m http.server 8099 &      # the browser tests expect this address (or set BASE=...)
npm i -D playwright && npx playwright install chromium   # once
npm run e2e          # browser tests (Playwright)
```

## Ground rules

* **Correctness first.** Every maths result should either be exact and checked, or clearly say it is numerical. New tools should verify themselves (differentiate an antiderivative, multiply a factorisation back, compare against an independent method) and add a `Verified:` line to the result.
* **Add a test** for every bug fix and every new operation (`tests/*.test.js`). Bugs found by fuzzing or property tests are welcome as regression tests.
* **Engine code is DOM-free** (`js/engine.js`, `js/extras.js`, `js/nlp.js`) so it runs in the page, the Web Worker and Node. UI code lives in `js/app.js`.
* **Never use `eval` or `new Function` on user input.** Expressions go through the math.js AST whitelist in `engine.parse`.
* **No tracking, no network calls** at runtime other than fetching the app's own files.
* **Accessibility:** keep WCAG AA contrast (the axe audit must report no violations) and full keyboard operation.
* Keep the design language: paper/ink palette, serif display type, mono labels, flat surfaces. No gradients, glass or glow.

## Where things are

| Area | File |
|---|---|
| Core calculus engine | `js/engine.js` |
| Transforms, vector calculus, statistics, number theory, units, complex, worked solutions | `js/extras.js` |
| Plain-English parser | `js/nlp.js` |
| UI, tools list, notebook, image scan | `js/app.js`, `app.html`, `css/styles.css` |
| Background worker | `js/worker.js`, `js/runner.js` |

## Adding a tool

1. Implement `runYourTool(src, opts)` in `js/extras.js` returning a result from `I.makeResult(...)` and register it with `register({ yourtool: runYourTool })`.
2. Describe it in `MODES.yourtool` in `js/app.js` (fields, examples) and add it to `MODE_GROUPS` and `MODE_DESC`.
3. Optionally teach `js/nlp.js` to recognise a phrase for it.
4. Add unit tests and make sure `node tests/e2e/new-tools.js` still passes (it runs every example).

## Reporting problems

Please include the exact input, the options you chose, what you expected and what you saw. For wrong maths, a second source (another CAS or a hand calculation) helps enormously.

## Translations

Interface strings live in `js/i18n.js` as `'English text': [es, fr, ar, ur, hi]`. Add or correct a row and run `npm test` (it checks that every row has all five columns and keeps digits). The text must match the English in `app.html` / `js/app.js` exactly. Native-speaker review of the existing translations is especially welcome.
