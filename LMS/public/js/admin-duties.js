// Admin: grant/remove staff duties and set auxiliary staff sign-in passwords.
(function () {
  const staffSel = document.getElementById('dutyStaff');
  const dutySel = document.getElementById('dutyName');
  const rows = document.getElementById('dutyRows');
  const auxSel = document.getElementById('auxPasswordStaff');
  if (!staffSel) return;

  const TYPE_LABEL = { teacher: 'Teacher', auxiliary: 'Auxiliary staff', admin: 'Administrator' };
  let catalogue = {};
  let allClasses = [];
  const classPicker = document.getElementById('dutyClasses');
  const classList = document.getElementById('dutyClassList');
  // Checkboxes of every class; checked = the ids given.
  const classBoxes = (name, checked = []) => allClasses.map(c =>
    '<label class="duty-class"><input type="checkbox" name="' + name + '" value="' + esc(c.id) + '"' + (checked.includes(c.id) ? ' checked' : '') + '> ' + esc(c.label) + '</label>').join('');
  // Head of department: subject and section.
  const deptPicker = document.getElementById('dutyDept');
  const deptSubject = document.getElementById('dutyDeptSubject');
  const deptSection = document.getElementById('dutyDeptSection');
  let allSubjects = [];
  const subjectOptions = (selected) => '<option value="">Choose a subject</option>' + allSubjects.map(x =>
    '<option value="' + esc(x.id) + '"' + (String(selected) === String(x.id) ? ' selected' : '') + '>' + esc(x.name + (x.code ? ' (' + x.code + ')' : '')) + '</option>').join('');
  const sectionOptions = (selected) => [['Anglophone', 'Anglophone'], ['Francophone', 'Francophone'], ['', 'Both sections']].map(([v, l]) =>
    '<option value="' + v + '"' + ((selected || '') === v ? ' selected' : '') + '>' + l + '</option>').join('');
  function showPickers() {
    classPicker.hidden = dutySel.value !== 'discipline_master';
    deptPicker.hidden = dutySel.value !== 'head_of_department';
  }
  const ticked = root => Array.from(root.querySelectorAll('input[type=checkbox]:checked')).map(i => Number(i.value));

  function option(value, text) {
    return '<option value="' + esc(value) + '">' + esc(text) + '</option>';
  }

  async function load() {
    const res = await api('/staff-duties');
    if (!res.ok) {
      rows.innerHTML = '<tr><td colspan="6" class="muted">' + esc((res.data && res.data.message) || 'Could not load duties') + '</td></tr>';
      return;
    }
    const data = res.data.data;
    catalogue = data.catalogue;
    allClasses = data.classes || [];
    classList.innerHTML = classBoxes('dutyClass');
    allSubjects = data.subjects || [];
    deptSubject.innerHTML = subjectOptions('');
    showPickers();

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
          '<td>' + (d.duty === 'discipline_master'
            ? (d.classes && d.classes.length ? esc(d.classes.map(c => c.label).join(', ')) : '<span class="muted">Whole school</span>') +
              ' <button type="button" class="btn btn-sm btn-ghost" data-edit-classes="' + esc(d.id) + '" data-current="' + esc(JSON.stringify((d.classes || []).map(c => c.id))) + '">Edit classes</button>'
            : d.duty === 'head_of_department'
            ? (d.department ? esc(d.department.subjectName) + ' <span class="muted">· ' + esc(d.department.section || 'both sections') + '</span>' : '<span class="muted">No subject set</span>') +
              ' <button type="button" class="btn btn-sm btn-ghost" data-edit-dept="' + esc(d.id) + '" data-subject="' + esc(d.department ? d.department.subjectId : '') + '" data-section="' + esc(d.department ? (d.department.section || '') : 'Anglophone') + '">Edit department</button>'
            : '<span class="muted">—</span>') + '</td>' +
          '<td>' + esc(new Date(d.grantedAt).toLocaleDateString()) + '</td>' +
          '<td><button type="button" class="btn btn-sm btn-ghost" data-revoke="' + esc(d.id) + '" data-label="' +
          esc((catalogue[d.duty] || d.duty) + ' — ' + (d.staffName || '')) + '" aria-label="Remove ' +
          esc((catalogue[d.duty] || d.duty) + ' duty from ' + (d.staffName || 'this person')) + '">Remove</button></td></tr>'
        ).join('')
      : '<tr><td colspan="6" class="muted">No duties assigned yet.</td></tr>';
  }

  document.getElementById('dutyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const [staffType, staffId] = staffSel.value.split(':');
    if (!staffType || !dutySel.value) return toast('Choose a staff member and a duty', 'error');
    const classIds = dutySel.value === 'discipline_master' ? ticked(classList) : [];
    const body = { staffType, staffId: Number(staffId), duty: dutySel.value, classIds };
    if (dutySel.value === 'head_of_department') {
      if (staffType !== 'teacher') return toast('A head of department must be a teacher', 'error');
      if (!deptSubject.value) { deptSubject.focus(); return toast('Choose the subject this head of department leads', 'error'); }
      body.subjectId = Number(deptSubject.value);
      body.section = deptSection.value;
    }
    const res = await api('/staff-duties', { method: 'POST', body: JSON.stringify(body) });
    toast((res.data && res.data.message) || (res.ok ? 'Duty granted' : 'Could not grant duty'), res.ok ? 'success' : 'error');
    if (res.ok) { dutySel.value = ''; showPickers(); load(); }
  });

  dutySel.addEventListener('change', showPickers);

  rows.addEventListener('click', async (e) => {
    const editDept = e.target.closest('[data-edit-dept]');
    if (editDept) {
      const row = editDept.closest('tr');
      if (row.nextElementSibling && row.nextElementSibling.classList.contains('duty-edit-row')) { row.nextElementSibling.remove(); return; }
      row.insertAdjacentHTML('afterend', '<tr class="duty-edit-row"><td colspan="6"><fieldset class="duty-classes duty-dept"><legend>Department this head of department leads</legend>' +
        '<div class="duty-dept-row"><label>Subject<select data-dept-subject>' + subjectOptions(editDept.dataset.subject) + '</select></label>' +
        '<label>Section<select data-dept-section>' + sectionOptions(editDept.dataset.section) + '</select></label></div>' +
        '<div class="duty-edit-actions"><button type="button" class="btn btn-sm" data-save-dept="' + esc(editDept.dataset.editDept) + '">Save department</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-cancel-classes>Cancel</button></div></fieldset></td></tr>');
      return;
    }
    const saveDept = e.target.closest('[data-save-dept]');
    if (saveDept) {
      const box = saveDept.closest('fieldset');
      const subjectId = Number(box.querySelector('[data-dept-subject]').value);
      if (!subjectId) return toast('Choose a subject', 'error');
      const res = await api('/staff-duties/' + encodeURIComponent(saveDept.dataset.saveDept) + '/department', { method: 'PUT', body: JSON.stringify({ subjectId, section: box.querySelector('[data-dept-section]').value }) });
      toast((res.data && res.data.message) || (res.ok ? 'Department saved' : 'Could not save the department'), res.ok ? 'success' : 'error');
      if (res.ok) load();
      return;
    }
    const edit = e.target.closest('[data-edit-classes]');
    if (edit) {
      const row = edit.closest('tr');
      if (row.nextElementSibling && row.nextElementSibling.classList.contains('duty-edit-row')) { row.nextElementSibling.remove(); return; }
      const current = JSON.parse(edit.dataset.current || '[]');
      row.insertAdjacentHTML('afterend', '<tr class="duty-edit-row"><td colspan="6"><fieldset class="duty-classes"><legend>Classes this discipline master looks after</legend>' +
        '<p class="muted">Leave all unticked for the whole school.</p><div class="duty-class-list">' + classBoxes('editClass', current) + '</div>' +
        '<div class="duty-edit-actions"><button type="button" class="btn btn-sm" data-save-classes="' + esc(edit.dataset.editClasses) + '">Save classes</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-cancel-classes>Cancel</button></div></fieldset></td></tr>');
      return;
    }
    const save = e.target.closest('[data-save-classes]');
    if (save) {
      const res = await api('/staff-duties/' + encodeURIComponent(save.dataset.saveClasses) + '/classes', { method: 'PUT', body: JSON.stringify({ classIds: ticked(save.closest('fieldset')) }) });
      toast((res.data && res.data.message) || (res.ok ? 'Classes saved' : 'Could not save the classes'), res.ok ? 'success' : 'error');
      if (res.ok) load();
      return;
    }
    if (e.target.closest('[data-cancel-classes]')) { e.target.closest('tr').remove(); return; }
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
