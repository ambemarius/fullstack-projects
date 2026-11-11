# M2 registration and enrolment history integration

30 October 2026. Implemented and verified in the isolated/synthetic workflow; not activated for LYCEE BATOURI. M1 remains accepted, M2 remains in progress.

## Delivered behavior

The preserved pupil registration form gains an Initial enrolment section when the server enables the staged ledger workflow. The administrator supplies the class, current academic year, verified start date, source reference and reason. No historical date is inferred. Dates after today in the school's configured time zone are refused; academic-year calendar boundaries are not inferred from a year name.

One SERIALIZABLE transaction creates the pupil, synchronized credential hashes, canonical account/membership/mapping, current class/year projection, year junction, enrolment identity/revision and audit events. Failure of the final personnel audit rolls back every preceding write, including the ledger. The shared ledger composition helper requires the same SQL transaction on every request and retains school/pupil locking, current authority, same-school parents and overlap protection.

The pupil table gains a History action displaying all recorded revisions, latest revision labels, dates and source/reason. Missing history explicitly remains unknown. Class/year names are current display labels, not historical label snapshots. Profile editing hides/disables the initial enrolment controls and cannot change placement. The staged personnel service rejects undated pupil withdrawal/return; the temporary preview exposes ledger reads only, so standalone ledger mutations cannot diverge from current projections. Teacher registration and status controls retain their existing behavior.

School switches and loss of authority clear private history immediately; stale responses cannot repopulate it. Source text is rendered using textContent. The history heading receives focus and its table scrolls within the panel on small screens.

## Scope and files

- `model/identity/personnelService.js`: trusted, default-off ledger option and atomic registration composition.
- `model/identity/enrolmentLedgerService.js`: shared SERIALIZABLE transaction helper; standalone staged ledger semantics retained.
- `routes/identity/personnelRouter.js`, `routes/identity/enrolmentLedgerRouter.js`: trusted opt-in and read-only preview boundary.
- `views/m1-original-registration.ejs`, `public/js/m1-original-registration.js`, `public/css/m1-original-registration.css`: conditional fields/history and privacy/accessibility handling.
- `scripts/m1Preview.js`, `scripts/m2RegistrationPreview.js`: temporary guarded synthetic preview with separate secure cookie, manifest-owned cleanup and startup authentication checks.
- `tests/ledger-registration.test.js`, `tests/sql/ledger-registration.test.js`, `tests/helpers/enrolmentFixture.js`: validation, browser logic, real SQL/HTTP, rollback and fixture cleanup.

The original pupil/teacher partials remain byte-preserved. Applied migrations001–009, staged010, production entry points and runtime policy were not changed by this integration. The option defaults off. Fee collection remains disabled; no fee, course, mark, existing password or real school record was modified.

## Verification

Full regression totals and durations are recorded in TEST_RESULTS.md. The new synthetic SQL test verifies foreign-school parents, noncurrent year, future date, wrong role, missing CSRF, successful HTTP201 and ledger receipt, matching hashes without disclosing them, unchanged history after profile editing, undated status409, read-only ledger405, duplicate409 and final-audit rollback. Fixture cleanup restores baseline pupil/account/audit/fee counts and migration checksums.

Browser verification used only two temporary fictional schools on HTTPS2028. The existing synthetic pupil in Ledger A had two explicit revisions; both rendered. Switching to Ledger B removed A's history and displayed only B's pupil; B's history showed the unknown-history notice. At widths1280,390 and320 there was no document horizontal overflow; the history table scrolls internally. New fields fit inside320 pixels. Source → reason → Register Student keyboard traversal passed. Profile edit disabled all initial enrolment fields and current class/year; reset restored required fields. Teacher tab retained its original form and hid pupil enrolment fields.

Browser registration submission and new credential entry were not performed; submission was exercised through the isolated frontend test and actual synthetic HTTP/SQL test. Logout was invoked, then the temporary tab was closed and viewport reset. Preview process1124 exited successfully after `finish`, removed its owned fixtures/staged tables and deleted its runtime manifest. Its session cookie name was isolated from the real application. Pinned real-school HTTPS checks passed without using any real password.

Screenshot: [Synthetic pupil history](evidence/m2-enrolment-history-2026-10-30.png).

## Activation and remaining work

This is a staged increment, not a production rollout or M2 completion. No production schema migration or listener restart was performed. Keep ledger writers unmounted until current projection, dated withdrawal/return, transfers and subject-link changes share reviewed transactions. Review historical evidence separately; an empty ledger must never be presented as a complete legacy cohort.

Next integrate dated transfers/status with profile-version checks, current placement/year junctions, account access and course-link preservation, then year-specific offering/assignment history. Fee/calendar policy and unresolved legacy dates remain explicit gates; do not invent them. Rehearse the concrete migration/activation/rollback packet and obtain the required production review before promoting staged010. M3 grading/promotion remains outside this increment.

Rollback before activation: leave the server option off and staged routers unmounted. No production data undo is needed. Never disable M1 tenancy flags or shared legacy write locks as a rollback.
