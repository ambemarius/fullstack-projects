# Retained route boundaries — current audit

27 October 2026. Staff-account implementation remains active. This increment adds source-derived route evidence and regression coverage; **no application runtime, policy, database or listener was changed**.

scripts/auditRouteBoundaries.js enumerates the actual router declarations behind app/app.js ROUTES. The current offline manifest is docs/architecture/ROUTE_BOUNDARIES_2026-10-27.json: **107 declarations,94 legacy API routes**, with source module, method/path, recognized authentication middleware and existing shared-gate interception for anonymous/admin/teacher/pupil callers. There are no unclassified authentication declarations in this inventory. Offline tokens use an ephemeral test signing configuration; no real credential, session, database connection or pupil record is used.

The classifier runs only the current move/write gates. downstream_auth_required means a request still reaches its original auth/data handler; it does **not** mean the request is authorized or tenant-safe. Public web shells are labelled separately. The retained historical audit matrix is linked to this current evidence rather than silently treating its25 October statements as current canonical behavior.

tests/route-boundaries.test.js submits every declared legacy API method/path to a fully enabled canonical app using isolated HTTP and no database access. All94 return404, including original login and write paths. Existing canonical identity, personnel, academic setup, courses/marks, auxiliary and staff-account routes remain their separate scoped implementations. The second regression checks that retained administrator report routes are reported unresolved while teacher/pupil gate interception and moved marks are correctly classified.

Verification: **107 isolated tests passed**, plus a focused two-test rerun after adding source authentication labels. The last complete SQL baseline remains19 passed from staff activation; this inventory-only increment made no SQL/service/schema changes and did not rerun that unchanged suite. No runtime activation or browser acceptance is claimed. Canonical52032/original19352 remain historical launch evidence; verify process metadata before acting.

## Remaining original-runtime boundary work

There are **38** API declarations with admin/any-account middleware still reaching their downstream handlers for an admin-shaped token. This includes original personnel inventories, admin stats/profile, academic/reference inventories, retained reports and timetables. The manifest does not certify object ownership in any of those handlers. Actual authentication/version/source checks still apply afterward; new native administrators do not acquire legacy credentials automatically.

Five retained administrator writes are especially important before another real school:

- PUT /api/v1/admin/publish/exam/:id
- PUT /api/v1/admin/unpublish/exam/:id
- POST /api/v1/timetables
- DELETE /api/v1/timetables/:id
- POST /api/v1/timetables/generate/class/:classId

Teacher/pupil legacy academic/timetable/exam/result paths are already intercepted, moved personnel/academic/auxiliary writers remain locked, and legacy marks/enrolment/allocation writers are excluded. These existing controls must stay active. The current real database/runtimes remain restricted to the owner-approved single LYCEE BATOURI school. No additional real onboarding is authorized merely by the94 canonical exclusions.

Next work should establish a freshly verified server-derived legacy school/membership context and scope retained queries/parent IDs inside each data statement, starting with personnel/admin reads and the five retained writes. Reuse current business behavior, preserve original forms and records, and test two-school denial plus transaction rollback/concurrency before activation. A separate pre-query ownership scan alone is insufficient: a concurrent foreign insert could race an unscoped downstream query. Do not call that tenant isolation.

Reports/timetable authorization boundaries belong to M1; historical reconstruction, grading-policy fixes, report calculation/publishing redesign and timetable algorithm repair remain their later approved phases. Do not invent historical years or change those policies to make M1 tests pass. Do not silently remove working original admin tools to manufacture an exit-gate pass; prepare reviewed scoped replacements or explicit tested handoffs first.

The continuation automation was updated, preserving its existing schedule/status/thread, to focus on these remaining boundaries instead of repeating completed staff migration/account work. Human certificate acceptance stays pending without bypass or repeated requests. M1 remains open; M2 remains queued.
