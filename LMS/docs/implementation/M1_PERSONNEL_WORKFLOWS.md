# M1 scoped personnel write workflows

Implemented 26 October 2026. M1 remains in progress; the canonical personnel router is not mounted in the running application.

## Current server

The existing application was started at the owner's request with `npm.cmd start`. It is available at http://localhost:2026/login; an HTTP GET returned 200. Startup connected to the configured existing application database without DDL or migrations. This running interface still uses existing routes and login. It does not demonstrate the new unmounted personnel flows. Do not start a second listener or kill the existing process to resolve a port conflict.

## Implemented scope and files

- `migrations/005_personnel_versions.sql`: student/teacher profile_version defaults/checks plus audit reason/version/changed-field metadata. No account status, password or ownership backfill. Synthetic schema stays at 35 tables.
- `model/identity/personnelService.js`: school-admin-only pupil/teacher registration, allowed-field profile edits and explicit status changes. Transactions include fresh SQL authority checks, native profiles, canonical identities, memberships/mappings and audit records.
- `model/identity/personnelRepository.js`: teacher list/search/count, profile versions and basic detail fields added to existing scoped reads. Student/teacher details support admin or verified self mapping. List access remains admin-only.
- `model/identity/identityService.js`: school-aware identity login resolves a verified pupil matricule, teacher email or mapped admin email in the requested school. The authenticated session is still derived from canonical account/membership state.
- `middlewares/canonicalSession.js`: shared exact-HTTPS-Origin validation and duplicate-cookie-safe token reading. Identity router reuses it.
- `routes/identity/personnelRouter.js`: unmounted factory exposing list/detail/create/patch/status routes for pupils/teachers, with canonical cookie, Origin, CSRF and input checks. Existing legacy routers are unchanged.
- New validation/authority tests and real SQL/API tests in `tests/personnel.test.js` and `tests/sql/personnel.test.js`.

## Registration contract

Pupils require firstName, lastName, matricule, section, sex and an initial password; middleName is optional. Teachers require firstName, lastName, email, section, employmentType and a password; middleName, phone and matriculeFile are optional except that Government teachers require matriculeFile. Section values remain Anglophone/Francophone to match the current profile schema; a bilingual school can contain both. No pupil sex, year, class or historical placement is inferred.

Passwords require 12 characters minimum and at most 72 UTF-8 bytes; bcrypt work factor is 12. A profile, active canonical account, active school membership, fixed pupil/teacher role, verified source mapping and registration audit commit together. Canonical login keys are server-generated technical `profile:<source>:<uuid>` identifiers. No platform grant is issued. Registration returns only profile ID and version; credentials/hashes are never returned or audited.

School, account, membership, role, status, ownership and academic placement fields are not accepted in registration or profile patches. New pupils remain academically unplaced until the separate enrolment/history workflow is delivered. Native profiles already have verified mappings and must not be treated as unmapped legacy records by the legacy reconciliation tool, whose different technical key policy deliberately refuses unexpected mappings.

Update after this personnel increment: migration 006 now scopes assigned-row matricule/email uniqueness by school while retaining separate unresolved uniqueness. Identical identifiers in two schools and same-school duplicate refusal are SQL-tested. See M1_ACADEMIC_SETUP.md. Unscoped legacy routes and incomplete remaining domains still prevent onboarding a second real school through the running application.

## Updates, status and audit

PATCH requires the current numeric version and allowed profile fields. Unknown fields, passwords, role/ownership and placement changes are refused. Teacher name is recomputed from the locked merged name fields, and Government employment continues to require a matricule file. No medical, guardian, identity-document content or file access is introduced.

Writes use a serializable transaction, recheck canonical session/account/membership/school/admin-role authority in SQL, and hold target profile update locks. Every successful mutation increments profile_version. A stale version returns 409; missing, foreign-school or unresolved target returns 404. Concurrent edits using the same version produce one success and one stale conflict. Shared authority checks and explicit school predicates do not use pooled connection-level tenant state.

