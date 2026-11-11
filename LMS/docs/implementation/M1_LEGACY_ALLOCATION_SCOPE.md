# Original allocation read isolation

27 October 2026. Supersedes staging notes.

Three retained original administrator GET routes are scoped: /api/v1/allocations, /api/v1/allocations/class/:classId, /api/v1/allocations/form-data. Fresh legacy school/member/source/version/expiry authority is verified before every query and in each SQL statement. Explicit year and class must belong to the school. Current-year fallback is school-local. Allocations join same-school subjects/classes/years; dropdown master names and year enrolment counts include same-school parents. Original field names and ordering remain available. Caller school parameters cannot choose authority.

114 isolated and23 synthetic SQL tests pass, no failures/skips. Final4 allocation/inventory tests passed. Synthetic actual HTTP tests cover all3 paths, foreign year/class404, malformed IDs422, local current-year fallback/absence, empty results, own/other schools, dropdown shape, stale credentials, cache headers and original write409. Full SQL suite uses only guarded synthetic database fixtures and cleans them afterward. Initial sandbox network attempts failed; approved elevated reruns passed.

Original read-only M1 readiness passed. Verified original restart launchPID38680 activates legacyScopedAllocations=true. Canonical process unchanged. No migration, real allocation/academic/account/password mutation, sample seeding or policy change. Grading and historical year repair remain deferred. Keep this flag enabled during repair; false reopens old global reads. Original write locks remain enabled.

Inventory explicitly marks only these3 paths;15 retained admin/any-account reads still require review. Other-role boundaries and browser/owner acceptance also remain. M1 remains open, M2/new real-school onboarding gated.
