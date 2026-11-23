// Parent panel: children (and linking a child), then one child's results, attendance and library loans.
// The child chosen in the "Showing" bar applies to every section and is remembered on this device.
(function () {
  let children = [];
  let childId = null;
  let results = [], yearName = '';
  const loaded = {};   // section -> child id it was last loaded for
  const fullName = c => c.firstName + ' ' + c.lastName;
  const current = () => children.find(c => String(c.id) === String(childId));

  async function loadProfile() {
    const { ok, data } = await api('/parents/profile');
    if (!ok) { document.getElementById('welcome').textContent = 'Could not load your account. Sign in again.'; return; }
    const name = [data.data.firstName, data.data.lastName].filter(Boolean).join(' ');
    document.getElementById('welcome').textContent = 'Welcome, ' + name;
    if (window.setPanelUser) setPanelUser(name);
    loadChildren();
  }

  async function loadChildren() {
    const { ok, data } = await api('/parents/children');
    const list = document.getElementById('childrenList');
    const empty = document.getElementById('childrenEmpty');
    children = (ok && data.data) || [];
    if (!children.length) {
      list.innerHTML = '';
      empty.style.display = '';
      document.getElementById('linkChild').open = true;
      document.getElementById('childBar').hidden = true;
      return;
    }
    empty.style.display = 'none';
    list.innerHTML = children.map(c => `
      <div class="child-row">
        <div>
          <strong>${esc(fullName(c))}</strong>
          <span class="muted" style="margin-left:8px">${esc(c.matricule || '')}${c.className ? ' · ' + esc(c.className) : ''}${c.section ? ' (' + esc(c.section) + ')' : ''}</span>
          ${c.relationship ? `<span class="badge" style="margin-left:8px">${esc(c.relationship)}</span>` : ''}
        </div>
        <div class="pp-child-links">
          <button type="button" class="btn btn-sm" data-open="results" data-child="${esc(c.id)}">Results</button>
          <button type="button" class="btn btn-secondary btn-sm" data-open="attendance" data-child="${esc(c.id)}">Attendance</button>
          <button type="button" class="btn btn-secondary btn-sm" data-open="loans" data-child="${esc(c.id)}">Library loans</button>
        </div>
      </div>`).join('');

    const sel = document.getElementById('childSelect');
    sel.innerHTML = children.map(c => `<option value="${esc(c.id)}">${esc(fullName(c))}</option>`).join('');
    let saved = null;
    try { saved = localStorage.getItem('parentChild'); } catch (_) {}
    choose(children.some(c => String(c.id) === saved) ? saved : children[0].id);
    syncBar();
  }

  function choose(id) {
    childId = String(id);
    document.getElementById('childSelect').value = childId;
    try { localStorage.setItem('parentChild', childId); } catch (_) {}
    const c = current();
    document.getElementById('childMeta').textContent = c ? [c.matricule, c.className].filter(Boolean).join(' · ') : '';
    loadSection(activeTab());
  }

  const activeTab = () => (document.querySelector('.tp-link.active') || {}).dataset?.tab || 'overview';

  // The "Showing" bar appears on the child sections, and only matters when there are children.
  function syncBar() {
    document.getElementById('childBar').hidden = !children.length || activeTab() === 'overview';
  }

  async function loadSection(tab) {
    const c = current();
    if (!c || loaded[tab] === childId) return;
    loaded[tab] = childId;
    const name = fullName(c);
    if (tab === 'results') {
      document.getElementById('reportTitle').textContent = 'Results — ' + name;
      const { ok, data } = await api('/parents/children/' + encodeURIComponent(c.id) + '/report');
      if (!ok) toast((data && data.message) || 'Could not load the results.', 'error');
      ({ rows: results, yearName } = ResultsTable.pickYear((ok && data.data) || []));
      renderResults();
    } else if (tab === 'attendance') {
      document.getElementById('attTitle').textContent = 'Attendance this year — ' + name;
      if (window.AttendanceSummary) AttendanceSummary.load('/attendance/children/' + encodeURIComponent(c.id), document.getElementById('childAttTotals'), document.getElementById('childAttRecent'));
    } else if (tab === 'loans') {
      document.getElementById('loansTitle').textContent = 'Library loans — ' + name;
      if (window.LibraryLoans) LibraryLoans.load('/library/children/' + encodeURIComponent(c.id), document.getElementById('childLoans'));
    }
  }

  function renderResults() {
    ResultsTable.render({
      table: document.getElementById('reportTable'), empty: document.getElementById('reportEmpty'), note: document.getElementById('resultsNote'),
      rows: results, term: document.getElementById('resultsTerm').value, yearName, who: 'the',
    });
  }

  document.getElementById('resultsTerm').addEventListener('change', renderResults);
  document.getElementById('childSelect').addEventListener('change', e => choose(e.target.value));
  document.getElementById('childrenList').addEventListener('click', e => {
    const b = e.target.closest('[data-open]');
    if (!b) return;
    choose(b.dataset.child);
    showPanel(b.dataset.open);
  });
  window.addEventListener('hashchange', () => { syncBar(); loadSection(activeTab()); });

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
