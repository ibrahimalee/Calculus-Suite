const test = require('node:test'), assert = require('node:assert');
const lib = require('../lib/index.js');
test('library entry point exposes a working engine, natural-language helper and practice generator', () => {
  const e = lib.createEngine();
  assert.match(e.run.derivative('x^2*sin(x)', {}).main.text, /cos\(x\)/);
  assert.equal(e.run.laplace('t*exp(-2t)', {}).main.text, '(1) / ((s + 2)^2)');
  const a = lib.ask(e, 'integrate x squared from 0 to 3'); assert.equal(a.mode, 'integral'); assert.match(a.result.main.text, /9/);
  assert.equal(lib.ask(e, 'zzz qqq'), null);
  assert.ok(lib.createPractice(e).generate('derivative', 1, 5).tex);
});
