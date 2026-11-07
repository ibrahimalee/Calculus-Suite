/*
 * Braille output.
 *  - Mathematics: Nemeth Code (US) through the Speech Rule Engine (Apache-2.0), fed with MathML made by KaTeX.
 *    The engine (about 1.2 MB) is fetched only when someone opens the Braille dialog.
 *  - Plain words: uncontracted Grade 1 braille (a simple, readable approximation).
 *  - Export: Unicode braille (works with refreshable displays and screen readers) and BRF (ASCII braille for embossers).
 * DOM-free except for the lazy loader in app.js; the conversion helpers run in Node for the tests.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Braille = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    // North-American braille ASCII: index = dot pattern (dot1 = 1 … dot6 = 32)
    const ASCII = ' A1B\'K2L@CIF/MSP"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)=';
    const toBRF = uni => Array.from(String(uni)).map(ch => { const c = ch.codePointAt(0); if (ch === '\n') return '\n'; if (c >= 0x2800 && c <= 0x283f) return ASCII[c - 0x2800]; return ch === ' ' ? ' ' : '?'; }).join('');
    const fromBRF = txt => Array.from(String(txt)).map(ch => { const i = ASCII.indexOf(ch.toUpperCase()); return ch === '\n' ? '\n' : (i >= 0 ? String.fromCodePoint(0x2800 + i) : ch); }).join('');

    // ---- Grade 1 (uncontracted) text ----
    const LET = { a: '⠁', b: '⠃', c: '⠉', d: '⠙', e: '⠑', f: '⠋', g: '⠛', h: '⠓', i: '⠊', j: '⠚', k: '⠅', l: '⠇', m: '⠍', n: '⠝', o: '⠕', p: '⠏', q: '⠟', r: '⠗', s: '⠎', t: '⠞', u: '⠥', v: '⠧', w: '⠺', x: '⠭', y: '⠽', z: '⠵' };
    const DIG = { 1: '⠁', 2: '⠃', 3: '⠉', 4: '⠙', 5: '⠑', 6: '⠋', 7: '⠛', 8: '⠓', 9: '⠊', 0: '⠚' };
    const PUN = { ',': '⠂', ';': '⠆', ':': '⠒', '.': '⠲', '!': '⠖', '?': '⠦', '-': '⠤', '’': '⠄', "'": '⠄', '“': '⠦', '”': '⠴', '"': '⠦', '(': '⠐⠣', ')': '⠐⠜', '/': '⠸⠌', '=': '⠐⠶', '+': '⠐⠖', '×': '⠐⠦', '*': '⠐⠔', '–': '⠤', '—': '⠤⠤', '…': '⠲⠲⠲', '%': '⠨⠴', '≈': '⠈⠆', '<': '⠐⠅', '>': '⠐⠂', '≤': '⠐⠅⠶', '≥': '⠐⠂⠶', '→': '⠳⠕', '·': '⠐⠆', '°': '⠘⠚', '^': '⠘', '_': '⠨⠤', '[': '⠨⠣', ']': '⠨⠜', '{': '⠸⠣', '}': '⠸⠜', '&': '⠈⠯', '@': '⠈⠁', '#': '⠨⠼', '|': '⠸⠳', '′': '⠄', '″': '⠄⠄' };
    function text(str) {
        let out = '', inNum = false;
        for (const ch of String(str)) {
            const lo = ch.toLowerCase();
            if (ch === ' ' || ch === ' ') { out += '⠀'; inNum = false; continue; }
            if (/[0-9]/.test(ch)) { if (!inNum) { out += '⠼'; inNum = true; } out += DIG[ch]; continue; }
            if (inNum && ch === '.' ) { out += '⠲'; continue; }
            if (ch === ',' && inNum) { out += '⠂'; continue; }
            inNum = false;
            if (LET[lo]) { out += (ch !== lo ? '⠠' : '') + LET[lo]; continue; }
            if (PUN[ch]) { out += PUN[ch]; continue; }
            out += '⠿';
        }
        return out;
    }

    // ---- layout: break only at braille spaces; never inside a word or an expression ----
    function wrap(line, width) {
        width = width || 40; if (Array.from(line).length <= width) return [line];
        const words = line.split('⠀'), out = []; let cur = '';
        for (const w of words) { const next = cur ? cur + '⠀' + w : w; if (Array.from(next).length <= width || !cur) cur = next; else { out.push(cur); cur = w; } }
        if (cur) out.push(cur); return out;
    }

    // ---- mathematics (needs SRE + KaTeX, injected so Node and browser share the code) ----
    let deps = { sre: null, katex: null };
    function configure(d) { deps = Object.assign(deps, d); }
    function mathml(tex) {
        const html = deps.katex.renderToString(String(tex), { output: 'mathml', throwOnError: true, displayMode: false });
        const m = /<math[\s\S]*<\/math>/.exec(html); if (!m) throw new Error('no MathML');
        return m[0];
    }
    function math(tex) {
        if (!deps.sre || !deps.katex) throw new Error('Braille engine not loaded');
        const out = deps.sre.toSpeech(mathml(tex));
        if (!out || /[^⠀-⣿\s]/.test(out)) throw new Error('no braille produced');
        return out.replace(/\s+/g, ' ').replace(/ /g, '⠀').trim();
    }

    /** Build the braille document for a result: [{kind:'text'|'math', src, braille}] */
    function document_(r, helpers) {
        const rows = [], add = (label, tex, plain) => {
            let braille = '', kind = 'text';
            const lab = label ? text(String(label).replace(/\s*[:=]\s*$/, '')) : '';
            let expr = '';
            if (tex) { try { expr = math(tex); kind = 'math'; } catch (e) { expr = ''; } }
            if (!expr && plain) { const t = helpers && helpers.toTex ? helpers.toTex(plain) : null; if (t) { try { expr = math(t); kind = 'math'; } catch (e) { expr = ''; } } }
            if (!expr && plain) expr = text(plain);
            braille = [lab, expr].filter(Boolean).join('⠀'); if (braille) rows.push({ kind, label, src: tex || plain || '', braille });
        };
        if (r.title) rows.push({ kind: 'title', label: '', src: r.title, braille: text(r.title) });
        if (r.main) add(r.main.tex ? '' : r.main.label, r.main.tex, r.main.text);
        (r.items || []).slice(0, 12).forEach(i => add(i.tex && !i.inline ? '' : i.label, i.tex, i.text));
        (r.warnings || []).slice(0, 3).forEach(w => rows.push({ kind: 'text', label: '', src: w, braille: text(w) }));
        return rows;
    }
    function layout(rows, width) { const lines = []; rows.forEach((row, i) => { wrap(row.braille, width).forEach(l => lines.push(l)); if (row.kind === 'title') lines.push(''); }); return lines.join('\n'); }

    return { ASCII, toBRF, fromBRF, text, wrap, configure, math, mathml, document: document_, layout };
});
