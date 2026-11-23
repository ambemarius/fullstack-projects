// Library loans: student dashboard (own) and parent dashboard (child).
(function () {
  async function load(path, el) {
    const res = await api(path);
    if (!res.ok) { el.innerHTML = '<p class="muted">' + esc((res.data && res.data.message) || 'Library loans are not available.') + '</p>'; return; }
    const { loans, limit } = res.data.data;
    el.innerHTML = loans.length
      ? '<div class="table-wrap"><table><thead><tr><th>Book</th><th>Accession</th><th>Due</th></tr></thead><tbody>' +
        loans.map(l => '<tr><td>' + esc(l.title) + '<br><span class="muted">' + esc(l.author) + '</span></td><td>' + esc(l.accession) + '</td><td>' +
          esc(l.due) + (l.overdue ? ' <span class="badge yes">Overdue</span>' : '') + '</td></tr>').join('') +
        '</tbody></table></div><p class="muted">' + loans.length + ' of ' + limit + ' allowed at a time.</p>'
      : '<p class="muted">No books on loan.</p>';
  }
  window.LibraryLoans = { load };
  const own = document.getElementById('myLoans');
  if (own) load('/library/my-loans', own);
})();
