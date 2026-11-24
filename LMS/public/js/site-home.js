// KodoSchool public site: home page.
(() => {
(() => {
  /* ---------- character builder (plain SVG, no images) ---------- */
  const S = {
    skin1: "#6b4430", skin2: "#4a2e1e", skin3: "#8a5a3c", hair: "#1b120c"
  };
  const st = c => `style="fill:${c}"`;

  function person(o) {
    const skin = o.skin, sleeve = o.outer ? o.outerColor : o.shirt;
    const long = !!o.outer && o.outer !== "vest";
    let g = "";
    // shadow
    g += `<ellipse cx="120" cy="402" rx="60" ry="8" fill="#0b2e23" opacity=".14"/>`;
    // legs
    if (o.bottomType === "skirt") {
      g += `<rect x="92" y="300" width="15" height="92" rx="6" fill="${skin}"/><rect x="133" y="300" width="15" height="92" rx="6" fill="${skin}"/>`;
      g += `<path class="u" ${st(o.bottom)} d="M80 252 H160 L172 324 H68Z"/>`;
      g += `<path d="M98 256 L94 322 M120 256 V322 M142 256 L146 322" stroke="#000" stroke-opacity=".12" stroke-width="1.5"/>`;
    } else {
      g += `<path class="u" ${st(o.bottom)} d="M80 252 H119 L116 392 H88Z"/><path class="u" ${st(o.bottom)} d="M121 252 H160 L152 392 H124Z"/>`;
      g += `<path d="M102 262 V388 M138 262 V388" stroke="#000" stroke-opacity=".1" stroke-width="1.5"/>`;
    }
    g += `<path d="M84 390 h33 v9 h-42 q1 -9 9 -9z" fill="#1d1d1f"/><path d="M123 390 h33 q8 0 9 9 h-42z" fill="#1d1d1f"/>`;
    // torso
    g += `<g class="body">`;
    if (o.outer === "labcoat") {
      g += `<path d="M68 152 Q70 134 96 130 H144 Q170 134 172 152 L180 338 H60Z" fill="#f8fafb" stroke="#d6dee2" stroke-width="1.5"/>`;
    }
    g += `<path class="u" ${st(o.pattern ? "url(#pagne)" : o.shirt)} d="M72 152 Q74 136 98 132 H142 Q166 136 168 152 L162 262 H78Z"/>`;
    if (o.pattern) g += `<path d="M72 152 Q74 136 98 132 H142 Q166 136 168 152 L162 262 H78Z" fill="none" stroke="#0b2e23" stroke-opacity=".15"/>`;
    g += `<path d="M104 132 L120 146 L136 132" stroke="#000" stroke-opacity=".12" stroke-width="2" fill="none"/>`;
    if (o.tie) g += `<path class="u" ${st(o.tie)} d="M116 142 H124 L126 152 L122 204 H118 L114 152Z"/>`;
    if (o.vest) g += `<path class="u" style="fill:${o.vest};opacity:${o.vestOn}" d="M76 160 Q80 140 102 136 L120 176 L138 136 Q160 140 164 160 L160 262 H80Z"/>`;
    if (o.crest) g += `<path class="u" ${st(o.crest)} d="M140 166 l9 3 v6 c0 5 -4 8 -9 9 c-5 -1 -9 -4 -9 -9 v-6z"/>`;
    if (o.bottomType !== "skirt") g += `<rect x="80" y="252" width="80" height="6" fill="#000" opacity=".18"/>`;
    if (o.outer === "labcoat") {
      g += `<path d="M96 130 L112 136 L120 182 L60 338 H76 L106 214" fill="#f8fafb"/><path d="M144 130 L128 136 L120 182 L180 338 H164 L134 214" fill="#f8fafb"/>`;
      g += `<path d="M96 130 L112 138 L120 182 M144 130 L128 138 L120 182 M120 182 V338" stroke="#d6dee2" stroke-width="1.5" fill="none"/>`;
      g += `<rect x="140" y="228" width="22" height="20" rx="2" fill="none" stroke="#d6dee2" stroke-width="1.5"/><rect x="146" y="218" width="3" height="16" rx="1" fill="#1b6b52"/><rect x="151" y="220" width="3" height="14" rx="1" fill="#c62828"/>`;
      g += `<rect x="80" y="282" width="20" height="18" rx="2" fill="none" stroke="#d6dee2" stroke-width="1.5"/>`;
    }
    if (o.outer === "cardigan") {
      g += `<path ${st(o.outerColor)} d="M70 152 Q72 136 98 132 H106 L120 204 L134 132 H142 Q168 136 170 152 L166 270 H74Z"/>`;
      g += `<path d="M106 132 L120 204 L134 132 M120 204 V270" stroke="#000" stroke-opacity=".15" stroke-width="1.5" fill="none"/>`;
      g += `<circle cx="120" cy="220" r="2.4" fill="#f2cf7a"/><circle cx="120" cy="240" r="2.4" fill="#f2cf7a"/><circle cx="120" cy="258" r="2.4" fill="#f2cf7a"/>`;
    }
    if (o.backpack) g += `<path d="M90 136 L86 250 M150 136 L154 250" stroke="#2b2b2e" stroke-width="7" stroke-linecap="round"/>`;
    if (o.lanyard) g += `<path d="M110 136 L138 232 M130 136 L146 232" stroke="#124d3b" stroke-width="3"/><rect x="132" y="228" width="22" height="28" rx="3" fill="#fff" stroke="#d6dee2"/><rect x="132" y="228" width="22" height="7" rx="2" fill="#124d3b"/><rect x="136" y="240" width="14" height="2.5" fill="#c9d3cf"/><rect x="136" y="245" width="10" height="2.5" fill="#c9d3cf"/>`;
    // neck + head
    g += `<rect x="109" y="110" width="22" height="28" rx="9" fill="${skin}"/><path d="M109 128 Q120 136 131 128 V134 Q120 140 109 134Z" fill="#000" opacity=".12"/>`;
    g += `<g class="${o.kid ? "kid-head" : ""}">`;
    g += `<circle cx="86" cy="92" r="7" fill="${skin}"/><circle cx="154" cy="92" r="7" fill="${skin}"/>`;
    if (o.hairStyle === "puffs") g += `<circle cx="86" cy="54" r="17" fill="${S.hair}"/><circle cx="154" cy="54" r="17" fill="${S.hair}"/>`;
    if (o.hairStyle === "bun") g += `<circle cx="120" cy="44" r="15" fill="${S.hair}"/>`;
    g += `<ellipse cx="120" cy="88" rx="34" ry="38" fill="${skin}"/>`;
    if (["short", "puffs", "bun"].includes(o.hairStyle)) g += `<path d="M85 84 Q84 48 120 46 Q156 48 155 84 Q150 64 120 63 Q90 64 85 84Z" fill="${S.hair}"/>`;
    if (o.hairStyle === "wrap") g += `<path ${st("url(#pagne2)")} d="M82 86 Q78 40 120 34 Q162 40 158 86 Q152 60 120 58 Q88 60 82 86Z"/><ellipse cx="146" cy="40" rx="16" ry="11" ${st("url(#pagne2)")}/>`;
    if (o.beard) g += `<path d="M90 98 Q94 128 120 131 Q146 128 150 98 Q142 116 120 117 Q98 116 90 98Z" fill="${S.hair}"/>`;
    if (o.earrings) g += `<circle cx="86" cy="101" r="2.6" fill="#e2b54a"/><circle cx="154" cy="101" r="2.6" fill="#e2b54a"/>`;
    // face
    const ey = o.phone ? 95 : 91;
    g += `<path d="M100 ${ey - 9} q7 -4 14 0 M126 ${ey - 9} q7 -4 14 0" stroke="${S.hair}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`;
    g += `<g class="eyes"><ellipse cx="107" cy="${ey}" rx="3.3" ry="3.8" fill="#1b120c"/><ellipse cx="133" cy="${ey}" rx="3.3" ry="3.8" fill="#1b120c"/></g>`;
    if (o.glasses) g += `<circle cx="107" cy="${ey}" r="9" fill="none" stroke="#2b2b2e" stroke-width="2"/><circle cx="133" cy="${ey}" r="9" fill="none" stroke="#2b2b2e" stroke-width="2"/><path d="M116 ${ey} h8" stroke="#2b2b2e" stroke-width="2"/>`;
    g += `<path d="M118 ${ey + 4} q2 7 -1 9" stroke="#000" stroke-opacity=".25" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    g += `<path d="M109 ${ey + 15} Q120 ${ey + 23} 131 ${ey + 15}" stroke="#2a140a" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    g += `<ellipse cx="98" cy="${ey + 11}" rx="5" ry="3" fill="#e0785a" opacity=".25"/><ellipse cx="142" cy="${ey + 11}" rx="5" ry="3" fill="#e0785a" opacity=".25"/>`;
    g += `</g>`;
    // arms
    const armColor = o.outer === "labcoat" ? "#f8fafb" : sleeve;
    if (o.phone) {
      const L = "M80 152 Q62 194 76 230 Q90 224 105 208", R = "M160 152 Q178 194 164 230 Q150 224 135 208";
      g += `<g class="hold">`;
      g += `<path d="${L}" stroke="${skin}" stroke-width="18" stroke-linecap="round" fill="none"/><path d="${R}" stroke="${skin}" stroke-width="18" stroke-linecap="round" fill="none"/>`;
      if (long) {
        g += `<path class="u" d="M80 152 Q62 194 76 230 Q86 226 96 218" style="stroke:${armColor}" stroke-width="21" stroke-linecap="round" fill="none"/>`;
        g += `<path class="u" d="M160 152 Q178 194 164 230 Q154 226 144 218" style="stroke:${armColor}" stroke-width="21" stroke-linecap="round" fill="none"/>`;
      } else {
        g += `<path class="u" d="M80 152 Q72 168 70 186" style="stroke:${armColor}" stroke-width="22" stroke-linecap="round" fill="none"/>`;
        g += `<path class="u" d="M160 152 Q168 168 170 186" style="stroke:${armColor}" stroke-width="22" stroke-linecap="round" fill="none"/>`;
      }
      g += `<rect x="103" y="172" width="34" height="54" rx="6" fill="#16191a"/><rect class="phs" x="106" y="177" width="28" height="44" rx="3" fill="#dcefe6"/>`;
      g += `<rect x="110" y="184" width="20" height="3" rx="1.5" fill="#124d3b" opacity=".5"/><rect x="110" y="191" width="16" height="3" rx="1.5" fill="#124d3b" opacity=".35"/>`;
      g += `<circle cx="105" cy="208" r="8.5" fill="${skin}"/><circle cx="135" cy="208" r="8.5" fill="${skin}"/>`;
      g += `<ellipse class="thumb" cx="127" cy="200" rx="4" ry="6" fill="${skin}"/>`;
      g += `</g>`;
    } else {
      const L = "M80 152 Q68 200 78 248", R = "M160 152 Q172 200 162 248";
      g += `<path d="${L}" stroke="${skin}" stroke-width="18" stroke-linecap="round" fill="none"/><path d="${R}" stroke="${skin}" stroke-width="18" stroke-linecap="round" fill="none"/>`;
      g += `<path class="u" d="M80 152 Q72 170 71 186" style="stroke:${armColor}" stroke-width="22" stroke-linecap="round" fill="none"/><path class="u" d="M160 152 Q168 170 169 186" style="stroke:${armColor}" stroke-width="22" stroke-linecap="round" fill="none"/>`;
      g += `<circle cx="78" cy="250" r="8.5" fill="${skin}"/><circle cx="162" cy="250" r="8.5" fill="${skin}"/>`;
    }
    g += `</g>`;
    return g;
  }

  const defs = `<defs>
    <pattern id="pagne" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#1b6b52"/><circle cx="11" cy="11" r="6" fill="#f2cf7a"/><circle cx="11" cy="11" r="3" fill="#c0562b"/><circle cx="0" cy="0" r="3" fill="#f2cf7a"/><circle cx="22" cy="0" r="3" fill="#f2cf7a"/><circle cx="0" cy="22" r="3" fill="#f2cf7a"/><circle cx="22" cy="22" r="3" fill="#f2cf7a"/></pattern>
    <pattern id="pagne2" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#8e3b2e"/><path d="M0 8 L8 0 L16 8 L8 16Z" fill="#f2cf7a"/><circle cx="8" cy="8" r="2.5" fill="#1b6b52"/></pattern>
  </defs>`;
  const svg = (inner, w = 340) => `<svg viewBox="0 0 ${w} 420">${defs}${inner}</svg>`;
  const sparkle = `<g class="swap" style="transform-box:fill-box;transform-origin:center"><circle cx="120" cy="200" r="70" fill="none" stroke="#f2cf7a" stroke-width="3" stroke-dasharray="4 10"/><path d="M60 140 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z M180 120 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z M190 250 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#f2cf7a"/></g>`;

  // Student: one person, uniform colours driven by CSS variables so they morph between schools
  document.getElementById("actStudent").innerHTML = svg(`<g transform="translate(30 0)">${person({
    skin: S.skin1, hairStyle: "short", phone: true, backpack: true,
    shirt: "var(--shirt)", bottom: "var(--bottom)", tie: "var(--tie)", crest: "var(--crest)",
    vest: "var(--vest)", vestOn: "var(--vestOn)"
  })}${sparkle}</g>`);

  // Teacher in a lab coat, with a flask on the bench
  document.getElementById("actTeacher").innerHTML = svg(`
    <g transform="translate(250 300)"><rect x="-10" y="40" width="90" height="8" rx="2" fill="#c8b99a"/><rect x="0" y="48" width="6" height="54" fill="#a8997a"/><rect x="64" y="48" width="6" height="54" fill="#a8997a"/>
      <path d="M22 0 h10 v14 l14 24 a4 4 0 0 1 -3.5 6 h-31 a4 4 0 0 1 -3.5 -6 l14 -24z" fill="#e8f3ef" stroke="#9fb9ae" stroke-width="1.5"/><path d="M12 30 h30 l5 8 a4 4 0 0 1 -3.5 6 h-31 a4 4 0 0 1 -3.5 -6z" fill="#2f9a74" opacity=".75"/>
      <rect x="52" y="14" width="10" height="26" rx="2" fill="#e8f3ef" stroke="#9fb9ae" stroke-width="1.5"/><rect x="53.5" y="26" width="7" height="12" fill="#e2b54a" opacity=".8"/></g>
    <g transform="translate(20 0)">${person({ skin: S.skin2, hairStyle: "bun", glasses: true, earrings: true, phone: true,
      shirt: "#d9e6f2", bottom: "#2e3a46", outer: "labcoat", outerColor: "#f8fafb", lanyard: true })}</g>`);

  // Parent with their child (the child is in school uniform)
  document.getElementById("actParent").innerHTML = svg(`
    <g transform="translate(0 0)">${person({ skin: S.skin3, hairStyle: "short", beard: true, phone: true, pattern: true, shirt: "#1b6b52", bottom: "#3b3530" })}</g>
    <g transform="translate(176 158) scale(.6)">${person({ skin: S.skin1, hairStyle: "puffs", kid: true, phone: false, backpack: true,
      shirt: "#cfe2f5", bottom: "#1f3354", bottomType: "skirt", crest: "#124d3b" })}</g>`, 340);

  // Librarian with books
  document.getElementById("actLibrarian").innerHTML = svg(`
    <g transform="translate(244 318)">
      <rect x="0" y="62" width="70" height="14" rx="2" fill="#1b6b52"/><rect x="4" y="48" width="62" height="14" rx="2" fill="#c0562b"/><rect x="0" y="34" width="66" height="14" rx="2" fill="#e2b54a"/><rect x="6" y="20" width="58" height="14" rx="2" fill="#2e3a46"/>
      <path d="M8 66 h54 M10 52 h48 M8 38 h50 M14 24 h42" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/>
      <g transform="rotate(-12 30 10)"><rect x="12" y="0" width="44" height="12" rx="2" fill="#8e3b2e"/></g></g>
    <g transform="translate(20 0)">${person({ skin: S.skin2, hairStyle: "wrap", glasses: true, earrings: true, phone: true,
      shirt: "#f4ecd8", bottom: "#4a3b55", bottomType: "skirt", outer: "cardigan", outerColor: "#7b5b8c", lanyard: true })}</g>`);

  /* ---------- the sequence ---------- */
  const uni = (shirt, bottom, tie, crest, vest = "#000", vestOn = 0) => ({ shirt, bottom, tie, crest, vest, vestOn });
  const steps = [
    { photo: "/images/people/student.jpg", pos: "center 18%", group: "student", actor: "actStudent", school: "Lycée Bilingue", color: "#1f4fa8",
      u: uni("#3d7be0", "#1c2a5a", "#1c2a5a", "#124d3b"),
      label: "Matricule", user: "LB-2026-0416", title: "Student · Form 1", sub: "Signs in with their matricule to see marks and timetable",
      role: "Student · Form 1", body: [["Term average", "13.38"], ["Rank", "1 / 52"], ["Hours missed", "2"]] },
    { photo: "/images/people/teacher.jpg", pos: "center 12%", group: "teacher", actor: "actTeacher", school: "Government High School", color: "#124d3b",
      label: "Username", user: "biology.teacher", title: "Teacher · Biology", sub: "Takes registers and enters marks from the lab",
      role: "Teacher · Biology", body: [["Lessons today", "5"], ["Practical", "Thursday 10:15"], ["Seq. 3 marks", "38 / 52"]] },
    { photo: "/images/people/parent-family.jpg", pos: "center 25%", group: "parent", actor: "actParent", school: "Collège Bilingue", color: "#124d3b",
      label: "Username", user: "parent.0451", title: "Parent · three children", sub: "One account follows all their children",
      role: "Parent · 3 children", body: [["Children linked", "3"], ["Absences this week", "None"], ["Fees balance", "15,000 XAF"]] },
    { photo: "/images/people/bursar.jpg", pos: "center 20%", group: "staff", actor: "actLibrarian", school: "Lycée Technique", color: "#124d3b",
      label: "Username", user: "bursar", title: "Bursar · school finance", sub: "Bursar, librarian and other staff have their own accounts",
      role: "Bursar", body: [["Collected today", "245,000 XAF"], ["Receipts printed", "18"], ["Classes fully paid", "6 / 21"]] }
  ];

  /* PHOTOS live in images/people/. Photos with a background show as rounded cards (PHOTO_FRAMED = true).
     For transparent PNG cut-outs, set PHOTO_FRAMED = false. A missing photo falls back to the drawing. */
  const PHOTO_FRAMED = true;
  const stage = document.querySelector(".who-stage");
  steps.forEach(s => {
    if (!s.photo) return;
    const img = new Image();
    img.alt = s.title;
    img.onload = () => {
      let el = img;
      if (PHOTO_FRAMED) {
        el = document.createElement("div");
        el.className = "photo framed";
        img.style.objectPosition = s.pos || "center top";
        el.appendChild(img);
        el.insertAdjacentHTML("beforeend", `<span class="tag">${s.title.split(" · ")[0]}</span>`);
      } else {
        img.className = "photo";
      }
      s.img = el;
      stage.insertBefore(el, document.getElementById("whoSigned"));
      if (steps[current] === s) show(s);
    };
    img.src = s.photo;
  });
  function show(s) {
    document.querySelectorAll(".actor").forEach(a => a.classList.toggle("on", !s.img && a.id === s.actor));
    document.querySelectorAll(".photo").forEach(p => p.classList.toggle("on", p === s.img));
  }

  const $ = id => document.getElementById(id);
  const screen = $("lgScreen"), chips = document.querySelectorAll("#whoChips button");
  const studentEl = $("actStudent");
  let run = 0, current = -1;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function setUniform(u) {
    for (const [k, v] of Object.entries(u)) studentEl.style.setProperty("--" + k, v);
  }

  async function play(i) {
    const id = ++run, s = steps[i], prev = steps[current];
    current = i;
    const alive = () => id === run;

    // who is on stage
    show(s);
    document.querySelectorAll(".actor").forEach(a => a.classList.remove("ok"));
    $("whoSigned").classList.remove("on");
    if (s.u) {
      setUniform(s.u);
      if (prev && prev.actor === "actStudent") {
        studentEl.classList.remove("swapping"); void studentEl.offsetWidth; studentEl.classList.add("swapping");
      }
    }
    chips.forEach(c => c.classList.toggle("on", c.dataset.group === s.group));

    // caption
    $("capTitle").textContent = s.title;
    $("capSub").textContent = s.sub;
    $("capCrest").style.color = s.color;
    const sw = s.u ? [s.u.shirt, s.u.vestOn ? s.u.vest : s.u.bottom, s.u.tie] : [s.color, "#f2cf7a", "#ffffff"];
    document.querySelectorAll("#capSw i").forEach((el, k) => el.style.background = sw[k]);

    // reset phone
    screen.classList.remove("done");
    $("lgSchool").textContent = s.school; $("lgDot").style.background = s.color;
    $("lgUserLabel").textContent = s.label;
    $("lgUser").textContent = ""; $("lgPass").textContent = "";
    $("lgBtn").innerHTML = "Sign in"; $("lgBtn").classList.remove("press");
    $("lgUserBox").classList.add("focus"); $("lgUser").classList.add("caret");
    $("lgPassBox").classList.remove("focus"); $("lgPass").classList.remove("caret");
    await sleep(450); if (!alive()) return;

    // type username, then password
    for (const ch of s.user) { $("lgUser").textContent += ch; await sleep(55); if (!alive()) return; }
    $("lgUserBox").classList.remove("focus"); $("lgUser").classList.remove("caret");
    $("lgPassBox").classList.add("focus"); $("lgPass").classList.add("caret");
    for (let k = 0; k < 8; k++) { $("lgPass").textContent += "•"; await sleep(65); if (!alive()) return; }
    $("lgPassBox").classList.remove("focus"); $("lgPass").classList.remove("caret");

    // press the button
    await sleep(200); if (!alive()) return;
    $("lgBtn").classList.add("press"); await sleep(140);
    $("lgBtn").classList.remove("press"); $("lgBtn").innerHTML = '<span class="spin"></span>';
    await sleep(600); if (!alive()) return;

    // welcome screen
    $("wlRole").textContent = s.role;
    $("wlT1").textContent = s.school;
    $("wlBody").innerHTML = s.body.map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join("");
    screen.classList.add("done");
    $(s.actor).classList.add("ok");
    $("whoSigned").querySelector("span").textContent = "Signed in · " + s.role.split(" · ")[0];
    $("whoSigned").classList.add("on");
    await sleep(2300); if (!alive()) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    play((i + 1) % steps.length);
  }

  chips.forEach(c => c.addEventListener("click", () => {
    const first = steps.findIndex(s => s.group === c.dataset.group);
    play(first);
  }));
  play(0);
})();
})();

