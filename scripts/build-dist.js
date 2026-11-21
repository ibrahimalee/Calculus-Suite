// Deploy build: copies the site into dist/ and minifies the app's own JavaScript (the vendored libraries are already
// minified). The source in the repository stays readable and the site still runs straight from the folder without
// this step; Vercel runs it on every deploy (vercel.json → buildCommand). Usage: npm run build
const fs = require('fs'), path = require('path');
const { minify } = require('terser');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'dist');
const SKIP = new Set(['.git', '.github', '.vscode', 'node_modules', 'tests', 'scripts', 'dist', 'package.json', 'package-lock.json', 'translations-review.csv', '.vercelignore', '.gitignore', 'vercel.json', 'site.config.json']);
const skip = name => SKIP.has(name) || /\.md$/i.test(name);

function copyDir(src, dst) {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
        if (src === ROOT && skip(e.name)) continue;
        const s = path.join(src, e.name), d = path.join(dst, e.name);
        if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
    }
}

(async () => {
    fs.rmSync(OUT, { recursive: true, force: true });
    copyDir(ROOT, OUT);
    const targets = fs.readdirSync(path.join(OUT, 'js')).filter(f => f.endsWith('.js')).map(f => path.join(OUT, 'js', f)).concat([path.join(OUT, 'sw.js')]);
    let before = 0, after = 0;
    for (const file of targets) {
        const src = fs.readFileSync(file, 'utf8');
        const out = await minify(src, { ecma: 2020, compress: { passes: 2 }, mangle: true, format: { comments: false } });
        if (!out.code) throw new Error('minify failed: ' + file);
        fs.writeFileSync(file, out.code);
        before += src.length; after += out.code.length;
    }
    console.log(`dist/ built: ${targets.length} scripts minified, ${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB.`);
})().catch(e => { console.error(e); process.exit(1); });
