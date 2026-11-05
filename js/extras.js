/*
 * Calculus Suite Pro – extra tools (installed on top of the core engine).
 * DOM-free: works in the page, in the Web Worker and in Node.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = { install: factory };
    else root.CalcExtras = { install: factory };
})(typeof self !== 'undefined' ? self : this, function install(engine, math, Algebrite) {
    'use strict';
    const { CalcError, nice, fmt } = engine;
    const I = engine.internals;
    const added = {};
    function register(map) { Object.assign(added, map); Object.assign(engine.run, I.wrapRuns(map)); }
    engine.extras = { register };
    return engine;
});
