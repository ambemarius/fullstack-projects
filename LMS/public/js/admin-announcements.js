// Admin home: school announcements shown in the notification bell (post, list, remove).
(() => {
  const form = document.getElementById('annForm');
  if (!form) return;
  const $ = id => document.getElementById(id);
  const tr = s => (window.t ? window.t(s) : s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const say = (text, kind) => { $('annMsg').textContent = text; $('annMsg').className = 'msg' + (kind ? ' ' + kind : ''); };
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const plusDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  $('annStarts').value = today;
  $('annEnds').value = plusDays(today, 7);
  const AUD = { everyone: 'Everyone', staff: 'All staff', teachers: 'Teachers', students: 'Students', parents: 'Parents' };
  const STATE = { showing: 'Showing now', upcoming: 'Upcoming', ended: 'Ended' };

  async function load() {
    const res = await api('/notifications/announcements');
    if (!res.ok) { $('annList').innerHTML = ''; return; }
    const rows = res.data.data;
    $('annList').innerHTML = rows.length ? rows.map(r => `<li class="ann-${esc(r.state)}">
        <div><b>${esc(r.title)}</b>${r.body ? `<p>${esc(r.body)}</p>` : ''}
        <small>${esc(tr(AUD[r.audience] || r.audience))} · ${esc(r.starts_on)} → ${esc(r.ends_on)} · <span class="ann-state">${esc(tr(STATE[r.state]))}</span></small></div>
        <button type="button" class="btn btn-secondary btn-sm" data-remove="${r.id}">${esc(tr('Remove'))}</button></li>`).join('')
      : `<li class="muted">${esc(tr('No announcements yet.'))}</li>`;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const res = await api('/notifications/announcements', { method: 'POST', body: JSON.stringify({
      title: $('annTitleInput').value, body: $('annBody').value, audience: $('annAudience').value, startsOn: $('annStarts').value, endsOn: $('annEnds').value,
    }) });
    if (!res.ok) return say(res.data.message || 'Could not post the announcement.', 'error');
    $('annTitleInput').value = ''; $('annBody').value = '';
    say(tr('Announcement posted.'), 'ok');
    load();
  });
  $('annList').addEventListener('click', async e => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    const res = await api('/notifications/announcements/' + b.dataset.remove, { method: 'DELETE' });
    if (!res.ok) return say(res.data.message || 'Could not remove it.', 'error');
    say(tr('Announcement removed.'), 'ok');
    load();
  });
  load();
})();
