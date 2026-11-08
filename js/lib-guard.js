/*
 * Library loader.
 *
 * Every dependency ships in /vendor so the app works offline and from file://.
 * There is deliberately no CDN fallback: unpinned third-party scripts are a supply-chain risk,
 * and the Content-Security-Policy would block them. All scripts are requested together and run in order: the libraries,
 * then js/engine.js … js/app.js, which start the application. Plotly is 4.8 MB, so it is not loaded here: window.loadPlotly() fetches it the first
 * time a plot is drawn.
 */
(function () {
    'use strict';

    const LIBS = [
        { name: 'math.js', global: 'math', urls: ['vendor/math.min.js'] },
        { name: 'Algebrite', global: 'Algebrite', urls: ['vendor/algebrite.min.js'] },
        { name: 'KaTeX', global: 'katex', optional: true, urls: ['vendor/katex/katex.min.js'] }
    ];
    const APP_SCRIPTS = ['js/engine.js', 'js/extras.js', 'js/nlp.js', 'js/dialog.js', 'js/practice.js', 'js/i18n.js', 'js/braille.js', 'js/runner.js', 'js/app.js'];

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

    function showBanner(missing) {
        const el = document.createElement('div');
        el.className = 'lib-alert';
        el.setAttribute('role', 'alert');
        el.innerHTML = '<strong>A library failed to load</strong><br>Could not load: ' +
            missing.map(m => String(m).replace(/[<>&]/g, '')).join(', ') +
            '<br><small>Check your connection or that the vendor/ folder is deployed, then reload.</small>';
        (document.body || document.documentElement).appendChild(el);
    }

    let plotlyLoading = null;
    window.loadPlotly = function () {
        if (typeof window.Plotly !== 'undefined') return Promise.resolve();
        if (!plotlyLoading) {
            plotlyLoading = loadScript('vendor/plotly.min.js').then(() => {
                if (typeof window.Plotly === 'undefined') throw new Error('Plotly did not initialise');
            }).catch(err => { plotlyLoading = null; showBanner(['Plotly (the plotting library)']); throw err; });
        }
        return plotlyLoading;
    };

    window.libsReady = (async function () {
        // every script is requested at once; async = false makes the browser run them in this order
        const urls = LIBS.map(l => l.urls[0]).concat(APP_SCRIPTS);
        const results = await Promise.allSettled(urls.map(loadScript));
        const missing = LIBS.filter((l, i) => results[i].status === 'rejected' || typeof window[l.global] === 'undefined').filter(l => {
            if (l.optional) console.warn('Optional library missing: ' + l.name);
            return !l.optional;
        }).map(l => l.name);
        results.slice(LIBS.length).forEach((r, i) => { if (r.status === 'rejected') missing.push(APP_SCRIPTS[i]); });
        if (missing.length) { showBanner(missing); throw new Error('Missing libraries: ' + missing.join(', ')); }
    })().catch(err => console.error(err));
})();
