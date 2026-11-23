(function () {
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const DAY_LABELS = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri' };

  function buildGridHtml(slots, entriesBySlotDay, showClass, showDelete) {
    let html = '<table class="tt-grid"><thead><tr><th>Time</th>';
    for (const d of DAYS) html += `<th>${esc(d)}</th>`;
    html += '</tr></thead><tbody>';

    for (const slot of slots) {
      const { id, start_time, end_time, is_break, slot_number } = slot;
      const label = is_break ? `${start_time}-${end_time}` : `#${slot_number}<br>${start_time}-${end_time}`;

      html += `<tr class="${is_break ? 'tt-break' : ''}" data-slot-id="${id}">`;
      html += `<td class="tt-time">${label}</td>`;

      for (const d of DAYS) {
        if (is_break) {
          html += `<td class="tt-break-cell">Break</td>`;
          continue;
        }
        const entries = (entriesBySlotDay[id] && entriesBySlotDay[id][d]) || [];
        if (entries.length === 0) {
          html += `<td class="tt-empty" data-day="${d}" data-slot-id="${id}">—</td>`;
        } else {
          const e = entries[0];
          let cell = `<td class="tt-filled"><strong>${esc(e.subject_name)}</strong><br><span class="muted">${esc(e.teacher_name)}</span>`;
          if (showClass && e.class_name) cell += `<br><span class="muted">${esc(e.class_name)}${e.stream ? ' (' + esc(e.stream) + ')' : ''}</span>`;
          if (e.room) cell += `<br><span class="muted">${esc(e.room)}</span>`;
          if (showDelete && e.entry_id) cell += ` <a href="#" class="tt-del" data-id="${e.entry_id}" style="color:var(--danger);font-size:12px">✕</a>`;
          cell += '</td>';
          html += cell;
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
  }

  function groupBySlotAndDay(entries, slotIdKey) {
    // entries come from grid endpoint: each row has slot_id + day_of_week + entry fields
    const map = {};
    for (const e of entries) {
      const sid = e.slot_id || e.time_slot_id;
      if (!sid) continue;
      if (!map[sid]) map[sid] = {};
      const d = e.day_of_week;
      if (!map[sid][d]) map[sid][d] = [];
      if (e.entry_id || e.subject_id) map[sid][d].push(e);
    }
    return map;
  }

  // ---- PAGE-SPECIFIC CODE ----

  const page = window.location.pathname;

  // Admin timetable management
  if (page === '/timetable') {
    const classSel = document.getElementById('ttClass');
    const subjectSel = document.getElementById('ttSubject');
    const teacherSel = document.getElementById('ttTeacher');
    const daySel = document.getElementById('ttDay');
    const slotSel = document.getElementById('ttSlot');
    const yearSel = document.getElementById('ttYear');
    const filterSection = document.getElementById('filterSection');
    const filterClass = document.getElementById('filterClass');
    const filterTerm = document.getElementById('filterTerm');
    const filterYear = document.getElementById('filterYear');

    let allClasses = [];
    let allSlots = [];

    // Load form data
    api('/timetables/form-data').then(res => {
      if (!res || !res.data || !res.data.data) return;
      const { slots, classes, subjects, teachers, academicYears, days } = res.data.data;
      allSlots = slots;
      allClasses = classes;

      for (const c of classes) classSel.innerHTML += `<option value="${c.id}" data-section="${c.section}">${esc(c.section)} — ${esc(c.name)}${c.stream ? ' (' + esc(c.stream) + ')' : ''}</option>`;
      for (const s of subjects) subjectSel.innerHTML += `<option value="${s.id}">${esc(s.name)} (${esc(s.code)})</option>`;
      for (const t of teachers) {
        const tn = [t.firstName, t.middleName, t.lastName].filter(Boolean).join(' ');
        teacherSel.innerHTML += `<option value="${t.id}">${esc(tn)}</option>`;
      }
      for (const d of days) daySel.innerHTML += `<option value="${d}">${d}</option>`;
      for (const s of slots) {
        if (s.is_break) continue;
        slotSel.innerHTML += `<option value="${s.id}">#${s.slot_number} (${s.start_time}-${s.end_time})</option>`;
      }
      const sgYearSel = document.getElementById('sgYear');
      for (const y of academicYears) {
        const opt = `<option value="${y.id}"${y.isCurrent ? ' selected' : ''}>${esc(y.name)}${y.isCurrent ? ' (current)' : ''}</option>`;
        yearSel.innerHTML += opt;
        filterYear.innerHTML += opt;
        if (sgYearSel) sgYearSel.innerHTML += opt;
      }
    });

    // Submit new entry
    document.getElementById('ttForm').addEventListener('submit', async e => {
      e.preventDefault();
      const selectedSlot = allSlots.find(s => s.id == slotSel.value);
      const body = {
        class_id: +classSel.value, subject_id: +subjectSel.value, teacher_id: +teacherSel.value,
        day_of_week: daySel.value, time_slot_id: +slotSel.value,
        start_time: selectedSlot ? selectedSlot.start_time : null,
        end_time: selectedSlot ? selectedSlot.end_time : null,
        room: document.getElementById('ttRoom').value,
        academic_term: document.getElementById('ttTerm').value, academic_year_id: +yearSel.value,
      };
      try {
        const res = await api('/timetables', { method: 'POST', body: JSON.stringify(body) });
        if (res.ok) {
          document.getElementById('ttMsg').textContent = 'Entry added!';
          document.getElementById('ttMsg').className = 'msg ok';
          loadGrid();
        } else {
          document.getElementById('ttMsg').textContent = (res.data && res.data.message) || 'Failed';
          document.getElementById('ttMsg').className = 'msg error';
        }
      } catch (err) {
        document.getElementById('ttMsg').textContent = err.message;
        document.getElementById('ttMsg').className = 'msg error';
      }
    });

    // Section filter → populate class filter
    filterSection.addEventListener('change', () => {
      const section = filterSection.value;
      filterClass.innerHTML = '<option value="">-- Select class --</option>';
      for (const c of allClasses) {
        if (section && c.section !== section) continue;
        filterClass.innerHTML += `<option value="${c.id}">${esc(c.name)}${c.stream ? ' (' + esc(c.stream) + ')' : ''}</option>`;
      }
    });

    document.getElementById('refreshBtn').addEventListener('click', loadGrid);
    filterTerm.addEventListener('change', loadGrid);
    filterYear.addEventListener('change', loadGrid);
    filterClass.addEventListener('change', loadGrid);

    // Auto-generate this class's timetable from its subject allocations
    document.getElementById('generateBtn').addEventListener('click', async () => {
      const genMsg = document.getElementById('genMsg');
      const classId = filterClass.value;
      const yearId = filterYear.value;
      const term = filterTerm.value;
      genMsg.textContent = ''; genMsg.className = 'msg';
      if (!classId || !yearId) { genMsg.textContent = 'Pick a class and year first.'; genMsg.className = 'msg error'; return; }
      if (!confirm('Generate will replace this class\'s timetable for the selected term. Continue?')) return;

      genMsg.textContent = 'Generating…';
      const res = await api(`/timetables/generate/class/${classId}`, {
        method: 'POST',
        body: JSON.stringify({ term, academic_year_id: +yearId }),
      });
      if (!res.ok) { genMsg.textContent = (res.data && res.data.message) || 'Failed'; genMsg.className = 'msg error'; return; }
      let txt = res.data.message;
      if (res.data.unassignedSubjects && res.data.unassignedSubjects.length) {
        txt += ` · No teacher assigned for: ${res.data.unassignedSubjects.join(', ')}`;
      }
      genMsg.textContent = txt; genMsg.className = 'msg ok';
      loadGrid();
    });

    // ---- Whole-school generator: preview first, then replace on confirmation ----
    const sg = {
      form: document.getElementById('sgForm'), term: document.getElementById('sgTerm'), year: document.getElementById('sgYear'),
      study: document.getElementById('sgStudy'), previewBtn: document.getElementById('sgPreviewBtn'), msg: document.getElementById('sgMsg'),
      result: document.getElementById('sgResult'), verdict: document.getElementById('sgVerdict'), classSel: document.getElementById('sgClass'),
      grid: document.getElementById('sgGrid'), applyBtn: document.getElementById('sgApplyBtn'), applyNote: document.getElementById('sgApplyNote'),
    };
    let preview = null;
    const setSgMsg = (text, kind) => { sg.msg.textContent = text; sg.msg.className = 'msg' + (kind ? ' ' + kind : ''); };
    const invalidatePreview = () => { if (preview) { preview = null; sg.result.hidden = true; setSgMsg('Settings changed: preview again.', ''); } };
    [sg.term, sg.year, sg.study].forEach(el => el.addEventListener('change', invalidatePreview));

    function renderPreviewGrid() {
      const cls = preview && preview.classes.find(c => String(c.classId) === sg.classSel.value);
      if (!cls) { sg.grid.innerHTML = ''; return; }
      const periodIndex = new Map(preview.periods.map((p, i) => [p.slotId, i]));
      const slots = allSlots.length ? allSlots : preview.periods.map((p, i) => ({ id: p.slotId, start_time: p.start, end_time: p.end, slot_number: i + 1, is_break: false }));
      let html = '<table class="tt-grid"><thead><tr><th>Time</th>' + preview.days.map(d => `<th>${esc(d)}</th>`).join('') + '</tr></thead><tbody>';
      for (const slot of slots) {
        if (slot.is_break) { html += `<tr class="tt-break"><td class="tt-time">${esc(slot.start_time)}-${esc(slot.end_time)}</td>${preview.days.map(() => '<td class="tt-break-cell">Break</td>').join('')}</tr>`; continue; }
        const p = periodIndex.get(slot.id);
        if (p === undefined) continue;
        html += `<tr><td class="tt-time">#${esc(slot.slot_number)}<br>${esc(slot.start_time)}-${esc(slot.end_time)}</td>`;
        preview.days.forEach((_, d) => {
          const c = cls.grid[d][p];
          if (!c) html += '<td class="tt-empty">—</td>';
          else if (c.study && !c.teacher) html += '<td class="tt-empty" title="No teacher is free to supervise">— free —</td>';
          else if (c.study) html += `<td class="tt-filled tt-study">Study period<br><span class="muted">${esc(c.teacher)}</span></td>`;
          else html += `<td class="tt-filled"><strong>${esc(c.subject)}</strong><br><span class="muted">${esc(c.teacher)}</span></td>`;
        });
        html += '</tr>';
      }
      sg.grid.innerHTML = html + '</tbody></table>';
    }
    sg.classSel.addEventListener('change', renderPreviewGrid);

    function renderPreview() {
      const v = preview.validation;
      const pct = v.totalRequired ? Math.round(100 * v.totalPlaced / v.totalRequired) : 0;
      document.getElementById('sgPlaced').textContent = `${pct}%`;
      document.getElementById('sgPlaced').title = `${v.totalPlaced} of ${v.totalRequired} periods`;
      document.getElementById('sgExact').textContent = `${v.exact}/${v.tuples}`;
      // Study periods with no free supervisor are saved as empty slots, so show them as empty here too.
      const emptyAfterApply = v.emptySlots + v.studyUnsupervised;
      const supervisedStudy = v.studySlots - v.studyUnsupervised;
      document.getElementById('sgEmpty').textContent = emptyAfterApply;
      document.getElementById('sgStudyCount').textContent = preview.study ? supervisedStudy : '—';

      const missing = v.totalRequired - v.totalPlaced;
      if (v.complete) {
        sg.verdict.className = 'alert alert-success';
        sg.verdict.textContent = `Complete: every class gets its full weekly hours with no clashes and no empty periods (${v.totalPlaced} lessons${preview.study ? ` + ${supervisedStudy} study periods` : ''}).`;
      } else if (missing > 0) {
        sg.verdict.className = 'alert alert-warning';
        sg.verdict.textContent = `${missing} of ${v.totalRequired} required periods cannot be placed without double-booking a teacher, and ${emptyAfterApply} class periods would be left empty. The usual cause is a teacher with more periods than the week has, or a subject with no teacher; see the tables below. What is placed is clash-free.`;
      } else {
        sg.verdict.className = 'alert alert-info';
        sg.verdict.textContent = `All required periods are placed with no clashes. ${emptyAfterApply} class periods stay free${preview.study ? ' because no teacher is free to supervise them' : '; tick "Fill free periods with supervised study" to fill them'}.`;
      }

      document.getElementById('sgShortfallCount').textContent = preview.shortfall.length;
      document.getElementById('sgShortfall').innerHTML = preview.shortfall.length
        ? preview.shortfall.map(s => `<tr><td>${esc(s.className)}</td><td>${esc(s.subject)}</td><td>${s.required}</td><td>${s.placed}</td><td>${s.teachers.length ? esc(s.teachers.join(', ')) : '<span class="badge yes">No teacher assigned</span>'}</td></tr>`).join('')
        : '<tr><td colspan="5" class="muted">None: every subject gets all its periods.</td></tr>';
      document.getElementById('sgShortfallBox').open = preview.shortfall.length > 0 && preview.shortfall.length <= 30;
      document.getElementById('sgTeachers').innerHTML = preview.teacherLoad.map(t =>
        `<tr><td>${esc(t.name)}</td><td>${t.required}</td><td>${t.lessons}</td><td>${t.supervision}</td><td>${t.shortfall ? `<span class="badge yes">${t.shortfall}</span>` : '<span class="badge no">0</span>'}</td></tr>`).join('');

      const previous = sg.classSel.value;
      sg.classSel.innerHTML = preview.classes.map(c => `<option value="${c.classId}">${esc(c.section)} — ${esc(c.name)}</option>`).join('');
      if (preview.classes.some(c => String(c.classId) === previous)) sg.classSel.value = previous;
      renderPreviewGrid();

      sg.applyBtn.disabled = v.totalPlaced === 0;
      sg.applyBtn.textContent = `Replace ${preview.academicYear.name} ${preview.term} term timetable`;
      sg.applyNote.textContent = `${preview.existingLessons} current lessons will be replaced and backed up first.`;
      sg.result.hidden = false;
    }

    sg.form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!sg.year.value) { setSgMsg('Choose an academic year.', 'error'); return; }
      sg.previewBtn.disabled = true; sg.result.hidden = true; preview = null;
      setSgMsg('Building the timetable for every class…', '');
      try {
        const res = await api('/timetables/generate/school/preview', {
          method: 'POST', body: JSON.stringify({ academic_year_id: +sg.year.value, term: sg.term.value, study: sg.study.checked }),
        });
        if (!res.ok) { setSgMsg((res.data && res.data.message) || 'Preview failed.', 'error'); return; }
        preview = res.data.data;
        setSgMsg('Preview ready. Nothing has been changed yet.', 'ok');
        renderPreview();
      } catch (err) {
        setSgMsg(err.message, 'error');
      } finally {
        sg.previewBtn.disabled = false;
      }
    });

    sg.applyBtn.addEventListener('click', async () => {
      if (!preview) return;
      const v = preview.validation;
      const lines = [
        `Replace the timetable for ${preview.academicYear.name}, ${preview.term} term?`,
        '',
        `• ${preview.existingLessons} current lessons will be removed (a backup is saved first).`,
        `• ${v.totalPlaced} lessons${preview.study ? ` and ${v.studySlots - v.studyUnsupervised} study periods` : ''} will be added for ${preview.classes.length} classes.`,
      ];
      if (v.totalPlaced < v.totalRequired) lines.push(`• ${v.totalRequired - v.totalPlaced} required periods will be missing.`);
      lines.push('', 'Past attendance registers are kept.');
      if (!confirm(lines.join('\n'))) return;
      sg.applyBtn.disabled = true; sg.previewBtn.disabled = true;
      setSgMsg('Replacing the timetable…', '');
      try {
        const res = await api('/timetables/generate/school', {
          method: 'POST', body: JSON.stringify({ academic_year_id: preview.academicYear.id, term: preview.term, study: preview.study, fingerprint: preview.fingerprint }),
        });
        if (!res.ok) {
          setSgMsg((res.data && res.data.message) || 'Could not replace the timetable. Nothing was changed.', 'error');
          sg.applyBtn.disabled = false;
          return;
        }
        const d = res.data.data;
        setSgMsg(`${res.data.message}. Backup saved as ${d.backup}.`, 'ok');
        const appliedYear = String(preview.academicYear.id), appliedTerm = preview.term;
        preview = null; sg.result.hidden = true;
        filterYear.value = appliedYear; filterTerm.value = appliedTerm;
        loadGrid();
      } catch (err) {
        setSgMsg(err.message, 'error');
        sg.applyBtn.disabled = false;
      } finally {
        sg.previewBtn.disabled = false;
      }
    });

    async function loadGrid() {
      const classId = filterClass.value;
      const container = document.getElementById('ttGrid');
      const summary = document.getElementById('periodSummary');
      if (!classId) { container.innerHTML = '<p class="muted">Select a class to view timetable.</p>'; summary.innerHTML = ''; return; }

      const term = filterTerm.value;
      const yearId = filterYear.value;
      if (!yearId) { container.innerHTML = '<p class="muted">Select an academic year.</p>'; summary.innerHTML = ''; return; }

      const res = await api(`/timetables/class/${classId}/grid?term=${term}&yearId=${yearId}`);
      if (!res || !res.data || !res.data.data) { container.innerHTML = '<p class="muted">No data.</p>'; return; }

      const { slots, entries, allocations } = res.data.data;
      const map = groupBySlotAndDay(entries);

      container.innerHTML = buildGridHtml(slots, map, false, true);

      // Period summary
      if (allocations && allocations.length) {
        summary.innerHTML = '<strong>Weekly allocation:</strong> ' +
          allocations.map(a => `${esc(a.subject_name)}: ${a.periods_week}pw`).join(' | ');
      } else {
        summary.innerHTML = '';
      }

      // Delete handlers
      container.querySelectorAll('.tt-del').forEach(el => {
        el.addEventListener('click', async ev => {
          ev.preventDefault();
          if (!confirm('Remove this entry?')) return;
          await api(`/timetables/${el.dataset.id}`, { method: 'DELETE' });
          loadGrid();
        });
      });
    }
    loadGrid();
  }

  // Teacher timetable
  if (page === '/timetable-teacher') {
    document.getElementById('refreshBtn').addEventListener('click', loadGrid);
    document.getElementById('filterTerm').addEventListener('change', loadGrid);

    async function loadGrid() {
      const term = document.getElementById('filterTerm').value;
      const res = await api(`/timetables/teacher?term=${term}`);
      const container = document.getElementById('ttGrid');
      if (!res || !res.data || !res.data.data || !res.data.data.length) {
        container.innerHTML = '<p class="muted">No timetable entries found for you this term.</p>';
        return;
      }
      // Get unique class IDs and load slot info
      const slotRes = await api('/academic-context');
      const slots = (slotRes && slotRes.data && slotRes.data.data && slotRes.data.data.slots) || [];
      const entriesBySlotDay = {};
      for (const e of res.data.data) {
        if (!entriesBySlotDay[e.time_slot_id]) entriesBySlotDay[e.time_slot_id] = {};
        if (!entriesBySlotDay[e.time_slot_id][e.day_of_week]) entriesBySlotDay[e.time_slot_id][e.day_of_week] = [];
        entriesBySlotDay[e.time_slot_id][e.day_of_week].push(e);
      }
      container.innerHTML = buildGridHtml(slots, entriesBySlotDay, true);
    }
    loadGrid();
  }

  // Student timetable
  if (page === '/timetable-student') {
    document.getElementById('refreshBtn').addEventListener('click', loadGrid);
    document.getElementById('filterTerm').addEventListener('change', loadGrid);

    async function loadGrid() {
      const term = document.getElementById('filterTerm').value;
      const res = await api(`/timetables/student?term=${term}`);
      const container = document.getElementById('ttGrid');
      if (!res || !res.data || !res.data.data || !res.data.data.length) {
        container.innerHTML = '<p class="muted">No timetable entries found for you this term.</p>';
        return;
      }
      const slotRes = await api('/academic-context');
      const slots = (slotRes && slotRes.data && slotRes.data.data && slotRes.data.data.slots) || [];
      const entriesBySlotDay = {};
      for (const e of res.data.data) {
        if (!entriesBySlotDay[e.time_slot_id]) entriesBySlotDay[e.time_slot_id] = {};
        if (!entriesBySlotDay[e.time_slot_id][e.day_of_week]) entriesBySlotDay[e.time_slot_id][e.day_of_week] = [];
        entriesBySlotDay[e.time_slot_id][e.day_of_week].push(e);
      }
      container.innerHTML = buildGridHtml(slots, entriesBySlotDay, false);
    }
    loadGrid();
  }
})();
