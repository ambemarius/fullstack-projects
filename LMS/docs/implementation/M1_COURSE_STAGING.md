# Course workspace staging review

27 October 2026. Staged only: `canonicalAcademicLinks=false`. Neither listener was restarted and no original school record, password, role, schema or academic history was modified by this review. This is an M1 access-boundary increment; historical reconstruction, grading, reports and promotion remain M2/M3.

The raw-score editor now saves only the chosen row and advances its optimistic version from the committed response. Other unsaved row inputs survive the save. Inputs are locked during requests, preventing a later keystroke from being mistaken for the committed value. Drafts trigger a departure warning and explicit discard confirmation before scope changes, refresh, membership actions or logout. Cancelling a term/offering change restores the previous selection. A denied or missing scope clears private workspace data; an expired/revoked teacher scope must not leave a cached score sheet visible.

Added three behavioral frontend tests for preserved drafts/repeated-save versions/in-flight locks, cancelled versus accepted scope changes, and private cache clearing on404. Added two HTTP tests for the staged legacy gate and opt-in canonical mounts: retired marks/enrolment/allocation writers are closed, teacher/pupil legacy academic reads are refused, unrelated modules remain reachable, and anonymous/missing-CSRF requests cannot reach SQL. The course page requires its academic/personnel prerequisites. These tests use fictional inputs and ephemeral HTTP servers, not production records.

Verification: `npm.cmd test` **90 passed**; `npm.cmd run test:sql` **16 passed**, no failures/skips/TODO. The first direct focused HTTP invocation was blocked by sandbox loopback EACCES; the approved elevated full suite passed. The synthetic suite exercised existing academic-link and marks services, including year/term permissions, school isolation, versioning and atomic rollback. It does not constitute visual acceptance of the new page or production activation. Git status remains unavailable because the configured repository parent path cannot be opened; preserve a verified secret-excluding source checkpoint instead of assuming a commit exists.

Before activation:

- Complete navigation/login return handling for `/courses` for administrator, teacher and pupil, including original interface handoffs.
- Review the full retained route matrix for alternate teacher/pupil roster/mark readers and allocation writers. The tested gate paths alone do not certify every legacy module.
- Review page races, stale reference inventories and scope changes against actual service response fields; keep exact current-year/term assignments and unknown historical years unchanged.
- Extend the pinned live checker for opt-in course mounts and legacy locks; pass exact real-school ownership/readiness without changing records.
- Enable the shared flag only after review, restart the verified owned legacy process first, confirm actual409 locks, then restart the verified canonical process and verify protected HTTPS endpoints. Never expose canonical course writes while old bypasses remain writable.
- Record deployment separately from pending human browser acceptance. Do not bypass the localhost certificate warning or repeat that request during heartbeats.

No new migration is needed for the staged feature. Keep migrations001–008 immutable. If review finds a schema requirement, stage and rehearse it separately before any rollout. Full M1 remains open for broader native/multi-school staff provisioning, auxiliary authority and remaining domain isolation.
