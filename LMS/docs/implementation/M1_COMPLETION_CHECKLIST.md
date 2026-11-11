# M1 completion checklist

Current review: 29 October 2026. **M1 ACCEPTED AND CLOSED.** Owner replied “Yes i authorize M2” to the final M1 acceptance/start-M2 question. Technical and browser verification evidence remains in M1_BROWSER_ACCEPTANCE_2026-10-29.md and M1_EXIT_REVIEW_2026-10-28.md; their pending acceptance statements are superseded.

| Gate | Current evidence | Status |
| --- | --- | --- |
| Approved school adoption and source preservation | LYCEE BATOURI, MARIUS\DEV/schooldb; original rehearsal/adoption already completed; migrations001–009 immutable | Delivered; do not repeat |
| Accounts, sessions and school authority | Canonical sessions/CSRF, verified source status and credential versions, distinct platform authority | Automated tests pass |
| Administrator/teacher/pupil/auxiliary workflows | Preserved registration forms, exact-account invitations/private recovery, native staff links and local status lifecycle | Delivered; accepted29 October |
| Synthetic multi-school isolation | Staff switching, assignments, enrolments, marks, retained parent/read/write boundaries | SQL/HTTP tests pass |
| Retained legacy API review |107 declarations,94 APIs;40 retained authenticated routes explicitly scoped, zero unassessed; others excluded/moved with tested locks | Automated checks pass |
| Canonical legacy exclusions | All94 declared old API method/path combinations404 | Automated checks pass |
| Runtime activation | Verified original56744; canonical52032 unchanged; fresh readiness/pinned HTTPS/401/409/header checks | Pass |
| Preserved interface | Original form partial bytes retained; both forms verified at320/390/768/1280; no submissions | Pass |
| Browser technical verification | Full18/19-control pupil/teacher keyboard traversal, menu/tab behavior, synthetic two-school visual switching and teacher denial | Pass; actual browser evidence recorded |
| Formal M1 acceptance | Explicit owner acceptance and authorization to start M2 on29 October | Pass |

Latest full isolated validation:122 tests pass, zero failures/skips/TODO. Previous24 synthetic SQL tests remain the database baseline; no SQL/service/schema change in the browser increment. Actual synthetic browser and final real pinned HTTPS checks pass; temporary2028 preview is stopped and its tab closed. Sandbox loopback/network failures were rerun with approval and passed. No production migration, real record/password reset, role grant, invitation or test seed was performed in this increment.

Original interface: http://localhost:2026/login. Canonical interface: https://localhost:2027/; school code LYCEE_BATOURI. Registration: https://localhost:2027/registration. Native standalone accounts use canonical sign-in; legacy-only tools remain on the original interface.

Keep every active scope flag and shared legacy writer lock enabled during repairs. If a scoped handler fails, repair it or use a reviewed temporary denial. Do not reopen its old global fallback, restore over schooldb, infer historical placements, change grading/promotion policy, start M2 or onboard another real school before all M1 acceptance gates close.
