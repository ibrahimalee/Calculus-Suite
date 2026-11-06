'use strict';
/**
 * Calculus Suite engine as a Node library.
 *
 *   const { createEngine } = require('calculus-suite-pro');
 *   const engine = createEngine();
 *   engine.run.derivative('x^2*sin(x)', {}).main.text      // '2 * x * sin(x) + x ^ 2 * cos(x)'
 *   engine.run.laplace('t*exp(-2t)', {}).main.text          // '(1) / ((s + 2)^2)'
 *
 * Every `engine.run.<tool>(input, options)` returns a plain result object
 * { kind, title, main, items, meta, warnings, steps, plot, text, badges }.
 */
const math = require('mathjs');
const Algebrite = require('algebrite');
const Engine = require('../js/engine.js');
const Extras = require('../js/extras.js');
const NL = require('../js/nlp.js');
const Practice = require('../js/practice.js');

function createEngine() {
    const engine = Engine.create(math, Algebrite);
    Extras.install(engine, math, Algebrite);
    return engine;
}
/** Plain-English question → { mode, fn, opts, say } (or null). Run it with engine.run[mode](fn, opts). */
function ask(engine, question) {
    const q = NL.parse(question); if (!q) return null;
    return { ...q, result: engine.run[q.mode](q.fn, q.opts) };
}
function createPractice(engine) { return Practice.create(engine, math); }

module.exports = { createEngine, ask, createPractice, parseQuestion: NL.parse };
