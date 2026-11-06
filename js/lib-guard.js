/*
 * Library loader.
 *
 * Every dependency ships in /vendor so the app works offline and from file://.
 * If a local file is missing (e.g. only the HTML was copied) we fall back to a
 * CDN. Scripts are loaded in order, then js/engine.js, js/runner.js and
 * js/app.js start the application.
 */
(function () {
    'use strict';

    const LIBS = [
        { name: 'math.js', global: 'math', urls: ['vendor/math.min.js', 'https://cdn.jsdelivr.net/npm/mathjs@11.11.0/lib/browser/math.js'] },
        { name: 'Algebrite', global: 'Algebrite', urls: ['vendor/algebrite.min.js', 'https://cdn.jsdelivr.net/npm/algebrite@1.4.0/dist/algebrite.bundle-for-browser.js'] },
        { name: 'Plotly', global: 'Plotly', urls: ['vendor/plotly.min.js', 'https://cdn.jsdelivr.net/npm/plotly.js-dist-min@4.2.0/plotly.min.js'] },
        { name: 'KaTeX', global: 'katex', optional: true, urls: ['vendor/katex/katex.min.js', 'https://cdn.jsdelivr.net/npm/katex@0.19.1/dist/katex.min.js'] }
    ];
    const APP_SCRIPTS = ['js/engine.js', 'js/extras.js', 'js/nlp.js', 'js/practice.js', 'js/i18n.js', 'js/runner.js', 'js/app.js'];

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const el = document.createElement('script');
            el.src = url;
            el.async = false;
            el.onload = resolve;
            el.onerror = () => { el.remove(); reject(new Error('Failed to load ' + url)); };
            document.head.appendChild(el);
        });
    }

    async function loadLibrary(lib) {
        if (typeof window[lib.global] !== 'undefined') return true;
        for (const url of lib.urls) {
            try {
                await loadScript(url);
                if (typeof window[lib.global] !== 'undefined') return true;
            } catch (e) {
                console.warn(e.message + (url === lib.urls[lib.urls.length - 1] ? '' : ' – trying fallback'));
            }
        }
        return false;
    }

    function showBanner(missing) {
        const el = document.createElement('div');
        el.className = 'lib-alert';
        el.setAttribute('role', 'alert');
        el.innerHTML = '<strong>⚠️ Library loading error</strong><br>Could not load: ' +
            missing.map(m => String(m).replace(/[<>&]/g, '')).join(', ') +
            '<br><small>Check your connection or that the vendor/ folder is deployed, then reload.</small>';
        (document.body || document.documentElement).appendChild(el);
    }

    window.libsReady = (async function () {
        const missing = [];
        for (const lib of LIBS) {
            const ok = await loadLibrary(lib);
            if (!ok) (lib.optional ? console.warn('Optional library missing: ' + lib.name) : missing.push(lib.name));
        }
        if (missing.length) { showBanner(missing); throw new Error('Missing libraries: ' + missing.join(', ')); }
        for (const src of APP_SCRIPTS) await loadScript(src);
    })().catch(err => console.error(err));
})();
