# Gap register

Review: 25 October 2026. All fixes **proposed**; source evidence **verified statically**. No exploit, SQL mutation or browser test was executed. Source references are file:line. Existing October F01–F15 are revalidated and expanded here, not presumed fixed.

Effort: S <=1 focused engineering day; M 2–4; L 5–10; XL >10. These are planning ranges excluding owner decisions, data clean-up and review, not delivery promises.

| ID | Severity | Finding | Effort | Dependencies |
|---|---|---|---|---|
| G01 | Critical | ID-only JWT and hardcoded signing configuration | M | Identity decision; M0 harness |
| G02 | Critical | Public admin provisioning; no platform/school distinction | M | G01; onboarding policy |
| G03 | Critical for multi-school release | No tenant context or tenant persistence boundary | XL | Identity and legacy ownership decisions; migration rehearsal |
| G04 | High | Student listing returns credential hashes | S | M0 response tests |
| G05 | High | Fresh setup order violates foreign-key dependencies | M | Authorised test SQL environment |
| G06 | High | Mark enrolment argument order reversed | S | M0 regression harness |
| G07 | High | Marks lack robust ranges, year and membership validation | M | Historical enrolment design; G06 |
| G08 | High | Missing academic object ownership/eligibility authorisation | L | G01/G03; assignment model |
| G09 | High | Report SQL references undeclared subject passmark | S–M | Grading decision; clean SQL test |
| G10 | High integrity | Historical reports depend on mutable current placement | L | Legacy history reconciliation; G03 |
| G11 | High integrity | Year membership and subject enrolment disagree | L | G03/G10; school year policy |
| G12 | Medium–High | Grading, coefficient and missing-score semantics diverge | L | Owner grading decisions; G10 |
| G13 | High integrity | Logical batch writes are not atomic | L | SQL failure-injection harness; G03 |
| G14 | High integrity | Timetable constraints and manual validation incomplete | L | Schedule/co-teaching policy; G13 |
| G15 | Medium | Process-kill hooks and production error disclosure | S | Approval for runtime code edits |
| G16 | High workflow | Teacher/student UI consumes admin-only read endpoints | M | G01; UI/API contracts |
| G17 | High migration | Teacher status migration drops source flags before preservation | M | Approved data mapping and backup |
| G18 | High migration | Student migration fabricates sex and enrolment year | M | Owner records; G10 |
| G19 | High privacy | Broad student profile projection reaches teacher lists | M | Privacy/retention policy; G03 |
| G20 | Medium | Browser storage/HTML contexts require hardening | L | Session decision; UI refactor |
| G21 | Medium | CSV export does not establish safe encoding | S–M | Export policy; G03 |
| G22 | High delivery | No automated integration/restore baseline or tenant tests | L | Safe credentials + explicit DB approval |
| G23 | Medium | Teacher field and partial-name contracts drift | M | Legacy schema inventory |
| G24 | Medium product | Hard-coded school/class identity and incomplete MVP modules | XL | MVP/pilot decisions; tenancy |
| G25 | High integrity | Promotion lacks source-cohort idempotency and historical semantics | L | Grading/graduation policy; G10/G13 |
| G26 | Medium–High | MCQ attempt/state validation incomplete | M–L | MCQ scope decision; G08/G12 |

## G01 — ID-only JWT and hardcoded signing configuration

- Status: **proposed** remediation; **verified** source observation. Severity: Critical.
- Evidence: `utils/generateToken.js:4`; `middlewares/isLogin.js:23`; `middlewares/isTeacherLogin.js:21`; `middlewares/isStudentLogin.js:21`.
- Exploit/impact: Forged claims or overlapping role IDs resolve to another account type.
- Proposed correction: Environment secret, strict type/algorithm/issuer/audience/expiry; forced token invalidation; canonical identity transition.
- Effort: M. Dependencies: Identity decision; M0 harness.
- Acceptance: All role-pair tokens denied with matching and non-matching IDs.

