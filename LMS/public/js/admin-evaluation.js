(function () {
  if (!window.LMS || !window.LMS.ready) return;

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

  // ===== SHARED LOADERS =====
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

  if (!document.querySelector('[data-canonical-courses="true"]')) {
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
      toast('Select class, subject, year and term first.');
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
      toast('Select class, subject, year and term first.');
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
      toast('No scores to save for Sequence ' + seq + '.');
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
    if (!rows.length) { toast('No data to export.'); return; }
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
    if (wrap.style.display === 'none') { toast('Load students first.'); return; }
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
      win.document.write(`<tr><td>${esc(cells[0].textContent)}</td><td>${esc(cells[1].textContent)}</td><td>${esc(cells[2].textContent)}</td><td>${esc(cells[3].querySelector('input')?.value || '')}</td><td>${esc(cells[4].querySelector('input')?.value || '')}</td></tr>`);
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
  document.getElementById('crSubject')?.addEventListener('change', () => { crSelectedEnrolled.clear(); crSelectedUnenrolled.clear(); loadCourseReview(); });
  document.getElementById('crYear')?.addEventListener('change', () => { crSelectedEnrolled.clear(); crSelectedUnenrolled.clear(); loadCourseReview(); });

  document.getElementById('crEnrollSelectedBtn')?.addEventListener('click', async () => {
    const classId = document.getElementById('crClass').value;
    const subjectId = document.getElementById('crSubject').value;
    const yearId = document.getElementById('crYear').value;
    if (!classId || !subjectId || !yearId) { toast('Select class, subject and year.'); return; }
    const classSubjectId = await findClassSubjectId(classId, subjectId);
    if (!classSubjectId) return;
    const ids = Array.from(document.querySelectorAll('.cr-unenroll-chk:checked')).map(chk => parseInt(chk.value));
    if (!ids.length) { toast('Select students to enroll.'); return; }
    const { ok, data } = await api('/class-subject-students/bulk-enroll', { method: 'POST', body: JSON.stringify({ classSubjectId, academicYearId: parseInt(yearId), studentIds: ids }) });
    if (ok) { document.getElementById('crMsg').textContent = data.message; document.getElementById('crMsg').className = 'msg ok'; loadCourseReview(); }
    else { document.getElementById('crMsg').textContent = data.message; document.getElementById('crMsg').className = 'msg error'; }
  });

  document.getElementById('crUnenrollSelectedBtn')?.addEventListener('click', async () => {
    const classId = document.getElementById('crClass').value;
    const subjectId = document.getElementById('crSubject').value;
    if (!classId || !subjectId) { toast('Select class and subject.'); return; }
    const classSubjectId = await findClassSubjectId(classId, subjectId);
    if (!classSubjectId) return;
    const ids = Array.from(document.querySelectorAll('.cr-enroll-chk:checked')).map(chk => parseInt(chk.value));
    if (!ids.length) { toast('Select students to unenroll.'); return; }
    if (!confirm(`Unenroll ${ids.length} student(s) from this subject? They disappear from the teacher's mark sheet; marks already saved are kept.`)) return;
    const { ok, data } = await api('/class-subject-students/bulk-unenroll', { method: 'POST', body: JSON.stringify({ classSubjectId, studentIds: ids }) });
    if (ok) { document.getElementById('crMsg').textContent = data.message; document.getElementById('crMsg').className = 'msg ok'; loadCourseReview(); }
    else { document.getElementById('crMsg').textContent = data.message; document.getElementById('crMsg').className = 'msg error'; }
  });

  document.getElementById('crEnrollAllBtn')?.addEventListener('click', async () => {
    const classId = document.getElementById('crClass').value;
    const subjectId = document.getElementById('crSubject').value;
    const yearId = document.getElementById('crYear').value;
    if (!classId || !subjectId || !yearId) { toast('Select class, subject and year.'); return; }
    const classSubjectId = await findClassSubjectId(classId, subjectId);
    if (!classSubjectId) return;
    const ids = crAllUnenrolled.map(s => s.studentId);
    if (!ids.length) { toast('No unenrolled students.'); return; }
    const { ok, data } = await api('/class-subject-students/bulk-enroll', { method: 'POST', body: JSON.stringify({ classSubjectId, academicYearId: parseInt(yearId), studentIds: ids }) });
    if (ok) { document.getElementById('crMsg').textContent = data.message; document.getElementById('crMsg').className = 'msg ok'; loadCourseReview(); }
    else { document.getElementById('crMsg').textContent = data.message; document.getElementById('crMsg').className = 'msg error'; }
  });

  document.getElementById('crUnenrollAllBtn')?.addEventListener('click', async () => {
    const classId = document.getElementById('crClass').value;
    const subjectId = document.getElementById('crSubject').value;
    if (!classId || !subjectId) { toast('Select class and subject.'); return; }
    const classSubjectId = await findClassSubjectId(classId, subjectId);
    if (!classSubjectId) return;
    const ids = crAllEnrolled.map(s => s.studentId);
    if (!ids.length) { toast('No enrolled students.'); return; }
    if (!confirm(`Unenroll ALL ${ids.length} student(s) from this subject? They disappear from the teacher's mark sheet; marks already saved are kept.`)) return;
    const { ok, data } = await api('/class-subject-students/bulk-unenroll', { method: 'POST', body: JSON.stringify({ classSubjectId, studentIds: ids }) });
    if (ok) { document.getElementById('crMsg').textContent = data.message; document.getElementById('crMsg').className = 'msg ok'; loadCourseReview(); }
    else { document.getElementById('crMsg').textContent = data.message; document.getElementById('crMsg').className = 'msg error'; }
  });

  document.getElementById('crSearchUnenrolled')?.addEventListener('input', () => renderCrLists());
  document.getElementById('crSearchEnrolled')?.addEventListener('input', () => renderCrLists());

  }
  // ===== REPORT CARDS =====
  let reportCardData = null;

  document.getElementById('rcGenerateBtn')?.addEventListener('click', async () => {
    const classId = document.getElementById('rcClass').value;
    const term = document.getElementById('rcTerm').value;
    const yearId = document.getElementById('rcYear').value;
    if (!classId || !term || !yearId) { toast('Select class, term and year.'); return; }

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

  // "4 (1)" = 4 hours absent, 1 of them unjustified.
  function absenceCell(s) {
    const a = s.attendance;
    if (!a || !a.periods) return '—';
    return esc(a.absentHours) + ' (' + esc(a.unjustifiedHours) + ')';
  }

  function renderReportCard(data) {
    const students = data.students || [];
    const subjects = students[0]?.subjects || [];

    const thead = document.getElementById('rcThead');
    let headerHtml = '<tr><th>#</th><th>Name</th><th>Matricule</th><th>Sex</th>';
    subjects.forEach(sub => {
      headerHtml += `<th>${esc(sub.subjectCode)}<br/><span style="font-weight:400;font-size:10px">Avg</span></th>`;
    });
    headerHtml += '<th>Total<br/><span style="font-weight:400;font-size:10px">Coef</span></th>';
    headerHtml += '<th>Average</th><th>Grade</th><th>Position</th><th>Absence hours<br/><span style="font-weight:400;font-size:10px">Unjustified</span></th></tr>';
    thead.innerHTML = headerHtml;

    const tbody = document.getElementById('rcTbody');
    tbody.innerHTML = students.map((s, i) => {
      let row = `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td>${esc(s.matricule)}</td><td>${esc(s.sex)}</td>`;
      subjects.forEach(sub => {
        const found = s.subjects.find(x => x.classSubjectId === sub.classSubjectId);
        const avg = found?.avg ?? '';
        row += `<td style="text-align:center">${avg !== '' && avg !== null ? avg.toFixed(2) : '—'}</td>`;
      });
      const wt = s.totalCoefficient > 0 ? (s.weightedTotal / s.totalCoefficient).toFixed(2) : '—';
      const overallGrade = s.overallAvg !== null ? gradeFromScore(s.overallAvg, 100) : '—';
      row += `<td style="text-align:center">${wt}</td><td style="text-align:center">${overallGrade}</td><td style="text-align:center">${s.position ?? '—'}</td><td style="text-align:center">${absenceCell(s)}</td></tr>`;
      return row;
    }).join('');

    const tfoot = document.getElementById('rcTfoot');
    let footHtml = '<tr><th colspan="4">Class Average</th>';
    subjects.forEach(sub => {
      const stat = (data.subjectAverages || []).find(x => x.classSubjectId === sub.classSubjectId);
      footHtml += `<th style="text-align:center;background:#f1f5f9">${stat ? stat.classAvg.toFixed(2) : '—'}</th>`;
    });
    footHtml += `<th style="text-align:center;background:#f1f5f9">${data.classGeneralAvg.toFixed(2)}</th><th></th><th></th><th></th></tr>`;
    tfoot.innerHTML = footHtml;

    document.getElementById('rcSummary').textContent = `Class General Average: ${data.classGeneralAvg.toFixed(2)} | Enrolled: ${data.totalEnrolled} | Best: ${data.bestSubject?.subjectCode || '—'} | Worst: ${data.worstSubject?.subjectCode || '—'}`;

    const kpis = document.getElementById('rcKPIs');
    kpis.innerHTML = `
      <div class="reg-kpi"><strong>Class General Average</strong><span>${data.classGeneralAvg.toFixed(2)}</span></div>
      <div class="reg-kpi"><strong>Total Enrolled</strong><span>${data.totalEnrolled}</span></div>
      <div class="reg-kpi"><strong>Best Subject</strong><span>${data.bestSubject ? `${data.bestSubject.subjectCode} (${data.bestSubject.classAvg.toFixed(2)})` : '—'}</span></div>
      <div class="reg-kpi"><strong>Worst Subject</strong><span>${data.worstSubject ? `${data.worstSubject.subjectCode} (${data.worstSubject.classAvg.toFixed(2)})` : '—'}</span></div>
    `;
  }

  document.getElementById('rcExportBtn')?.addEventListener('click', () => {
    if (!reportCardData) { toast('Generate report card first.'); return; }
    const students = reportCardData.students || [];
    const subjects = students[0]?.subjects || [];
    let csv = 'Position,Name,Matricule,Sex';
    subjects.forEach(sub => { csv += `,${sub.subjectCode} Avg`; });
    csv += ',Overall Avg,Grade,Absence hours,Unjustified hours,Lates\n';
    students.forEach(s => {
      const row = [s.position ?? '', s.name, s.matricule, s.sex];
      subjects.forEach(sub => {
        const found = s.subjects.find(x => x.classSubjectId === sub.classSubjectId);
        row.push(found?.avg !== null && found?.avg !== undefined ? found.avg.toFixed(2) : '');
      });
      row.push(s.overallAvg !== null ? s.overallAvg.toFixed(2) : '', gradeFromScore(s.overallAvg, 100));
      const a = s.attendance || {};
      row.push(a.absentHours ?? 0, a.unjustifiedHours ?? 0, a.lates ?? 0);
      csv += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
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
    if (!reportCardData) { toast('Generate report card first.'); return; }
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
      <h2>Report Card — ${esc(document.getElementById('rcTerm').value)} Term</h2>
      <p><strong>Class General Average:</strong> ${esc(reportCardData.classGeneralAvg.toFixed(2))} | <strong>Enrolled:</strong> ${esc(reportCardData.totalEnrolled)} | <strong>Best Subject:</strong> ${esc(reportCardData.bestSubject?.subjectCode || '—')} | <strong>Worst Subject:</strong> ${esc(reportCardData.worstSubject?.subjectCode || '—')}</p>
      <table><thead><tr><th>#</th><th>Name</th><th>Matricule</th><th>Sex</th>`);
    subjects.forEach(sub => {
      win.document.write(`<th>${esc(sub.subjectCode)}<br/>Avg</th>`);
    });
    win.document.write(`<th>Total</th><th>Grade</th><th>Position</th><th>Absence hrs (unjust.)</th></tr></thead><tbody>`);
    students.forEach((s, i) => {
      win.document.write(`<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td>${esc(s.matricule)}</td><td>${esc(s.sex)}</td>`);
      subjects.forEach(sub => {
        const found = s.subjects.find(x => x.classSubjectId === sub.classSubjectId);
        win.document.write(`<td>${found?.avg !== null && found?.avg !== undefined ? found.avg.toFixed(2) : '—'}</td>`);
      });
      const wt = s.totalCoefficient > 0 ? (s.weightedTotal / s.totalCoefficient).toFixed(2) : '—';
      const overallGrade = s.overallAvg !== null ? gradeFromScore(s.overallAvg, 100) : '—';
      win.document.write(`<td>${esc(wt)}</td><td>${esc(overallGrade)}</td><td>${esc(s.position ?? '—')}</td><td>${absenceCell(s)}</td></tr>`);
    });
    win.document.write(`</tbody><tfoot><tr><th colspan="4">Class Average</th>`);
    subjects.forEach(sub => {
      const stat = (reportCardData.subjectAverages || []).find(x => x.classSubjectId === sub.classSubjectId);
      win.document.write(`<th>${stat ? stat.classAvg.toFixed(2) : '—'}</th>`);
    });
    win.document.write(`<th>${reportCardData.classGeneralAvg.toFixed(2)}</th><th></th><th></th><th></th></tr></tfoot></table></body></html>`);
    win.document.close();
    win.print();
  });

})();
