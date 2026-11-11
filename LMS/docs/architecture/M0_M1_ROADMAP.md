# M0/M1 implementation roadmap for review

Newest M1 increment: synthetic explicit reconciliation and first scoped personnel read repositories implemented; migration 004 installed only after rollback rehearsal. 45 isolated/API + 9 SQL tests pass. See ../implementation/M1_RECONCILIATION.md for current scope and next domain steps; earlier counts below are historical. C05 end-to-end tenancy and browser activation remain incomplete.

**Current execution, 26 October 2026:** M0 closed by owner acceptance with the residual automated recovery exception. C04 additive schema and internal session/pending-school invitation foundation implemented on synthetic SQL only; 38 isolated + 6 SQL tests pass. M1 remains in progress; no second school or canonical runtime is enabled. See ../implementation/M1_IDENTITY_PROGRESS.md. Counts/statuses in the original roadmap below are historical.

Original roadmap: 25 October 2026. **Proposals now approved.** C01/C02 are implemented with 29 passing isolated tests; C03 clean baseline/reference setup and two real SQL tests pass on the separate MARIUS/lms_test_codex environment. Legacy-upgrade and backup/restore rehearsals remain pending, as do canonical identity/tenancy and later milestones. See docs/implementation/C01_C03_STATUS.md and TEST_RESULTS.md. No Git commits have been created; commit labels below identify bounded change sequences.

## First five actionable commits after approval

### C01 — isolate configuration and add safe regression harness (M0)

Scope/files: proposed test harness under tests/, package.json test command, app/app.js app factory, config/database.js injected/lazy pool adapter, server.js explicit startup lifecycle, synthetic fixture definitions. Keep existing routes/colours. Exact edits to be re-stated before implementation.

Migration impact: none. Database access: none for pure tests; API/SQL tests require separately authorised disposable credentials. Guard target host/database by exact allowlist and conspicuous test marker; refuse missing config, default DB_STRING and live credentials. Avoid importing current module tree until the DB seam is isolated.

Tests: auth middleware/DTO/route contracts with injected fakes; demonstrate G01/G04/G06/G09/G16 regression cases without live DB. Known-defect tests may fail initially; record failures explicitly. Verify app creation has no network/DDL/process-kill side effects.

Rollback: revert bounded code/test commit; no data rollback. Acceptance: deterministic test command, no real DB use, known baseline documented. Dependency: owner implementation approval and chosen supported runtime.

### C02 — contain authentication/provisioning and output disclosure (M0/M1)

Scope/files: utils/generateToken.js, verifyToken.js, three auth middlewares, login/admin controllers/router, model safe projections, globalErrHandler.js, corresponding tests; package lifecycle/freePort hook removal or explicit command separation. No unrelated UI rewrite.

Migration impact: no table change for transitional typed JWT. Required deployment signing secret validation; reject startup without valid config. Invalidate all old tokens. If canonical cookies are approved for immediate delivery instead, split out session schema and do not silently combine migrations into this commit.

Tests: every wrong account type rejected with overlapping IDs; forged/expired/wrong algorithm/audience rejected; public admin creation denied; permitted bootstrap reviewed; withdrawn/suspended policy enforced; no hash/stack leakage; conflicting port does not kill another process.

Rollback: hardened prior build/config only, preserving session invalidation; never restore known vulnerable verification to regain compatibility. Dependency: C01, onboarding/status decisions. Acceptance: positive logins still work and cross-role exploit path closed.

### C03 — establish versioned clean schema and rehearsal tooling (M0)

Scope/files: new migrations/ ledger runner/preflight, scripts/setupAcademic.js compatibility path, models' inline DDL extraction plan, tests/sql, redacted config example/runbook. No production migration. Keep existing IDs/data.

Migration impact: new ledger and clean baseline only in authorised disposable SQL; order Admins/teachers -> classes -> subjects, academic_years -> students/fees, then offerings/junctions/exams/scheduling. Reconcile partial schema, status flags, matricule fields and undefined report passmark contract before upgrade scripts. Never backfill unknown demographics with guesses.

Tests: empty DB apply twice; upgraded legacy fixture; each constraint present/trusted; restore isolated backup and validate counts. Capture exact migration version/checksum, DB identity, row counts and restore timing without PII.

