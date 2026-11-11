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

  // ===== Fees total calculator =====
  function updateStudentFeesTotal() {
    let total = 0;
    document.querySelectorAll('.sf-amt').forEach(inp => {
      total += parseFloat(inp.value) || 0;
    });
    document.getElementById('studentFeesTotal').textContent = total.toLocaleString() + ' XAF';
  }
  document.querySelectorAll('.sf-amt').forEach(el => el.addEventListener('input', updateStudentFeesTotal));
  document.querySelectorAll('.sf-chk').forEach(el => {
    el.addEventListener('change', function () {
      const amt = document.querySelector(`.sf-amt[data-fee="${this.dataset.fee}"]`);
      if (amt) amt.disabled = !this.checked;
      updateStudentFeesTotal();
    });
  });

  // ===== Submit form (Create / Update) =====
  document.getElementById('studentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('studentFormMsg');
    msg.className = 'msg';

    const fees = [];
    document.querySelectorAll('.sf-chk').forEach(chk => {
      if (chk.checked) {
        const amt = document.querySelector(`.sf-amt[data-fee="${chk.dataset.fee}"]`);
        fees.push({ fee_type: chk.dataset.fee, amount: parseFloat(amt?.value) || 0, paid: true });
      }
    });

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
      fees,
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
    updateStudentFeesTotal();
    document.querySelectorAll('.sf-amt').forEach(a => a.disabled = false);
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
        <td>${esc(s.sex || '')}</td>
        <td>${esc(s.address || '')}</td>
        <td>${dob}</td>
        <td>${esc(s.regionOfOrigin || '')}</td>
        <td>${esc(s.division || '')}</td>
        <td>${esc(s.placeOfBirth || '')}</td>
        <td>${className}</td>
        <td>${esc(s.academicYearName || s.yearOfEnrollment || '')}</td>
        <td>${parentName}</td>
        <td>${parentPhone}</td>
        <td>${medical}</td>
        <td class="action-col">
          <button type="button" class="action-btn edit" onclick="event.stopPropagation(); editStudent(${s.id})" title="Edit Student">📝</button>
          <button type="button" class="action-btn delete" onclick="event.stopPropagation(); deleteStudent(${s.id})" title="Delete Student">❌</button>
          <button type="button" class="action-btn accept" onclick="event.stopPropagation(); acceptStudent(${s.id})" style="${acceptStyle}" title="${acceptTitle}">✅</button>
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

    document.querySelectorAll('.sf-chk').forEach(chk => {
      chk.checked = false;
      const amt = document.querySelector(`.sf-amt[data-fee="${chk.dataset.fee}"]`);
      if (amt) { amt.value = 0; amt.disabled = true; }
    });

    if (s.fees && Array.isArray(s.fees)) {
      s.fees.forEach(f => {
        const chk = document.querySelector(`.sf-chk[data-fee="${f.fee_type}"]`);
        const amt = document.querySelector(`.sf-amt[data-fee="${f.fee_type}"]`);
        if (chk && amt) {
          chk.checked = true;
          amt.value = f.amount;
          amt.disabled = false;
        }
      });
    }
    updateStudentFeesTotal();
  }

  // ===== Inline Action Handlers =====
  window.editStudent = async function (id) {
    const { ok, data } = await api(`/students/${id}`);
    if (!ok || !data.data) { alert('Failed to fetch student details.'); return; }
    fillStudentForm(data.data);
    switchTab('registration');
    document.querySelector('.reg-subtab[data-sub="student"]').click();
    document.getElementById('studentForm').scrollIntoView({ behavior: 'smooth' });
  };

  window.inlineEditStudent = async function (id) {
    const { ok, data } = await api(`/students/${id}`);
    if (!ok || !data.data) { alert('Failed to fetch student details.'); return; }
    fillStudentForm(data.data);
    selectedStudentId = data.data.id;
    highlightStudentRow(selectedStudentId);
  };

  window.deleteStudent = async function (id) {
    if (!confirm('Are you sure you want to permanently delete this student?')) return;
    const { ok, data } = await api(`/students/${id}`, { method: 'DELETE' });
    if (ok) {
      loadStudentTable();
      loadStats();
    } else {
      alert(data.message || 'Failed to delete student.');
    }
  };

  window.acceptStudent = async function (id) {
    const { ok, data } = await api(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ isWithdrawn: false }),
    });
    if (ok) {
      loadStudentTable();
      alert('Student accepted and activated successfully!');
    } else {
      alert(data.message || 'Failed to accept student.');
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
        alert('Select a student first.');
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
        alert('Select a student first.');
        return;
      }
    }
    await deleteStudent(selectedStudentId);
    selectedStudentId = null;
    highlightStudentRow(null);
  });
})();
