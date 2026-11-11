# Proposed schema and migration plan

Newest synthetic execution: 007 introduces explicit nullable teacher year and versioned soft link states, preserving original unknown years. Scoped roster access uses only confirmed assignments; no current-year inference. Rolled-back rehearsal and tests pass before/after installation. Do not reintroduce yearless uniqueness after multi-year links exist. See ../implementation/M1_ACADEMIC_LINKS.md for exact scope/rollback limits; historical reconstruction and full runtime cutover remain pending.

Newest synthetic execution: 006 scopes business/current-year keys, adds versioned academic setup/canonical creators, and preserves unresolved uniqueness/legacy actor values. Rehearsed with rollback before installation; no production application. Do not reintroduce global unique constraints blindly after shared school identifiers exist. See ../implementation/M1_ACADEMIC_SETUP.md for execution evidence and rollback/cutover limits.

Latest synthetic increment: 005 profile version/audit expansion rehearsed with rollback and applied only to the synthetic target. Scoped pupil/teacher writes are transactional and tested through an unmounted API factory. Existing browser/database deployment is unchanged; see ../implementation/M1_PERSONNEL_WORKFLOWS.md for exact scope, rollback and remaining activation gates.

Newest synthetic execution: ledger 004 and explicit reconciliation tooling are implemented and tested with rollback/concurrent-repeat evidence; see ../implementation/M1_RECONCILIATION.md. First scoped personnel read repositories are internal only. No production/current-school backfill or guessed actor assignment has occurred. The real-data migration sequence and cutover gates below remain outstanding.

Latest continuation, 26 October: additive 003 ownership expansion is also applied to synthetic SQL after a rollback rehearsal. It adds nullable ownership and composite same-school FKs without backfill or runtime activation. See ../implementation/M1_IDENTITY_PROGRESS.md for current execution; the historical sequence below still describes outstanding real-data reconciliation/cutover gates.

Original audit design below is retained for reference. **Current status, 26 October 2026:** proposals approved; M0 accepted by owner with the documented automated recovery exception. Baseline 001 and additive identity foundation 002 are applied only to the approved synthetic MARIUS/lms_test_codex database. No legacy/production data migration or runtime tenancy activation occurred. See `../implementation/M1_IDENTITY_PROGRESS.md` and root PHASE_STATUS.md for executed scope and remaining gates. `DATA_DICTIONARY.md` describes the original legacy DDL.

## 1. Strategy and identity decision

Recommend a shared SQL Server schema with explicit school ownership and composite tenant foreign keys for the pilot, subject to capacity/security review. Separate-database tenancy remains an alternative if contractual isolation or scale demands it; it costs more operationally and does not remove application authorisation requirements.

Recommend canonical `accounts` plus school memberships, preserving existing person records and IDs through a mapping. Do not merge accounts merely because independent tables share an ID or email. Proposed entities:

| Target | Key and core rules |
|---|---|
| schools | canonical ID, unique code, name, education_system, status, timezone, settings_version; Africa/Douala proposed default, not execution-host timezone |
| accounts | canonical ID, credential hash, login identifier strategy, status, session/security version; no implicit global authority |
| legacy_account_map | unique (source_table, legacy_id) -> account_id; source and reconciliation status; no source credentials in logs |
| school_memberships | unique (school_id, account_id), status; supports multi-school staff without granting automatic access |
| membership_roles | unique membership/role; role combinations admin/teacher/student/discipline_master/librarian/lab_attendant |
| platform_role_grants | separate platform permission grants; school admin never implies platform permission |
| sessions | hashed opaque session identifier, account, active membership, expiry/revocation, CSRF association; session switch revalidates membership |
| migration_runs / migration_exceptions | version/checksum, counts, provenance, approval record, unresolved exception IDs, no sensitive payloads |
| audit_events | school, actor/membership, action/resource ID, timestamp, reason/request ID; restricted redacted detail |

M0 may first introduce role-bound JWTs over existing identities as a containment step. That is transitional, with forced logout and no acceptance of old ID-only tokens. Final canonical-account migration must not coexist with permissive legacy verification.

Prefer same-origin Secure, HttpOnly, SameSite cookies with server-side sessions, CSRF token validation on state changes, Origin validation, bounded expiry, rotation at login/school switch, and revocation after role/status change. Stateless role-bound JWT bearer clients can remain only if explicitly required, with issuer/audience/algorithm/expiry checks and server-side membership validation. Cookie migration changes the browser API helper and login/logout contracts; requires review and HTTPS test coverage.

## 2. Current-to-target mapping: every existing table

