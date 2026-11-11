# Daily review tools

6 November 2026. Open the feature menu on port 2030 to reach the practice modules.

In Attendance, choose a class/date register and expand **Attendance totals for this class**. Choose an inclusive date range of up to 366 days. The table shows register days, scheduled periods, attended periods, recorded missed periods and unrecorded periods. Totals use the latest correction for each pupil on each saved register. A pupil with no entry contributes unrecorded periods. The selected register fixes the school, class and academic year.

**View correction history** on a pupil card lists every saved count with its previous value, reason, editor membership and recorded time. Saving an entry clears old history and totals, which can then be reopened. Date changes clear the displayed totals. Failed access clears private information.

The library search matches title, author, accession, ISBN, shelf and borrower text within the signed-in school. Search input is bound as a SQL parameter and matched literally. The laboratory attendant sees the latest 50 stock movements, including quantity changes, request, editor and recorded time. Teacher request pages remain limited to their existing permitted records.

## Verification

All 148 isolated tests and the two focused SQL integration tests passed. The attendance fixture verified 14 scheduled periods across two registers, eight recorded missed periods and six unrecorded periods after a correction. Entering six attended periods in the other register produced six attended, eight missed and zero unrecorded. Tests cover invalid dates, caller school injection, foreign register access and revoked role access.

The inventory fixture checks filtered accession results, literal SQL-like search text, movement sums matching available stock, zero stock change for a damage event and school/role access. Existing concurrent checkout and issue tests passed.

The tracked practice listeners restarted on ports 2029 and 2030 under PIDs 38588 and 32864. The live HTTPS check verified the new controls, role pages and totals identity, plus reachability of the existing applications.

## Remaining work

Totals cover saved register dates. Full scheduled-calendar coverage requires calendar-backed register creation. Justification decisions and unjustified absence totals remain open. The practice data continues to be separate from the live school deployment.

The rollback uses the preceding source checkpoint and the ownership-checked `scripts/Restart-PracticeRuntime.ps1`. This increment uses the existing attendance and inventory tables.
