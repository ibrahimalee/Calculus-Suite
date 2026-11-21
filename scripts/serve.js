// Static server that applies the headers from vercel.json (the same rules Vercel uses), so the app can be
// tested under its real Content-Security-Policy. Usage: node scripts/serve.js [port] [folder]   (default 8080, the repository root)
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', process.argv[3] || '.');   // optional second argument: a folder, e.g. dist
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };
const matches = (src, p) => src === '/:path*' || (src.endsWith('/:path*') ? p.startsWith(src.slice(0, -7) + '/') : src === p);
http.createServer((req, res) => {
    const route = decodeURIComponent(req.url.split('?')[0]);
    const rel = route.endsWith('/') ? route + 'index.html' : route;
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
        const headers = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' };
        (cfg.headers || []).forEach(rule => { if (matches(rule.source, route)) rule.headers.forEach(h => { headers[h.key] = headers[h.key] ? headers[h.key] + ', ' + h.value : h.value; }); });
        res.writeHead(200, headers); res.end(data);
    });
}).listen(+process.argv[2] || 8080, () => console.log('serving with vercel.json headers on ' + (+process.argv[2] || 8080)));
