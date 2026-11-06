# Using the engine as a library

The maths engine is DOM-free and runs in Node (≥ 18) and in browsers.

```js
const { createEngine, ask, createPractice } = require('calculus-suite-pro');
const engine = createEngine();

engine.run.derivative('x^2*sin(x)', {}).main.text;              // 2 * x * sin(x) + x ^ 2 * cos(x)
engine.run.integral('x*e^x', { lower: '0', upper: '1' }).main;  // exact value, verified numerically
engine.run.laplace('(s+3)/(s^2+2s+5)', { op: 'inverse' }).main.text;
engine.run.stats('1.96', { op: 'dist', dist: 'normal', params: '0, 1', what: 'le' }).main.text;

ask(engine, 'limit of sin x over x as x goes to 0');             // { mode: 'limit', fn: 'sin(x)/x', result: {...} }
createPractice(engine).generate('integral', 2, 42);              // a problem with check(answer) and hints
```

Every tool is `engine.run.<tool>(input, options)`; the tool names and option keys are the same as in the web app (see `MODES` in `js/app.js` and the examples there). A result is a plain object `{ kind, title, main, items, meta, warnings, steps, plot, text, badges }`; lines in `meta` starting with `Verified:` describe the independent check that was run.

Errors that the user can fix (bad input, unsupported case) are thrown as `engine.CalcError`.

## Publishing (maintainers)

`package.json` is marked `"private": true` so the web app is never published by accident. To publish the library: choose a free package name, set `"private": false`, then `npm publish --access public`. `npm pack --dry-run` shows exactly what ships (about 120 kB).
