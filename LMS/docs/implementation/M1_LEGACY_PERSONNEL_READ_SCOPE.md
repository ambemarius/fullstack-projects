# Original personnel-read scope

27 October 2026. **Activated on the original listener**, preserving the original forms and response fields. No schema, account, password, placement, medical or finance data was changed by this increment. It scopes existing reads rather than adding personnel/finance workflows.

## Nine routes

GET /api/v1/admin; /admin/profile; /admin/:id; /admin/stats; /teachers; /teachers/:id; /students; /students/:id; /students/by-class/:classId (all paths after the first share the /api/v1 prefix).

legacyPersonnelReads uses the verified legacy JWT/source/membership context introduced for exams. Every data statement binds its server-derived school/account/member/version/expiry and rechecks administrator authority in SQL. Caller school parameters cannot select scope. Foreign personnel and class IDs404. The teacher/pupil field projections remain the existing safe model projections, without credentials; administrator reads explicitly select safe fields. Parent class/year joins and fee/student joins also match school_id. Statistics use own-school counts, including withdrawn records as before; the class roster retains its existing withdrawn-pupil filter.

Controllers retain existing response shapes, including pupil class/year names, fee rows, results counts and admin profile message. Admin statistics now use a scoped aggregate rather than loading global personnel records into application memory. JSON responses carry no-store headers. No old writer lock is relaxed. These legacy APIs remain excluded from the canonical runtime. Other controllers still calling original model methods are not automatically scoped by this routed adapter.

## Native administrator restart-readiness correction

Review also found that the original startup drift checker would count a newly created standalone administrator as an unmapped legacy profile, or compare its intentionally unrelated source sentinel with its canonical password. That could block a later restart after legitimate staff-account use.

The read-only checker now distinguishes explicit native-admin creation provenance from adopted profiles. Pending unlinked native profiles are valid. Active native links require native account lineage, correct membership/role and no legacy map; deliberately revoked native links/memberships are valid as a pair. Incorrect native keys, inconsistent links or an attempt to classify a legacy-mapped profile as native still fail review. Adopted credentials retain strict binary equality; no password is copied, repaired or reset. Production defaults still enforce exclusive LYCEE_BATOURI ownership. Explicit scoped options are used only by synthetic multi-school tests; they do not change real onboarding policy.

Native lifecycle SQL tests verify pending, activated and disabled states pass readiness and a corrupted native login key fails. The first aggregate implementation hit SQL Server's correlated-aggregate restriction in the synthetic test; binding the expected school to a SQL variable corrected it before any real readiness check/activation. The complete suite passed afterward.

## Verification and activation

**109 isolated +21 synthetic SQL tests passed**, zero failures/skips/TODO. Final six focused validation/drift/inventory tests also passed with active policy. Positive actual-HTTP tests exercise every one of the nine routes, both schools' source actors, school-query spoofing, foreign record/class404, private medical/fee isolation, original DTO fields, no credential output, no-store headers, wrong-role/anonymous denial, stale versions and revoked memberships. Native staff lifecycle and original exam scope remain covered by the full SQL suite.

Original readiness was read-only: canonical/source/native alignment passed and Admins, teachers, students, fees, classes, subjects and years retained exclusive approved ownership. No real personnel records were fetched for test output or used as fixtures. No migration, adoption, restore, seed, password reset or privilege change occurred.

Set legacyScopedPersonnelReads=true after verification. Restarted only the verified owned original process, launchPID28048; canonical52032 unchanged. The immediate live probe raced startup; its subsequent run passed. Actual X-LMS-Scoped-Personnel-Reads:1 and anonymous stats/teacher/pupil401 confirm the new boundary loaded. Existing exam marker/denials, old409 write locks and pinned canonical staff/course HTTPS checks pass. Verify tracked metadata before process actions; PIDs are launch evidence. Browser/owner acceptance remains pending without bypass or repeated requests.

## Remaining work and rollback

The source manifest marks9 personnel and3 exam handlers scoped. Of38 retained admin/any-account declarations,26 remain for downstream review, including the3 timetable writes. Model methods called by unported timetable/report/reference controllers remain unreviewed even where a scoped route uses the same projection. No additional real school or M2 is enabled.

Keep the scope flag true during repairs: false selects the old unscoped fallback. Use a reviewed temporary denial if necessary rather than reopening global reads. Do not restore databases, remap native profiles into legacy maps or overwrite credentials to satisfy readiness. Continue remaining M1 boundaries without grading/history/promotion-policy changes.
