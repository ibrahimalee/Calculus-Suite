// Plain-English phrasings people actually type, and what each should become.
const test = require('node:test'), assert = require('node:assert');
const N = require('../js/nlp.js');
const corpus = require('./nlp-corpus.js');
for (const [q, mode, re, opts] of corpus) {
    test('understands: ' + q, () => {
        const r = N.parse(q);
        assert.ok(r, 'not understood');
        assert.strictEqual(r.mode, mode);
        if (re) assert.match(r.fn || '', re);
        for (const [k, v] of Object.entries(opts)) assert.strictEqual(String((r.opts || {})[k]), String(v), k);
    });
}
