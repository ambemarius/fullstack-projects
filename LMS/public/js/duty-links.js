// Shows a teacher's school duties (bursar, librarian, ...) with links to the tools that exist.
(async function () {
  const card = document.getElementById('dutyCard');
  if (!card) return;
  const TOOLS = { bursar: ['Finance', '/finance'], librarian: ['Library', '/library'], lab_attendant: ['Laboratory', '/laboratory'], discipline_master: ['Attendance', '/attendance'] };
  const res = await api('/staff-duties/mine');
  const duties = (res.ok && res.data.data.duties) || [];
  if (!duties.length) return;
  document.getElementById('dutyLinks').innerHTML = duties.map(d => {
    const [title, href] = TOOLS[d.duty] || [d.label, null];
    return '<section class="duty-item"><div><h3>' + esc(d.label) + ' &middot; ' + esc(title) + '</h3></div>' +
      (href ? '<a class="btn btn-sm" href="' + esc(href) + '">Open ' + esc(title) + '</a>' : '<span class="badge">Not yet available</span>') + '</section>';
  }).join('');
  card.hidden = false;
})();
