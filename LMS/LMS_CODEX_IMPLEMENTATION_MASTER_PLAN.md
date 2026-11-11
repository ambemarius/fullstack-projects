# LMS — Codex Implementation Master Plan
**Date:** 25 October 2026  
**Purpose:** Guide a local Codex agent through source inspection, architecture review, safe remediation, and phased delivery of a multi-school MVP for Cameroonian secondary schools.

## 0. Operating instructions for Codex
You are working in an EXISTING project. Do not rebuild from scratch or assume prior findings are fixed.
1. Read `PROJECT_FINDINGS_2026-10-25.md` first; treat `PROJECT_REVIEW.md` as historical.
2. Inspect actual source and verify every claim before changing code.
3. Never print, commit, or transmit `.env` secrets, passwords, tokens, or student medical data.
4. Never run destructive scripts, reseed real data, reset passwords, drop tables, or force-kill ports without explicit approval.
5. Preserve existing colours and visual identity; improve navigation, responsiveness, alignment, and accessibility.
6. Work in small reviewed changes. Before each change: state scope, files, migration impact, rollback, and tests.
7. Keep an `IMPLEMENTATION_LOG.md`, `DECISIONS_REQUIRED.md`, and `TEST_RESULTS.md`. Mark each item proposed / implemented / verified.
8. Use British English in UI text. Respect Cameroon Anglophone, Francophone, and bilingual structures.
9. Use migrations and backup/restore verification for all schema changes. No direct production migration without approval.
10. Do not mark a feature complete unless its API, database, permissions, browser workflow and tests pass.

## 1. Known baseline (verify in code)
- Node.js/CommonJS, Express 5, SQL Server (`mssql`), EJS/CSS/plain JS; no verified React/Vite UI.
- Admin/teacher/student JWT accounts; auxiliary staff currently admin-managed.
- 21 seeded classes, 23 SQL table definitions, three terms, two sequences per term.
- Main admin layout `views/admin-layout.ejs`, `public/js/admin-layout.js`.
- Start with `server.js`, `app/app.js`, `config/database.js`, `routes/webRouter.js`, routers/controllers/models, `scripts/setupAcademic.js`.
- Models may connect to SQL at import. Default port 2026.
- `npm run init` has broken table dependency order; start scripts may force-kill a port; inspect before executing.
- 78 JS syntax checks and 15 EJS compilation checks reportedly passed; SQL, API and browser tests NOT verified.
- Reported defects: hardcoded JWT secret and ambiguous ID-only claims, public admin registration, student hash exposure, reversed mark-enrolment arguments, missing assignment/eligibility authorisation, broken academic history, insufficient mark validation, unsafe timetable replacement.
- Finance main tab is placeholder; online exam API lacks complete dashboard flow.

## 2. Product vision and MVP boundaries
Build a multi-tenant school administration platform serving multiple independent Cameroonian schools from one application.
Core MVP: school onboarding; secure roles; student and staff registration; configurable Anglophone/Francophone/bilingual school structures; academic years and enrolment; teacher assignments; marks and reports; timetables; discipline/attendance; library; laboratory inventory.
Finance and online MCQ exams: audit existing features; propose whether essential MVP scope or Phase 2. Do not silently expand scope.
School administrators must never access another school's records. Platform admins must use separately authorised cross-school workflows.

## 3. Stage B — Mandatory architecture audit BEFORE implementation
Produce `docs/architecture/` with:
- `SYSTEM_MAP.md`: boot path, routes, middleware, models, views, scripts, external dependencies.
- `ROUTE_PERMISSION_MATRIX.md`: method/path, authenticated roles, school scope, object ownership, test case.
- `DATA_DICTIONARY.md`: actual tables, keys, FKs, indexes, nullable fields, year/term relationships.
- `WORKFLOW_AUDIT.md`: student/staff registration, teacher assignment, marks, reports, promotion, timetables, MCQ, finance.
- `GAP_REGISTER.md`: severity, evidence file:line, exploit/impact, proposed fix, effort, dependencies.
- `MIGRATION_PLAN.md`: current-to-target schema, backfill strategy, rollback and backup requirements.
- `UI_AUDIT.md`: current page inventory, layout defects, accessibility/mobile issues.
- `MVP_BACKLOG.md`: ordered tasks with acceptance tests.
Use static inspection first. Do not connect to a real DB until safe test credentials and explicit authorisation exist.