| Current entity | Proposed ownership and evolution | Backfill constraints |
|---|---|---|
| Admins | Legacy person/account mapping + school membership, no platform promotion | Assign verified legacy school only; owner explicitly designates initial platform operator |
| teachers | school staff profile + canonical account; employment membership/status per school | Map each legacy row separately; reconcile matricule/matriculeFile and split-name fields |
| auxiliary_staff | school staff profile; optional invited account | Personnel role string does not create a permission grant |
| students | school student profile + account link; current fields become compatibility projection | Preserve old IDs, sensitive fields restricted; transfer creates destination enrolment under approved policy |
| academic_years | school_id; unique school/name; filtered unique school/current | Preserve IDs and current flags; stop if multiple source schools are discovered |
| classes | school_id; configurable level/section/stream/class group | Copy 21-class structure as optional school template, not global constraint |
| subjects | school_id; unique school/code; optional global template link | Preserve catalogue; do not guess passmark or overwrite offering coefficients |
| class_subjects | school_id + year-aware offering/version; coefficient/policy snapshot | Create per-year offerings only from evidence; map old offering/year to target |
| class_subject_teachers | school_id + offering/year + term + staff membership | Year is unknown in legacy rows; owner confirms active assignments; do not replicate to all historical years |
| class_subject_students | school_id + offering version + student_enrolment_id | Existing year known, class association must be reconciled with history |
| academic_year_students | consolidate into student_enrolments with class and effective dates | Junction gives year but not class; insufficient to reconstruct class history alone |
| academic_year_teachers | reconcile school staff/year participation with year-aware assignments | Keep source provenance; no inferred historical teaching load |
| subject_scores | school_id + enrolment/offering/policy + term/sequence; actor account ID | Map created_by ambiguous role IDs through approved evidence or leave unresolved, never guess |
| exams | school_id + year/offering + creator membership + policy snapshot | Preserve status/date/marks; reconcile class/subject/year against target offering |
| questions | school_id + exam + creator membership; immutable attempt versioning | Derive school from parent exam; preserve answer protection |
| exam_results | school_id + exam/attempt + student_enrolment_id | Derive school only after all parents reconcile; unique student/exam attempt semantics maintained |
| subject_allocations | school_id + offering/year + periods | Existing class/year sufficient only when valid; enforce positive integer rules |
| time_slots | school timetable-calendar/slot configuration | Copy legacy school slots; do not assume all new schools have eight periods |
| timetables | school_id + class/year/term/slot/teacher membership + optional room | Resolve missing slots and overlapping rows before adding uniqueness/FKs |
| student_fees | school_id + student + optional verified year/reference | Legacy has no year: retain as legacy-unallocated; never invent payment dates/receipts |
| regions | candidate global read-only reference | Explicitly designate global; not ordinary school-writeable data |
| divisions | candidate global reference under region | Preserve hierarchy; any future school-specific extension separate |
| subdivisions | candidate global reference under division | Preserve hierarchy; location strings in students require reviewed matching |

Target `student_enrolments`: school_id, student_id, academic_year_id, class_id, effective_from/to, status (active/withdrawn/transferred/completed), provenance/confidence, source reference. Enforce one active placement at a time using an approved transfer/date model; do not impose one-row-per-year if midyear moves must be supported. Reports and attendance resolve the effective historical enrolment, not current student fields.

New module tables proposed: attendance_sessions/entries, absence_justifications and period links, attendance_audit, discipline_policies/cases; library_titles/copies/locations/loans/loan_events/acquisitions; lab_items/batches/locations/balances/movements/requests/request_lines/issues/returns/requisitions. All operational roots carry school_id and descendants use composite same-school references. Unit/quantity and privacy policies are decisions before schema finalisation.

## 3. Tenant keys and repository rules

- Add nullable school_id first; after reconciliation make mandatory on school-owned rows. A migration-stage nullable field is never a runtime wildcard.
- Parent tables expose unique (school_id,id). Child FKs reference (school_id,parent_id), preventing mixed-school references even when an ID is valid globally.
- Change global business uniqueness deliberately: school/code for subjects; school/matricule for students; school/year/name; school/class naming rules; school/offering/year/term/sequence. Global account login identifiers remain a separate identity decision.
- Replace current-year uniqueness with filtered unique school_id WHERE isCurrent=1; check parent/child nullability and index key widths on actual SQL Server version.
- Add lookup indexes beginning with school_id plus actual filter keys (year,class,student/teacher,term). Measure on pilot volumes before adding every speculative index.
- Timetable constraints: unique school/year/term/class/day/slot and school/year/term/teacher/day/slot; room uniqueness filtered for non-null room ID. Co-teaching may require a separate lesson-teacher junction rather than duplicate lessons. Time intervals need overlap checks beyond slot equality if arbitrary times remain allowed.
- Scope reads, COUNTs, searches, joins, exports, deletes, batch upserts and seeds. Do not rely on filtering the final returned array. Platform paths require separate explicit authorisation and audit.

