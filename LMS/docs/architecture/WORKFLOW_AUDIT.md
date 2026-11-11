# Workflow audit

Status: current behaviour **source-observed**; repairs **proposed**. No workflow is end-to-end verified. Evidence IDs refer to `GAP_REGISTER.md`.

| Workflow | Current path and writes | Permission/data concerns | Proposed acceptance gate |
|---|---|---|---|
| Student registration | Admin UI or POST students/register -> Student.create -> optional saveFees -> getFees | No tenant; class/year optional; no authoritative historical enrolment; fee failure after account creation; list exposes hashes (G03/G04/G11/G13) | Same-school class/year required by policy; student+enrolment+fees atomic; duplicate matricule scoped to school; safe output; rollback on fee failure |
| Student profile/update | Student middleware -> findById/update | Withdrawn student not rejected; patch uses COALESCE so null cannot intentionally clear fields; medical/guardian field minimisation absent | Deny inactive membership; allowlisted self-edit fields; explicit clear semantics; audit sensitive changes |
| Teacher registration | Admin -> validation -> Teacher.create, with bcrypt | DDL `matricule` and migrated `matriculeFile` disagree; no tenant/year employment; name recomputation may omit unchanged names (G17/G23) | Canonical field contract; same-school staff membership; preserve names on partial update; transactional provisioning; no file upload implied by field name |
| Auxiliary registration | Admin -> auxiliary record CRUD/status | Records are not login accounts; free-form personnel role must not automatically grant permissions | Explicit account invitation and role grant independent of personnel job title |
| School onboarding | Absent | No platform identity, schools or membership tables (G03) | Platform-authorised invitation; provision school/admin atomically; disabled school denies access; audited and idempotent |
| Academic year/current | Admin -> AcademicYear create/setCurrent transactions | Current-year index global; membership junction counts can drift; delete only checks one junction (G11) | One current year per school; archive used years; references reconciled; no unsafe deletion |
| Class/subject setup | Seed 21 classes; class settings; subject catalog CRUD | Hard-coded structures; subject/class masters global; offering coefficient defaults differ from catalog values (G12/G24) | Per-school structures and versioned policy; current catalogue copied as template; validate all parent school IDs |
| Teacher assignment | POST teachers/:id/assign -> findOffering -> assignTeacher | Term but no year; no tenant/membership join; co-teaching representable but scheduling chooses one (G08/G11) | Same-school active staff and year-specific offering/term; intentional co-teaching; duplicate assignment idempotent |
| Subject enrolment | Course Review -> classSubjectStudent controllers/model | Arbitrary existing student/year IDs accepted; removal deletes all years (G11) | Validate historical class/year enrolment; explicit year on removal; no deletion of prior score/attendance history |
| Marks entry | Teacher/admin UI -> roster -> save/save-all -> enrol then score upsert | Reversed parameters, unassigned teacher write, invalid ranges, year roster mismatch, no batch transaction (G06–G08/G13) | Enrolled roster; finite 0<=score<=max, max>0; actor permission; policy snapshot; validate whole batch before atomic save; auditable correction |
| Teacher marks browser | my-subjects -> GET academic-years -> marks roster | Academic-years is admin-only, so a correctly isolated teacher cannot load current year; ID-only auth may mask this (G16) | Role-permitted minimal current-year context; browser test with teacher ID deliberately absent from Admins |
| Report generation | Admin report endpoint -> direct SQL -> averages/positions -> browser CSV/print | `subj.passmark` absent in declared subject schema; current placement; raw maxima; missing-score/tie semantics; CSV escaping (G09/G10/G12/G21) | Query valid on clean schema; historical cohort; policy version; tied rank/missing mark rules approved; safe tenant export |
| Promotion/graduation | Admin chooses class/year -> per-student update or promoted flag | Repeated invocation may promote again; current year/class overwritten; no eligibility or distinct graduation state (G10/G13/G25) | Preview and explicit source enrolments/target year; idempotent batch; new enrolments; preserve source; authorised overrides audited |
| Allocations | Admin -> allocation upsert -> ensure class-subject offering | Non-atomic; year context differs from assignment; integer validation weak | Whole operation atomic; same school/year parents; valid positive bounded period count |
| Timetable generation | Allocation + teaching slots + teacher map + busy map -> greedy placement -> delete/insert | Partial replacement; no concurrent generation guard; first co-teacher; no room/availability policy (G13/G14) | Atomic replacement with revision/lock; teacher/class/room conflicts denied; overflow preview; stable prior schedule on failure |
| Manual timetable | Admin creates entry directly | Required fields checked, no equivalent collision enforcement; slot FK drift | Same shared service and constraints as generator; time/slot coherence and same-school resources |
| Teacher/student timetable browser | Self schedule -> timetable/form-data -> render | form-data admin-only; missing slot metadata prevents intended grid under correct auth (G16) | Self endpoint returns safe required slots; no full admin dropdown leak; grid browser test per role |
| MCQ | Teacher creates exam/questions/status; student take/write; auto-grade; admin publish | Ownership/eligibility absent; configurable total vs fixed raw grade; question mutation and concurrent submission semantics weak (G08/G12/G26) | Decide MVP boundary; if retained enforce assigned owner, eligible enrolment, question snapshot and one atomic attempt; unpublished score hidden |
| Finance | Class fee defaults; student_fees MERGE per fee type | No year ledger/payment history; paid boolean not a receipt; validation/transactions limited | Preserve data; defer expansion pending scope; if MVP, define balances, adjustments and immutable receipts separately |
| Attendance/discipline | Not implemented | Requires historical roster, scheduled periods, specialised roles and private evidence handling | 7/8=1 missed; justified periods retained; audited corrections; no automatic dismissal; see backlog |
| Library | Not implemented | Requires copies/loans and concurrency controls | Copy-specific checkout/return; one active loan; immutable history; school-scoped borrowers |
| Laboratory | Subject has has_lab only; no inventory workflow | Flag does not establish stock, custody or safety processes | Stock ledger, units/batches, no negative concurrent balance, review/issue/return, expiry/damage handling |

## Cross-workflow invariants proposed for approval

- Actor, student enrolment, offering, teacher assignment, year and exported rows must all belong to the verified school.
- Historical facts survive promotion, transfer, withdrawals, renamed classes and policy changes; corrections are append/audit events.
- A batch explicitly promises atomicity or reports a designed partial-result contract. Silent partial success is unacceptable.
- A browser displays saved state only after server success, prevents duplicate submission, and distinguishes unavailable, empty and unauthorised states.
- Existing MCQ and sequence assessment stores remain distinct unless a separately approved mapping defines conversion.
- No medical documents are uploaded in early attendance delivery; proposed default is a restricted verified-paper reference, pending owner policy.

## UI/API contract discrepancies to resolve before calling a workflow complete

Teacher current-year loading and timetable slot loading call admin-only endpoints. Do not broaden admin endpoints to all roles to make these screens work; add minimal role-authorised read models. Existing authentication confusion can hide these defects when actor IDs overlap. Regression tests must use both overlapping and non-overlapping role IDs.

The main admin marks selectors use offering IDs despite variable names such as subjectId. Preserve the actual contract or rename with coordinated API/UI changes; testing only equal numeric IDs is insufficient. Bulk subject unenrolment currently omits year, so a UI-only year selector cannot make deletion safe.
