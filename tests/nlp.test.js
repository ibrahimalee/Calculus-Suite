const test = require('node:test'), assert = require('node:assert');
const NL = require('../js/nlp.js');
const cases = [
  ['partial fractions of (x^2+1)/(x^3-x)', { mode: 'algebra', opts: { op: 'apart' } }],
  ['factor x^4-1', { mode: 'algebra', opts: { op: 'factor' } }],
  ['factor 360', { mode: 'number', opts: { op: 'factor' } }],
  ['gcd of x^2-1 and x^3-1', { mode: 'algebra', opts: { op: 'gcd' } }],
  ['integrate x squared from 0 to 3', { mode: 'integral', fn: 'x^2', opts: { lower: '0', upper: '3' } }],
  ['derivative of sin x times e to the x', { mode: 'derivative', fn: 'sin(x)*e^x' }],
  ['what is the derivative of x^3 + 2x at x = 2', { mode: 'derivative', fn: 'x^3+2x', opts: { point: '2' } }],
  ['second derivative of cos x', { mode: 'derivative', fn: 'cos(x)', opts: { order: '2' } }],
  ['limit of sin x over x as x goes to 0', { mode: 'limit', fn: 'sin(x)/x', opts: { point: '0' } }],
  ['limit of 1/x as x approaches 0 from the right', { mode: 'limit', fn: '1/x', opts: { point: '0', direction: 'right' } }],
  ['limit of (1+1/x)^x as x -> infinity', { mode: 'limit', opts: { point: 'inf' } }],
  ['taylor series of e^x around 1 up to 5 terms', { mode: 'series', fn: 'e^x', opts: { point: '1', terms: '5' } }],
  ['solve 2x + 3 = 7', { mode: 'solve', fn: '2x+3=7' }],
  ['solve x squared minus 4 equals 0', null],
  ['roots of x^2 - 5x + 6', { mode: 'solve', fn: 'x^2-5x+6=0' }],
  ['plot sin x over x', { mode: 'graph', fn: 'sin(x)/x' }],
  ['determinant of [[1,2],[3,4]]', { mode: 'matrix', fn: '1 2 ; 3 4', opts: { op: 'det' } }],
  ['eigenvalues of [[2,0],[0,3]]', { mode: 'matrix', opts: { op: 'eigen' } }],
  ['integral of 1/x from 1 to infinity', { mode: 'integral', opts: { lower: '1', upper: 'inf' } }],
  ['analyze x^3 - 3x', { mode: 'analysis', fn: 'x^3-3x' }],
  ['laplace transform of t*e^(2t)', { mode: 'laplace', opts: { op: 'laplace' } }],
  ['factorize 360', { mode: 'number', fn: '360', opts: { op: 'factor' } }],
  ['5 km/h to m/s', { mode: 'units' }],
  ['dy/dx = x + y', { mode: 'ode', fn: 'x+y' }],
  ['7 choose 3', { mode: 'number', opts: { op: 'ncr' } }],
  ['hello there', null],
];
for (const [q, want] of cases) test(q, () => {
  const got = NL.parse(q);
  if (want === null) return assert.ok(got === null || got.mode, q);
  assert.ok(got, 'no parse');
  assert.strictEqual(got.mode, want.mode);
  if (want.fn) assert.strictEqual(got.fn, want.fn);
  for (const k in (want.opts || {})) assert.strictEqual(got.opts[k], want.opts[k], k);
});
