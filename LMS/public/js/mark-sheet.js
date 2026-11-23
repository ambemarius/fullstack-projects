// Mark sheet: entry of both sequence marks (out of 20) for one class subject and term.
// Shared by Admin -> Evaluation -> Marks entry and the teacher dashboard.
//
//   const sheet = MarkSheet.mount(container, {
//     title,                        // e.g. "Form 2 Bilingual, Mathematics"
//     term,                         // 'First' | 'Second' | 'Third'
//     rows,                         // [{ id, firstName, middleName, lastName, matricule, seq1_score, seq2_score }]
//     save: async entries => ({ ok, message }),   // entries: [{ studentId, seq1?, seq2? }]
//     reload: async () => rows,     // fresh rows after a successful save
//     fileName,                     // CSV/print name
//   });
//   sheet.hasUnsavedChanges(); sheet.destroy();
(function () {
  const MAX = 20;
  const BANDS = [[17, 'Excellent'], [14, 'Very good'], [12, 'Good'], [10, 'Average'], [5, 'Weak'], [0, 'Very weak']];
  const band = v => (v === null ? '' : BANDS.find(([min]) => v >= min)[1]);
  const fmt = v => (v === null || v === undefined || v === '' ? '' : Number(v).toFixed(2).replace(/\.?0+$/, ''));
  const avg2 = v => (v === null ? '—' : v.toFixed(2));
  const fullName = s => [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ') || s.name || s.matricule || 'Student';
  const e = s => (typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));

  // '12,5' and '12.5' are accepted; returns { value } or { error } ('' -> value null).
  function parseMark(text) {
    const t = String(text ?? '').trim().replace(',', '.');
    if (t === '') return { value: null };
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return { error: 'Enter a number such as 12 or 12.5' };
    const v = Number(t);
    if (v > MAX) return { error: `Marks are out of ${MAX}` };
    return { value: v };
  }

  let active = null; // one sheet per page for the keyboard shortcut and leave warning
  window.addEventListener('beforeunload', ev => { if (active && active.hasUnsavedChanges()) { ev.preventDefault(); ev.returnValue = ''; } });
  document.addEventListener('keydown', ev => {
    if (active && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's' && active.isVisible()) { ev.preventDefault(); active.save(); }
  });

  function mount(container, opts) {
    // Sequences are numbered across the year: term 1 = 1 and 2, term 2 = 3 and 4, term 3 = 5 and 6 (as on the report cards).
    const base = ({ First: 0, Second: 2, Third: 4 })[opts.term] || 0;
    const seqNo = q => base + q + 1;
    let rows = [];
    let saving = false;

    function setRows(list) {
      rows = list.map(s => {
        const saved = [s.seq1_score, s.seq2_score].map(v => (v === null || v === undefined ? null : Number(v)));
        return { id: s.id, name: fullName(s), matricule: s.matricule || '', saved, text: saved.map(fmt), justSaved: false };
      });
    }
    setRows(opts.rows);

    container.innerHTML = `
      <section class="ms" aria-label="Mark sheet">
        <header class="ms-head">
          <div>
            <h3 class="ms-title">${e(opts.title)}</h3>
            <p class="ms-sub">${e(opts.term)} term: sequences ${seqNo(0)} and ${seqNo(1)}, marked out of ${MAX}</p>
          </div>
          <div class="ms-tools">
            <input type="search" class="ms-search" placeholder="Find a student" aria-label="Find a student">
            <button type="button" class="btn btn-ghost btn-sm" data-ms="csv">Export CSV</button>
            <button type="button" class="btn btn-ghost btn-sm" data-ms="print">Print</button>
          </div>
        </header>
        <dl class="ms-stats" aria-live="polite"></dl>
        <div class="ms-scroll">
          <table class="ms-table">
            <thead><tr>
              <th class="ms-c-num" scope="col">#</th>
              <th scope="col">Student</th>
              <th class="ms-c-mark" scope="col">Sequence ${seqNo(0)}</th>
              <th class="ms-c-mark" scope="col">Sequence ${seqNo(1)}</th>
              <th class="ms-c-avg" scope="col">Term average</th>
              <th class="ms-c-remark" scope="col">Remark</th>
            </tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <p class="ms-hint">Press Enter or ↓ to go to the next student, ↑ to go back. A comma works as the decimal point (12,5). <kbd>Ctrl</kbd>+<kbd>S</kbd> saves.</p>
        <footer class="ms-bar">
          <span class="ms-state" role="status" aria-live="polite"></span>
          <span class="ms-bar-actions">
            <button type="button" class="btn btn-secondary" data-ms="discard">Discard changes</button>
            <button type="button" class="btn" data-ms="save">Save marks</button>
          </span>
        </footer>
      </section>`;

    const $ = sel => container.querySelector(sel);
    const tbody = $('tbody'), stats = $('.ms-stats'), state = $('.ms-state'), search = $('.ms-search');
    const saveBtn = container.querySelector('[data-ms="save"]'), discardBtn = container.querySelector('[data-ms="discard"]');

    const check = (r, q) => {
      const p = parseMark(r.text[q]);
      if (p.error) return { error: p.error };
      if (p.value === null && r.saved[q] !== null) return { error: 'A saved mark can’t be cleared. Enter 0 if the student scored nothing.' };
      return { value: p.value };
    };
    const changed = r => [0, 1].some(q => { const c = check(r, q); return !c.error && c.value !== r.saved[q]; });
    const rowAverage = r => {
      const vals = [0, 1].map(q => check(r, q)).filter(c => !c.error && c.value !== null).map(c => c.value);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    function render() {
      const q = search.value.trim().toLowerCase();
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="ms-empty">No students are enrolled in this subject for this term yet. Once the class is enrolled, the names appear here.</td></tr>`;
      } else {
        tbody.innerHTML = rows.map((r, i) => {
          if (q && !(r.name.toLowerCase().includes(q) || r.matricule.toLowerCase().includes(q))) return '';
          return `<tr data-row="${i}">
            <td class="ms-c-num">${i + 1}</td>
            <td class="ms-student"><span class="ms-name">${e(r.name)}</span><span class="ms-mat">${e(r.matricule)}</span></td>
            ${[0, 1].map(s => `<td class="ms-c-mark"><div class="ms-cell">
              <input class="ms-input" data-row="${i}" data-seq="${s}" value="${e(r.text[s])}" inputmode="decimal" autocomplete="off"
                aria-label="${e(r.name)}, sequence ${seqNo(s)}, out of ${MAX}" aria-describedby="ms-err-${i}-${s}">
              <span class="ms-err" id="ms-err-${i}-${s}"></span></div></td>`).join('')}
            <td class="ms-c-avg"><div class="ms-avg"><span class="ms-avg-num"></span><span class="ms-meter" aria-hidden="true"><span></span></span></div></td>
            <td class="ms-c-remark"><span class="ms-remark"></span></td>
          </tr>`;
        }).join('') || `<tr><td colspan="6" class="ms-empty">No student matches “${e(search.value)}”.</td></tr>`;
      }
      rows.forEach((_, i) => refreshRow(i));
      refreshSummary();
    }

    function refreshRow(i) {
      const tr = tbody.querySelector(`tr[data-row="${i}"]`);
      if (!tr) return;
      const r = rows[i];
      [0, 1].forEach(s => {
        const input = tr.querySelector(`input[data-seq="${s}"]`), err = tr.querySelector(`#ms-err-${i}-${s}`);
        const c = check(r, s);
        input.classList.toggle('is-invalid', Boolean(c.error));
        input.classList.toggle('is-changed', !c.error && c.value !== r.saved[s]);
        input.classList.toggle('is-fail', !c.error && c.value !== null && c.value < 10);
        input.setAttribute('aria-invalid', c.error ? 'true' : 'false');
        err.textContent = c.error || '';
      });
      const a = rowAverage(r);
      tr.querySelector('.ms-avg-num').textContent = avg2(a);
      tr.querySelector('.ms-avg').classList.toggle('is-fail', a !== null && a < 10);
      tr.querySelector('.ms-meter span').style.width = a === null ? '0' : `${(a / MAX) * 100}%`;
      const rem = tr.querySelector('.ms-remark');
      rem.textContent = band(a);
      rem.classList.toggle('is-fail', a !== null && a < 10);
      tr.classList.toggle('is-saved', r.justSaved);
    }

    function refreshSummary() {
      const n = rows.length;
      const entered = [0, 1].map(q => rows.filter(r => { const c = check(r, q); return !c.error && c.value !== null; }).length);
      const avgs = rows.map(rowAverage).filter(v => v !== null);
      const classAvg = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
      const passing = avgs.filter(v => v >= 10).length;
      const pct = k => (n ? Math.round((entered[k] / n) * 100) : 0);
      stats.innerHTML = `
        <div class="ms-stat"><dt>Sequence ${seqNo(0)}</dt><dd>${entered[0]} of ${n} entered <span class="ms-progress" aria-hidden="true"><span style="width:${pct(0)}%"></span></span></dd></div>
        <div class="ms-stat"><dt>Sequence ${seqNo(1)}</dt><dd>${entered[1]} of ${n} entered <span class="ms-progress" aria-hidden="true"><span style="width:${pct(1)}%"></span></span></dd></div>
        <div class="ms-stat"><dt>Class average</dt><dd class="${classAvg !== null && classAvg < 10 ? 'is-fail' : ''}">${classAvg === null ? '—' : classAvg.toFixed(2)}</dd></div>
        <div class="ms-stat"><dt>At or above 10</dt><dd>${avgs.length ? `${passing} of ${avgs.length}` : '—'}</dd></div>`;
      const invalid = rows.reduce((k, r) => k + [0, 1].filter(q => check(r, q).error).length, 0);
      const pending = rows.filter(changed).length;
      saveBtn.disabled = saving || !pending || invalid > 0;
      discardBtn.disabled = saving || (!pending && !invalid);
      saveBtn.textContent = saving ? 'Saving…' : pending ? `Save marks (${pending})` : 'Save marks';
      if (!saving) {
        state.className = 'ms-state' + (invalid ? ' is-error' : pending ? ' is-pending' : '');
        state.textContent = invalid ? `Fix ${invalid} mark${invalid === 1 ? '' : 's'} before saving`
          : pending ? `${pending} student${pending === 1 ? ' has' : 's have'} unsaved changes` : (state.dataset.saved || 'All marks are saved');
      }
    }

    // ---- typing and keyboard navigation ----
    tbody.addEventListener('input', ev => {
      const input = ev.target.closest('.ms-input');
      if (!input) return;
      const r = rows[+input.dataset.row];
      r.text[+input.dataset.seq] = input.value;
      r.justSaved = false;
      state.dataset.saved = '';
      refreshRow(+input.dataset.row);
      refreshSummary();
    });
    tbody.addEventListener('focusin', ev => { if (ev.target.classList?.contains('ms-input')) ev.target.select(); });
    tbody.addEventListener('focusout', ev => {
      const input = ev.target.closest?.('.ms-input');
      if (!input) return;
      const r = rows[+input.dataset.row], s = +input.dataset.seq, p = parseMark(r.text[s]);
      if (!p.error && p.value !== null) { r.text[s] = fmt(p.value); input.value = r.text[s]; } // tidy "12,50" -> "12.5"
    });
    tbody.addEventListener('keydown', ev => {
      const input = ev.target.closest('.ms-input');
      if (!input || !['Enter', 'ArrowDown', 'ArrowUp'].includes(ev.key)) return;
      ev.preventDefault();
      const inputs = [...tbody.querySelectorAll(`.ms-input[data-seq="${input.dataset.seq}"]`)];
      const next = inputs[inputs.indexOf(input) + (ev.key === 'ArrowUp' ? -1 : 1)];
      if (next) next.focus();
      else if (ev.key !== 'ArrowUp' && input.dataset.seq === '0') tbody.querySelector('.ms-input[data-seq="1"]')?.focus(); // end of the first sequence: continue with the second
      else if (ev.key !== 'ArrowUp') saveBtn.focus();
    });
    search.addEventListener('input', render);

    // ---- save / discard ----
    async function save() {
      if (saveBtn.disabled) return;
      const entries = rows.filter(changed).map(r => {
        const entry = { studentId: r.id };
        [0, 1].forEach(q => { const c = check(r, q); if (c.value !== null && c.value !== r.saved[q]) entry[`seq${q + 1}`] = c.value; });
        return entry;
      }).filter(x => 'seq1' in x || 'seq2' in x);
      if (!entries.length) return;
      saving = true;
      state.className = 'ms-state';
      state.textContent = 'Saving…';
      refreshSummary();
      try {
        const res = await opts.save(entries);
        if (!res.ok) { state.className = 'ms-state is-error'; state.textContent = res.message || 'The marks were not saved. Try again.'; return; }
        const savedIds = new Set(entries.map(x => x.studentId));
        const fresh = opts.reload ? await opts.reload() : null;
        if (fresh) setRows(fresh);
        else rows.forEach(r => { r.saved = [0, 1].map(q => check(r, q).value ?? r.saved[q]); });
        rows.forEach(r => { r.justSaved = savedIds.has(r.id); });
        const count = entries.reduce((k, x) => k + ('seq1' in x) + ('seq2' in x), 0);
        state.dataset.saved = `Saved ${count} mark${count === 1 ? '' : 's'} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } catch (err) {
        state.className = 'ms-state is-error';
        state.textContent = 'The marks were not saved: ' + err.message;
        return;
      } finally {
        saving = false;
      }
      render();
    }
    saveBtn.addEventListener('click', save);
    discardBtn.addEventListener('click', () => {
      if (!confirm('Discard the marks you have not saved?')) return;
      rows.forEach(r => { r.text = r.saved.map(fmt); });
      render();
    });

    // ---- export and print (what is on screen, including unsaved marks) ----
    const lines = () => rows.map((r, i) => [i + 1, r.name, r.matricule, ...[0, 1].map(q => { const c = check(r, q); return c.error ? '' : fmt(c.value); }), rowAverage(r) === null ? '' : rowAverage(r).toFixed(2), band(rowAverage(r))]);
    container.querySelector('[data-ms="csv"]').addEventListener('click', () => {
      const quote = v => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [['#', 'Student', 'Matricule', `Sequence ${seqNo(0)}`, `Sequence ${seqNo(1)}`, 'Term average', 'Remark'], ...lines()].map(l => l.map(quote).join(',')).join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
      a.download = `${opts.fileName || 'marks'}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    container.querySelector('[data-ms="print"]').addEventListener('click', () => {
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${e(opts.title)}, ${e(opts.term)} term</title><style>
        body{font-family:Arial,sans-serif;margin:24px;color:#111} h1{font-size:18px;margin:0} p{margin:4px 0 16px;color:#444;font-size:13px}
        table{width:100%;border-collapse:collapse;font-size:13px} th,td{border:1px solid #999;padding:6px 8px;text-align:left}
        th{background:#eef4ef} td.n{text-align:right;font-variant-numeric:tabular-nums} .f{color:#b42318}
        .sign{margin-top:40px;display:flex;justify-content:space-between;font-size:13px}</style></head><body>
        <h1>${e(opts.title)}</h1><p>${e(opts.term)} term mark sheet, marked out of ${MAX}. Printed ${new Date().toLocaleDateString()}.</p>
        <table><thead><tr><th>#</th><th>Student</th><th>Matricule</th><th>Sequence ${seqNo(0)}</th><th>Sequence ${seqNo(1)}</th><th>Term average</th><th>Remark</th></tr></thead><tbody>
        ${lines().map(l => `<tr><td>${l[0]}</td><td>${e(l[1])}</td><td>${e(l[2])}</td>${[3, 4, 5].map(k => `<td class="n${l[k] !== '' && Number(l[k]) < 10 ? ' f' : ''}">${e(l[k])}</td>`).join('')}<td>${e(l[6])}</td></tr>`).join('')}
        </tbody></table><div class="sign"><span>Teacher's signature: ____________________</span><span>Date: ____________</span></div></body></html>`);
      win.document.close();
      win.focus();
      win.print();
    });

    render();
    const api = {
      hasUnsavedChanges: () => rows.some(changed) || rows.some(r => [0, 1].some(q => check(r, q).error)),
      isVisible: () => container.offsetParent !== null,
      save,
      destroy() { if (active === api) active = null; container.innerHTML = ''; },
    };
    active = api;
    return api;
  }

  window.MarkSheet = { mount, parseMark, band };
})();