## G02 — Public admin provisioning; no platform/school distinction

- Status: **proposed** remediation; **verified** source observation. Severity: Critical.
- Evidence: `routes/staff/adminRouter.js:22`; `controllers/staff/adminCtrl.js:22`.
- Exploit/impact: Anonymous callers create administrators; arbitrary admin role text does not enforce capabilities.
- Proposed correction: Protected bootstrap/invitations; explicit platform grants and school memberships; prevent last-admin lockout.
- Effort: M. Dependencies: G01; onboarding policy.
- Acceptance: Anonymous registration denied; school admin cannot grant platform authority.

## G03 — No tenant context or tenant persistence boundary

- Status: **proposed** remediation; **verified** source observation. Severity: Critical for multi-school release.
- Evidence: `app/app.js:44`; `model/Academic/student.js:187`; `model/Academic/class.js:52`.
- Exploit/impact: Enabling multiple schools on current routes exposes global records, IDs, search and exports.
- Proposed correction: Schools/memberships, server-validated context, scoped repositories, composite FKs, complete isolation suite.
- Effort: XL. Dependencies: Identity and legacy ownership decisions; migration rehearsal.
- Acceptance: Two-school ID/body/query/nested/export/batch attacks denied with no writes.

## G04 — Student listing returns credential hashes

- Status: **proposed** remediation; **verified** source observation. Severity: High.
- Evidence: `model/Academic/student.js:187`; `controllers/students/studentCtrl.js:48`.
- Exploit/impact: Credential material returned to list API consumers.
- Proposed correction: Explicit safe projections for every response; assert redaction recursively.
- Effort: S. Dependencies: M0 response tests.
- Acceptance: List/detail/profile/register/error payloads contain no hash or password.

## G05 — Fresh setup order violates foreign-key dependencies

- Status: **proposed** remediation; **verified** source observation. Severity: High.
- Evidence: `scripts/setupAcademic.js:30`; `model/Academic/subject.js:21`; `model/Academic/class.js:66`.
- Exploit/impact: Empty database expected to fail before dependent tables exist.
- Proposed correction: Versioned ordered baseline; separate schema migration from startup; disposable setup twice.
- Effort: M. Dependencies: Authorised test SQL environment.
- Acceptance: Empty schema initialisation and second run succeed with all constraints.

## G06 — Mark enrolment argument order reversed

- Status: **proposed** remediation; **verified** source observation. Severity: High.
- Evidence: `controllers/academic/marksCtrl.js:42`; `controllers/academic/marksCtrl.js:72`; `model/Academic/classSubjectStudent.js:22`.
- Exploit/impact: Wrong enrolment association or FK failure when student and offering IDs differ.
- Proposed correction: Use explicit argument object/service and correct order in both save paths.
- Effort: S. Dependencies: M0 regression harness.
- Acceptance: Distinct IDs yield exactly intended association; no unintended row.

## G07 — Marks lack robust ranges, year and membership validation

- Status: **proposed** remediation; **verified** source observation. Severity: High.
- Evidence: `controllers/academic/marksCtrl.js:41`; `model/Academic/subjectScore.js:113`.
- Exploit/impact: Negative/non-finite inputs and unrelated enrolments may be processed; roster includes other years.
- Proposed correction: Strict numeric/ID/term/year validation and historical enrolment checks before whole batch writes.
- Effort: M. Dependencies: Historical enrolment design; G06.
- Acceptance: Reject negative, invalid maximum, malformed and out-of-year rows atomically.

## G08 — Missing academic object ownership/eligibility authorisation

- Status: **proposed** remediation; **verified** source observation. Severity: High.
- Evidence: `controllers/academic/marksCtrl.js:25`; `controllers/academic/examCtrl.js:55`; `controllers/academic/examCtrl.js:99`.
- Exploit/impact: Teacher can address unrelated offerings/exams; student can request unrelated Live exam.
- Proposed correction: Assignment/year ownership and student eligibility service for reads and writes; deny by default.
- Effort: L. Dependencies: G01/G03; assignment model.
- Acceptance: Unassigned teacher and wrong-class/year student denied on every related route.

