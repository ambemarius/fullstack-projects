# M1 school-scoped academic setup

Implemented and verified on 26 October 2026. M1 remains in progress. Canonical academic routes remain unmounted in the existing application.

## Implemented files and environment

- `migrations/006_academic_tenant_keys.sql`: school-specific business keys/current-year uniqueness, preserved unresolved-row uniqueness, canonical year creator linkage, and setup versions for years/classes/subjects.
- `model/identity/academicSetupService.js`: school-scoped administrative create/list/edit for academic years/classes/subjects; atomic current-year selection; minimal current-year/time-slot context for admin/teacher/pupil memberships.
- `model/identity/schoolAccess.js`: authorised role included in the private repository descriptor so each SQL statement can independently validate the precise permitted role. Public context and session responses do not expose this descriptor or session hash.
- `routes/identity/academicSetupRouter.js`: unmounted cookie/Origin/CSRF-protected HTTP factory. No hard deletion or placement/promotion/grading endpoints are added.
- `tests/academic-setup.test.js` and `tests/sql/academic-setup.test.js`: validation/authority checks and real synthetic SQL/API/transaction coverage.

Only MARIUS/lms_test_codex was migrated. No live-school database migration, legacy ownership inference or browser activation occurred. Synthetic table count remains 35.

## Tenant keys and legacy compatibility

Migration 006 replaces global uniqueness for Admins.email, teachers.email, students.matricule, auxiliary_staff.email, subjects.code and academic_years.name with unique keys per non-null school and separate unique indexes for unresolved NULL-school rows. Class section/name/stream uniqueness is split the same way. Canonical account login keys remain global and no identities are merged.

The current-year rule is now at most one current year per assigned school, with a separate at-most-one unresolved current year. Existing NULL ownership stays unresolved. These indexes allow independent schools to use identical names, codes, emails and pupil identifiers. The old current index name is retained for its unresolved compatibility check; no legacy startup DDL was invoked.

This expands allowed data combinations but removes global constraint enforcement on assigned rows. It is not safe to enable multi-school traffic through unscoped legacy queries. All remaining legacy reads/writes/background paths must be replaced or disabled at canonical activation. The production schema is unchanged.

Academic years may now record created_by_account_id through a same-school membership FK. Legacy createdBy remains intact for existing years and is nullable for canonical-created years. A year must retain at least one creator reference. New scoped writes derive canonical creator from the verified session, never from a request ID or guessed overlapping legacy admin ID. There is no invented legacy admin profile and no backfill of unknown actors.

## Academic service contracts

Administrative create/list/edit is limited to an active school-admin membership. Every operation resolves private school context; SQL independently checks session expiry/revocation, canonical account status/security version, membership, school and role. Data uses exact school predicates; NULL/foreign ownership is excluded. Write transactions are serializable and acquire a per-school application lock, then recheck authority before mutating.

- Years accept name (optional on creation), positive fromYear/toYear up to 9999 with toYear greater than fromYear, and creation-only isCurrent. Missing name derives from the supplied years. Changes to current year use a separate versioned operation. No term, grading or promotion policy is inferred.
- Classes accept section/name/stream/rank and optional class master. Sections preserve the legacy Anglophone/Francophone profile contract; streams are nullable configurable labels. A newly assigned class master must be an active same-school teacher.
- Subjects accept name/code and optional description, coefficient, category, subject master, class, weekly hours and lab flag. Coefficient/category/hours validation preserves existing SQL constraints; no passmark or score normalisation is introduced. Newly supplied teacher/class references must belong to the same school; teachers must be active. Existing unchanged legacy references are not silently rewritten.

Updates require setup_version (exposed as version). Unknown ownership/actor/policy fields are refused. Foreign targets and parents use non-disclosing 404s; stale edits use 409. Successful edits increment versions and record actor/resource/version/changed-field audit metadata without profile values.

Creating or selecting a current year clears only that school's previous current year, increments affected versions, and audits both sides in one transaction. A failed target, stale request, duplicate key or late audit error rolls everything back. Selecting an already-current year with the correct version is a no-op. Concurrent same-version selection gives one success and one stale conflict; different schools keep independent current years.

The minimal context method permits admin, teacher and pupil memberships and returns only that school's current year and configured time slots. It does not reveal other classes/pupils or infer enrolment. Administrative lists remain admin-only. Teacher/pupil assignments, historical class membership, marks and timetable management are not delivered by this service.

## Verification

`npm.cmd test`: **49 passed**. `npm.cmd run test:sql`: **11 passed**, zero failures/skips/TODO, MARIUS/lms_test_codex. Migration 006 was executed and rolled back before installation (output: `Rolled back 006_academic_tenant_keys.sql`), then applied through the checksum ledger. Repeated migration and trusted-FK checks pass. No applied migration file was subsequently edited.

Real SQL/API cases include:

- Two schools with equal year names, class labels, subject codes, teacher/admin/auxiliary emails and pupil matricules; duplicates within the same school refused. Original unresolved subject uniqueness is preserved.
- Canonical year creator without a legacy admin row; independent current years; concurrent same-version selection; foreign target refusal without clearing the local current year; versioned year-range edits and invalid merged-range refusal.
- Same-school class/subject teacher references, foreign-parent refusal, inactive new master refusal, and unchanged version after a rejected parent update.
- Concurrent subject edit conflict; school-only class/subject lists; admin/teacher/pupil minimal current-year/time-slot context; teacher administrative-list and pupil write denial.
- A late fixture-scoped audit trigger failure after previous current-year state changed: the entire new year, clear/set state, versions and audit are rolled back. The temporary trigger is removed afterward.
- Actual unmounted HTTP create/edit/context, missing-CSRF denial, and foreign current-year 404. The HTTP tests use manually supplied cookie headers and a configured HTTPS Origin; actual HTTPS browser acceptance remains outstanding.
- Independent SQL denial of a revoked session even when a prior private service descriptor is deliberately reused.

Fixture records are cleaned only within the exact random synthetic school IDs; one explicitly tracked unresolved subject is removed by its ID. No seeded reference classes, recovery copies or school records are changed. Source tests and service paths remain compatible after the business-key expansion.

## Server and rollback

The owner-requested existing server's earlier listener had stopped. It was restarted as a hidden background node process on port 2026; GET http://localhost:2026/login returned 200. Private process/log metadata is under ignored backups/runtime/server-state.json. No application configuration or live schema was changed. Existing UI still uses legacy routes; new academic/personnel workflows are not yet visible there.

Pre-activation rollback leaves expanded schema unused and the hardened legacy app intact. Failed transactions roll back automatically. Do not blindly restore global unique constraints after schools begin sharing identifiers: that may conflict with new data. Production rollback requires reviewed reconciliation/forward repair and a verified production backup/cutover plan. No destructive down migration is provided.

Next M1 work: scope existing offerings/enrolment/assignment paths without inventing history, then marks/reports/timetable and retained exam/finance boundaries; complete administrator/auxiliary permissions and browser session/CSRF integration; require reconciled ownership and complete end-to-end two-school tests before activation. M2 historical academic repair remains queued.
