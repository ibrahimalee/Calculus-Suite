/* Offline support: app shell is network-first (always fresh when online), vendor libraries are cache-first. */
const VERSION = 'cs-v4';
const CORE = ['./', 'index.html', 'css/styles.css', 'js/lib-guard.js', 'js/engine.js', 'js/runner.js', 'js/worker.js', 'js/app.js',
    'vendor/math.min.js', 'vendor/algebrite.min.js', 'vendor/plotly.min.js', 'vendor/katex/katex.min.js', 'vendor/katex/katex.min.css',
    'icon.svg', 'manifest.webmanifest'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
    const isVendor = req.url.includes('/vendor/');
    e.respondWith(isVendor
        ? caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; }))
        : fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; }).catch(() => caches.match(req).then(hit => hit || caches.match('index.html'))));
});
