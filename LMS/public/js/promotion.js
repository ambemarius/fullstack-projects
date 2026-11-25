// End-of-year promotion: preview each student with the bulletin's annual average and a proposed decision,
// let the administrator apply the class council's decisions, then move the class in one step.
(function () {
  const $ = id => document.getElementById(id);
  const classSel = $('prClass'), yearSel = $('prYear'), msg = $('prMsg');
  let preview = null;
  const say = (text, kind) => { msg.textContent = text; msg.className = 'msg' + (kind ? ' ' + kind : ''); };
  const num = v => (v === null || v === undefined ? '—' : Number(v).toFixed(2));
  const LABEL = { promote: 'Promote', repeat: 'Repeat', graduate: 'Graduate' };

  Promise.all([api('/classes'), api('/academic-years')]).then(([classesRes, yearsRes]) => {
    const classes = (classesRes.ok && classesRes.data.data) || [];
    const years = (yearsRes.ok && yearsRes.data.data) || [];
    classSel.innerHTML = '<option value="">Choose a class…</option>' + classes
      .sort((a, b) => String(a.section).localeCompare(b.section) || (a.rank || 0) - (b.rank || 0) || String(a.name).localeCompare(b.name))
      .map(c => `<option value="${esc(c.id)}">${esc(c.section)} — ${esc(c.name)}${c.stream && c.stream !== 'Normal' ? ' (' + esc(c.stream) + ')' : ''}</option>`).join('');
    yearSel.innerHTML = years.map(y => `<option value="${esc(y.id)}"${y.isCurrent ? ' selected' : ''}>${esc(y.name)}${y.isCurrent ? ' (current)' : ''}</option>`).join('');
  });

  function decisionsOffered() {
    return preview.class.finalYear ? ['graduate', 'repeat'] : ['promote', 'repeat'];
  }

  function summarise() {
    const picks = [...document.querySelectorAll('[data-decision]')].map(s => s.value);
    const c = { promote: 0, repeat: 0, graduate: 0 };
    picks.forEach(p => { c[p] += 1; });
    const parts = preview.class.finalYear
      ? [`<b>${c.graduate}</b> graduate`, `<b>${c.repeat}</b> repeat`]
      : [`<b>${c.promote}</b> promoted`, `<b>${c.repeat}</b> repeat`];
    $('prSummary').innerHTML = `<strong>${esc(preview.class.label)}</strong> · ${preview.students.length} students · ${parts.join(' · ')}` +
      (preview.missingAverages ? ` · <span class="pr-warn">${preview.missingAverages} without an annual average (marks missing)</span>` : '');
    $('prDestRow').hidden = preview.class.finalYear || !c.promote;
  }

  function render() {
    $('prResult').hidden = false;
    const next = $('prNext');
    next.innerHTML = preview.nextClasses.map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('');
    $('prNextYear').textContent = preview.nextYear ? `for ${preview.nextYear.name}` : '';
    const offered = decisionsOffered();
    $('prRows').innerHTML = preview.students.map(s => `<tr>
        <td>${s.rank || '—'}</td>
        <td><b>${esc(s.name)}</b><br><small class="muted">${esc(s.matricule)}${s.repeater ? ' · repeater' : ''}</small></td>
        ${s.terms.map(t => `<td class="n${t !== null && t < preview.passMark ? ' pr-low' : ''}">${num(t)}</td>`).join('')}
        <td class="n"><b class="${s.annual !== null && s.annual < preview.passMark ? 'pr-low' : ''}">${num(s.annual)}</b></td>
        <td><select data-decision="${s.id}" aria-label="Decision for ${esc(s.name)}" title="${esc(s.reason)}">
          ${offered.map(d => `<option value="${d}"${d === s.decision ? ' selected' : ''}>${LABEL[d]}</option>`).join('')}
        </select></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No students in this class for this year (already promoted, or none enrolled).</td></tr>';
    const blocked = !preview.nextYear;
    $('prApply').disabled = blocked || !preview.students.length;
    $('prApplyNote').textContent = blocked ? `Create the academic year after ${preview.year.name} first (Registration → Academic years).` : 'Moves the class in one step. It cannot be undone from this page.';
    summarise();
  }

  $('prForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!classSel.value || !yearSel.value) return say('Choose a class and the school year that is ending.', 'error');
    say('Loading students and averages…');
    $('prResult').hidden = true;
    const res = await api(`/promotion/preview?classId=${encodeURIComponent(classSel.value)}&yearId=${encodeURIComponent(yearSel.value)}`);
    if (!res.ok) return say((res.data && res.data.message) || 'Could not load the class.', 'error');
    preview = res.data.data;
    say('');
    render();
  });

  $('prRows').addEventListener('change', e => { if (e.target.matches('[data-decision]')) summarise(); });

  $('prApply').addEventListener('click', async () => {
    const decisions = Object.fromEntries([...document.querySelectorAll('[data-decision]')].map(s => [s.dataset.decision, s.value]));
    const values = Object.values(decisions);
    const promoted = values.filter(v => v === 'promote').length, repeat = values.filter(v => v === 'repeat').length, graduate = values.filter(v => v === 'graduate').length;
    const nextLabel = $('prNext').selectedOptions[0] ? $('prNext').selectedOptions[0].textContent : '';
    const text = preview.class.finalYear
      ? `${preview.class.label}: ${graduate} graduate and ${repeat} repeat in ${preview.nextYear.name}. Continue?`
      : `${preview.class.label}: ${promoted} move to ${nextLabel} and ${repeat} repeat, for ${preview.nextYear.name}. Continue?`;
    if (!confirm(text)) return;
    $('prApply').disabled = true;
    say('Applying…');
    const res = await api('/promotion/apply', { method: 'POST', body: JSON.stringify({ classId: preview.class.id, yearId: preview.year.id, nextClassId: Number($('prNext').value) || null, decisions }) });
    if (!res.ok) { $('prApply').disabled = false; return say((res.data && res.data.message) || 'Promotion failed.', 'error'); }
    const d = res.data.data;
    say(`Done for ${d.class}: ${d.promoted} promoted${d.nextClass ? ' to ' + d.nextClass : ''}, ${d.repeating} repeating, ${d.graduated} graduated (${d.nextYear}).`, 'ok');
    $('prResult').hidden = true;
  });
})();
