const test = require('node:test'), assert = require('node:assert');
const math = require('mathjs'), Algebrite = require('algebrite');
const C = require('../js/classroom.js').create(math);
const Engine = require('../js/engine.js'), Extras = require('../js/extras.js'), Practice = require('../js/practice.js');
const eng = Engine.create(math, Algebrite); Extras.install(eng, math, Algebrite); const P = Practice.create(eng, math);

const ws = () => C.normalise({ title: 'Quiz 1', instructions: 'Show answers as simply as you can.', email: 'teacher@school.org', questions: [
  { type: 'number', prompt: 'Compute $\\int_0^3 x^2\\,dx$', key: '9', points: 2 },
  { type: 'expr', prompt: 'Differentiate $x^2\\sin x$', key: '2*x*sin(x)+x^2*cos(x)' },
  { type: 'expr', prompt: 'Integrate $2x$', key: 'x^2 + C', plusC: true },
  { type: 'choice', prompt: 'Pick the even function', options: ['sin x', 'cos x', 'x^3'], key: '1' },
  { type: 'text', prompt: 'Name the theorem', key: 'Mean Value Theorem|MVT' },
  { type: 'list', prompt: 'Roots of $x^2-5x+6$', key: '2, 3' },
  { type: 'matrix', prompt: 'Inverse of [1 0; 0 2]', key: '1 0 ; 0 0.5' },
  { type: 'factors', prompt: 'Factor 360', key: '2^3*3^2*5' }] });