Rollback: discard authorised disposable DB after approved retention; for future restored legacy copy retain expand-only changes or restore verified backup. No existing database targeted. Dependency: safe SQL authorisation, C01, grading contract for report schema. Acceptance: reproducible clean/legacy fixture setup with no lost status/history.

### C04 — add canonical identity, schools and legacy mapping (M1 expand)

Scope/files: reviewed SQL expand migrations for schools/accounts/legacy_account_map/memberships/roles/platform grants/audit/session store as approved; identity/membership repositories; protected onboarding service; synthetic two-school fixtures.

Migration impact: additive schema and nullable ownership fields first. Owner-attested designated school; separate mapping for each legacy source row; do not merge overlapping IDs/emails. No implicit platform admin assignment. Restore rehearsal and reconciliation must pass before application activation.

Tests: mapping cardinality; duplicate/replay handling; membership combinations; staff multi-school policy; disabled-school denial; school admin cannot assign platform grants; no secret/medical data in logs.

Rollback: keep inaccessible additive tables and mapping; no source account deletion; disable feature gate. If post-cutover writes exist use reviewed delta reconciliation/forward repair. Dependency: C02/C03 plus D01–D03/D15. Acceptance: internally consistent canonical account/membership graph, not yet permission to enable multiple schools.

### C05 — enforce school context and scoped access end to end (M1)

Scope/files: session/auth context middleware, all routes/controllers/models, school-aware login/navigation helpers, report/export paths, tenant constraints/indexes, permission matrix/isolation tests. Break this large task into bounded domain commits before actual implementation; C05 is the named feature sequence, not permission for a single unreviewable patch.

Migration impact: backfill all school-owned parents/children, reconcile, add trusted composite FKs and mandatory ownership; tenant-aware unique/current-year constraints. Geography explicitly global read-only. No second school enabled until **all** APIs/scripts/exports are scoped.

Tests: all R001–R106 applicable role/tenant cases; forged body/header/query school, A root+B nested parent, list/count/search/form-data/export, write batches, role revocation, school switch, pooled concurrent requests. Verify ordinary platform admin session cannot read sensitive school data absent explicit audited grant.

Rollback: maintenance mode; hardened scoped prior build and compatible schema; preserve new writes/deltas. No fallback to unscoped endpoints. Dependency: C04 + reconciliation and privacy decisions. Acceptance: end-to-end two-school separation, then separately approve pilot cutover.

## Implementation review protocol

Before each bounded change, state exact files, behaviour, schema/data impact, test target, rollback and current decision gates. Update root control records with proposed/implemented/verified status. Every new endpoint gets a route-matrix row; every migration gets preconditions, checksum, dry-run and reconciliation evidence. Do not claim complete while its API, SQL constraints, permissions, UI and tests remain unverified.

## Isolation test catalogue

| ID | Scenario | Required result |
|---|---|---|
| I01 | Same numeric IDs across legacy admin/teacher/student tables | Wrong account type denied; canonical mapping unambiguous |
| I02 | A membership with school B body/query/header value | Server rejects or ignores untrusted selector; never enters B context |
| I03 | A root resource with B student/offering/year/teacher parent | Denial before write; composite FK also prevents mismatch |
| I04 | B IDs in A read/update/delete URLs and bulk bodies | Non-disclosing denial; no partial batch side effects |
| I05 | List/search/stats/dropdowns/report/CSV/print | Only authorised A rows and minimal fields; no B counts or labels |
| I06 | Teacher/student self resource with forged actor ID | Server derives actor and permitted enrolment scope |
| I07 | Multi-school staff switches membership | New membership revalidated; cached data/CSRF/session context isolated |
| I08 | Revoked membership/disabled school/session replay | Immediate server denial by approved revocation policy |
| I09 | Concurrent pooled requests for A and B | No cross-request context or transaction leakage |
| I10 | Platform operator without exceptional school-data grant | Onboarding permission does not imply pupil/medical access |
| I11 | Same subject code/matricule/class naming across schools | Allowed per approved tenant business keys; no global collision |
| I12 | Restored legacy data with missing school/history/actor mapping | Fail closed or restricted reconciliation queue, never default wildcard |

## Definition of M0/M1 completion

M0 requires a safe reproducible test environment, clean/legacy fixtures, known-failure baseline and verified backup restore in addition to these audit documents. M1 requires canonical identities, reviewed sessions, protected onboarding, all school boundaries/constraints, reconciliation and complete isolation evidence. Stage B currently completes the documentation portion only. Production authorisation remains separate.
