(function () {
  if (!window.LMS || !window.LMS.ready) return;
  const { switchTab, loadStats } = window.LMS;

  // ===== Load classes dropdown =====
  async function loadStudentClasses() {
    const { ok, data } = await api('/classes');
    if (ok && data.data) {
      const sel = document.getElementById('sClass');
      sel.innerHTML = '<option value="">-- select --</option>';
      data.data.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = `${c.name}${c.stream ? ' (' + c.stream + ')' : ''} — ${c.section}`;
        sel.appendChild(o);
      });
    }
  }
  loadStudentClasses();

  // ===== Load academic year options =====
  async function loadAcademicYearOptions() {
    const { ok, data } = await api('/academic-years');
    if (ok && data.data) {
      const sel = document.getElementById('sAcademicYear');
      sel.innerHTML = '<option value="">-- select academic year --</option>';
      data.data.forEach(y => {
        const o = document.createElement('option');
        o.value = y.id;
        o.textContent = `${y.name} (${y.fromYear} - ${y.toYear})${y.isCurrent ? ' [Current]' : ''}`;
        sel.appendChild(o);
      });
      const currentYear = data.data.find(y => y.isCurrent === true || y.isCurrent === 1);
      if (currentYear) sel.value = String(currentYear.id);
    }
  }
  loadAcademicYearOptions();

  // ===== Fees: Finance is the record; the form only shows the student's balance =====
  async function showStudentFinance(studentId) {
    const summary = document.getElementById('studentFinanceSummary');
    const note = document.getElementById('studentFinanceNote');
    const link = document.getElementById('studentFinanceLink');
    if (!summary) return;
    if (!studentId) {
      summary.hidden = true;
      note.textContent = 'Fees are charged and paid in Finance. After saving, charge this student there, or charge the whole class from its fee schedule.';
      link.href = '/finance';
      link.textContent = 'Open Finance';
      return;
    }
    link.href = '/finance/statements?student=' + encodeURIComponent(studentId);
    link.textContent = 'Open this student’s statement';
    try {
      const res = await fetch('/finance/balance/' + encodeURIComponent(studentId), {
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('token') || '') },
      });
      if (!res.ok) throw new Error();
      const b = (await res.json()).data;
      document.getElementById('sfCharged').textContent = b.charged;
      document.getElementById('sfPaid').textContent = b.paid;
      document.getElementById('sfBalance').textContent = b.balance;
      document.getElementById('sfOverdue').textContent = b.overdue;
      note.textContent = b.charges ? `${b.charges} active charge(s) in Finance.` : 'No charges recorded in Finance yet.';
      summary.hidden = false;
    } catch (_) {
      summary.hidden = true;
      note.textContent = 'The finance balance could not be loaded. Open Finance to see this student’s charges.';
    }
  }

  // ===== Submit form (Create / Update) =====
  document.getElementById('studentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('studentFormMsg');
    msg.className = 'msg';

    const body = {
      firstName: document.getElementById('sFirstName').value,
      middleName: document.getElementById('sMiddleName').value,
      lastName: document.getElementById('sLastName').value,
      sex: document.getElementById('sSex').value,
      dateOfBirth: document.getElementById('sDob').value || null,
      placeOfBirth: document.getElementById('sPlaceOfBirth').value,
      regionOfOrigin: document.getElementById('sRegion').value,
      division: document.getElementById('sDivision').value,
      address: document.getElementById('sAddress').value,
      yearOfEnrollment: parseInt(document.getElementById('sAcademicYear').selectedOptions[0]?.textContent.match(/\d{4}/)?.[0]) || null,
      academicYearId: parseInt(document.getElementById('sAcademicYear').value) || null,
      currentClassLevel: parseInt(document.getElementById('sClass').value) || null,
      section: document.getElementById('sSection').value,
      matricule: document.getElementById('sMatricule').value,
      password: document.getElementById('sPassword').value || undefined,
      parentName: document.getElementById('sParentName').value,
      parentPhone: document.getElementById('sParentPhone').value,
      parentPhone2: document.getElementById('sParentPhone2')?.value || '',
      medicalStatus: document.getElementById('sMedicalStatus').value,
    };

    const editId = document.getElementById('studentEditId').value;
    const url = editId ? `/students/${editId}` : '/students/register';
    const method = editId ? 'PUT' : 'POST';

    const { ok, data } = await api(url, {
      method,
      body: JSON.stringify(body),
    });

    if (ok) {
      msg.textContent = editId ? 'Student updated successfully!' : 'Student registered successfully!';
      msg.className = 'msg ok';
      resetStudentForm();
      loadStudentTable();
      loadStats();
    } else {
      msg.textContent = data.message || 'Failed to submit student form.';
      msg.className = 'msg error';
    }
  });

  function resetStudentForm() {
    document.getElementById('studentForm').reset();
    document.getElementById('studentEditId').value = '';
    document.getElementById('studentHeaderBar').textContent = 'Register New Student';
    document.getElementById('studentSubmitBtn').textContent = 'Register Student';
    document.getElementById('sPassword').required = true;
    showStudentFinance(null);
  }

  // ===== Load table =====
  let allStudents = [];
  let selectedStudentId = null;

  async function loadStudentTable() {
    const tbody = document.getElementById('studentTableBody');
    const { ok, data } = await api('/students');
    if (!ok || !data.data) {
      tbody.innerHTML = '<tr><td colspan="14" class="reg-muted">Failed to load.</td></tr>';
      return;
    }
    allStudents = data.data;
    renderStudentTable(allStudents);
    document.getElementById('studentCount').textContent = allStudents.length;
  }
  loadStudentTable();

  function renderStudentTable(students) {
    const tbody = document.getElementById('studentTableBody');
    if (!students.length) {
      tbody.innerHTML = '<tr><td colspan="14" class="reg-muted">No students found.</td></tr>';
      return;
    }
    tbody.innerHTML = students.map(s => {
      const name = esc([s.firstName, s.middleName, s.lastName].filter(Boolean).join(' '));
      const parentName = esc(s.parentName || '');
      const parentPhone = esc(s.parentPhone || '');
      const medical = esc(s.medicalStatus || '');
      const className = s.className ? esc(s.className) + (s.classStream ? ' (' + esc(s.classStream) + ')' : '') : '—';
      const dob = s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : '—';

      const acceptStyle = s.isWithdrawn ? 'color: #dc2626' : 'color: #16a34a';
      const acceptTitle = s.isWithdrawn ? 'Accept/Activate Student' : 'Student Accepted (Active)';

      return `<tr data-id="${s.id}">
        <td>${esc(s.matricule)}</td>
        <td>${name}</td>
        <td class="col-secondary">${esc(s.sex || '')}</td>
        <td class="col-secondary">${esc(s.address || '')}</td>
        <td class="col-secondary">${dob}</td>
        <td class="col-secondary">${esc(s.regionOfOrigin || '')}</td>
        <td class="col-secondary">${esc(s.division || '')}</td>
        <td class="col-secondary">${esc(s.placeOfBirth || '')}</td>
        <td>${className}</td>
        <td class="col-secondary">${esc(s.academicYearName || s.yearOfEnrollment || '')}</td>
        <td class="col-secondary">${parentName}</td>
        <td class="col-secondary">${parentPhone}</td>
        <td class="col-secondary">${medical}</td>
        <td class="action-col">
          <button type="button" class="action-btn edit" data-action="editStudent" data-id="${s.id}" aria-label="Edit Student">Edit</button>
          <button type="button" class="action-btn delete" data-action="deleteStudent" data-id="${s.id}" aria-label="Delete Student">Delete</button>
          <button type="button" class="action-btn accept" data-action="acceptStudent" data-id="${s.id}" style="${acceptStyle}" aria-label="${acceptTitle}">Accept</button>
        </td>
      </tr>`;
    }).join('');

    document.querySelectorAll('#studentTableBody tr[data-id]').forEach(row => {
      row.addEventListener('click', () => {
        selectedStudentId = parseInt(row.dataset.id);
        highlightStudentRow(selectedStudentId);
      });
    });
  }

  function highlightStudentRow(id) {
    document.querySelectorAll('#studentTableBody tr').forEach(r => r.classList.remove('selected'));
    const row = document.querySelector(`#studentTableBody tr[data-id="${id}"]`);
    if (row) row.classList.add('selected');
  }

  function fillStudentForm(s) {
    document.getElementById('studentEditId').value = s.id;
    document.getElementById('studentHeaderBar').textContent = `Edit Student: ${[s.firstName, s.lastName].filter(Boolean).join(' ')}`;
    document.getElementById('studentSubmitBtn').textContent = 'Accept Changes';
    document.getElementById('sPassword').required = false;

    document.getElementById('sFirstName').value = s.firstName || '';
    document.getElementById('sMiddleName').value = s.middleName || '';
    document.getElementById('sLastName').value = s.lastName || '';
    document.getElementById('sSex').value = s.sex || '';
    document.getElementById('sDob').value = s.dateOfBirth ? s.dateOfBirth.split('T')[0] : '';
    document.getElementById('sPlaceOfBirth').value = s.placeOfBirth || '';
    document.getElementById('sRegion').value = s.regionOfOrigin || '';
    document.getElementById('sDivision').value = s.division || '';
    document.getElementById('sAddress').value = s.address || '';
    document.getElementById('sAcademicYear').value = s.academicYearId || '';
    document.getElementById('sClass').value = s.currentClassLevel || '';
    document.getElementById('sSection').value = s.section || 'Anglophone';
    document.getElementById('sMatricule').value = s.matricule || '';
    document.getElementById('sPassword').value = '';
    document.getElementById('sParentName').value = s.parentName || '';
    document.getElementById('sParentPhone').value = s.parentPhone || '';
    document.getElementById('sParentPhone2').value = s.parentPhone2 || '';
    document.getElementById('sMedicalStatus').value = s.medicalStatus || '';

    showStudentFinance(s.id);
  }

  // ===== Inline Action Handlers =====
  window.editStudent = async function (id) {
    const { ok, data } = await api(`/students/${id}`);
    if (!ok || !data.data) { toast('Failed to fetch student details.'); return; }
    fillStudentForm(data.data);
    switchTab('registration');
    document.querySelector('.reg-subtab[data-sub="student"]').click();
    document.getElementById('studentForm').scrollIntoView({ behavior: 'smooth' });
  };

  window.inlineEditStudent = async function (id) {
    const { ok, data } = await api(`/students/${id}`);
    if (!ok || !data.data) { toast('Failed to fetch student details.'); return; }
    fillStudentForm(data.data);
    selectedStudentId = data.data.id;
    highlightStudentRow(selectedStudentId);
  };

  window.deleteStudent = async function (id) {
    const student = allStudents.find(s => s.id === id);
    const studentLabel = student ? `${[student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ')} (${student.matricule})` : 'this student';
    if (!confirm(`Delete ${studentLabel}? Their marks and enrolment records will be removed. This cannot be undone.`)) return;
    const { ok, data } = await api(`/students/${id}`, { method: 'DELETE' });
    if (ok) {
      loadStudentTable();
      loadStats();
    } else {
      toast(data.message || 'Failed to delete student.');
    }
  };

  window.acceptStudent = async function (id) {
    const { ok, data } = await api(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ isWithdrawn: false }),
    });
    if (ok) {
      loadStudentTable();
      toast('Student accepted and activated successfully!');
    } else {
      toast(data.message || 'Failed to accept student.');
    }
  };

  // ===== Search =====
  document.getElementById('studentSearch')?.addEventListener('input', function () {
    const q = this.value.toLowerCase().trim();
    if (!q) { renderStudentTable(allStudents); return; }
    const filtered = allStudents.filter(s => {
      const name = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ').toLowerCase();
      const mat = (s.matricule || '').toLowerCase();
      const cls = (s.className || '').toLowerCase();
      return name.includes(q) || mat.includes(q) || cls.includes(q);
    });
    renderStudentTable(filtered);
  });

  // ===== Action Bar =====
  document.getElementById('studentResetBtn')?.addEventListener('click', () => {
    resetStudentForm();
    selectedStudentId = null;
    highlightStudentRow(null);
  });

  document.getElementById('studentEditBtn')?.addEventListener('click', () => {
    if (!selectedStudentId) {
      const firstRow = document.querySelector('#studentTableBody tr[data-id]');
      if (firstRow) {
        selectedStudentId = parseInt(firstRow.dataset.id);
      } else {
        toast('Select a student first.');
        return;
      }
    }
    inlineEditStudent(selectedStudentId);
  });

  document.getElementById('studentSaveBtn')?.addEventListener('click', () => {
    document.getElementById('studentForm').dispatchEvent(new Event('submit'));
  });

  document.getElementById('studentDeleteBtn')?.addEventListener('click', async () => {
    if (!selectedStudentId) {
      const firstRow = document.querySelector('#studentTableBody tr[data-id]');
      if (firstRow) {
        selectedStudentId = parseInt(firstRow.dataset.id);
      } else {
        toast('Select a student first.');
        return;
      }
    }
    await deleteStudent(selectedStudentId);
    selectedStudentId = null;
    highlightStudentRow(null);
  });
})();
