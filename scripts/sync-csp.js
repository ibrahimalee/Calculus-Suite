#!/usr/bin/env node
/* Keeps the Content-Security-Policy in vercel.json in step with the inline scripts in the HTML pages.
   Every inline <script> must be allowed by hash, so a changed script is silently blocked in production until its
   hash is updated. Run `npm run csp` after editing one; `npm test` fails if the hashes are out of date.
   Usage: node scripts/sync-csp.js [--check] */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const PAGES = ['index.html', 'app.html', 'teacher.html', 'worksheet.html', 'CalculusSuite.html'];

function inlineHashes() {
    const out = new Set();
    for (const f of PAGES) {
        const html = fs.readFileSync(path.join(root, f), 'utf8');
        const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi; let m;
        while ((m = re.exec(html))) if (m[1].trim()) out.add("'sha256-" + crypto.createHash('sha256').update(m[1], 'utf8').digest('base64') + "'");
    }
    return [...out].sort();
}
function sync(check) {
    const file = path.join(root, 'vercel.json'), cfg = JSON.parse(fs.readFileSync(file, 'utf8')), want = inlineHashes();
    let stale = false;
    for (const rule of cfg.headers || []) for (const h of rule.headers) {
        if (h.key !== 'Content-Security-Policy') continue;
        h.value = h.value.replace(/script-src ([^;]*)/, (all, list) => {
            const keep = list.split(/\s+/).filter(t => t && !/^'sha256-/.test(t));
            const next = keep.concat(want).join(' ');
            if (next !== list.split(/\s+/).filter(Boolean).join(' ')) stale = true;
            return 'script-src ' + next;
        });
    }
    if (check) return !stale;
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
    return true;
}
if (require.main === module) { const check = process.argv.includes('--check'); const ok = sync(check); if (check) { console.log(ok ? 'CSP hashes are current' : 'CSP hashes are out of date: run npm run csp'); process.exit(ok ? 0 : 1); } else console.log('vercel.json updated'); }
module.exports = { inlineHashes, sync };
