# Real-school personnel workflow activation

26 October 2026. **Activated on MARIUS\DEV / schooldb. M1 remains in progress.** No new migration, source password change, test pupil/teacher insertion or historical backfill was made during activation.

## User workflow

Open `https://localhost:2027/registration`, sign in as a school administrator if redirected, and use the original student/teacher forms. Staff use email; pupils use matricule. School code is LYCEE_BATOURI. The real-school landing page links administrators to registration. The original dashboard's Registration entry/student/teacher subtabs now hand off to this workspace on reload; its notice retains links to the other original registration modules.

Enabled operations: create student/teacher with profile + canonical account + fixed school role + membership + mapping + audit in one transaction; optimistic profile editing; audited suspend/withdraw/return actions with session revocation; optional explicit initial current-year/class pupil placement. No password or role editing through profile payloads. Government teacher reference remains required. Existing globally disabled accounts require recovery review rather than silent activation. Existing pupil class/year editing remains disabled pending historical transfer workflows.

Forms reuse the unchanged original partial blocks and stylesheet. Real-school context replaces the fictional notice. Medical and deferred finance controls remain disabled. School selector is hidden for a single membership. On denial/logout private form state and table contents are cleared. Academic dropdowns and geography use scoped/protected read endpoints; academic changes are not enabled by this increment.

## Closing the old writer

`config/runtimePolicy.json` now has `canonicalPersonnelWrites: true`. Original `server.js` passes this policy to `createApp`, which installs `middlewares/legacyPersonnelGate.js`. All non-read requests under legacy admin/teacher/student mounts are rejected with HTTP409 and the canonical registration URL, except the three original login endpoints and existing exam publish/unpublish PUT routes. This includes legacy self/profile/admin changes, teacher status/assignment, hard deletion and student promotion; those operations must not mutate personnel/history through unversioned legacy paths. Existing academic/report/finance/auxiliary modules remain original single-school modules and are not certified tenant-safe.

The original dashboard renders a handoff notice and loads `legacy-personnel-handoff.js` only under the activation policy. Original registration markup remains intact. Other registration modules retain explicit links, so the student/teacher handoff does not remove access to subjects/classes/academic years/auxiliary screens.

`scripts/canonicalSchool.js` reads the same policy and enables the protected original registration page and scoped personnel router. It exposes only read-only class/year dropdown routes and geography alongside them. Unreviewed canonical academic mutations, legacy APIs and sample bypasses remain unavailable. No second school may be onboarded until the remaining route boundaries are closed.

## Readiness and deployment evidence

`scripts/personnelActivationReadiness.js` performs aggregate, read-only checks for school ownership, mappings, exact credential equality, membership status and required role. All five drift counts were **zero**, both before deployment and after the legacy lock was active. It refuses drift; it does not repair credentials or invent ownership. Existing per-session source checks remain active.

Deployment order was deliberate: verified owned processes; enabled policy; restarted original2026 with the gate; verified actual legacy POST /api/v1/students/register returns409 and original dashboard includes handoff script; repeated canonical readiness; only then restarted canonical2027 with personnel writes. Original launch PID30120 and canonical PID28224; verify current ignored process metadata before restarting anything. Startup remains free of seeders/migrations. Runtime policy must be retained on future restarts.

Rollback is coordinated application configuration, not a database restore: stop canonical writes before changing policy/restarting either listener. Re-enabling legacy personnel writes can create drift; review subsequent records/status/credentials before any later canonical activation. Do not restore an old backup or discard user-created records merely to reverse this interface increment.

## Verification

- Complete suites: **69 isolated tests, 13 synthetic SQL tests passed**, zero failures/skips/TODO. Personnel SQL cases cover atomic registration/edit/status, same-school parents, two-school isolation, stale-version/race denial, audit failure rollback and membership-specific session revocation.
- New activation HTTP tests cover preserved real forms, anonymous redirect, non-admin denial, exact Origin/CSRF, ownership injection, disabled academic mutations, legacy writer coverage (including encoded administrator ID) and retained login/read/academic routes.
- Aggregate readiness tests refuse each drift category without writes. Script parse checks and original-partial preservation pass.
- Actual HTTPS checker uses the exact local certificate as a trust anchor, not disabled TLS. Real root loaded; protected registration redirects anonymous callers; protected dropdown/geography and personnel writes deny unauthenticated access; sample and legacy API paths absent; invalid non-account credentials receive no session cookie.
- Actual original dashboard/login remain available. Existing school records were not edited by these checks. No owner password was read or entered.

**Browser acceptance remains pending.** In-app tab2 still visibly shows NET::ERR_CERT_AUTHORITY_INVALID with the final Proceed to localhost link. The automation policy requires a human to perform that security-warning step. No bypass was clicked. Screenshot: `evidence/canonical-personnel-certificate-handoff-2026-10-26.png`. Source/browser credential entry and actual create/edit acceptance are not claimed as passed.

## Next M1 work

After the human browser handoff, verify administrator form layout and workflow acceptance without altering an existing record unintentionally. Continue administrator/auxiliary account workflows, explicit multi-school staff/invitation handling, remaining route boundaries and canonical recovery policy. M2 remains queued until full M1 exit gates pass.
