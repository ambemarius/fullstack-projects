# Stage B architecture review

Audit snapshot: 25 October 2026. **Owner approval subsequently received; implementation underway.** See [current implementation status](../implementation/C01_C03_STATUS.md) and [latest tests](../../TEST_RESULTS.md). Source line anchors and baseline descriptions in the audit reflect the pre-implementation snapshot; they are not a claim that listed defects remain unchanged today.

This review follows `LMS_CODEX_IMPLEMENTATION_MASTER_PLAN.md` and `PROJECT_FINDINGS_2026-10-25.md`. It does not authorise application changes, database access, migrations or deployment.

## Deliverables

1. [System map](SYSTEM_MAP.md): boot, dependencies, source inventory and boundaries.
2. [Route and permission matrix](ROUTE_PERMISSION_MATRIX.md): every declared API/page route, actual middleware, proposed school/ownership rules and test IDs.
3. [Data dictionary](DATA_DICTIONARY.md): all 23 source-defined tables, columns, keys, nullability, constraints and migration drift.
4. [Workflow audit](WORKFLOW_AUDIT.md): existing and proposed school processes.
5. [Gap register](GAP_REGISTER.md): evidence, severity, impact, effort and dependencies.
6. [Migration plan](MIGRATION_PLAN.md): identity, tenancy, history, backfill, reconciliation and rollback.
7. [UI audit](UI_AUDIT.md): page inventory, source-observed issues and browser verification checklist.
8. [MVP backlog](MVP_BACKLOG.md): M0–M7 ordering and acceptance tests.
9. [M0/M1 implementation roadmap](M0_M1_ROADMAP.md): first five commits, file scope, gates and test plan.

Root-level control records: [implementation log](../../IMPLEMENTATION_LOG.md), [decisions required](../../DECISIONS_REQUIRED.md), [test results](../../TEST_RESULTS.md). [SOURCE_BASELINE.json](SOURCE_BASELINE.json) records hashes of reviewed application/package/design files; it excludes secrets, installed packages and tool metadata.

## Current verified state

The implementation is Express/CommonJS + SQL Server + EJS/plain JavaScript. It has admin/teacher/student account paths, 21 seeded classes and 23 source-defined tables. No tenant resolver, schools table or school-bound SQL was found. Attendance, library and laboratory inventory are new modules, not existing completed features. Finance is limited and MCQ APIs lack full dashboard workflows.

Static parsing and template compilation establish syntax only. No SQL connection, API/browser run, backup, migration or seed has been executed for Stage B. Database shape, production contents, deployment and repository history remain unverified. See `TEST_RESULTS.md` for actual evidence and unexecuted tests.

## Top ten risks, in implementation order

1. Forged/cross-role identity accepted by ID-only JWT handling (G01).
2. Public admin provisioning and unrestricted admin capabilities (G02).
3. No school isolation anywhere in persistence or request context (G03).
4. Student hashes and unnecessarily broad sensitive student fields exposed (G04/G19).
5. Clean setup failure plus destructive/fictional legacy backfills (G05/G17/G18).
6. Mark enrolment argument reversal, weak validation and missing teacher scope (G06–G08).
7. Historical reports depend on mutable placement; report SQL expects an undefined column (G09/G10).
8. Year membership, offering coefficients and grading policies disagree (G11/G12).
9. Non-atomic writes, schedule collisions and unauthorised UI data dependencies (G13/G14/G16).
10. Operational hooks, exception exposure, insufficient tests and browser injection/export risks (G15/G20/G21/G22).

## Recommended MVP boundary

Retain and repair the existing stack and visual identity. MVP: secure school onboarding and membership roles; configurable school academic structures; historical enrolments and assignments; registration; marks/reports; safe promotion/timetables; attendance/discipline; library; laboratory inventory. Platform billing, guardian portal, notifications and offline synchronisation require explicit scope decisions. Recommend deferring expanded finance and MCQ dashboard delivery to Phase 2, while securing or disabling any retained API with an explicit owner decision. Preserve existing fee and exam data regardless of feature visibility.

## Review gate

Approve or amend the identity/session and tenancy proposals, legacy-school mapping, pilot capacity, academic/discipline policies, module scope and safe test environment before implementation. The first five proposed commits are detailed in `M0_M1_ROADMAP.md`. Approval of this document alone must not be read as approval for production access or destructive migration.
