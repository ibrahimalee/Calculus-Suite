const test = require('node:test'), assert = require('node:assert');
const I18N = require('../js/i18n.js');
test('every interface string has all five translations', () => {
  const bad = Object.entries(I18N.D).filter(([, row]) => !Array.isArray(row) || row.length !== 5 || row.some(x => typeof x !== 'string' || !x.trim()));
  assert.deepEqual(bad.map(b => b[0]), []);
  assert.ok(Object.keys(I18N.D).length > 90);
});
test('translations keep numbers and keyboard hints intact', () => {
  for (const [en, row] of Object.entries(I18N.D)) { const digits = en.match(/\d+/g) || []; row.forEach(t => digits.forEach(d => assert.ok(t.includes(d), `"${en}" → "${t}" lost ${d}`))); }
});
test('lookup falls back to English for unknown text', () => { assert.equal(I18N.tr('Some new string', 'fr'), 'Some new string'); assert.equal(I18N.tr('Compute', 'es'), 'Calcular'); });
