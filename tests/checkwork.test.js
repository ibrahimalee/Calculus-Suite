// "Check my work": the first wrong step is found and the kind of mistake is named; correct working passes.
const test = require('node:test'), assert = require('node:assert');
const { createEngine } = require('../lib/index.js');
const e = createEngine();
const run = s => e.run.check(s, {});
const firstBad = r => (/^step (\d+):/.exec(r.main.text) || [])[1];
const why = r => (r.items.find(i => i.label === 'What went wrong:') || {}).text || '';

test('correct working passes, in every kind of problem', () => {
  for (const s of ['d/dx(x^2 sin x)\n= 2x sin x + x^2 cos x', 'f(x) = x^3 + 5x\nf\'(x) = 3x^2 + 5', 'd/dx(sin^2 x) = 2 sin x cos x', 'd/dx(e^2x)\n= 2e^2x',
    '∫ x e^x dx\n= x e^x - ∫ e^x dx\n= x e^x - e^x + C', '2x + 3 = 7\n2x = 4\nx = 2', 'x^2 - 5x + 6 = 0\n(x-2)(x-3) = 0\nx = 2 or x = 3', '(x+1)^2 - (x-1)^2\n= x^2 + 2x + 1 - (x^2 - 2x + 1)\n= 4x']) {
    const r = run(s); assert.equal(r.main.label, 'Result:', s); assert.ok(r.badges.some(b => b.kind === 'ok'), s);
  }
});
test('derivatives: a sign error, a missing chain-rule factor and a wrong term are told apart', () => {
  assert.match(why(run('d/dx(cos x)\n= sin x')), /sign was flipped/);
  assert.match(why(run('d/dx(sin(3x))\n= cos(3x)')), /1\/3 times the right answer|constant factor/);
  const r = run('f(x) = x^3 + 5x\nf\'(x) = 3x^2 + 5x'); assert.equal(firstBad(r), '1'); assert.match(why(r), /term is wrong or missing/);
  assert.ok(r.steps.some(s => /correct version/i.test(s.title) && /3 \* x\^2 \+ 5/.test(s.text)));
});
test('integrals: a missing factor, a sign, the by-parts sign and a forgotten + C', () => {
  assert.match(why(run('∫ e^(2x) dx\n= e^(2x) + C')), /2 times the integrand/);
  assert.match(why(run('∫ sin x dx = cos x + C')), /sign was flipped/);
  assert.match(why(run('∫ x e^x dx\n= x e^x + ∫ e^x dx')), /remaining integral is wrong/);
  assert.ok(run('∫ 3x^2 dx\n= x^3').warnings.some(w => /\+ C/.test(w)));
});
test('equations: lost and gained solutions are named; later steps that follow from the slip are marked as such', () => {
  assert.match(why(run('x^2 = 5x\nx = 5')), /lost x = 0/);
  const sq = run('sqrt(x) = x - 2\nx = x^2 - 4x + 4\nx^2 - 5x + 4 = 0\nx = 1 or x = 4');
  assert.equal(firstBad(sq), '1'); assert.match(why(sq), /gained x = 1/);
  assert.ok(sq.items.filter(i => /^↳/.test(i.label)).length === 2);
  const ar = run('2x + 3 = 7\n2x = 10\nx = 5'); assert.equal(firstBad(ar), '1'); assert.ok(ar.items.some(i => /^↳ Step 2/.test(i.label)));
});
test('simplification: (a + b)² = a² + b² is caught', () => {
  const r = run('(x + 3)^2 - 9\n= x^2 + 9 - 9\n= x^2'); assert.equal(firstBad(r), '1');
});
test('bad input gets a friendly message, never a crash', () => {
  for (const s of ['', 'd/dx(', '∫ x', 'x + y = 3\nx = 3 - y', 'hello', '= = =']) {
    try { run(s); } catch (err) { assert.ok(err.message && !/undefined|is not a function|Cannot read/.test(err.message), s + ' → ' + err.message); }
  }
});
