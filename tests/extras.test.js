const test = require('node:test'), assert = require('node:assert');
const math = require('mathjs'), Alg = require('algebrite');
const E = require('../js/engine.js').create(math, Alg); require('../js/extras.js').install(E, math, Alg);
const titles = r => r.steps.map(s => s.title).join(' | ');
test('by-parts worked solution', () => { const r = E.run.integral('x*e^x', {}); assert.match(titles(r), /Integration by parts/); assert.match(titles(r), /Assemble/); });
test("L'Hôpital steps", () => { const r = E.run.limit('(1-cos(x))/x^2', { point: '0' }); assert.match(titles(r), /L'Hôpital/); assert.equal(r.main.text, '1/2'); });
test('linear and quadratic solve steps', () => {
  assert.match(titles(E.run.solve('2x+3=7', {})), /Divide by 2/);
  assert.match(titles(E.run.solve('x^2-5x+6=0', {})), /Discriminant/);
});
test('matrix row operations', () => {
  const r = E.run.matrix('1 2;3 4', { op: 'inverse' }); assert.match(titles(r), /R2 → R2 \+ 3·R1/);
  assert.match(titles(E.run.matrix('1 2 3;4 5 6;7 8 10', { op: 'det' })), /Cofactor/);
  assert.match(titles(E.run.matrix('2 1 -1;-3 -1 2;-2 1 2', { op: 'rref' })), /rank 3/);
});
