(function () {
  // One tool per duty; a duty without a tool (href null) is listed but not linked.
  const TOOLS = {
    bursar: { title: 'Finance', text: 'Record payments and print receipts, charge classes, and follow up outstanding balances.', href: '/finance', quick: ['Record payment', '/finance/pay'] },
    librarian: { title: 'Library', text: 'Catalogue, lending, renewals, returns and overdue books.', href: '/library' },
    lab_attendant: { title: 'Laboratory', text: 'Equipment and stock, teacher requests, issues and returns.', href: '/laboratory' },
    discipline_master: { title: 'Attendance', text: 'Class registers, absence justification, lateness and term totals.', href: '/attendance' },
  };

  document.getElementById('logoutBtn').addEventListener('click', logout);

  function field(label, value) {
    return '<div class="field"><span class="field-label">' + esc(label) + '</span><span class="field-value">' + esc(value || '—') + '</span></div>';
  }

  async function load() {
    const res = await api('/staff-duties/mine');
    if (!res.ok) {
      document.getElementById('welcome').textContent = (res.data && res.data.message) || 'Could not load your account.';
      return;
    }
    const me = res.data.data;
    document.getElementById('welcome').textContent = 'Welcome, ' + me.name;

    if (me.accountType === 'auxiliary') {
      const profile = await api('/auxiliary/profile');
      if (profile.ok) {
        const p = profile.data.data;
        document.getElementById('profile').innerHTML =
          field('Email', p.email) + field('Phone', p.phone) + field('Position', p.role);
      }
    }

    const list = document.getElementById('duties');
    if (!me.duties.length) {
      document.getElementById('dutiesEmpty').hidden = false;
      return;
    }
    list.innerHTML = me.duties.map(function (d) {
      const tool = TOOLS[d.duty] || { title: d.label, text: '', href: null };
      const quick = tool.quick ? '<a class="btn btn-sm" href="' + esc(tool.quick[1]) + '">' + esc(tool.quick[0]) + '</a> ' : '';
      const action = tool.href
        ? '<span class="duty-actions">' + quick + '<a class="btn btn-sm' + (tool.quick ? ' btn-secondary' : '') + '" href="' + esc(tool.href) + '">Open ' + esc(tool.title) + '</a></span>'
        : '<span class="badge">Not yet available</span>';
      return '<section class="duty-item"><div><h3>' + esc(d.label) + ' &middot; ' + esc(tool.title) + '</h3><p>' + esc(tool.text) + '</p></div>' + action + '</section>';
    }).join('');
  }

  load();
})();
