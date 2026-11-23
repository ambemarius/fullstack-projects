(function () {
  async function loadProfile() {
    const { ok, data } = await api('/parents/profile');
    if (!ok) { document.getElementById('welcome').textContent = 'Could not load your account. Sign in again.'; return; }
    document.getElementById('welcome').textContent = 'Welcome, ' + [data.data.firstName, data.data.lastName].filter(Boolean).join(' ');
    loadChildren();
  }

  async function loadChildren() {
    const { ok, data } = await api('/parents/children');
    const list = document.getElementById('childrenList');
    const empty = document.getElementById('childrenEmpty');
    const children = (ok && data.data) || [];
    if (!children.length) {
      list.innerHTML = '';
      empty.style.display = '';
      document.getElementById('linkChild').open = true;
      return;
    }
    empty.style.display = 'none';
    list.innerHTML = children.map(c => `
      <div class="child-row">
        <div>
          <strong>${esc(c.firstName + ' ' + c.lastName)}</strong>
          <span class="muted" style="margin-left:8px">${esc(c.matricule || '')}${c.className ? ' · ' + esc(c.className) : ''}${c.section ? ' (' + esc(c.section) + ')' : ''}</span>
          ${c.relationship ? `<span class="badge" style="margin-left:8px">${esc(c.relationship)}</span>` : ''}
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-report="${c.id}" data-name="${esc(c.firstName + ' ' + c.lastName)}">View report card</button>
      </div>`).join('');
    list.querySelectorAll('[data-report]').forEach(button => button.addEventListener('click', () => viewReport(button.dataset.report, button.dataset.name)));
  }

  async function viewReport(studentId, name) {
    document.getElementById('reportTitle').textContent = 'Report card — ' + name;
    const { ok, data } = await api('/parents/children/' + encodeURIComponent(studentId) + '/report');
    const tbody = document.querySelector('#reportTable tbody');
    const tfoot = document.querySelector('#reportTable tfoot');
    const empty = document.getElementById('reportEmpty');
    const table = document.getElementById('reportTable');
    const rows = (ok && data.data) || [];
    if (!ok) toast(data.message || 'Could not load the report card.');
    if (!rows.length) {
      table.style.display = 'none';
      empty.style.display = '';
    } else {
      table.style.display = '';
      empty.style.display = 'none';
      tbody.innerHTML = rows.map(r =>
        `<tr><td>${esc(r.subjectName)}</td><td>${esc(r.subjectCode || '')}</td><td>${esc(r.term)}</td><td>${esc(r.sequence)}</td><td>${esc(r.score)}</td><td>${esc(r.max_score)}</td></tr>`
      ).join('');
      const scored = rows.filter(r => r.score !== null && r.score !== undefined && r.max_score);
      const avg = scored.length ? scored.reduce((s, r) => s + (Number(r.score) / Number(r.max_score)) * 20, 0) / scored.length : null;
      tfoot.innerHTML = avg === null ? '' : `<tr><th colspan="4">Average</th><th colspan="2">${avg.toFixed(2)} / 20</th></tr>`;
    }
    document.getElementById('reportCard').style.display = '';
    if (window.AttendanceSummary) {
      AttendanceSummary.load('/attendance/children/' + encodeURIComponent(studentId), document.getElementById('childAttTotals'), document.getElementById('childAttRecent'));
    }
    if (window.LibraryLoans) LibraryLoans.load('/library/children/' + encodeURIComponent(studentId), document.getElementById('childLoans'));
    document.getElementById('reportCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.getElementById('linkChildForm').addEventListener('submit', async e => {
    e.preventDefault();
    const button = document.getElementById('linkChildBtn');
    const msg = document.getElementById('linkMsg');
    const matricule = document.getElementById('linkMatricule').value.trim();
    const relationship = document.getElementById('linkRelationship').value;
    msg.textContent = ''; msg.className = 'msg';
    if (!matricule) { msg.textContent = 'Enter the student\'s matricule.'; msg.className = 'msg error'; return; }
    button.classList.add('loading');
    const { ok, data } = await api('/parents/children/link', { method: 'POST', body: JSON.stringify({ matricule, relationship }) });
    button.classList.remove('loading');
    const text = data.message || (ok ? 'Child linked.' : 'Could not link this child.');
    toast(text, ok ? 'success' : 'error');
    msg.textContent = text; msg.className = 'msg ' + (ok ? 'ok' : 'error');
    if (ok) { document.getElementById('linkMatricule').value = ''; loadChildren(); }
  });

  loadProfile();
})();
