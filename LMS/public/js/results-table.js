// Shared results table for the student and parent panels:
// one row per subject, one column per sequence, then the average and grade.
// Sequences are numbered across the year: First term = Seq. 1 & 2, Second = 3 & 4, Third = 5 & 6.
//   ResultsTable.pickYear(rows)            -> { rows, yearName }   (the current academic year, else the latest)
//   ResultsTable.render({ table, empty, note, rows, term, yearName })
(function () {
  const TERMS = ['First', 'Second', 'Third'];

  function gradeFor(score, max) {
    if (score === null || score === undefined || !max) return '—';
    const pct = (Number(score) / Number(max)) * 100;
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B';
    if (pct >= 60) return 'C';
    if (pct >= 50) return 'D';
    return 'F';
  }
  const on20 = r => {
    if (r.score === null || r.score === undefined) return null;
    const max = Number(r.max_score ?? r.maxScore ?? 20) || 20;
    return (Number(r.score) / max) * 20;
  };
  const yearSeq = r => {
    const t = TERMS.findIndex(x => x.toLowerCase() === String(r.term || '').toLowerCase());
    const n = Number(r.sequence);
    return t >= 0 && n >= 1 && n <= 2 ? t * 2 + n : null;
  };
  const fmt = v => (v === null || v === undefined ? '<span class="muted">—</span>' : esc(v.toFixed(2).replace(/\.00$/, '')));
  const mean = list => { const v = list.filter(x => x !== null && x !== undefined); return v.length ? v.reduce((t, x) => t + x, 0) / v.length : null; };

  function pickYear(all) {
    const years = [...new Set(all.map(r => r.yearId))];
    if (years.length <= 1) return { rows: all, yearName: (all[0] && all[0].yearName) || '' };
    const current = all.find(r => r.yearIsCurrent);
    const year = current ? current.yearId : Math.max(...years.filter(y => y !== null && y !== undefined));
    const rows = all.filter(r => r.yearId === year);
    return { rows, yearName: (rows[0] && rows[0].yearName) || '' };
  }

  function render({ table, empty, note, rows: all, term, yearName, who = 'your' }) {
    const t = TERMS.indexOf(term);
    const seqs = t >= 0 ? [t * 2 + 1, t * 2 + 2] : [1, 2, 3, 4, 5, 6];
    const rows = all.filter(r => seqs.includes(yearSeq(r)));
    if (!rows.length) {
      table.style.display = 'none';
      empty.style.display = '';
      return;
    }
    table.style.display = '';
    empty.style.display = 'none';

    const subjects = new Map();
    for (const r of rows) {
      const name = r.subjectName || r.subject_name || r.subjectCode || 'Subject';
      if (!subjects.has(name)) subjects.set(name, {});
      subjects.get(name)[yearSeq(r)] = on20(r);
    }
    const avgLabel = t >= 0 ? 'Average Seq. ' + seqs.join(' & ') : 'Year average';
    table.querySelector('thead').innerHTML = '<tr><th>Subject</th>' + seqs.map(n => '<th class="num">Seq. ' + n + '</th>').join('') +
      '<th class="num sp-avg">' + esc(avgLabel) + '</th><th class="num">Grade</th></tr>';

    const lines = [...subjects.entries()].sort((x, y) => x[0].localeCompare(y[0]));
    table.querySelector('tbody').innerHTML = lines.map(([name, marks]) => {
      const avg = mean(seqs.map(n => marks[n]));
      return '<tr><td>' + esc(name) + '</td>' + seqs.map(n => '<td class="num' + (marks[n] !== undefined && marks[n] !== null && marks[n] < 10 ? ' sp-low' : '') + '">' + fmt(marks[n]) + '</td>').join('') +
        '<td class="num sp-avg' + (avg !== null && avg < 10 ? ' sp-low' : '') + '"><strong>' + fmt(avg) + '</strong></td>' +
        '<td class="num">' + esc(avg === null ? '—' : gradeFor(avg, 20)) + '</td></tr>';
    }).join('');

    // Bottom line: the average of every subject for each sequence, and overall.
    const colAvg = n => mean(lines.map(([, m]) => m[n]));
    const overall = mean(lines.map(([, m]) => mean(seqs.map(n => m[n]))));
    table.querySelector('tfoot').innerHTML = '<tr><th>Average' + (t >= 0 ? ' (' + esc(term) + ' term)' : '') + '</th>' +
      seqs.map(n => '<th class="num">' + fmt(colAvg(n)) + '</th>').join('') +
      '<th class="num sp-avg">' + fmt(overall) + ' / 20</th><th class="num">' + esc(overall === null ? '—' : gradeFor(overall, 20)) + '</th></tr>';
    if (note) {
      note.textContent = 'Sequence marks out of 20 entered by ' + who + ' teachers' + (yearName ? ' for ' + yearName : '') +
        '. Averages use the sequences that have a mark. Ask the class master if a mark is missing.';
    }
  }

  window.ResultsTable = { render, pickYear, gradeFor };
})();