## G09 — Report SQL references undeclared subject passmark

- Status: **proposed** remediation; **verified** source observation. Severity: High.
- Evidence: `controllers/academic/reportCardCtrl.js:40`; `model/Academic/subject.js:9`.
- Exploit/impact: Report query expected to fail against schema produced solely by current source; live schema unknown.
- Proposed correction: Agree grading source and align schema/query without inventing thresholds.
- Effort: S–M. Dependencies: Grading decision; clean SQL test.
- Acceptance: Reports execute on clean migrated schema with policy-backed passmark.

## G10 — Historical reports depend on mutable current placement

- Status: **proposed** remediation; **verified** source observation. Severity: High integrity.
- Evidence: `controllers/academic/reportCardCtrl.js:54`; `model/Academic/student.js:383`.
- Exploit/impact: Promotion/transfer changes old cohort visibility although marks remain.
- Proposed correction: Authoritative effective enrolment history and historical report joins.
- Effort: L. Dependencies: Legacy history reconciliation; G03.
- Acceptance: Old report cohort and values unchanged after promotion/withdrawal.

## G11 — Year membership and subject enrolment disagree

- Status: **proposed** remediation; **verified** source observation. Severity: High integrity.
- Evidence: `controllers/students/studentCtrl.js:26`; `controllers/academic/academicYearCtrl.js:61`; `model/Academic/classSubjectStudent.js:43`; `model/Academic/classSubject.js:41`.
- Exploit/impact: Counts/delete checks drift; unenrolment deletes all years; teacher term assignment repeats implicitly across years.
- Proposed correction: Consolidate historical enrolments; year-aware assignments; scope removal and archive used years.
- Effort: L. Dependencies: G03/G10; school year policy.
- Acceptance: Two years remain separate in membership, assignments, counts and removal.

## G12 — Grading, coefficient and missing-score semantics diverge

- Status: **proposed** remediation; **verified** source observation. Severity: Medium–High.
- Evidence: `controllers/academic/examCtrl.js:13`; `controllers/academic/reportCardCtrl.js:16`; `controllers/academic/reportCardCtrl.js:85`; `controllers/academic/subjectAllocationCtrl.js:26`.
- Exploit/impact: Raw unequal maxima distort reports; catalog coefficients may not propagate to offerings; tie/missing policies implicit.
- Proposed correction: Versioned school grading policy; snapshot coefficients; normalise only after approval.
- Effort: L. Dependencies: Owner grading decisions; G10.
- Acceptance: Approved golden cases for maxima, coefficients, missing marks and ties.

## G13 — Logical batch writes are not atomic

- Status: **proposed** remediation; **verified** source observation. Severity: High integrity.
- Evidence: `controllers/academic/timetableCtrl.js:148`; `controllers/academic/marksCtrl.js:39`; `model/Academic/student.js:322`.
- Exploit/impact: Failures leave partial fees, marks, assignments, enrolments or schedules.
- Proposed correction: Service transactions; idempotency/revision control; defined partial-result exceptions.
- Effort: L. Dependencies: SQL failure-injection harness; G03.
- Acceptance: Injected second-write failure preserves entire prior state.

## G14 — Timetable constraints and manual validation incomplete

- Status: **proposed** remediation; **verified** source observation. Severity: High integrity.
- Evidence: `controllers/academic/timetableCtrl.js:28`; `model/Academic/timetable.js:16`; `model/Academic/timetable.js:33`.
- Exploit/impact: Manual/concurrent inserts double-book; fresh slot column lacks FK; generator selects first co-teacher.
- Proposed correction: Shared collision service, trusted slot FK, tenant/resource unique indexes, transaction locks and co-teaching model.
- Effort: L. Dependencies: Schedule/co-teaching policy; G13.
- Acceptance: Concurrent same-slot booking allows one; failed replacement retains old grid.

