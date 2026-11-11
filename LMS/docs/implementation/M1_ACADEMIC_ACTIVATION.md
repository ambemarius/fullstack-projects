# Real-school academic setup activation

26 October 2026. **Active at https://localhost:2027/academic** against adopted MARIUS\DEV/schooldb. Owner asked to move to other features rather than wait on browser acceptance. This increment required no new migration, password change or agent-created production academic record.

## Delivered

Administrators can create/edit classes, subjects and academic years, and explicitly select the current year. The workspace uses the original blue/slate admin layout and stylesheet. Class fields include section, name, stream, explicit level order and class master. Subject fields include code/name, coefficient, weekly hours, category, subject master, class reference, description and laboratory flag. Optional references can be cleared explicitly. Year edits and current-year selection are separate operations; there is no deletion, promotion, inferred enrolment or historical rewrite.

The existing tested academicSetupService/router performs all mutations: school-scoped queries, same-school parent validation, active teacher checks, serializable transactions and per-school locks, optimistic versions and audit metadata. No alternative client-side authority or duplicated write SQL was introduced. The page loads parent options through canonical scoped endpoints and inserts text with DOM textContent. It clears sensitive cached state on access denial/sign-out. Admin permissions, cookie sessions, exact Origin and CSRF remain required.

Files: views/canonical-academic.ejs, public/js/canonical-academic.js and the extended scripts/canonicalSchool.js. The root workspace links administrators to academic setup. A login redirect retains an allowlisted academic tab. The original dashboard's subject/class/year entries hand off through the updated legacy-personnel-handoff.js; auxiliary entries remain in the original application. Student/teacher forms are unchanged.

## Deployment and boundary

config/runtimePolicy.json now enables both canonicalPersonnelWrites and canonicalAcademicWrites. Original server.js reads both and installs legacyAcademicGate for non-read requests under /api/v1/classes, /subjects and /academic-years. Those return409 with the new workspace URL. Reads remain available to existing legacy screens; other unported modules remain single-school legacy modules, not certified tenant-safe. Canonical academic setup exposes only its scoped router; old APIs and sample bypasses remain absent.

Readiness verified all class/subject/year rows are owned by LYCEE BATOURI and the personnel drift checks remain zero. Restarted the tracked original listener first, verified all old academic writer mounts return409, repeated real readiness, then restarted canonical. Current launch PIDs: original42428, canonical33144; verify ignored runtime metadata before acting. scripts/Restart-LmsRuntime.ps1 validates the exact workspace, tracked PID, executable, command and port before restarting hidden Node processes. It does not kill an arbitrary port owner. Keep both runtime policy flags on future restarts; reversing a write handoff requires coordinated application policy and drift review, not a database restore.

## Verification

**71 isolated tests and 13 synthetic SQL tests passed**, zero failures/skips/TODO. New HTTP tests cover old academic writer exclusion/retained reads, protected page redirect, non-admin rejection, CSRF requirements, school-ID injection refusal and disabled unauthorized academic access. Existing real SQL tests cover per-school business/current-year uniqueness, same-school parents, canonical actors, transaction rollback, concurrency/version checks and current-year audit. No production fixtures were inserted by these tests.

Actual real readiness passed before and after locking old writers. Actual pinned-certificate HTTPS checker passed after canonical restart, including protected academic redirect, anonymous academic-write rejection, existing personnel boundaries, no sample/legacy bypass and invalid-login denial. No real password was used. Browser visual/owner acceptance is still pending; the owner explicitly requested continuing other work, so do not repeatedly ask for the certificate handoff or count it as passed.

Full M1 is not complete. Remaining work includes administrator/auxiliary account workflows, explicit existing-account invitations/multi-school staff handling, and remaining domain boundaries. M2 remains queued until all mandatory M1 gates pass.
