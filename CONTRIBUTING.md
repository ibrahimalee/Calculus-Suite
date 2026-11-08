# Contributing

This is a static web app with no build step.

```
npm install              # dev dependencies only (tests)
npm run serve            # http://localhost:8080
npm test                 # unit tests (Node)
npm i -D playwright && npx playwright install chromium    # once, for the browser tests
BASE=http://localhost:8080 npm run e2e
```

## Rules of thumb

- A maths result should either be exact and checked, or say that it is numerical. A new tool should check itself (differentiate an antiderivative, multiply a factorisation back, compare with a second method) and add a `Verified:` line.
- Add a test for every fix and every new operation in `tests/*.test.js`.
- `js/engine.js`, `js/extras.js` and `js/nlp.js` have no DOM access, so they run in the page, the worker and Node. The interface is `js/app.js`.
- Never `eval` or `new Function` user input. Expressions go through the math.js whitelist in `engine.parse`.
- No tracking and no network calls at runtime other than fetching the app's own files.
- Keep contrast at WCAG AA and everything usable from the keyboard.
- If you edit an inline `<script>` in a page, run `npm run csp` so the Content-Security-Policy hashes in `vercel.json` match.

## Where things are

| Area | Files |
|---|---|
| Core calculus | `js/engine.js` |
| Transforms, vector calculus, statistics, number theory, units, complex, and most other tools | `js/extras.js` |
| Plain-English parser | `js/nlp.js` |
| Interface, tool list, notebook, scanning | `js/app.js`, `app.html`, `css/styles.css` |
| Colours, fonts and page background | `css/tokens.css` |
| Worksheets and gradebook | `js/classroom.js`, `js/teacher.js`, `js/worksheet.js` |
| Background worker | `js/worker.js`, `js/runner.js` |

## Adding a tool

1. Write `runYourTool(src, opts)` in `js/extras.js`, return `I.makeResult(...)`, and register it with `register({ yourtool: runYourTool })`.
2. Describe it in `MODES.yourtool` in `js/app.js` (fields, examples) and add it to `MODE_GROUPS`.
3. Optionally teach `js/nlp.js` a phrase for it.
4. Add unit tests, and check that `node tests/e2e/new-tools.js` still passes, since it runs every example.

## Translations

Interface strings are in `js/i18n.js` as `'English text': [es, fr, ar, ur, hi]`. Add or correct a row and run `npm test`, which checks that every row has all five columns. The English must match the text in `app.html` or `js/app.js` exactly. Review by native speakers is the most useful contribution right now.

## Reporting a problem

Send the exact input, the options you chose, what you expected and what you got. For wrong maths, a second source helps a lot.
