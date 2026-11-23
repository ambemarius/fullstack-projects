// Batch charges: choosing a class selects its students and offers the fees set on that class.
(() => {
  const form = document.getElementById('batchForm');
  if (!form) return;
  const classSel = document.getElementById('batchClass');
  const feeSel = document.getElementById('batchFee');
  const yearSel = document.getElementById('batchYear');
  const description = document.getElementById('batchDescription');
  const amountInput = document.getElementById('batchAmount');
  const count = document.getElementById('batchCount');
  const rows = Array.from(document.querySelectorAll('#batchStudents label[data-class]'));
  const money = n => new Intl.NumberFormat('en-CM').format(Number(n)) + ' XAF';

  function updateCount() {
    const n = rows.filter(r => r.querySelector('input').checked).length;
    count.textContent = n ? '(' + n + ' selected)' : '';
  }

  classSel.addEventListener('change', () => {
    const classId = classSel.value;
    rows.forEach(row => {
      const inClass = !classId || row.dataset.class === classId;
      row.hidden = !inClass;
      row.querySelector('input').checked = Boolean(classId) && inClass;
    });
    const fees = classId ? JSON.parse(classSel.selectedOptions[0].dataset.fees || '[]') : [];
    feeSel.innerHTML = '';
    feeSel.add(new Option(fees.length ? 'Choose a fee' : classId ? 'No fees set on this class' : 'Choose a class first', ''));
    fees.forEach(f => feeSel.add(new Option(f.label + ' — ' + money(f.amount), f.amount)));
    feeSel.disabled = !fees.length;
    updateCount();
  });

  feeSel.addEventListener('change', () => {
    if (!feeSel.value) return;
    const label = feeSel.selectedOptions[0].text.split(' — ')[0];
    const year = yearSel.value ? yearSel.selectedOptions[0].text.replace(/\s*\(current\)$/, '') : '';
    description.value = year ? label + ' ' + year : label;
    amountInput.value = feeSel.value;
  });

  rows.forEach(r => r.querySelector('input').addEventListener('change', updateCount));
})();
