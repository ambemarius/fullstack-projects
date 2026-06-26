(function () {
  const TOKEN = localStorage.getItem('token');
  const ROLE = localStorage.getItem('role');
  if (!TOKEN || ROLE !== 'admin') {
    const currentPath = window.location.pathname;
    if (currentPath === '/admin-dashboard') {
      // Keep the user on the page during refreshes instead of force-jumping away.
      const welcomeMsg = document.getElementById('welcomeMsg');
      if (welcomeMsg) welcomeMsg.textContent = 'Please sign in again to continue.';
    }
    return;
  }

  // ----- Tab switching -----
  const tabs = document.querySelectorAll('.sidebar-tab');
  const panels = {
    home: document.getElementById('tab-home'),
    registration: document.getElementById('tab-registration'),
    finance: document.getElementById('tab-finance'),
    evaluation: document.getElementById('tab-evaluation'),
    personnel: document.getElementById('tab-personnel'),
  };
  const panelTitle = document.getElementById('panelTitle');

  function switchTab(tabName) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    Object.keys(panels).forEach(k => panels[k].classList.toggle('active', k === tabName));
    panelTitle.textContent = tabName.charAt(0).toUpperCase() + tabName.slice(1);
    location.hash = tabName;
    sessionStorage.setItem('adminTab', tabName);
  }

  tabs.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  // ----- Sidebar collapse on mobile -----
  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.querySelectorAll('.sidebar-tab').forEach(t => t.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  }));

  // ----- Logout -----
  function doLogout() { localStorage.clear(); sessionStorage.clear(); window.location.href = '/login'; }
  document.getElementById('sidebarLogout')?.addEventListener('click', doLogout);
  document.getElementById('topLogout')?.addEventListener('click', doLogout);

  // ----- Load profile -----
  const adminInfo = document.getElementById('adminInfo');
  const welcomeMsg = document.getElementById('welcomeMsg');
  async function loadProfile() {
    const { ok, data } = await api('/admin/profile');
    if (ok) {
      const name = data.data.name || data.data.email;
      adminInfo.textContent = name;
      welcomeMsg.innerHTML = `Welcome, <strong>${esc(name)}</strong>!`;
    } else {
      adminInfo.textContent = 'Could not load profile';
    }
  }
  loadProfile();

  // ----- Load stats -----
  async function loadStats() {
    const { ok, data } = await api('/admin/stats');
    if (ok && data.data) {
      document.getElementById('statTeachers').textContent = data.data.teachers ?? 0;
      document.getElementById('statStudents').textContent = data.data.students ?? 0;
      document.getElementById('statSubjects').textContent = data.data.subjects ?? 0;
      document.getElementById('statClasses').textContent = data.data.classes ?? 0;
    }
  }
  loadStats();

  // ===== REGISTRATION: SUB-TAB SWITCHING =====
  const regSubtabs = document.querySelectorAll('.reg-subtab');
  const regSubpanels = {
    student: document.getElementById('sub-student'),
    teacher: document.getElementById('sub-teacher'),
    subject: document.getElementById('sub-subject'),
    classes: document.getElementById('sub-classes'),
    auxiliary: document.getElementById('sub-auxiliary'),
    'academic-years': document.getElementById('sub-academic-years'),
  };

  regSubtabs.forEach(btn => {
    btn.addEventListener('click', () => {
      regSubtabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.keys(regSubpanels).forEach(k => regSubpanels[k].classList.toggle('active', k === btn.dataset.sub));
      location.hash = 'registration/' + btn.dataset.sub;
      sessionStorage.setItem('adminTab', 'registration');
      sessionStorage.setItem('adminSubTab', btn.dataset.sub);
    });
  });

  // ===== STUDENT: Load classes dropdown =====
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

  // ===== STUDENT: Load academic year options =====
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

  // ===== STUDENT: Fees total calculator =====
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

  // ===== STUDENT: Submit form (Create / Update) =====
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

  // ===== STUDENT: Load table =====
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

  // ===== STUDENT: Inline Action Handlers =====
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
    // Accepting student: resets isWithdrawn status back to active (false)
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

  // ===== STUDENT: Search =====
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

  // ===== STUDENT: Action Bar =====
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


  // ===== TEACHER: Load table =====
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
        <td>${esc(t.email)}</td>
        <td>${esc(t.phone || '')}</td>
        <td>${esc(t.section)}</td>
        <td>${esc(t.employmentType)}</td>
        <td><span class="badge ${t.status === 'active' ? 'no' : 'yes'}">${esc(t.status)}</span></td>
        <td class="action-col">
          <button type="button" class="action-btn edit" onclick="event.stopPropagation(); editTeacher(${t.id})" title="Edit Teacher">📝</button>
          <button type="button" class="action-btn delete" onclick="event.stopPropagation(); deleteTeacher(${t.id})" title="Delete Teacher">❌</button>
          <button type="button" class="action-btn accept" onclick="event.stopPropagation(); acceptTeacher(${t.id})" style="${acceptStyle}" title="${acceptTitle}">✅</button>
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

  // ===== TEACHER: Submit form (Create / Update) =====
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
      loadPersonnel();
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

  // ===== TEACHER: Inline Action Handlers =====
  window.editTeacher = async function (id) {
    const { ok, data } = await api(`/teachers/${id}`);
    if (!ok || !data.data) { alert('Failed to fetch teacher details.'); return; }
    fillTeacherForm(data.data);
    switchTab('registration');
    document.querySelector('.reg-subtab[data-sub="teacher"]').click();
    document.getElementById('teacherForm').scrollIntoView({ behavior: 'smooth' });
  };

  window.inlineEditTeacher = async function (id) {
    const { ok, data } = await api(`/teachers/${id}`);
    if (!ok || !data.data) { alert('Failed to fetch teacher details.'); return; }
    fillTeacherForm(data.data);
    selectedTeacherId = data.data.id;
    highlightTeacherRow(selectedTeacherId);
  };

  window.deleteTeacher = async function (id) {
    if (!confirm('Are you sure you want to permanently delete this teacher?')) return;
    const { ok, data } = await api(`/teachers/${id}`, { method: 'DELETE' });
    if (ok) {
      loadTeacherTable();
      loadPersonnel();
      loadStats();
    } else {
      alert(data.message || 'Failed to delete teacher.');
    }
  };

  window.acceptTeacher = async function (id) {
    const { ok, data } = await api(`/admin/set-status/teacher/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'active' }),
    });
    if (ok) {
      loadTeacherTable();
      loadPersonnel();
      alert('Teacher accepted and activated successfully!');
    } else {
      alert(data.message || 'Failed to accept teacher.');
    }
  };

  // ===== TEACHER: Search =====
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

  // ===== TEACHER: Action Bar =====
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
        alert('Select a teacher first.');
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
        alert('Select a teacher first.');
        return;
      }
    }
    await deleteTeacher(selectedTeacherId);
    selectedTeacherId = null;
    highlightTeacherRow(null);
  });


  // ===== SUBJECT: Load table =====
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
          <button type="button" class="action-btn edit" onclick="editSubject(${s.id})" title="Edit Subject">📝</button>
          <button type="button" class="action-btn delete" onclick="deleteSubject(${s.id})" title="Delete Subject">❌</button>
          <button type="button" class="action-btn accept" onclick="acceptSubject(${s.id})" title="Accept Subject">✅</button>
        </td>
      </tr>`;
    }).join('');
  }

  // ===== SUBJECT: Submit form (Create / Update) =====
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

  // ===== SUBJECT: Inline Action Handlers =====
  window.editSubject = async function (id) {
    const { ok, data } = await api(`/subjects/${id}`);
    if (!ok || !data.data) { alert('Failed to fetch subject details.'); return; }
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

    switchTab('registration');
    document.querySelector('.reg-subtab[data-sub="subject"]').click();
    document.getElementById('subjectForm').scrollIntoView({ behavior: 'smooth' });
  };

  window.deleteSubject = async function (id) {
    if (!confirm('Are you sure you want to permanently delete this subject?')) return;
    const { ok, data } = await api(`/subjects/${id}`, { method: 'DELETE' });
    if (ok) {
      loadSubjectTable();
      loadStats();
    } else {
      alert(data.message || 'Failed to delete subject.');
    }
  };

  window.acceptSubject = function (id) {
    alert('Subject entry accepted successfully!');
  };

  // ===== SUBJECT: Search =====
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


  // ===== CLASSES SUB-TAB: Class Management =====
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
          <button type="button" class="action-btn edit" onclick="event.stopPropagation(); inlineEditClass(${c.id})" title="Edit Class Details">📝</button>
          <button type="button" class="action-btn delete" onclick="event.stopPropagation(); inlineDeleteClass(${c.id})" title="Reset/Clear Class">❌</button>
          <button type="button" class="action-btn accept" onclick="event.stopPropagation(); inlineAcceptClass(${c.id})" title="Accept/Save Class">✅</button>
        </td>
      </tr>`;
    }).join('');

    document.querySelectorAll('.reg-table-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = parseInt(row.dataset.id);
        selectClass(id);
      });
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
    if (!confirm('Remove class master and reset fees for this class?')) return;
    const body = { class_master_id: null, registration_fee: 0, tuition_fee: 0, pta_fee: 0, caution_fee: 0, practicals_fee: 0, option_name: null };
    const { ok } = await api(`/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
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
    const total = r + t + p + c + pr;
    const el = document.getElementById('regFeesTotal');
    if (el) el.textContent = total.toLocaleString() + ' XAF';
  }

  document.querySelectorAll('#sub-classes .reg-fee-input').forEach(el => {
    el.addEventListener('input', updateClassFeesTotal);
  });

  document.getElementById('regSaveBtn')?.addEventListener('click', async () => {
    const id = parseInt(document.getElementById('regClassId').value);
    if (!id) { alert('Select a class from the table first.'); return; }
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
    const { ok } = await api(`/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (ok) {
      await loadClassesForReg();
      selectClass(id);
      alert('Class fees and master updated and accepted!');
    } else {
      alert('Failed to save class updates.');
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
      c.section.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.class_master_name || '').toLowerCase().includes(q) ||
      (c.option_name || '').toLowerCase().includes(q)
    );
    renderClassTable(filtered);
  });

  document.getElementById('regEditBtn')?.addEventListener('click', () => {
    const firstRow = document.querySelector('.reg-table-row');
    if (firstRow) selectClass(parseInt(firstRow.dataset.id));
  });

  document.getElementById('regDeleteBtn')?.addEventListener('click', () => {
    if (!selectedClassId) { alert('Select a class first.'); return; }
    inlineDeleteClass(selectedClassId);
  });


  // ===== AUXILIARY STAFF: Load table =====
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
          <button type="button" class="action-btn edit" onclick="editAuxiliary(${s.id})" title="Edit Staff">📝</button>
          <button type="button" class="action-btn delete" onclick="deleteAuxiliary(${s.id})" title="Delete Staff">❌</button>
          <button type="button" class="action-btn accept" onclick="acceptAuxiliary(${s.id})" style="${acceptStyle}" title="${acceptTitle}">✅</button>
        </td>
      </tr>`;
    }).join('');
  }

  // ===== AUXILIARY STAFF: Submit form (Create / Update) =====
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

    const { ok, data } = await api(url, {
      method,
      body: JSON.stringify(body),
    });
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

  // ===== AUXILIARY STAFF: Inline Action Handlers =====
  window.editAuxiliary = async function (id) {
    const { ok, data } = await api(`/auxiliary/${id}`);
    if (!ok || !data.data) { alert('Failed to fetch staff details.'); return; }
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

    switchTab('registration');
    document.querySelector('.reg-subtab[data-sub="auxiliary"]').click();
    document.getElementById('auxiliaryForm').scrollIntoView({ behavior: 'smooth' });
  };

  window.deleteAuxiliary = async function (id) {
    if (!confirm('Are you sure you want to permanently delete this staff member?')) return;
    const { ok, data } = await api(`/auxiliary/${id}`, { method: 'DELETE' });
    if (ok) {
      loadAuxiliaryTable();
    } else {
      alert(data.message || 'Failed to delete staff.');
    }
  };

  window.acceptAuxiliary = async function (id) {
    const { ok, data } = await api(`/auxiliary/set-status/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'active' }),
    });
    if (ok) {
      loadAuxiliaryTable();
      alert('Auxiliary staff accepted and activated successfully!');
    } else {
      alert(data.message || 'Failed to accept staff.');
    }
  };

  // ===== AUXILIARY STAFF: Search =====
  document.getElementById('auxiliarySearch')?.addEventListener('input', function () {
    const q = this.value.toLowerCase().trim();
    if (!q) { renderAuxiliaryTable(allAuxiliaryList); return; }
    const filtered = allAuxiliaryList.filter(s => {
      const name = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const role = (s.role || '').toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q);
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
          <button type="button" class="action-btn accept" onclick="event.stopPropagation(); setCurrentAY(${y.id})" title="Set as Current" ${y.isCurrent ? 'disabled style="opacity:0.4"' : ''}>⭐</button>
          <button type="button" class="action-btn delete" onclick="event.stopPropagation(); deleteAY(${y.id})" title="Delete">❌</button>
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
    const body = { fromYear, toYear, isCurrent };

    const { ok, data } = await api(url, {
      method,
      body: JSON.stringify(body),
    });

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
    if (ok) {
      loadAcademicYears();
      alert('Academic year set as current.');
    } else {
      alert(data.message || 'Failed to set current year.');
    }
  };

  window.deleteAY = async function (id) {
    if (!confirm('Permanently delete this academic year?')) return;
    const { ok, data } = await api(`/academic-years/${id}`, { method: 'DELETE' });
    if (ok) {
      selectedAYId = null;
      highlightAYRow(null);
      loadAcademicYears();
    } else {
      alert(data.message || 'Failed to delete academic year.');
    }
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
      else { alert('Select a year first.'); return; }
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
      else { alert('Select a year first.'); return; }
    }
    await deleteAY(selectedAYId);
  });

  document.getElementById('aySearch')?.addEventListener('input', function () {
    const q = this.value.toLowerCase().trim();
    if (!q) { renderAcademicYears(allAcademicYearsList); return; }
    const filtered = allAcademicYearsList.filter(y => {
      const name = (y.name || '').toLowerCase();
      const range = `${y.fromYear}-${y.toYear}`.toLowerCase();
      return name.includes(q) || range.includes(q);
    });
    renderAcademicYears(filtered);
  });


  // ===== PERSONNEL =====
  async function loadPersonnel() {
    const tbody = document.getElementById('personnelRows');
    const { ok, data } = await api('/teachers');
    if (!ok || !data.data) {
      tbody.innerHTML = '<tr><td colspan="8" class="muted">Failed to load.</td></tr>';
      return;
    }
    tbody.innerHTML = data.data.map(t => {
      const name = esc([t.firstName, t.middleName, t.lastName].filter(Boolean).join(' '));
      const statusBadge = `<span class="badge ${t.status === 'active' ? 'no' : 'yes'}">${esc(t.status)}</span>`;
      const suspendBtn = t.status === 'active'
        ? `<button class="btn btn-secondary btn-sm" onclick="toggleStatus(${t.id},'suspended')">Suspend</button>`
        : `<button class="btn btn-secondary btn-sm" onclick="toggleStatus(${t.id},'active')">Activate</button>`;
      return `<tr><td>${t.id}</td><td>${name}</td><td>${esc(t.email)}</td><td>${esc(t.phone || '')}</td><td>${esc(t.section)}</td><td>${esc(t.employmentType)}</td><td>${statusBadge}</td><td>${suspendBtn}</td></tr>`;
    }).join('');
  }
  loadPersonnel();

  window.toggleStatus = async function (id, status) {
    const { ok, data } = await api(`/admin/set-status/teacher/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    if (ok) {
      loadTeacherTable();
      loadPersonnel();
    } else {
      alert(data.message || 'Failed to update status');
    }
  };

  // ----- Restore tab from sessionStorage on page load -----
  (function activateFromStorage() {
    const tab = sessionStorage.getItem('adminTab') || 'home';
    if (panels[tab]) switchTab(tab);
    if (tab === 'registration') {
      const sub = sessionStorage.getItem('adminSubTab');
      if (sub) {
        const subBtn = document.querySelector(`.reg-subtab[data-sub="${sub}"]`);
        if (subBtn) subBtn.click();
      }
    }
    if (tab === 'evaluation') {
      const sub = sessionStorage.getItem('evalSubTab');
      if (sub) {
        const subBtn = document.querySelector(`#tab-evaluation .reg-subtab[data-sub="${sub}"]`);
        if (subBtn) subBtn.click();
      }
    }
  })();

  function gradeFromScore(score, maxScore) {
    if (score === null || score === undefined || maxScore === 0) return 'F';
    const pct = (score / maxScore) * 100;
    if (pct >= 91) return 'A';
    if (pct >= 81) return 'B';
    if (pct >= 71) return 'C';
    if (pct >= 61) return 'D';
    if (pct >= 51) return 'E';
    return 'F';
}

// ===== EVALUATION: SUB-TAB SWITCHING =====
  const evalSubtabs = document.querySelectorAll('#tab-evaluation .reg-subtab');
  const evalSubpanels = {
    marks: document.getElementById('sub-marks'),
    'course-review': document.getElementById('sub-course-review'),
    'report-cards': document.getElementById('sub-report-cards'),
  };

  evalSubtabs.forEach(btn => {
    btn.addEventListener('click', () => {
      evalSubtabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.keys(evalSubpanels).forEach(k => evalSubpanels[k].classList.toggle('active', k === btn.dataset.sub));
      sessionStorage.setItem('evalSubTab', btn.dataset.sub);
    });
  });

  // ===== EVALUATION: SHARED LOADERS =====
  async function loadEvalDropdowns() {
    const { ok: okY, data: years } = await api('/academic-years');
    if (okY && years.data) {
      ['mkYear', 'crYear', 'rcYear'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="">-- select --</option>';
        years.data.forEach(y => {
          const o = document.createElement('option');
          o.value = y.id;
          o.textContent = `${y.name} (${y.fromYear}-${y.toYear})`;
          sel.appendChild(o);
        });
        const cur = years.data.find(y => y.isCurrent === true || y.isCurrent === 1);
        if (cur) sel.value = String(cur.id);
      });
    }

    const { ok: okC, data: classes } = await api('/classes');
    if (okC && classes.data) {
      ['mkClass', 'crClass', 'rcClass'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="">-- select --</option>';
        classes.data.forEach(c => {
          const o = document.createElement('option');
          o.value = c.id;
          o.textContent = `${c.section} ${c.name}${c.stream ? ' (' + c.stream + ')' : ''}`;
          sel.appendChild(o);
        });
      });
    }

    const { ok: okS, data: subjects } = await api('/subjects');
    if (okS && subjects.data) {
      const sel = document.getElementById('mkSubject');
      if (sel) {
        sel.innerHTML = '<option value="">-- select --</option>';
        subjects.data.forEach(s => {
          const o = document.createElement('option');
          o.value = s.id;
          o.textContent = `${s.code} — ${s.name}`;
          sel.appendChild(o);
        });
      }
      const crSel = document.getElementById('crSubject');
      if (crSel) {
        crSel.innerHTML = '<option value="">-- select --</option>';
        subjects.data.forEach(s => {
          const o = document.createElement('option');
          o.value = s.id;
          o.textContent = `${s.code} — ${s.name}`;
          crSel.appendChild(o);
        });
      }
    }
  }
  loadEvalDropdowns();

  function loadEvalSubjectsByClass(classId, targetId) {
    const sel = document.getElementById(targetId);
    if (!sel) return Promise.resolve();
    sel.innerHTML = '<option value="">-- select --</option>';
    if (!classId) return Promise.resolve();
    return api(`/classes/${classId}/subjects`).then(({ ok, data }) => {
      if (ok && data.data) {
        // rows are keyed: classSubjectId, subjectId, subject, code (one per teacher/term -> dedupe)
        const seen = new Set();
        data.data.forEach(s => {
          if (seen.has(s.classSubjectId)) return;
          seen.add(s.classSubjectId);
          const o = document.createElement('option');
          o.value = s.classSubjectId;
          o.textContent = `${s.code} — ${s.subject}`;
          sel.appendChild(o);
        });
      }
    });
  }

  // ===== MARKS ENTRY =====
  let marksStudents = [];
  let selectedClassSubjectId = null;

  document.getElementById('mkClass')?.addEventListener('change', function () {
    selectedClassSubjectId = null;
    loadEvalSubjectsByClass(this.value, 'mkSubject').then(() => {
      document.getElementById('marksTableWrap').style.display = 'none';
      document.getElementById('mkSaveBtn').disabled = true;
    });
  });

  document.getElementById('mkSubject')?.addEventListener('change', function () {
    if (!this.value) {
      selectedClassSubjectId = null;
      document.getElementById('marksTableWrap').style.display = 'none';
      document.getElementById('mkSaveBtn').disabled = true;
    } else {
      selectedClassSubjectId = this.value;
    }
  });

  document.getElementById('mkLoadBtn')?.addEventListener('click', async () => {
    const classId = document.getElementById('mkClass').value;
    const subjectId = document.getElementById('mkSubject').value;
    const yearId = document.getElementById('mkYear').value;
    const term = document.getElementById('mkTerm').value;
    if (!classId || !subjectId || !yearId || !term) {
      alert('Select class, subject, year and term first.');
      return;
    }

    const { ok, data } = await api(`/marks/admin/students/${subjectId}/${term}/${yearId}`);
    if (!ok || !data.data) {
      document.getElementById('marksTableBody').innerHTML = '<tr><td colspan="5" class="reg-muted">Failed to load.</td></tr>';
      document.getElementById('marksTableWrap').style.display = 'block';
      return;
    }

    marksStudents = data.data;
    const maxScore = parseInt(document.getElementById('mkMaxScore').value) || 50;
    renderMarksTable(marksStudents, maxScore);
    document.getElementById('marksTableWrap').style.display = 'block';
    document.getElementById('mkSaveBtn').disabled = false;
    document.getElementById('mkMsg').textContent = '';
    document.getElementById('mkMsg').className = 'msg';
  });

  function renderMarksTable(students, maxScore) {
    const tbody = document.getElementById('marksTableBody');
    if (!students.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="reg-muted">No students found.</td></tr>';
      return;
    }
    tbody.innerHTML = students.map((s, i) => {
      const seq1 = s.seq1_score ?? '';
      const seq2 = s.seq2_score ?? '';
      return `<tr>
        <td>${i + 1}</td>
        <td>${esc([s.firstName, s.middleName, s.lastName].filter(Boolean).join(' '))}</td>
        <td>${esc(s.matricule)}</td>
        <td><input type="number" class="mk-score-input" data-student-id="${s.id}" data-seq="1" value="${seq1}" min="0" max="${maxScore}" step="0.01" style="width:90px" /></td>
        <td><input type="number" class="mk-score-input" data-student-id="${s.id}" data-seq="2" value="${seq2}" min="0" max="${maxScore}" step="0.01" style="width:90px" /></td>
      </tr>`;
    }).join('');
  }

  document.getElementById('mkSaveBtn')?.addEventListener('click', async () => {
    const classId = document.getElementById('mkClass').value;
    const subjectId = document.getElementById('mkSubject').value;
    const yearId = document.getElementById('mkYear').value;
    const term = document.getElementById('mkTerm').value;
    const seq = document.getElementById('mkSeq').value;
    const maxScore = parseInt(document.getElementById('mkMaxScore').value) || 50;

    if (!classId || !subjectId || !yearId || !term) {
      alert('Select class, subject, year and term first.');
      return;
    }

    const inputs = document.querySelectorAll('.mk-score-input');
    const scores = [];
    inputs.forEach(inp => {
      if (inp.dataset.seq !== seq) return;
      const val = parseFloat(inp.value);
      if (isNaN(val)) return;
      scores.push({ studentId: parseInt(inp.dataset.studentId), score: Math.min(val, maxScore), maxScore });
    });

    if (!scores.length) {
      alert('No scores to save for Sequence ' + seq + '.');
      return;
    }

    const { ok, data } = await api(`/marks/admin/save/${subjectId}/${term}/${seq}/${yearId}`, {
      method: 'POST',
      body: JSON.stringify({ scores }),
    });

    if (ok) {
      document.getElementById('mkMsg').textContent = data.message || 'Scores saved.';
      document.getElementById('mkMsg').className = 'msg ok';
    } else {
      document.getElementById('mkMsg').textContent = data.message || 'Failed to save scores.';
      document.getElementById('mkMsg').className = 'msg error';
    }
  });

  document.getElementById('mkExportBtn')?.addEventListener('click', () => {
    const rows = document.querySelectorAll('#marksTableBody tr');
    if (!rows.length) { alert('No data to export.'); return; }
    let csv = 'Student,Matricule,Sequence 1,Sequence 2\n';
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 4) return;
      const name = cells[1].textContent.trim();
      const matricule = cells[2].textContent.trim();
      const seq1 = cells[3].querySelector('input')?.value || '';
      const seq2 = cells[4].querySelector('input')?.value || '';
      csv += `"${name}","${matricule}",${seq1},${seq2}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marks_${document.getElementById('mkClass').value}_${document.getElementById('mkTerm').value}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('mkPrintBtn')?.addEventListener('click', () => {
    const wrap = document.getElementById('marksTableWrap');
    if (wrap.style.display === 'none') { alert('Load students first.'); return; }
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Marks Print</title><style>
      body{font-family:sans-serif;padding:20px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #333;padding:6px 10px;text-align:left}
      th{background:#1e3a8a;color:#fff}
    </style></head><body><h3>Marks Sheet</h3><table><thead><tr><th>#</th><th>Student</th><th>Matricule</th><th>Sequence 1</th><th>Sequence 2</th></tr></thead><tbody>`);
    document.querySelectorAll('#marksTableBody tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 4) return;
      win.document.write(`<tr><td>${cells[0].textContent}</td><td>${cells[1].textContent}</td><td>${cells[2].textContent}</td><td>${cells[3].querySelector('input')?.value || ''}</td><td>${cells[4].querySelector('input')?.value || ''}</td></tr>`);
    });
    win.document.write('</tbody></table></body></html>');
    win.document.close();
    win.print();
  });

  // ===== COURSE REVIEW =====
  let crAllEnrolled = [];
  let crAllUnenrolled = [];
  let crSelectedEnrolled = new Set();
  let crSelectedUnenrolled = new Set();

  async function loadCourseReview() {
    const classId = document.getElementById('crClass').value;
    const subjectId = document.getElementById('crSubject').value;
    const yearId = document.getElementById('crYear').value;
    if (!classId || !subjectId || !yearId) {
      document.getElementById('crSplit').style.display = 'none';
      document.getElementById('crActionBar').style.display = 'none';
      return;
    }

    const classSubjectId = await findClassSubjectId(classId, subjectId);
    if (!classSubjectId) {
      document.getElementById('crSplit').style.display = 'none';
      document.getElementById('crActionBar').style.display = 'none';
      return;
    }

    const { ok, data } = await api(`/class-subject-students/${classSubjectId}/${yearId}`);
    if (ok && data.data) {
      crAllEnrolled = data.data.enrolled || [];
      crAllUnenrolled = data.data.unenrolled || [];
      renderCrLists();
      document.getElementById('crSplit').style.display = 'grid';
      document.getElementById('crActionBar').style.display = 'flex';
    }
  }

  async function findClassSubjectId(classId, subjectId) {
    const { ok, data } = await api(`/classes/${classId}/subjects`);
    if (!ok || !data.data) return null;
    const found = data.data.find(s => s.subjectId == subjectId || s.id == subjectId);
    return found ? found.classSubjectId || found.id : null;
  }

  function renderCrLists() {
    const enrollTbody = document.getElementById('crEnrolledBody');
    const unenrollTbody = document.getElementById('crUnenrolledBody');
    const qEnrolled = (document.getElementById('crSearchEnrolled')?.value || '').toLowerCase().trim();
    const qUnenrolled = (document.getElementById('crSearchUnenrolled')?.value || '').toLowerCase().trim();

    crSelectedEnrolled.clear();
    crSelectedUnenrolled.clear();

    enrollTbody.innerHTML = crAllEnrolled.filter(s => {
      const name = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ').toLowerCase();
      return name.includes(qEnrolled) || (s.matricule || '').toLowerCase().includes(qEnrolled);
    }).map(s => `
      <tr data-id="${s.studentId}">
        <td><input type="checkbox" class="cr-enroll-chk" value="${s.studentId}" /></td>
        <td>${esc([s.firstName, s.middleName, s.lastName].filter(Boolean).join(' '))}</td>
        <td>${esc(s.matricule)}</td>
        <td>${esc(s.sex)}</td>
      </tr>
    `).join('');

    unenrollTbody.innerHTML = crAllUnenrolled.filter(s => {
      const name = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ').toLowerCase();
      return name.includes(qUnenrolled) || (s.matricule || '').toLowerCase().includes(qUnenrolled);
    }).map(s => `
      <tr data-id="${s.studentId}">
        <td><input type="checkbox" class="cr-unenroll-chk" value="${s.studentId}" /></td>
        <td>${esc([s.firstName, s.middleName, s.lastName].filter(Boolean).join(' '))}</td>
        <td>${esc(s.matricule)}</td>
        <td>${esc(s.sex)}</td>
      </tr>
    `).join('');
  }

  document.getElementById('crClass')?.addEventListener('change', () => {
    crSelectedEnrolled.clear();
    crSelectedUnenrolled.clear();
    loadEvalSubjectsByClass(document.getElementById('crClass').value, 'crSubject').then(() => loadCourseReview());
  });
  document.getElementById('crSubject')?.addEventListener('change', () => {
    crSelectedEnrolled.clear();
    crSelectedUnenrolled.clear();
    loadCourseReview();
  });
  document.getElementById('crYear')?.addEventListener('change', () => {
    crSelectedEnrolled.clear();
    crSelectedUnenrolled.clear();
    loadCourseReview();
  });

  document.getElementById('crEnrollSelectedBtn')?.addEventListener('click', async () => {
    const classId = document.getElementById('crClass').value;
    const subjectId = document.getElementById('crSubject').value;
    const yearId = document.getElementById('crYear').value;
    if (!classId || !subjectId || !yearId) { alert('Select class, subject and year.'); return; }
    const classSubjectId = await findClassSubjectId(classId, subjectId);
    if (!classSubjectId) return;
    const ids = Array.from(document.querySelectorAll('.cr-unenroll-chk:checked')).map(chk => parseInt(chk.value));
    if (!ids.length) { alert('Select students to enroll.'); return; }
    const { ok, data } = await api('/class-subject-students/bulk-enroll', {
      method: 'POST',
      body: JSON.stringify({ classSubjectId, academicYearId: parseInt(yearId), studentIds: ids }),
    });
    if (ok) {
      document.getElementById('crMsg').textContent = data.message;
      document.getElementById('crMsg').className = 'msg ok';
      loadCourseReview();
    } else {
      document.getElementById('crMsg').textContent = data.message;
      document.getElementById('crMsg').className = 'msg error';
    }
  });

  document.getElementById('crUnenrollSelectedBtn')?.addEventListener('click', async () => {
    const classId = document.getElementById('crClass').value;
    const subjectId = document.getElementById('crSubject').value;
    if (!classId || !subjectId) { alert('Select class and subject.'); return; }
    const classSubjectId = await findClassSubjectId(classId, subjectId);
    if (!classSubjectId) return;
    const ids = Array.from(document.querySelectorAll('.cr-enroll-chk:checked')).map(chk => parseInt(chk.value));
    if (!ids.length) { alert('Select students to unenroll.'); return; }
    const { ok, data } = await api('/class-subject-students/bulk-unenroll', {
      method: 'POST',
      body: JSON.stringify({ classSubjectId, studentIds: ids }),
    });
    if (ok) {
      document.getElementById('crMsg').textContent = data.message;
      document.getElementById('crMsg').className = 'msg ok';
      loadCourseReview();
    } else {
      document.getElementById('crMsg').textContent = data.message;
      document.getElementById('crMsg').className = 'msg error';
    }
  });

  document.getElementById('crEnrollAllBtn')?.addEventListener('click', async () => {
    const classId = document.getElementById('crClass').value;
    const subjectId = document.getElementById('crSubject').value;
    const yearId = document.getElementById('crYear').value;
    if (!classId || !subjectId || !yearId) { alert('Select class, subject and year.'); return; }
    const classSubjectId = await findClassSubjectId(classId, subjectId);
    if (!classSubjectId) return;
    const ids = crAllUnenrolled.map(s => s.studentId);
    if (!ids.length) { alert('No unenrolled students.'); return; }
    const { ok, data } = await api('/class-subject-students/bulk-enroll', {
      method: 'POST',
      body: JSON.stringify({ classSubjectId, academicYearId: parseInt(yearId), studentIds: ids }),
    });
    if (ok) {
      document.getElementById('crMsg').textContent = data.message;
      document.getElementById('crMsg').className = 'msg ok';
      loadCourseReview();
    } else {
      document.getElementById('crMsg').textContent = data.message;
      document.getElementById('crMsg').className = 'msg error';
    }
  });

  document.getElementById('crUnenrollAllBtn')?.addEventListener('click', async () => {
    const classId = document.getElementById('crClass').value;
    const subjectId = document.getElementById('crSubject').value;
    if (!classId || !subjectId) { alert('Select class and subject.'); return; }
    const classSubjectId = await findClassSubjectId(classId, subjectId);
    if (!classSubjectId) return;
    const ids = crAllEnrolled.map(s => s.studentId);
    if (!ids.length) { alert('No enrolled students.'); return; }
    const { ok, data } = await api('/class-subject-students/bulk-unenroll', {
      method: 'POST',
      body: JSON.stringify({ classSubjectId, studentIds: ids }),
    });
    if (ok) {
      document.getElementById('crMsg').textContent = data.message;
      document.getElementById('crMsg').className = 'msg ok';
      loadCourseReview();
    } else {
      document.getElementById('crMsg').textContent = data.message;
      document.getElementById('crMsg').className = 'msg error';
    }
  });

  document.getElementById('crSearchUnenrolled')?.addEventListener('input', () => renderCrLists());
  document.getElementById('crSearchEnrolled')?.addEventListener('input', () => renderCrLists());

  // ===== REPORT CARDS =====
  let reportCardData = null;

  document.getElementById('rcGenerateBtn')?.addEventListener('click', async () => {
    const classId = document.getElementById('rcClass').value;
    const term = document.getElementById('rcTerm').value;
    const yearId = document.getElementById('rcYear').value;
    if (!classId || !term || !yearId) { alert('Select class, term and year.'); return; }

    const { ok, data } = await api(`/report-cards/${classId}/${term}/${yearId}`);
    if (!ok || !data.data) {
      document.getElementById('rcMsg').textContent = data.message || 'Failed to generate report card.';
      document.getElementById('rcMsg').className = 'msg error';
      return;
    }

    reportCardData = data.data;
    renderReportCard(data.data);
    document.getElementById('reportCardOutput').style.display = 'block';
    document.getElementById('rcMsg').textContent = '';
    document.getElementById('rcMsg').className = 'msg';
  });

  function renderReportCard(data) {
    const students = data.students || [];
    const subjects = students[0]?.subjects || [];

    // Build header
    const thead = document.getElementById('rcThead');
    let headerHtml = '<tr><th>#</th><th>Name</th><th>Matricule</th><th>Sex</th>';
    subjects.forEach(sub => {
      headerHtml += `<th>${esc(sub.subjectCode)}<br/><span style="font-weight:400;font-size:10px">Avg</span></th>`;
    });
    headerHtml += '<th>Total<br/><span style="font-weight:400;font-size:10px">Coef</span></th>';
    headerHtml += '<th>Average</th><th>Grade</th><th>Position</th></tr>';
    thead.innerHTML = headerHtml;

    // Build body
    const tbody = document.getElementById('rcTbody');
    tbody.innerHTML = students.map((s, i) => {
      let row = `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td>${esc(s.matricule)}</td><td>${esc(s.sex)}</td>`;
      subjects.forEach(sub => {
        const found = s.subjects.find(x => x.classSubjectId === sub.classSubjectId);
        const avg = found?.avg ?? '';
        const grade = found?.grade ?? '';
        row += `<td style="text-align:center">${avg !== '' && avg !== null ? avg.toFixed(2) : '—'}</td>`;
      });
      const wt = s.totalCoefficient > 0 ? (s.weightedTotal / s.totalCoefficient).toFixed(2) : '—';
      const overallGrade = s.overallAvg !== null ? gradeFromScore(s.overallAvg, 100) : '—';
      row += `<td style="text-align:center">${wt}</td><td style="text-align:center">${overallGrade}</td><td style="text-align:center">${s.position}</td></tr>`;
      return row;
    }).join('');

    // Footer: class averages per subject
    const tfoot = document.getElementById('rcTfoot');
    let footHtml = '<tr><th colspan="4">Class Average</th>';
    subjects.forEach(sub => {
      const stat = (data.subjectAverages || []).find(x => x.classSubjectId === sub.classSubjectId);
      const avg = stat ? stat.classAvg.toFixed(2) : '—';
      footHtml += `<th style="text-align:center;background:#f1f5f9">${avg}</th>`;
    });
    footHtml += `<th style="text-align:center;background:#f1f5f9">${data.classGeneralAvg.toFixed(2)}</th><th></th><th></th></tr>`;
    tfoot.innerHTML = footHtml;

    // Update summary
    document.getElementById('rcSummary').textContent = `Class General Average: ${data.classGeneralAvg.toFixed(2)} | Enrolled: ${data.totalEnrolled} | Best: ${data.bestSubject?.subjectCode || '—'} | Worst: ${data.worstSubject?.subjectCode || '—'}`;

    // KPIs
    const kpis = document.getElementById('rcKPIs');
    kpis.innerHTML = `
      <div class="reg-kpi"><strong>Class General Average</strong><span>${data.classGeneralAvg.toFixed(2)}</span></div>
      <div class="reg-kpi"><strong>Total Enrolled</strong><span>${data.totalEnrolled}</span></div>
      <div class="reg-kpi"><strong>Best Subject</strong><span>${data.bestSubject ? `${data.bestSubject.subjectCode} (${data.bestSubject.classAvg.toFixed(2)})` : '—'}</span></div>
      <div class="reg-kpi"><strong>Worst Subject</strong><span>${data.worstSubject ? `${data.worstSubject.subjectCode} (${data.worstSubject.classAvg.toFixed(2)})` : '—'}</span></div>
    `;
  }

  document.getElementById('rcExportBtn')?.addEventListener('click', () => {
    if (!reportCardData) { alert('Generate report card first.'); return; }
    const students = reportCardData.students || [];
    const subjects = students[0]?.subjects || [];
    let csv = 'Position,Name,Matricule,Sex';
    subjects.forEach(sub => { csv += `,${sub.subjectCode} Avg`; });
    csv += ',Overall Avg,Grade\n';
    students.forEach(s => {
      const row = [s.position, s.name, s.matricule, s.sex];
      subjects.forEach(sub => {
        const found = s.subjects.find(x => x.classSubjectId === sub.classSubjectId);
        row.push(found?.avg !== null && found?.avg !== undefined ? found.avg.toFixed(2) : '');
      });
      row.push(s.overallAvg !== null ? s.overallAvg.toFixed(2) : '', gradeFromScore(s.overallAvg, 100));
      csv += row.map(v => `"${v}"`).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_card_${document.getElementById('rcClass').value}_${document.getElementById('rcTerm').value}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('rcPrintBtn')?.addEventListener('click', () => {
    if (!reportCardData) { alert('Generate report card first.'); return; }
    const win = window.open('', '_blank');
    const students = reportCardData.students || [];
    const subjects = students[0]?.subjects || [];
    win.document.write(`<html><head><title>Report Card</title><style>
      body{font-family:sans-serif;padding:20px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #333;padding:5px 8px;text-align:center}
      th{background:#1e3a8a;color:#fff}
      tfoot tr td{background:#f1f5f9;font-weight:700}
      h2{text-align:center}
    </style></head><body>
      <h2>Report Card — ${document.getElementById('rcTerm').value} Term</h2>
      <p><strong>Class General Average:</strong> ${reportCardData.classGeneralAvg.toFixed(2)} | <strong>Enrolled:</strong> ${reportCardData.totalEnrolled} | <strong>Best Subject:</strong> ${reportCardData.bestSubject?.subjectCode || '—'} | <strong>Worst Subject:</strong> ${reportCardData.worstSubject?.subjectCode || '—'}</p>
      <table><thead><tr><th>#</th><th>Name</th><th>Matricule</th><th>Sex</th>`);
    subjects.forEach(sub => {
      win.document.write(`<th>${sub.subjectCode}<br/>Avg</th>`);
    });
    win.document.write(`<th>Total</th><th>Grade</th><th>Position</th></tr></thead><tbody>`);
    students.forEach((s, i) => {
      win.document.write(`<tr><td>${i + 1}</td><td>${s.name}</td><td>${s.matricule}</td><td>${s.sex}</td>`);
      subjects.forEach(sub => {
        const found = s.subjects.find(x => x.classSubjectId === sub.classSubjectId);
        win.document.write(`<td>${found?.avg !== null && found?.avg !== undefined ? found.avg.toFixed(2) : '—'}</td>`);
      });
      const wt = s.totalCoefficient > 0 ? (s.weightedTotal / s.totalCoefficient).toFixed(2) : '—';
      const overallGrade = s.overallAvg !== null ? gradeFromScore(s.overallAvg, 100) : '—';
      win.document.write(`<td>${wt}</td><td>${overallGrade}</td><td>${s.position}</td></tr>`);
    });
    win.document.write(`</tbody><tfoot><tr><th colspan="4">Class Average</th>`);
    subjects.forEach(sub => {
      const stat = (reportCardData.subjectAverages || []).find(x => x.classSubjectId === sub.classSubjectId);
      win.document.write(`<th>${stat ? stat.classAvg.toFixed(2) : '—'}</th>`);
    });
    win.document.write(`<th>${reportCardData.classGeneralAvg.toFixed(2)}</th><th></th><th></th></tr></tfoot></table></body></html>`);
    win.document.close();
    win.print();
  });
})();
