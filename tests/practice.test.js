const test = require('node:test'), assert = require('node:assert');
const math = require('mathjs'), Alg = require('algebrite');
const E = require('../js/engine.js').create(math, Alg); require('../js/extras.js').install(E, math, Alg);
const P = require('../js/practice.js').create(E, math);
test('every topic and level generates problems whose own answer is accepted and a wrong one is rejected', () => {
  let n = 0; const bad = [];
  for (const [topic] of P.TOPICS) for (let level = 1; level <= 3; level++) for (let seed = 1; seed <= 40; seed++) {
    let p; try { p = P.generate(topic, level, seed); } catch (e) { bad.push(`${topic}/${level}/${seed} generate: ${e.message}`); continue; }
    n++;
    const ans = p.answerText.replace(/\s*\+\s*C$/, '');
    if (!ans) { bad.push(`${topic}/${level}/${seed} no answer for ${p.text}`); continue; }
    const r = p.check(p.input === 'expression' && topic === 'integral' ? ans + ' + C' : ans); if (!r.ok) bad.push(`${topic}/${level}/${seed} rejects own answer "${ans}" for ${p.text}: ${r.msg}`);
    const w = p.check(topic === 'derivative' || topic === 'integral' ? '3*x^7 + 11' : topic === 'number' && level === 3 ? '7' : topic === 'matrix' && level === 3 ? '1 1 ; 1 1' : '123456.5'); if (w.ok) bad.push(`${topic}/${level}/${seed} accepts a wrong answer for ${p.text}`);
    assert.ok(typeof p.tex === 'string' && p.tex.length > 2);
  }
  assert.ok(n > 900); assert.deepEqual(bad.slice(0, 8), []);
});
test('equivalent forms are accepted', () => {
  const d = P.generate('derivative', 1, 3); assert.ok(d.check(d.answerText).ok);
  const e = P.generate('equation', 2, 5); const rev = e.answerText.split(', ').reverse().join(' , '); assert.ok(e.check(rev).ok); assert.ok(e.check('x = ' + e.answerText.replace(/, /g, ', x = ')).ok);
});
test('problems are reproducible from their seed', () => { assert.equal(P.generate('integral', 2, 77).text, P.generate('integral', 2, 77).text); });