(() => {
// Role tabs: the text panel and the phone screen switch together.
const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
const order = tabs.map(t => t.dataset.role);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let auto = !reduceMotion;
let idx = 0;
tabs.forEach(t => {
  t.id = 'tab-' + t.dataset.role;
  t.setAttribute('aria-controls', 'panel-' + t.dataset.role);
});
document.querySelectorAll('.role-panel').forEach(p => {
  p.id = 'panel-' + p.dataset.panel;
  p.setAttribute('role', 'tabpanel');
  p.setAttribute('aria-labelledby', 'tab-' + p.dataset.panel);
});
function showRole(role) {
  idx = order.indexOf(role);
  tabs.forEach(t => {
    const on = t.dataset.role === role;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll('.role-panel').forEach(p => { p.hidden = p.dataset.panel !== role; });
  document.querySelectorAll('.screen-view').forEach(v => v.classList.toggle('on', v.dataset.view === role));
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => { auto = false; showRole(t.dataset.role); });
  t.addEventListener('keydown', e => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let next = step ? (i + step + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    auto = false;
    showRole(tabs[next].dataset.role);
    tabs[next].focus();
  });
});
showRole(order[0]);
// Cycle through the roles until the visitor picks one; pause while the tab is hidden.
setInterval(() => {
  if (auto && !document.hidden) showRole(order[(idx + 1) % order.length]);
}, 5000);
})();
