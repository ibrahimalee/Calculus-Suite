/*
 * Runner: executes engine jobs in a Web Worker (with timeout + automatic
 * restart). Falls back to running inline when workers are unavailable
 * (e.g. some browsers block workers on file:// URLs).
 */
(function () {
    'use strict';
    const TIMEOUT_MS = 25000;
    let engine = null;       // main-thread engine (used for parsing, previews, hydration, fallback)
    let worker = null, workerState = 'idle', readyPromise = null;
    let nextId = 1;
    const pending = new Map();

    function getEngine() {
        if (!engine) engine = CalcEngine.create(math, typeof Algebrite !== 'undefined' ? Algebrite : null);
        return engine;
    }

    function startWorker() {
        if (readyPromise) return readyPromise;
        readyPromise = new Promise(resolve => {
            if (typeof Worker === 'undefined') { workerState = 'unavailable'; resolve(false); return; }
            let w;
            try { w = new Worker('js/worker.js'); } catch (e) { workerState = 'unavailable'; resolve(false); return; }
            const timer = setTimeout(() => { workerState = 'unavailable'; try { w.terminate(); } catch (e) { /* ignore */ } resolve(false); }, 4000);
            w.onmessage = ev => {
                const d = ev.data;
                if (d.type === 'ready') { clearTimeout(timer); worker = w; workerState = 'ready'; resolve(true); return; }
                if (d.type === 'initError') { clearTimeout(timer); workerState = 'unavailable'; w.terminate(); resolve(false); return; }
                const job = pending.get(d.id);
                if (!job) return;
                pending.delete(d.id);
                clearTimeout(job.timer);
                if (d.ok) {
                    try { job.resolve(getEngine().hydrate(d.result)); } catch (e) { job.reject(e); }
                } else {
                    const err = new Error(d.error);
                    err.user = d.user;
                    job.reject(err);
                }
            };
            w.onerror = () => { clearTimeout(timer); if (workerState !== 'ready') { workerState = 'unavailable'; resolve(false); } };
        });
        return readyPromise;
    }

    function restartWorker() {
        if (worker) { worker.terminate(); worker = null; }
        workerState = 'idle';
        readyPromise = null;
        pending.forEach(job => { clearTimeout(job.timer); job.reject(new Error('Cancelled')); });
        pending.clear();
        startWorker();
    }

    async function run(mode, src, opts) {
        const ok = await startWorker();
        if (!ok) {
            // inline fallback – let the browser paint the spinner first
            await new Promise(r => setTimeout(r, 20));
            return getEngine().run[mode](src, opts);
        }
        return new Promise((resolve, reject) => {
            const id = nextId++;
            const timer = setTimeout(() => {
                pending.delete(id);
                restartWorker();
                const err = new Error('The computation took too long (over ' + TIMEOUT_MS / 1000 + ' s) and was stopped. Try a simpler expression, a different method, or a numerical (definite) version.');
                err.user = true;
                reject(err);
            }, TIMEOUT_MS);
            pending.set(id, { resolve, reject, timer });
            worker.postMessage({ id, mode, src, opts });
        });
    }

    window.Runner = { run, getEngine, warmUp: startWorker, cancel: restartWorker, isBusy: () => pending.size > 0, mode: () => (workerState === 'ready' ? 'background worker' : 'main thread') };
})();
