/*
 * Classroom core: worksheet format, answer checking, submission codes and grading.
 * DOM-free (browser and Node). No server: a worksheet travels inside a link, a student's work travels
 * back as a short code, and the teacher's page (which holds the answer key) grades the codes.
 *
 * Not a secure exam system: a student can read the key in "self-check" worksheets and can fabricate a
 * code. It is for homework, practice and low-stakes quizzes.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = { create: factory };
    else root.CalcClassroom = { create: factory };
})(typeof self !== 'undefined' ? self : this, function create(math) {
    'use strict';
    const TYPES = ['number', 'expr', 'choice', 'text', 'list', 'matrix', 'factors'];
    const LIMITS = { questions: 40, prompt: 1200, key: 400, title: 120, instr: 2000, name: 80, option: 160, answer: 400 };
    const TYPE_LABEL = { number: 'Number', expr: 'Expression / formula', choice: 'Multiple choice', text: 'Short text', list: 'List of numbers', matrix: 'Matrix', factors: 'Prime factorisation' };

    // ---------- small helpers ----------
    const b64u = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
    const unb64u = str => { const s = atob(String(str).replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/=]/g, '')); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
    const utf8 = s => new TextEncoder().encode(s), unutf8 = b => new TextDecoder().decode(b);
    const fnv = str => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
    const uid = () => { const a = new Uint8Array(6); (globalThis.crypto || { getRandomValues: x => x.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(a); return b64u(a).slice(0, 8); };
    const clip = (v, n) => String(v === undefined || v === null ? '' : v).slice(0, n);

    async function deflate(bytes) { if (typeof CompressionStream === 'undefined') return null; try { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); } catch (e) { return null; } }
    async function inflate(bytes) { if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed worksheet links. Please update your browser.'); try { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); } catch (e) { throw new Error('This worksheet link is damaged or incomplete.'); } }
    async function pack(obj) { const raw = utf8(JSON.stringify(obj)); const z = await deflate(raw); return z && z.length < raw.length ? 'z' + b64u(z) : 'r' + b64u(raw); }
    async function unpack(str) { str = String(str || '').trim(); if (!str) throw new Error('Empty link.'); const kind = str[0], body = str.slice(1); let bytes = unb64u(body); if (kind === 'z') bytes = await inflate(bytes); else if (kind !== 'r') throw new Error('This link is not a worksheet.'); return JSON.parse(unutf8(bytes)); }

    // ---------- worksheet model ----------
    /** Validate and clean a worksheet object from the builder (or from an imported file). Throws on a problem. */
    function normalise(ws) {
        if (!ws || typeof ws !== 'object') throw new Error('Not a worksheet.');
        const qs = Array.isArray(ws.questions) ? ws.questions : []; if (!qs.length) throw new Error('Add at least one question.'); if (qs.length > LIMITS.questions) throw new Error(`At most ${LIMITS.questions} questions.`);
        const out = { id: /^[A-Za-z0-9_-]{4,16}$/.test(ws.id || '') ? ws.id : uid(), title: clip(ws.title, LIMITS.title).trim() || 'Worksheet', instructions: clip(ws.instructions, LIMITS.instr), email: clip(ws.email, 120).trim(), calculator: !!ws.calculator, selfCheck: !!ws.selfCheck, timeLimit: Math.max(0, Math.min(600, Math.round(+ws.timeLimit || 0))), timeLock: ws.timeLock === undefined ? true : !!ws.timeLock, created: ws.created || Date.now(), questions: [] };
        qs.forEach((q, i) => {
            const type = TYPES.includes(q.type) ? q.type : 'number'; const prompt = clip(q.prompt, LIMITS.prompt).trim(); if (!prompt) throw new Error(`Question ${i + 1} has no text.`);
            const c = { type, prompt, points: Math.max(1, Math.min(100, Math.round(+q.points || 1))), hint: clip(q.hint, 400), key: clip(q.key, LIMITS.key).trim() };
            if (q.placeholder) c.placeholder = clip(q.placeholder, 60);
            if (type === 'choice') { const opts = (Array.isArray(q.options) ? q.options : []).map(o => clip(o, LIMITS.option).trim()).filter(Boolean); if (opts.length < 2 || opts.length > 8) throw new Error(`Question ${i + 1} needs 2 to 8 choices.`); c.options = opts; const k = parseInt(c.key, 10); if (!(k >= 0 && k < opts.length)) throw new Error(`Question ${i + 1}: pick the correct choice.`); c.key = String(k); }
            else if (!c.key) throw new Error(`Question ${i + 1} has no correct answer.`);
            if (type === 'number') { if (q.tol !== undefined && q.tol !== '' && +q.tol > 0) c.tol = +q.tol; try { numeric(c.key); } catch (e) { throw new Error(`Question ${i + 1}: the correct answer must be a number (like 12, 3/4 or sqrt(2)).`); } }
            if (type === 'expr') { c.plusC = !!q.plusC; try { safeParse(c.key.replace(c.plusC ? /\s*[+-]\s*C\s*$/i : /$^/, '')); } catch (e) { throw new Error(`Question ${i + 1}: the correct expression could not be read (${e.message}).`); } }
            if (type === 'list') { try { numList(c.key); } catch (e) { throw new Error(`Question ${i + 1}: the correct list must be numbers separated by commas.`); } }
            if (type === 'matrix') { try { parseMatrix(c.key); } catch (e) { throw new Error(`Question ${i + 1}: the correct matrix must be rows of numbers separated by ;`); } }
            if (type === 'factors') { try { factorMap(c.key); } catch (e) { throw new Error(`Question ${i + 1}: write the factorisation like 2^3*5.`); } }
            out.questions.push(c);
        });
        return out;
    }
    /** What a student receives. The key is left out unless the worksheet is in self-check mode. */
    async function encodeStudent(ws) {
        const o = { v: 1, id: ws.id, t: ws.title, i: ws.instructions, e: ws.email, a: ws.calculator ? 1 : 0, s: ws.selfCheck ? 1 : 0, tl: ws.timeLimit || 0, lk: ws.timeLock === false ? 0 : 1, q: ws.questions.map(q => { const r = { y: q.type, p: q.prompt, n: q.points }; if (q.hint) r.h = q.hint; if (q.placeholder) r.ph = q.placeholder; if (q.options) r.o = q.options; if (ws.selfCheck) { r.k = q.key; if (q.tol) r.tl = q.tol; if (q.plusC) r.pc = 1; } return r; }) };
        return pack(o);
    }
    async function decodeStudent(str) {
        const o = await unpack(str); if (!o || o.v !== 1 || !Array.isArray(o.q)) throw new Error('This link is not a worksheet.'); if (o.q.length > LIMITS.questions) throw new Error('Too many questions.');
        return { id: clip(o.id, 16), title: clip(o.t, LIMITS.title) || 'Worksheet', instructions: clip(o.i, LIMITS.instr), email: /^[^\s@<>"]+@[^\s@<>"]+$/.test(o.e || '') ? clip(o.e, 120) : '', calculator: !!o.a, selfCheck: !!o.s, timeLimit: Math.max(0, Math.min(600, Math.round(+o.tl || 0))), timeLock: o.lk !== 0, questions: o.q.map(r => { const type = TYPES.includes(r.y) ? r.y : 'text'; const q = { type, prompt: clip(r.p, LIMITS.prompt), points: Math.max(1, Math.min(100, Math.round(+r.n || 1))), hint: clip(r.h, 400), placeholder: clip(r.ph, 60) }; if (Array.isArray(r.o)) q.options = r.o.slice(0, 8).map(x => clip(x, LIMITS.option)); if (o.s) { q.key = clip(r.k, LIMITS.key); if (r.tl > 0) q.tol = +r.tl; q.plusC = !!r.pc; } return q; }) };
    }

    // ---------- safe expression handling (answers are untrusted text) ----------
    const FUNCS = new Set(['sqrt', 'cbrt', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'exp', 'log', 'log10', 'log2', 'abs', 'sign', 'floor', 'ceil', 'round', 'gamma', 'factorial', 'min', 'max', 'pow', 'nthRoot', 'atan2', 'sec', 'csc', 'cot']);
    const CONSTS = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI };
    function prep(s) { return String(s).replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/²/g, '^2').replace(/³/g, '^3').replace(/π/g, 'pi').replace(/√\s*\(/g, 'sqrt(').replace(/√\s*([A-Za-z0-9.]+)/g, 'sqrt($1)').replace(/\bln\s*\(/g, 'log(').replace(/\barc(sin|cos|tan)\b/g, 'a$1').replace(/\^\s*\{([^}]*)\}/g, '^($1)').replace(/(\d),(\d{3})(?!\d)/g, '$1$2'); }
    function safeParse(src) {
        const t = String(src || '').trim(); if (!t) throw new Error('empty'); if (t.length > LIMITS.answer) throw new Error('too long');
        let node; try { node = math.parse(prep(t)); } catch (e) { throw new Error('cannot read that'); }
        const vars = new Set(); let size = 0;
        node.traverse(n => { size++; if (size > 400) throw new Error('too complicated'); const ty = n.type; if (ty === 'ConstantNode' || ty === 'ParenthesisNode' || ty === 'OperatorNode') { if (ty === 'ConstantNode' && typeof n.value !== 'number') throw new Error('only numbers are allowed'); return; } if (ty === 'SymbolNode') { if (!(n.name in CONSTS) && !FUNCS.has(n.name)) vars.add(n.name); return; } if (ty === 'FunctionNode') { const nm = n.fn && n.fn.name; if (!FUNCS.has(nm)) throw new Error(`“${nm}” is not allowed`); return; } throw new Error('that kind of expression is not allowed'); });
        return { node, vars: [...vars], code: node.compile() };
    }
    function evalAt(p, scope) { try { const v = p.code.evaluate(Object.assign({}, CONSTS, scope)); if (typeof v === 'number' && Number.isFinite(v)) return v; if (v && typeof v.re === 'number' && Math.abs(v.im) < 1e-12) return v.re; return NaN; } catch (e) { return NaN; } }
    function numeric(s) { const p = safeParse(s); if (p.vars.length) throw new Error('not a number'); const v = evalAt(p, {}); if (!Number.isFinite(v)) throw new Error('not a number'); return v; }
    const numList = s => String(s).split(/[;,\s]+|\band\b/i).filter(Boolean).map(numeric);
    function parseMatrix(s) { const rows = String(s).replace(/[\[\]]/g, ' ').split(/;|\n/).map(r => r.trim()).filter(Boolean).map(r => r.split(/[\s,]+/).filter(Boolean).map(numeric)); if (!rows.length || rows.some(r => r.length !== rows[0].length)) throw new Error('ragged'); if (rows.length > 6 || rows[0].length > 6) throw new Error('too big'); return rows; }
    function factorMap(s) {
        const map = new Map(); const t = prep(String(s)).replace(/\s+/g, ''); if (!t || t.length > 120) throw new Error('empty');
        t.split(/[*]/).forEach(part => { const m = /^\(?(\d+)\)?(?:\^\(?(\d+)\)?)?$/.exec(part); if (!m) throw new Error('bad'); const p = +m[1], e = m[2] ? +m[2] : 1; if (p < 2 || e < 1 || e > 60) throw new Error('bad'); for (let d = 2; d * d <= p; d++) if (p % d === 0) throw new Error('composite'); map.set(p, (map.get(p) || 0) + e); });
        return map;
    }
    const sameMap = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);

    // ---------- checking ----------
    const near = (a, b, tol) => Math.abs(a - b) <= (tol !== undefined ? tol : 1e-6 * Math.max(1, Math.abs(b)));
    function sampleScopes(names, n) { let s = 0x2545F491; const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; return Array.from({ length: n }, () => { const sc = {}; names.forEach(v => { sc[v] = -2.9 + 6 * rnd(); }); return sc; }); }
    /** Check one answer against a question that carries its key. Returns { ok: true|false, note }. */
    function check(q, answer) {
        const raw = clip(answer, LIMITS.answer).trim(); if (!raw) return { ok: false, note: 'blank' };
        try {
            switch (q.type) {
                case 'choice': return { ok: String(parseInt(raw, 10)) === String(q.key), note: '' };
                case 'text': { const norm = (s, sym) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(sym ? /[^a-z0-9.\-+/]+/g : /[^a-z0-9]+/g, ''); return { ok: String(q.key).split('|').some(k => norm(k, /\d/.test(k)) === norm(raw, /\d/.test(k))), note: '' }; }
                case 'number': { const v = numeric(raw), k = numeric(q.key); return { ok: near(v, k, q.tol), note: '' }; }
                case 'list': { const a = numList(raw).sort((x, y) => x - y), k = numList(q.key).sort((x, y) => x - y); return { ok: a.length === k.length && a.every((v, i) => near(v, k[i], q.tol)), note: '' }; }
                case 'matrix': { const a = parseMatrix(raw), k = parseMatrix(q.key); return { ok: a.length === k.length && a[0].length === k[0].length && a.every((r, i) => r.every((v, j) => near(v, k[i][j], q.tol))), note: '' }; }
                case 'factors': return { ok: sameMap(factorMap(raw), factorMap(q.key)), note: '' };
                case 'expr': {
                    const strip = s => (q.plusC ? String(s).replace(/\s*[+-]\s*C\s*$/i, '') : String(s)); const a = safeParse(strip(raw)), k = safeParse(strip(q.key));
                    const names = [...new Set(a.vars.concat(k.vars))]; if (a.vars.some(v => !k.vars.includes(v)) && a.vars.length) { /* extra variable in the student's answer */ }
                    const scopes = sampleScopes(names, 30); const diffs = []; let used = 0, bad = 0;
                    for (const sc of scopes) { const x = evalAt(a, sc), y = evalAt(k, sc); if (!Number.isFinite(y)) continue; if (!Number.isFinite(x)) { bad++; continue; } used++; if (q.plusC) diffs.push(x - y); else if (!near(x, y)) bad++; }
                    if (used < 6) return { ok: false, note: 'could not be compared' };
                    if (q.plusC) { const lo = Math.min(...diffs), hi = Math.max(...diffs); return { ok: bad === 0 && hi - lo <= 1e-7 * Math.max(1, Math.abs(hi), Math.abs(lo)), note: '' }; }
                    return { ok: bad === 0, note: '' };
                }
                default: return { ok: false, note: 'unknown type' };
            }
        } catch (e) { return { ok: false, note: e.message || 'unreadable' }; }
    }
    /** Is this answer at least well-formed? (used for a live hint on the student page) */
    function readable(q, answer) {
        const raw = clip(answer, LIMITS.answer).trim(); if (!raw) return { ok: true };
        try { if (q.type === 'number') numeric(raw); else if (q.type === 'list') numList(raw); else if (q.type === 'matrix') parseMatrix(raw); else if (q.type === 'factors') factorMap(raw); else if (q.type === 'expr') safeParse(q.plusC ? raw.replace(/\s*[+-]\s*C\s*$/i, '') : raw); return { ok: true }; }
        catch (e) { return { ok: false, note: e.message }; }
    }

    // ---------- submissions ----------
    function makeSubmission(ws, name, answers, meta) {
        const nm = clip(name, LIMITS.name).trim(); if (!nm) throw new Error('Enter your name first.');
        const body = { w: ws.id, n: nm, t: Date.now(), a: ws.questions.map((_, i) => clip(answers[i], LIMITS.answer)) }; if (meta && Number.isFinite(meta.used)) { body.d = Math.max(0, Math.min(86400, Math.round(meta.used))); if (meta.over) body.o = 1; }
        const payload = b64u(utf8(JSON.stringify(body)));
        return `CSW1.${payload}.${fnv(payload + '|' + ws.id)}`;
    }
    function parseSubmission(code) {
        const t = String(code || '').replace(/\s+/g, ''); const m = /^CSW1\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(t); if (!m) return { ok: false, error: 'Not a submission code (it should start with CSW1.)' };
        let body; try { body = JSON.parse(unutf8(unb64u(m[1]))); } catch (e) { return { ok: false, error: 'The code is damaged (part of it may be missing).' }; }
        if (!body || typeof body.w !== 'string' || !Array.isArray(body.a)) return { ok: false, error: 'The code is damaged.' };
        if (fnv(m[1] + '|' + body.w) !== m[2]) return { ok: false, error: 'The code has a typo or is incomplete (checksum mismatch).' };
        return { ok: true, sub: { w: clip(body.w, 16), n: clip(body.n, LIMITS.name), t: +body.t || 0, d: Number.isFinite(+body.d) && body.d !== undefined ? Math.max(0, Math.min(86400, Math.round(+body.d))) : null, o: body.o === 1, a: body.a.slice(0, LIMITS.questions).map(x => clip(x, LIMITS.answer)) } };
    }
    /** Split pasted text into codes (one per line, or run together) and parse each. */
    function parseMany(text) {
        const t = String(text || '').replace(/^[ \t>]+/gm, ''); const parts = t.split(/(?=CSW1\.)/).filter(x => x.startsWith('CSW1.')); const stray = t.split(/\n/).filter(l => l.trim() && !/CSW1\./.test(l)).length;
        const out = parts.map(seg => { const flat = seg.replace(/\s+/g, ''); const m = /^CSW1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}/.exec(flat); const code = m ? m[0] : flat.slice(0, 80); return Object.assign(parseSubmission(code), { code }); });
        return { results: out, stray };
    }
    function grade(ws, sub) {
        const per = ws.questions.map((q, i) => { const r = check(q, sub.a[i]); return { ok: r.ok, note: r.note, pts: r.ok ? q.points : 0, answer: sub.a[i] || '' }; });
        return { name: sub.n, time: sub.t, used: sub.d === undefined ? null : sub.d, over: !!sub.o, per, score: per.reduce((a, p) => a + p.pts, 0), max: ws.questions.reduce((a, q) => a + q.points, 0) };
    }
    /** Grade many submissions: the latest submission per student name wins; wrong-worksheet codes are reported. */
    function gradeAll(ws, subs) {
        const byName = new Map(), skipped = []; subs.forEach(s => { if (s.w !== ws.id) { skipped.push({ name: s.n, why: 'a different worksheet' }); return; } const k = s.n.trim().toLowerCase(); const prev = byName.get(k); if (!prev || s.t >= prev.t) { if (prev) skipped.push({ name: prev.n, why: 'an older submission by the same name' }); byName.set(k, s); } else skipped.push({ name: s.n, why: 'an older submission by the same name' }); });
        const rows = [...byName.values()].map(s => grade(ws, s)).sort((a, b) => a.name.localeCompare(b.name));
        const n = rows.length, perQ = ws.questions.map((q, i) => (n ? rows.filter(r => r.per[i].ok).length / n : 0));
        const pct = rows.map(r => (r.max ? r.score / r.max : 0)).sort((a, b) => a - b); const mean = n ? pct.reduce((a, b) => a + b, 0) / n : 0, median = n ? (pct[Math.floor((n - 1) / 2)] + pct[Math.ceil((n - 1) / 2)]) / 2 : 0;
        return { rows, skipped, perQuestion: perQ, mean, median, count: n };
    }
    const csvCell = v => { let s = String(v === undefined || v === null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    function toCSV(ws, res) {
        const timed = ws.timeLimit > 0; const head = ['Name'].concat(ws.questions.map((_, i) => `Q${i + 1} (${ws.questions[i].points})`), ['Score', 'Out of', 'Percent'], timed ? ['Minutes used', 'Ran out of time'] : []);
        const rows = res.rows.map(r => [r.name].concat(r.per.map(p => p.pts), [r.score, r.max, r.max ? Math.round(1000 * r.score / r.max) / 10 : 0], timed ? [r.used === null ? '' : Math.round(r.used / 6) / 10, r.over ? 'yes' : 'no'] : []));
        return [head].concat(rows).map(r => r.map(csvCell).join(',')).join('\r\n');
    }
    /** Turn the practice generator's problems into worksheet questions. */
    function fromPractice(P, topic, level, count, seed) {
        const out = []; for (let i = 0; i < count; i++) {
            const g = P.generate(topic, level, (seed >>> 0) + i * 7919 + 1); let type = 'number', key = g.answerText, extra = {};
            if (g.input === 'expression') { if (/^Prime factorisation/i.test(g.text)) type = 'factors'; else { type = 'expr'; if (/\+\s*C\s*$/i.test(key)) extra.plusC = true; } }
            else if (g.input === 'list') type = 'list'; else if (g.input === 'matrix') type = 'matrix';
            key = String(key).replace(/\s*\*\s*/g, '*').replace(/\s+\^\s+/g, '^').trim(); if (g.topic === 'stats' && /standard deviation/.test(g.text)) extra.tol = 0.0051;
            if (type === 'matrix') key = String(key).replace(/\s+/g, ' ');
            out.push(Object.assign({ type, prompt: g.text, key, points: 1, hint: '', placeholder: g.placeholder || '' }, extra));
        }
        return out;
    }
    return { TYPES, TYPE_LABEL, LIMITS, uid, normalise, encodeStudent, decodeStudent, check, readable, makeSubmission, parseSubmission, parseMany, grade, gradeAll, toCSV, fromPractice, safeParse, _fnv: fnv };
});
