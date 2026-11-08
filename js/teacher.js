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
        $('wsTitle').value = cur.title; $('wsInstr').value = cur.instructions; $('wsEmail').value = cur.email || ''; $('wsCalc').checked = !!cur.calculator; $('wsSelf').checked = !!cur.selfCheck; $('wsTime').value = cur.timeLimit || 0; $('wsLock').checked = cur.timeLock !== false; $('wsLock').disabled = !(cur.timeLimit > 0);
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
        const move = d => () => { const j = i + d; if (j < 0 || j >= cur.questions.length) return; [cur.questions[i], cur.questions[j]] = [cur.questions[j], cur.questions[i]]; persist(); renderBuilder(); };
        const card = h('div', { class: 'card qcard' },
            h('h3', null, `Question ${i + 1}`, h('span', { class: 'row' },
                h('button', { class: 'btn btn-line btn-sm', type: 'button', 'aria-label': `Move question ${i + 1} up`, onclick: move(-1), text: '↑' }),
                h('button', { class: 'btn btn-line btn-sm', type: 'button', 'aria-label': `Move question ${i + 1} down`, onclick: move(1), text: '↓' }),
                h('button', { class: 'btn btn-line btn-sm', type: 'button', onclick: () => { cur.questions.splice(i + 1, 0, JSON.parse(JSON.stringify(q))); persist(); renderBuilder(); }, text: 'Copy' }),
                h('button', { class: 'btn btn-danger btn-sm', type: 'button', 'aria-label': `Delete question ${i + 1}`, onclick: () => { cur.questions.splice(i, 1); if (!cur.questions.length) cur.questions.push({ type: 'number', prompt: '', key: '', points: 1, hint: '' }); persist(); renderBuilder(); }, text: 'Delete' }))),
            h('div', { class: 'grid2' }, h('label', { class: 'field' }, h('span', { text: 'Type' }), type), h('label', { class: 'field' }, h('span', { text: 'Points' }), pts)),
            h('label', { class: 'field' }, h('span', { text: 'Question' }), prompt), answer, h('label', { class: 'field' }, h('span', { text: 'Hint (optional)' }), hint), err);
        if (q.prompt || q.key) validate(); return card;
    }
    $('wsTitle').addEventListener('input', e => { cur.title = e.target.value; later(); }); $('wsInstr').addEventListener('input', e => { cur.instructions = e.target.value; later(); });
    $('wsEmail').addEventListener('input', e => { cur.email = e.target.value; later(); }); $('wsCalc').addEventListener('change', e => { cur.calculator = e.target.checked; later(); }); $('wsSelf').addEventListener('change', e => { cur.selfCheck = e.target.checked; later(); });
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
    $('dupBtn').addEventListener('click', () => { const c = JSON.parse(JSON.stringify(cur)); c.id = C.uid(); c.title = (c.title || 'Worksheet') + ' (copy)'; c.created = Date.now(); cur = c; sheets.push(cur); persist(); renderBuilder(); $('linkBox').hidden = true; });
    $('delBtn').addEventListener('click', () => { if (!confirm(`Delete “${cur.title || 'Untitled worksheet'}” and its saved submissions from this browser? Export a file first if you may need it again.`)) return; try { localStorage.removeItem(SUBS(cur.id)); } catch (e) { /* ignore */ } sheets = sheets.filter(s => s.id !== cur.id); if (!sheets.length) sheets.push(blank()); cur = sheets[0]; save(KEY, sheets); refreshPickers(); renderBuilder(); $('linkBox').hidden = true; });
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
    const gradeSheet = () => sheets.find(s => s.id === $('gradePick').value);
    function normSheet(s) { try { return C.normalise(s); } catch (e) { return null; } }
    function renderGrades() {
        const s = gradeSheet(), tbl = $('grades'); tbl.textContent = ''; $('stats').textContent = ''; $('skipNote').textContent = '';
        if (!s) { $('tblWrap').hidden = true; return; }
        const ws = normSheet(s); if (!ws) { $('gradeErr').textContent = 'This worksheet has an unfinished question. Finish it in the Build tab before grading.'; $('tblWrap').hidden = true; return; }
        $('gradeErr').textContent = '';
        const subs = (load(SUBS(s.id), []) || []).map(c => C.parseSubmission(c)).filter(p => p.ok).map(p => p.sub);
        const res = C.gradeAll(ws, subs); window.__lastGrades = res;
        const stat = (v, l) => $('stats').appendChild(h('div', null, h('b', { text: v }), h('span', { text: l })));
        stat(String(res.count), 'students'); if (res.count) { stat(Math.round(res.mean * 100) + '%', 'class average'); stat(Math.round(res.median * 100) + '%', 'median'); }
        if (!res.count) { $('tblWrap').hidden = true; $('skipNote').textContent = 'No submissions yet. Paste the codes your students sent.'; return; }
        $('tblWrap').hidden = false;
        const head = h('tr', null, h('th', { text: 'Student', scope: 'col' }), ws.questions.map((q, i) => h('th', { scope: 'col', title: q.prompt.slice(0, 120), text: `Q${i + 1}` })), h('th', { text: 'Score', scope: 'col' }), h('th', { text: '%', scope: 'col' }), ws.timeLimit > 0 ? h('th', { text: 'Time', scope: 'col' }) : null);
        tbl.appendChild(h('thead', null, head)); const tb = h('tbody'); const details = new Map();
        res.rows.forEach((r, ri) => {
            const tr = h('tr', null, h('td', { text: r.name }));
            r.per.forEach((p, qi) => tr.appendChild(h('td', null, h('button', { class: 'cellbtn ' + (p.ok ? 'ok' : 'no'), type: 'button', 'aria-label': `${r.name}, question ${qi + 1}: ${p.ok ? 'correct' : 'incorrect'}. Show answer`, 'aria-expanded': 'false', text: p.ok ? '✓' : '✗', onclick: ev => { const id = ri; let d = details.get(id); if (d) { d.remove(); details.delete(id); ev.currentTarget.setAttribute('aria-expanded', 'false'); return; } d = h('tr', null, h('td', { class: 'detail', colspan: ws.questions.length + 3 + (ws.timeLimit > 0 ? 1 : 0) }, h('dl', null, r.per.flatMap((pp, k) => [h('dt', { text: `Q${k + 1} ${pp.ok ? '✓' : '✗'}` }), h('dd', { text: (ws.questions[k].type === 'choice' ? (pp.answer === '' ? '(blank)' : (ws.questions[k].options[+pp.answer] || pp.answer)) : (pp.answer || '(blank)')) + (pp.note && pp.note !== 'blank' ? `   (${pp.note})` : '') })])))); tr.after(d); details.set(id, d); ev.currentTarget.setAttribute('aria-expanded', 'true'); } }))));
            tr.appendChild(h('td', { text: `${r.score} / ${r.max}` })); tr.appendChild(h('td', { text: (r.max ? Math.round(100 * r.score / r.max) : 0) + '%' })); if (ws.timeLimit > 0) tr.appendChild(h('td', { text: (r.used === null || r.used === undefined ? '–' : `${Math.floor(r.used / 60)}:${String(Math.round(r.used % 60)).padStart(2, '0')}`) + (r.over ? ' · ran out' : '') })); tb.appendChild(tr);
        });
        const sum = h('tr', { class: 'sum' }, h('td', { text: '% correct' }), res.perQuestion.map(v => h('td', { text: Math.round(v * 100) + '%' })), h('td', { colspan: ws.timeLimit > 0 ? 3 : 2, text: '' })); tb.appendChild(sum); tbl.appendChild(tb);
        if (res.skipped.length) $('skipNote').textContent = `Not counted: ${res.skipped.map(x => `${x.name} (${x.why})`).join('; ')}.`;
    }
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
    $('clearSubs').addEventListener('click', () => { const s = gradeSheet(); if (!s || !confirm('Remove all saved submissions for this worksheet from this browser?')) return; try { localStorage.removeItem(SUBS(s.id)); } catch (e) { /* ignore */ } renderGrades(); });
    $('csvBtn').addEventListener('click', () => { const s = gradeSheet(), ws = s && normSheet(s); if (!ws) return; const res = C.gradeAll(ws, (load(SUBS(s.id), []) || []).map(c => C.parseSubmission(c)).filter(p => p.ok).map(p => p.sub)); const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + C.toCSV(ws, res)], { type: 'text/csv' })), download: (ws.title || 'grades').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40) + '-grades.csv' }); document.body.appendChild(a); a.click(); a.remove(); });
    $('printGrades').addEventListener('click', () => window.print());

    // ---------- start ----------
    if (!sheets.length) sheets.push(blank()); cur = sheets[0]; refreshPickers(); renderBuilder();
    if (location.hash === '#grade') tab('grade');
})();
