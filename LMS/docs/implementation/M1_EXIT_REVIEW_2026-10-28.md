# M1 implementation exit review

**29 October update:** all pending technical browser checks below are now complete. Browser-level viewport emulation was discovered and used successfully; mobile, full keyboard traversal and synthetic two-school visual switching/teacher denial pass. Registration privacy-on-switch fix and cookie-isolated test host are covered by the latest122 passing isolated tests. Prior24 SQL baseline retained; no SQL/schema change. Final real HTTPS health passes; temporary preview cleaned up. See M1_BROWSER_ACCEPTANCE_2026-10-29.md. Only formal owner acceptance remains; earlier unverified/unavailable browser statements below are historical.

28 October 2026. **Ready for final acceptance; M1 remains open until acceptance gates pass.**

## Final implementation

The approved identity, school ownership, canonical account/session, personnel, auxiliary/native staff, exact-account invitation and local access lifecycle work is delivered. Original pupil/teacher forms remain in use. Original LYCEE BATOURI adoption and migrations001–009 are complete and were not repeated.

The remaining retained original read boundaries now use fresh verified legacy school/account/member/source/version/expiry authority and SQL-level predicates:

- 14 academic/reference/auxiliary/geography paths: class lists/details/fees/offerings, subject lists/details, academic-year lists/details, school-local current-year/slot context, auxiliary lists/details and3 geography lookups.
- 1 report-card path: same-school class/year/student/offering/subject/score joins. Grading, totals, ordering and report response code remain unchanged.
- 2 own-profile paths: signed teacher/pupil source identity only; request IDs/school values do not select another person. SQL rechecks source role/status, canonical/source credential equality, member role/status, version and expiry. Pupil year join is same-school.

Earlier3 allocation,8 timetable,9 personnel and3 exam-result paths remain scoped. Inventory now explicitly marks all40 retained authenticated handlers across107 declarations/94 legacy APIs. All94 legacy method/path combinations remain404 in canonical runtime. Declaration coverage is not a general claim that old shared model functions are safe when called elsewhere; future routes need their own review and the completeness regression will reject an unassessed retained declaration.

Geography is intentionally shared Cameroon reference data, with SQL-level current administrator authority and parameterized parent IDs. No school ownership is fabricated for these tables. Class/teacher catalog associations remain descriptive; they do not grant year/term teaching permission. Canonical teaching authorization still requires explicit current-year assignments. Legacy NULL years remain untouched.

## Report compatibility

The old report query references an optional subjects.passmark column absent from the baseline schema. The scoped reader checks column metadata behind the same authority predicate and projects NULL when absent; the unchanged report code already converts that to50. Existing values are used when the column exists. No column or grading policy was added.

The grade function and complete row-to-response block match prechange checkpoint1793136364154_source.json.gz after newline normalization: SHA256 `8b4dd764e0e8dde8706e65d2f8ffbc9d9a06afb2a2a198859ca9329e417175a9`. Synthetic report fixtures verify42.5 average, B grade, rank1, default50, excluded withdrawn pupils and foreign class/year denial. This scopes the existing current-placement report; it does not repair historical enrolment/report semantics reserved for M2/M3.

## Verification and activation

118 isolated +24 synthetic SQL tests passed, zero failures/skips/TODO. Final focused reference/report/self SQL and6 boundary tests passed. Coverage includes all14 actual reference HTTP paths, own/foreign objects, school-local metadata, shared geography, counts/parents, malformed input, report response/defaults, teacher/pupil own-profile spoofing/wrong-role denial, recovered-version denial, withdrawn pupil denial, cache headers, original409 locks and all94 canonical exclusions.

Early sandbox SQL/loopback denials were rerun under approved permissions. Initial report fixture lacked its required editor attribution; corrected before activation. The absent passmark column defect was then handled as described above. A self-profile cache assertion was corrected to accept the existing stricter no-store/no-cache header. Final suites passed; no failure was waived.

Fresh original read-only readiness passed. Enabled legacyScopedReferences, legacyScopedReports and legacyScopedSelf after validation; restarted only the process whose executable/script/port ownership matched the tracked original listener, launchPID56744. Canonical52032 remained running. Live anonymous401, active scope markers, existing409 locks and pinned-certificate canonical HTTPS checks passed. No TLS validation bypass.

No real school record/password/account/status/invitation/publication/schedule mutation, schema migration, source restore or real sample seed was performed by these tests. Positive data mutations were limited to guarded synthetic fixtures with cleanup. Applied migrations001–009 remain immutable.

## Browser evidence and remaining acceptance

The current browser successfully displayed the real signed-in school workspace and preserved Student and Teacher registration forms. The earlier certificate handoff is resolved and must not be repeatedly requested. A desktop panel-width overflow clipped the Teacher tab; canonical registration CSS now constrains flex/grid minimum width, contains table scrolling and stacks the fees panel at narrower widths. Both tabs and blank forms were visibly verified afterward. Original field groups and colors were retained. Registration type pressed states, visible focus outlines and menu expanded/Escape behavior were added.

Non-sensitive pupil-form evidence: evidence/m1-registration-responsive-2026-10-27.png. The Teacher form was also visually inspected without submission. A subsequent keyboard attempt found the browser had returned to sign-in; no credential was entered. Therefore keyboard workflow completion is NOT claimed. Browser capabilities expose no viewport emulation; mobile visual checks are NOT claimed. Two-school switching/denial is SQL/HTTP-tested, but its full visual workflow remains pending in an isolated synthetic context. No additional real school is enabled for acceptance testing.

The remaining gates are full keyboard/mobile/synthetic two-school visual acceptance and owner workflow sign-off. These are not satisfied by passing API tests or initial proposal approval. Keep M1 open and M2/additional real-school onboarding gated until recorded acceptance closes them. Routine implementation automation should stop after reporting this acceptance handoff; do not keep waking to repeat an unchanged human gate.

## Repair and handoff

Keep all active scope flags TRUE and shared legacy writer locks enabled. False selects old global fallbacks on retained handlers. Repair scoped code or apply a reviewed temporary denial; never restore data or drop populated school/account links as a code rollback. Use tracked process ownership checks for any restart. Preserve original forms, source records, credentials and unresolved historical placements.

Current checklist: M1_COMPLETION_CHECKLIST.md. Current route evidence: ../architecture/ROUTE_BOUNDARIES_2026-10-27.json. Earlier records remain historical and do not supersede this acceptance status.

28 October follow-up: implementation automation `continue-lms-m1-implementation` deleted successfully after the acceptance handoff, as its instruction requires when only recorded visual/owner acceptance remains. Do not recreate it or advance M2 automatically. Last source checkpoint before this note: backups/source/1793193649909_source.json.gz (335 files, secrets excluded).