## 4. Architecture target: multi-school tenancy
### 4.1 Tenancy
- Shared SQL Server database with tenant-scoped records as initial recommendation, pending review.
- Introduce `schools` (id, code, name, education_system, status, timezone, settings) and `school_memberships` (account_id, school_id, role, status).
- Resolve existing independent account tables safely; document account identity strategy before migration.
- Add `school_id` to all school-owned entities, including student enrolments, academic years, classes/offerings, marks, timetables, attendance, library, lab, finance and exams as appropriate.
- Add tenant-aware unique constraints and indexes. Scope EVERY read, write, join, batch operation, file export and background job by verified school context.
- School ID must come from validated session/membership, NEVER trusted solely from request body.
- Test cross-tenant access denial for IDs, exports, search, and nested resources.
- Shared global catalogues/templates may remain unscoped only when explicitly designated.
- Plan safe legacy-data assignment to a designated school with audited backfill and reconciliation.

### 4.2 Identity and authorisation
- Separate platform super-admin from school admin.
- School roles: admin, teacher, student, discipline master, librarian, lab attendant; allow role combinations through memberships/permissions.
- Sign JWT with secret from environment, include account identity/type and validated membership context; verify expiry, issuer/audience as appropriate.
- Remove public admin creation; platform onboarding must be protected.
- Hash passwords securely; never return password hashes.
- Enforce object-level teacher assignment, student enrolment/year and exam eligibility.
- Prefer secure HttpOnly session cookies over browser localStorage JWT if migration is feasible; document trade-offs and CSRF protections.

### 4.3 Academic integrity
- Historical class/year enrolment is authoritative for historical reports, even after promotion.
- Teacher assignments and offerings must be scoped to academic year and term as required.
- Fix reversed mark parameters; validate scores, maxima, membership and year; transaction-protect batch marks.
- Define configurable school grading/sequence policies BEFORE normalising grades.
- Timetable replacement must be atomic and reject teacher/room/class collisions.
- Promotion must not rewrite historical enrolments or silently infer graduation eligibility.

## 5. New module A — Discipline and attendance
### Workflow
1. Class prefect takes paper roll call for each of 8 scheduled teaching periods.
2. Discipline master logs in, selects school-scoped academic year, class, date and sees historical enrolment roster.
3. Enter attended periods or period-level present/absent status; display e.g. 7/8 and 1 missed.
4. Calculate daily, weekly, termly and annual scheduled, attended, missed, justified and unjustified periods.
5. Medical evidence is reviewed by authorised discipline staff. Approved justification excludes periods from disciplinary total WITHOUT erasing missed-period history.
6. Corrections record editor, timestamp, old/new values, reason and approval status.
7. Configurable thresholds flag students for review; NEVER auto-dismiss.
### Suggested entities
`attendance_sessions` (school_id, year_id, class_id, date, scheduled_periods, entered_by, status);
`attendance_entries` (session_id, student_enrolment_id, period_no, status, recorded_by);
`absence_justifications` (student_enrolment_id, date range/period references, reason, evidence metadata, reviewer, decision, timestamps);
`attendance_audit`; `discipline_policies`; optional `discipline_cases`.
Use unique constraints to prevent duplicate student/date/period entries. Avoid storing medical documents until privacy/access/retention policy is agreed.
### Acceptance tests
- 7/8 => 1 missed; 0/8 => 8 missed when 8 periods scheduled.
- Approved 8-period medical justification: 8 missed, 8 justified, 0 unjustified.
- Week and term totals reflect edits and approved justifications.
- Student promotion does not change old attendance.
- Other schools cannot read or alter entries.

## 6. New module B — Library management
- Catalogue: title, author, ISBN (optional), edition, subject, language, category.
- Physical copies: barcode/accession, shelf/location, condition, status, school_id.
- Shelves and locations; stocktake, lost/damaged, acquisitions and write-offs.
- Borrower eligibility: students and staff within school; loan checkout, due date, renewal, return and overdue.
- Librarian role and school admin permissions; searchable catalogue and inventory dashboard.
- Transactions for checkout/return; prevent concurrent double-loans; immutable loan history.
- Configure loan limits and overdue rules by school; no automatic fines unless policy agreed.
- Tests: same title multiple copies; no double checkout; return restores availability; cross-school isolation.

