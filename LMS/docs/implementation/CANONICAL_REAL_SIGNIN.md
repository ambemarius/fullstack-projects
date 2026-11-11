# LYCEE BATOURI canonical sign-in

**Personnel activation supersedes read-only status below:** real student/teacher registration, editing and audited status workflows are now active on port2027 using original forms. Legacy personnel writers on2026 are locked and hand off to the canonical registration URL. Read M1_PERSONNEL_ACTIVATION.md for current policy, runtime and 69 isolated/13 SQL test evidence. Earlier read-only descriptions below are historical. Browser acceptance remains blocked by the visible certificate handoff.

26 October 2026. **Active at https://localhost:2027/**, bound to 127.0.0.1, connected to **MARIUS\DEV / schooldb**. This replaces the sample listener on that port. Original application remains http://localhost:2026/login, HTTP 200. The fictional preview code/database still exist but its listener is stopped; do not run checkM1Preview.js against this real-school listener.

## Sign-in

Refresh the page. School code is prefilled `LYCEE_BATOURI`. Select Administrator/Teacher/Pupil and use the existing email (staff) or matricule (pupil), plus that person's existing password. The recovered administrator is `admin@school.local`; its password was not changed or read by this activation. Sample buttons and sample-account sign-in/catalog routes are absent. Public tests do not use a real person's password or claim an observed successful owner login.

## Implemented scope

- `scripts/canonicalSchool.js`: exact original-instance/database startup guard, complete migration checksum history and school/adoption checks. No seeder, migration, password reset or sample fallback at startup.
- Canonical password login, own session/membership lookup, CSRF renewal and logout. Cookies are Secure, HttpOnly, SameSite=Strict, with opaque tokens. Mutations require the exact HTTPS Origin; authentication retains rate limits. The school code and account type are checked on the server.
- `views/canonical-school.ejs` and `public/js/canonical-school.js`: real-school sign-in and role-aware read-only workspace. Administrator can list up to 50 pupils or teachers through scoped repositories. Teacher/pupil see their own authenticated role; no broad personnel access. Cached records are cleared on denial/sign-out, and stale list responses cannot repopulate a cleared workspace.
- A legacy-source guard rechecks every resolved session against that account's verified profile mapping, same-school ownership, exact credential match and source role/status. A source password change, suspended/withdrawn teacher, withdrawn pupil or non-admin Admins role denies access rather than continuing with stale canonical authority. It does not reactivate an account, infer a new role or copy changed credentials automatically.
- Only read-only personnel lists are mounted. Personnel writes return 405. Legacy APIs, sample bypasses, invitation/grant endpoints and unreviewed workflows remain unavailable. Original registration/editing remains on port2026 with separate authentication. M1 is still in progress; full canonical write activation is not claimed.

## Verification and operation

Complete suites: **66 isolated tests and 13 synthetic SQL tests passed**. Focused tests passed again after final route/startup changes; the SQL fixture additionally verifies pupil withdrawal. Fixtures use only synthetic accounts and roll back. Coverage includes secure sign-in response, wrong target/code rejection, no demo/legacy bypass, read-only restrictions, real bcrypt login, and source password/role/status changes invalidating sessions. An initial local HTTP run was blocked by sandbox EACCES and passed when rerun with authorised local networking.

Actual `node scripts/checkCanonicalSchool.js` passed with the exact local certificate pinned: real-school shell, no sample/legacy routes, writes blocked, missing credentials denied without issuing a cookie. TLS validation was not disabled. Actual original login page returned HTTP200. Visual browser acceptance/owner credential entry is still separate; no security warning was bypassed by automation.

Owned sample PID44728 was verified and stopped. Canonical PID40856 at launch; authoritative process metadata: ignored `backups/runtime/canonical-school-process.json`. Previous sample metadata records stoppedAt. Start command: `node scripts/canonicalSchool.js`; verify process ownership before any restart. Reuse existing local TLS files under ignored backups/runtime/tls. Never print environment values, private sample credentials or session tokens. Future source-account drift requires reviewed reconciliation; the guard deliberately refuses a silent credential/status sync.