Pupil statuses are active/withdrawn; teacher statuses are active/suspended/withdrawn. Status changes require a fixed reason code. They update the profile and its verified matching membership, revoke that membership's existing sessions, and audit the version change atomically. They preserve records, marks and other school memberships. They do not globally disable an account solely because one school suspends employment. Reactivating an already globally disabled account requires a separate recovery review; it is not silently enabled. The acting membership cannot disable itself through this service. No hard deletion is exposed.

Audit entries contain actor/school/membership, action/resource IDs, reason code, previous/new version and changed field names. They contain no password, medical content, new/old profile values or caller-provided audit actor/request ID. Audit failure rolls back the entire mutation.

## HTTP and login contracts

The scoped personnel router's relative paths are listed as R114–R123 in the route matrix. A canonical cookie is required for every request; state changes also require the exact configured HTTPS Origin and matching session CSRF token. Pagination is bounded, and path/query integers cannot use permissive numeric expressions. Mutations return safe ID/version/status data; missing/foreign IDs use the same response.

R108 login additionally accepts `{schoolCode, accountType, identifier, password}` with accountType student/teacher/admin. Pupil identifier is matricule; teacher/admin identifier is email. Lookup is bound to school and verified profile mapping; account and membership must be active. Global canonical login remains available for invitation-created accounts and platform-only sessions. New school-aware lookup never trusts a role claim supplied by the caller as authority: session roles come from server-side memberships. The existing browser login remains unchanged until canonical activation.

These are loopback HTTP API tests with an explicitly configured HTTPS Origin and manually attached cookie headers, not a real HTTPS browser acceptance test. No cookies or Origin policy were weakened for HTTP preview.

## Verification and migration evidence

`npm.cmd test`: **47 passed**. `npm.cmd run test:sql`: **10 passed**, zero failures/skips/TODO, target MARIUS/lms_test_codex. Migration 005 first failed compile-time name resolution when a later CHECK referenced a column added in the same batch; it was never committed in that form. Corrected the not-yet-applied migration to compile that constraint after the column exists. Full rollback rehearsal then passed (`Rolled back 005_personnel_versions.sql`), followed by ledger installation and repeat-run success. No applied migration checksum was rewritten.

SQL/API cases cover:

- School-admin pupil/teacher registration and scoped teacher pagination; duplicate identifier rollback and forbidden field rejection.
- Foreign-school edit/status denial; teacher/pupil inability to use admin writes; no account/role escalation.
- Positive mapped pupil/teacher self reads; same-school pupil-peer and cross-school denial; wrong-school identity login refusal.
- Versioned profile edits; concurrent same-version conflict; required Government matricule validation without version changes on refusal.
- Withdrawal revokes pupil login/session; explicit return works while globally active; teacher suspension preserves another school's active session; globally disabled account is not reactivated by a school admin.
- A random fixture-scoped temporary trigger deliberately rejects registration audit, demonstrating profile/account/membership/map rollback. It is removed in finally; only exact synthetic records/schools are cleaned afterward.
- Real HTTP registration, school-aware login, detail, PATCH/status and teacher list using the unmounted factories; CSRF/Origin rejection; cross-school 404; invalid pagination rejection.
- Revocation occurring after a service descriptor was obtained still causes SQL write authority denial.

## Rollback and remaining M1 work

Before activation, leave the additive columns and unused router/services in place and keep the hardened legacy application. Failed writes roll back; no destructive undo or live-data migration is supplied. An audit of rollback with post-activation real writes remains necessary before production cutover.

Next: scoped academic years/classes/subjects and placement/assignment boundaries; retained marks/reports/timetable/exam/finance paths; administrator/auxiliary permission workflows; mandatory reconciled ownership and tenant business keys; canonical browser session/CSRF lifecycle and full HTTPS/two-school acceptance. The existing application is not yet a complete multi-school runtime. M2 stays queued.
