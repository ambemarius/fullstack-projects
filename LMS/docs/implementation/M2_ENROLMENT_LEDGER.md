# M2 enrolment ledger — staged implementation

30 October2026. Owner requested continuation with the enrolment ledger. **Backend and staged schema verified; not activated.** This increment implements staged schema010, an administrator service and unmounted API; activation and M2 completion remain separate.

## Change review

Files: `docs/implementation/staged/010_enrolment_ledger.sql`, `model/identity/enrolmentLedgerService.js`, `routes/identity/enrolmentLedgerRouter.js`, isolated and synthetic SQL tests plus fixture helper. No applied001–009 migration is edited. No source backfill, legacy field update, grading/promotion change or new live route. The staged SQL is outside the executable migration directory.

Rollback before activation: leave routes unmounted; no production data undo. Synthetic rehearsal creates both tables in a transaction and rolls back, then temporarily installs them solely for integration tests. Cleanup refuses pre-existing tables or any non-fixture ledger roots; drops only the schema created by that test and removes its own synthetic school fixtures. Existing test schema/history and source counts must match afterward. Production activation requires the concrete migration approval/rehearsal, registration/projection integration and browser checks from the master plan.

## Date and history contract

- Every placement requires an explicit class, academic year, start date, end date (or explicit null), source reference and reason. No dates or cohorts are inferred from present-day pupil fields or subject marks.
- Date periods use `[fromDate,toDate)`: start included, end excluded. A transfer effective1 January places the pupil in the old class through31 December and the new class from1 January. Adjacent periods are allowed; overlaps across any classes/years for the same school pupil are refused.
- Records have immutable identities and append-only revisions. Corrections append a complete new revision with an expected version, actor, source, reason and operation identifier. Earlier facts remain inspectable; SQL triggers prohibit ordinary UPDATE/DELETE of identities/revisions.
- `enrolled` may have an open or bounded period. `withdrawn`, `transferred` and `completed` require an explicit end. `voided` marks a correction whose latest revision is excluded from rosters but does not delete older evidence. Completion is explicitly recorded, never inferred from grade/rank.
- Transfers require an enrolled source and a date strictly after its start and before a finite end. The old period closes and a new identity/placement opens atomically, sharing one operation ID. Same class/year no-op transfers are refused. Inter-school identity transfer is not implemented; there is no cross-school merge.
- School academic-year names are not exact calendars. The service does not invent year start/end days from integer year labels. Explicit school calendar validation remains an integration concern before activation.

## Security and consistency

Only fresh school-admin sessions may use these APIs. Every data statement rechecks SQL session/account/membership/role authority; every FK joins school and object identity, including revision actors. Source references/reasons are private administrator data, omitted from operational roster output. GET replies are no-store; writes require same-origin and CSRF. No caller-selected school/actor fields are accepted.

Writes run SERIALIZABLE with a transaction-owned application lock for the school/pupil. Latest revisions are checked for overlapping intervals across years, expected versions protect corrections/transfers, and each append includes an atomic audit event. Audit failure rolls back the full transfer. Only the service owns this overlap invariant; database constraints alone cannot reject arbitrary direct INSERT overlaps. No alternate ledger writer may be activated without the same locking and invariant checks.

Historical rosters use latest reviewed revisions and date periods, including the past portions of transferred/withdrawn/completed placements. They do not filter by current pupil withdrawal/class/year. Corrections intentionally change the corrected historical view while preserving previous revisions for audit. Rosters use100-row keyset pagination. History refuses more than1000 revisions rather than silently truncating evidence. Roster coverage is limited to explicitly recorded ledger entries: an empty roster must not certify that an unreconciled legacy cohort was empty. Reconciliation coverage checks are required before any report/attendance workflow consumes it as a complete cohort.

Current `students` placement, year junctions, subject enrolments, fees, grades and credentials remain unchanged by this staged service. Therefore do not mount it as a standalone production writer: the upcoming registration/course integration must coordinate those projections transactionally before real use. This increment provides no permission to teachers/pupils from ledger entries.

## Verification

Full `npm.cmd test`: **127/127 pass**, zero failures/skips/TODO,34.764 seconds. Full `npm.cmd run test:sql`: **26/26 pass**, zero failures/skips/TODO,173.297 seconds. Final focused run after strengthening destination-audit failure injection: **3/3 pass**,10.017 seconds. No pending executable migration was applied.

Verified DDL creation/rollback with trusted FKs; interval/date/provenance validation; one-winner simultaneous overlapping creates and transfers; cross-year overlap refusal; corrections with stale-version rejection; no UPDATE/DELETE of identity/revisions; foreign class/year/student and broken revision-chain SQL rejection; exact transfer start/end boundaries; preserved past rosters after current class/year/withdrawal changes;101-pupil two-page roster without duplicates. Actual HTTP checks cover create/revise/transfer/history, no-store, role isolation, injected school fields, origin/CSRF and revoked sessions. Destination-audit failure occurs after the source closure and destination append, then restores the original single revision/root through transaction rollback. Earlier snapshots remain intact after valid correction/voiding.

Each test run removes only its own temporary ledger tables and synthetic fixtures. Final tables are absent and baseline student/school/score/audit counts and migration checksums match. No schooldb schema/data/password changes, no process restart and no live route activation occurred. Pinned HTTPS health passed. Nine applied migrations, runtime policy and both dependency manifests match the pre-increment checkpoint (12 files checked).

Initial rehearsal caught a duplicate constraint name already used by migration007; it was renamed in staged010 only, rollback verified, and all tests rerun. The test harness now retains the original SQL diagnostic when SQL Server has already aborted a transaction. Missing dependencies were restored; a locked running bcrypt binary was preserved. A temporary dependency-version drift during recovery was corrected: every installed applicable package matches the unchanged lockfile, with no manifest change. Sandbox SQL denial was rerun with approved access. No failed test was waived.

## Next integration gate

Build the administrator review/record/transfer interface and coordinate the original registration/current-placement/fee/course projections in the same transaction before mounting live writes. Rehearse the concrete migration010 and reconciliation path without inventing old dates; then obtain its production migration approval, activate using verified process ownership and run browser acceptance. Keep new tables additive; never undo by dropping populated production history. Until then, the active M1 application continues to use its existing scoped workflows, and M2 remains in progress.
