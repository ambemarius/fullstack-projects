# M1 isolated browser preview

**Runtime superseded, 26 October:** port2027 now serves real LYCEE BATOURI canonical sign-in with a read-only workspace on schooldb. The sample listener was stopped; this document describes the previous synthetic deployment. Read CANONICAL_REAL_SIGNIN.md for current URLs, limits and verification. Do not run the sample HTTPS checker against the current listener or use sample buttons as a real-school login method.

26 October 2026. Preview runtime is active at **https://localhost:2027/**, bound to 127.0.0.1 and connected only to the approved synthetic database. Existing application http://localhost:2026/login is unchanged. This is preview activation, not production cutover or M1 completion.

## Delivered

- `scripts/m1Preview.js`: guarded synthetic startup, checksum-ledger preflight, persistent fictional demo schools, separate HTTPS app and a loopback sample-account entry point.
- `views/m1-preview.ejs`, `public/css/m1-preview.css`, `public/js/m1-preview.js`: responsive British-English workspace retaining the existing blue/slate palette, sample sign-in, ordinary test-account login, school switching, people, academic setup, subject links, teacher rosters and pupil self subjects.
- Canonical identity routes mounted under `/api/identity`; scoped personnel `/api/personnel`; academic setup `/api/setup`; academic links `/api/links`. Legacy `/api/v1/*` and original dashboard routes are not mounted in this app.
- Identity service/router adds current-account membership discovery and Origin-protected CSRF renewal after page reload. Raw session/CSRF secrets are never stored in localStorage; CSRF lives in JavaScript memory and secure HttpOnly cookies carry the opaque session. School switching rotates session/CSRF and discards cached school data. A 403 clears the visible workspace.
- Self assignment/enrolment DTOs now include own-school class/subject labels through explicit same-school joins, avoiding guessed labels or administrative list access.
- `scripts/checkM1Preview.js` verifies the actual HTTPS listener using its exact local certificate as a trust anchor; no global TLS validation is disabled.

## What is available in the workspace

The landing page clearly states that it contains fictional sample records. It offers administrator/teacher/pupil sample buttons for Maplewood Sample School (M1_DEMO_A) and Riverside Sample School (M1_DEMO_B). Sample access uses only a fixed catalog of generated preview accounts and the real password/session service. It cannot select arbitrary database accounts or platform grants. Requests need the exact preview Origin and are throttled. The first sample administrator has explicit membership in both demo schools to demonstrate actual server-validated switching.

Administrator screens provide scoped pupil/teacher registration, profile edits and status changes; years/current year/classes/subjects; subject offerings, pupil subject memberships and year/term teacher assignments. Version fields are retained internally for edits and link changes. Forms use server validation and show failures instead of silently changing ownership or credentials. Government teacher registration requires its reference. Existing roles are not editable through profile fields.

Teacher screens discover only confirmed own year/term assignments and fetch assignment-authorised pupil rosters. Pupil screens show only their own subject memberships. Empty states are explicit. DOM content is built with textContent rather than injecting names into HTML. A Content Security Policy limits resources to the app and blocks framing/inline script. Labels, keyboard focus, status feedback, responsive forms and scrollable tables are included; full visual/accessibility acceptance is pending.

Newly registered pupils are not silently placed in a class/year. Enrolment requires verified placement; the demo pupils have explicitly authored fictional present-day placements. Full placement/history and related M2 workflows remain pending. Marks, reports, exams, finance, timetable administration, platform onboarding and auxiliary roles are not exposed as completed preview modules.

## Data and startup safeguards

Startup loads only config/.env.test.local through the approved test guard and verifies LMS_SYNTHETIC_ONLY. It refuses to start if the installed migration ledger differs from reviewed files. It does not run migrations automatically or load the existing application database configuration.

The two demo schools are created only if their reserved codes are absent. Account passwords are random, hashed with bcrypt in SQL, and persisted only in ignored local `backups/runtime/m1-preview-private.json` for controlled sample login. Catalog responses expose only school/role/fictional identifier metadata. No password, cookie, CSRF secret or SQL credential is printed. Source checkpoints exclude the runtime directory.

The initial fixture setup is a synthetic seeding sequence, not a production provisioning transaction. If interrupted before private evidence is written, existing reserved schools without that evidence cause a safe refusal rather than reseeding/resetting accounts. Subsequent starts verify the recorded active school IDs/codes and preserve user changes; they do not reset profiles or passwords. There are no implicit platform grants. Test-case fixtures elsewhere are separate and removed as usual; these demo schools are intentionally retained for interaction.

The TLS key/certificate are private runtime files under backups/runtime/tls, generated only for localhost for 30 days. No Windows trust root was installed and no browser security policy was disabled. The preview process is a hidden background node process; its PID/run metadata is in backups/runtime/m1-preview-process.json. The original port-2026 process is preserved.

## Executed verification and current handoff

- `npm.cmd test`: **52 passed**, zero failures/skips/TODO. New shell/catalog test verifies credential exclusion, CSP, legacy API absence, Origin denial and client JS parse.
- `npm.cmd run test:sql`: **12 passed**, zero failures/skips/TODO. Expanded session test verifies only own memberships, CSRF hash rotation/old-token rejection and revoked-session renewal refusal. Existing cross-school/personnel/academic/link suites still pass with the retained demo fixtures present.
- `node scripts/checkM1Preview.js`: passed against the actual HTTPS listener. Verified certificate validation against the exact local certificate, secure HttpOnly SameSite cookie flags, CSRF recovery, independent school data after switch, old-session rejection, `/api/v1/students` unavailable, mutation CSRF requirement and logout.
- No schema migration was introduced in this increment. Synthetic schema remains at 007 and 35 tables. Only owned fictional fixture data was added.

**Browser verification is not yet passed.** The in-app preview tab reports ERR_CERT_AUTHORITY_INVALID for the local self-signed certificate. The user has replied with approval, but the tab still visibly displays the warning; chat approval does not dismiss it. Expanded the warning details only, leaving the final “Proceed to localhost (unsafe)” click for the user. `docs/implementation/evidence/m1-certificate-handoff.jpg` records the observed warning. No browser barrier was bypassed by the agent. The selected computer-use confirmation policy requires user handoff for that action.

Once the user performs that actual browser click, verify: landing page, sample admin sign-in, school switching, reload/CSRF recovery, one profile/academic form, assignment/enrolment changes, teacher roster, pupil self view, sign-out and responsive layout. These checks remain outstanding; passing API tests do not substitute for them. The browser tab is retained as a handoff.

## Rollback and remaining M1 gate

Stop only the verified preview process to withdraw preview access; leave the existing application and reviewable expanded schema intact. Do not delete test/demo records or reset passwords automatically. No production/browser cutover of unscoped legacy routes occurred. Production bootstrap, existing-account onboarding, all remaining domain scopes, HTTPS deployment, real-school ownership/reconciliation and full acceptance still gate M1 completion. M2 remains queued.
