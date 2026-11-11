# Scoped course workspace activation

27 October 2026. **Active at https://localhost:2027/courses** for LYCEE BATOURI. This supersedes the disabled-feature descriptions in M1_COURSE_STAGING.md and older handoffs. Full M1 remains in progress; this does not start historical reconstruction or grading/report/promotion work.

Administrators can create subject offerings with explicit coefficients, enrol pupils already placed in the selected current year/class, and confirm teaching assignments for a specific year and term. Teachers see only their explicitly confirmed assignments and their scoped rosters/raw-score sheets. Pupils see their own subject memberships. Old assignments with unknown years remain unknown and confer no teaching access; no historical year or placement was inferred. Existing records and passwords were preserved. The original registration/editing forms remain available in their canonical personnel workspace.

Navigation now returns each authorised school role to the fixed `/courses` path after sign-in; disabled features and caller-supplied external return targets do not redirect. Original administrator, teacher and pupil dashboards link to the new workspace. Draft-preserving row saves, version updates, in-flight input locking, scope-change confirmation, departure warnings and denied-scope cache clearing are described in M1_COURSE_STAGING.md. Raw scores require explicit maxima and are not published grades or reports.

## Route review and exclusions

Reviewed every mount in app/app.js and the staff/student/academic routers, plus legacy writes to class_subjects, class_subject_students, class_subject_teachers, subject_scores and academic-year association tables.

| Original route family | Activated boundary |
|---|---|
| marks; class-subject-students | All requests409; canonical scoped replacement |
| teachers/my-subjects; teachers/my-students | All requests409; canonical year/term views |
| allocations | All writes409; original admin reads retained |
| teachers/:id/assign; student promotion/profile changes; admin personnel changes | Existing shared personnel write lock409 |
| classes/subjects/academic-years writers | Existing academic setup lock409 |
| academic-context; subjects/classes/years readers; timetable; exams; exam-results; allocations; report-cards | Valid teacher/pupil JWTs receive409 before legacy handlers; admin-only retained modules remain single-school legacy |
| staff/pupil own profile and sign-in; geography | Existing authentication/credential-version and personnel boundaries retained |
| auxiliary writes | Existing auxiliary lock409 |

Teacher/pupil legacy timetable, exam and result tools are deliberately paused with a workspace handoff because their old queries do not implement the new explicit assignment boundary. MCQ expansion remains deferred. Administrator legacy timetable/report/exam-result/publish operations are not certified multi-school; broad onboarding remains blocked by the M1 exit gates. This review does not claim complete tenancy for all retained modules.

## Verification and activation evidence

`npm.cmd test`: **92 passed**. `npm.cmd run test:sql`: **16 passed**, zero failures/skips/TODO. SQL tests use only the approved synthetic database; they exercise cross-school/year/term denial, stale versions, concurrent score writers, marked-link revocation protection and atomic rollback. New frontend tests cover fixed role-aware return paths, disabled-feature behaviour, external-target rejection and clearing navigation after authority loss.

Exact original-database readiness passed read-only: schema checksums/adoption, identity/personnel drift and academic/auxiliary/course ownership. No production fixture, invitation, role grant, password or schema migration was applied. No production academic record was created or edited for verification.

Set shared canonicalAcademicLinks=true only after these checks. Restarted verified owned original listener first (launchPID19352), then confirmed actual409 for old marks/enrolment/allocation endpoints and the handoff on all three original dashboards. Restarted verified owned canonical listener second (launchPID22200). The pinned-certificate HTTPS checker passed: real school/no sample bypass, protected course page redirect, protected scoped APIs403, mutation CSRF/auth denial, legacy409 locks and invalid-account login denial. Use process metadata to verify ownership; PIDs are historical launch evidence.

Actual browser visual/owner acceptance remains pending the existing human certificate handoff. No certificate bypass or further request was attempted. A teacher without confirmed year/term assignments may correctly see an empty list; an administrator must confirm the real assignment rather than backfilling a guessed year.

## Recovery and remaining work

If this increment fails, keep legacy course locks active and stop or repair the canonical feature under verified process ownership. Do not blindly set the shared flag false: that would also reopen the retired legacy routes. Any rollback must review writer ownership and keep one authorised writer. No migration rollback is needed because this activation uses existing migrations001–008.

M1 still needs native/multi-school staff profile and account-authority workflows, auxiliary permissions, remaining domain isolation and human acceptance. M2 must wait for mandatory M1 exit gates.