## G15 — Process-kill hooks and production error disclosure

- Status: **proposed** remediation; **verified** source observation. Severity: Medium.
- Evidence: `package.json:7`; `scripts/freePort.js:28`; `middlewares/globalErrHandler.js:5`.
- Exploit/impact: Starting app can terminate unrelated listener; exception details returned to clients.
- Proposed correction: Remove automatic killing, explicit diagnostics, sanitised errors with correlation ID.
- Effort: S. Dependencies: Approval for runtime code edits.
- Acceptance: Port conflict exits safely; production JSON omits stack/SQL/credentials.

## G16 — Teacher/student UI consumes admin-only read endpoints

- Status: **proposed** remediation; **verified** source observation. Severity: High workflow.
- Evidence: `public/js/teacher-dashboard.js:109`; `routes/academic/academicYearRouter.js:13`; `public/js/timetable.js:76`; `routes/academic/timetableRouter.js:19`.
- Exploit/impact: Correct role isolation will break teacher marks and teacher/student grid metadata loading.
- Proposed correction: Role-specific minimal academic context and self timetable slot payload; no broad admin access.
- Effort: M. Dependencies: G01; UI/API contracts.
- Acceptance: Teacher with no matching Admin ID loads marks; both self grids show slots without admin data.

## G17 — Teacher status migration drops source flags before preservation

- Status: **proposed** remediation; **verified** source observation. Severity: High migration.
- Evidence: `model/staff/teacher.js:65`; `model/staff/teacher.js:74`.
- Exploit/impact: Migrating legacy teachers can erase suspension/withdrawal facts and reactivate accounts; partial old schema may fail.
- Proposed correction: Snapshot/backfill status before any contraction; handle partial schemas; reconcile all legacy flags.
- Effort: M. Dependencies: Approved data mapping and backup.
- Acceptance: Suspended/withdrawn states preserved in fixtures and restored-copy rehearsal.

## G18 — Student migration fabricates sex and enrolment year

- Status: **proposed** remediation; **verified** source observation. Severity: High migration.
- Evidence: `model/Academic/student.js:120`; `scripts/migrateStudents.js:52`.
- Exploit/impact: Invented demographics/year corrupt records; legacy name reference may fail on partial/new schemas.
- Proposed correction: Preserve unknowns and provenance; exception queue for owner reconciliation; no guessed values.
- Effort: M. Dependencies: Owner records; G10.
- Acceptance: Unknown values remain flagged, never derived from ID parity or fixed year.

## G19 — Broad student profile projection reaches teacher lists

- Status: **proposed** remediation; **verified** source observation. Severity: High privacy.
- Evidence: `model/Academic/student.js:128`; `model/Academic/student.js:208`; `controllers/staff/teacherCtrl.js:95`.
- Exploit/impact: Password-safe projection still includes medical/guardian/origin fields unnecessary for ordinary teacher roster.
- Proposed correction: Purpose-specific DTOs and sensitive-field permissions/audited disclosure.
- Effort: M. Dependencies: Privacy/retention policy; G03.
- Acceptance: Ordinary teacher roster omits medical/contact details; authorised discipline view explicitly gated.

## G20 — Browser storage/HTML contexts require hardening

- Status: **proposed** remediation; **verified** source observation. Severity: Medium.
- Evidence: `public/js/auth.js:54`; `public/js/app.js:40`; `public/js/app.js:57`.
- Exploit/impact: Script-readable long-lived token; quote/URL contexts not fully covered by text escaping. No exploit executed.
- Proposed correction: Reviewed cookie/CSRF session migration; textContent/DOM properties; URL allowlist; CSP compatible with event binding.
- Effort: L. Dependencies: Session decision; UI refactor.
- Acceptance: Attribute/URL payloads inert; CSRF rejected; logout/revocation enforced.

## G21 — CSV export does not establish safe encoding

