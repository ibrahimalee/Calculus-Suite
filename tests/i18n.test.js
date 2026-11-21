const test = require('node:test'), assert = require('node:assert');
const I18N = require('../js/i18n.js');
test('every interface string has all five translations', () => {
  const bad = Object.entries(I18N.D).filter(([, row]) => !Array.isArray(row) || row.length !== 5 || row.some(x => typeof x !== 'string' || !x.trim()));
  assert.deepEqual(bad.map(b => b[0]), []);
  assert.ok(Object.keys(I18N.D).length > 80);
});
test('translations keep numbers and keyboard hints intact', () => {
  for (const [en, row] of Object.entries(I18N.D)) { const digits = en.match(/\d+/g) || []; row.forEach(t => digits.forEach(d => assert.ok(t.includes(d), `"${en}" → "${t}" lost ${d}`))); }
});
test('lookup falls back to English for unknown text', () => { assert.equal(I18N.tr('Some new string', 'fr'), 'Some new string'); assert.equal(I18N.tr('Compute', 'es'), 'Calcular'); });
test('the tools dictionary: every entry has five translations, numbers kept, and every tool label/choice/hint is covered', () => {
  const T = require('../js/i18n-tools.js');
  for (const [en, row] of Object.entries(T)) {
    assert.ok(Array.isArray(row) && row.length === 5 && row.every(x => typeof x === 'string' && x.trim()), en);
    (en.match(/\d+/g) || []).forEach(d => row.forEach(t => assert.ok(t.includes(d), `"${en}" → "${t}" lost ${d}`)));
    assert.ok(!(en in I18N.D), 'duplicated in js/i18n.js: ' + en);
  }
  const { modes } = require('../scripts/read-modes.js').readModes();
  const words = s => /[A-Za-z]{3,}/.test(String(s).replace(/\b(sqrt|dirac|inf|base|message)\b/g, ''));
  const missing = [];
  for (const m of Object.values(modes)) {
    (m.fields || []).forEach(f => { if (words(f.label) && !T[f.label] && !I18N.D[f.label]) missing.push(f.label); (f.options || []).forEach(o => { if (words(o[1]) && !T[o[1]] && !I18N.D[o[1]]) missing.push(o[1]); }); });
    const vs = [{}]; (m.fields || []).filter(f => f.options).forEach(f => f.options.forEach(o => vs.push({ [f.key]: o[0] })));
    vs.forEach(v => { try { const i = m.input(v); if (i.hint && !T[i.hint] && !I18N.D[i.hint]) missing.push(i.hint); if (i.label && words(i.label) && !T[i.label] && !I18N.D[i.label]) missing.push(i.label); } catch (e) { /* option-dependent */ } });
  }
  assert.deepEqual([...new Set(missing)], [], 'tool strings without a translation (add them to js/i18n-tools.js)');
});