## 4. Migration sequence and stop conditions

| Step | Proposed action | Required evidence / stop condition |
|---|---|---|
| P0 | Confirm environment, SQL version/collation, owner and explicit test DB authorisation; recover repository baseline | Stop on unknown target DB or ambiguous school ownership |
| P1 | Owner-managed encrypted full backup; include relevant log chain for recovery model; document keys and access | Restore backup into isolated server and validate counts and sample integrity; backup success alone insufficient |
| P2 | Capture schema, row counts, constraints, duplicates, orphans, null year/class, role/status and assignment inconsistencies | Redacted reconciliation report; no PII in committed fixtures; classify unresolved records |
| P3 | Approve versioned expand migration: schools/accounts/mapping/membership/audit and nullable school references | Ledger checksum, preconditions, repeat-run behaviour; dry-run on restored copy |
| P4 | Create designated legacy school only after ownership attestation; map legacy accounts without ID/email auto-merging | Mapping totals match each account source; no unintended platform permissions |
| P5 | Backfill school IDs topologically; verify parent agreement; batch with resumable migration run IDs | Every school-owned row mapped exactly once; mixed/unknown parents quarantined, not silently assigned |
| P6 | Build enrolment/offering history from trusted exports/records, current placement and existing score/exam evidence | Current placement is current evidence only; score-derived class/year candidates are not certified history; owner resolves contradictions |
| P7 | Clean/reconcile duplicates and invalid data under approved correction plan; add trusted composite FKs/indexes and NOT NULL | No unresolved row may be made visible through a default tenant; constraint validation passes |
| P8 | Deploy canonical auth/context and scoped repositories together behind maintenance/feature gate | No period where new tenants can use unscoped old queries; old tokens invalidated |
| P9 | Cut over one pilot school; verify permissions, counts, marks totals, reports, exports and histories | Signed reconciliation and isolation suite; rollback window and support owner available |
| P10 | Contract legacy fields/code only in separate later approved release | Do not drop legacy IDs, raw source evidence or recovery mapping during initial pilot |

Never run existing setup/seed scripts over the production copy to perform this migration. Their inline migrations drop old teacher status fields before preserving their values, and student migration fabricates sex/year values. Those behaviours require replacement, not trust.

## 5. Backfill integrity and unavailable history

Record before/after counts per table/school; ensure mapping cardinality, orphan count zero, old/new FK agreement, distinct actor mapping, score/result sums by known year and school, fee totals, and schedule counts. Compare generated report outputs only once existing SQL/policy defects are understood; a buggy legacy report is not the sole oracle.

Do not infer sex from ID parity, historical class from age/rank, year from fixed constants, fee year from current student placement, or actor role from a numeric ID. Where evidence is missing, preserve original facts and mark provenance unresolved. Owner-approved archival access may be necessary until a cohort is reconciled. Never erase valid old scores to make constraints pass.

## 6. Rollback, writes and restore

Expand-only pre-cutover rollback: stop migration, leave additive structures inaccessible, retain source rows/IDs, resume by migration run ID after repair. Do not drop populated new tables reflexively.

At cutover: maintenance/read-only window, final backup, final backfill reconciliation, deploy scoped code and schema compatibility as one release. Before reopening writes, smoke-test two-school isolation and policy invariants.

If cutover fails before new writes: revert to the approved hardened single-school build and compatible schema, or restore to isolated replacement then switch only after validation. Never revert to the vulnerable ID-only auth build.

If new writes exist: a blind restore loses them. Stop writes, export/reconcile the delta under restricted access and choose forward repair or point-in-time recovery plus approved replay. Define RPO/RTO with the owner and rehearse elapsed restore time. Destructive restore, dropping fields and production cutover require separate explicit approval.

## 7. Approval packet required before execution

Owner approves identity/login/session choice, legacy-school mapping, role matrix, historical-data exception policy, grading preservation and MVP scope. Technical sign-off includes exact migration SQL/checksums, affected counts, target environment identity, restore drill evidence, dry-run duration, rollback build, write-freeze plan, named operator and bounded credentials. This document is a design for that packet; no executable SQL has been applied.
