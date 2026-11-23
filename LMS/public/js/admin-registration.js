(function () {
  if (!window.LMS || !window.LMS.ready) return;
  const { loadStats } = window.LMS;

  // ===== SUBJECTS =====
  let allSubjectsList = [];
  async function loadSubjectTable() {
    const tbody = document.getElementById('subjectTableBody');
    const { ok, data } = await api('/subjects');
    if (!ok || !data.data) {
      tbody.innerHTML = '<tr><td colspan="4" class="reg-muted">Failed to load.</td></tr>';
      return;
    }
    allSubjectsList = data.data;
    renderSubjectTable(allSubjectsList);
    document.getElementById('subjectCount').textContent = allSubjectsList.length;
  }
  loadSubjectTable();

  function renderSubjectTable(subjects) {
    const tbody = document.getElementById('subjectTableBody');
    if (!subjects.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="reg-muted">No subjects found.</td></tr>';
      return;
    }
    tbody.innerHTML = subjects.map(s => {
      const subjectMasterName = s.subject_master_name || '';
      const className = s.class_name || '';
      const hoursPerWeek = s.hours_per_week || 4;
      const hasLab = s.has_lab ? 'Yes' : 'No';
      return `<tr>
        <td>${esc(s.code)}</td>
        <td>${esc(s.name)}</td>
        <td>${esc(s.coefficient || 1)}</td>
        <td>${esc(subjectMasterName)}</td>
        <td>${esc(className)}</td>
        <td>${esc(hoursPerWeek)}</td>
        <td>${esc(hasLab)}</td>
        <td class="action-col">
          <button type="button" class="action-btn edit" data-action="editSubject" data-id="${s.id}" aria-label="Edit Subject">Edit</button>
          <button type="button" class="action-btn delete" data-action="deleteSubject" data-id="${s.id}" aria-label="Delete Subject">Delete</button>
          <button type="button" class="action-btn accept" data-action="acceptSubject" data-id="${s.id}" aria-label="Accept Subject">Accept</button>
        </td>
      </tr>`;
    }).join('');
  }

  document.getElementById('subjectForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('subjectFormMsg');
    msg.className = 'msg';
    const categories = document.getElementById('subCategories').value;
    if (!categories) {
      msg.textContent = 'Category is required';
      msg.className = 'msg error';
      return;
    }
    const coefficient = parseInt(document.getElementById('subCoefficient').value) || 1;
    if (coefficient < 1 || coefficient > 5) {
      msg.textContent = 'Coefficient must be between 1 and 5';
      msg.className = 'msg error';
      return;
    }
    const hours_per_week = parseInt(document.getElementById('subHoursPerWeek').value) || 4;
    if (hours_per_week < 1 || hours_per_week > 10) {
      msg.textContent = 'Hours per week must be between 1 and 10';
      msg.className = 'msg error';
      return;
    }
    const has_lab = document.getElementById('subHasLab').value === 'true';
    const body = {
      name: document.getElementById('subName').value,
      code: document.getElementById('subCode').value,
      description: document.getElementById('subDesc').value,
      coefficient,
      categories,
      subject_master: document.getElementById('subSubjectMaster').value || null,
      class_id: document.getElementById('subClassId').value || null,
      hours_per_week,
      has_lab,
    };

    const editId = document.getElementById('subjectEditId').value;
    const url = editId ? `/subjects/${editId}` : '/subjects';
    const method = editId ? 'PUT' : 'POST';

    const { ok, data } = await api(url, {
      method,
      body: JSON.stringify(body),
    });
    if (ok) {
      msg.textContent = editId ? 'Subject updated successfully!' : 'Subject created successfully!';
      msg.className = 'msg ok';
      resetSubjectForm();
      loadSubjectTable();
      loadStats();
    } else {
      msg.textContent = data.message || 'Failed to submit subject.';
      msg.className = 'msg error';
    }
  });

  function resetSubjectForm() {
    document.getElementById('subjectForm').reset();
    document.getElementById('subjectEditId').value = '';
    document.getElementById('subjectHeaderBar').textContent = 'Register New Subject';
    document.getElementById('subjectSubmitBtn').textContent = 'Create Subject';
  }

  window.editSubject = async function (id) {
    const { ok, data } = await api(`/subjects/${id}`);
    if (!ok || !data.data) { toast('Failed to fetch subject details.'); return; }
    const s = data.data;
    document.getElementById('subjectEditId').value = s.id;
    document.getElementById('subjectHeaderBar').textContent = `Edit Subject: ${s.code}`;
    document.getElementById('subjectSubmitBtn').textContent = 'Accept Changes';
    document.getElementById('subName').value = s.name || '';
    document.getElementById('subCode').value = s.code || '';
    document.getElementById('subDesc').value = s.description || '';
    document.getElementById('subCoefficient').value = s.coefficient || 1;
    document.getElementById('subCategories').value = s.categories || '';
    document.getElementById('subSubjectMaster').value = s.subject_master || '';
    document.getElementById('subClassId').value = s.class_id || '';
    document.getElementById('subHoursPerWeek').value = s.hours_per_week || 4;
    document.getElementById('subHasLab').value = s.has_lab ? 'true' : 'false';
    window.LMS.switchTab('registration');
    document.querySelector('.reg-subtab[data-sub="subject"]').click();
    document.getElementById('subjectForm').scrollIntoView({ behavior: 'smooth' });
  };

  window.deleteSubject = async function (id) {
    const subject = allSubjectsList.find(s => s.id === id);
    const subjectLabel = subject ? `${subject.name} (${subject.code})` : 'this subject';
    if (!confirm(`Delete ${subjectLabel}? This cannot be undone.`)) return;
    const { ok, data } = await api(`/subjects/${id}`, { method: 'DELETE' });
    if (ok) { loadSubjectTable(); loadStats(); }
    else toast(data.message || 'Failed to delete subject.');
  };

  window.acceptSubject = function () { toast('Subject entry accepted successfully!'); };

  document.getElementById('subjectSearch')?.addEventListener('input', function () {
    const q = this.value.toLowerCase().trim();
    if (!q) { renderSubjectTable(allSubjectsList); return; }
    const filtered = allSubjectsList.filter(s => {
      const name = (s.name || '').toLowerCase();
      const code = (s.code || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
    renderSubjectTable(filtered);
  });

  // Subject/class dropdowns for subject form
  async function loadSubjectMasters() {
    const { ok, data } = await api('/teachers');
    if (ok && data.data) {
      const sel = document.getElementById('subSubjectMaster');
      sel.innerHTML = '<option value="">-- Select Teacher --</option>';
      data.data.forEach(t => {
        const o = document.createElement('option');
        o.value = t.id;
        o.textContent = [t.firstName, t.middleName, t.lastName].filter(Boolean).join(' ');
        sel.appendChild(o);
      });
    }
  }
  loadSubjectMasters();

  async function loadSubjectClasses() {
    const { ok, data } = await api('/classes');
    if (ok && data.data) {
      const sel = document.getElementById('subClassId');
      sel.innerHTML = '<option value="">-- Select Class --</option>';
      data.data.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = `${c.name}${c.stream ? ' (' + c.stream + ')' : ''} — ${c.section}`;
        sel.appendChild(o);
      });
    }
  }
  loadSubjectClasses();

  // ===== CLASSES =====
  let allClasses = [];
  let allTeachers = [];
  let selectedClassId = null;

  async function loadTeachers() {
    const { ok, data } = await api('/teachers');
    if (ok && data.data) {
      allTeachers = data.data;
      const sel = document.getElementById('regMaster');
      sel.innerHTML = '<option value="">-- Choose Staff --</option>';
      allTeachers.forEach(t => {
        const o = document.createElement('option');
        o.value = t.id;
        o.textContent = [t.firstName, t.middleName, t.lastName].filter(Boolean).join(' ');
        sel.appendChild(o);
      });
    }
  }
  loadTeachers();

  async function loadClassesForReg() {
    const { ok, data } = await api('/classes/with-fees');
    if (ok && data.data) {
      allClasses = data.data;
      renderClassTable(allClasses);
      document.getElementById('regClassCount').textContent = allClasses.length;
    }
  }
  loadClassesForReg();

  function renderClassTable(classes) {
    const tbody = document.getElementById('regTableBody');
    if (!classes.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="reg-muted">No classes found.</td></tr>';
      return;
    }
    tbody.innerHTML = classes.map(c => {
      const masterName = c.class_master_name || '<span class="reg-muted">—</span>';
      return `<tr class="reg-table-row" data-id="${c.id}">
        <td>${esc(c.section)}</td>
        <td>${esc(c.name)}${c.stream ? ' (' + esc(c.stream) + ')' : ''}</td>
        <td>${masterName}</td>
        <td>${esc(c.option_name || '')}</td>
        <td class="reg-text-right">${Number(c.registration_fee || 0).toLocaleString()}</td>
        <td class="reg-text-right">${Number(c.tuition_fee || 0).toLocaleString()}</td>
        <td class="action-col">
          <button type="button" class="action-btn edit" data-action="inlineEditClass" data-id="${c.id}" aria-label="Edit Class Details">Edit</button>
          <button type="button" class="action-btn delete" data-action="inlineDeleteClass" data-id="${c.id}" aria-label="Reset/Clear Class">Reset</button>
          <button type="button" class="action-btn accept" data-action="inlineAcceptClass" data-id="${c.id}" aria-label="Accept/Save Class">Accept</button>
        </td>
      </tr>`;
    }).join('');

    document.querySelectorAll('.reg-table-row').forEach(row => {
      row.addEventListener('click', () => selectClass(parseInt(row.dataset.id)));
    });
  }

  function selectClass(id) {
    const c = allClasses.find(x => x.id === id);
    if (!c) return;
    selectedClassId = c.id;
    document.getElementById('regClassId').value = c.id;
    document.getElementById('regSection').value = c.section;
    populateClassNameDropdown(c.section, c.name, c.stream);
    document.getElementById('regMaster').value = c.class_master_id || '';
    document.getElementById('regFeeReg').value = c.registration_fee || 0;
    document.getElementById('regFeeTuition').value = c.tuition_fee || 0;
    document.getElementById('regFeePta').value = c.pta_fee || 0;
    document.getElementById('regFeeCaution').value = c.caution_fee || 0;
    document.getElementById('regFeePracticals').value = c.practicals_fee || 0;
    updateClassFeesTotal();
    highlightTableRow(id);
  }

  window.inlineEditClass = function (id) {
    selectClass(id);
    document.getElementById('regMaster').focus();
  };

  window.inlineDeleteClass = async function (id) {
    const cls = allClasses.find(c => c.id === id);
    if (!confirm(`Remove the class master and reset all fees for ${cls ? cls.name + (cls.stream ? ' (' + cls.stream + ')' : '') : 'this class'}?`)) return;
    const body = { class_master_id: null, registration_fee: 0, tuition_fee: 0, pta_fee: 0, caution_fee: 0, practicals_fee: 0, option_name: null };
    const { ok } = await api(`/classes/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    if (ok) {
      await loadClassesForReg();
      document.getElementById('regResetBtn').click();
    }
  };

  window.inlineAcceptClass = async function (id) {
    selectClass(id);
    document.getElementById('regSaveBtn').click();
  };

  function highlightTableRow(id) {
    document.querySelectorAll('.reg-table-row').forEach(r => r.classList.remove('selected'));
    const row = document.querySelector(`.reg-table-row[data-id="${id}"]`);
    if (row) row.classList.add('selected');
  }

  function populateClassNameDropdown(section, selectedName, selectedStream) {
    const sel = document.getElementById('regClassName');
    sel.innerHTML = '<option value="">-- Choose Class --</option>';
    const filtered = allClasses.filter(c => c.section === section);
    const seen = new Set();
    filtered.forEach(c => {
      const key = c.name;
      if (seen.has(key)) return;
      seen.add(key);
      const o = document.createElement('option');
      o.value = c.name;
      o.textContent = c.name;
      if (c.name === selectedName) o.selected = true;
      sel.appendChild(o);
    });
    const streamSel = document.getElementById('regStream');
    if (section === 'Francophone') {
      streamSel.innerHTML = '<option value="">None</option>';
      streamSel.disabled = true;
    } else {
      streamSel.innerHTML = '<option value="">-- Choose Option --</option><option value="Normal">Normal</option><option value="Bilingual">Bilingual</option>';
      streamSel.disabled = false;
      if (selectedStream) streamSel.value = selectedStream;
    }
  }

  document.getElementById('regSection')?.addEventListener('change', function () {
    populateClassNameDropdown(this.value, null, null);
    document.getElementById('regMaster').value = '';
    document.getElementById('regFeeReg').value = 0;
    document.getElementById('regFeeTuition').value = 0;
    document.getElementById('regFeePta').value = 0;
    document.getElementById('regFeeCaution').value = 0;
    document.getElementById('regFeePracticals').value = 0;
    updateClassFeesTotal();
    selectedClassId = null;
    document.getElementById('regClassId').value = '';
    highlightTableRow(null);
  });

  function updateClassFeesTotal() {
    const r = parseFloat(document.getElementById('regFeeReg')?.value) || 0;
    const t = parseFloat(document.getElementById('regFeeTuition')?.value) || 0;
    const p = parseFloat(document.getElementById('regFeePta')?.value) || 0;
    const c = parseFloat(document.getElementById('regFeeCaution')?.value) || 0;
    const pr = parseFloat(document.getElementById('regFeePracticals')?.value) || 0;
    const el = document.getElementById('regFeesTotal');
    if (el) el.textContent = (r + t + p + c + pr).toLocaleString() + ' XAF';
  }

  document.querySelectorAll('#sub-classes .reg-fee-input').forEach(el => {
    el.addEventListener('input', updateClassFeesTotal);
  });

  document.getElementById('regSaveBtn')?.addEventListener('click', async () => {
    const id = parseInt(document.getElementById('regClassId').value);
    if (!id) { toast('Select a class from the table first.'); return; }
    const streamVal = document.getElementById('regStream').value;
    const body = {
      class_master_id: parseInt(document.getElementById('regMaster').value) || null,
      registration_fee: parseFloat(document.getElementById('regFeeReg').value) || 0,
      tuition_fee: parseFloat(document.getElementById('regFeeTuition').value) || 0,
      pta_fee: parseFloat(document.getElementById('regFeePta').value) || 0,
      caution_fee: parseFloat(document.getElementById('regFeeCaution').value) || 0,
      practicals_fee: parseFloat(document.getElementById('regFeePracticals').value) || 0,
      option_name: streamVal || null,
    };
    const { ok } = await api(`/classes/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    if (ok) {
      await loadClassesForReg();
      selectClass(id);
      toast('Class fees and master updated and accepted!');
    } else {
      toast('Failed to save class updates.');
    }
  });

  document.getElementById('regResetBtn')?.addEventListener('click', () => {
    document.getElementById('regSection').value = '';
    document.getElementById('regClassName').innerHTML = '<option value="">-- Choose Class --</option>';
    document.getElementById('regStream').innerHTML = '<option value="">-- Choose Option --</option><option value="Normal">Normal</option><option value="Bilingual">Bilingual</option>';
    document.getElementById('regStream').disabled = false;
    document.getElementById('regMaster').value = '';
    document.getElementById('regFeeReg').value = 0;
    document.getElementById('regFeeTuition').value = 0;
    document.getElementById('regFeePta').value = 0;
    document.getElementById('regFeeCaution').value = 0;
    document.getElementById('regFeePracticals').value = 0;
    document.getElementById('regClassId').value = '';
    updateClassFeesTotal();
    selectedClassId = null;
    highlightTableRow(null);
    document.getElementById('regSearchInput').value = '';
    renderClassTable(allClasses);
  });

  document.getElementById('regSearchInput')?.addEventListener('input', function () {
    const q = this.value.toLowerCase();
    const filtered = allClasses.filter(c =>
      c.section.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) ||
      (c.class_master_name || '').toLowerCase().includes(q) || (c.option_name || '').toLowerCase().includes(q)
    );
    renderClassTable(filtered);
  });

  document.getElementById('regEditBtn')?.addEventListener('click', () => {
    const firstRow = document.querySelector('.reg-table-row');
    if (firstRow) selectClass(parseInt(firstRow.dataset.id));
  });

  document.getElementById('regDeleteBtn')?.addEventListener('click', () => {
    if (!selectedClassId) { toast('Select a class first.'); return; }
    inlineDeleteClass(selectedClassId);
  });

  // ===== AUXILIARY STAFF =====
  let allAuxiliaryList = [];
  async function loadAuxiliaryTable() {
    const tbody = document.getElementById('auxiliaryTableBody');
    const { ok, data } = await api('/auxiliary');
    if (!ok || !data.data) {
      tbody.innerHTML = '<tr><td colspan="6" class="reg-muted">Failed to load.</td></tr>';
      return;
    }
    allAuxiliaryList = data.data;
    renderAuxiliaryTable(allAuxiliaryList);
    document.getElementById('auxiliaryCount').textContent = allAuxiliaryList.length;
  }
  loadAuxiliaryTable();

  function renderAuxiliaryTable(staffList) {
    const tbody = document.getElementById('auxiliaryTableBody');
    if (!staffList.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="reg-muted">No auxiliary staff found.</td></tr>';
      return;
    }
    tbody.innerHTML = staffList.map(s => {
      const name = esc([s.firstName, s.middleName, s.lastName].filter(Boolean).join(' '));
      const acceptStyle = s.status === 'active' ? 'color: #16a34a' : 'color: #dc2626';
      const acceptTitle = s.status === 'active' ? 'Staff Active' : 'Accept/Activate Staff';
      return `<tr>
        <td>${name}</td>
        <td>${esc(s.email)}</td>
        <td>${esc(s.phone || '')}</td>
        <td>${esc(s.role)}</td>
        <td><span class="badge ${s.status === 'active' ? 'no' : 'yes'}">${esc(s.status)}</span></td>
        <td class="action-col">
          <button type="button" class="action-btn edit" data-action="editAuxiliary" data-id="${s.id}" aria-label="Edit Staff">Edit</button>
          <button type="button" class="action-btn delete" data-action="deleteAuxiliary" data-id="${s.id}" aria-label="Delete Staff">Delete</button>
          <button type="button" class="action-btn accept" data-action="acceptAuxiliary" data-id="${s.id}" style="${acceptStyle}" aria-label="${acceptTitle}">Accept</button>
        </td>
      </tr>`;
    }).join('');
  }

  document.getElementById('auxiliaryForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('auxiliaryFormMsg');
    msg.className = 'msg';
    const body = {
      firstName: document.getElementById('auxFirstName').value,
      middleName: document.getElementById('auxMiddleName').value,
      lastName: document.getElementById('auxLastName').value,
      email: document.getElementById('auxEmail').value,
      phone: document.getElementById('auxPhone').value,
      role: document.getElementById('auxRole').value,
      status: document.getElementById('auxStatus').value,
    };
    const editId = document.getElementById('auxiliaryEditId').value;
    const url = editId ? `/auxiliary/${editId}` : '/auxiliary/register';
    const method = editId ? 'PUT' : 'POST';
    const { ok, data } = await api(url, { method, body: JSON.stringify(body) });
    if (ok) {
      msg.textContent = editId ? 'Staff updated successfully!' : 'Staff registered successfully!';
      msg.className = 'msg ok';
      resetAuxiliaryForm();
      loadAuxiliaryTable();
    } else {
      msg.textContent = data.message || 'Failed to submit staff details.';
      msg.className = 'msg error';
    }
  });

  function resetAuxiliaryForm() {
    document.getElementById('auxiliaryForm').reset();
    document.getElementById('auxiliaryEditId').value = '';
    document.getElementById('auxiliaryHeaderBar').textContent = 'Register Auxiliary Staff';
    document.getElementById('auxSubmitBtn').textContent = 'Register Staff';
  }

  window.editAuxiliary = async function (id) {
    const { ok, data } = await api(`/auxiliary/${id}`);
    if (!ok || !data.data) { toast('Failed to fetch staff details.'); return; }
    const s = data.data;
    document.getElementById('auxiliaryEditId').value = s.id;
    document.getElementById('auxiliaryHeaderBar').textContent = `Edit Staff: ${[s.firstName, s.lastName].filter(Boolean).join(' ')}`;
    document.getElementById('auxSubmitBtn').textContent = 'Accept Changes';
    document.getElementById('auxFirstName').value = s.firstName || '';
    document.getElementById('auxMiddleName').value = s.middleName || '';
    document.getElementById('auxLastName').value = s.lastName || '';
    document.getElementById('auxEmail').value = s.email || '';
    document.getElementById('auxPhone').value = s.phone || '';
    document.getElementById('auxRole').value = s.role || '';
    document.getElementById('auxStatus').value = s.status || 'pending';
    window.LMS.switchTab('registration');
    document.querySelector('.reg-subtab[data-sub="auxiliary"]').click();
    document.getElementById('auxiliaryForm').scrollIntoView({ behavior: 'smooth' });
  };

  window.deleteAuxiliary = async function (id) {
    const staff = allAuxiliaryList.find(s => s.id === id);
    const staffLabel = staff ? [staff.firstName, staff.lastName].filter(Boolean).join(' ') + (staff.role ? ' (' + staff.role + ')' : '') : 'this staff member';
    if (!confirm(`Delete ${staffLabel}? This cannot be undone.`)) return;
    const { ok, data } = await api(`/auxiliary/${id}`, { method: 'DELETE' });
    if (ok) loadAuxiliaryTable();
    else toast(data.message || 'Failed to delete staff.');
  };

  window.acceptAuxiliary = async function (id) {
    const { ok, data } = await api(`/auxiliary/set-status/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'active' }) });
    if (ok) { loadAuxiliaryTable(); toast('Auxiliary staff accepted and activated successfully!'); }
    else toast(data.message || 'Failed to accept staff.');
  };

  document.getElementById('auxiliarySearch')?.addEventListener('input', function () {
    const q = this.value.toLowerCase().trim();
    if (!q) { renderAuxiliaryTable(allAuxiliaryList); return; }
    const filtered = allAuxiliaryList.filter(s => {
      const name = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ').toLowerCase();
      return name.includes(q) || (s.email || '').toLowerCase().includes(q) || (s.role || '').toLowerCase().includes(q);
    });
    renderAuxiliaryTable(filtered);
  });

  // ===== ACADEMIC YEARS =====
  let allAcademicYearsList = [];
  let selectedAYId = null;

  async function loadAcademicYears() {
    const tbody = document.getElementById('ayTableBody');
    const { ok, data } = await api('/academic-years');
    if (!ok || !data.data) {
      tbody.innerHTML = '<tr><td colspan="7" class="reg-muted">Failed to load.</td></tr>';
      return;
    }
    allAcademicYearsList = data.data;
    renderAcademicYears(allAcademicYearsList);
    document.getElementById('ayCount').textContent = allAcademicYearsList.length;
  }
  loadAcademicYears();

  function renderAcademicYears(years) {
    const tbody = document.getElementById('ayTableBody');
    if (!years.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="reg-muted">No academic years found.</td></tr>';
      return;
    }
    tbody.innerHTML = years.map(y => {
      const statusBadge = `<span class="badge ${y.isCurrent ? 'no' : 'yes'}">${esc(y.isCurrent ? 'Current' : 'Inactive')}</span>`;
      return `<tr data-id="${y.id}">
        <td>${esc(y.name)}</td>
        <td>${y.fromYear}</td>
        <td>${y.toYear}</td>
        <td>${statusBadge}</td>
        <td>${y.numberOfStudents ?? 0}</td>
        <td>${y.numberOfTeachers ?? 0}</td>
        <td class="action-col">
          <button type="button" class="action-btn accept" data-action="setCurrentAY" data-id="${y.id}" aria-label="Set as Current" ${y.isCurrent ? 'disabled style="opacity:0.4"' : ''}>Set current</button>
          <button type="button" class="action-btn delete" data-action="deleteAY" data-id="${y.id}" aria-label="Delete">Delete</button>
        </td>
      </tr>`;
    }).join('');
    document.querySelectorAll('#ayTableBody tr[data-id]').forEach(row => {
      row.addEventListener('click', () => {
        selectedAYId = parseInt(row.dataset.id);
        highlightAYRow(selectedAYId);
      });
    });
  }

  function highlightAYRow(id) {
    document.querySelectorAll('#ayTableBody tr').forEach(r => r.classList.remove('selected'));
    const row = document.querySelector(`#ayTableBody tr[data-id="${id}"]`);
    if (row) row.classList.add('selected');
  }

  function fillAYForm(y) {
    document.getElementById('academicYearEditId').value = y.id;
    document.getElementById('ayFromYear').value = y.fromYear;
    document.getElementById('ayToYear').value = y.toYear;
    document.getElementById('ayIsCurrent').value = y.isCurrent ? '1' : '0';
    document.getElementById('aySubmitBtn').textContent = 'Update Year';
  }

  document.getElementById('academicYearForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('ayFormMsg');
    msg.className = 'msg';
    const fromYear = parseInt(document.getElementById('ayFromYear').value);
    const toYear = parseInt(document.getElementById('ayToYear').value);
    const isCurrent = document.getElementById('ayIsCurrent').value === '1';
    if (toYear <= fromYear) {
      msg.textContent = 'To year must be greater than from year.';
      msg.className = 'msg error';
      return;
    }
    const editId = document.getElementById('academicYearEditId').value;
    const url = editId ? `/academic-years/${editId}` : '/academic-years';
    const method = editId ? 'PUT' : 'POST';
    const { ok, data } = await api(url, { method, body: JSON.stringify({ fromYear, toYear, isCurrent }) });
    if (ok) {
      msg.textContent = editId ? 'Academic year updated!' : 'Academic year created!';
      msg.className = 'msg ok';
      document.getElementById('academicYearForm').reset();
      document.getElementById('academicYearEditId').value = '';
      document.getElementById('aySubmitBtn').textContent = 'Create Year';
      loadAcademicYears();
    } else {
      msg.textContent = data.message || 'Failed to submit academic year.';
      msg.className = 'msg error';
    }
  });

  window.setCurrentAY = async function (id) {
    if (!confirm('Set this as the current academic year?')) return;
    const { ok, data } = await api(`/academic-years/${id}/current`, { method: 'PUT' });
    if (ok) { loadAcademicYears(); toast('Academic year set as current.'); }
    else toast(data.message || 'Failed to set current year.');
  };

  window.deleteAY = async function (id) {
    const yearName = document.querySelector(`#ayTableBody tr[data-id="${id}"] td`)?.textContent?.trim() || 'this academic year';
    if (!confirm(`Delete academic year ${yearName}? Enrolments and marks recorded in it will no longer be reachable. This cannot be undone.`)) return;
    const { ok, data } = await api(`/academic-years/${id}`, { method: 'DELETE' });
    if (ok) { selectedAYId = null; highlightAYRow(null); loadAcademicYears(); }
    else toast(data.message || 'Failed to delete academic year.');
  };

  document.getElementById('ayResetBtn')?.addEventListener('click', () => {
    document.getElementById('academicYearForm').reset();
    document.getElementById('academicYearEditId').value = '';
    document.getElementById('aySubmitBtn').textContent = 'Create Year';
    selectedAYId = null;
    highlightAYRow(null);
  });

  document.getElementById('ayEditBtn')?.addEventListener('click', () => {
    if (!selectedAYId) {
      const firstRow = document.querySelector('#ayTableBody tr[data-id]');
      if (firstRow) selectedAYId = parseInt(firstRow.dataset.id);
      else { toast('Select a year first.'); return; }
    }
    const y = allAcademicYearsList.find(x => x.id === selectedAYId);
    if (y) fillAYForm(y);
  });

  document.getElementById('aySaveBtn')?.addEventListener('click', () => {
    document.getElementById('academicYearForm').dispatchEvent(new Event('submit'));
  });

  document.getElementById('ayDeleteBtn')?.addEventListener('click', async () => {
    if (!selectedAYId) {
      const firstRow = document.querySelector('#ayTableBody tr[data-id]');
      if (firstRow) selectedAYId = parseInt(firstRow.dataset.id);
      else { toast('Select a year first.'); return; }
    }
    await deleteAY(selectedAYId);
  });

  document.getElementById('aySearch')?.addEventListener('input', function () {
    const q = this.value.toLowerCase().trim();
    if (!q) { renderAcademicYears(allAcademicYearsList); return; }
    const filtered = allAcademicYearsList.filter(y => {
      return (y.name || '').toLowerCase().includes(q) || `${y.fromYear}-${y.toYear}`.includes(q);
    });
    renderAcademicYears(filtered);
  });

  // ===== PERSONNEL =====
  let personnel = [];
  const pf = {
    form: document.getElementById('personnelFilter'), name: document.getElementById('pfName'), section: document.getElementById('pfSection'),
    type: document.getElementById('pfType'), status: document.getElementById('pfStatus'), count: document.getElementById('pfCount'),
  };

  async function loadPersonnel() {
    const tbody = document.getElementById('personnelRows');
    const { ok, data } = await api('/teachers');
    if (!ok || !data.data) {
      tbody.innerHTML = '<tr><td colspan="8" class="muted">Failed to load.</td></tr>';
      return;
    }
    personnel = data.data;
    // Type choices come from the data (e.g. Government, Part-time), keeping the current choice.
    if (pf.type) {
      const current = pf.type.value;
      const types = [...new Set(personnel.map(t => t.employmentType).filter(Boolean))].sort();
      pf.type.innerHTML = '<option value="">All types</option>' + types.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
      if (types.includes(current)) pf.type.value = current;
    }
    renderPersonnel();
  }

  function renderPersonnel() {
    const tbody = document.getElementById('personnelRows');
    const q = (pf.name?.value || '').trim().toLowerCase();
    const list = personnel.filter(t => {
      const name = [t.firstName, t.middleName, t.lastName].filter(Boolean).join(' ') || t.name || '';
      return (!q || `${name} ${t.email || ''} ${t.phone || ''}`.toLowerCase().includes(q))
        && (!pf.section?.value || t.section === pf.section.value)
        && (!pf.type?.value || t.employmentType === pf.type.value)
        && (!pf.status?.value || t.status === pf.status.value);
    });
    const filtering = Boolean(q || pf.section?.value || pf.type?.value || pf.status?.value);
    if (pf.count) pf.count.textContent = filtering ? `Showing ${list.length} of ${personnel.length} staff` : `${personnel.length} staff`;
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="muted">${personnel.length ? 'No staff match these filters. Clear the filters to see everyone.' : 'No staff yet.'}</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(t => {
      const name = esc([t.firstName, t.middleName, t.lastName].filter(Boolean).join(' '));
      const statusBadge = `<span class="badge ${t.status === 'active' ? 'no' : 'yes'}">${esc(t.status)}</span>`;
      const workspaceBase = (document.body.dataset.workspaceBase || '').replace(/\/+$/, '');
      const suspendBtn = document.querySelector('[data-canonical-personnel]')
        ? (workspaceBase
          ? `<a class="btn btn-secondary btn-sm" href="${esc(workspaceBase)}/registration">Manage teacher</a>`
          : '<span class="muted">Managed in the school workspace</span>')
        : t.status === 'active'
        ? `<button class="btn btn-secondary btn-sm" data-action="toggleStatus" data-id="${t.id}" data-arg="suspended">Suspend</button>`
        : `<button class="btn btn-secondary btn-sm" data-action="toggleStatus" data-id="${t.id}" data-arg="active">Activate</button>`;
      return `<tr><td>${t.id}</td><td>${name}</td><td>${esc(t.email)}</td><td>${esc(t.phone || '')}</td><td>${esc(t.section)}</td><td>${esc(t.employmentType)}</td><td>${statusBadge}</td><td>${suspendBtn}</td></tr>`;
    }).join('');
  }
  window.LMS.loadPersonnel = loadPersonnel;
  if (pf.form) {
    pf.name.addEventListener('input', renderPersonnel);
    [pf.section, pf.type, pf.status].forEach(el => el.addEventListener('change', renderPersonnel));
    pf.form.addEventListener('submit', ev => ev.preventDefault());
    pf.form.addEventListener('reset', () => setTimeout(renderPersonnel)); // after the browser clears the fields
  }
  loadPersonnel();

  window.toggleStatus = async function (id, status) {
    const { ok, data } = await api(`/admin/set-status/teacher/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    if (ok) {
      if (window.LMS.loadTeacherTable) window.LMS.loadTeacherTable();
      loadPersonnel();
    } else {
      toast(data.message || 'Failed to update status');
    }
  };
})();