## 7. New module C — Laboratory management
- Subject categories: Physics, Chemistry, Biology, Mathematics and configurable others.
- Item master: equipment, consumable, reagent; unit, quantity, minimum stock, storage, condition, expiry/batch where applicable.
- School-scoped stock locations and inventory balances; immutable stock movement ledger.
- Teacher request -> lab attendant review -> issue -> return/consumption -> reconciliation.
- Track borrower, issue date, expected return, actual return, quantity, condition and loss/damage.
- Refill/requisition requests with status and approval history; low-stock alerts.
- Role-specific lab attendant dashboard; teacher can view permitted availability and request items.
- Apply restricted access and appropriate handling to hazardous materials; inventory is not a substitute for laboratory safety protocols.
- Tests: no negative stock; concurrent issues cannot overdraw; returned damaged item does not silently become available; expired reagents flagged; cross-school isolation.

## 8. Existing module repair backlog (ordered)
P0: tests and backup baseline; JWT account type/secret; disable public admin registration; prevent password hash exposure; tenant-safe auth and school boundaries.
P1: clean schema dependency order and non-destructive migrations; historical enrolments; teacher assignment year; mark parameter order and validation; teacher/student object authorisation; report accuracy.
P1: timetable transactions/collision checks; safe promotion; error sanitisation.
P2: student/staff registration UI alignment and workflow; responsive admin/teacher/student pages; complete essential attendance/library/lab UI.
P2: assess finance and MCQ workflow gaps; scope remaining features through owner decision.

## 9. UI and UX requirements
Keep current palette and general aesthetic. Standardise typography, spacing, form validation, feedback states, table filters, pagination, accessible labels and responsive layouts.
Platform admin: schools and subscriptions (billing only if approved).
School admin: student/staff/class/academic/discipline/library/lab overview.
Teacher: assignments, marks, timetable, lab availability/requests.
Discipline master: daily roster entry, justification queue, weekly/term totals, alerts.
Librarian: catalogue, copies, shelves, loans, overdue.
Lab attendant: items, stock, checkouts/returns, requisitions.
Student: own timetable, marks/reports and permitted library loans; avoid exposing other students.

## 10. Delivery protocol
Implement in bounded milestones:
M0: audit + reproducible non-production test environment + baseline tests.
M1: authentication, school tenancy, secure onboarding and isolation tests.
M2: enrolment, staff assignment and academic history fixes.
M3: marks, reports, promotion, timetable correctness.
M4: discipline/attendance end-to-end.
M5: library end-to-end.
M6: lab end-to-end.
M7: interface polish, integration tests, security checks, backups, deployment runbook.
For EACH milestone:
- list changed files and schema changes;
- provide migration dry-run and rollback;
- add unit/API/SQL/browser tests and evidence;
- verify tenant isolation and regression tests;
- update `IMPLEMENTATION_LOG.md`, `DECISIONS_REQUIRED.md`, `TEST_RESULTS.md`;
- stop for approval before destructive or irreversible changes.
Never claim 'production ready' on syntax checks alone.

## 11. Decisions required from product owner
Record unanswered questions with proposed defaults, impact, and decision deadline:
1. First pilot: how many schools, expected students and concurrent users?
2. School onboarding: platform invitation/approval or self-registration?
3. Can one staff member work at multiple schools? Can a student transfer schools?
4. School timetable: always 8 periods, or configurable by school/day?
5. Discipline thresholds: number of unjustified periods, term vs year, warning/escalation process?
6. Medical evidence: upload files or record verified paper reference only? retention/access rules?
7. Who may enter/correct/approve attendance? Is prefect access ever digital?
8. Library borrowing limits, loan durations, overdue actions and lost-book process?
9. Lab stock units, consumables vs returnable equipment, approval levels, safety/expiry requirements?
10. Grading, sequence weighting, coefficients, promotion/graduation rules per education system?
11. Parent/guardian portal and notifications in MVP?
12. Finance and online MCQ: MVP essential or post-MVP?
13. Internet constraints: offline support, mobile-first needs, expected hosting and backup policies?
14. Platform subscription/pricing and school branding/custom domain requirements?
15. Data retention, consent, minor/student privacy and access to sensitive records?

## 12. FIRST CODEX TASK — execute this before writing features
1. Inspect source safely, beginning with named files and October findings.
2. Produce the Stage B audit deliverables and validate reported defects with file:line evidence.
3. Propose a precise M0/M1 implementation plan including SQL migration/backfill, role matrix, tenant isolation tests, risk/rollback and dependencies.
4. Flag decisions that block implementation; use sensible documented defaults only for reversible low-risk choices.
5. DO NOT implement schema or authentication changes until the owner reviews the audit and migration plan.
6. Present a concise summary: current verified state, top 10 risks, recommended MVP boundary, first five actionable commits, and questions for owner.

**Success criterion:** An evidence-backed plan that Codex can execute incrementally, without losing historical school records or exposing one school's data to another.
