const test = require('node:test'), assert = require('node:assert');
const path = require('node:path');
let SRE; try { SRE = require('speech-rule-engine'); } catch (e) { SRE = null; }
const katex = require('../vendor/katex/katex.min.js'); const B = require('../js/braille.js');
const ready = SRE ? SRE.setupEngine({ domain: 'default', style: 'default', locale: 'nemeth', modality: 'braille' }).then(() => SRE.engineReady()).then(() => B.configure({ sre: SRE, katex })) : Promise.resolve();
const skip = { skip: SRE ? false : 'speech-rule-engine is not installed' };
test('Nemeth output for standard expressions (numeric indicator, baseline indicator, fractions, radicals)', skip, async () => {
  await ready;
  assert.equal(B.math('x^2+3x-4=0'), '⠭⠘⠆⠐⠬⠒⠭⠤⠲⠀⠨⠅⠀⠼⠴');          // exponent, baseline before "+", numeric indicator after "="
  assert.equal(B.math('\\frac12'), '⠹⠂⠌⠆⠼');                          // fraction open ⠹, line ⠌, close ⠼
  assert.equal(B.math('\\sqrt{x^2+1}'), '⠜⠭⠘⠆⠐⠬⠂⠻');                  // radical open ⠜ … close ⠻
  assert.equal(B.math('\\infty'), '⠠⠿');
  assert.equal(B.math('f(x)=2x^2'), '⠋⠷⠭⠾⠀⠨⠅⠀⠼⠆⠭⠘⠆');
});
test('braille documents for a result: title, Nemeth lines and Grade 1 words', skip, async () => {
  await ready;
  const rows = B.document({ title: 'Derivative', main: { label: 'f′(x) =', text: '2x', tex: "f'(x)=2x" }, items: [{ label: 'Note:', text: 'ok', tex: '' }], warnings: [] }, {});
  assert.equal(rows[0].kind, 'title'); assert.equal(rows[1].kind, 'math'); assert.ok(rows[1].braille.startsWith('⠋⠄⠷⠭⠾')); assert.ok(/^⠀|⠝⠕⠞⠑/.test(rows[2].braille));
});
test('Grade 1 text, capitals and numbers', () => { assert.equal(B.text('Hello 42'), '⠠⠓⠑⠇⠇⠕⠀⠼⠙⠃'); assert.equal(B.text('a, b.'), '⠁⠂⠀⠃⠲'); });
test('BRF (ASCII braille) conversion round-trips and matches the standard table', () => {
  assert.equal(B.toBRF('⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚'), 'ABCDEFGHIJ'); assert.equal(B.toBRF('⠼⠂⠆⠒'), '#123'); assert.equal(B.toBRF('⠷⠾'), '()'); assert.equal(B.toBRF('⠀'), ' ');
  for (let c = 0x2800; c <= 0x283f; c++) { const ch = String.fromCodePoint(c); assert.equal(B.fromBRF(B.toBRF(ch)), ch); }
});
test('line wrapping breaks only at braille spaces', () => { const l = '⠁⠃⠉⠀⠙⠑⠋⠀⠛⠓⠊'; assert.deepEqual(B.wrap(l, 7), ['⠁⠃⠉⠀⠙⠑⠋', '⠛⠓⠊']); assert.deepEqual(B.wrap('⠁⠃⠉⠙⠑⠋⠛⠓', 4), ['⠁⠃⠉⠙⠑⠋⠛⠓']); });
