// Record payment: share the amount received across the open fees (earliest due first), keep a running total,
// and require a reference for non-cash methods. The server checks everything again before saving.
(() => {
  const form = document.getElementById('payForm');
  if (!form) return;
  const total = document.getElementById('payTotal');
  const lines = Array.from(form.querySelectorAll('.pay-line'));
  const applied = document.getElementById('payApplied');
  const check = document.getElementById('payCheck');
  const save = document.getElementById('paySave');
  const method = document.getElementById('payMethod');
  const reference = document.getElementById('payReference');
  const refHint = document.getElementById('payRefHint');
  const owed = BigInt(form.dataset.owed || '0');
  const money = n => new Intl.NumberFormat('en-CM').format(n) + ' XAF';
  const whole = v => (/^\d{1,12}$/.test(String(v).trim()) ? BigInt(String(v).trim()) : null);

  // Fill the lines from the amount received, in table order (earliest due first).
  function share() {
    let left = whole(total.value) ?? 0n;
    for (const line of lines) {
      const balance = BigInt(line.dataset.balance);
      const take = left > balance ? balance : left;
      line.value = take > 0n ? String(take) : '';
      left -= take;
    }
    refresh();
  }

  function refresh() {
    let sum = 0n, problem = '';
    for (const line of lines) {
      line.classList.remove('is-invalid');
      if (line.value.trim() === '') continue;
      const v = whole(line.value);
      if (v === null) { problem = 'Use whole CFA francs, with no decimals or spaces.'; line.classList.add('is-invalid'); continue; }
      if (v > BigInt(line.dataset.balance)) { problem = `A line is more than what is owed on that fee (${money(BigInt(line.dataset.balance))}).`; line.classList.add('is-invalid'); }
      sum += v;
    }
    applied.textContent = money(sum);
    const received = whole(total.value);
    if (!problem && received !== null && received > owed) problem = `The student owes ${money(owed)}. Record only what is owed; refund or keep the difference outside the system.`;
    else if (!problem && received !== null && sum !== received) problem = `The fees add up to ${money(sum)}, not the ${money(received)} received. Adjust a line or the amount received.`;
    check.textContent = problem || (sum > 0n ? `${money(sum)} will be recorded and a receipt printed.` : '');
    check.className = 'pay-check' + (problem ? ' is-error' : sum > 0n ? ' is-ok' : '');
    save.disabled = Boolean(problem) || sum === 0n;
  }

  function referenceRule() {
    const cash = method.value === 'cash';
    reference.required = !cash;
    refHint.textContent = cash ? '(optional for cash)' : '(required)';
  }

  total.addEventListener('input', share);
  lines.forEach(line => line.addEventListener('input', refresh));
  method.addEventListener('change', referenceRule);
  form.addEventListener('submit', event => { refresh(); if (save.disabled) event.preventDefault(); });
  referenceRule();
  refresh();
})();
