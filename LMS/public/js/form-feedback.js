// Enhance native validation only. No values are read, stored, submitted or logged.
(() => {
    if (!document.body.classList.contains('lms-ui')) return;
    const states = new WeakMap();
    let sequence = 0;
    function makeId(prefix) {
        let id;
        do { id = prefix + (++sequence); } while (document.getElementById(id));
        return id;
    }
    function labelFor(field) {
        const direct = field.getAttribute('aria-label');
        if (direct) return direct;
        const label = field.labels?.[0];
        const text = label && [...label.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join(' ').trim();
        return text || 'This field';
    }
    function stateFor(form) {
        if (!states.has(form)) states.set(form, { fields: new Map(), summary: null, queued: false });
        return states.get(form);
    }
    function clearField(state, field) {
        const entry = state.fields.get(field);
        if (!entry) return;
        entry.error.remove();
        field.classList.remove('lms-field-invalid');
        const describedBy = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== entry.error.id).join(' ');
        if (describedBy) field.setAttribute('aria-describedby', describedBy);
        else field.removeAttribute('aria-describedby');
        if (entry.previousInvalid === null) field.removeAttribute('aria-invalid');
        else field.setAttribute('aria-invalid', entry.previousInvalid);
        state.fields.delete(field);
    }
    function renderSummary(form, state) {
        for (const field of state.fields.keys()) {
            if (!field.isConnected || field.form !== form || !field.willValidate || field.validity.valid) clearField(state, field);
        }
        if (!state.fields.size) { state.summary?.remove(); state.summary = null; return; }
        if (!state.summary) {
            state.summary = document.createElement('div');
            state.summary.className = 'lms-validation-summary';
            state.summary.setAttribute('role', 'region');
            state.summary.setAttribute('aria-label', 'Fields to review');
            form.prepend(state.summary);
        }
        const heading = document.createElement('p');
        const count = state.fields.size;
        heading.textContent = 'Please check ' + count + (count === 1 ? ' field' : ' fields') + ' before continuing.';
        const list = document.createElement('ul');
        for (const [field, entry] of state.fields) {
            const item = document.createElement('li'), link = document.createElement('a');
            if (!field.id) field.id = makeId('lms-field-');
            link.href = '#' + field.id;
            link.textContent = labelFor(field) + ': ' + entry.error.textContent;
            link.addEventListener('click', event => { event.preventDefault(); field.focus(); });
            item.append(link); list.append(item);
        }
        state.summary.replaceChildren(heading, list);
    }
    document.addEventListener('invalid', event => {
        const field = event.target, form = field.form;
        if (!form || !field.willValidate) return;
        const state = stateFor(form);
        let entry = state.fields.get(field);
        if (!entry) {
            const error = document.createElement('span');
            error.id = makeId('lms-field-error-'); error.className = 'lms-field-error';
            // Referenced as a description, excluded from the wrapping label's name.
            error.setAttribute('aria-hidden', 'true');
            const label = field.closest('label');
            if (label) label.append(error); else field.after(error);
            entry = { error, previousInvalid: field.getAttribute('aria-invalid') };
            state.fields.set(field, entry);
            field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' '));
        }
        entry.error.textContent = field.validationMessage || 'Check this field.';
        field.setAttribute('aria-invalid', 'true'); field.classList.add('lms-field-invalid');
        if (!state.queued) {
            state.queued = true;
            queueMicrotask(() => { state.queued = false; renderSummary(form, state); });
        }
        // Native validation still blocks invalid submission and focuses the first invalid field.
    }, true);
    function update(event) {
        const field = event.target, form = field.form, state = form && states.get(form);
        if (!state?.fields.has(field)) return;
        if (field.validity.valid) clearField(state, field);
        else state.fields.get(field).error.textContent = field.validationMessage || 'Check this field.';
        renderSummary(form, state);
    }
    document.addEventListener('input', update);
    document.addEventListener('change', update);
    document.addEventListener('reset', event => {
        const state = states.get(event.target);
        if (!state) return;
        for (const field of state.fields.keys()) clearField(state, field);
        state.summary?.remove(); state.summary = null;
    });
})();
