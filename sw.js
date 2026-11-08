/* Offline support.
   - Pages, styles and the app's own scripts: network first, but if the network has not answered within a few seconds the
     cached copy is used, so a poor connection does not leave a blank page. The cache is refreshed whenever the network answers.
   - vendor/ (libraries, fonts): cache first, in a cache that survives app releases, because those files never change in place.
   - The 4.8 MB plotting library is not fetched at install time; the page asks for it once it is idle (see 'warm').
   Query strings are ignored for caching, so ?ask=… and ?tool=… links do not each add a copy. */
const VERSION = 'cs-v29';
const SHELL = VERSION + '-shell';
const VENDOR = 'cs-vendor-v1';
const NETWORK_WAIT_MS = 4000;

const CORE = ['./', 'index.html', 'app.html', 'teacher.html', 'worksheet.html',
    'css/tokens.css', 'css/home.css', 'css/classroom.css', 'css/styles.css',
    'js/theme-init.js', 'js/dialog.js', 'js/home.js', 'js/classroom.js', 'js/teacher.js', 'js/worksheet.js', 'js/lib-guard.js', 'js/engine.js', 'js/extras.js', 'js/nlp.js', 'js/practice.js', 'js/i18n.js', 'js/braille.js', 'js/runner.js', 'js/worker.js', 'js/app.js',
    'icon.svg', 'manifest.webmanifest'];
const VENDOR_CORE = ['vendor/math.min.js', 'vendor/algebrite.min.js', 'vendor/katex/katex.min.js', 'vendor/katex/katex.min.css', 'vendor/qrcode/qrcode.js',
    'vendor/fonts/atkinson-hyperlegible-latin-400-normal.woff2', 'vendor/fonts/atkinson-hyperlegible-latin-400-italic.woff2', 'vendor/fonts/atkinson-hyperlegible-latin-700-normal.woff2',
    'vendor/fonts/atkinson-hyperlegible-mono-latin-400-normal.woff2', 'vendor/fonts/atkinson-hyperlegible-mono-latin-600-normal.woff2', 'vendor/fonts/source-serif-4-latin-wght-normal.woff2'];
const VENDOR_HEAVY = ['vendor/plotly.min.js'];

const keyFor = url => { const u = new URL(url, location.href); return new Request(u.origin + u.pathname); };
const storable = res => res && res.ok && res.type === 'basic';

self.addEventListener('install', e => {
    e.waitUntil(Promise.all([
        caches.open(SHELL).then(c => c.addAll(CORE)),
        caches.open(VENDOR).then(c => Promise.all(VENDOR_CORE.map(u => c.match(u).then(hit => hit || c.add(u)))))
    ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== VENDOR).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('message', e => {
    if (e.data !== 'warm') return;
    const client = e.source;
    e.waitUntil(caches.open(VENDOR).then(c => Promise.all(VENDOR_HEAVY.map(u => c.match(u).then(hit => hit || c.add(u)))))
        .then(() => { if (client) client.postMessage('offline-ready'); }, () => { /* offline or blocked: the page keeps saying it is still preparing */ }));
});

function cacheFirst(req) {
    return caches.open(VENDOR).then(c => c.match(req.url).then(hit => hit || fetch(req).then(res => { if (storable(res)) c.put(req.url, res.clone()); return res; })));
}

function networkFirst(req) {
    const key = keyFor(req.url);
    const cached = () => caches.match(key, { ignoreSearch: true });
    return new Promise(resolve => {
        let done = false;
        const finish = res => { if (!done && res) { done = true; resolve(res); } };
        const timer = setTimeout(() => cached().then(finish), NETWORK_WAIT_MS);
        fetch(req).then(res => {
            clearTimeout(timer);
            if (storable(res)) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(key, copy)); }
            finish(res);
        }).catch(() => {
            clearTimeout(timer);
            cached().then(hit => hit || (req.mode === 'navigate' ? caches.match(/app\.html/.test(req.url) ? 'app.html' : 'index.html') : null))
                .then(hit => finish(hit || Response.error()));
        });
    });
}

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
    if (new URL(req.url).pathname.includes('/vendor/')) e.respondWith(cacheFirst(req));
    else e.respondWith(networkFirst(req));
});
