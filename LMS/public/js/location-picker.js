// Cascading Region -> Division dropdowns for the student form.
// Option value = the NAME (so form submission stores the name as before);
// the region's id is kept in data-id to fetch its divisions.
(function () {
  const regionSel = document.getElementById('sRegion');
  const divisionSel = document.getElementById('sDivision');
  if (!regionSel || !divisionSel || typeof api !== 'function') return;

  async function loadRegions() {
    const { ok, data } = await api('/locations/regions');
    if (!ok) return;
    data.data.forEach(r => {
      const o = document.createElement('option');
      o.value = r.name;
      o.dataset.id = r.id;
      o.textContent = r.name;
      regionSel.appendChild(o);
    });
  }

  async function loadDivisions(regionId) {
    divisionSel.innerHTML = '<option value="">-- select division --</option>';
    if (!regionId) return;
    const { ok, data } = await api(`/locations/regions/${regionId}/divisions`);
    if (!ok) return;
    data.data.forEach(d => {
      const o = document.createElement('option');
      o.value = d.name;
      o.dataset.id = d.id;
      o.textContent = d.name;
      divisionSel.appendChild(o);
    });
  }

  regionSel.addEventListener('change', () => {
    const opt = regionSel.options[regionSel.selectedIndex];
    loadDivisions(opt ? opt.dataset.id : null);
  });

  loadRegions();
})();
