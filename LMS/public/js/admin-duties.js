// Admin: grant/remove staff duties and set auxiliary staff sign-in passwords.
(function () {
  const staffSel = document.getElementById('dutyStaff');
  const dutySel = document.getElementById('dutyName');
  const rows = document.getElementById('dutyRows');
  const auxSel = document.getElementById('auxPasswordStaff');
  if (!staffSel) return;

  const TYPE_LABEL = { teacher: 'Teacher', auxiliary: 'Auxiliary staff', admin: 'Administrator' };
  let catalogue = {};

  function option(value, text) {
    return '<option value="' + esc(value) + '">' + esc(text) + '</option>';
  }

  async function load() {
    const res = await api('/staff-duties');
    if (!res.ok) {
      rows.innerHTML = '<tr><td colspan="5" class="muted">' + esc((res.data && res.data.message) || 'Could not load duties') + '</td></tr>';
      return;
    }
    const data = res.data.data;
    catalogue = data.catalogue;

    dutySel.innerHTML = option('', 'Choose a duty') +
      Object.entries(catalogue).map(([key, label]) => option(key, label)).join('');

    const groups = { teacher: [], auxiliary: [] };
    for (const s of data.staff) (groups[s.staffType] || []).push(s);
    staffSel.innerHTML = option('', 'Choose a staff member') +
      Object.entries(groups).filter(([, list]) => list.length).map(([type, list]) =>
        '<optgroup label="' + esc(TYPE_LABEL[type]) + '">' +
        list.map(s => option(type + ':' + s.staffId, s.name + ' (' + s.email + ')' + (s.status === 'pending' ? ' — pending' : ''))).join('') +
        '</optgroup>').join('');

    auxSel.innerHTML = groups.auxiliary.length
      ? option('', 'Choose a staff member') + groups.auxiliary.map(s => option(s.staffId, s.name + ' (' + s.email + ')')).join('')
      : option('', 'No auxiliary staff registered yet');

    rows.innerHTML = data.duties.length
      ? data.duties.map(d =>
          '<tr><td>' + esc(catalogue[d.duty] || d.duty) + '</td>' +
          '<td>' + esc(d.staffName || 'Removed record') + ' <span class="muted">· ' + esc(TYPE_LABEL[d.staffType] || d.staffType) + '</span></td>' +
          '<td>' + esc(d.staffEmail || '—') + '</td>' +
          '<td>' + esc(new Date(d.grantedAt).toLocaleDateString()) + '</td>' +
          '<td><button type="button" class="btn btn-sm btn-ghost" data-revoke="' + esc(d.id) + '" data-label="' +
          esc((catalogue[d.duty] || d.duty) + ' — ' + (d.staffName || '')) + '" aria-label="Remove ' +
          esc((catalogue[d.duty] || d.duty) + ' duty from ' + (d.staffName || 'this person')) + '">Remove</button></td></tr>'
        ).join('')
      : '<tr><td colspan="5" class="muted">No duties assigned yet.</td></tr>';
  }

  document.getElementById('dutyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const [staffType, staffId] = staffSel.value.split(':');
    if (!staffType || !dutySel.value) return toast('Choose a staff member and a duty', 'error');
    const res = await api('/staff-duties', { method: 'POST', body: JSON.stringify({ staffType, staffId: Number(staffId), duty: dutySel.value }) });
    toast((res.data && res.data.message) || (res.ok ? 'Duty granted' : 'Could not grant duty'), res.ok ? 'success' : 'error');
    if (res.ok) { dutySel.value = ''; load(); }
  });

  rows.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-revoke]');
    if (!btn) return;
    if (!confirm('Remove the duty "' + btn.dataset.label + '"? They lose access to that tool immediately.')) return;
    const res = await api('/staff-duties/' + encodeURIComponent(btn.dataset.revoke), { method: 'DELETE' });
    toast((res.data && res.data.message) || (res.ok ? 'Duty removed' : 'Could not remove duty'), res.ok ? 'success' : 'error');
    if (res.ok) load();
  });

  document.getElementById('auxPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('auxPasswordValue');
    if (!auxSel.value) return toast('Choose an auxiliary staff member', 'error');
    const res = await api('/auxiliary/' + encodeURIComponent(auxSel.value) + '/password', { method: 'PUT', body: JSON.stringify({ password: input.value }) });
    toast((res.data && res.data.message) || (res.ok ? 'Password set' : 'Could not set password'), res.ok ? 'success' : 'error');
    if (res.ok) input.value = '';
  });

  load();
})();
