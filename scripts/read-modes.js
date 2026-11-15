/* Reads the MODES table (tool names, fields and examples) out of js/app.js without a browser,
   so generated pages always match the app. Unknown identifiers inside the table (option lists) read as []. */
const fs = require('fs'), path = require('path'), vm = require('vm');
function readModes() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
    const a = src.indexOf('const MODES = {'), b = src.indexOf('const MODE_GROUPS');
    if (a < 0 || b < a) throw new Error('MODES table not found in js/app.js');
    const sandbox = new Proxy({}, { has: (t, k) => k !== 'MODES' && k !== 'result', get: (t, k) => (k === Symbol.unscopables ? undefined : (k in globalThis ? globalThis[k] : [])) });
    const groups = vm.runInNewContext(src.slice(b, src.indexOf('];', b) + 2).replace('const MODE_GROUPS =', 'groups ='), { groups: null });
    const ctx = { sandbox, result: null }; vm.runInNewContext('with (sandbox) { ' + src.slice(a, b) + '; result = MODES; }', ctx);
    return { modes: ctx.result, groups };
}
module.exports = { readModes };
if (require.main === module) for (const [k, v] of Object.entries(readModes().modes)) console.log(k.padEnd(14), (v.label || '').padEnd(22), (v.examples || []).length, (v.fields || []).map(f => f.key).join(','));
