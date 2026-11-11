# M1 scoped offerings, enrolment and teaching permissions

Implemented and tested 26 October 2026. M1 remains in progress; new routes are not mounted in the running legacy application.

## Files and migration

- `migrations/007_scoped_academic_links.sql`: nullable explicit academic year, active/revoked status and positive link_version on teacher assignments; active/revoked status and link_version on pupil subject enrolments. Teacher uniqueness now includes academic year. Trusted year and same-school year FKs are added. No new tables; synthetic count stays 35.
- `model/identity/academicLinksService.js`: administrative offering creation/listing; current-year atomic pupil enrolment/revocation batches and year-specific teacher assignment/revocation; admin link inventories; assignment-authorised teacher rosters and actor-derived self views.
- `routes/identity/academicLinksRouter.js`: unmounted cookie/Origin/CSRF-protected factory. Paths R135–R143 are recorded in the route matrix.
- `tests/academic-links.test.js`, `tests/sql/academic-links.test.js`: validation and real synthetic SQL/API permission, transaction and history-preservation tests.

Only MARIUS/lms_test_codex was migrated. No live database, real-school data, legacy account configuration or browser route was migrated/activated. Existing server remains at http://localhost:2026/login; health check returned 200.

## Why explicit year is necessary in M1

Original teacher assignments contain offering/teacher/term but no year. Such a record cannot safely grant access to a year-specific roster. Migration 007 leaves every original academic_year_id NULL rather than assuming the current year or copying an assignment into other years. New assignments require an explicit current academic year and same-school parents. Existing NULL-year links never authorise scoped roster access.

This is a prerequisite for M1 object-level authorisation, not completion of M2 historical repair. Existing historical class/teacher placement and ambiguous actors remain unresolved. Offering roots still use the legacy class/subject structure, and no year-specific coefficient snapshots or grading policy are inferred. Offering coefficient edits are not exposed.

## Write contracts

All writes require verified school-admin context, an independent SQL session/account/membership/school/role check, serializable transaction and per-school application lock. Parent queries and data writes use exact school predicates. Unknown actor/ownership fields and malformed scopes are refused. Every changed link is versioned and audited without names, medical fields or credentials.

### Offerings

Creation accepts classId, subjectId and optional coefficient. Both parents must belong to the verified school. Coefficient is positive, representable exactly to two decimal places and at most 99.99, matching the existing DECIMAL(4,2) field. Omission uses the legacy default 1. There is no automatic catalogue coefficient normalisation or report-policy change. Duplicate class/subject roots are refused. Creation/listing is admin-only; no update or hard delete is added.

### Pupil subject enrolment

Input: `{offeringId,yearId,changes:[{studentId,action,version}]}`. Actions are enrol/revoke; a batch contains 1–100 unique pupil IDs. Version 0 means no existing link; otherwise supply the current link version. These are link versions, not personnel profile versions.

The offering/year and every pupil must belong to the school. Writes are limited to the current year. Enrolling requires a non-withdrawn pupil whose explicit present-day profile year/class matches the requested year and offering class. Unplaced/inconsistent pupils require review; this service does not assign class/year or invent history. A matching year-participation row is inserted only from those verified current facts when absent; existing unresolved conflicts stop the transaction rather than being claimed automatically.

Revocation retains the link as revoked, increments its version and preserves year participation. A link with recorded marks for that pupil/offering/year cannot be revoked without a separately reviewed correction. No all-years unenrolment or physical deletion is exposed. Re-enrolment validates current placement again. Matching active/revoked state with the current version is a no-op; stale versions conflict. One invalid pupil or late failure rolls back the entire batch, including earlier links, participation and audits.

### Teacher assignments

Input: `{offeringId,yearId,teacherId,term,action,version}`. Terms are First/Second/Third; actions assign/revoke; version follows the same absent/current-link convention. Assignment requires active same-school teacher, own offering and explicit current year. New assignment retains year participation; revocation retains the assignment and participation and removes future scoped permission. Past-year writes are refused. Legacy NULL-year rows stay unchanged alongside newly confirmed year-specific rows. Co-teachers hold independent links.

## Read and permission contracts

- Administrative offering/link inventories are school-scoped. Inventories include revoked link state/version so an admin can explicitly reactivate the correct record. Teacher inventories require an explicit term; they do not expose legacy NULL-year records as confirmed assignments.
- A teacher roster requires the teacher's own verified canonical-to-profile mapping, active profile and exact active offering/year/term assignment. School admin can read own-school rosters. Pupils cannot read peer rosters. SQL repeats the permission predicate in the data statement to prevent reuse after revocation.
- Rosters expose only basic pupil identity and enrolment version, never password or medical data. Only active subject enrolments are included. This is subject membership, not a certified historical class/attendance roster.
- Self assignment discovery derives the teacher from the session mapping and filters exact year/term/active state. No arbitrary teacher ID is accepted. NULL-year links grant nothing.
- Self enrolments derive the pupil from the session mapping, return only own links/status/version for the requested year, and do not accept a caller pupil ID. Revoked records remain visible to the account as its own history while the account/membership is otherwise authorised.

All factories remain unmounted. Legacy physical-deletion and yearless-assignment paths must be replaced or disabled at canonical cutover; they do not acquire these safeguards automatically.

## Executed verification

`npm.cmd test`: **51 passed**. `npm.cmd run test:sql`: **12 passed**, zero failures/skips/TODO on the approved synthetic target. Migration 007 was rehearsed and rolled back before ledger installation (`Rolled back 007_scoped_academic_links.sql`); subsequent repeat-run and trusted-FK checks pass. No applied migration checksum changed.

Tests cover malformed/duplicate/oversized enrolment scopes and privilege-field refusal; offering decimal precision and same-school parent checks; duplicate offering refusal; current/unplaced/prior-year guards; a bulk late foreign-pupil failure leaving no link/year-participation/audit; concurrent absent-link creation with one success and one stale conflict; soft revocation preserving inventories; and refusal to revoke marked membership.

Teaching tests preserve an original NULL-year assignment and prove that it grants neither self discovery nor roster access. A new explicit assignment grants only its exact offering/year/term. Foreign-school/term/year and pupil-role roster access are denied. Two same-school co-teachers work independently; revoking one removes only that teacher's access. Recorded marks, unresolved original links and year participation remain in place.

Real loopback HTTP tests exercise CSRF rejection, assignment reactivation, teacher roster and pupil self enrolments using manually attached secure-cookie headers and a fixed HTTPS Origin. Independent SQL write/read revocation checks also pass. These are not actual HTTPS browser acceptance tests. Exact synthetic school fixtures are removed afterward; unrelated seed/recovery data remains untouched.

## Rollback and continuation

Pre-activation rollback leaves additive fields and unused routes in place. Failed transactions roll back. Do not restore the old yearless uniqueness constraint blindly once explicit assignments exist in more than one year; retain data and use reviewed reconciliation/forward repair. No destructive down migration is provided.

Next M1 work: apply equivalent assignment/enrolment boundaries to marks/reports and timetable/retained exam/finance paths; complete administrator/auxiliary and existing-account onboarding policies; canonical browser login/CSRF lifecycle; require reconciled ownership and full two-school/browser acceptance before activation. M2 historical academic repair remains queued. No new grading threshold, passmark or historical placement is approved by this increment.
