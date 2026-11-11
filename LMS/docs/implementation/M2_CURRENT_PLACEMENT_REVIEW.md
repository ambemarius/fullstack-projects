# Current placement review and M2 cutover inventory

5 November 2026. School administrators can open **Student → Review current pupil placements** in canonical registration. The list includes active pupils who lack a matching school class, lack a year or point to another year. The class and year columns are current profile fields. **Academic records** opens the existing evidence for that pupil. Confirm dates and assignments from a school source before recording them.

## Live inventory

The read-only inventory on the adopted LYCEE BATOURI database verified all nine installed migration checksums and found the staged M2 tables absent. At the time of review there was one current academic year. All 79 active pupils had a class identifier and all 79 lacked an academic-year identifier. There were zero pupil/year junction rows, nine pupil/subject links and 19 raw mark rows. Of 177 teaching assignments, all 177 lacked a year. The catalogue held 237 offerings.

Admin access to historical evidence is now available. Enabling dated write requirements with an empty ledger would block some normal work for existing pupils. The next implementation step is a source-backed first placement for an existing pupil, with a reviewed current year, class, date, version and register reference. Existing pupil accounts must be reused. Separately review legacy subject access and teaching assignments before enabling the corresponding writers. Counts alone cannot assign a class period, teaching year or coefficient.

## Verification and operations

The list checks current administrator authority and school scope in SQL, requires the selected year still to be current and uses 50-row cursor pages. A school switch, closing the list or an access failure clears private results. The endpoint accepts GET and HEAD. The inventory script is read-only and returns only schema metadata and aggregate counts.

144 isolated tests passed. The affected SQL integration test passed through the canonical HTTP application with separate synthetic schools and a rolled-back fixture. Checks included revoked and teacher access, foreign identifiers, invalid paging, fully assigned and withdrawn pupil exclusion, and a 51-pupil list. The full schema-installing SQL suite was deferred while the owner’s sample preview was running. The previous full run passed 32 tests. Post-restart HTTPS checks passed on the school and sample ports. The restored-copy rehearsal remains waived. Staged migrations 010–013 were not applied.
