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
test('time limits travel in the link; time used and "ran out" travel in the code and reach the CSV', async () => {
  const w = C.normalise(Object.assign({}, ws(), { timeLimit: 20, timeLock: false }));
  assert.equal(w.timeLimit, 20); assert.equal(w.timeLock, false); assert.equal(C.normalise(Object.assign({}, ws(), { timeLimit: 99999 })).timeLimit, 600); assert.equal(C.normalise(Object.assign({}, ws(), { timeLimit: -5 })).timeLimit, 0); assert.equal(C.normalise(ws()).timeLock, true);
  const back = await C.decodeStudent(await C.encodeStudent(w)); assert.equal(back.timeLimit, 20); assert.equal(back.timeLock, false); assert.equal((await C.decodeStudent(await C.encodeStudent(C.normalise(ws())))).timeLimit, 0);
  const ok = C.parseSubmission(C.makeSubmission(w, 'Ada', ['9'], { used: 754.4, over: false })), late = C.parseSubmission(C.makeSubmission(w, 'Bo', ['9'], { used: 1200, over: true })), plain = C.parseSubmission(C.makeSubmission(w, 'Cy', ['9']));
  assert.equal(ok.sub.d, 754); assert.equal(ok.sub.o, false); assert.equal(late.sub.o, true); assert.equal(plain.sub.d, null);
  const res = C.gradeAll(w, [ok.sub, late.sub, plain.sub]); const csv = C.toCSV(w, res).split('\r\n'); assert.match(csv[0], /Minutes used,Ran out of time$/); assert.match(csv[1], /12\.6,no$/); assert.match(csv[2], /20,yes$/); assert.match(csv[3], /,,no$/);
  assert.ok(!/Minutes used/.test(C.toCSV(C.normalise(ws()), C.gradeAll(C.normalise(ws()), [])).split('\r\n')[0]));
  // hostile numbers are clamped, not trusted
  const forged = C.parseSubmission(C.makeSubmission(w, 'Eve', ['1'], { used: 1e12, over: false })); assert.equal(forged.sub.d, 86400);
});

// ---------- batch 3: random numbers, shuffles, partial credit, overrides, roster, sharing ----------
const tmpl = (extra) => C.normalise(Object.assign({ title: 'Derivatives', questions: [
  { type: 'expr', prompt: 'Differentiate $@{a}x^3 @{+b}x$', key: '@{3*a}*x^2 + @{b}', rand: 'a = 2..9\nb = -5..5 except 0' },
  { type: 'number', prompt: 'Evaluate $@{a}\\cdot @{b}$ plus 1', key: '@{a*b+1}', rand: 'a = 2..9; b = 2..9' },
  { type: 'choice', prompt: 'Is @{n} even?', options: ['yes', 'no', 'maybe', 'x'], key: '0', rand: 'n = 2, 4, 6, 8' },
  { type: 'list', prompt: 'Roots of $x^2 - @{r1+r2}x + @{r1*r2}$', key: '@{r1}, @{r2}', rand: 'r1 = 1..4; r2 = 5..8', hint: 'sum @{r1+r2}' }] }, extra));

