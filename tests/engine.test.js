'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const math = require('mathjs');
const Algebrite = require('algebrite');
const E = require('../js/engine.js').create(math, Algebrite);

const close = (a, b, tol = 1e-6, msg) =>
    assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg || ''} expected ${b}, got ${a}`);
const fnOf = (src, vars = ['x']) => E.compile(E.parse(src), vars);
const resultFn = (r, i = 0) => r.plot.curves[i].fn;

test('parser: implicit multiplication, unicode, aliases', () => {
    close(fnOf('2x^2')(3), 18);
    close(fnOf('x(x+1)')(3), 12);
    close(fnOf('(x+1)(x-1)')(3), 8);
    close(fnOf('2 pi x')(1), 2 * Math.PI);
    close(fnOf('√x')(9), 3);
    close(fnOf('π')(0), Math.PI);
    close(fnOf('|x|')(-4), 4);
    close(fnOf('sin^2(x)')(1), Math.sin(1) ** 2);
    close(fnOf('ln(x)')(Math.E), 1);
    close(fnOf('arctan(1)')(0), Math.PI / 4);
    close(fnOf('log10(1000)')(0), 3);
    close(fnOf('x²')(3), 9);
});

test('parser: rejects unsafe or unsupported input', () => {
    for (const bad of ['import(1)', 'evaluate("1")', 'x=5', 'foo(x)', 'sin', '"abc"', '[1,2]', '{a:1}', '', '2x^', 'a.b']) {
        assert.throws(() => E.parse(bad), E.CalcError, bad);
    }
});

test('inspect: detects variables in a stable order', () => {
    assert.deepEqual(E.inspect('y*x + z').vars, ['x', 'y', 'z']);
    assert.deepEqual(E.inspect('t*sin(x)').vars, ['x', 't']);
    assert.equal(E.inspect('pi*e').vars.length, 0);
});

test('derivatives match numerical differentiation', () => {
    for (const src of ['x^2*sin(x)', 'exp(x)/x', 'sqrt(1+x^2)', 'atan(x)', 'x^x', 'log10(x)+2x', 'tan(x)*cos(x)']) {
        const r = E.run.derivative(src, { variable: 'x' });
        const f = fnOf(src), d = resultFn(r, 1);
        for (const x of [0.7, 1.3, 2.1]) {
            const h = 1e-5;
            close(d(x), (f(x + h) - f(x - h)) / (2 * h), 1e-5, src);
        }
    }
});

test('higher-order derivative and tangent line', () => {
    const r = E.run.derivative('x^4', { order: 3 });
    close(resultFn(r, 1)(2), 48);
    const t = E.run.derivative('x^2', { point: '3' });
    assert.ok(t.items.some(i => /Tangent line/.test(i.label)));
    close(resultFn(t, 2)(4), 9 + 6 * 1);
    assert.ok(t.steps.length >= 2);
});

test('derivative with respect to another variable', () => {
    const r = E.run.derivative('x^2*y', { variable: 'y' });
    assert.match(r.main.text, /x \^ 2/);
});

test('indefinite integrals are verified antiderivatives', () => {
    const cases = ['x^2*sin(x)', '2x*cos(x^2)', 'x*exp(x)', 'sec(x)^2', '1/x', 'x*log(x)', 'atan(x)', 'cos(x)*sin(x)^3',
        '1/(1+x^2)', 'x/(x^2+1)', 'exp(2x+1)', 'sqrt(x)', 'sin(x)^2', 'x^2*exp(x)', 'log(x)', '1/(x^2-1)', 'abs(x)', 'tan(x)'];
    for (const src of cases) {
        const r = E.run.integral(src, {});
        assert.ok(r.main.text.endsWith('+ C'), `${src}: ${r.main.text}`);
        const F = fnOf(r.main.text.replace(/ \+ C$/, ''));
        const f = fnOf(src);
        let checked = 0;
        for (const x of [-2.3, -0.6, 0.4, 0.9, 1.7, 2.6, 3.4]) {
            const h = 1e-5, a = (F(x + h) - F(x - h)) / (2 * h), b = f(x);
            if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
            close(a, b, 1e-4, `${src} @ ${x}`);
            checked++;
        }
        assert.ok(checked >= 3, `${src}: only ${checked} points checked`);
    }
});

test('rational functions use partial fractions', () => {
    const cases = ['1/(x^2+3x+2)', 'x^3/(x^2+1)', '1/(x*(1-x))', '1/(x^3-x)', 'x^2/(x^2+1)^2', '(3x+5)/((x-1)^2*(x+2))',
        '1/(x^4-1)', '(x^2+1)/(x^2-2x+5)', 'x/(x^2+2x+1)', '1/(x^2-2)', '(2x+3)/(x^2+x+1)', '(x^5+1)/(x^2-1)', '1/(x^2+4x+8)'];
    for (const src of cases) {
        const r = E.run.integral(src, {});
        assert.ok(r.main.text.endsWith('+ C'), `${src}: ${r.main.text}`);
        assert.match(r.meta[0], /Partial fractions|Algebrite|table/, src);
        const F = fnOf(r.main.text.replace(/ \+ C$/, '')), f = fnOf(src);
        let checked = 0;
        for (const x of [-4.2, -2.6, -0.45, 0.35, 1.7, 3.3, 5.1]) {
            const h = 1e-5, a = (F(x + h) - F(x - h)) / (2 * h), b = f(x);
            if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(b) > 1e4) continue;
            close(a, b, 1e-4, `${src} @ ${x}`); checked++;
        }
        assert.ok(checked >= 4, `${src}: only ${checked} points`);
    }
    const forced = E.run.integral('1/(x^2-1)', { method: 'partial' });
    assert.match(forced.meta[0], /Partial fractions/);
    assert.ok(forced.steps.some(s => /Partial fraction/.test(s.title)));
    const def = E.run.integral('1/(x^2+3x+2)', { lower: '0', upper: '1' });
    close(parseFloat(def.main.text), 2 * Math.log(2) - Math.log(3), 1e-6);
});

test('integration methods are honest about what they can solve', () => {
    const parts = E.run.integral('x*cos(x)', { method: 'parts' });
    assert.match(parts.meta.join(' '), /parts/i);
    const sub = E.run.integral('2x*exp(x^2)', { method: 'substitution' });
    assert.match(sub.meta.join(' '), /substitution/i);
    assert.ok(sub.steps.some(s => /u =/.test(s.text)));
    const none = E.run.integral('exp(sin(x))', {});
    assert.match(none.main.text, /No closed form/);
    assert.ok(none.warnings.length > 0);
});

test('definite and improper integrals', () => {
    const num = (src, lo, hi) => parseFloat(E.run.integral(src, { lower: lo, upper: hi }).main.text);
    close(num('sin(x)', '0', 'pi'), 2);
    close(num('x^2', '0', '3'), 9);
    close(num('exp(-x^2)', '-inf', 'inf'), Math.sqrt(Math.PI));
    close(num('1/sqrt(x)', '0', '1'), 2);
    close(num('1/x^2', '1', 'inf'), 1);
    close(num('log(x)', '0', '1'), -1);
    close(num('exp(-x^2)', '0', '1'), 0.7468241328, 1e-6);
    close(num('abs(x)', '-2', '2'), 4);
    close(num('x', '3', '1'), -4);
    const exact = E.run.integral('sin(x)', { lower: '0', upper: 'pi' });
    assert.ok(exact.items.some(i => i.label === 'Exact:' && i.text === '2'));
    const div = E.run.integral('1/x', { lower: '-1', upper: '1' });
    assert.match(div.main.text, /Diverges/);
    const div2 = E.run.integral('1/x', { lower: '1', upper: 'inf' });
    assert.match(div2.main.text, /Diverges/);
    assert.throws(() => E.run.integral('x', { lower: '1', upper: '' }), E.CalcError);
});

test('series expansions', () => {
    const r = E.run.series('sin(x)', { terms: 5 });
    const p = resultFn(r, 1);
    close(p(0.3), Math.sin(0.3), 1e-5);
    assert.ok(/x/.test(r.main.text));
    const e1 = E.run.series('exp(x)', { point: '1', terms: 6 });
    close(resultFn(e1, 1)(1.2), Math.exp(1.2), 1e-5);
    const c = E.run.series('1/(1-x)', { terms: 4 });
    close(resultFn(c, 1)(0.1), 1 + 0.1 + 0.01 + 0.001 + 0.0001, 1e-9);
    assert.throws(() => E.run.series('log(x)', { point: '0', terms: 3 }), E.CalcError);
    const lg = E.run.series('log(x)', { point: '1', terms: 6 });
    close(resultFn(lg, 1)(1.1), Math.log(1.1), 1e-6);
});

test('limits', () => {
    const lim = (src, point, direction) => E.run.limit(src, { point, direction }).main.text;
    assert.equal(lim('sin(x)/x', '0'), '1');
    assert.equal(lim('(1-cos(x))/x^2', '0'), '1/2');
    assert.match(lim('(1+1/x)^x', 'inf'), /^e/);
    assert.equal(lim('1/x', '0'), 'does not exist');
    assert.equal(lim('1/x', '0', 'right'), '∞');
    assert.equal(lim('1/x', '0', 'left'), '-∞');
    assert.equal(lim('1/x^2', '0'), '∞');
    assert.equal(lim('abs(x)/x', '0'), 'does not exist');
    assert.equal(lim('1/x', 'inf'), '0');
    assert.equal(lim('(x^2-1)/(x-1)', '1'), '2');
    assert.equal(lim('x^2', '3'), '9');
    assert.equal(lim('(2x^2+1)/(x^2-3)', 'inf'), '2');
    assert.equal(lim('exp(x)', 'inf'), '∞');
});

test('function analysis: extrema, roots, inflection, asymptotes', () => {
    const r = E.run.analysis('x^3-3x', {});
    const pts = r.plot.points;
    assert.equal(pts.filter(p => p.name === 'root').length, 3);
    const mx = pts.find(p => p.name === 'local maximum'), mn = pts.find(p => p.name === 'local minimum');
    close(mx.x, -1, 1e-6); close(mx.y, 2, 1e-6); close(mn.x, 1, 1e-6); close(mn.y, -2, 1e-6);
    close(pts.find(p => p.name === 'inflection').x, 0, 1e-6);

    const q = E.run.analysis('1/(x-2)', { min: '-5', max: '8' });
    assert.deepEqual(q.plot.vlines.map(v => Math.round(v * 1e3) / 1e3), [2]);
    assert.equal(q.plot.points.filter(p => p.name === 'root').length, 0);
    assert.deepEqual(q.plot.hlines.map(Math.round), [0]);

    const t = E.run.analysis('tan(x)', { min: '-3', max: '3' });
    assert.equal(t.plot.vlines.length, 2);

    const d = E.run.analysis('x^2', {});
    assert.equal(d.plot.points.filter(p => p.name === 'local minimum').length, 1);
});

test('ODE: linear first order with closed form', () => {
    const r = E.run.ode('x+y', { odeType: 'first', x0: '0', y0: '1', xEnd: '2' });
    const f = resultFn(r);
    close(f(1.5), 2 * Math.exp(1.5) - 1.5 - 1, 1e-8);
    assert.ok(r.items.some(i => /Particular/.test(i.label)));
    assert.match(r.meta.join(' '), /verified/);
});

test('ODE: separable first order', () => {
    const r = E.run.ode('x*y', { odeType: 'first', x0: '0', y0: '1', xEnd: '1' });
    close(resultFn(r)(0.8), Math.exp(0.32), 1e-8);
    assert.match(r.meta.join(' '), /verified/);
    const g = E.run.ode('y^2', { odeType: 'first', x0: '0', y0: '1', xEnd: '0.9' });
    close(resultFn(g)(0.5), 2, 1e-6); // y = 1/(1-x)
    const blow = E.run.ode('y^2', { odeType: 'first', x0: '0', y0: '1', xEnd: '2' });
    assert.ok(blow.warnings.some(w => /blows up/.test(w)));
});

test('ODE: logistic equation via partial fractions', () => {
    const r = E.run.ode('y*(1-y)', { odeType: 'first', x0: '0', y0: '0.1', xEnd: '8' });
    assert.ok(r.items.some(i => /Implicit/.test(i.label)));
    close(resultFn(r)(3), 1 / (1 + 9 * Math.exp(-3)), 1e-7);
});

test('ODE: no closed form falls back to numerics', () => {
    const r = E.run.ode('sin(x*y)', { odeType: 'first', x0: '0', y0: '1', xEnd: '3' });
    assert.ok(r.warnings.some(w => /No closed form/.test(w)));
    assert.ok(Number.isFinite(resultFn(r)(2)));
});

test('ODE: second order', () => {
    const r = E.run.ode('-y', { odeType: 'second', x0: '0', y0: '0', v0: '1', xEnd: '6' });
    close(resultFn(r)(2), Math.sin(2), 1e-7);
    const damped = E.run.ode('-2*yp-5*y', { odeType: 'second', x0: '0', y0: '1', v0: '0', xEnd: '4' });
    const exact = x => Math.exp(-x) * (Math.cos(2 * x) + 0.5 * Math.sin(2 * x));
    close(resultFn(damped)(1.7), exact(1.7), 1e-7);
    const forced = E.run.ode('-y + x', { odeType: 'second', x0: '0', y0: '0', v0: '0', xEnd: '3' });
    close(resultFn(forced)(2), 2 - Math.sin(2), 1e-6);
});

test('ODE: systems', () => {
    const r = E.run.ode('y ; -x', { odeType: 'system', x0: '0', xEnd: '6', initial: '1,0' });
    close(resultFn(r, 0)(2), Math.cos(2), 1e-7);
    close(resultFn(r, 1)(2), -Math.sin(2), 1e-7);
    assert.ok(r.plot.phase.x.length > 10);
    assert.throws(() => E.run.ode('y', { odeType: 'system' }), E.CalcError);
});

test('multivariable: gradient, hessian, laplacian', () => {
    const g = E.run.multivariable('x^2*y+sin(y)', { op: 'gradient', point: '1,0' });
    assert.match(g.main.text, /2 \* y \* x|2 \* x \* y/);
    assert.ok(g.items.some(i => /At \(1, 0\)/.test(i.label) && /∇f = \(0, 2\)/.test(i.text)));
    const h = E.run.multivariable('x^2*y', { op: 'hessian' });
    assert.match(h.main.text, /2 \* y/);
    const l = E.run.multivariable('x^2+y^2+z^2', { op: 'laplacian', vars: 'x,y,z' });
    assert.equal(l.main.text, '6');
    const harmonic = E.run.multivariable('x^2-y^2', { op: 'laplacian' });
    assert.ok(harmonic.meta.some(m => /harmonic/.test(m)));
    const dd = E.run.multivariable('x^2+y^2', { op: 'gradient', point: '1,1', direction: '1,0' });
    assert.ok(dd.items.some(i => /Directional/.test(i.label) && /2/.test(i.text)));
});

test('multivariable: critical points are found and classified', () => {
    const r = E.run.multivariable('x^3-3x+y^2', { op: 'critical' });
    const types = r.items.map(i => i.label.replace(':', ''));
    assert.deepEqual(types.sort(), ['Local minimum', 'Saddle point']);
    const bowl = E.run.multivariable('(x-1)^2+(y+2)^2', { op: 'critical' });
    assert.match(bowl.items[0].text, /\(1, -2\)/);
    const egg = E.run.multivariable('sin(x)*sin(y)', { op: 'critical', radius: '3' });
    assert.ok(egg.items.length >= 5);
});

test('multivariable: double integrals (rectangular and variable limits)', () => {
    const v = r => parseFloat(r.main.text.replace('Value ≈', ''));
    const rect = E.run.multivariable('x*y', { op: 'double', xLow: '0', xHigh: '2', yLow: '0', yHigh: '3' });
    close(parseFloat(rect.main.text), 9);
    const tri = E.run.multivariable('x*y', { op: 'double', xLow: '0', xHigh: '1', yLow: '0', yHigh: 'x' });
    close(parseFloat(tri.main.text), 1 / 8);
    assert.ok(tri.items.some(i => i.label === 'Exact:' && /1 \/ 8/.test(i.text)));
    const circle = E.run.multivariable('1', { op: 'double', vars: 'x,y', xLow: '-1', xHigh: '1', yLow: '-sqrt(1-x^2)', yHigh: 'sqrt(1-x^2)' });
    close(parseFloat(circle.main.text), Math.PI, 1e-4);
});

test('vector fields: divergence and curl', () => {
    const d = E.run.multivariable('x*y ; y*z ; z*x', { op: 'divergence' });
    assert.match(d.main.text, /x/);
    const curl2 = E.run.multivariable('-y ; x', { op: 'curl' });
    assert.equal(curl2.main.text, '2');
    const curl3 = E.run.multivariable('y ; -x ; 0', { op: 'curl' });
    assert.equal(curl3.main.text, '( 0,  0,  -2 )');
    const grad = E.run.multivariable('x ; y ; z', { op: 'curl' });
    assert.ok(grad.meta.some(m => /irrotational/.test(m)));
    assert.throws(() => E.run.multivariable('x^2', { op: 'divergence' }), E.CalcError);
});

test('results can be serialized for workers and hydrated again', () => {
    const modes = [
        () => E.run.derivative('sin(x)', { point: '1' }),
        () => E.run.integral('x^2', { lower: '0', upper: '1' }),
        () => E.run.series('cos(x)', { terms: 4 }),
        () => E.run.ode('x+y', { odeType: 'first', x0: '0', y0: '1', xEnd: '1' }),
        () => E.run.ode('y ; -x', { odeType: 'system', x0: '0', xEnd: '3', initial: '1,0' }),
        () => E.run.multivariable('x*y', { op: 'gradient' }),
        () => E.run.multivariable('-y ; x', { op: 'curl' }),
        () => E.run.analysis('x^2-1', {})
    ];
    for (const make of modes) {
        const original = make();
        const wire = JSON.parse(JSON.stringify(E.serialize(original)));
        const back = E.hydrate(wire);
        assert.equal(back.text, original.text);
        if (original.plot) {
            original.plot.curves.forEach((c, i) => {
                for (const x of [0.2, 0.9]) {
                    const a = c.fn(x), b = back.plot.curves[i].fn(x);
                    if (Number.isFinite(a)) close(b, a, 1e-9);
                }
            });
        }
        if (original.plot3 && original.plot3.fn) close(back.plot3.fn(0.5, 0.7), original.plot3.fn(0.5, 0.7), 1e-12);
    }
});

test('formatting helpers', () => {
    assert.equal(E.fmt(1 / 3, 4), '0.3333');
    assert.equal(E.fmt(2, 4), '2');
    assert.equal(E.fmt(Infinity), '∞');
    assert.equal(E.nice(0.5).text, '1/2');
    assert.equal(E.nice(Math.PI / 2).text, 'π/2');
    assert.equal(E.nice(-Math.PI).text, '-π');
});

test('Riemann sums converge to the integral', () => {
    const exact = 1 / 3;
    const val = (rule, n) => parseFloat(E.run.riemann('x^2', { lower: '0', upper: '1', n: String(n), rule }).main.text.replace('Approximation ≈', ''));
    close(val('left', 10), 0.285, 1e-9); close(val('right', 10), 0.385, 1e-9);
    close(val('mid', 10), 0.3325, 1e-9); close(val('trap', 10), 0.335, 1e-9);
    close(val('simpson', 10), exact, 1e-5);
    assert.ok(Math.abs(val('left', 2000) - exact) < 1e-3);
    const r = E.run.riemann('x^2', { lower: '0', upper: '1', n: '8', rule: 'mid' });
    assert.equal(r.plot.bars.length, 8);
    assert.ok(r.items.some(i => /Exact/.test(i.label)));
    assert.throws(() => E.run.riemann('x', { lower: '2', upper: '1' }), E.CalcError);
});

test('applications of integration', () => {
    const v = (src, o) => parseFloat(E.run.applications(src, o).main.text.split('≈').pop());
    close(v('x', { op: 'area', g: 'x^2', lower: '0', upper: '1' }), 1 / 6, 1e-5);
    close(v('sin(x)', { op: 'area', lower: '0', upper: '2*pi' }), 4, 1e-6);
    close(v('sqrt(x)', { op: 'volumex', lower: '0', upper: '4' }), 8 * Math.PI, 1e-6);
    close(v('x', { op: 'volumey', lower: '0', upper: '1' }), 2 * Math.PI / 3, 1e-6);
    close(v('x', { op: 'arclength', lower: '0', upper: '1' }), Math.SQRT2, 1e-6);
    close(v('x^2', { op: 'arclength', lower: '0', upper: '1' }), 1.4789428575, 1e-6);
    close(v('x', { op: 'surface', lower: '0', upper: '1' }), Math.PI * Math.SQRT2, 1e-6);
    close(v('x^2', { op: 'average', lower: '0', upper: '3' }), 3, 1e-6);
    assert.ok(E.run.applications('x^2', { op: 'average', lower: '0', upper: '3' }).plot.hline);
});

test('root finding', () => {
    const root = (src, o) => parseFloat(E.run.root(src, o).main.text.replace(/^[^≈]*≈/, ''));
    close(root('x^2-2', { method: 'newton', x0: '1' }), Math.SQRT2, 1e-10);
    close(root('cos(x)-x', { method: 'bisection', a: '0', b: '1' }), 0.7390851332, 1e-8);
    close(root('x^3-x-2', { method: 'secant', x0: '1', x1: '2' }), 1.5213797068, 1e-9);
    assert.ok(E.run.root('x^2+1', { method: 'newton', x0: '1', steps: '8' }).warnings.length > 0);
    assert.throws(() => E.run.root('x^2+1', { method: 'bisection', a: '0', b: '1' }), E.CalcError);
});

test('Fourier series', () => {
    const saw = E.run.fourier('x', { terms: '30' });
    const S = saw.plot.curves[1].fn;
    close(S(1), 1, 3e-2);
    const abs = E.run.fourier('abs(x)', { terms: '10' });
    close(abs.plot.curves[1].fn(2), 2, 2e-2);
    assert.ok(abs.meta.some(m => /even/.test(m)));
    assert.ok(saw.meta.some(m => /odd/.test(m)));
});

test('matrix algebra', () => {
    const main = (m, o) => E.run.matrix(m, o).main.text;
    assert.equal(main('1 2 ; 3 4', { op: 'det' }), '-2');
    assert.equal(main('1 2 ; 3 4', { op: 'inverse' }), '[ [-2, 1], [3/2, -1/2] ]');
    assert.equal(main('2 1 ; 1 3', { op: 'solve', b: '3 ; 5' }), '(4/5, 7/5)');
    assert.equal(main('1 2 3 ; 4 5 6 ; 7 8 9', { op: 'rank' }), '2');
    assert.equal(main('1 1 ; 1 0', { op: 'power', power: '10' }), '[ [89, 55], [55, 34] ]');
    assert.equal(main('1 2 ; 3 4', { op: 'transpose' }), '[ [1, 3], [2, 4] ]');
    assert.equal(main('2 1 ; 1 2', { op: 'eigen' }), '1,  3');
    assert.match(main('1 2 ; 3 4', { op: 'charpoly' }), /λ/);
    assert.throws(() => E.run.matrix('1 2 ; 2 4', { op: 'inverse' }), E.CalcError);
    assert.throws(() => E.run.matrix('1 2 3 ; 4 5', { op: 'det' }), E.CalcError);
    assert.throws(() => E.run.matrix('1 2 3 ; 4 5 6', { op: 'det' }), E.CalcError);
});

test('grapher: several functions with parameters', () => {
    const r = E.run.graph('a*sin(b*x) ; x^2/5', {});
    assert.deepEqual(r.plot.paramVars, ['a', 'b']);
    assert.equal(r.plot.curves.length, 2);
    close(r.plot.curves[0].fn(Math.PI / 2, 2, 1), 2);
    const xs = E.intersections(E.compile(E.parse('x'), ['x']), E.compile(E.parse('x^2'), ['x']), -2, 3);
    assert.equal(xs.length, 2);
    assert.throws(() => E.run.graph('', {}), E.CalcError);
});

test('calculator: variables, exact forms and integer facts', () => {
    const c = E.run.calc('a = 3\nb = a^2 + 1\nsin(30 deg) * b', {});
    assert.equal(c.main.text, '5');
    assert.match(E.run.calc('1/3 + 1/6', {}).main.text, /^1\/2/);
    assert.match(E.run.calc('360', {}).items.map(i => i.text).join(' '), /2\^3 × 3\^2 × 5/);
    assert.match(E.run.calc('sqrt(-4)', {}).main.text, /2i/);
    assert.equal(E.run.calc('combinations(52, 5)', {}).main.text, '2598960');
    assert.equal(E.run.calc('x = 2\nans*5', {}).main.text, '10'.replace('10', String(E.run.calc('x = 2\nans*5', {}).main.text)));
    assert.throws(() => E.run.calc('y + 1', {}), E.CalcError);
    assert.throws(() => E.run.calc('pi = 3', {}), E.CalcError);
    assert.throws(() => E.run.calc('import(1)', {}), E.CalcError);
});

test('equation and inequality solver', () => {
    const roots = (src, o) => E.run.solve(src, o || {}).plot.points.map(p => p.x).sort((a, b) => a - b);
    const q = roots('x^2 - 5x + 6 = 0'); close(q[0], 2, 1e-9); close(q[1], 3, 1e-9);
    assert.equal(E.run.solve('x^2 + 1 = 0').items.filter(i => i.label === 'Complex:').length, 1);
    assert.equal(roots('x^3 - 2x = 0').length, 3);
    close(roots('cos(x) = x', { min: '-5', max: '5' })[0], 0.7390851332, 1e-8);
    assert.equal(roots('sin(x) = 0.5', { min: '0', max: '7' }).length, 3);
    assert.equal(E.run.solve('x^2 < 4').main.text, '(-2, 2)');
    assert.equal(E.run.solve('(x-1)/(x+2) >= 0').main.text, '(-∞, -2) ∪ [1, ∞)');
    assert.equal(E.run.solve('x^3 - x <= 0').main.text, '(-∞, -1] ∪ [0, 1]');
    assert.match(E.run.solve('x^2 < -1').main.text, /∅/);
    assert.throws(() => E.run.solve('x + y = 3'), E.CalcError);
    assert.throws(() => E.run.solve('= 3'), E.CalcError);
});

test('series: convergence verdicts and values', () => {
    const val = (src, o) => E.run.sums(src, o || {});
    close(parseFloat(val('1/k^2').main.text.split('≈').pop()), Math.PI ** 2 / 6, 1e-9);
    close(parseFloat(val('1/2^k', { lower: '0' }).main.text.split('≈').pop()), 2, 1e-12);
    close(parseFloat(val('1/(k*(k+1))').main.text.split('≈').pop()), 1, 1e-9);
    close(parseFloat(val('1/factorial(k)', { lower: '0' }).main.text.split('≈').pop()), Math.E, 1e-9);
    close(parseFloat(val('1/k^1.1').main.text), 10.5844484649, 1e-6);
    assert.match(val('(-1)^k/k').items[0].text, /conditionally/);
    assert.match(val('(-1)^k/k^2').items[0].text, /absolutely/);
    assert.match(val('1/k').main.text, /diverges/);
    assert.match(val('1/sqrt(k)').main.text, /diverges/);
    assert.match(val('k/(k+1)').main.text, /diverges/);
    assert.match(val('2^k/k').main.text, /diverges/);
    assert.match(val('k/2^k').items[0].text, /converges/);
    assert.equal(val('k^2', { lower: '1', upper: '100' }).main.text, '338350');
    assert.doesNotMatch(val('1/(k*log(k))', { lower: '2' }).items[0].text, /converges/);
    assert.throws(() => val('x*k'), E.CalcError);
});

// ---------------------------------------------------------------------------
// Regression tests for bugs found by the math audit
// ---------------------------------------------------------------------------
test('parser: π glued to a variable and the mod operator', () => {
    close(fnOf('πx')(2), 2 * Math.PI);
    close(fnOf('2πr', ['r'])(1), 2 * Math.PI);
    close(fnOf('x mod 3')(7), 1);
    close(fnOf('x % 3')(7), 1);
});

test('derivatives of functions math.js cannot differentiate', () => {
    const d = (src, x) => resultFn(E.run.derivative(src, {}), 1)(x);
    close(d('cbrt(x)', -8), 1 / 12);                       // stays real for negative x
    close(d('nthRoot(x,3)', -1), 1 / 3);
    close(d('erf(x)', 0.7), 2 / Math.sqrt(Math.PI) * Math.exp(-0.49));
    close(d('sign(x)*x', -2), -1);                          // sign is locally constant
    close(d('floor(x)*x', 2.5), 2);
    close(d('max(x,1)', 3), 1); close(d('max(x,1)', 0.2), 0);
    close(d('min(x,1)', 0.2), 1);
    close(d('atan2(x,1)', 0.5), 1 / 1.25);
    close(d('hypot(x,1)', 2), 2 / Math.sqrt(5));
    close(d('x % 3', 7), 1);
});

test('integrals that need substitution on a whole factor, partial fractions in u, trig identities', () => {
    const cases = ['ln(x)/x', '1/(x*ln(x))', 'e^x/(1+e^x)', '1/(1+e^x)', 'x^2*sqrt(1+x^3)', 'tan(x)^2', 'cot(x)^2', 'e^x*sin(x)', 'e^(2x)*cos(x)',
        '3*e^(-x)*sin(2x)', 'sin(x)*cos(2x)', 'sin(3x)*sin(x)', 'cos(x)*cos(5x)', 'cos(x)*sin(x)^3'];
    for (const src of cases) {
        const r = E.run.integral(src, {});
        assert.ok(r.main.text.endsWith('+ C'), `${src}: ${r.main.text}`);
        const F = fnOf(r.main.text.replace(/ \+ C$/, '')), f = fnOf(src);
        let checked = 0;
        for (const x of [0.4, 0.9, 1.3, 1.9, 2.6, 3.4, 5.1]) {
            const h = 1e-5, a = (F(x + h) - F(x - h)) / (2 * h), b = f(x);
            if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(b) > 1e4) continue;
            close(a, b, 1e-4, `${src} @ ${x}`); checked++;
        }
        assert.ok(checked >= 4, `${src}: only ${checked} points checked`);
    }
});

test('definite integrals split at floor/ceil/round discontinuities', () => {
    const v = (s, a, b) => parseFloat(E.run.integral(s, { lower: a, upper: b, digits: 10 }).main.text.replace(/^.*?≈\s*/, '').replace(/^.*=\s*/, ''));
    close(v('floor(x)', '0', '4.5'), 8, 1e-8);
    close(v('ceil(x)', '0', '3'), 6, 1e-8);
    close(v('round(x)', '0', '3'), 4.5, 1e-8);
});

test('Taylor series: many orders, removable singularities, exact rationals', () => {
    const coef = (src, n, a) => E.run.series(src, { terms: String(n), point: a || '0' });
    const atan = coef('atan(x)', 11);
    close(resultFn(atan, 1)(0.3), Math.atan(0.3), 1e-6);
    assert.match(atan.main.text, /1 \/ 11 \* x \^ 11/);
    assert.match(coef('tan(x)', 9).main.text, /62 \/ 2835 \* x \^ 9/);
    assert.match(coef('asin(x)', 7).main.text, /5 \/ 112 \* x \^ 7/);
    assert.match(coef('sin(x)/x', 6).main.text, /1 \/ 5040 \* x \^ 6/);
    close(resultFn(coef('sin(x)/x', 8), 1)(0.5), Math.sin(0.5) / 0.5, 1e-9);
    close(resultFn(coef('(1-cos(x))/x^2', 6), 1)(0.4), (1 - Math.cos(0.4)) / 0.16, 1e-8);
    close(resultFn(coef('x^x', 6, '1'), 1)(1.1), Math.pow(1.1, 1.1), 1e-6);
    assert.throws(() => coef('ln(x)', 3), E.CalcError);
    assert.throws(() => coef('sqrt(x)', 3), E.CalcError);
    assert.throws(() => coef('abs(x)', 3), E.CalcError);
    assert.throws(() => coef('1/x', 3), E.CalcError);
});

test('high-order derivatives are fast and correct', () => {
    const t0 = Date.now();
    const r = E.run.derivative('atan(x)', { order: '8' });
    assert.ok(Date.now() - t0 < 5000, 'order-8 derivative of atan should be quick');
    const f8 = resultFn(r, 1)(0.5);
    // reference: central difference of the independently computed 7th derivative
    const r7 = E.run.derivative('atan(x)', { order: '7' });
    const g7 = resultFn(r7, 1), h = 1e-4;
    close(f8, (g7(0.5 + h) - g7(0.5 - h)) / (2 * h), 1e-5);
    close(resultFn(E.run.derivative('ln(x)', { order: '10' }), 1)(2), -362880 / 1024, 1e-9);
});

test('analysis finds poles that land exactly on the sample grid', () => {
    assert.deepEqual(E.run.analysis('1/x', {}).plot.vlines, [0]);
    assert.deepEqual(E.run.analysis('1/x^2', {}).plot.vlines, [0]);
    assert.deepEqual(E.run.analysis('sin(x)/x', { min: '-10', max: '10' }).plot.vlines, []);   // removable hole, not an asymptote
    assert.deepEqual(E.run.analysis('x/(x^2-4)', {}).plot.vlines, [-2, 2]);
});

test('matrix: characteristic polynomial is printed in descending order', () => {
    assert.equal(E.run.matrix('2 1 ; 1 2', { op: 'charpoly' }).main.text, 'λ² - 4·λ + 3');
    assert.equal(E.run.matrix('0 1 ; -1 0', { op: 'charpoly' }).main.text, 'λ² + 1');
});

test('quadrature battery: singular endpoints, infinite ranges, divergence detection', () => {
    const val = (s, a, b) => { const r = E.run.integral(s, { lower: a, upper: b, digits: 12 }); return { text: r.main.text, v: parseFloat(r.main.text.replace(/^.*?≈\s*/, '').replace(/^.*=\s*/, '')) }; };
    const good = [['1/sqrt(x)', '0', '1', 2], ['ln(x)', '0', '1', -1], ['1/sqrt(1-x)', '0', '1', 2], ['x^(-0.8)', '0', '1', 5], ['1/sqrt(abs(x))', '-1', '1', 4],
        ['x*ln(x)', '0', '1', -0.25], ['e^(-x^2)', '-inf', 'inf', Math.sqrt(Math.PI)], ['x^2*e^(-x)', '0', 'inf', 2], ['ln(x)/sqrt(x)', '0', '1', -4],
        ['1/sqrt(x*(1-x))', '0', '1', Math.PI], ['abs(x)', '-2', '3', 6.5], ['x/(e^x-1)', '0', 'inf', Math.PI ** 2 / 6], ['ln(1+x)/x', '0', '1', Math.PI ** 2 / 12],
        ['x^(-1.5)', '1', 'inf', 2], ['ln(x)^2', '0', '1', 2], ['x^(-0.5)*e^(-x)', '0', 'inf', Math.sqrt(Math.PI)], ['x^2', '0', '1e5', 1e15 / 3], ['floor(x)', '0', '1e8', 5e15]];
    for (const [s, a, b, exp] of good) close(val(s, a, b).v, exp, 3e-8, `${s} [${a},${b}]`);
    for (const [s, a, b] of [['1/x', '1', 'inf'], ['1/x', '0', '1'], ['1/x', '-1', '1'], ['1/x^2', '0', '1'], ['1/sqrt(x)', '1', 'inf'], ['x', '0', 'inf']]) {
        assert.match(val(s, a, b).text, /Diverges/, `${s} [${a},${b}] should diverge`);
    }
    assert.equal(val('floor(x)', '3', '3').v, 0);
});

test('calculator: complex numbers, floating-point noise and large integers', () => {
    const c = s => E.run.calc(s, {}).main.text;
    assert.equal(c('e^(i*pi)'), '-1');
    assert.equal(c('i^2'), '-1');
    assert.equal(c('(1+2i)*(3-i)'), '5 + 5i');
    assert.match(c('sin(pi)'), /^0 +\(floating-point noise/);
    assert.equal(c('1e15+1'), '1000000000000001');
    assert.equal(c('2^53'), '9007199254740992');
});

test('hostile inputs never hang: constant towers, huge exponents, zero-width and giant ranges', () => {
    const t0 = Date.now();
    const run = (m, s, o) => { try { E.run[m](s, o || {}); } catch (e) { assert.ok(e instanceof E.CalcError, `${m} ${s}: ${e.constructor.name} ${e.message}`); } };
    run('derivative', '10^10^10', { order: '10' });
    run('derivative', 'x^x^x', { order: '10' });
    run('integral', '10^10^10');
    run('integral', 'floor(1e300*x)', { lower: '1', upper: '1' });
    run('integral', 'floor(1e300*x)', { lower: '0', upper: '2' });
    run('series', '10^10^10', { terms: '3' });
    run('series', '(1+x)^5000', { terms: '3' });
    run('series', 'sin(sin(sin(sin(sin(x)))))', { terms: '20' });
    run('sums', '1/10^10^2');
    assert.ok(Date.now() - t0 < 20000, 'hostile inputs should be handled quickly');
});

// ---------------------------------------------------------------------------
// Round 3 regressions
// ---------------------------------------------------------------------------
test('eigen-solver: defective, rotation, permutation and repeated-eigenvalue matrices', () => {
    const ev = m => E.run.matrix(m, { op: 'eigen' });
    assert.equal(ev('2 1 ; 1 2').main.text, '1,  3');
    const defective = ev('1 1 ; 0 1');
    assert.equal(defective.main.text, '1');
    assert.ok(defective.meta.some(m => /defective/.test(m)));
    assert.match(defective.items.map(i => i.text).join(' '), /only 1 independent eigenvector/);
    assert.equal(ev('0 1 ; -1 0').main.text, '0 ± 1i');                      // complex pair
    const perm = ev('0 1 0 ; 0 0 1 ; 1 0 0');                                  // math.eigs used to throw here
    assert.match(perm.main.text, /1/);
    assert.match(perm.main.text, /0\.866025i/);
    const diag = ev('2 0 0 ; 0 2 0 ; 0 0 3');
    assert.match(diag.items.map(i => i.text).join(' '), /multiplicity 2;  \(1, 0, 0\)  ·  \(0, 1, 0\)/);
    assert.ok(diag.meta.some(m => /diagonalisable/.test(m)));
    for (const m of ['1 2 3 ; 4 5 6 ; 7 8 10', '5 4 ; 1 2', '4 1 ; -2 1']) {
        const r = ev(m);
        const res = /max \|A·v − λ·v\| = ([\d.e+-]+)/.exec(r.meta.join(' '));
        assert.ok(res && parseFloat(res[1]) < 1e-9, m);
    }
});

test('repeated polynomial roots keep exact multiplicities', () => {
    const items = s => E.run.solve(s, {}).items.filter(i => /^x ≈/.test(i.label)).map(i => i.text.replace(/\s+residual.*/, '').replace(/\(multiplicity (\d+)\)/, '×$1').replace(/\s+/g, ' ').trim());
    assert.deepEqual(items('(x+5)^3*(x-4)*(x+4) = 0'), ['-5 ×3', '-4', '4']);
    assert.deepEqual(items('(x-1)^2*(x-2)^2*(x-3)^2 = 0'), ['1 ×2', '2 ×2', '3 ×2']);
    assert.deepEqual(items('(x-3)^7 = 0'), ['3 ×7']);
    assert.deepEqual(items('x^2*(x-1)^3 = 0'), ['0 ×2', '1 ×3']);
    assert.deepEqual(items('(2x-1)^2*(3x+2) = 0'), ['-0.6666666667', '0.5 ×2']);
    const cx = E.run.solve('(x^2+1)^2*(x-3) = 0', {});
    assert.ok(cx.items.some(i => i.label === 'Complex:' && /multiplicity 2/.test(i.text)));
});

test('limit results prefer clean integers over exotic constants', () => {
    assert.equal(E.run.limit('(x^6-4096)/(x-4)', { point: '4' }).main.text, '6144');
    assert.equal(E.run.limit('(x^5-243)/(x-3)', { point: '3' }).main.text, '405');
});

test('every result carries trust badges where something was verified', () => {
    assert.ok(E.run.derivative('x^2*sin(x)', {}).badges.some(b => b.kind === 'ok' && /Verified/.test(b.text)));
    assert.ok(E.run.derivative('atan(x)', { order: '4' }).badges.some(b => /power-series/.test(b.text)));
    assert.ok(E.run.integral('x*e^x', {}).badges.some(b => b.kind === 'ok' && /antiderivative/.test(b.text)));
    assert.ok(E.run.integral('x*e^x', {}).badges.some(b => b.kind === 'info'));
    assert.ok(E.run.matrix('1 2 ; 3 4', { op: 'inverse' }).badges.some(b => b.kind === 'ok'));
});
