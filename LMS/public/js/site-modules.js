// KodoSchool public site: modules page.
(() => {
{
  // highlight the module in view in the sticky bar
  const links = [...document.querySelectorAll(".subnav a")];
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(a => {
      const on = a.getAttribute("href") === "#" + e.target.id;
      a.classList.toggle("on", on);
      if (on) a.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    });
  }), { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll(".mod-sec").forEach(sec => spy.observe(sec));
}
})();
