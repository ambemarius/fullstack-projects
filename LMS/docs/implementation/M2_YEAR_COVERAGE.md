# M2 academic year coverage and retention

5 November 2026. The synthetic administrator workspace includes **Year coverage**. Select an academic year to review recorded pupil and teaching evidence before planning a historical correction or archival. The report requires staged schemas 010–012. Its route is enabled only in the dedicated M2 preview.

## Reading the counts

| Measure | What it counts |
| --- | --- |
| Source pupils | Distinct pupils across year membership, subject enrolment (including revoked links) and raw subject scores. A pupil appearing in all three sources counts once. Current profile pointers are shown separately. |
| Dated pupils | Distinct pupils with at least one non-voided latest enrolment revision in the year. A transfer can produce several periods for one pupil. A revision moving a period to another year removes the old period from the old year's count. |
| Placement gaps | Source pupils without a dated placement, dated pupils without a year membership, and distinct pupil/offering pairs without a placement in the offering's class at any point during the year. |
| Teaching gaps | Referenced offerings without an annual coefficient, assigned teachers without a year membership, and explicit-year assignment rows lacking an event for the current link version. Revoked assignments are retained. |
| Unknown assignment years | Counts undated assignment rows for the entire selected school. This figure repeats when reviewing another year of the same school. |

The administrator GET at `/api/setup/academic-years/:id/coverage` returns aggregate counts. School scope comes from the authenticated membership. The query rechecks authority inside a serializable transaction. The UI clears old results on year changes and discards results that arrive after a school switch. A matching class only establishes some placement in that year. Dates for individual lessons, complete class rosters, paper registers, exam results and grading policy require separate evidence. Zero gaps across these sources cannot certify a historical cohort.

## Year retention review

The original academic-year delete controller counted only pupil membership rows before deleting the year. A year can also carry marks, assigned teachers, dated enrolments and annual coefficients. The controller now refuses deletion before any database lookup, including when mounted independently of the legacy write gate. The deployed legacy write gate already rejects these requests. Canonical setup exposes no hard-delete route.

Selecting a different current year leaves the previous one available for review. It can still be made current through setup. An explicit archive therefore needs its own durable school/year record. The next increment should record the actor and version, refuse archival of the current year, preserve every dependent row, keep archived years readable, guard edits and reactivation, and test concurrent archive/current requests and late audit failure. Review outstanding open pupil placements before closing a year. Coverage discrepancies must never trigger automatic repairs.

## Verification and rollout

141 isolated tests and 31 synthetic SQL tests passed. Test fixtures covered duplicate source evidence, revoked links, missing coefficients, corrected years, voided placements, school-wide unknown years, teacher access denial and cross-school identifiers. Both synthetic administrators retrieved coverage through certificate-verified HTTPS on port 2028. Anonymous requests returned 403 and a foreign year returned 404. The temporary preview exited and removed its fixtures. The public M1 health check passed.

This increment introduces no migration or automatic backfill. To withdraw the report, remove its opt-in preview mount and navigation together. Keep the original year deletion refusal. Visual acceptance, explicit archival and a restored-copy rehearsal remain outstanding before production activation.
