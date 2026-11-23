(function () {
  if (!window.LMS || !window.LMS.ready) return;
  const { switchTab, loadStats } = window.LMS;

  let allTeachersList = [];
  let selectedTeacherId = null;

  async function loadTeacherTable() {
    const tbody = document.getElementById('teacherTableBody');
    const { ok, data } = await api('/teachers');
    if (!ok || !data.data) {
      tbody.innerHTML = '<tr><td colspan="7" class="reg-muted">Failed to load.</td></tr>';
      return;
    }
    allTeachersList = data.data;
    renderTeacherTable(allTeachersList);
    document.getElementById('teacherCount').textContent = allTeachersList.length;
  }
  window.LMS.loadTeacherTable = loadTeacherTable;
  loadTeacherTable();

  function renderTeacherTable(teachers) {
    const tbody = document.getElementById('teacherTableBody');
    if (!teachers.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="reg-muted">No teachers found.</td></tr>';
      return;
    }
    tbody.innerHTML = teachers.map(t => {
      const name = esc([t.firstName, t.middleName, t.lastName].filter(Boolean).join(' '));
      const acceptStyle = t.status === 'active' ? 'color: #16a34a' : 'color: #dc2626';
      const acceptTitle = t.status === 'active' ? 'Teacher Active' : 'Accept/Activate Teacher';

      return `<tr data-id="${t.id}">
        <td>${name}</td>
        <td class="col-secondary">${esc(t.email)}</td>
        <td class="col-secondary">${esc(t.phone || '')}</td>
        <td>${esc(t.section)}</td>
        <td class="col-secondary">${esc(t.employmentType)}</td>
        <td><span class="badge ${t.status === 'active' ? 'no' : 'yes'}">${esc(t.status)}</span></td>
        <td class="action-col">
          <button type="button" class="action-btn edit" data-action="editTeacher" data-id="${t.id}" aria-label="Edit Teacher">Edit</button>
          <button type="button" class="action-btn delete" data-action="deleteTeacher" data-id="${t.id}" aria-label="Delete Teacher">Delete</button>
          <button type="button" class="action-btn accept" data-action="acceptTeacher" data-id="${t.id}" style="${acceptStyle}" aria-label="${acceptTitle}">Accept</button>
        </td>
      </tr>`;
    }).join('');

    document.querySelectorAll('#teacherTableBody tr[data-id]').forEach(row => {
      row.addEventListener('click', () => {
        selectedTeacherId = parseInt(row.dataset.id);
        highlightTeacherRow(selectedTeacherId);
      });
    });
  }

  function highlightTeacherRow(id) {
    document.querySelectorAll('#teacherTableBody tr').forEach(r => r.classList.remove('selected'));
    const row = document.querySelector(`#teacherTableBody tr[data-id="${id}"]`);
    if (row) row.classList.add('selected');
  }

  // ===== Submit form (Create / Update) =====
  document.getElementById('teacherForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('teacherFormMsg');
    msg.className = 'msg';

    const body = {
      firstName: document.getElementById('tFirstName').value.trim(),
      middleName: document.getElementById('tMiddleName').value.trim(),
      lastName: document.getElementById('tLastName').value.trim(),
      email: document.getElementById('tEmail').value.trim(),
      phone: document.getElementById('tPhone').value.trim(),
      section: document.getElementById('tSection').value,
      employmentType: document.getElementById('tEmpType').value,
      status: document.getElementById('tStatus').value,
      address: document.getElementById('tAddress').value.trim(),
      idCardNo: document.getElementById('tIdCard').value.trim(),
      dateOfIssue: document.getElementById('tDateOfIssue').value || null,
      gender: document.getElementById('tGender').value,
      civilStatus: document.getElementById('tCivilStatus').value,
      noOfChildren: document.getElementById('tNoOfChildren').value ? Number(document.getElementById('tNoOfChildren').value) : 0,
      telephone: document.getElementById('tTelephone').value.trim(),
      matriculeFile: document.getElementById('tMatriculeFile').value.trim(),
      secondaryContactName: document.getElementById('tSecContactName').value.trim(),
      secondaryContactPhone: document.getElementById('tSecContactPhone').value.trim(),
    };

    const passwordVal = document.getElementById('tPassword').value;
    if (passwordVal) {
      body.password = passwordVal;
    }

    const editId = document.getElementById('teacherEditId').value;
    const url = editId ? `/teachers/${editId}` : '/teachers/register';
    const method = editId ? 'PUT' : 'POST';

    const { ok, data } = await api(url, {
      method,
      body: JSON.stringify(body),
    });
    if (ok) {
      msg.textContent = editId ? 'Teacher updated successfully!' : 'Teacher created successfully!';
      msg.className = 'msg ok';
      resetTeacherForm();
      loadTeacherTable();
      if (window.LMS.loadPersonnel) window.LMS.loadPersonnel();
      loadStats();
    } else {
      msg.textContent = data.message || 'Failed to submit teacher form.';
      msg.className = 'msg error';
    }
  });

  function resetTeacherForm() {
    document.getElementById('teacherForm').reset();
    document.getElementById('teacherEditId').value = '';
    document.getElementById('teacherHeaderBar').textContent = 'Register New Teacher';
    document.getElementById('teacherSubmitBtn').textContent = 'Create Teacher';
    document.getElementById('tPassword').required = true;
    document.getElementById('tSection').value = '';
    document.getElementById('tEmpType').value = '';
    document.getElementById('tStatus').value = 'active';
    document.getElementById('tNoOfChildren').value = 0;
  }

  function fillTeacherForm(t) {
    document.getElementById('teacherEditId').value = t.id;
    document.getElementById('teacherHeaderBar').textContent = `Edit Teacher: ${[t.firstName, t.lastName].filter(Boolean).join(' ')}`;
    document.getElementById('teacherSubmitBtn').textContent = 'Accept Changes';
    document.getElementById('tPassword').required = false;
    document.getElementById('tPassword').value = '';

    document.getElementById('tFirstName').value = t.firstName || '';
    document.getElementById('tMiddleName').value = t.middleName || '';
    document.getElementById('tLastName').value = t.lastName || '';
    document.getElementById('tEmail').value = t.email || '';
    document.getElementById('tPhone').value = t.phone || '';
    document.getElementById('tGender').value = t.gender || '';
    document.getElementById('tCivilStatus').value = t.civilStatus || '';
    document.getElementById('tNoOfChildren').value = t.noOfChildren ?? 0;
    document.getElementById('tAddress').value = t.address || '';
    document.getElementById('tSection').value = t.section || '';
    document.getElementById('tEmpType').value = t.employmentType || '';
    document.getElementById('tStatus').value = t.status || 'active';
    document.getElementById('tIdCard').value = t.idCardNo || '';
    document.getElementById('tDateOfIssue').value = t.dateOfIssue ? String(t.dateOfIssue).slice(0, 10) : '';
    document.getElementById('tMatriculeFile').value = t.matriculeFile || t.matricule || '';
    document.getElementById('tTelephone').value = t.telephone || '';
    document.getElementById('tSecContactName').value = t.secondaryContactName || '';
    document.getElementById('tSecContactPhone').value = t.secondaryContactPhone || '';
  }

  // ===== Inline Action Handlers =====
  window.editTeacher = async function (id) {
    const { ok, data } = await api(`/teachers/${id}`);
    if (!ok || !data.data) { toast('Failed to fetch teacher details.'); return; }
    fillTeacherForm(data.data);
    switchTab('registration');
    document.querySelector('.reg-subtab[data-sub="teacher"]').click();
    document.getElementById('teacherForm').scrollIntoView({ behavior: 'smooth' });
  };

  window.inlineEditTeacher = async function (id) {
    const { ok, data } = await api(`/teachers/${id}`);
    if (!ok || !data.data) { toast('Failed to fetch teacher details.'); return; }
    fillTeacherForm(data.data);
    selectedTeacherId = data.data.id;
    highlightTeacherRow(selectedTeacherId);
  };

  window.deleteTeacher = async function (id) {
    const teacher = allTeachersList.find(t => t.id === id);
    const teacherLabel = teacher ? `${[teacher.firstName, teacher.middleName, teacher.lastName].filter(Boolean).join(' ')} (${teacher.email})` : 'this teacher';
    if (!confirm(`Delete ${teacherLabel}? Their teaching assignments will be removed. This cannot be undone.`)) return;
    const { ok, data } = await api(`/teachers/${id}`, { method: 'DELETE' });
    if (ok) {
      loadTeacherTable();
      if (window.LMS.loadPersonnel) window.LMS.loadPersonnel();
      loadStats();
    } else {
      toast(data.message || 'Failed to delete teacher.');
    }
  };

  window.acceptTeacher = async function (id) {
    const { ok, data } = await api(`/admin/set-status/teacher/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'active' }),
    });
    if (ok) {
      loadTeacherTable();
      if (window.LMS.loadPersonnel) window.LMS.loadPersonnel();
      toast('Teacher accepted and activated successfully!');
    } else {
      toast(data.message || 'Failed to accept teacher.');
    }
  };

  // ===== Search =====
  document.getElementById('teacherSearch')?.addEventListener('input', function () {
    const q = this.value.toLowerCase().trim();
    if (!q) { renderTeacherTable(allTeachersList); return; }
    const filtered = allTeachersList.filter(t => {
      const name = [t.firstName, t.middleName, t.lastName].filter(Boolean).join(' ').toLowerCase();
      const email = (t.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
    renderTeacherTable(filtered);
  });

  // ===== Action Bar =====
  document.getElementById('teacherResetBtn')?.addEventListener('click', () => {
    resetTeacherForm();
    selectedTeacherId = null;
    highlightTeacherRow(null);
  });

  document.getElementById('teacherEditBtn')?.addEventListener('click', () => {
    if (!selectedTeacherId) {
      const firstRow = document.querySelector('#teacherTableBody tr[data-id]');
      if (firstRow) {
        selectedTeacherId = parseInt(firstRow.dataset.id);
      } else {
        toast('Select a teacher first.');
        return;
      }
    }
    inlineEditTeacher(selectedTeacherId);
  });

  document.getElementById('teacherSaveBtn')?.addEventListener('click', () => {
    document.getElementById('teacherForm').dispatchEvent(new Event('submit'));
  });

  document.getElementById('teacherDeleteBtn')?.addEventListener('click', async () => {
    if (!selectedTeacherId) {
      const firstRow = document.querySelector('#teacherTableBody tr[data-id]');
      if (firstRow) {
        selectedTeacherId = parseInt(firstRow.dataset.id);
      } else {
        toast('Select a teacher first.');
        return;
      }
    }
    await deleteTeacher(selectedTeacherId);
    selectedTeacherId = null;
    highlightTeacherRow(null);
  });
})();
