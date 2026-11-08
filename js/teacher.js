/* Teacher page: worksheet builder and gradebook. Everything stays in this browser. */
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const C = window.CalcClassroom.create(window.math);
    const engine = window.CalcEngine.create(window.math, window.Algebrite); if (window.CalcExtras) window.CalcExtras.install(engine, window.math, window.Algebrite);
    const P = window.Practice.create(engine, window.math);
    const root = document.documentElement;
    const h = (tag, attrs, ...kids) => { const e = document.createElement(tag); Object.keys(attrs || {}).forEach(k => { if (k === 'class') e.className = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else if (attrs[k] !== false && attrs[k] !== undefined) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]); }); kids.flat().forEach(c => { if (c !== null && c !== undefined) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return e; };
    function paintGlyph() { $('themeGlyph').textContent = root.getAttribute('data-theme') === 'dark' ? '☾' : '☀'; }
    paintGlyph(); $('themeBtn').addEventListener('click', () => { const n = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; root.setAttribute('data-theme', n); paintGlyph(); try { localStorage.setItem('themeMode', n); localStorage.setItem('theme', n); } catch (e) { /* blocked */ } });

    // ---------- storage ----------
    const KEY = 'cs_classroom_v1', SUBS = id => 'cs_classroom_subs_' + id;
    const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v === null ? d : v; } catch (e) { return d; } };
    const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
    let sheets = (load(KEY, []) || []).filter(s => s && typeof s === 'object' && Array.isArray(s.questions)); let cur = null;
    const blank = () => ({ id: C.uid(), title: '', instructions: '', email: '', calculator: false, selfCheck: false, created: Date.now(), questions: [{ type: 'number', prompt: '', key: '', points: 1, hint: '' }] });
    function persist() { if (!cur) return; const i = sheets.findIndex(s => s.id === cur.id); if (i < 0) sheets.push(cur); else sheets[i] = cur; if (!save(KEY, sheets)) $('linkErr').textContent = 'Could not save in this browser (storage is full or blocked). Use Export file to keep your work.'; refreshPickers(); }
    let timer = 0; const later = () => { clearTimeout(timer); timer = setTimeout(persist, 300); };

    function refreshPickers() {
        [$('wsPick'), $('gradePick')].forEach(sel => { const v = sel.value; sel.textContent = ''; sheets.forEach(s => sel.appendChild(h('option', { value: s.id, text: (s.title || 'Untitled worksheet') + ` · ${s.questions.length} question${s.questions.length === 1 ? '' : 's'}` }))); if (cur && sheets.some(s => s.id === cur.id)) sel.value = (sel === $('gradePick') && v && sheets.some(s => s.id === v)) ? v : cur.id; });
    }
    function use(id) { const s = sheets.find(x => x.id === id); if (!s) return; cur = s; renderBuilder(); $('linkBox').hidden = true; $('linkErr').textContent = ''; $('wsPick').value = id; }

    // ---------- builder ----------
    const TYPE_HELP = { number: 'A number. Fractions and things like sqrt(2)/2 are fine.', expr: 'A formula in x. Any equivalent form is accepted.', choice: '', text: 'Separate accepted alternatives with |', list: 'Numbers separated by commas; order does not matter.', matrix: 'Rows separated by ;  e.g. 1 0 ; 0 2', factors: 'Like 2^3*3*5. Students must use primes.' };
    function renderBuilder() {
        $('wsTitle').value = cur.title; $('wsInstr').value = cur.instructions; $('wsEmail').value = cur.email || ''; $('wsCalc').checked = !!cur.calculator; $('wsSelf').checked = !!cur.selfCheck; $('wsPartial').checked = !!cur.partial; $('wsShuffleQ').checked = !!cur.shuffleQ; $('wsShuffleC').checked = !!cur.shuffleC; $('wsTime').value = cur.timeLimit || 0; $('wsLock').checked = cur.timeLock !== false; $('wsLock').disabled = !(cur.timeLimit > 0);
        const list = $('qList'); list.textContent = ''; $('qCount').textContent = `(${cur.questions.length} of ${C.LIMITS.questions})`;
        cur.questions.forEach((q, i) => list.appendChild(qCard(q, i)));
    }
    function qCard(q, i) {
        const err = h('p', { class: 'err', role: 'status' });
        const validate = () => { try { C.normalise({ questions: [Object.assign({}, q)] }); err.textContent = ''; } catch (e) { err.textContent = e.message.replace(/^Question 1[: ]?\s*/, ''); } };
        const upd = (k, v) => { q[k] = v; later(); validate(); };
        const type = h('select', { 'aria-label': `Question ${i + 1} type`, onchange: e => { q.type = e.target.value; if (q.type === 'choice' && !q.options) { q.options = ['', '']; q.key = '0'; } later(); renderBuilder(); } }, C.TYPES.map(t => { const o = h('option', { value: t, text: C.TYPE_LABEL[t] }); if (t === q.type) o.selected = true; return o; }));
        const prompt = h('textarea', { rows: 3, maxlength: C.LIMITS.prompt, placeholder: 'Question text. Wrap maths in $…$, e.g. Differentiate $x^2\\sin x$', 'aria-label': `Question ${i + 1} text`, oninput: e => upd('prompt', e.target.value) }); prompt.value = q.prompt;
        const pts = h('input', { class: 'in', type: 'number', min: 1, max: 100, value: q.points || 1, 'aria-label': `Question ${i + 1} points`, oninput: e => upd('points', +e.target.value || 1) });
        let answer;
        if (q.type === 'choice') {
            const opts = h('textarea', { rows: 4, placeholder: 'One choice per line (2 to 8)', 'aria-label': `Question ${i + 1} choices`, oninput: e => { q.options = e.target.value.split('\n'); later(); validate(); correct.textContent = ''; fillCorrect(); } }); opts.value = (q.options || []).join('\n');
            const correct = h('select', { 'aria-label': `Question ${i + 1} correct choice`, onchange: e => upd('key', e.target.value) });
            const fillCorrect = () => { correct.textContent = ''; (q.options || []).map(o => o.trim()).forEach((o, j) => { if (o) { const op = h('option', { value: String(j), text: `${String.fromCharCode(65 + j)}. ${o.slice(0, 50)}` }); if (String(j) === String(q.key)) op.selected = true; correct.appendChild(op); } }); };
            fillCorrect(); answer = h('div', null, h('label', { class: 'field' }, h('span', { text: 'Choices' }), opts), h('label', { class: 'field' }, h('span', { text: 'Correct choice' }), correct));
        } else {
            const key = q.type === 'matrix' ? h('textarea', { rows: 2, 'aria-label': `Question ${i + 1} correct answer`, oninput: e => upd('key', e.target.value) }) : h('input', { class: 'in', type: 'text', maxlength: C.LIMITS.key, 'aria-label': `Question ${i + 1} correct answer`, autocomplete: 'off', spellcheck: 'false', oninput: e => upd('key', e.target.value) }); key.value = q.key || '';
            const extra = [];
            if (q.type === 'number') extra.push(h('label', { class: 'field' }, h('span', { text: 'Allowed error (optional)' }), h('input', { class: 'in', type: 'number', step: 'any', min: 0, value: q.tol || '', placeholder: 'default: a very tight match', oninput: e => upd('tol', e.target.value ? +e.target.value : undefined) })));
            if (q.type === 'expr') extra.push(h('label', { class: 'checks', style: 'margin:0 0 12px' }, h('input', { type: 'checkbox', checked: !!q.plusC, onchange: e => upd('plusC', e.target.checked) }), h('span', { text: 'Accept any constant of integration (for antiderivatives)' })));
            answer = h('div', null, h('label', { class: 'field' }, h('span', { text: 'Correct answer' }), key, h('span', { class: 'small', style: 'text-transform:none;letter-spacing:0', text: TYPE_HELP[q.type] })), ...extra);
        }
        const hint = h('input', { class: 'in', type: 'text', maxlength: 400, placeholder: 'Optional hint shown to students', 'aria-label': `Question ${i + 1} hint`, oninput: e => upd('hint', e.target.value) }); hint.value = q.hint || '';
        const sampleBox = h('p', { class: 'small sample', role: 'status', 'aria-live': 'polite' });
        const showSample = () => { sampleBox.textContent = ''; if (!(q.rand || '').trim()) return; try { C.parseVars(q.rand); const v = C.instantiateQuestion(q, C.uid(), i); const ans = q.type === 'choice' ? (v.options || [])[+v.key] : v.key; sampleBox.textContent = `Sample version → ${v.prompt.replace(/\s+/g, ' ').slice(0, 160)}   |   answer: ${ans === undefined ? '' : ans}`; } catch (e) { sampleBox.textContent = ''; } };
        const rand = h('textarea', { rows: 3, maxlength: C.LIMITS.rand, placeholder: 'Optional: different numbers for every student, one per line\na = 2..9\nb = -5..5 except 0\nThen write @{a}, @{+b} or @{a*b} in the question and the answer.', 'aria-label': `Question ${i + 1} random numbers`, oninput: e => { upd('rand', e.target.value); showSample(); } }); rand.value = q.rand || '';
        const randBox = h('details', { class: 'randbox' }, h('summary', { text: 'Random numbers per student' }), h('label', { class: 'field' }, h('span', { text: 'Define the numbers' }), rand), h('div', { class: 'row' }, h('button', { class: 'btn btn-line btn-sm', type: 'button', onclick: showSample, text: 'Show a sample version' })), sampleBox, h('p', { class: 'small', text: 'Ranges are a = 2..9 (add “step 0.5” or “except 0”), lists are c = 1, 2, 4, 8. Each student gets their own numbers, made from their name, and the answer key follows automatically.' })); if ((q.rand || '').trim()) { randBox.open = true; showSample(); }
        const move = d => () => { const j = i + d; if (j < 0 || j >= cur.questions.length) return; [cur.questions[i], cur.questions[j]] = [cur.questions[j], cur.questions[i]]; persist(); renderBuilder(); };
        const card = h('div', { class: 'card qcard' },
            h('h3', null, `Question ${i + 1}`, h('span', { class: 'row' },
                h('button', { class: 'btn btn-line btn-sm', type: 'button', 'aria-label': `Move question ${i + 1} up`, onclick: move(-1), text: '↑' }),
                h('button', { class: 'btn btn-line btn-sm', type: 'button', 'aria-label': `Move question ${i + 1} down`, onclick: move(1), text: '↓' }),
                h('button', { class: 'btn btn-line btn-sm', type: 'button', onclick: () => { cur.questions.splice(i + 1, 0, JSON.parse(JSON.stringify(q))); persist(); renderBuilder(); }, text: 'Copy' }),
                h('button', { class: 'btn btn-line btn-sm', type: 'button', 'aria-label': `Save question ${i + 1} to the bank`, onclick: () => saveToBank([q]), text: 'Save to bank' }),
                h('button', { class: 'btn btn-danger btn-sm', type: 'button', 'aria-label': `Delete question ${i + 1}`, onclick: () => { cur.questions.splice(i, 1); if (!cur.questions.length) cur.questions.push({ type: 'number', prompt: '', key: '', points: 1, hint: '' }); persist(); renderBuilder(); }, text: 'Delete' }))),
            h('div', { class: 'grid2' }, h('label', { class: 'field' }, h('span', { text: 'Type' }), type), h('label', { class: 'field' }, h('span', { text: 'Points' }), pts)),
            h('label', { class: 'field' }, h('span', { text: 'Question' }), prompt), answer, h('label', { class: 'field' }, h('span', { text: 'Hint (optional)' }), hint), randBox, err);
        if (q.prompt || q.key) validate(); return card;
    }
    $('wsTitle').addEventListener('input', e => { cur.title = e.target.value; later(); }); $('wsInstr').addEventListener('input', e => { cur.instructions = e.target.value; later(); });
    $('wsEmail').addEventListener('input', e => { cur.email = e.target.value; later(); }); $('wsCalc').addEventListener('change', e => { cur.calculator = e.target.checked; later(); }); $('wsSelf').addEventListener('change', e => { cur.selfCheck = e.target.checked; later(); });
    [['wsPartial', 'partial'], ['wsShuffleQ', 'shuffleQ'], ['wsShuffleC', 'shuffleC']].forEach(([id, k]) => $(id).addEventListener('change', e => { cur[k] = e.target.checked; later(); }));
    $('wsTime').addEventListener('input', e => { cur.timeLimit = Math.max(0, Math.min(600, Math.round(+e.target.value || 0))); $('wsLock').disabled = !(cur.timeLimit > 0); later(); }); $('wsLock').addEventListener('change', e => { cur.timeLock = e.target.checked; later(); });
    $('addQ').addEventListener('click', () => { if (cur.questions.length >= C.LIMITS.questions) { $('linkErr').textContent = `At most ${C.LIMITS.questions} questions per worksheet.`; return; } cur.questions.push({ type: 'number', prompt: '', key: '', points: 1, hint: '' }); persist(); renderBuilder(); const t = $('qList').querySelectorAll('textarea'); if (t.length) t[t.length - 1].focus(); });
    $('genTopic').appendChild(document.createDocumentFragment()); P.TOPICS.forEach(t => $('genTopic').appendChild(h('option', { value: t[0], text: t[1] })));
    $('genBtn').addEventListener('click', () => {
        const n = Math.max(1, Math.min(20, parseInt($('genCount').value, 10) || 5)); if (cur.questions.length === 1 && !cur.questions[0].prompt && !cur.questions[0].key) cur.questions = [];
        const room = C.LIMITS.questions - cur.questions.length; if (room <= 0) { $('linkErr').textContent = `At most ${C.LIMITS.questions} questions per worksheet.`; return; }
        try { cur.questions.push(...C.fromPractice(P, $('genTopic').value, +$('genLevel').value, Math.min(n, room), parseInt($('genSeed').value, 10) || 1)); } catch (e) { $('linkErr').textContent = 'Could not generate: ' + e.message; return; }
        if (!cur.title) cur.title = P.TOPICS.find(t => t[0] === $('genTopic').value)[1] + ' practice'; persist(); renderBuilder();
    });
    $('newBtn').addEventListener('click', () => { cur = blank(); sheets.push(cur); persist(); renderBuilder(); $('linkBox').hidden = true; $('wsTitle').focus(); });
    $('exampleBtn').addEventListener('click', () => {
        const w = { id: C.uid(), title: 'Example: derivatives with your own numbers', instructions: 'Every student gets different numbers, made from their name. Answers in any equivalent form are accepted.', partial: true, shuffleC: true, created: Date.now(), questions: [
            { type: 'expr', prompt: 'Differentiate $@{a}x^3 @{+b}x^2$', key: '@{3*a}*x^2 + @{2*b}*x', rand: 'a = 2..9\nb = -5..5 except 0', points: 2, hint: 'Use the power rule on each term.' },
            { type: 'number', prompt: 'What is the slope of $y = @{a}x^2$ at $x = @{c}$?', key: '@{2*a*c}', rand: 'a = 2..9\nc = 1..5', points: 1 },
            { type: 'choice', prompt: 'The derivative of $e^{@{k}x}$ is', options: ['$@{k}e^{@{k}x}$', '$e^{@{k}x}$', '$@{k}x\\,e^{@{k}x-1}$', '$\\dfrac{e^{@{k}x}}{@{k}}$'], key: '0', rand: 'k = 2..6', points: 1 },
            { type: 'list', prompt: 'Find both roots of $x^2 - @{r1+r2}x + @{r1*r2}$ (any order).', key: '@{r1}, @{r2}', rand: 'r1 = 1..4\nr2 = 5..9', points: 2 }] };
        try { C.normalise(w); } catch (e) { toast('Could not build the example: ' + e.message); return; }
        sheets.push(w); cur = w; persist(); renderBuilder(); $('linkBox').hidden = true; toast('Example loaded. Press “Create the student link”, then open it in two private windows with different names to see different numbers.');
    });
    $('dupBtn').addEventListener('click', () => { const c = JSON.parse(JSON.stringify(cur)); c.id = C.uid(); c.title = (c.title || 'Worksheet') + ' (copy)'; c.created = Date.now(); cur = c; sheets.push(cur); persist(); renderBuilder(); $('linkBox').hidden = true; });
    $('delBtn').addEventListener('click', () => { if (!confirm(`Delete “${cur.title || 'Untitled worksheet'}” and its saved submissions from this browser? Export a file first if you may need it again.`)) return; try { localStorage.removeItem(SUBS(cur.id)); localStorage.removeItem('cs_classroom_ov_' + cur.id); localStorage.removeItem('cs_classroom_roster_' + cur.id); } catch (e) { /* ignore */ } sheets = sheets.filter(s => s.id !== cur.id); if (!sheets.length) sheets.push(blank()); cur = sheets[0]; save(KEY, sheets); refreshPickers(); renderBuilder(); $('linkBox').hidden = true; });
    $('wsPick').addEventListener('change', e => use(e.target.value));
    $('expBtn').addEventListener('click', () => { const blob = new Blob([JSON.stringify({ calculusSuiteWorksheet: 1, worksheet: cur }, null, 1)], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(blob), download: (cur.title || 'worksheet').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40) + '.worksheet.json' }); document.body.appendChild(a); a.click(); a.remove(); });
    $('impFile').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (f.size > 2e6) { $('linkErr').textContent = 'That file is too large to be a worksheet.'; return; } try { const o = JSON.parse(await f.text()); const w = o && o.calculusSuiteWorksheet === 1 ? o.worksheet : null; if (!w) throw new Error('This is not a worksheet file from Calculus Suite Pro.'); const clean = C.normalise(w); const ex = sheets.findIndex(s => s.id === clean.id); if (ex >= 0) clean.id = C.uid(); cur = clean; sheets.push(cur); persist(); renderBuilder(); $('linkErr').textContent = ''; } catch (err) { $('linkErr').textContent = 'Import failed: ' + err.message; } });
    // ---------- QR code for the student link ----------
    let qrMatrix = null;
    function makeQR(text) {
        if (typeof window.qrcode !== 'function') throw new Error('The QR library did not load.');
        const qr = window.qrcode(0, 'L'); qr.addData(text, 'Byte'); qr.make(); const n = qr.getModuleCount(); const m = []; for (let r = 0; r < n; r++) { const row = []; for (let c = 0; c < n; c++) row.push(qr.isDark(r, c)); m.push(row); } return m;
    }
    function drawQR(text) {
        const box = $('qrBox'), note = $('qrNote'); note.textContent = ''; qrMatrix = null; box.hidden = true;
        try { qrMatrix = makeQR(text); } catch (e) { const msg = String((e && e.message) || e); note.textContent = /overflow|length/i.test(msg) ? 'This link is too long for a QR code (the limit is about 2,900 characters). Use fewer or shorter questions, or share the link by chat or email.' : 'Could not make a QR code: ' + msg; return; }
        const n = qrMatrix.length, q = 4, svg = $('qrSvg'); svg.textContent = ''; svg.setAttribute('viewBox', `0 0 ${n + 2 * q} ${n + 2 * q}`);
        const NS = 'http://www.w3.org/2000/svg'; const bg = document.createElementNS(NS, 'rect'); bg.setAttribute('width', n + 2 * q); bg.setAttribute('height', n + 2 * q); bg.setAttribute('fill', '#fff'); svg.appendChild(bg);
        let d = ''; qrMatrix.forEach((row, r) => { let c = 0; while (c < n) { if (!row[c]) { c++; continue; } let e = c; while (e < n && row[e]) e++; d += `M${c + q} ${r + q}h${e - c}v1h${c - e}z`; c = e; } });
        const path = document.createElementNS(NS, 'path'); path.setAttribute('d', d); path.setAttribute('fill', '#000'); svg.appendChild(path); box.hidden = false;
    }
    $('qrPng').addEventListener('click', () => {
        if (!qrMatrix) return; const n = qrMatrix.length, q = 4, px = 10, size = (n + 2 * q) * px, cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000'; qrMatrix.forEach((row, r) => row.forEach((v, c) => { if (v) g.fillRect((c + q) * px, (r + q) * px, px, px); }));
        cv.toBlob(b => { const a = h('a', { href: URL.createObjectURL(b), download: ((cur && cur.title) || 'worksheet').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40) + '-qr.png' }); document.body.appendChild(a); a.click(); a.remove(); }, 'image/png');
    });
    $('qrPrint').addEventListener('click', () => { const frame = document.querySelector('.qr-frame'); const wrap = document.createElement('div'); wrap.className = 'qr-print-root'; wrap.style.cssText = 'display:none;text-align:center;padding:40px'; const t = document.createElement('h1'); t.textContent = (cur && cur.title) || 'Worksheet'; const copy = frame.cloneNode(true); copy.style.cssText = 'display:inline-block;border:0'; copy.querySelector('svg').style.cssText = 'width:420px;height:420px'; const p2 = document.createElement('p'); p2.textContent = 'Scan to open the worksheet'; wrap.append(t, copy, p2); document.querySelector('main').appendChild(wrap); document.body.classList.add('print-qr'); const done = () => { document.body.classList.remove('print-qr'); wrap.remove(); window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); window.print(); });
    $('linkBtn').addEventListener('click', async () => {
        const err = $('linkErr'); err.textContent = '';
        try {
            const clean = C.normalise(cur); cur.id = clean.id; persist(); const code = await C.encodeStudent(clean); const url = new URL('worksheet.html', location.href); url.hash = 'w=' + code; const s = url.href;
            $('linkOut').value = s; $('linkBox').hidden = false; $('openLink').href = s; drawQR(s);
            $('linkNote').textContent = s.length > 6000 ? `This link is ${s.length.toLocaleString()} characters. Some chat apps cut very long links; consider fewer questions or send it by email.` : `${s.length.toLocaleString()} characters.${clean.selfCheck ? ' Practice mode: the answers are inside this link.' : ' The answer key is not in the link.'}`;
        } catch (e) { err.textContent = e.message; $('linkBox').hidden = true; }
    });
    $('copyLink').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('linkOut').value); $('linkNote').textContent = 'Copied. Paste it into your class chat or email.'; } catch (e) { $('linkOut').select(); $('linkNote').textContent = 'Press Ctrl+C (or Cmd+C) to copy.'; } });
    $('toGrade').addEventListener('click', () => { tab('grade'); $('gradePick').value = cur.id; renderGrades(); });

    // ---------- tabs ----------
    function tab(which) { const b = which === 'build'; $('paneBuild').hidden = !b; $('paneGrade').hidden = b; $('tabBuild').setAttribute('aria-selected', String(b)); $('tabGrade').setAttribute('aria-selected', String(!b)); $('tabBuild').tabIndex = b ? 0 : -1; $('tabGrade').tabIndex = b ? -1 : 0; if (!b) { refreshPickers(); if (cur) $('gradePick').value = cur.id; renderGrades(); } }
    $('tabBuild').addEventListener('click', () => tab('build')); $('tabGrade').addEventListener('click', () => tab('grade'));
    [$('tabBuild'), $('tabGrade')].forEach(t => t.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const g = t === $('tabBuild'); tab(g ? 'grade' : 'build'); (g ? $('tabGrade') : $('tabBuild')).focus(); } }));

    // ---------- gradebook ----------
    const OV = id => 'cs_classroom_ov_' + id, ROSTER = id => 'cs_classroom_roster_' + id;
    const subsFor = id => (load(SUBS(id), []) || []).map(c => C.parseSubmission(c)).filter(p => p.ok).map(p => p.sub);
    const ovFor = id => { const o = load(OV(id), {}); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; };
    const gradeSheet = () => sheets.find(s => s.id === $('gradePick').value);
    function normSheet(s) { try { return C.normalise(s); } catch (e) { return null; } }
    const fmtPts = v => String(Math.round(v * 100) / 100);
    let reopen = null, rosterFor = null;
    function renderRoster(res) {
        const note = $('rosterNote'); note.textContent = ''; const m = C.matchRoster($('roster').value, res ? res.rows : []); if (!m.size) return;
        const bits = [`${m.size} on the class list`, `${m.size - m.missing.length} handed in`]; if (m.missing.length) bits.push(`not yet: ${m.missing.join(', ')}`);
        if (m.unknown.length) bits.push(`not on the list: ${m.unknown.map(u => u.suggest ? `${u.name} (did you mean ${u.suggest}?)` : u.name).join(', ')}`); note.textContent = bits.join(' · ');
    }
    function renderAnalysis(ws, res) {
        const box = $('analysis'), body = $('analysisBody'); body.textContent = ''; if (!res.count) { box.hidden = true; return; } box.hidden = false;
        const labels = ['0–19%', '20–39%', '40–59%', '60–79%', '80–100%'], top = Math.max(1, ...res.bins);
        body.appendChild(h('div', { class: 'hbars', role: 'img', 'aria-label': 'Score distribution: ' + labels.map((l, i) => `${l}: ${res.bins[i]} student${res.bins[i] === 1 ? '' : 's'}`).join(', ') }, labels.map((l, i) => h('div', { class: 'hbar' }, h('span', { text: l }), h('i', { style: `width:${Math.round(100 * res.bins[i] / top)}%` }), h('b', { text: String(res.bins[i]) })))));
        const t = h('table', { class: 'grades qa' }, h('thead', null, h('tr', null, ['Question', 'Credit', 'Blank', 'Common wrong answers'].map(x => h('th', { scope: 'col', text: x })))));
        const tb = h('tbody'); ws.questions.forEach((q, i) => tb.appendChild(h('tr', null, h('td', { text: `Q${i + 1} · ${q.prompt.replace(/\s+/g, ' ').slice(0, 60)}` }), h('td', { text: Math.round(res.perQuestion[i] * 100) + '%' }), h('td', { text: String(res.blank[i]) }), h('td', { text: res.common[i].length ? res.common[i].map(c => `${c.answer} (×${c.count})`).join('; ') : (C.isRandomised(ws) ? 'varies by student' : '–') })))); t.appendChild(tb); body.appendChild(h('div', { class: 'tbl-wrap', tabindex: 0, role: 'region', 'aria-label': 'Question analysis table' }, t));
    }
    function renderGrades() {
        const s = gradeSheet(), tbl = $('grades'); tbl.textContent = ''; $('stats').textContent = ''; $('skipNote').textContent = ''; $('analysis').hidden = true; $('reviewNote').textContent = '';
        if (!s) { $('tblWrap').hidden = true; return; }
        if (rosterFor !== s.id) { $('roster').value = String(load(ROSTER(s.id), '') || ''); rosterFor = s.id; }
        const ws = normSheet(s); if (!ws) { $('gradeErr').textContent = 'This worksheet has an unfinished question. Finish it in the Build tab before grading.'; $('tblWrap').hidden = true; return; }
        $('gradeErr').textContent = '';
        const res = C.gradeAll(ws, subsFor(s.id), ovFor(s.id)); window.__lastGrades = res; renderRoster(res);
        const stat = (v, l) => $('stats').appendChild(h('div', null, h('b', { text: v }), h('span', { text: l })));
        stat(String(res.count), 'students'); if (res.count) { stat(Math.round(res.mean * 100) + '%', 'class average'); stat(Math.round(res.median * 100) + '%', 'median'); }
        if (!res.count) { $('tblWrap').hidden = true; $('skipNote').textContent = 'No submissions yet. Paste the codes your students sent.'; return; }
        $('tblWrap').hidden = false; renderAnalysis(ws, res);
        const timed = ws.timeLimit > 0, rand = C.isRandomised(ws);
        const head = h('tr', null, h('th', { text: 'Student', scope: 'col' }), ws.questions.map((q, i) => h('th', { scope: 'col', title: q.prompt.slice(0, 120), text: `Q${i + 1}` })), h('th', { text: 'Score', scope: 'col' }), h('th', { text: '%', scope: 'col' }), timed ? h('th', { text: 'Time', scope: 'col' }) : null);
        tbl.appendChild(h('thead', null, head)); const tb = h('tbody'); let open = null; const btns = new Map();
        const closeDetail = () => { if (open) { open.row.remove(); open.btn.setAttribute('aria-expanded', 'false'); open = null; } };
        const openDetail = (ri, qi, tr, btn) => {
            const same = open && open.ri === ri && open.qi === qi; closeDetail(); if (same) return;
            const r = res.rows[ri], p = r.per[qi], ovs = ovFor(s.id), key = C.normName(r.name) + '|' + qi;
            const ans = pp => (pp.answer === '' ? '(blank)' : pp.shown);
            const pts = h('input', { class: 'in', type: 'number', min: 0, max: p.max, step: 'any', value: fmtPts(p.pts), 'aria-label': `Points for question ${qi + 1} (out of ${p.max})`, style: 'width:110px' }), note = h('input', { class: 'in', type: 'text', maxlength: 200, value: p.comment || '', placeholder: 'Comment (optional)', 'aria-label': `Comment for question ${qi + 1}` });
            const apply = clear => { const o = ovFor(s.id); if (clear) delete o[key]; else o[key] = { pts: +pts.value || 0, note: note.value }; save(OV(s.id), o); reopen = { name: r.name, qi }; renderGrades(); };
            const form = h('div', { class: 'ovform' }, h('p', { class: 'lab', text: `Q${qi + 1} for ${r.name}` }), h('p', { class: 'ovq', text: p.prompt.replace(/\s+/g, ' ').slice(0, 300) }), h('p', { class: 'small', text: `Student wrote: ${ans(p)}   ·   Expected: ${p.expect}${p.note && p.note !== 'blank' ? `   ·   (${p.note})` : ''}` }), h('div', { class: 'row' }, h('label', { class: 'small' }, `Points (out of ${p.max}) `, pts), note, h('button', { class: 'btn btn-solid btn-sm', type: 'button', onclick: () => apply(false), text: 'Set points' }), p.over || ovs[key] ? h('button', { class: 'btn btn-line btn-sm', type: 'button', onclick: () => apply(true), text: 'Back to automatic' }) : null), p.over ? h('p', { class: 'small', text: `Adjusted by you (automatic mark: ${fmtPts(p.auto)}).` }) : null);
            const dl = h('dl', null, r.per.flatMap((pp, k) => [h('dt', { text: `Q${k + 1} ${pp.ok ? '✓' : pp.partial ? '½' : '✗'}` }), h('dd', { text: `${ans(pp)}${pp.comment ? `   — ${pp.comment}` : ''}` })]));
            const row = h('tr', null, h('td', { class: 'detail', colspan: ws.questions.length + 3 + (timed ? 1 : 0) }, form, dl)); tr.after(row); btn.setAttribute('aria-expanded', 'true'); open = { ri, qi, row, btn };
        };
        res.rows.forEach((r, ri) => {
            const tr = h('tr', null, h('td', { text: r.name + (rand ? '' : '') }));
            r.per.forEach((p, qi) => { const mark = p.partial ? fmtPts(p.pts) : (p.ok ? '✓' : '✗'); const btn = h('button', { class: 'cellbtn ' + (p.ok ? 'ok' : p.partial ? 'part' : 'no'), type: 'button', 'aria-label': `${r.name}, question ${qi + 1}: ${p.ok ? 'full marks' : p.partial ? `${fmtPts(p.pts)} of ${p.max} points` : 'no marks'}${p.over ? ', adjusted by you' : ''}. Show answer`, 'aria-expanded': 'false', text: mark + (p.over ? '*' : ''), onclick: () => openDetail(ri, qi, tr, btn) }); btns.set(ri + '|' + qi, btn); tr.appendChild(h('td', null, btn)); });
            tr.appendChild(h('td', { text: `${fmtPts(r.score)} / ${r.max}` })); tr.appendChild(h('td', { text: (r.max ? Math.round(100 * r.score / r.max) : 0) + '%' })); if (timed) tr.appendChild(h('td', { text: (r.used === null || r.used === undefined ? '–' : `${Math.floor(r.used / 60)}:${String(Math.round(r.used % 60)).padStart(2, '0')}`) + (r.over ? ' · ran out' : '') })); tb.appendChild(tr);
        });
        const sum = h('tr', { class: 'sum' }, h('td', { text: '% credit' }), res.perQuestion.map(v => h('td', { text: Math.round(v * 100) + '%' })), h('td', { colspan: timed ? 3 : 2, text: '' })); tb.appendChild(sum); tbl.appendChild(tb);
        if (res.skipped.length) $('skipNote').textContent = `Not counted: ${res.skipped.map(x => `${x.name} (${x.why})`).join('; ')}.`;
        if (reopen) { const ri = res.rows.findIndex(r => r.name === reopen.name); const b = btns.get(ri + '|' + reopen.qi); reopen = null; if (b) { b.click(); b.focus(); } }
    }
    $('roster').addEventListener('input', () => { const s = gradeSheet(); if (!s) return; save(ROSTER(s.id), $('roster').value.slice(0, 20000)); const ws = normSheet(s); renderRoster(ws ? C.gradeAll(ws, subsFor(s.id), ovFor(s.id)) : null); });
    $('makeReview').addEventListener('click', () => {
        const s = gradeSheet(), ws = s && normSheet(s); if (!ws) return; const res = C.gradeAll(ws, subsFor(s.id), ovFor(s.id)); const qs = C.reviewQuestions(ws, res, 0.7);
        if (!qs.length) { $('reviewNote').textContent = res.count < 2 ? 'Needs at least two students before a review sheet can be made.' : 'Every question was answered well by at least 70% of the class, so there is nothing to review.'; return; }
        const w = blank(); w.title = 'Review: ' + (ws.title || 'worksheet'); w.instructions = 'A short review of the questions that were hardest last time.'; w.questions = qs; sheets.push(w); cur = w; persist(); renderBuilder(); tab('build'); $('wsPick').value = w.id; toast(`Made a review worksheet with ${qs.length} question${qs.length === 1 ? '' : 's'}.`);
    });
    function addText(text) {
        const s = gradeSheet(); if (!s) { $('gradeErr').textContent = 'Build a worksheet first.'; return; }
        const { results, stray } = C.parseMany(text); const store = load(SUBS(s.id), []) || []; let added = 0, dup = 0; const bad = [];
        results.forEach(r => { if (!r.ok) { bad.push(r.error); return; } if (store.includes(r.code)) { dup++; return; } store.push(r.code); added++; });
        save(SUBS(s.id), store.slice(-500));
        const bits = []; if (added) bits.push(`${added} added`); if (dup) bits.push(`${dup} already had`); if (bad.length) bits.push(`${bad.length} unreadable (${[...new Set(bad)][0]})`); if (!results.length) bits.push(stray ? 'No submission codes found in that text. Codes start with CSW1.' : 'Nothing to add.');
        $('codes').value = ''; renderGrades(); $('gradeErr').textContent = bits.join(' · ');
    }
    $('addCodes').addEventListener('click', () => addText($('codes').value));
    $('codeFiles').addEventListener('change', async e => { const files = [...e.target.files].slice(0, 200); e.target.value = ''; let all = ''; for (const f of files) { if (f.size > 1e6) continue; all += '\n' + await f.text(); } addText(all); });
    $('gradePick').addEventListener('change', renderGrades);
    $('clearSubs').addEventListener('click', () => { const s = gradeSheet(); if (!s || !confirm('Remove all saved submissions for this worksheet from this browser?')) return; try { localStorage.removeItem(SUBS(s.id)); localStorage.removeItem(OV(s.id)); } catch (e) { /* ignore */ } renderGrades(); });
    $('csvBtn').addEventListener('click', () => { const s = gradeSheet(), ws = s && normSheet(s); if (!ws) return; const res = C.gradeAll(ws, subsFor(s.id), ovFor(s.id)); const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + C.toCSV(ws, res)], { type: 'text/csv' })), download: (ws.title || 'grades').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40) + '-grades.csv' }); document.body.appendChild(a); a.click(); a.remove(); });
    $('printGrades').addEventListener('click', () => window.print());

    // ---------- small helpers: toast, rich text ----------
    let toastTimer = 0; function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 5000); }
    function richInto(el, text) { el.textContent = ''; String(text).split(/(\$[^$\n]+\$)/g).forEach(part => { if (/^\$[^$\n]+\$$/.test(part) && window.katex) { const sp = document.createElement('span'); try { window.katex.render(part.slice(1, -1), sp, { throwOnError: false, trust: false, maxExpand: 500, maxSize: 20 }); } catch (e) { sp.textContent = part; } el.appendChild(sp); } else el.appendChild(document.createTextNode(part)); }); }
    function addQuestions(qs) {
        if (cur.questions.length === 1 && !cur.questions[0].prompt && !cur.questions[0].key) cur.questions = [];
        const room = C.LIMITS.questions - cur.questions.length; if (room <= 0) { toast(`A worksheet can hold at most ${C.LIMITS.questions} questions.`); return 0; }
        const add = qs.slice(0, room).map(q => JSON.parse(JSON.stringify(q))); cur.questions.push(...add); persist(); renderBuilder(); toast(`Added ${add.length} question${add.length === 1 ? '' : 's'}${add.length < qs.length ? ` (the worksheet is full; ${qs.length - add.length} left out)` : ''}.`); return add.length;
    }

    // ---------- question bank ----------
    const BANK = 'cs_classroom_bank';
    let bank = (load(BANK, []) || []).filter(e => e && typeof e === 'object' && e.q && typeof e.q === 'object' && typeof e.q.prompt === 'string').slice(0, 2000);
    function saveToBank(qs) {
        const tags = $('bankTags').value.trim(); let added = 0, skipped = 0, bad = '';
        qs.forEach(q => { let clean; try { clean = C.normalise({ questions: [Object.assign({}, q, tags ? { tags } : {})] }).questions[0]; } catch (e) { skipped++; bad = e.message.replace(/^Question 1[: ]?\s*/, ''); return; } const k = C.qKey(clean); if (bank.some(x => x.k === k)) return; bank.push({ k, q: clean, added: Date.now() }); added++; });
        if (bank.length > 2000) bank = bank.slice(-2000); if (!save(BANK, bank)) toast('Could not save the bank in this browser (storage is full or blocked). Export it to keep your questions.');
        renderBank(); toast(added ? `Saved ${added} question${added === 1 ? '' : 's'} to the bank.` + (skipped ? ` ${skipped} unfinished one${skipped === 1 ? ' was' : 's were'} skipped.` : '') : skipped ? `Finish the question first: ${bad}` : 'That is already in the bank.'); return added;
    }
    function renderBank() {
        const term = $('bankSearch').value.trim().toLowerCase(), list = $('bankList'); list.textContent = ''; $('bankCount').textContent = `(${bank.length})`;
        const shown = bank.filter(e => !term || `${e.q.prompt} ${e.q.tags || ''} ${C.TYPE_LABEL[e.q.type] || ''}`.toLowerCase().includes(term)).slice(0, 60);
        if (!shown.length) list.appendChild(h('p', { class: 'small', text: bank.length ? 'Nothing matches that search.' : 'The bank is empty. Use “Save to bank” on any question, or save a whole worksheet below.' }));
        shown.forEach(e => list.appendChild(h('div', { class: 'bank-row', role: 'listitem' }, h('span', { class: 'badge', text: C.TYPE_LABEL[e.q.type] || e.q.type }), h('span', { class: 'bank-text', text: e.q.prompt.replace(/\s+/g, ' ').slice(0, 140) + (e.q.tags ? '   · ' + e.q.tags : '') }), h('button', { class: 'btn btn-line btn-sm', type: 'button', 'aria-label': 'Add this question to the open worksheet', onclick: () => addQuestions([e.q]), text: 'Add' }), h('button', { class: 'btn btn-danger btn-sm', type: 'button', 'aria-label': 'Remove this question from the bank', onclick: () => { bank = bank.filter(x => x !== e); save(BANK, bank); renderBank(); }, text: '✕' }))));
    }
    $('bankSearch').addEventListener('input', renderBank);
    $('bankSaveAll').addEventListener('click', () => saveToBank(cur.questions));
    $('bankExport').addEventListener('click', () => { if (!bank.length) { toast('The bank is empty.'); return; } const blob = new Blob([JSON.stringify({ calculusSuiteBank: 1, questions: bank.map(e => e.q) }, null, 1)], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(blob), download: 'question-bank.json' }); document.body.appendChild(a); a.click(); a.remove(); });
    $('bankFile').addEventListener('change', async e => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (f.size > 2e6) { toast('That file is too large to be a question bank.'); return; }
        try { const o = JSON.parse(await f.text()); if (!o || o.calculusSuiteBank !== 1 || !Array.isArray(o.questions)) throw new Error('This is not a question bank file from Calculus Suite Pro.'); const n = saveToBank(o.questions.slice(0, 500)); if (!n) toast('No new questions were found in that file.'); } catch (err) { toast('Import failed: ' + err.message); }
    });

    // ---------- review: the questions your classes missed ----------
    $('findMissed').addEventListener('click', () => {
        const list = $('missedList'); list.textContent = ''; const found = [];
        sheets.forEach(s => { const ws = normSheet(s); if (!ws) return; const subs = subsFor(s.id); if (subs.length < 2) return; const res = C.gradeAll(ws, subs, ovFor(s.id)); if (res.count < 2) return; ws.questions.forEach((q, i) => { if (res.perQuestion[i] < 0.7) found.push({ ws, q, i, pct: res.perQuestion[i], n: res.count }); }); });
        found.sort((a, b) => a.pct - b.pct); const top = found.slice(0, 15);
        $('missedNote').textContent = top.length ? `${found.length} question${found.length === 1 ? '' : 's'} had under 70% credit. The hardest are first.` : 'Nothing to review yet: no worksheet has two or more graded submissions with a question below 70%.';
        top.forEach(x => list.appendChild(h('div', { class: 'bank-row', role: 'listitem' }, h('span', { class: 'badge', text: Math.round(x.pct * 100) + '%' }), h('span', { class: 'bank-text', text: `${x.ws.title} · Q${x.i + 1}: ${x.q.prompt.replace(/\s+/g, ' ').slice(0, 120)}` }), h('button', { class: 'btn btn-line btn-sm', type: 'button', onclick: () => addQuestions([x.q]), text: 'Add' }))));
    });

    // ---------- share questions with another teacher ----------
    $('shareQ').addEventListener('click', async () => {
        try { const code = await C.encodeQuestions(cur.questions); const url = new URL('teacher.html', location.href); url.hash = 'q=' + code; $('shareQOut').value = url.href; $('shareQBox').hidden = false; $('shareQNote').textContent = `${url.href.length.toLocaleString()} characters. It contains your answers, so send it only to other teachers.`; }
        catch (e) { $('shareQBox').hidden = true; $('shareQNote').textContent = e.message; }
    });
    $('shareQCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('shareQOut').value); toast('Copied.'); } catch (e) { $('shareQOut').select(); toast('Press Ctrl+C (or Cmd+C) to copy.'); } });
    let incoming = null; const clearIncoming = () => { incoming = null; $('importBanner').hidden = true; try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ } };
    async function checkIncoming() {
        const m = /^#q=(.+)$/.exec(location.hash); if (!m) return;
        try { incoming = await C.decodeQuestions(m[1]); $('importTitle').textContent = `${incoming.length} question${incoming.length === 1 ? '' : 's'} shared with you.`; $('importDetail').textContent = incoming.slice(0, 3).map(q => q.prompt.replace(/\s+/g, ' ').slice(0, 50)).join(' · ') + (incoming.length > 3 ? ' …' : ''); $('importBanner').hidden = false; }
        catch (e) { toast('That shared-questions link could not be opened: ' + e.message); }
    }
    $('importNew').addEventListener('click', () => { if (!incoming) return; const w = blank(); w.title = 'Shared questions'; w.questions = incoming.map(q => JSON.parse(JSON.stringify(q))); sheets.push(w); cur = w; persist(); renderBuilder(); clearIncoming(); toast('Created a new worksheet from the shared questions.'); });
    $('importHere').addEventListener('click', () => { if (incoming && addQuestions(incoming)) clearIncoming(); });
    $('importBank').addEventListener('click', () => { if (incoming) { saveToBank(incoming); clearIncoming(); } });
    $('importNo').addEventListener('click', clearIncoming);

    // ---------- print the worksheet (and its key) ----------
    $('printBtn').addEventListener('click', () => {
        $('printErr').textContent = ''; const ws = normSheet(cur); if (!ws) { $('printErr').textContent = 'Finish every question first (see the red messages above).'; return; }
        const names = $('printNames').value.split('\n').map(t => t.trim()).filter(Boolean).slice(0, 60), copies = names.length ? names : [''], space = $('printSpace').checked, withKey = $('printKey').checked, rand = C.isRandomised(ws);
        const root = h('div', { class: 'print-root' }); const views = [], letters = i => String.fromCharCode(65 + i);
        copies.forEach(nm => {
            const view = rand ? C.instantiate(ws, C.variantSeed(ws.id, nm || 'printed copy')) : Object.assign({}, ws, { order: ws.questions.map((_, i) => i) }); views.push(view);
            const page = h('section', { class: 'print-page' }, h('h1', { text: ws.title }), h('p', { class: 'print-who' }, 'Name: ', h('b', { text: nm || '______________________________' }), '        Date: ______________'));
            if (ws.instructions) page.appendChild(h('p', { class: 'print-instr', text: ws.instructions }));
            const ol = h('ol', { class: 'print-qs' });
            view.order.forEach(i => {
                const q = view.questions[i], li = h('li'), pr = h('p', { class: 'print-prompt' }); richInto(pr, q.prompt); pr.appendChild(h('span', { class: 'print-pts', text: `  [${q.points} point${q.points > 1 ? 's' : ''}]` })); li.appendChild(pr);
                if (q.type === 'choice') { const box = h('div', { class: 'print-choices' }); (q.optOrder || q.options.map((_, j) => j)).forEach((j, pos) => { const d = h('div'), sp = h('span'); richInto(sp, q.options[j]); d.append(`${letters(pos)}.  `, sp); box.appendChild(d); }); li.appendChild(box); }
                else if (space) li.appendChild(h('div', { class: 'print-space' }));
                ol.appendChild(li);
            });
            page.appendChild(ol); root.appendChild(page);
        });
        if (withKey) {
            const page = h('section', { class: 'print-page print-keypage' }, h('h1', { text: 'Answer key: ' + ws.title }));
            copies.forEach((nm, ci) => { const view = views[ci]; if (copies.length > 1 || rand) page.appendChild(h('h2', { text: nm || 'Printed copy' })); const ol = h('ol', { class: 'print-key' }); view.order.forEach(i => { const q = view.questions[i]; let ans = q.key; if (q.type === 'choice') ans = `${letters((q.optOrder || q.options.map((_, j) => j)).indexOf(+q.key))}. ${q.options[+q.key]}`; else if (q.plusC) ans += ' + C'; ol.appendChild(h('li', null, h('span', { text: ans }))); }); page.appendChild(ol); });
            root.appendChild(page);
        }
        document.body.appendChild(root); document.body.classList.add('print-ws');
        const done = () => { document.body.classList.remove('print-ws'); root.remove(); window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); window.__printRoot = root; window.print();
    });

    // ---------- start ----------
    if (!sheets.length) sheets.push(blank()); cur = sheets[0]; refreshPickers(); renderBuilder(); renderBank(); checkIncoming();
    if (location.hash === '#grade') tab('grade');
})();