- Status: **proposed** remediation; **verified** source observation. Severity: Medium.
- Evidence: `public/js/admin-layout.js:1982`; `public/js/admin-layout.js:1677`.
- Exploit/impact: Quotes/newlines may corrupt exports; formula-like user values may execute in spreadsheet clients.
- Proposed correction: Central CSV quote escaping and agreed formula neutralisation; authorise/minimise exports.
- Effort: S–M. Dependencies: Export policy; G03.
- Acceptance: Quotes/newlines round-trip; formula-prefixed fields inert in target clients.

## G22 — No automated integration/restore baseline or tenant tests

- Status: **proposed** remediation; **verified** source observation. Severity: High delivery.
- Evidence: `package.json:6`; `config/database.js:11`.
- Exploit/impact: Syntax passes do not catch SQL/API/UI defects; imports can touch real DB.
- Proposed correction: Explicit non-production configuration, fail-closed DB identity guard, isolated harness and backup drill.
- Effort: L. Dependencies: Safe credentials + explicit DB approval.
- Acceptance: Automated tests cannot select production; evidence includes API/SQL/browser/isolation/restore results.

## G23 — Teacher field and partial-name contracts drift

- Status: **proposed** remediation; **verified** source observation. Severity: Medium.
- Evidence: `model/staff/teacher.js:38`; `model/staff/teacher.js:120`; `model/staff/teacher.js:214`.
- Exploit/impact: Matricule columns diverge; updating one name part can regenerate incomplete full name.
- Proposed correction: Canonical field migration preserving originals; merge supplied names with stored components.
- Effort: M. Dependencies: Legacy schema inventory.
- Acceptance: Fresh/upgraded schemas agree; partial last-name change preserves first/middle name.

## G24 — Hard-coded school/class identity and incomplete MVP modules

- Status: **proposed** remediation; **verified** source observation. Severity: Medium product.
- Evidence: `views/admin-layout.ejs:12`; `model/Academic/class.js:6`; `views/admin-layout.ejs:699`.
- Exploit/impact: New schools cannot safely configure their academic structure; attendance/library/lab not implemented.
- Proposed correction: School settings/template provisioning; deliver M4–M6; defer finance/MCQ expansion explicitly.
- Effort: XL. Dependencies: MVP/pilot decisions; tenancy.
- Acceptance: Two schools configure different structures without shared mutation; module acceptance suites pass.

## G25 — Promotion lacks source-cohort idempotency and historical semantics

- Status: **proposed** remediation; **verified** source observation. Severity: High integrity.
- Evidence: `model/Academic/student.js:348`; `model/Academic/student.js:360`.
- Exploit/impact: Repeated class actions can affect new cohort; graduation is a flag without distinct completion record.
- Proposed correction: Preview fixed source enrolment IDs; approved decisions; unique batch key; append target enrolments and explicit completion.
- Effort: L. Dependencies: Grading/graduation policy; G10/G13.
- Acceptance: Repeat same batch no extra move; source history retained; terminal students have explicit reviewed result.

## G26 — MCQ attempt/state validation incomplete

- Status: **proposed** remediation; **verified** source observation. Severity: Medium–High.
- Evidence: `controllers/academic/examCtrl.js:118`; `controllers/academic/examCtrl.js:126`; `model/Academic/question.js:19`.
- Exploit/impact: Concurrent submissions race; question edits during Live affect scoring; positive maxima/marks not fully constrained.
- Proposed correction: Version/snapshot questions at activation; validate positive marks and totals; atomic attempt/result write and duplicate handling.
- Effort: M–L. Dependencies: MCQ scope decision; G08/G12.
- Acceptance: Concurrent writes produce one result; published grading stable under later edits.

## Scope and confidence

Absence claims concern the reviewed first-party inventory, not undisclosed services. SQL schema defects describe source-built schemas; an existing database may have manual columns/constraints and must be inspected after authorisation. Browser injection/CSV impacts are review risks, not demonstrated exploits. Architecture gaps for new modules are scope work, not regressions in implemented code.
