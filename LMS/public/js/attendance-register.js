// Shared register editor: used by the teacher dashboard and the /attendance page.
// window.AttendanceRegister.open(container, registerId, { onSaved })
(function () {
  const STATUS = [['present', 'Present'], ['absent', 'Absent'], ['late', 'Late']];

  function statusBadge(p) {
    if (!p.status) return '<span class="badge">Not marked</span>';
    const label = { present: 'Present', absent: 'Absent', late: 'Late' + (p.minutesLate ? ' ' + p.minutesLate + ' min' : '') }[p.status];
    return '<span class="badge' + (p.status === 'absent' ? ' yes' : p.status === 'present' ? ' no' : '') + '">' + esc(label) + '</span>' +
      (p.justified ? ' <span class="badge no" title="' + esc(p.justification || '') + '">Justified</span>' : '');
  }

  async function open(container, registerId, opts = {}) {
    container.innerHTML = '<p class="muted">Loading register…</p>';
    const res = await api('/attendance/registers/' + encodeURIComponent(registerId));
    if (!res.ok) {
      container.innerHTML = '<p class="msg error" role="alert">' + esc((res.data && res.data.message) || 'Could not open this register.') + '</p>';
      return;
    }
    render(container, res.data.data, opts);
    if (opts.focus !== false) container.querySelector('.reg-title')?.focus({ preventScroll: true });
  }

  function render(container, data, opts) {
    const r = data.register;
    const saved = data.students.some(p => p.status);
    const disabled = data.canEdit ? '' : ' disabled';
    container.innerHTML =
      (opts.onBack ? '<button type="button" class="btn btn-ghost btn-sm reg-back" data-back>← Back to lessons</button>' : '') +
      '<div class="register-head"><div><h3 tabindex="-1" class="reg-title">' + esc(r.className) + ' · ' + esc(r.subjectName || 'Lesson') + '</h3>' +
      '<p class="muted">' + esc(r.lessonDate) + ' · ' + esc(r.startTime) + '–' + esc(r.endTime) + ' · ' + esc(r.term) + ' term' +
      (r.teacherName ? ' · ' + esc(r.teacherName) : '') + '</p></div>' +
      '<div class="reg-head-side"><div class="reg-counts" aria-live="polite"></div>' +
      (data.canEdit ? '<button type="button" class="btn btn-secondary btn-sm" data-all-present>Mark all present</button>' : '') + '</div></div>' +
      (data.canEdit && !saved ? '<p class="reg-hint">Everyone starts as <strong>present</strong>. Tap <strong>Absent</strong> or <strong>Late</strong> for the students who are not here, then save.</p>' : '') +
      (data.canEdit ? '' : '<p class="alert alert-info">This register is read-only for you. Teachers can record attendance up to 7 days back; the discipline master corrects older registers.</p>') +
      '<form class="register-form"><div class="table-wrap"><table class="register-table reg-table"><thead><tr><th>Student</th><th>Attendance</th><th>Minutes late</th><th>Saved</th><th><span class="sr-only">More</span></th></tr></thead><tbody>' +
      data.students.map(p => {
        const current = p.status || 'present';
        return '<tr data-status="' + current + '" data-student="' + esc(p.studentId) + '" data-saved="' + esc(p.status || '') + '" data-saved-late="' + esc(p.minutesLate || '') + '">' +
          '<td><span class="cell-primary">' + esc(p.name) + '</span><br><span class="muted">' + esc(p.matricule) + '</span></td>' +
          '<td><fieldset class="status-choice"><legend class="sr-only">Attendance for ' + esc(p.name) + '</legend>' +
          STATUS.map(([value, label]) => '<label><input type="radio" name="s' + esc(p.studentId) + '" value="' + value + '"' + (current === value ? ' checked' : '') + disabled + '> ' + label + '</label>').join('') +
          '</fieldset></td>' +
          '<td><input type="number" class="late-minutes" min="1" max="600" step="1" aria-label="Minutes late for ' + esc(p.name) + '" value="' + esc(p.minutesLate || '') + '"' + (current === 'late' && data.canEdit ? '' : ' disabled') + '></td>' +
          '<td>' + statusBadge(p) + '</td>' +
          '<td class="register-actions">' +
          (p.revision ? '<button type="button" class="btn btn-ghost btn-sm" data-history="' + esc(p.studentId) + '">History</button>' : '') +
          (data.canJustify && p.status && p.status !== 'present' && !p.justified ? '<button type="button" class="btn btn-ghost btn-sm" data-justify="' + esc(p.studentId) + '" data-name="' + esc(p.name) + '">Justify</button>' : '') +
          '</td></tr>';
      }).join('') +
      (data.students.length ? '' : '<tr><td colspan="5" class="muted">No active students in this class.</td></tr>') +
      '</tbody></table></div>' +
      (data.canEdit ? '<div class="reg-savebar">' +
        (saved ? '<label class="correction-reason">Reason for corrections (required when changing a saved mark)<input name="reason" maxlength="300" placeholder="For example: student arrived after the register was taken"></label>' : '') +
        '<div class="reg-savebar-row"><span class="reg-counts reg-counts-bar"></span>' +
        '<button type="submit" class="btn">' + (saved ? 'Save changes' : 'Save register') + '</button></div></div>' : '') +
      '<p class="msg" role="status" aria-live="polite"></p></form><div class="register-history"></div>';

    const form = container.querySelector('form');
    const msg = form.querySelector('.msg');
    function updateCounts() {
      const n = { present: 0, absent: 0, late: 0 };
      form.querySelectorAll('tbody tr[data-student]').forEach(row => {
        const checked = row.querySelector('input[type=radio]:checked');
        row.dataset.status = checked ? checked.value : 'present';
        n[row.dataset.status]++;
      });
      const html = '<span class="reg-c reg-c-present">' + n.present + ' present</span><span class="reg-c reg-c-absent">' + n.absent + ' absent</span><span class="reg-c reg-c-late">' + n.late + ' late</span>';
      container.querySelectorAll('.reg-counts').forEach(el => { el.innerHTML = html; });
    }
    updateCounts();
    container.querySelector('[data-back]')?.addEventListener('click', () => opts.onBack());

    form.addEventListener('change', e => {
      if (e.target.type !== 'radio') return;
      const row = e.target.closest('tr');
      const late = row.querySelector('.late-minutes');
      late.disabled = e.target.value !== 'late';
      if (e.target.value === 'late' && !late.value) late.focus();
      updateCounts();
    });

    container.querySelector('[data-all-present]')?.addEventListener('click', () => {
      form.querySelectorAll('input[type=radio][value=present]').forEach(r => { r.checked = true; });
      form.querySelectorAll('.late-minutes').forEach(i => { i.disabled = true; });
      updateCounts();
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const marks = Array.from(form.querySelectorAll('tbody tr[data-student]')).map(row => {
        const status = row.querySelector('input[type=radio]:checked').value;
        const mark = { studentId: Number(row.dataset.student), status };
        if (status === 'late') mark.minutesLate = Number(row.querySelector('.late-minutes').value);
        return mark;
      });
      if (!marks.length) return;
      const missing = marks.find(m => m.status === 'late' && !(m.minutesLate >= 1));
      if (missing) {
        const input = form.querySelector('tr[data-student="' + missing.studentId + '"] .late-minutes');
        msg.textContent = 'Enter how many minutes late for every student marked late.';
        msg.className = 'msg error';
        input.focus();
        return;
      }
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      button.classList.add('loading');
      const reason = form.querySelector('input[name=reason]')?.value || '';
      const res = await api('/attendance/registers/' + encodeURIComponent(data.register.id) + '/marks', { method: 'POST', body: JSON.stringify({ marks, reason }) });
      button.disabled = false;
      button.classList.remove('loading');
      if (!res.ok) {
        msg.textContent = (res.data && res.data.message) || 'Could not save the register.';
        msg.className = 'msg error';
        return;
      }
      toast(res.data.message, 'success');
      if (opts.onSaved) opts.onSaved(data.register.id);
      if (!opts.closeOnSave) open(container, data.register.id, opts);
    });

    container.onclick = async e => {
      const hist = e.target.closest('[data-history]');
      if (hist) {
        const res = await api('/attendance/registers/' + encodeURIComponent(data.register.id) + '/students/' + encodeURIComponent(hist.dataset.history) + '/history');
        const box = container.querySelector('.register-history');
        const rows = (res.ok && res.data.data) || [];
        box.innerHTML = '<h4>Change history</h4><div class="table-wrap"><table><thead><tr><th>#</th><th>Mark</th><th>Justification</th><th>Reason</th><th>By</th><th>When</th></tr></thead><tbody>' +
          rows.map(h => '<tr><td>' + esc(h.revision) + '</td><td>' + esc(h.status) + (h.minutesLate ? ' (' + esc(h.minutesLate) + ' min)' : '') + '</td><td>' + esc(h.justification || '—') +
            '</td><td>' + esc(h.reason || '—') + '</td><td>' + esc(h.editor) + '</td><td>' + esc(new Date(h.recordedAt).toLocaleString()) + '</td></tr>').join('') +
          '</tbody></table></div>';
        box.scrollIntoView({ block: 'nearest' });
        return;
      }
      const just = e.target.closest('[data-justify]');
      if (just) {
        const justification = prompt('Justification for ' + just.dataset.name + ' (for example: medical certificate dated …)');
        if (!justification || !justification.trim()) return;
        const res = await api('/attendance/justify', { method: 'POST', body: JSON.stringify({ registerId: data.register.id, studentId: Number(just.dataset.justify), justification }) });
        toast((res.data && res.data.message) || (res.ok ? 'Absence justified.' : 'Could not justify.'), res.ok ? 'success' : 'error');
        if (res.ok) { if (opts.onSaved) opts.onSaved(); open(container, data.register.id, opts); }
      }
    };
  }

  // Lesson list → register. Used by both pages.
  function renderLessons(listEl, lessons, { date, canMark, onOpen }) {
    if (!lessons.length) {
      listEl.innerHTML = '<p class="muted">No timetabled lessons on this day for the chosen term.</p>';
      return;
    }
    const nowHm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Douala', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    listEl.innerHTML = lessons.map(l => {
      const now = date === todayIso && l.startTime <= nowHm && nowHm < l.endTime;
      const state = !l.registerId ? '<span class="badge">Not taken</span>'
        : '<span class="badge no">' + esc(l.marked) + '/' + esc(l.students) + ' marked</span>' + (l.absent ? ' <span class="badge yes">' + esc(l.absent) + ' absent</span>' : '');
      return '<section class="duty-item lesson-card' + (now ? ' is-now' : '') + (l.registerId ? ' is-taken' : '') + '"><div><h3>' + (now ? '<span class="badge lesson-now">Now</span> ' : '') + esc(l.startTime) + '–' + esc(l.endTime) + ' · ' + esc(l.className) + '</h3><p>' + esc(l.subjectName) +
        (l.teacherName ? ' · ' + esc(l.teacherName) : '') + (l.room ? ' · ' + esc(l.room) : '') + '</p></div><div>' + state + ' ' +
        (canMark || l.registerId ? '<button type="button" class="btn btn-sm" data-open-lesson="' + esc(l.timetableId) + '" data-register="' + esc(l.registerId || '') + '">' + (l.registerId ? 'Open register' : 'Take register') + '</button>' : '') +
        '</div></section>';
    }).join('');
    listEl.onclick = async e => {
      const card = e.target.closest('.lesson-card');
      const btn = e.target.closest('[data-open-lesson]') || (card && card.querySelector('[data-open-lesson]'));
      if (!btn || btn.disabled) return;
      btn.disabled = true;
      let registerId = btn.dataset.register;
      if (!registerId) {
        const res = await api('/attendance/registers', { method: 'POST', body: JSON.stringify({ timetableId: Number(btn.dataset.openLesson), date }) });
        if (!res.ok) { btn.disabled = false; toast((res.data && res.data.message) || 'Could not open this register.', 'error'); return; }
        registerId = res.data.data.id;
      }
      btn.disabled = false;
      onOpen(registerId);
    };
  }

  window.AttendanceRegister = { open, renderLessons };
})();
