/* Runs the CalcEngine off the UI thread so heavy symbolic work can never freeze the page. */
'use strict';
try {
    // The vendored browser bundles expect a `window`; a worker only has `self`.
    if (typeof window === 'undefined') self.window = self;
    importScripts('../vendor/math.min.js', '../vendor/algebrite.min.js', 'engine.js');
    const g = self;
    const Alg = g.Algebrite || (g.window && g.window.Algebrite);
    const engine = g.CalcEngine.create(g.math, Alg);
    g.onmessage = ev => {
        const { id, mode, src, opts } = ev.data;
        try {
            const result = engine.run[mode](src, opts);
            g.postMessage({ id, ok: true, result: engine.serialize(result) });
        } catch (err) {
            g.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err), user: err instanceof engine.CalcError });
        }
    };
    g.postMessage({ type: 'ready', algebrite: !!Alg });
} catch (err) {
    self.postMessage({ type: 'initError', error: String(err && err.message ? err.message : err) });
}
