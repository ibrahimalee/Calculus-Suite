/* Student worksheet page: reads the worksheet from the link, collects answers, produces the submission code. */
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const C = window.CalcClassroom.create(window.math);
    const root = document.documentElement;
    function paintGlyph() { $('themeGlyph').textContent = root.getAttribute('data-theme') === 'dark' ? '☾' : '☀'; }
    paintGlyph();
    $('themeBtn').addEventListener('click', () => { const n = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; root.setAttribute('data-theme', n); paintGlyph(); try { localStorage.setItem('themeMode', n); localStorage.setItem('theme', n); } catch (e) { /* blocked */ } });

    const store = { get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* blocked */ } } };
    function rich(el, text) {
        el.textContent = '';
        String(text).split(/(\$[^$\n]+\$)/g).forEach(part => {
            if (/^\$[^$\n]+\$$/.test(part) && window.katex) { const s = document.createElement('span'); try { window.katex.render(part.slice(1, -1), s, { throwOnError: false, trust: false, maxExpand: 500, maxSize: 20 }); } catch (e) { s.textContent = part; } el.appendChild(s); }
            else el.appendChild(document.createTextNode(part));
        });
    }
    function show(id) { ['loading', 'problem', 'sheet'].forEach(k => { $(k).hidden = k !== id; }); }
    function fail(msg) { $('problemText').textContent = msg; show('problem'); }

    let ws, answers = [], key;
    const saved = () => store.get(key) || {};
    const persist = () => store.set(key, { name: $('stuName').value, a: answers });
    function countDone() { const n = answers.filter(a => String(a || '').trim()).length; $('progress').textContent = `${n} of ${ws.questions.length} answered`; }

    function build() {
        document.title = ws.title + ' – Calculus Suite Pro';
        $('wsTitle').textContent = ws.title; $('wsInstr').textContent = ws.instructions; $('wsInstr').hidden = !ws.instructions;
        $('calcRow').hidden = !ws.calculator; $('selfNote').hidden = !ws.selfCheck; $('checkBtn').hidden = !ws.selfCheck;
        const old = saved(); $('stuName').value = old.name || ''; answers = ws.questions.map((_, i) => (old.a && typeof old.a[i] === 'string' ? old.a[i] : ''));
        const ol = $('qs'); ol.textContent = '';
        ws.questions.forEach((q, i) => {
            const li = document.createElement('li'); li.className = 'q'; const body = document.createElement('div'); body.className = 'q-body'; li.appendChild(body);
            const p = document.createElement('p'); p.className = 'q-prompt'; p.id = `p${i}`; rich(p, q.prompt); const pts = document.createElement('span'); pts.className = 'q-pts'; pts.textContent = `${q.points} point${q.points > 1 ? 's' : ''}`; p.appendChild(pts); body.appendChild(p);
            const note = document.createElement('p'); note.className = 'q-note'; note.setAttribute('aria-live', 'polite'); note.id = `n${i}`;
            if (q.type === 'choice') {
                const ul = document.createElement('div'); ul.className = 'choices'; ul.setAttribute('role', 'radiogroup'); ul.setAttribute('aria-labelledby', `p${i}`);
                q.options.forEach((o, j) => { const lab = document.createElement('label'), r = document.createElement('input'); r.type = 'radio'; r.name = `q${i}`; r.value = String(j); r.checked = answers[i] === String(j); r.addEventListener('change', () => { answers[i] = String(j); persist(); countDone(); }); const t = document.createElement('span'); rich(t, o); lab.append(r, t); ul.appendChild(lab); });
                body.appendChild(ul);
            } else {
                const multi = q.type === 'matrix'; const inp = document.createElement(multi ? 'textarea' : 'input'); inp.className = 'in'; inp.id = `a${i}`; inp.setAttribute('aria-labelledby', `p${i}`); inp.autocomplete = 'off'; inp.spellcheck = false; inp.maxLength = C.LIMITS.answer; inp.autocapitalize = 'off';
                if (multi) { inp.rows = 3; inp.placeholder = 'rows separated by ;   e.g.  1 0 ; 0 1'; } else inp.placeholder = q.placeholder || ({ number: 'a number, e.g. 12 or 3/4', expr: 'e.g. 2*x*sin(x)', list: 'separate with commas', factors: 'e.g. 2^3*5', text: 'your answer' }[q.type] || '');
                inp.value = answers[i]; if (q.type === 'number') inp.inputMode = 'text';
                const prev = document.createElement('div'); prev.className = 'q-prev'; prev.setAttribute('aria-hidden', 'true'); let t = 0;
                inp.addEventListener('input', () => { answers[i] = inp.value; persist(); countDone(); clearTimeout(t); t = setTimeout(() => { const r = C.readable(q, inp.value); note.textContent = r.ok ? '' : `Can’t read that yet: ${r.note}.`; note.className = 'q-note' + (r.ok ? '' : ' bad'); prev.textContent = ''; if (r.ok && q.type === 'expr' && inp.value.trim() && window.katex) { try { const pp = C.safeParse(q.plusC ? inp.value.replace(/\s*[+-]\s*C\s*$/i, '') : inp.value); window.katex.render(pp.node.toTex() + (q.plusC && /[+-]\s*C\s*$/i.test(inp.value) ? '+C' : ''), prev, { throwOnError: false, trust: false }); prev.title = 'How the answer was read'; } catch (e) { /* ignore */ } } }, 250); });
                body.append(inp, prev);
            }
            body.appendChild(note);
            if (q.hint) { const d = document.createElement('details'); d.className = 'hint'; const s = document.createElement('summary'); s.textContent = 'Hint'; const hp = document.createElement('div'); rich(hp, q.hint); d.append(s, hp); body.appendChild(d); }
            const v = document.createElement('div'); v.id = `v${i}`; body.appendChild(v);
            ol.appendChild(li);
        });
        countDone(); show('sheet');
    }

    function selfCheck() {
        let got = 0, max = 0;
        ws.questions.forEach((q, i) => { max += q.points; const r = C.check(q, answers[i]), v = $(`v${i}`); v.className = 'verdict ' + (r.ok ? 'good' : 'miss'); if (r.ok) { got += q.points; v.textContent = '✓ Correct'; } else { v.textContent = r.note === 'blank' ? '✗ No answer yet' : `✗ Not quite. The expected answer is: ${q.type === 'choice' ? q.options[+q.key] : q.key}`; } });
        const b = $('scoreBox'); b.hidden = false; b.textContent = ''; const big = document.createElement('div'); big.className = 'score-big'; big.textContent = `${got} / ${max}`; b.appendChild(big);
        return { got, max };
    }
    let lastCode = '';
    function finish() {
        const err = $('finishErr'); err.textContent = '';
        const name = $('stuName').value.trim(); if (!name) { err.textContent = 'Type your name at the top first.'; $('stuName').focus(); return; }
        let code; try { code = C.makeSubmission(ws, name, answers); } catch (e) { err.textContent = e.message; return; }
        lastCode = code; $('codeBox').value = code; $('done').hidden = false;
        $('dlBtn').href = URL.createObjectURL(new Blob([code + '\n'], { type: 'text/plain' })); $('dlBtn').download = `${name.replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40) || 'answers'}-${ws.id}.txt`;
        const mail = $('mailBtn'); if (ws.email) { mail.href = `mailto:${ws.email}?subject=${encodeURIComponent(`${ws.title} – ${name}`)}&body=${encodeURIComponent(`My answers for "${ws.title}":\n\n${code}\n`)}`; mail.hidden = false; } else mail.hidden = true;
        if (ws.selfCheck) { selfCheck(); } else { $('scoreBox').hidden = true; }
        $('done').scrollIntoView({ behavior: 'smooth', block: 'start' }); $('codeBox').focus({ preventScroll: true });
        const blanks = answers.filter(a => !String(a || '').trim()).length; $('copyNote').textContent = blanks ? `Note: ${blanks} question${blanks > 1 ? 's are' : ' is'} still blank. You can go back, answer, and press the button again.` : '';
    }
    $('finishBtn').addEventListener('click', finish);
    $('checkBtn').addEventListener('click', () => { selfCheck(); $('scoreBox').scrollIntoView({ block: 'nearest' }); });
    $('stuName').addEventListener('input', persist);
    $('copyBtn').addEventListener('click', async () => { try { await navigator.clipboard.writeText(lastCode); $('copyNote').textContent = 'Copied. Paste it into a message to your teacher.'; } catch (e) { $('codeBox').select(); $('copyNote').textContent = 'Press Ctrl+C (or Cmd+C) to copy the selected code.'; } });
    $('printBtn').addEventListener('click', () => window.print());

    (async function init() {
        const m = /^#w=(.+)$/.exec(location.hash); if (!m) { fail('This page needs a worksheet link from your teacher. Ask them to send the link again.'); return; }
        try { ws = await C.decodeStudent(m[1]); key = 'cs_ws_' + ws.id; build(); } catch (e) { fail(e.message || 'The link looks incomplete. If it was long, it may have been cut off when it was sent; ask for it again.'); }
    })();
})();
