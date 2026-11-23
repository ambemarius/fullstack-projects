// Bulletin (printable report card) settings inside Admin -> Evaluation -> Report cards:
// heading, logo/signature, reopening dates, subject bands, discipline records and council remarks.
// Data loads the first time a section is opened, so the dashboard makes no extra requests until then.
(function () {
  const root = document.getElementById('bulletinSettings');
  if (!root) return;
  const $ = id => document.getElementById(id);
  const say = (id, text, kind) => { const el = $(id); el.textContent = text; el.className = 'msg' + (kind ? ' ' + kind : ''); };
  const fail = (id, res, fallback) => say(id, (res.data && res.data.message) || fallback, 'error');
  const FIELDS = ['name_en', 'name_fr', 'address_line', 'watermark_text', 'footer_text', 'country_en', 'country_fr', 'motto_en', 'motto_fr', 'ministry_en', 'ministry_fr'];
  const TERMS = ['First', 'Second', 'Third'];
  const loaded = new Set();

  root.querySelectorAll(':scope > details').forEach(box => box.addEventListener('toggle', () => {
    if (!box.open || loaded.has(box.id)) return;
    loaded.add(box.id);
    ({ rcHeadBox: loadSettings, rcReopenBox: loadYears, rcBandsBox: loadBandsData, rcDiscBox: () => {} })[box.id]?.();
  }));

  // ---- heading, logo and signature ----
  function showImage(kind, file) {
    $(kind + 'Preview').innerHTML = file ? `<img src="/files/${encodeURIComponent(file)}" alt="${kind === 'logo' ? 'School logo' : 'Signature'}">` : `<span class="muted">No ${kind}</span>`;
  }
  function fillSettings(s) {
    for (const f of FIELDS) $('s_' + f).value = s[f] || '';
    if (!s.name_en) $('s_name_en').placeholder = s.school_name || '';
    if (!s.name_fr) $('s_name_fr').placeholder = s.school_name || '';
    showImage('logo', s.logo_file);
    showImage('signature', s.signature_file);
  }
  async function loadSettings() {
    const res = await api('/report-cards/settings');
    if (res.ok) fillSettings(res.data.data); else fail('settingsMsg', res, 'Could not load the heading.');
  }
  $('settingsForm').addEventListener('submit', async e => {
    e.preventDefault();
    const res = await api('/report-cards/settings', { method: 'PUT', body: JSON.stringify(Object.fromEntries(FIELDS.map(f => [f, $('s_' + f).value]))) });
    if (!res.ok) return fail('settingsMsg', res, 'Could not save the heading.');
    fillSettings(res.data.data);
    say('settingsMsg', 'Heading saved.', 'ok');
  });
  root.querySelectorAll('[data-upload]').forEach(btn => btn.addEventListener('click', async () => {
    const kind = btn.dataset.upload, input = $(kind + 'File');
    if (!input.files.length) return say('imageMsg', 'Choose an image file first.', 'error');
    const form = new FormData();
    form.append('image', input.files[0]);
    const token = getToken();
    const res = await fetch('/api/v1/report-cards/settings/' + kind, { method: 'POST', body: form, headers: token ? { Authorization: 'Bearer ' + token } : {} });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return say('imageMsg', data.message || 'Upload failed.', 'error');
    input.value = '';
    showImage(kind, data.data[kind + '_file']);
    say('imageMsg', kind === 'logo' ? 'Logo uploaded.' : 'Signature uploaded.', 'ok');
  }));
  root.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', async () => {
    const kind = btn.dataset.remove;
    const res = await api('/report-cards/settings/' + kind, { method: 'DELETE' });
    if (!res.ok) return fail('imageMsg', res, 'Could not remove the image.');
    showImage(kind, null);
    say('imageMsg', 'Image removed.', 'ok');
  }));

  // ---- reopening dates ----
  async function loadYears() {
    // Same year list as the tab's own Academic Year selector.
    const source = $('rcYear');
    $('rYear').innerHTML = source ? source.innerHTML : '<option value="">-- Select --</option>';
    if (source && source.value) $('rYear').value = source.value;
    else {
      const res = await api('/timetables/form-data');
      if (res.ok) $('rYear').innerHTML = '<option value="">-- Select --</option>' + res.data.data.academicYears
        .map(y => `<option value="${y.id}"${y.isCurrent ? ' selected' : ''}>${esc(y.name)}${y.isCurrent ? ' (current)' : ''}</option>`).join('');
    }
    loadReopening();
  }
  async function loadReopening() {
    for (const t of TERMS) $('r' + t).value = '';
    if (!$('rYear').value) return;
    const res = await api('/report-cards/reopening/' + $('rYear').value);
    if (!res.ok) return fail('reopenMsg', res, 'Could not load the dates.');
    for (const t of TERMS) $('r' + t).value = res.data.data[t] || '';
  }
  $('rYear').addEventListener('change', loadReopening);
  $('reopenForm').addEventListener('submit', async e => {
    e.preventDefault();
    for (const t of TERMS) {
      const res = await api('/report-cards/reopening', { method: 'PUT', body: JSON.stringify({ yearId: +$('rYear').value, term: t, reopeningDate: $('r' + t).value || null }) });
      if (!res.ok) return fail('reopenMsg', res, 'Could not save the dates.');
    }
    say('reopenMsg', 'Reopening dates saved.', 'ok');
  });

  // ---- subject bands ----
  let bands = [], subjects = [];
  const assignment = new Map(); // subjectId -> { band: index or -1, order }
  function renderBands() {
    $('bandRows').innerHTML = bands.length ? bands.map((b, i) => `<tr>
        <td><input data-band-name="${i}" value="${esc(b.name)}" maxlength="80" aria-label="Band ${i + 1} name"></td>
        <td><input type="number" min="0" max="20" class="rc-count" data-band-rows="${i}" value="${b.min_rows}" aria-label="Band ${i + 1} minimum rows"></td>
        <td><button type="button" class="reg-btn reg-btn-gray" data-band-remove="${i}">Remove</button></td></tr>`).join('')
      : '<tr><td colspan="3" class="muted">No bands yet: every subject prints in one list.</td></tr>';
    const options = (selected) => ['<option value="-1">— Other subjects —</option>', ...bands.map((b, i) => `<option value="${i}">${esc(b.name || 'Band ' + (i + 1))}</option>`)]
      .map(o => (o.includes(`value="${selected}"`) ? o.replace('<option ', '<option selected ') : o)).join('');
    $('subjectRows').innerHTML = subjects.map(s => {
      const a = assignment.get(s.id) || { band: -1, order: 0 };
      return `<tr><td>${esc(s.name)} <span class="muted">${esc(s.code || '')}</span></td>
        <td><select data-subject-band="${s.id}" aria-label="Band for ${esc(s.name)}">${options(a.band)}</select></td>
        <td><input type="number" min="0" max="99" class="rc-count" data-subject-order="${s.id}" value="${a.order}" aria-label="Order of ${esc(s.name)}"></td></tr>`;
    }).join('');
  }
  function readBandInputs() {
    root.querySelectorAll('[data-band-name]').forEach(el => { bands[+el.dataset.bandName].name = el.value; });
    root.querySelectorAll('[data-band-rows]').forEach(el => { bands[+el.dataset.bandRows].min_rows = +el.value || 0; });
    root.querySelectorAll('[data-subject-band]').forEach(el => {
      const sid = +el.dataset.subjectBand;
      assignment.set(sid, { ...(assignment.get(sid) || { order: 0 }), band: +el.value });
    });
    root.querySelectorAll('[data-subject-order]').forEach(el => {
      const sid = +el.dataset.subjectOrder;
      assignment.set(sid, { ...(assignment.get(sid) || { band: -1 }), order: +el.value || 0 });
    });
  }
  function applyBands(data) {
    bands = data.groups.map(g => ({ name: g.name, min_rows: g.min_rows }));
    subjects = data.subjects;
    assignment.clear();
    data.groups.forEach((g, bi) => g.subjects.forEach((sid, order) => assignment.set(sid, { band: bi, order: order + 1 })));
    renderBands();
  }
  async function loadBandsData() {
    const res = await api('/report-cards/groups');
    if (res.ok) applyBands(res.data.data); else fail('bandsMsg', res, 'Could not load the bands.');
  }
  $('addBand').addEventListener('click', () => { readBandInputs(); bands.push({ name: '', min_rows: 0 }); renderBands(); });
  $('bandRows').addEventListener('click', e => {
    const i = e.target.dataset && e.target.dataset.bandRemove;
    if (i === undefined) return;
    readBandInputs();
    const removed = +i;
    bands.splice(removed, 1);
    for (const [sid, a] of assignment) {
      if (a.band === removed) assignment.set(sid, { ...a, band: -1 });
      else if (a.band > removed) assignment.set(sid, { ...a, band: a.band - 1 });
    }
    renderBands();
  });
  $('subjectRows').addEventListener('change', readBandInputs);
  $('bandRows').addEventListener('input', () => {
    readBandInputs();
    root.querySelectorAll('[data-subject-band] option').forEach(o => { const i = +o.value; if (i >= 0) o.textContent = bands[i].name || 'Band ' + (i + 1); });
  });
  $('saveBands').addEventListener('click', async () => {
    readBandInputs();
    const groups = bands.map((b, i) => ({
      name: b.name, min_rows: b.min_rows,
      subjects: subjects.filter(s => (assignment.get(s.id) || {}).band === i)
        .sort((x, y) => (assignment.get(x.id).order - assignment.get(y.id).order) || x.name.localeCompare(y.name)).map(s => s.id),
    }));
    const res = await api('/report-cards/groups', { method: 'PUT', body: JSON.stringify({ groups }) });
    if (!res.ok) return fail('bandsMsg', res, 'Could not save the bands.');
    applyBands(res.data.data);
    say('bandsMsg', 'Bands saved.', 'ok');
  });

  // ---- discipline and council remarks (uses the tab's Class / Term / Academic Year) ----
  let records = null;
  $('loadRecords').addEventListener('click', async () => {
    const classId = $('rcClass').value, term = $('rcTerm').value, yearId = $('rcYear').value;
    if (!classId || !term || !yearId) return say('recordsMsg', 'Select the class, term and academic year at the top of this tab first.', 'error');
    const res = await api(`/report-cards/records/${classId}/${term}/${yearId}`);
    if (!res.ok) return fail('recordsMsg', res, 'Could not load the students.');
    records = res.data.data;
    renderRecords();
    say('recordsMsg', records.students.length ? `${records.students.length} students · ${term} term` : 'No students in this class.', '');
  });
  function renderRecords() {
    $('recordsTable').hidden = !records.students.length;
    $('saveRecords').hidden = !records.students.length;
    $('recordRows').innerHTML = records.students.map((s, i) => `<tr>
      <td>${esc(s.name)}</td><td>${esc(s.matricule)}</td><td>${esc(s.absences)}</td>
      <td><input type="checkbox" data-r="${i}" data-f="is_repeater"${s.is_repeater ? ' checked' : ''} aria-label="${esc(s.name)} is repeating"></td>
      ${['council_attendance', 'warnings', 'suspensions'].map(f => `<td><input type="number" min="0" max="99" class="rc-count" data-r="${i}" data-f="${f}" value="${s[f]}" aria-label="${esc(s.name)} ${f.replace('_', ' ')}"></td>`).join('')}
      <td><input data-r="${i}" data-f="council_remark" maxlength="120" value="${esc(s.council_remark)}" placeholder="Automatic" aria-label="${esc(s.name)} class council remark"></td></tr>`).join('');
  }
  $('saveRecords').addEventListener('click', async () => {
    const list = records.students.map(s => ({ studentId: s.studentId }));
    root.querySelectorAll('#recordRows [data-r]').forEach(el => {
      const r = list[+el.dataset.r], f = el.dataset.f;
      r[f] = f === 'is_repeater' ? el.checked : f === 'council_remark' ? el.value : (+el.value || 0);
    });
    const res = await api(`/report-cards/records/${records.classId}/${records.term}/${records.yearId}`, { method: 'PUT', body: JSON.stringify({ records: list }) });
    if (!res.ok) return fail('recordsMsg', res, 'Could not save the records.');
    records = res.data.data;
    renderRecords();
    say('recordsMsg', 'Records saved.', 'ok');
  });

  // "Bulletin settings" button at the top of the tab: open the heading section and scroll to it.
  $('rcSettingsBtn')?.addEventListener('click', () => {
    const box = $('rcHeadBox');
    box.open = true;
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