test('random numbers: same student gets the same version, different students get different ones, keys follow the numbers', () => {
  const w = tmpl({ shuffleQ: true, shuffleC: true }); assert.ok(C.isRandomised(w));
  const v1 = C.instantiate(w, C.variantSeed(w.id, 'Ada Lovelace')), v1b = C.instantiate(w, C.variantSeed(w.id, '  ada   LOVELACE ')), v2 = C.instantiate(w, C.variantSeed(w.id, 'Alan Turing'));
  assert.deepStrictEqual(v1.questions.map(q => q.prompt), v1b.questions.map(q => q.prompt)); assert.deepStrictEqual(v1.order, v1b.order);
  let differ = 0; for (const nm of ['Alan Turing', 'Grace Hopper', 'Emmy Noether', 'Kurt Godel', 'Sophie Germain']) { const v = C.instantiate(w, C.variantSeed(w.id, nm)); if (v.questions[0].prompt !== v1.questions[0].prompt) differ++; } assert.ok(differ >= 3, 'most students should get different numbers');
  const q = v1.questions[1]; assert.ok(!/@\{/.test(q.prompt + q.key)); const m = /Evaluate \$(\d+)\\cdot (\d+)\$/.exec(q.prompt); assert.strictEqual(+q.key, m[1] * m[2] + 1);
  assert.deepStrictEqual([...v1.order].sort(), [0, 1, 2, 3]); assert.deepStrictEqual([...v1.questions[2].optOrder].sort(), [0, 1, 2, 3]);
  // the template is never touched
  assert.ok(/@\{a\}/.test(w.questions[0].prompt));
  assert.ok(C.check(v1.questions[3], v1.questions[3].key.replace(',', ' ')).ok);
});

test('random numbers: negative values are signed and bracketed correctly, and bad templates are reported', () => {
  const w = C.normalise({ questions: [{ type: 'expr', prompt: 'f = @{a}x @{+b}', key: '@{a}*x + @{b}', rand: 'a = -3..-3\nb = -4, -4' }] });
  const v = C.instantiate(w, 'abcd1234').questions[0]; assert.strictEqual(v.prompt, 'f = -3x -4'); assert.strictEqual(v.key, '(-3)*x + (-4)'); assert.ok(C.check(v, '-3x-4').ok);
  assert.throws(() => C.normalise({ questions: [{ type: 'number', prompt: 'p', key: '@{zz}', rand: 'a = 1..3' }] }), /not defined|cannot be worked out|number/i);
  assert.throws(() => C.normalise({ questions: [{ type: 'number', prompt: 'p', key: '@{a}', rand: 'a = 5..1' }] }), /could not read the values/);
  assert.throws(() => C.normalise({ questions: [{ type: 'number', prompt: 'p', key: '@{a}', rand: 'a = 1..3 except 1, 2, 3' }] }), /no values are left/);
  assert.throws(() => C.normalise({ questions: [{ type: 'number', prompt: 'p', key: '@{a}', rand: 'sin = 1..3' }] }), /cannot be used/);
  assert.throws(() => C.normalise({ questions: [{ type: 'number', prompt: 'p', key: '@{a}', rand: 'a = 1..100000' }] }), /could not read the values/);
  // TeX braces and text without the random names are left alone
  const w2 = C.normalise({ questions: [{ type: 'number', prompt: 'Compute $\\frac{1}{2}+x^{10}$ and @{a}', key: '1', rand: 'a = 1..2' }] }); assert.ok(/\\frac\{1\}\{2\}\+x\^\{10\}/.test(C.instantiate(w2, 'k').questions[0].prompt));
});

test('random worksheets: the student link carries the templates, the code carries the seed, the teacher regrades the same version', async () => {
  const w = tmpl({ shuffleC: true }); const stu = await C.decodeStudent(await C.encodeStudent(w)); assert.ok(stu.questions[0].rand && !stu.questions[0].key && C.isRandomised(stu));
  const seed = C.variantSeed(w.id, 'Ada'), view = C.instantiate(stu, seed); assert.ok(!/@\{/.test(view.questions[0].prompt));
  const mine = C.instantiate(w, seed); const answers = mine.questions.map(q => q.type === 'choice' ? q.key : q.key.replace(/^\((-?\d+)\)/, '$1'));
  const code = C.makeSubmission(stu, 'Ada', answers, { seed }); const sub = C.parseSubmission(code); assert.strictEqual(sub.sub.s, seed);
  const res = C.gradeAll(w, [sub.sub]); assert.strictEqual(res.rows[0].score, res.rows[0].max); assert.strictEqual(res.rows[0].seed, seed); assert.ok(!/@\{/.test(res.rows[0].per[0].prompt));
  // an answer for somebody else's version is wrong
  const other = C.instantiate(w, C.variantSeed(w.id, 'Bob')); const mix = C.makeSubmission(stu, 'Ada', other.questions.map(q => q.key), { seed }); const r2 = C.gradeAll(w, [C.parseSubmission(mix).sub]); assert.ok(r2.rows[0].score < r2.rows[0].max);
  // CSV and common answers do not break
  assert.ok(C.toCSV(w, res).includes('Ada'));
});

test('shuffled choices keep the original option index in the answer', () => {
  const w = C.normalise({ shuffleC: true, questions: [{ type: 'choice', prompt: 'pick', options: ['red', 'green', 'blue', 'pink'], key: '2' }] }); assert.ok(C.isRandomised(w));
  const v = C.instantiate(w, 'deadbeef').questions[0]; assert.strictEqual(v.options[+v.key], 'blue'); assert.deepStrictEqual([...v.optOrder].sort(), [0, 1, 2, 3]);
});

test('partial credit for lists, matrices and factorisations', () => {
  const w = C.normalise({ partial: true, questions: [{ type: 'list', prompt: 'roots', key: '1, 2, 3, 4', points: 4 }, { type: 'matrix', prompt: 'm', key: '1 2 ; 3 4', points: 4 }, { type: 'factors', prompt: 'f', key: '2^3*3*5', points: 3 }, { type: 'number', prompt: 'n', key: '5', points: 2 }] });
  const code = a => C.parseSubmission(C.makeSubmission(w, 'Sam', a)).sub; const r = C.gradeAll(w, [code(['1, 2, 3, 9', '1 2 ; 3 0', '2^3*3*7', '4'])]).rows[0];
  assert.deepStrictEqual(r.per.map(p => p.pts), [3, 3, 2, 0]); assert.strictEqual(r.score, 8); assert.ok(r.per[0].partial && !r.per[0].ok);
  const off = C.normalise({ id: w.id, questions: w.questions }); const r2 = C.gradeAll(off, [code(['1, 2, 3, 9', '1 2 ; 3 0', '2^3*3*7', '4'])]).rows[0]; assert.strictEqual(r2.score, 0);
  const wrongShape = C.gradeAll(w, [code(['', '1 2', '', ''])]).rows[0]; assert.strictEqual(wrongShape.per[1].pts, 0);
});

test('teacher overrides adjust points, keep the original automatic mark and are clamped', () => {
  const w = C.normalise({ questions: [{ type: 'number', prompt: 'a', key: '1', points: 3 }, { type: 'number', prompt: 'b', key: '2', points: 2 }] });
  const subs = [C.parseSubmission(C.makeSubmission(w, 'Ana Ruiz', ['9', '2'])).sub];
  const res = C.gradeAll(w, subs, { 'ana ruiz|0': { pts: 1.5, note: 'right method' }, 'ana ruiz|1': { pts: 99 } });
  const p = res.rows[0].per; assert.strictEqual(p[0].pts, 1.5); assert.strictEqual(p[0].auto, 0); assert.ok(p[0].over && p[0].partial && p[0].comment === 'right method'); assert.strictEqual(p[1].pts, 2); assert.strictEqual(res.rows[0].score, 3.5);
  assert.strictEqual(C.gradeAll(w, subs, { 'ana ruiz|0': { pts: -5 } }).rows[0].per[0].pts, 0);
});

test('item analysis: common wrong answers, blanks and score bins', () => {
  const w = C.normalise({ questions: [{ type: 'number', prompt: 'a', key: '4' }, { type: 'choice', prompt: 'c', options: ['p', 'q', 'r'], key: '0' }] });
  const mk = (n, a) => C.parseSubmission(C.makeSubmission(w, n, a)).sub; const res = C.gradeAll(w, [mk('A', ['5', '1']), mk('B', ['5', '1']), mk('C', ['4', '']), mk('D', ['6', '0'])]);
  assert.deepStrictEqual(res.common[0], [{ answer: '5', count: 2 }]); assert.ok(/^B\. q/.test(res.common[1][0].answer)); assert.strictEqual(res.blank[1], 1); assert.strictEqual(res.bins.reduce((a, b) => a + b, 0), 4);
});

test('roster: who is missing and who used a name that is not on the list', () => {
  const rows = [{ name: 'ada lovelace' }, { name: 'Grace Hoper' }, { name: 'Stranger' }]; const r = C.matchRoster('Ada Lovelace\nGrace Hopper\nAlan Turing\n', rows);
  assert.deepStrictEqual(r.missing, ['Grace Hopper', 'Alan Turing']);
  const u = Object.fromEntries(r.unknown.map(x => [x.name, x.suggest])); assert.strictEqual(u['Grace Hoper'], 'Grace Hopper'); assert.strictEqual(u['Stranger'], null); assert.strictEqual(C.matchRoster('', rows).size, 0);
});

test('review questions and shared question links', async () => {
  const w = C.normalise({ questions: [{ type: 'number', prompt: 'easy', key: '1' }, { type: 'number', prompt: 'hard', key: '2' }] }); const mk = (n, a) => C.parseSubmission(C.makeSubmission(w, n, a)).sub;
  const res = C.gradeAll(w, [mk('A', ['1', '0']), mk('B', ['1', '5']), mk('C', ['1', '2'])]); const rev = C.reviewQuestions(w, res, 0.7); assert.strictEqual(rev.length, 1); assert.strictEqual(rev[0].prompt, 'hard');
  assert.deepStrictEqual(C.reviewQuestions(w, C.gradeAll(w, [mk('A', ['0', '0'])]), 0.7), []);
  const link = await C.encodeQuestions(w.questions); const back = await C.decodeQuestions(link); assert.deepStrictEqual(back.map(q => q.prompt), ['easy', 'hard']); assert.strictEqual(C.qKey(back[0]), C.qKey(w.questions[0]));
  const stuLink = await C.encodeStudent(w); await assert.rejects(() => C.decodeQuestions(stuLink), /shared questions/);
});

test('property: for 300 different student names, the answers derived from that student\'s own version always earn full marks, and another version does not', async () => {
  const w = tmpl({ shuffleQ: true, shuffleC: true, partial: true }); const stu = await C.decodeStudent(await C.encodeStudent(w)); const names = Array.from({ length: 300 }, (_, i) => `Student ${i} ${String.fromCharCode(97 + (i % 26))}`);
  let differ = 0, prev = null; for (const nm of names) {
    const seed = C.variantSeed(w.id, nm), mine = C.instantiate(w, seed), answers = mine.questions.map(q => q.type === 'choice' ? q.key : q.key); const sub = C.parseSubmission(C.makeSubmission(stu, nm, answers, { seed })); assert.ok(sub.ok);
    const res = C.gradeAll(w, [sub.sub]); assert.strictEqual(res.rows[0].score, res.rows[0].max, nm); assert.ok(res.rows[0].per.every(p => p.ok), nm);
    if (prev && prev.questions[0].prompt !== mine.questions[0].prompt) differ++; prev = mine;
    const other = C.instantiate(w, C.variantSeed(w.id, nm + ' x')); if (other.questions[1].key !== mine.questions[1].key) { const wrong = C.parseSubmission(C.makeSubmission(stu, nm, other.questions.map(q => q.key), { seed })); assert.ok(C.gradeAll(w, [wrong.sub]).rows[0].score < res.rows[0].max); }
  }
  assert.ok(differ > 150, 'neighbouring students should usually get different numbers (' + differ + ')');
});
