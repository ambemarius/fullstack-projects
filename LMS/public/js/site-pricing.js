// KodoSchool public site: pricing page.
(() => {
{
  /* ====== PRICING SETTINGS ====== */
  const PRICING = {
    flatYear: 50000,          // flat price per academic year for small schools, and the minimum for every school...
    flatUpTo: 300,            // ...with up to this many students
    // Larger schools: every student is charged at the rate of the school's band (XAF per student per school month).
    bands: [
      { upTo: Infinity, rate: 17 },  // more than 300 students
    ],
    schoolMonths: 9,          // school months billed in a year
    earlyDiscount: 5,         // % off when the year is paid before school starts
    quoteAbove: 3000,         // above this many students, show "custom quote"
    whatsapp: "2376XXXXXXXX"  // your WhatsApp number in international format, digits only
  };

  const $ = id => document.getElementById(id);
  const fmt = n => Math.round(n).toLocaleString("en-US") + " XAF";
  let pay = "once";
  $("pcEarlyPct").textContent = PRICING.earlyDiscount;
  document.querySelector(".pc-in .hint b").textContent = `${fmt(PRICING.flatYear)} per academic year`;

  function update(n) {
    n = Math.max(1, Math.min(10000, Math.round(+n || 1)));
    const big = n > PRICING.quoteAbove;
    const band = n <= PRICING.flatUpTo ? null : PRICING.bands.find(b => n <= b.upTo);
    const perStudent = band ? n * band.rate * PRICING.schoolMonths : 0;
    // 50,000 XAF is the minimum: a school just over 300 never pays less than one with 300.
    const flat = !band || perStudent <= PRICING.flatYear;
    const base = flat ? PRICING.flatYear : perStudent;
    const early = $("pcEarly").checked && pay === "once";
    const total = early ? base * (1 - PRICING.earlyDiscount / 100) : base;

    $("pcTotal").textContent = big ? "Custom quote" : fmt(total);
    document.querySelector(".pc-price span").style.display = big ? "none" : "";
    $("pcWas").textContent = early && !big ? `Instead of ${fmt(base)}, you save ${fmt(base - total)}` : "";
    $("pcInst").textContent = big ? `For ${n.toLocaleString("en-US")} students we price to your school's size.`
      : pay === "inst" ? `or 2 instalments of ${fmt(total / 2)} · all included for ${n.toLocaleString("en-US")} students`
      : `Paid in one go · all included for ${n.toLocaleString("en-US")} students`;
    $("pcBasis").textContent = big ? "" : flat
      ? (band ? `Minimum price: ${n.toLocaleString("en-US")} × ${fmt(band.rate)} × ${PRICING.schoolMonths} months comes to ${fmt(perStudent)}`
              : `Flat rate for schools with up to ${PRICING.flatUpTo} students`)
      : `${n.toLocaleString("en-US")} students × ${fmt(band.rate)} per month × ${PRICING.schoolMonths} school months (schools with more than ${PRICING.flatUpTo} students)`;
    $("pcMonth").textContent = big ? "On quote" : fmt(flat ? total / n / PRICING.schoolMonths : band.rate);

    const msg = `Hello, I would like a KodoSchool quote for my school: ${n} students, ` +
      (pay === "inst" ? "paid in 2 instalments." : "paid in one go.");
    $("pcQuote").href = `https://wa.me/${PRICING.whatsapp}?text=${encodeURIComponent(msg)}`;
  }

  const num = $("pcNum"), range = $("pcRange");
  num.addEventListener("input", () => { range.value = Math.min(3000, +num.value || 50); update(num.value); });
  range.addEventListener("input", () => { num.value = range.value; update(range.value); });
  document.querySelectorAll(".stud-step").forEach(b => b.addEventListener("click", () => {
    num.value = Math.max(1, (+num.value || 0) + +b.dataset.step);
    range.value = Math.min(3000, num.value); update(num.value);
  }));
  document.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => {
    pay = b.dataset.pay;
    document.querySelectorAll(".seg button").forEach(x => x.setAttribute("aria-pressed", x === b));
    $("pcEarly").disabled = pay === "inst";
    $("pcEarly").closest(".early").style.opacity = pay === "inst" ? .5 : 1;
    update(num.value);
  }));
  $("pcEarly").addEventListener("change", () => update(num.value));
  update(num.value);
}
})();
