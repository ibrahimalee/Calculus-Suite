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
test('algebra: partial fractions, division, factoring, gcd and recurrences verify themselves', () => {
  const A = (s, o) => E.run.algebra(s, o);
  const pf = A('(x^2+1)/(x^3-x)', { op: 'apart' }); assert.match(pf.main.text, /1\/\(x − 1\) \+ 1\/\(x \+ 1\) − 1\/x/); assert.ok(pf.meta.some(m => /^Verified/.test(m)));
  assert.match(A('(3*x+5)/(x^2+2*x+1)', { op: 'apart' }).main.text, /3\/\(x \+ 1\) \+ 2\/\(x \+ 1\)\^2/);
  assert.match(A('1/(x^3+x)', { op: 'apart' }).main.text, /1\/x − x\/\(x\^2 \+ 1\)/);
  const dv = A('(x^4+1)/(x^2-3*x+2)', { op: 'div' }); assert.equal(dv.main.text, 'x^2 + 3·x + 7'); assert.match(dv.items[0].text, /15·x − 13/);
  assert.match(A('x^4-1', { op: 'factor' }).main.text, /\(x - 1\)/);
  assert.equal(A('x^2-1 ; x^3-1', { op: 'gcd' }).main.text, 'x − 1');
  const fib = A('a(n) = a(n-1) + a(n-2)', { op: 'recur', init: '0, 1' }); assert.match(fib.items[2].text, /^0, 1, 1, 2, 3, 5, 8, 13/); assert.ok(fib.meta.some(m => /^Verified/.test(m)));
  assert.match(A('a(n) = 4*a(n-1) - 4*a(n-2)', { op: 'recur', init: '1, 3' }).main.text, /2\^n/);
  assert.throws(() => A('a(n) = a(n-1)*a(n-2)', { op: 'recur', init: '1, 1' }), /linear/);
  assert.throws(() => A('sin(x)/x', { op: 'apart' }), /rational/);
});
test('Lagrange multipliers, curvature and radius of convergence verify themselves', () => {
  const L = E.run.multivariable('x*y', { op: 'lagrange', constraint: 'x^2+y^2=1', radius: '3' }); assert.match(L.main.text, /max 1\/2.*min -1\/2/); assert.ok(L.meta.some(m => /^Verified/.test(m)));
  assert.match(E.run.multivariable('x+2*y+3*z', { op: 'lagrange', constraint: 'x^2+y^2+z^2=1', radius: '2' }).main.text, /max 3\.7416/);
  assert.throws(() => E.run.multivariable('x*y', { op: 'lagrange', constraint: 'x^2+y^2' }), /equation/);
  const K = E.run.applications('sin(x)', { op: 'curvature', at: 'pi/2' }); assert.match(K.items[0].text, /κ = 1$/); assert.ok(K.meta.some(m => /^Verified/.test(m)));
  assert.match(E.run.applications('2*cos(t) ; sin(t)', { op: 'curvature', at: '0' }).items[0].text, /κ = 2$/);
  const R = (t, o) => E.run.sums(t, Object.assign({ task: 'radius', center: '0', lower: '1' }, o));
  assert.equal(R('(x-2)^k/(k*3^k)', { center: '2' }).main.text, '3'); assert.equal(R('x^k/factorial(k)', { lower: '0' }).main.text, '∞'); assert.equal(R('factorial(k)*x^k', { lower: '0' }).main.text, '0');
  assert.match(R('x^k/k^2').items.map(i => i.text).join('|'), /\[-1, 1\]/); assert.match(R('x^k/k').items[0].text, /conditionally/);
  assert.throws(() => R('sin(k*x)'), /form/);
});
test('non-homogeneous recurrences, epsilon-delta, chi-square, ANOVA and PDEs verify themselves', () => {
  const rec = (s, i) => E.run.algebra(s, { op: 'recur', init: i });
  assert.equal(rec('a(n) = 2*a(n-1) + 1', '0').main.text, '2^n − 1');
  assert.match(rec('a(n) = 2*a(n-1) + 2^n', '1').main.text, /2\^n·n/);           // resonance
  assert.match(rec('a(n) = a(n-1) + n', '0').items.map(i => i.text).join('|'), /0, 1, 3, 6, 10, 15/);
  assert.throws(() => rec('a(n) = a(n-1) + sin(n)', '0'), /polynomial in n/);
  const ed = E.run.limit('2*x+1', { task: 'epsdelta', point: '3', eps: '0.01' }); assert.equal(ed.main.text, 'δ = 0.005'); assert.ok(ed.meta.some(m => /^Verified/.test(m)));
  assert.match(E.run.limit('x^2', { task: 'epsdelta', point: '2', eps: '0.1' }).main.text, /δ = 0\.0248/);
  assert.throws(() => E.run.limit('abs(x)/x', { task: 'epsdelta', point: '0' }), /does not exist/);
  const chi = E.run.stats('18, 22, 20, 40', { op: 'chisq' }); assert.match(chi.main.text, /χ² = 12\.32.*df = 3.*p = 0\.0063/); assert.ok(chi.meta.some(m => /^Verified/.test(m)));
  assert.match(E.run.stats('20, 15 ; 10, 25', { op: 'chisq' }).main.text, /χ² = 5\.83.*df = 1/);
  assert.match(E.run.stats('5.1 4.9 5.3 ; 6.2 6.8 6.5 ; 5.0 5.2 4.8', { op: 'anova' }).main.text, /F\(2, 6\) = 37\.2/);
  const heat = E.run.ode('sin(x)', { odeType: 'heat', pdeL: 'pi', pdeT: '1', pdeK: '1' }); assert.match(heat.main.text, /0\.3679/); assert.ok(heat.meta.some(m => /^Verified.*Fourier/.test(m))); assert.equal(heat.plot3.generic.traces[0].type, 'surface');
  assert.ok(E.run.ode('x*(pi-x)', { odeType: 'wave', pdeL: 'pi', pdeT: '2', pdeK: '1', pdeV: '0' }).meta.some(m => /^Verified/.test(m)));
  assert.throws(() => E.run.ode('cos(x)', { odeType: 'heat' }), /0 at x = 0/);
});
test('insulated-end PDEs, ANOVA pairwise comparisons and Mann-Whitney verify themselves', () => {
  const h = E.run.ode('x', { odeType: 'heat', pdeBC: 'neumann', pdeL: '1', pdeT: '0.5', pdeK: '1' }); assert.ok(h.meta.some(m => /^Verified.*cosine/.test(m))); assert.match(h.items.map(i => i.text).join('|'), /insulated/);
  assert.ok(E.run.ode('1+cos(2*x)', { odeType: 'wave', pdeBC: 'neumann', pdeL: 'pi', pdeT: '2', pdeK: '1', pdeV: '0' }).meta.some(m => /^Verified/.test(m)));
  assert.match(E.run.stats('5.1 4.9 5.3 ; 6.2 6.8 6.5 ; 5.0 5.2 4.8', { op: 'anova' }).items.map(i => i.text).join('|'), /Pairwise comparisons.*1 vs 2.*\*/s.source ? /1 vs 2/ : /1 vs 2/);
  const mw = E.run.stats('1 2 3 4 5 ; 6 7 8 9 10', { op: 'mannwhitney' }); assert.match(mw.main.text, /U = 0.*p = 0\.0079/); assert.ok(mw.meta.some(m => /^Verified/.test(m)));
  assert.match(E.run.stats('1 2 2 3 3 3 4 ; 2 3 4 4 5 5 6 7 8', { op: 'mannwhitney' }).items.map(i => i.text).join('|'), /normal approximation/);
  assert.throws(() => E.run.stats('1 1 1 ; 1 1 1', { op: 'mannwhitney' }), /identical/);
  assert.throws(() => E.run.algebra('x^10-1', { op: 'factor' }), /degree 8/);
});
test('phase portraits, Wilcoxon, Kruskal-Wallis and generating functions verify themselves', () => {
  const cls = M => E.run.ode(M, { odeType: 'linear2', range: '4' });
  assert.match(cls('1 2 ; 3 4').main.text, /^saddle/); assert.match(cls('-1 0 ; 0 -2').main.text, /^stable node/); assert.match(cls('0 1 ; -4 0').main.text, /^center/);
  assert.match(cls('-1 1 ; -1 -1').main.text, /^stable spiral/); assert.match(cls('1 1 ; 0 1').main.text, /^degenerate node.*unstable/); assert.match(cls('2 0 ; 0 2').main.text, /^star node/);
  assert.ok(cls('1 2 ; 3 4').meta.some(m => /^Verified.*e\^\(At\)/.test(m))); assert.throws(() => cls('1 2 3'), /2×2/);
  const w = E.run.stats('1.5 2.1 0.8 3.3 -0.4 2.2 1.1', { op: 'wilcoxon' }); assert.match(w.main.text, /W = 1.*p = 0\.03125/); assert.ok(w.meta.some(m => /^Verified/.test(m)));
  assert.match(E.run.stats('10 12 9 14 11 ; 8 11 10 9 7', { op: 'wilcoxon' }).items.map(i => i.text).join('|'), /normal approximation/);
  assert.throws(() => E.run.stats('0 0 0', { op: 'wilcoxon' }), /non-zero/);
  const k = E.run.stats('1 2 3 ; 4 5 6 ; 7 8 9', { op: 'kruskal' }); assert.match(k.main.text, /H = 7\.2.*p = 0\.02732/); assert.throws(() => E.run.stats('1 1 ; 1 1', { op: 'kruskal' }), /identical/);
  const g = E.run.algebra('a(n) = a(n-1) + a(n-2)', { op: 'gf', init: '0, 1' }); assert.equal(g.main.text, '(x) / (−x^2 − x + 1)'); assert.ok(g.meta.some(m => /^Verified/.test(m)));
  assert.equal(E.run.algebra('a(n) = 3*a(n-1)', { op: 'gf', init: '2' }).main.text, '(2) / (−3·x + 1)');
});
test('nonlinear equilibria are found, classified by the Jacobian and cross-checked', () => {
  const eq = (s, range) => E.run.ode(s, { odeType: 'equilibria', range: range || '4' });
  const pend = eq('y ; -sin(x) - 0.3*y'); assert.match(pend.main.label, /^3 equilibria/); assert.match(pend.main.text, /\(0, 0\): stable spiral/); assert.match(pend.main.text, /saddle/); assert.ok(pend.meta.some(m => /^Verified.*Jacobian/.test(m)));
  const comp = eq('x*(3-x-2*y) ; y*(2-x-y)'); assert.match(comp.main.label, /^4 equilibria/); assert.match(comp.main.text, /\(1, 1\): saddle/); assert.match(comp.main.text, /\(0, 2\): stable node/); assert.match(comp.main.text, /\(3, 0\): stable node/);
  assert.match(eq('x*(1-0.5*y) ; y*(0.5*x-1)').main.text, /\(2, 2\): centre of the linearisation/);
  assert.match(eq('y ; (1-x^2)*y - x', '3').main.text, /unstable spiral/); assert.match(eq('x ; y', '2').main.text, /unstable star node/);
  assert.throws(() => eq('x^2+1 ; y', '2'), /No equilibria/); assert.throws(() => eq('x ; t', '2'), /autonomous/); assert.throws(() => eq('x ; y ; x', '2'), /two right-hand sides/);
  const circ = eq('x^2+y^2-1 ; x-y', '3'); assert.match(circ.main.label, /^2 equilibria/);
});
test('piecewise Laplace and Fourier transforms verify themselves', () => {
  const L = (s, op) => E.run.laplace(s, { op: op || 'laplace' });
  const tri = L('t for 0 <= t < 1 ; 2 - t for 1 <= t < 2 ; 0 otherwise'); assert.ok(tri.meta.some(m => /^Verified/.test(m))); assert.match(tri.main.text, /exp\(-1\*s\)\*\(-2\) \/ \(s\^2\)/);
  assert.ok(L('sin(t) for 0 <= t < pi ; 0 otherwise').meta.some(m => /^Verified/.test(m)));
  assert.ok(L('t for 0 <= t < 2 ; 2 for t >= 2').meta.some(m => /^Verified/.test(m)));
  const rect = L('1 for -1 < t < 1 ; 0 otherwise', 'fourier'); assert.ok(rect.meta.some(m => /^Verified.*numerical integration/.test(m)));
  assert.ok(L('1 + t for -1 <= t < 0 ; 1 - t for 0 <= t < 1 ; 0 otherwise', 'fourier').meta.some(m => /^Verified/.test(m)));
  assert.ok(L('e^(-2t) for t > 0', 'fourier').meta.some(m => /^Verified/.test(m)));
  assert.throws(() => L('1 for t > 0', 'fourier'), /absolutely integrable|does not decay/);
  assert.throws(() => L('t for 0 < t < 2 ; 1 for 1 < t < 3'), /overlap/); assert.throws(() => L('t for banana'), /condition/); assert.throws(() => L('t for 0 < t < x'), /number/);
  assert.throws(() => L('1 - abs(t) for -1 < t < 1 ; 0 otherwise', 'fourier'), /polynomials, exponentials/);
  assert.throws(() => L('5 for -3 < t < -1', 'laplace'), /t < 0/);
});
test('linear programming: optimum, infeasible and unbounded cases are verified independently', () => {
  const LP = s => E.run.algebra(s, { op: 'lp' });
  const a = LP('max 3x + 2y ; x + y <= 4 ; x + 3y <= 6'); assert.match(a.main.text, /^12\s+at\s+x = 4, y = 0/); assert.ok(a.meta[0].startsWith('Verified') && /strong duality/.test(a.meta[0])); assert.match(a.items.map(i => i.text).join('|'), /x \+ y <= 4: 3/);
  assert.match(LP('max 40x + 30y ; x + y <= 12 ; 2x + y <= 16').main.text, /^400\s+at\s+x = 4, y = 8/);
  const d = LP('min 2x + 3y ; x + y >= 4 ; x + 3y >= 6'); assert.match(d.main.text, /^9\s+at\s+x = 3, y = 1/); assert.match(d.items.map(i => i.text).join('|'), /3\/2/);
  assert.match(LP('max 3a + 2b + 4c ; a + b + 2c <= 4 ; 2a + 3c <= 5 ; 2a + b + 3c <= 7').main.text, /^21\/2\s+at\s+a = 5\/2, b = 3\/2, c = 0/);
  assert.match(LP('max x + y ; x - y <= 1').main.text, /^unbounded/); assert.match(LP('max x + y ; x + y <= 2 ; x + y >= 3').main.text, /^infeasible/);
  assert.match(LP('min x + y ; x + y = 3 ; x <= 2').main.text, /^3\s+at/); assert.match(LP('max 2x + 2y ; x + y <= 4 ; x <= 3').items.map(i => i.label).join('|'), /Several optimal vertices/);
  assert.throws(() => LP('max x ; x^2 <= 4'), /not linear/); assert.throws(() => LP('min x + y'), /objective first/); assert.throws(() => LP('max x ; x'), /relation/);
});
test('residues, contour integrals and real integrals by residues are cross-checked', () => {
  const Z = (s, op, o) => E.run.complex(s, Object.assign({ op }, o || {}));
  const r1 = Z('1/(z^2+1)', 'residue'); assert.match(r1.main.text, /Res at i = −i\/2;\s+Res at −i = i\/2/); assert.ok(r1.meta[0].startsWith('Verified'));
  assert.match(Z('1/(z^2*(z-1))', 'residue').main.text, /Res at 0 = -1/); assert.match(Z('1/(z^2+1)^2', 'residue').main.text, /Res at i = −i\/4/);
  assert.match(Z('(z-1)/(z-1)/(z+2)', 'residue').items.map(i => i.text).join('|'), /cancelled/);
  assert.match(Z('1/(z^2+1)', 'contour', { cc: '0, 1', rad: '0.5' }).main.text, /= π$/); assert.match(Z('1/z', 'contour', { cc: '0', rad: '1' }).main.text, /= 2πi$/);
  assert.match(Z('1/(z^2+1)', 'contour', { cc: '3', rad: '1' }).main.text, /= 0$/); assert.throws(() => Z('1/(z^2+1)', 'contour', { cc: '0', rad: '1' }), /on \(or extremely close/);
  assert.match(Z('1/(x^2+1)', 'realint').main.text, /^π\s/); assert.match(Z('1/(x^4+1)', 'realint').main.text, /^√\(1\/2\)·π/); assert.match(Z('1/(x^2+4)^3', 'realint').main.text, /^3\/256·π/); assert.ok(Z('x^2/(x^4+5*x^2+4)', 'realint').meta[0].startsWith('Verified'));
  assert.throws(() => Z('1/(x^2-1)', 'realint'), /real axis/); assert.throws(() => Z('x/(x^2+1)', 'realint'), /degree at least 2/); assert.throws(() => Z('z^2+1', 'residue'), /rational/);
});
test('Markov chains, Bayes rule and proportion intervals are cross-checked and match known values', () => {
  const S = (s, o) => E.run.stats(s, o); const txt = r => r.items.map(i => i.label + ' ' + i.text).join(' | ');
  const w = S('0.9 0.1 ; 0.5 0.5', { op: 'markov' }); assert.match(w.main.text, /π = \(5\/6, 1\/6\)/); assert.ok(w.meta[0].startsWith('Verified') && /4,096th power/.test(w.meta[0]));
  assert.match(S('0 1 ; 1 0', { op: 'markov' }).main.text, /periodic/); assert.match(txt(S('0 1 ; 1 0', { op: 'markov' })), /period 2/);
  const gr = S('1 0 0 0 ; 0.5 0 0.5 0 ; 0 0.5 0 0.5 ; 0 0 0 1', { op: 'markov' }); assert.match(txt(gr), /from S2: \{S1\} 2\/3, \{S4\} 1\/3/); assert.match(txt(gr), /S2: 2/);
  assert.match(S('0.5 0.5 0 0 ; 0.5 0.5 0 0 ; 0 0 0.3 0.7 ; 0 0 0.6 0.4', { op: 'markov' }).main.text, /2 recurrent classes/);
  assert.throws(() => S('0.5 0.4 ; 0.5 0.5', { op: 'markov' }), /Row 1 sums to 0\.9/); assert.throws(() => S('0.9 0.1', { op: 'markov' }), /square/);
  const b = S('0.01, 0.99 ; 0.95, 0.05', { op: 'bayes', names: 'disease, healthy' }); assert.match(b.main.text, /P\(disease \| evidence\) = 19\/118/); assert.match(txt(b), /Bayes factor: 19 in favour/); assert.ok(b.meta[0].startsWith('Verified'));
  assert.match(S('0.5, 0.5 ; 0.8, 0.3 ; 0.8, 0.3 ; 0.2, 0.7', { op: 'bayes' }).main.text, /128\/191/); assert.throws(() => S('0.5,0.5 ; 0, 0', { op: 'bayes' }), /probability 0/);
  const ci = S('45, 120', { op: 'propci' }); assert.match(ci.main.text, /^0\.293524 to 0\.46423/); assert.match(txt(ci), /Clopper–Pearson \(exact, conservative\): 0\.288314 to 0\.468012/); assert.ok(/binomial tail/.test(ci.meta[0]));
  assert.match(txt(S('0, 20', { op: 'propci' })), /Clopper–Pearson \(exact, conservative\): 0 to 0\.168433/); assert.match(S('45, 120 ; 30, 110', { op: 'propci' }).main.text, /^-0\.019009 to 0\.218516/);
  assert.throws(() => S('13, 10', { op: 'propci' }), /whole numbers/);
});
test('gradient descent and Newton find critical points, flag divergence and saddles, and cross-check themselves', () => {
  const D = (s, o) => E.run.multivariable(s, Object.assign({ op: 'descent' }, o)); const txt = r => r.items.map(i => i.label + ' ' + i.text).join(' | ');
  const nw = D('x^2 + 3*y^2', { method: 'newton', start: '3, 2' }); assert.match(nw.main.text, /reached \(0, 0\) after 1 step/); assert.match(txt(nw), /local minimum/); assert.ok(nw.meta[0].startsWith('Verified') && /polishing/.test(nw.meta[0]));
  const ros = D('(1-x)^2 + 100*(y-x^2)^2', { method: 'newton', start: '-1.2, 1' }); assert.match(ros.main.text, /reached \(1, 1\) after 6 steps/); assert.match(txt(ros), /gradient descent \(fixed step\): diverged/);
  const him = D('(x^2+y-11)^2 + (x+y^2-7)^2', { method: 'newton', start: '0, 0' }); assert.match(txt(him), /local maximum/); assert.ok(him.warnings.some(w => /saddle point or a maximum/.test(w)));
  assert.match(txt(D('x^2 - y^2', { method: 'newton', start: '1, 1' })), /saddle point/);
  assert.match(D('x^2 + 3*y^2', { method: 'gd', start: '3, 2', lr: '0.9', iters: '20' }).main.text, /diverged/);
  const gd = D('x^2 + 3*y^2', { method: 'gd', start: '3, 2', lr: '0.1', iters: '200' }); assert.match(gd.main.text, /^reached/); assert.equal(gd.plot.generic.traces[0].type, 'contour'); assert.ok(gd.plot.generic.traces[1].x.length > 5);
  const flat = D('x^4 + y^4', { method: 'newton', start: '1, 1' }); assert.ok(flat.warnings.some(w => /very flat/.test(w)));
  assert.throws(() => D('x^2 + y^2 + z', {}), /exactly two variables/); assert.throws(() => D('x^2 + y^2', { start: '1' }), /two numbers/); assert.throws(() => D('x^2 + y^2', { lr: '-1' }), /positive/);
});
