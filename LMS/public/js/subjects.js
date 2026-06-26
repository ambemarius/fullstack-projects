const rows = document.getElementById('rows');
const msg = document.getElementById('msg');

async function loadSubjects() {
  const { ok, data } = await api('/subjects');
  if (!ok) { rows.innerHTML = '<tr><td colspan="4" class="muted">Failed to load</td></tr>'; return; }
  if (!data.data.length) { rows.innerHTML = '<tr><td colspan="4" class="muted">No subjects yet</td></tr>'; return; }
  rows.innerHTML = data.data.map(s => `
    <tr>
      <td>${s.id}</td>
      <td>${esc(s.name)}</td>
      <td>${esc(s.code)}</td>
      <td>${esc(s.description)}</td>
    </tr>`).join('');
}

document.getElementById('createForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = ''; msg.className = 'msg';
  const $ = (id) => document.getElementById(id);
  const body = {
    name: $('name').value.trim(),
    code: $('code').value.trim(),
    description: $('description').value.trim(),
  };
  const { ok, data } = await api('/subjects', { method: 'POST', body: JSON.stringify(body) });
  if (!ok) { msg.textContent = data.message || 'Failed'; msg.className = 'msg error'; return; }
  msg.textContent = 'Subject created'; msg.className = 'msg ok';
  e.target.reset();
  loadSubjects();
});

loadSubjects();
