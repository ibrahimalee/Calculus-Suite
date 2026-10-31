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