test('answer checking accepts equivalent forms and rejects wrong ones', () => {
  const w = ws(), ck = (i, a) => C.check(w.questions[i], a).ok;
  assert.ok(ck(0, '9') && ck(0, '18/2') && ck(0, '9.0000001') && !ck(0, '8') && !ck(0, ''));
  assert.ok(ck(1, 'x^2*cos(x) + 2x sin(x)') && ck(1, 'x*(2*sin(x)+x*cos(x))') && !ck(1, '2*x*sin(x)'));
  assert.ok(ck(2, 'x^2') && ck(2, 'x^2 + 7') && ck(2, 'x^2+C') && ck(2, '(x+1)^2-2*x') && !ck(2, 'x^2 + x') && !ck(2, '2x'));
  assert.ok(ck(3, '1') && !ck(3, '0'));
  assert.ok(ck(4, 'mean value theorem') && ck(4, 'MVT') && ck(4, ' Mean-Value  Theorem! ') && !ck(4, 'rolle'));
  assert.ok(ck(5, '3, 2') && ck(5, '2 and 3') && !ck(5, '2') && !ck(5, '2, 4'));
  assert.ok(ck(6, '1 0 ; 0 1/2') && ck(6, '[1,0;0,0.5]') && !ck(6, '1 0 ; 0 2'));
  assert.ok(ck(7, '5*3^2*2^3') && ck(7, '2*2*2*3*3*5') && !ck(7, '360') && !ck(7, '8*45'));
  assert.ok(C.check({ type: 'expr', key: 'e^(2x)' }, 'exp(2*x)').ok);
  assert.ok(C.check({ type: 'number', key: 'sqrt(2)/2' }, '0.70710678').ok);                       // 8 digits is within the default 1e-6 relative tolerance
  assert.ok(!C.check({ type: 'number', key: 'pi/4' }, '0.785').ok);                               // 3 digits is not, unless the teacher sets a tolerance
  assert.ok(C.check({ type: 'number', key: 'pi/4', tol: 0.001 }, '0.785').ok);
});
test('answers are untrusted: code-like input is rejected, never executed', () => {
  const q = { type: 'expr', key: 'x^2' };
  for (const bad of ['import("fs")', 'evaluate("1+1")', 'x.constructor', 'a=5', 'x; y', 'sin(x)(2)', '[1,2,3]', '{a:1}', 'createUnit("z")', 'parse("x")', 'f(x)=x', '"str"']) assert.equal(C.check(q, bad).ok, false, bad);
  assert.equal(C.check({ type: 'number', key: '1' }, '1'.repeat(500)).ok, false);
});
test('submission codes round-trip, detect damage and unicode names survive', () => {
  const w = ws(), code = C.makeSubmission(w, 'Zoë Ñandú', ['9', '', '', '1', 'MVT', '2,3', '1 0;0 .5', '2^3*3^2*5']);
  const p = C.parseSubmission(code); assert.ok(p.ok); assert.equal(p.sub.n, 'Zoë Ñandú'); assert.equal(p.sub.w, w.id);
  assert.equal(C.parseSubmission(code.slice(0, -3)).ok, false); assert.equal(C.parseSubmission(code.replace(/\.[^.]+\./, m => m.slice(0, 5) + 'x' + m.slice(6))).ok, false);
  assert.equal(C.parseSubmission('hello').ok, false); assert.throws(() => C.makeSubmission(w, '  ', []), /name/);
  assert.ok(C.parseSubmission('  ' + code.slice(0, 20) + '\n' + code.slice(20) + ' ').ok);   // wrapped by an email client
});
test('pasted text: wrapped lines, quoted replies and chatter are all handled', () => {
  const w = ws(), a = C.makeSubmission(w, 'Ada', ['9']), b = C.makeSubmission(w, 'Bo', ['8']);
  const wrapped = c => c.match(/.{1,40}/g).join('\n> ');
  const mail = `Hi,\n\nhere it is:\n> ${wrapped(a)}\n\nthanks!\n\nOn Monday Bo wrote:\n> ${wrapped(b)}\nbest`;
  const { results, stray } = C.parseMany(mail); assert.equal(results.length, 2); assert.ok(results.every(r => r.ok)); assert.deepEqual(results.map(r => r.sub.n), ['Ada', 'Bo']); assert.ok(stray >= 3);
  assert.equal(C.parseMany('no codes here').results.length, 0); assert.equal(C.parseMany(a.slice(0, 30)).results[0].ok, false);
  assert.equal(C.parseMany(a + a + b).results.length, 3);
});
test('grading: latest submission per name wins, other worksheets are reported, CSV is injection-safe', () => {
  const w = ws(), ans = ['9', 'x^2*cos(x)+2*x*sin(x)', 'x^2+4', '1', 'MVT', '2,3', '1 0;0 .5', '2^3*3^2*5'];
  const mk = (n, a, t) => { const p = C.parseSubmission(C.makeSubmission(w, n, a)).sub; p.t = t; return p; };
  const subs = [mk('Ada', ans, 1), mk('Ada', ['0'], 2), mk('=cmd|x', ans, 3), Object.assign(mk('Bo', ans, 4), { w: 'other' })];
  const res = C.gradeAll(w, subs); assert.equal(res.count, 2); assert.equal(res.rows.find(r => r.name === 'Ada').score, 0); assert.equal(res.rows.find(r => r.name === '=cmd|x').score, 9);
  assert.equal(res.skipped.length, 2); const csv = C.toCSV(w, res); assert.ok(csv.includes("\"'=cmd|x\"") || csv.includes("'=cmd|x")); assert.match(csv.split('\r\n')[0], /^Name,Q1 \(2\)/);
  assert.equal(res.perQuestion.length, 8);
});
test('worksheet links round-trip; the key is only included in self-check mode', async () => {
  const w = ws(); const link = await C.encodeStudent(w); const back = await C.decodeStudent(link);
  assert.equal(back.title, 'Quiz 1'); assert.equal(back.questions.length, 8); assert.ok(back.questions.every(q => q.key === undefined)); assert.ok(!JSON.stringify(back).includes('2*x*sin(x)+x^2*cos(x)'));
  assert.ok(!Buffer.from(link.slice(1).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1').includes('Mean Value'));
  const sc = C.normalise(Object.assign({}, w, { selfCheck: true })); const b2 = await C.decodeStudent(await C.encodeStudent(sc)); assert.equal(b2.questions[0].key, '9'); assert.ok(C.check(b2.questions[2], 'x^2+1').ok);
  await assert.rejects(() => C.decodeStudent('zzzz'), /damaged|not a worksheet/i); await assert.rejects(() => C.decodeStudent(''), /Empty/);
});
test('validation catches teacher mistakes', () => {
  const q = o => ({ questions: [Object.assign({ type: 'number', prompt: 'p', key: '1' }, o)] });
  assert.throws(() => C.normalise({ questions: [] }), /at least one/); assert.throws(() => C.normalise(q({ prompt: ' ' })), /no text/); assert.throws(() => C.normalise(q({ key: 'abc' })), /number/);
  assert.throws(() => C.normalise(q({ type: 'choice', options: ['a'], key: '0' })), /2 to 8/); assert.throws(() => C.normalise(q({ type: 'choice', options: ['a', 'b'], key: '5' })), /correct choice/);
  assert.throws(() => C.normalise(q({ type: 'factors', key: '12' })), /factorisation/); assert.throws(() => C.normalise(q({ type: 'expr', key: 'x +' })), /could not be read/);
  assert.throws(() => C.normalise({ questions: Array.from({ length: 41 }, () => ({ type: 'number', prompt: 'p', key: '1' })) }), /At most/);
});
test('generated practice problems become checkable questions whose own answer is accepted', () => {
  for (const [topic] of P.TOPICS) for (const lv of [1, 2, 3]) {
    const qs = C.fromPractice(P, topic, lv, 4, 11); const w = C.normalise({ questions: qs });
    w.questions.forEach((q, i) => assert.ok(C.check(q, q.key).ok, `${topic} L${lv} #${i}: ${q.prompt} -> ${q.key}`));
  }
});
