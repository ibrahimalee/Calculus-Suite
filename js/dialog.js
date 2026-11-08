/* In-page replacements for window.confirm and window.prompt.
   They look like the rest of the page, work inside embedded frames (where browsers suppress the native ones),
   keep focus where it was, and can be driven by tests.
     csDialog.confirm('Delete this?', { ok: 'Delete', danger: true }).then(yes => { ... })
     csDialog.prompt('Name:', { value: 'Homework', maxLength: 40 }).then(text => { ... })   // null when cancelled */
(function (root) {
    'use strict';
    function open(kind, message, opts) {
        opts = opts || {};
        return new Promise(resolve => {
            const prev = document.activeElement, dlg = document.createElement('dialog');
            dlg.className = 'cs-dialog'; dlg.setAttribute('aria-labelledby', 'csDlgMsg');
            const form = document.createElement('form'); form.method = 'dialog';
            const text = document.createElement('p'); text.id = 'csDlgMsg'; text.textContent = message; form.appendChild(text);
            let input = null;
            if (kind === 'prompt') {
                input = document.createElement('input'); input.type = 'text'; input.value = opts.value || ''; input.maxLength = opts.maxLength || 200;
                input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('aria-labelledby', 'csDlgMsg'); form.appendChild(input);
            }
            const row = document.createElement('div'); row.className = 'cs-dialog-row';
            const no = document.createElement('button'); no.type = 'button'; no.className = 'btn btn-line'; no.textContent = opts.cancel || 'Cancel';
            const yes = document.createElement('button'); yes.type = 'submit'; yes.className = 'btn btn-primary btn-solid' + (opts.danger ? ' btn-danger' : ''); yes.textContent = opts.ok || 'OK';
            row.appendChild(no); row.appendChild(yes); form.appendChild(row); dlg.appendChild(form);
            let result = kind === 'prompt' ? null : false;
            no.addEventListener('click', () => dlg.close());
            form.addEventListener('submit', () => { result = kind === 'prompt' ? input.value : true; });
            dlg.addEventListener('close', () => { dlg.remove(); if (prev && prev.focus) { try { prev.focus(); } catch (e) { /* element gone */ } } resolve(result); });
            document.body.appendChild(dlg);
            dlg.showModal();
            if (input) { input.focus(); input.select(); } else (opts.danger ? no : yes).focus();
        });
    }
    root.csDialog = { confirm: (m, o) => open('confirm', m, o), prompt: (m, o) => open('prompt', m, o) };
})(window);
