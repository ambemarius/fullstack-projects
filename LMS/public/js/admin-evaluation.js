(function () {
  if (!window.LMS || !window.LMS.ready) return;

  // Averages are out of 20 (pass mark 10). Same remark bands as the printed bulletins.
  const REMARK_BANDS = [[17, 'Excellent'], [14, 'Very good'], [12, 'Good'], [10, 'Average'], [5, 'Weak'], [0, 'Very weak']];
  function remarkFor(avg) {
    if (avg === null || avg === undefined || Number.isNaN(Number(avg))) return '—';
    return REMARK_BANDS.find(([min]) => Number(avg) >= min)[1];
  }
  const failStyle = avg => (avg !== null && avg !== undefined && Number(avg) < 10 ? ';color:#c62828;font-weight:600' : '');

  // ===== SHARED LOADERS =====
  async function loadEvalDropdowns() {
    const { ok: okY, data: years } = await api('/academic-years');
    if (okY && years.data) {
      ['mkYear', 'crYear', 'crOvYear', 'rcYear'].forEach(id => {
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
  const evalDropdownsReady = loadEvalDropdowns();

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
  // ===== MARKS ENTRY: filter (year, class, subject, term) and mark sheet =====
  const mk = {
    form: document.getElementById('marksForm'), year: document.getElementById('mkYear'), class: document.getElementById('mkClass'),
    subject: document.getElementById('mkSubject'), term: document.getElementById('mkTerm'), open: document.getElementById('mkLoadBtn'),
    summary: document.getElementById('mkSummary'), sheet: document.getElementById('mkSheet'),
  };
  let markSheet = null;
  const MK_EMPTY = '<div class="mk-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v16M13 13h5M13 16h3"/></svg><h3>No mark sheet open</h3><p>Choose a class, subject and term above to start entering marks.</p></div>';
  const mkFields = { year: mk.year, class: mk.class, subject: mk.subject, term: mk.term };
  const mkField = name => mk.form && mk.form.querySelector(`[data-field="${name}"]`);
  const mkMsg = (text, kind) => { const m = document.getElementById('mkMsg'); m.textContent = text; m.className = 'msg' + (kind ? ' ' + kind : ''); };
  const confirmLeave = () => !markSheet || !markSheet.hasUnsavedChanges() || confirm('You have marks that are not saved. Leave this mark sheet without saving?');
  function closeSheet() { if (markSheet) { markSheet.destroy(); markSheet = null; } if (mk.sheet) mk.sheet.innerHTML = MK_EMPTY; }

  function mkFill(select, placeholder, items) {
    select.innerHTML = `<option value="">${esc(placeholder)}</option>` + (items || []).map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('');
  }
  function mkResetSubject() { mkFill(mk.subject, 'Choose a class first'); mk.subject.disabled = true; }

  // Steps turn green when chosen; the button opens only when all four are chosen; choices are kept in the URL.
  function mkRefresh() {
    let complete = true;
    for (const [name, sel] of Object.entries(mkFields)) {
      const ok = Boolean(sel.value);
      mkField(name).classList.toggle('done', ok);
      if (ok) { mkField(name).classList.remove('invalid'); mkField(name).querySelector('.mk-hint').textContent = ''; }
      complete = complete && ok;
    }
    mk.open.disabled = !complete;
    const chips = Object.values(mkFields).filter(sel => sel.value).map(sel => `<span class="mk-chip">${esc(sel.options[sel.selectedIndex].text)}</span>`);
    mk.summary.innerHTML = chips.join('');
    mk.summary.classList.toggle('show', chips.length > 0);
    const params = new URLSearchParams(location.search);
    for (const [name, sel] of Object.entries(mkFields)) { if (sel.value) params.set('mk_' + name, sel.value); else params.delete('mk_' + name); }
    const query = params.toString();
    history.replaceState(history.state, '', location.pathname + (query ? '?' + query : '') + location.hash);
  }

  async function mkLoadSubjects(classId) {
    const f = mkField('subject');
    f.classList.add('loading'); mk.subject.disabled = true; mkFill(mk.subject, 'Loading…');
    try {
      const { ok, data } = await api(`/classes/${classId}/subjects`);
      if (!ok) throw new Error('load failed');
      const seen = new Set(), items = [];
      for (const s of data.data || []) { if (seen.has(s.classSubjectId)) continue; seen.add(s.classSubjectId); items.push({ id: s.classSubjectId, name: s.subject }); }
      items.sort((x, y) => x.name.localeCompare(y.name));
      mkFill(mk.subject, items.length ? 'Select a subject' : 'No subjects for this class', items);
      mk.subject.disabled = !items.length;
      f.querySelector('.mk-hint').textContent = '';
    } catch {
      mkFill(mk.subject, 'Could not load');
      f.querySelector('.mk-hint').textContent = 'Loading failed. Choose the class again.';
    } finally {
      f.classList.remove('loading');
      mkRefresh();
    }
  }

  if (mk.form) {
    mk.sheet.innerHTML = MK_EMPTY;
    // Changing the selection closes the open sheet (after a warning if marks are unsaved).
    for (const [name, sel] of Object.entries(mkFields)) {
      sel.addEventListener('focus', () => { sel.dataset.prev = sel.value; });
      sel.addEventListener('change', async () => {
        if (!confirmLeave()) { sel.value = sel.dataset.prev || ''; return; }
        closeSheet(); mkMsg('');
        if (name === 'class') { if (sel.value) await mkLoadSubjects(sel.value); else { mkResetSubject(); mkRefresh(); } }
        else mkRefresh();
      });
    }
    document.getElementById('mkResetBtn').addEventListener('click', () => {
      if (!confirmLeave()) return;
      mk.class.value = ''; mk.term.value = ''; mkResetSubject(); closeSheet(); mkMsg(''); mkRefresh();
    });

    mk.form.addEventListener('submit', async ev => {
      ev.preventDefault();
      let firstBad = null;
      for (const [name, sel] of Object.entries(mkFields)) {
        if (!sel.value) { mkField(name).classList.add('invalid'); mkField(name).querySelector('.mk-hint').textContent = 'Required'; firstBad = firstBad || sel; }
      }
      if (firstBad) { firstBad.focus(); return; }
      const classSubjectId = mk.subject.value, yearId = mk.year.value, term = mk.term.value;
      const url = `/marks/admin/students/${classSubjectId}/${term}/${yearId}`;
      mk.open.disabled = true; mkMsg('Opening the mark sheet…');
      try {
        const { ok, data } = await api(url);
        if (!ok) { mkMsg((data && data.message) || 'The students could not be loaded.', 'error'); return; }
        mkMsg('');
        if (markSheet) markSheet.destroy();
        const className = mk.class.options[mk.class.selectedIndex].text.trim();
        const subjectName = mk.subject.options[mk.subject.selectedIndex].text.trim();
        markSheet = MarkSheet.mount(mk.sheet, {
          title: `${className}, ${subjectName}`,
          term,
          rows: data.data || [],
          fileName: `marks_${className}_${subjectName}_${term}`.replace(/[^\w-]+/g, '_'),
          save: async entries => {
            const res = await api(`/marks/admin/save-all/${classSubjectId}/${term}/${yearId}`, { method: 'POST', body: JSON.stringify({ entries }) });
            return { ok: res.ok, message: res.data && res.data.message };
          },
          reload: async () => { const res = await api(url); return res.ok ? res.data.data : null; },
        });
        mk.sheet.querySelector('.ms-input')?.focus();
      } finally {
        mk.open.disabled = false;
        mkRefresh();
      }
    });

    // Once years and classes are loaded: friendly placeholders, then restore the choices kept in the URL.
    evalDropdownsReady.then(async () => {
      if (mk.class.options[0]) mk.class.options[0].textContent = 'Select a class';
      if (mk.year.options[0]) mk.year.options[0].textContent = 'Select a year';
      const q = new URLSearchParams(location.search);
      const has = (sel, v) => v && [...sel.options].some(o => o.value === v);
      if (has(mk.year, q.get('mk_year'))) mk.year.value = q.get('mk_year');
      if (has(mk.class, q.get('mk_class'))) {
        mk.class.value = q.get('mk_class');
        await mkLoadSubjects(mk.class.value);
        if (has(mk.subject, q.get('mk_subject'))) mk.subject.value = q.get('mk_subject');
      } else mkResetSubject();
      if (has(mk.term, q.get('mk_term'))) mk.term.value = q.get('mk_term');
      mkRefresh();
    });
  }

  // ===== COURSE REVIEW: all courses overview (enrolments and marks entered) =====
  const cr = {
    viewAll: document.getElementById('crViewAll'), viewOne: document.getElementById('crViewOne'),
    overview: document.getElementById('crOverview'), one: document.getElementById('crOne'),
    year: document.getElementById('crOvYear'), term: document.getElementById('crOvTerm'), section: document.getElementById('crOvSection'),
    search: document.getElementById('crOvSearch'), attention: document.getElementById('crOvAttention'),
    stats: document.getElementById('crOvStats'), body: document.getElementById('crOvBody'),
    bulk: document.getElementById('crOvBulk'), bulkText: document.getElementById('crOvBulkText'), enrolAll: document.getElementById('crOvEnrolAll'),
  };
  let crCourses = [];
  const crSay = (text, kind) => { const m = document.getElementById('crOvMsg'); if (m) { m.textContent = text; m.className = 'msg' + (kind ? ' ' + kind : ''); } };
  const crClassLabel = c => `${c.section} ${c.className}${c.stream && c.stream !== 'Normal' ? ' ' + c.stream : ''}`;
  const crSeqBase = () => ({ First: 0, Second: 2, Third: 4 })[cr.term.value] || 0;

  function crStatus(c) {
    const possible = c.enrolled * 2, entered = c.seq1Entered + c.seq2Entered;
    if (!c.classSize) return { key: 'empty', label: 'No students in class' };
    if (!c.enrolled) return { key: 'none', label: 'Nobody enrolled' };
    if (entered >= possible && c.enrolled >= c.classSize) return { key: 'done', label: 'Complete' };
    if (entered >= possible) return { key: 'partial', label: 'Marks in, enrolment incomplete' };
    if (!entered) return { key: 'todo', label: 'No marks yet' };
    return { key: 'progress', label: 'In progress' };
  }
  const needsAttention = c => !['done', 'empty'].includes(crStatus(c).key) || c.marksNotEnrolled > 0;
  const bar = (n, total) => `<span class="cr-bar" aria-hidden="true"><span style="width:${total ? Math.min(100, Math.round((n / total) * 100)) : 0}%"></span></span>`;

  function crVisible() {
    const q = cr.search.value.trim().toLowerCase();
    return crCourses.filter(c => (!cr.section.value || c.section === cr.section.value)
      && (!q || `${crClassLabel(c)} ${c.subject} ${c.code} ${c.teachers || ''}`.toLowerCase().includes(q))
      && (!cr.attention.checked || needsAttention(c)));
  }

  function crRender() {
    const list = crVisible(), base = crSeqBase();
    document.getElementById('crOvSeq1Head').textContent = `Sequence ${base + 1} marks`;
    document.getElementById('crOvSeq2Head').textContent = `Sequence ${base + 2} marks`;
    // Summary over the courses on screen.
    const enrolled = list.reduce((k, c) => k + c.enrolled, 0), seats = list.reduce((k, c) => k + c.classSize, 0);
    const entered = list.reduce((k, c) => k + c.seq1Entered + c.seq2Entered, 0), possible = enrolled * 2;
    const complete = list.filter(c => crStatus(c).key === 'done').length;
    cr.stats.innerHTML = `
      <div class="cr-stat"><dt>Courses shown</dt><dd>${list.length}</dd></div>
      <div class="cr-stat"><dt>Students enrolled</dt><dd>${enrolled} of ${seats} ${bar(enrolled, seats)}</dd></div>
      <div class="cr-stat"><dt>Marks entered</dt><dd>${entered} of ${possible} ${bar(entered, possible)}</dd></div>
      <div class="cr-stat"><dt>Courses complete</dt><dd>${complete} of ${list.length}</dd></div>`;
    const missing = list.reduce((k, c) => k + Math.max(0, c.classSize - c.enrolled), 0);
    const missingCourses = list.filter(c => c.classSize > c.enrolled).length;
    cr.bulk.hidden = !missing;
    cr.bulkText.textContent = missing ? `${missing} students are not enrolled in ${missingCourses} of the courses shown. Marks can only be entered for enrolled students.` : '';

    if (!list.length) {
      cr.body.innerHTML = `<tr><td colspan="7" class="cr-empty">${crCourses.length ? 'No course matches these filters.' : 'No subjects are allocated to classes for this year yet.'}</td></tr>`;
      return;
    }
    let html = '', lastClass = null;
    for (const c of list) {
      if (c.classId !== lastClass) {
        lastClass = c.classId;
        const cls = list.filter(x => x.classId === c.classId);
        const done = cls.filter(x => crStatus(x).key === 'done').length;
        html += `<tr class="cr-class-row"><th colspan="7" scope="rowgroup">${esc(crClassLabel(c))}<span>${c.classSize} student${c.classSize === 1 ? '' : 's'}, ${done} of ${cls.length} courses complete</span></th></tr>`;
      }
      const st = crStatus(c);
      const seq = n => c.enrolled ? `<span class="cr-num">${n} of ${c.enrolled}</span>${bar(n, c.enrolled)}` : '<span class="cr-muted">—</span>';
      const orphan = c.marksNotEnrolled ? `<span class="cr-warn" title="These marks exist but are hidden from the mark sheet until the students are enrolled.">${c.marksNotEnrolled} marks belong to students who are not enrolled</span>` : '';
      html += `<tr data-cs="${c.classSubjectId}">
        <td><span class="cr-subject">${esc(c.subject)}</span><span class="cr-muted">${esc(c.code || '')}, coefficient ${esc(c.coefficient)}</span></td>
        <td>${c.teachers ? esc(c.teachers) : '<span class="cr-warn">No teacher assigned</span>'}</td>
        <td><span class="cr-num">${c.enrolled} of ${c.classSize}</span>${bar(c.enrolled, c.classSize)}</td>
        <td>${seq(c.seq1Entered)}</td>
        <td>${seq(c.seq2Entered)}</td>
        <td><span class="cr-badge cr-badge-${st.key}">${esc(st.label)}</span>${orphan}</td>
        <td class="cr-actions">
          ${c.classSize > c.enrolled ? `<button type="button" class="cr-act cr-act-primary" data-act="enrol">Enrol class</button>` : ''}
          ${c.enrolled ? `<button type="button" class="cr-act" data-act="marks">Mark sheet</button>` : ''}
          <button type="button" class="cr-act" data-act="manage">Manage</button>
        </td></tr>`;
    }
    cr.body.innerHTML = html;
  }

  async function crLoad() {
    if (!cr.year || !cr.year.value) return;
    cr.body.innerHTML = '<tr><td colspan="7" class="cr-empty">Loading courses…</td></tr>';
    const { ok, data } = await api(`/class-subject-students/overview/${cr.year.value}?term=${encodeURIComponent(cr.term.value)}`);
    if (!ok) { cr.body.innerHTML = `<tr><td colspan="7" class="cr-empty">${esc((data && data.message) || 'The courses could not be loaded.')}</td></tr>`; return; }
    crCourses = data.data.courses;
    crRender();
  }

  // Enrol every class student not yet enrolled in one course.
  async function crEnrolCourse(c) {
    const { ok, data } = await api(`/class-subject-students/${c.classSubjectId}/${cr.year.value}`);
    if (!ok) throw new Error((data && data.message) || 'Could not read the class list');
    const ids = (data.data.unenrolled || []).map(s => s.studentId);
    if (!ids.length) return 0;
    const res = await api('/class-subject-students/bulk-enroll', { method: 'POST', body: JSON.stringify({ classSubjectId: c.classSubjectId, academicYearId: +cr.year.value, studentIds: ids }) });
    if (!res.ok) throw new Error((res.data && res.data.message) || 'Enrolment failed');
    return ids.length;
  }

  function crShowView(which) {
    const all = which === 'all';
    cr.overview.hidden = !all; cr.one.hidden = all;
    cr.viewAll.setAttribute('aria-selected', String(all)); cr.viewOne.setAttribute('aria-selected', String(!all));
    cr.viewAll.tabIndex = all ? 0 : -1; cr.viewOne.tabIndex = all ? -1 : 0;
    if (all) crLoad();
  }

  if (cr.overview) {
    cr.viewAll.addEventListener('click', () => crShowView('all'));
    cr.viewOne.addEventListener('click', () => crShowView('one'));
    [cr.viewAll, cr.viewOne].forEach(b => b.addEventListener('keydown', ev => {
      if (!['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
      const other = b === cr.viewAll ? cr.viewOne : cr.viewAll;
      other.focus(); other.click();
    }));
    cr.year.addEventListener('change', crLoad);
    cr.term.addEventListener('change', crLoad);
    [cr.section, cr.attention].forEach(el => el.addEventListener('change', crRender));
    cr.search.addEventListener('input', crRender);

    cr.body.addEventListener('click', async ev => {
      const btn = ev.target.closest('[data-act]');
      if (!btn) return;
      const c = crCourses.find(x => x.classSubjectId === +btn.closest('tr').dataset.cs);
      if (!c) return;
      if (btn.dataset.act === 'enrol') {
        btn.disabled = true; btn.textContent = 'Enrolling…';
        try { const n = await crEnrolCourse(c); crSay(`Enrolled ${n} student${n === 1 ? '' : 's'} in ${crClassLabel(c)} ${c.subject}.`, 'ok'); }
        catch (err) { crSay(err.message, 'error'); }
        await crLoad();
      } else if (btn.dataset.act === 'marks') {
        // Open this course's mark sheet in Marks entry.
        document.querySelector('#tab-evaluation .reg-subtab[data-sub="marks"]')?.click();
        if (!confirmLeave()) return;
        mk.year.value = cr.year.value; mk.class.value = String(c.classId);
        await mkLoadSubjects(c.classId);
        mk.subject.value = String(c.classSubjectId); mk.term.value = cr.term.value;
        mkRefresh();
        mk.form.requestSubmit();
      } else if (btn.dataset.act === 'manage') {
        // Open the enrol/unenrol lists for this course.
        crShowView('one');
        document.getElementById('crYear').value = cr.year.value;
        document.getElementById('crClass').value = String(c.classId);
        await loadEvalSubjectsByClass(String(c.classId), 'crSubject');
        document.getElementById('crSubject').value = String(c.classSubjectId);
        loadCourseReview();
      }
    });

    cr.enrolAll.addEventListener('click', async () => {
      const targets = crVisible().filter(c => c.classSize > c.enrolled);
      const missing = targets.reduce((k, c) => k + c.classSize - c.enrolled, 0);
      if (!targets.length || !confirm(`Enrol ${missing} students in ${targets.length} courses? Each student is enrolled in the subjects of their own class.`)) return;
      cr.enrolAll.disabled = true;
      let done = 0, total = 0;
      try {
        for (const c of targets) { total += await crEnrolCourse(c); done++; cr.enrolAll.textContent = `Enrolling… ${done} of ${targets.length}`; }
        crSay(`Enrolled ${total} students in ${done} courses.`, 'ok');
      } catch (err) {
        crSay(`Stopped after ${done} courses: ${err.message}`, 'error');
      } finally {
        cr.enrolAll.disabled = false; cr.enrolAll.textContent = 'Enrol all missing students';
        await crLoad();
      }
    });

    evalDropdownsReady.then(() => {
      if (cr.year.options[0] && !cr.year.options[0].value) cr.year.options[0].textContent = 'Select a year';
      crLoad();
    });
  }

  // ===== COURSE REVIEW: one course (enrol / unenrol) =====
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
    const found = data.data.find(s => s.classSubjectId == subjectId) || data.data.find(s => s.subjectId == subjectId);
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

  // Printable bilingual bulletins (one A4 page per student): the whole class, or one chosen student.
  const rcStudent = document.getElementById('rcStudent');
  async function loadRcStudents() {
    if (!rcStudent) return;
    const classId = document.getElementById('rcClass').value, term = document.getElementById('rcTerm').value, yearId = document.getElementById('rcYear').value;
    rcStudent.innerHTML = '<option value="">Whole class (all students)</option>';
    rcStudent.disabled = true;
    if (!classId || !term || !yearId) return;
    // Same roster the bulletins use, so every student listed gets a card.
    const { ok, data } = await api(`/report-cards/records/${classId}/${term}/${yearId}`);
    if (!ok) return;
    const students = data.data.students || [];
    rcStudent.innerHTML = `<option value="">Whole class (${students.length} student${students.length === 1 ? '' : 's'})</option>` +
      students.map(s => `<option value="${s.studentId}">${esc(s.name)} (${esc(s.matricule)})</option>`).join('');
    rcStudent.disabled = !students.length;
    updateRcPrintLabel();
  }
  function updateRcPrintLabel() {
    const btn = document.getElementById('rcBulletinBtn');
    if (!btn || !rcStudent) return;
    btn.textContent = rcStudent.value ? 'Print this student’s bulletin (A4)' : 'Print class bulletins (A4)';
  }
  ['rcClass', 'rcTerm', 'rcYear'].forEach(id => document.getElementById(id)?.addEventListener('change', loadRcStudents));
  rcStudent?.addEventListener('change', updateRcPrintLabel);
  if (typeof evalDropdownsReady !== 'undefined') evalDropdownsReady.then(loadRcStudents);

  document.getElementById('rcBulletinBtn')?.addEventListener('click', () => {
    const classId = document.getElementById('rcClass').value;
    const term = document.getElementById('rcTerm').value;
    const yearId = document.getElementById('rcYear').value;
    if (!classId || !term || !yearId) { toast('Select class, term and year.'); return; }
    const params = { classId, term, yearId };
    if (rcStudent && rcStudent.value) params.studentId = rcStudent.value;
    window.open('/report-cards/print?' + new URLSearchParams(params).toString(), '_blank', 'noopener');
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
    headerHtml += '<th>Average<br/><span style="font-weight:400;font-size:10px">out of 20</span></th>';
    headerHtml += '<th>Remark</th><th>Position</th><th>Absence hours<br/><span style="font-weight:400;font-size:10px">Unjustified</span></th></tr>';
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
      const overallGrade = s.overallAvg !== null ? remarkFor(s.overallAvg) : '—';
      row += `<td style="text-align:center${failStyle(s.overallAvg)}">${wt}</td><td style="text-align:center${failStyle(s.overallAvg)}">${overallGrade}</td><td style="text-align:center">${s.position ?? '—'}</td><td style="text-align:center">${absenceCell(s)}</td></tr>`;
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
    csv += ',Average /20,Remark,Absence hours,Unjustified hours,Lates\n';
    students.forEach(s => {
      const row = [s.position ?? '', s.name, s.matricule, s.sex];
      subjects.forEach(sub => {
        const found = s.subjects.find(x => x.classSubjectId === sub.classSubjectId);
        row.push(found?.avg !== null && found?.avg !== undefined ? found.avg.toFixed(2) : '');
      });
      row.push(s.overallAvg !== null ? s.overallAvg.toFixed(2) : '', remarkFor(s.overallAvg));
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
    win.document.write(`<html><head><title>Class broadsheet</title><style>
      body{font-family:sans-serif;padding:20px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #333;padding:5px 8px;text-align:center}
      th{background:#1e3a8a;color:#fff}
      tfoot tr td{background:#f1f5f9;font-weight:700}
      h2{text-align:center}
    </style></head><body>
      <h2>Class broadsheet: ${esc(document.getElementById('rcTerm').value)} term (averages out of 20)</h2>
      <p><strong>Class General Average:</strong> ${esc(reportCardData.classGeneralAvg.toFixed(2))} | <strong>Enrolled:</strong> ${esc(reportCardData.totalEnrolled)} | <strong>Best Subject:</strong> ${esc(reportCardData.bestSubject?.subjectCode || '—')} | <strong>Worst Subject:</strong> ${esc(reportCardData.worstSubject?.subjectCode || '—')}</p>
      <table><thead><tr><th>#</th><th>Name</th><th>Matricule</th><th>Sex</th>`);
    subjects.forEach(sub => {
      win.document.write(`<th>${esc(sub.subjectCode)}<br/>Avg</th>`);
    });
    win.document.write(`<th>Average /20</th><th>Remark</th><th>Position</th><th>Absence hrs (unjust.)</th></tr></thead><tbody>`);
    students.forEach((s, i) => {
      win.document.write(`<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td>${esc(s.matricule)}</td><td>${esc(s.sex)}</td>`);
      subjects.forEach(sub => {
        const found = s.subjects.find(x => x.classSubjectId === sub.classSubjectId);
        win.document.write(`<td>${found?.avg !== null && found?.avg !== undefined ? found.avg.toFixed(2) : '—'}</td>`);
      });
      const wt = s.totalCoefficient > 0 ? (s.weightedTotal / s.totalCoefficient).toFixed(2) : '—';
      const overallGrade = s.overallAvg !== null ? remarkFor(s.overallAvg) : '—';
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
