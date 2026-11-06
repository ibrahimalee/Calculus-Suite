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
  assert.match(E.run.matrix('2 1 -1;-3 -1 2;-2 1 2', { op: 'rref' }).steps.map(s => s.text).join(' '), /rank 3/);
});
const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const num = t => parseFloat(String(t).replace(/[^\d.eE+-]/g, ' ').trim().split(/\s+/)[0]);
test('Laplace transform table', () => {
  assert.equal(E.run.laplace('t^2*exp(-3t)', {}).main.text, '(2) / ((s + 3)^3)');
  assert.ok(E.run.laplace('sin(2t)*cos(t)', {}).meta.some(m => /Verified/.test(m)));
  assert.ok(E.run.laplace('(s+3)/(s^2+2s+5)', { op: 'inverse' }).meta.some(m => /Verified/.test(m)));
  assert.ok(E.run.laplace('1/(s*(s+1)^2)', { op: 'inverse' }).meta.some(m => /Verified/.test(m)));
  assert.throws(() => E.run.laplace('1/t', {}), /Laplace table/);
});
test('Fourier transform recognises standard pairs', () => { const r = E.run.laplace('exp(-3*t^2)', { op: 'fourier' }); assert.match(r.main.text, /√\(π\/a\)/); assert.ok(r.meta.some(m => /Verified/.test(m))); });
test('vector calculus', () => {
  const J = E.run.vector('r*cos(t) ; r*sin(t)', { op: 'jacobian', vars: 'r, t' }); assert.ok(J.items.some(i => i.label === 'det J =' && i.text === 'r'));
  close(num(E.run.vector('x^2+y^2', { op: 'line', px: 'cos(t)', py: 'sin(t)', ta: '0', tb: '2*pi' }).main.text), 2 * Math.PI);
  close(num(E.run.vector('1', { op: 'triple', xLow: '-1', xHigh: '1', yLow: '-sqrt(1-x^2)', yHigh: 'sqrt(1-x^2)', zLow: '-sqrt(1-x^2-y^2)', zHigh: 'sqrt(1-x^2-y^2)' }).main.text), 4 / 3 * Math.PI, 1e-4);
  close(num(E.run.vector('x*y*z', { op: 'triple', xLow: '0', xHigh: '1', yLow: '0', yHigh: 'x', zLow: '0', zHigh: 'x+y' }).main.text), 17 / 144);
});
test('linear-algebra extras verify themselves', () => {
  for (const [m, op, extra] of [['4 3;6 3', 'lu'], ['1 2;3 4;5 6', 'qr'], ['4 2;2 3', 'cholesky'], ['1 2;3 4;5 6', 'svd'], ['1 2 3;4 5 6', 'pinv'], ['2 1;1 2', 'diagonalize'], ['1 1;1 2;1 3', 'leastsquares', { b: '1 ; 2 ; 2' }]]) {
    const r = E.run.matrix(m, Object.assign({ op }, extra || {})); const v = r.meta.find(x => /^Verified/.test(x)); assert.ok(v, op); const e = parseFloat(v.match(/= ([\d.e+-]+)/)[1]); assert.ok(e < 1e-9, `${op}: ${e}`);
  }
  assert.throws(() => E.run.matrix('1 1;0 1', { op: 'diagonalize' }), /defective/);
});
test('statistics match textbook values', () => {
  const N = (x, p) => num(E.run.stats(x, { op: 'dist', dist: 'normal', params: '0,1', what: p }).main.text);
  close(N('1.96', 'le'), 0.9750021, 1e-6); close(N('0.975', 'inv'), 1.959964, 1e-6);
  close(num(E.run.stats('2.2281', { op: 'dist', dist: 't', params: '10', what: 'le' }).main.text), 0.975, 1e-4);
  close(num(E.run.stats('3', { op: 'dist', dist: 'binomial', params: '10, 0.5', what: 'le' }).main.text), 0.171875, 1e-9);
  assert.match(E.run.stats('1 2.1 ; 2 3.9 ; 3 6.2 ; 4 7.8 ; 5 10.1', { op: 'regression', model: 'linear' }).main.text, /0\.05 \+ 1\.99/);
  assert.equal(E.run.stats('2 4 4 4 5 5 7 9', { op: 'describe' }).main.text, '5');
});
test('number theory is exact', () => {
  assert.equal(E.run.number('600851475143', { op: 'factor' }).main.text, '71 · 839 · 1471 · 6857');
  assert.equal(E.run.number('2, 100, 13', { op: 'powmod' }).main.text, '3');
  assert.equal(E.run.number('2 mod 3 ; 3 mod 5 ; 2 mod 7', { op: 'crt' }).main.text, '23 (mod 105)');
  assert.equal(E.run.number('52, 5', { op: 'ncr' }).main.text, '2598960');
  assert.throws(() => E.run.number('4, 8', { op: 'modinv' }), /no inverse/);
});
test('units are dimension-checked and sandboxed', () => {
  assert.match(E.run.units('5 km/h to m/s', {}).main.text, /^1\.38888/);
  assert.throws(() => E.run.units('5 kg to m', {}), /different things/);
  assert.throws(() => E.run.units('evaluate("1+1")', {}), /allowed/);
  assert.throws(() => E.run.units('import({a:1})', {}), /allowed/);
});
test('complex tools', () => {
  assert.equal(E.run.complex('(3+4i)*(1-2i)/(2+i)', { op: 'arith' }).main.text, '4 − 3i');
  assert.equal(E.run.complex('z^4-1', { op: 'roots' }).main.text, '1,  i,  -1,  -i');
  const d = E.run.complex('(z^2-1)/(z^2+1)', { op: 'domain' }); assert.ok(d.plot.generic.traces[0].z.length === 150);
});
test('regression: LU with several row swaps verifies (permutation convention)', () => {
  for (const m of ['-3 5 3 -3 ; -5 3 -3 0 ; -1 1 0 -5 ; -5 -1 1 5', '-4 1 -3 -3 ; -3 3 5 5 ; 2 -3 -3 3 ; 4 0 1 0']) {
    const r = E.run.matrix(m, { op: 'lu' }); assert.ok(parseFloat(r.meta.find(x => /^Verified/.test(x)).match(/= ([\d.e+-]+)/)[1]) < 1e-9);
  }
});
test('regression: Laplace of a three-pole-group sum keeps its leading numerator terms', () => {
  const r = E.run.laplace('0.5*t^3*exp(2t)*cos(3t) - 1*t*exp(-3t)*cos(t) + 2*t^3*exp(-3t)*sin(2t)', {});
  assert.ok(r.meta.some(m => /Verified/.test(m)), r.warnings.join());
});
test('complex arithmetic rejects unknown symbols cleanly', () => { assert.throws(() => E.run.complex('s+1', { op: 'arith' }), /Unknown symbol/); });
test('symbolic sums give verified closed forms', () => {
  const r = E.run.sums('k^2', { lower: '1', upper: 'n' }); assert.ok(r.meta.some(m => /Verified/.test(m)));
  assert.equal(E.run.sums('2^k', { lower: '0', upper: 'n' }).main.text, '2 ^ (n + 1) - 1');
  assert.throws(() => E.run.sums('sin(k)/k', { lower: '1', upper: 'n' }), /closed form/);
});
test('Laplace with steps and impulses; ODE by Laplace verifies by substitution', () => {
  assert.ok(E.run.laplace('u(t-2)*(t-2)', {}).meta.some(m => /Verified/.test(m)));
  assert.match(E.run.laplace('2*dirac(t-2)', {}).main.text, /exp\(-2\*s\)/);
  for (const o of [{ order: '2', a: '3', b: '2', y0: '1', v0: '0', f: '0' }, { order: '2', a: '0', b: '4', y0: '0', v0: '0', f: 'cos(2t)' }, { order: '1', a: '2', y0: '3', f: '1' }]) { const r = E.run.laplace(o.f, Object.assign({ op: 'ode' }, o)); assert.ok(r.meta.some(m => /Verified/.test(m)), o.f); }
});
test('vector theorems: both sides agree and match known values', () => {
  assert.ok(E.run.vector('-y ; x', { op: 'green', xLow: '0', xHigh: '2', yLow: 'x^2/4', yHigh: 'x' }).meta.some(m => /Verified/.test(m)));
  assert.ok(E.run.vector('x*y ; y*z ; z*x', { op: 'divergence', xLow: '0', xHigh: '2', yLow: '-1', yHigh: '1', zLow: '1', zHigh: '3' }).meta.some(m => /Verified/.test(m)));
  const sph = { sx: 'sin(u)*cos(v)', sy: 'sin(u)*sin(v)', sz: 'cos(u)', ua: '0', ub: 'pi', va: '0', vb: '2*pi' };
  close(num(E.run.vector('1', Object.assign({ op: 'surface' }, sph)).main.text), 4 * Math.PI); close(num(E.run.vector('x ; y ; z', Object.assign({ op: 'flux' }, sph)).main.text), 4 * Math.PI);
});
test('power-series ODE solutions match known series and verify against RK4', () => {
  const r = E.run.ode('y', { odeType: 'first', x0: '0', y0: '1', terms: '6', series: 'yes' }); assert.match(r.main.text, /^1 \+ x \+ 1\/2\*x\^2 \+ 1\/6\*x\^3/); assert.ok(r.meta.some(m => /Verified/.test(m)));
  const c = E.run.ode('-y', { odeType: 'second', x0: '0', y0: '1', v0: '0', terms: '8', series: 'yes' }); assert.match(c.main.text, /^1 − 1\/2\*x\^2 \+ 1\/24\*x\^4/); assert.ok(c.meta.some(m => /Verified/.test(m)));
  assert.throws(() => E.run.ode('1/x', { odeType: 'first', x0: '0', y0: '1', series: 'yes' }), /singular|cannot|finite/i);
});
test('telescoping sums collapse to verified closed forms', () => {
  const S = (t, up) => E.run.sums(t, { lower: '1', upper: up || 'n' });
  assert.equal(S('1/(k*(k+1))').main.text, '1 - 1 / (n + 1)');
  for (const t of ['1/(k*(k+2))', '1/(k*(k+1)*(k+2))', '1/(k*(k+3))', 'ln(1+1/k)', 'sqrt(k+1)-sqrt(k)', '1/(sqrt(k)+sqrt(k+1))', '(2*k+1)/(k^2*(k+1)^2)', 'atan(1/(1+k*(k+1)))']) { const r = S(t); assert.ok(r.meta.some(m => /Verified/.test(m)), t); assert.ok(r.meta.some(m => /telescop/i.test(m)), t); }
  assert.throws(() => S('1/k'), /closed form/);       // the harmonic numbers are not elementary
});
test('3-D direction field for a 3-equation ODE system', () => {
  const r = E.run.ode('10*(y-x) ; x*(28-z)-y ; x*y-8/3*z', { odeType: 'system', x0: '0', xEnd: '20', initial: '1, 1, 1' });
  assert.deepEqual(r.plot3.generic.traces.map(t => t.type), ['cone', 'scatter3d', 'scatter3d']); assert.ok(r.plot3.generic.traces[1].x.length > 500);
  assert.equal(E.run.ode('y ; -x', { odeType: 'system', x0: '0', xEnd: '6', initial: '1, 0' }).plot3, null);
});
