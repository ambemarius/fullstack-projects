async function loadProfile() {
  const { ok, data } = await api('/students/profile');
  const el = document.getElementById('profile');
  const welcome = document.getElementById('welcome');

  if (!ok) { welcome.textContent = 'Could not load profile.'; return; }

  const s = data.data;
  const fullName = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ');
  welcome.textContent = `Welcome back, ${fullName}`;

  const joined = new Date(s.createdAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const status = s.isWithdrawn
    ? '<span class="badge yes">Withdrawn</span>'
    : '<span class="badge no">Active</span>';
  const promoted = s.promoted
    ? '<span class="badge no">Yes</span>'
    : '<span class="badge yes">No</span>';

  renderProfileCard(el, {
    name: fullName,
    subtitle: `${s.role} · ${s.section} section · ${s.sex || ''}`,
    fields: [
      { label: 'Matricule', value: s.matricule },
      { label: 'First name', value: s.firstName },
      { label: 'Middle name', value: s.middleName || '—' },
      { label: 'Last name', value: s.lastName },
      { label: 'Sex', value: s.sex || '—' },
      { label: 'Date of birth', value: s.dateOfBirth || '—' },
      { label: 'Year enrolled', value: s.yearOfEnrollment ? String(s.yearOfEnrollment) : '—' },
      { label: 'Section', value: s.section },
      { label: 'Status', value: status, html: true },
      { label: 'Promoted', value: promoted, html: true },
      { label: 'Joined', value: joined },
    ],
  });
}
loadProfile();
