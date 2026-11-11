# Route and permission matrix

**28 October M1 implementation exit review:** final14 reference/academic/auxiliary/geography reads, report-card read and2 self-profile reads are scoped and ACTIVE. Source-derived ledger107 declarations/94 APIs now has40 retained authenticated handlers with explicit reviewed boundaries, zero unassessed; all94 old APIs remain excluded from canonical runtime.118 isolated +24 synthetic SQL tests pass, final focused reference/report/self SQL and6 boundary tests pass; original read-only readiness and pinned live denial/header/409 checks pass. Original launchPID56744; canonical52032 unchanged (verify metadata). No real account/password/academic/schema changes. Existing report computation/response block is byte-equivalent after newline normalization to prechange checkpoint (SHA2568b4dd764e0e8dde8706e65d2f8ffbc9d9a06afb2a2a198859ca9329e417175a9); optional missing subjects.passmark uses the already-established50 fallback. Desktop browser now reaches real signed-in registration: certificate handoff is RESOLVED, original Student/Teacher forms observed; responsive overflow fixed and tab pressed-state/menu accessibility improved. Later browser returned to sign-in; no credential entered. Keyboard/mobile/two-school visual and owner acceptance remain UNVERIFIED. Read docs/implementation/M1_EXIT_REVIEW_2026-10-28.md. M1 is READY FOR ACCEPTANCE, NOT formally closed; M2/additional real-school onboarding remain gated. Never repeat adoption/009/seeding or disable scope flags/write locks. Automated implementation follow-up should stop once this review is delivered; no autonomous acceptance.

**27 October timetable update:** JSON now marks3 exam+9 personnel+8 timetable handlers scoped.18 of38 retained admin/any-account declarations remain unassessed reads; no retained admin write is unassessed in this ledger. This does not certify unported model calls, other-role handlers or complete tenancy.112 isolated +22 SQL tests/live checks pass. See docs/implementation/M1_LEGACY_TIMETABLE_SCOPE.md, including generation prerequisites, unchanged first-fit behavior and deferred M3 policies.

**27 October personnel boundary update:** current JSON marks9 original personnel read handlers and3 exam handlers as scoped.26 of38 retained admin/any-account declarations remain unassessed, including3 timetable writes; shared model use does not inherit a route's scope.109 isolated +21 SQL tests pass, preserving legacy DTOs/forms and explicit native-admin readiness lineage. Read docs/implementation/M1_LEGACY_PERSONNEL_READ_SCOPE.md; full M1/other real-school onboarding remain gated.

**27 October exam boundary update:** GET exam-results/exam and admin publish/unpublish now use verified legacy school context and scoped/audited SQL. Current JSON annotates exactly these3 handlers.35 of38 retained admin/any-account declarations remain for downstream review, including3 timetable writes. Read docs/implementation/M1_LEGACY_EXAM_SCOPE.md; passing move gates still does not certify any unreviewed handler.108 isolated +20 SQL tests pass.

**27 October current evidence:** the tables below are the historical audit inventory. Current source-derived declarations/gate labels are in ROUTE_BOUNDARIES_2026-10-27.json (107 declarations/94 legacy APIs); scripts/auditRouteBoundaries.js regenerates them offline. All94 actual legacy method/path combinations return404 in the enabled canonical runtime, verified by tests/route-boundaries.test.js. This is exclusion coverage, not certification of the retained original handlers:38 admin/any-account routes, including five writes, still need downstream scope review. Read docs/implementation/M1_RETAINED_ROUTE_REVIEW.md and current activation records for canonical scoped features. Historical statements below that school scope is absent on every API do not describe the new canonical services.

Implementation update, 26 October: this is the original audit inventory. Admin registration now requires admin authentication and JWT role gates are strict. Added **R107: GET /api/v1/academic-context**, authenticated active admin/teacher/student via middlewares/isAccountLogin.js; returns only current-year and slot metadata, no personnel/roster data. Test: tests/known-gaps.test.js plus strict role tests. Tenant scope remains absent pending M1; do not enable a second school. See docs/implementation/C01_C03_STATUS.md. Original source anchors below refer to the audit snapshot.

Review: 25 October 2026. **Verified static declarations**, not runtime route tests. School scope is **absent on every current API**. Role labels show intended middleware only: G01 means current JWT identity is unsafe. Page routes are public shells; static /js and /css assets are public. Unmatched requests reach the 404 handler.

Each Rxxx names a proposed API/browser test; none has run. For every protected API: no session -> 401; wrong role -> 403; inactive/foreign membership -> deny; missing or foreign object -> non-disclosing 404 or documented 403 with no side effects. For mutation batches validate all parent IDs before writing. Exact response convention is proposed.

| Test | Method | Full path | Current gate | Current school scope | Object ownership / target rule | Handler or rendering | Evidence |
|---|---|---|---|---|---|---|---|
| R001 | GET | `/` | Public | N/A shell | Public shell; protect data APIs; role-appropriate navigation | `(req, res) => res.render('landing')` | routes/webRouter.js:5 |
| R002 | GET | `/login` | Public | N/A shell | Public shell; protect data APIs; role-appropriate navigation | `(req, res) => res.render('login')` | routes/webRouter.js:6 |
| R003 | GET | `/admin-dashboard` | Public | N/A shell | Public shell; protect data APIs; role-appropriate navigation | `(req, res) => res.render('admin-layout')` | routes/webRouter.js:7 |
| R004 | GET | `/teachers` | Public | N/A shell | Public shell; protect data APIs; role-appropriate navigation | `(req, res) => res.render('teachers')` | routes/webRouter.js:8 |
| R005 | GET | `/students` | Public | N/A shell | Public shell; protect data APIs; role-appropriate navigation | `(req, res) => res.render('students')` | routes/webRouter.js:9 |
| R006 | GET | `/subjects` | Public | N/A shell | Public shell; protect data APIs; role-appropriate navigation | `(req, res) => res.render('subjects')` | routes/webRouter.js:10 |
| R007 | GET | `/allocations` | Public | N/A shell | Public shell; protect data APIs; role-appropriate navigation | `(req, res) => res.render('allocations')` | routes/webRouter.js:11 |
| R008 | GET | `/teacher-dashboard` | Public | N/A shell | Public shell; protect data APIs; role-appropriate navigation | `(req, res) => res.render('teacher-dashboard')` | routes/webRouter.js:12 |
| R009 | GET | `/student-dashboard` | Public | N/A shell | Public shell; protect data APIs; role-appropriate navigation | `(req, res) => res.render('student-dashboard')` | routes/webRouter.js:13 |
| R010 | GET | `/timetable` | Public | N/A shell | Public shell; protect data APIs; role-appropriate navigation | `(req, res) => res.render('timetable')` | routes/webRouter.js:14 |
| R011 | GET | `/timetable-teacher` | Public | N/A shell | Public shell; protect data APIs; role-appropriate navigation | `(req, res) => res.render('timetable-teacher')` | routes/webRouter.js:15 |
| R012 | GET | `/timetable-student` | Public | N/A shell | Public shell; protect data APIs; role-appropriate navigation | `(req, res) => res.render('timetable-student')` | routes/webRouter.js:16 |
| R013 | GET | `/promotion` | Public | N/A shell | Public shell; protect data APIs; role-appropriate navigation | `(req, res) => res.render('promotion')` | routes/webRouter.js:17 |
| R014 | POST | `/api/v1/admin/register` | Public | None | Public today; target controlled platform/school invitation only | `registeradminCtrl` | routes/staff/adminRouter.js:21 |
| R015 | POST | `/api/v1/admin/login` | Public | None | Public login; school-aware identifier; rate limit; never trust requested role | `loginadminCtrl` | routes/staff/adminRouter.js:24 |
| R016 | GET | `/api/v1/admin` | Admin | None | Global admin today; target school admin records only, separate platform grants | `isLogin, alladminCtrl` | routes/staff/adminRouter.js:28 |
| R017 | GET | `/api/v1/admin/profile` | Admin | None | Current actor only; self-edit allowlist; membership active | `isLogin, getadminprofile` | routes/staff/adminRouter.js:31 |
| R018 | GET | `/api/v1/admin/stats` | Admin | None | Global admin today; target school admin records only, separate platform grants | `isLogin, getAdminStatsCtrl` | routes/staff/adminRouter.js:34 |
| R019 | GET | `/api/v1/admin/:id` | Admin | None | Global admin today; target school admin records only, separate platform grants | `isLogin, singleadminCtrl` | routes/staff/adminRouter.js:37 |
| R020 | PUT | `/api/v1/admin/:id` | Admin | None | Global admin today; target school admin records only, separate platform grants | `isLogin, updateadminCtrl` | routes/staff/adminRouter.js:40 |
| R021 | DELETE | `/api/v1/admin/:id` | Admin | None | Global admin today; target school admin records only, separate platform grants | `isLogin, deleteadminCtrl` | routes/staff/adminRouter.js:43 |
| R022 | PUT | `/api/v1/admin/set-status/teacher/:id` | Admin | None | Global admin today; target school admin records only, separate platform grants | `isLogin, setTeacherStatusCtrl` | routes/staff/adminRouter.js:46 |
| R023 | PUT | `/api/v1/admin/publish/exam/:id` | Admin | None | Admin exam ID today; require owned school exam; audit publication | `isLogin, publishexamCtrl` | routes/staff/adminRouter.js:49 |
| R024 | PUT | `/api/v1/admin/unpublish/exam/:id` | Admin | None | Admin exam ID today; require owned school exam; audit publication | `isLogin, unpublishexamCtrl` | routes/staff/adminRouter.js:52 |
| R025 | POST | `/api/v1/teachers/register` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, registerTeacherCtrl` | routes/staff/teacherRouter.js:21 |
| R026 | POST | `/api/v1/teachers/login` | Public | None | Public login; school-aware identifier; rate limit; never trust requested role | `loginTeacherCtrl` | routes/staff/teacherRouter.js:24 |
| R027 | GET | `/api/v1/teachers` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getAllTeachersCtrl` | routes/staff/teacherRouter.js:27 |
| R028 | GET | `/api/v1/teachers/profile` | Teacher | None | Current actor only; self-edit allowlist; membership active | `isTeacherLogin, getTeacherProfileCtrl` | routes/staff/teacherRouter.js:30 |
| R029 | PUT | `/api/v1/teachers/profile` | Teacher | None | Current actor only; self-edit allowlist; membership active | `isTeacherLogin, updateTeacherProfileCtrl` | routes/staff/teacherRouter.js:31 |
| R030 | GET | `/api/v1/teachers/my-subjects` | Teacher | None | Current teacher assignments; add verified school/year/term scope | `isTeacherLogin, getMySubjectsCtrl` | routes/staff/teacherRouter.js:32 |
| R031 | GET | `/api/v1/teachers/my-students` | Teacher | None | Assigned roster only; minimise fields; year/term membership | `isTeacherLogin, getMyStudentsCtrl` | routes/staff/teacherRouter.js:33 |
| R032 | POST | `/api/v1/teachers/:id/assign` | Admin | None | Same-school teacher membership and year/term offering | `isLogin, assignTeacherCtrl` | routes/staff/teacherRouter.js:36 |
| R033 | GET | `/api/v1/teachers/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, singleTeacherCtrl` | routes/staff/teacherRouter.js:39 |
| R034 | PUT | `/api/v1/teachers/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, adminUpdateTeacherCtrl` | routes/staff/teacherRouter.js:40 |
| R035 | DELETE | `/api/v1/teachers/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, deleteTeacherCtrl` | routes/staff/teacherRouter.js:41 |
| R036 | POST | `/api/v1/students/register` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, registerStudentCtrl` | routes/students/studentRouter.js:22 |
| R037 | POST | `/api/v1/students/login` | Public | None | Public login; school-aware identifier; rate limit; never trust requested role | `loginStudentCtrl` | routes/students/studentRouter.js:25 |
| R038 | GET | `/api/v1/students` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getAllStudentsCtrl` | routes/students/studentRouter.js:28 |
| R039 | GET | `/api/v1/students/profile` | Student | None | Current actor only; self-edit allowlist; membership active | `isStudentLogin, getStudentProfileCtrl` | routes/students/studentRouter.js:31 |
| R040 | PUT | `/api/v1/students/profile` | Student | None | Current actor only; self-edit allowlist; membership active | `isStudentLogin, updateStudentProfileCtrl` | routes/students/studentRouter.js:32 |
| R041 | GET | `/api/v1/students/by-class/:classId` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getStudentsByClassCtrl` | routes/students/studentRouter.js:35 |
| R042 | POST | `/api/v1/students/promote/:classId` | Admin | None | Same-school fixed source enrolments and target year; preview/audit/idempotency | `isLogin, promoteClassCtrl` | routes/students/studentRouter.js:36 |
| R043 | GET | `/api/v1/students/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, singleStudentCtrl` | routes/students/studentRouter.js:39 |
| R044 | PUT | `/api/v1/students/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, adminUpdateStudentCtrl` | routes/students/studentRouter.js:40 |
| R045 | DELETE | `/api/v1/students/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, deleteStudentCtrl` | routes/students/studentRouter.js:41 |
| R046 | POST | `/api/v1/subjects` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, createSubjectCtrl` | routes/academic/subjectRouter.js:11 |
| R047 | GET | `/api/v1/subjects` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getAllSubjectsCtrl` | routes/academic/subjectRouter.js:13 |
| R048 | GET | `/api/v1/subjects/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, singleSubjectCtrl` | routes/academic/subjectRouter.js:14 |
| R049 | PUT | `/api/v1/subjects/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, updateSubjectCtrl` | routes/academic/subjectRouter.js:15 |
| R050 | DELETE | `/api/v1/subjects/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, deleteSubjectCtrl` | routes/academic/subjectRouter.js:16 |
| R051 | GET | `/api/v1/classes` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getAllClassesCtrl` | routes/academic/classRouter.js:11 |
| R052 | GET | `/api/v1/classes/with-fees` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getClassesWithFeesCtrl` | routes/academic/classRouter.js:13 |
| R053 | GET | `/api/v1/classes/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, singleClassCtrl` | routes/academic/classRouter.js:14 |
| R054 | PUT | `/api/v1/classes/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, updateClassCtrl` | routes/academic/classRouter.js:15 |
| R055 | GET | `/api/v1/classes/:id/subjects` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, classSubjectsCtrl` | routes/academic/classRouter.js:16 |
| R056 | POST | `/api/v1/academic-years` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, createAcademicYearCtrl` | routes/academic/academicYearRouter.js:11 |
| R057 | GET | `/api/v1/academic-years` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getAllAcademicYearsCtrl` | routes/academic/academicYearRouter.js:13 |
| R058 | GET | `/api/v1/academic-years/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, singleAcademicYearCtrl` | routes/academic/academicYearRouter.js:14 |
| R059 | PUT | `/api/v1/academic-years/:id/current` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, setCurrentAcademicYearCtrl` | routes/academic/academicYearRouter.js:15 |
| R060 | DELETE | `/api/v1/academic-years/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, deleteAcademicYearCtrl` | routes/academic/academicYearRouter.js:16 |
| R061 | POST | `/api/v1/exams` | Teacher | None | Teacher identity only today; require assigned owner/co-teacher policy | `isTeacherLogin, createExamCtrl` | routes/academic/examRouter.js:18 |
| R062 | GET | `/api/v1/exams` | Teacher | None | Teacher identity only today; require assigned owner/co-teacher policy | `isTeacherLogin, getAllExamsCtrl` | routes/academic/examRouter.js:19 |
| R063 | GET | `/api/v1/exams/:id` | Teacher | None | Teacher identity only today; require assigned owner/co-teacher policy | `isTeacherLogin, singleExamCtrl` | routes/academic/examRouter.js:20 |
| R064 | PUT | `/api/v1/exams/:id/status` | Teacher | None | Teacher identity only today; require assigned owner/co-teacher policy | `isTeacherLogin, updateExamStatusCtrl` | routes/academic/examRouter.js:21 |
| R065 | POST | `/api/v1/exams/:examId/questions` | Teacher | None | Teacher identity only today; require assigned owner/co-teacher policy | `isTeacherLogin, addQuestionCtrl` | routes/academic/examRouter.js:22 |
| R066 | GET | `/api/v1/exams/:examId/questions` | Teacher | None | Teacher identity only today; require assigned owner/co-teacher policy | `isTeacherLogin, getExamQuestionsCtrl` | routes/academic/examRouter.js:23 |
| R067 | GET | `/api/v1/exams/:examId/take` | Student | None | Live gate only today; require school/class/year/subject eligibility | `isStudentLogin, studentExamQuestionsCtrl` | routes/academic/examRouter.js:26 |
| R068 | POST | `/api/v1/exams/:examId/write` | Student | None | Live gate only today; require school/class/year/subject eligibility | `isStudentLogin, takeExamCtrl` | routes/academic/examRouter.js:27 |
| R069 | GET | `/api/v1/exam-results/my-results` | Student | None | Current student only; published results; historical own enrolment | `isStudentLogin, getMyResultsCtrl` | routes/academic/examResultRouter.js:12 |
| R070 | GET | `/api/v1/exam-results/exam/:examId` | Admin | None | Admin exam ID today; require owned school exam; audit publication | `isLogin, getExamResultsCtrl` | routes/academic/examResultRouter.js:15 |
| R071 | GET | `/api/v1/timetables/form-data` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getFormDataCtrl` | routes/academic/timetableRouter.js:18 |
| R072 | POST | `/api/v1/timetables/generate/class/:classId` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, generateClassCtrl` | routes/academic/timetableRouter.js:20 |
| R073 | POST | `/api/v1/timetables` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, createEntryCtrl` | routes/academic/timetableRouter.js:21 |
| R074 | GET | `/api/v1/timetables/class/:classId/grid` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getClassGridCtrl` | routes/academic/timetableRouter.js:22 |
| R075 | GET | `/api/v1/timetables/class/:classId/periods` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getClassPeriodsCtrl` | routes/academic/timetableRouter.js:23 |
| R076 | GET | `/api/v1/timetables/class/:classId` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getClassTimetableCtrl` | routes/academic/timetableRouter.js:24 |
| R077 | GET | `/api/v1/timetables/teacher` | Teacher | None | Current teacher ID scoped today; verify year/school and safe slots | `isTeacherLogin, getTeacherTimetableCtrl` | routes/academic/timetableRouter.js:25 |
| R078 | GET | `/api/v1/timetables/student` | Student | None | Current student/class today; resolve own historical enrolment/year | `isStudentLogin, getStudentTimetableCtrl` | routes/academic/timetableRouter.js:26 |
| R079 | GET | `/api/v1/timetables` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getAllEntriesCtrl` | routes/academic/timetableRouter.js:27 |
| R080 | DELETE | `/api/v1/timetables/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, deleteEntryCtrl` | routes/academic/timetableRouter.js:28 |
| R081 | GET | `/api/v1/allocations/form-data` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getFormDataCtrl` | routes/academic/subjectAllocationRouter.js:11 |
| R082 | POST | `/api/v1/allocations` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, setAllocationCtrl` | routes/academic/subjectAllocationRouter.js:13 |
| R083 | GET | `/api/v1/allocations/class/:classId` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getClassAllocationsCtrl` | routes/academic/subjectAllocationRouter.js:14 |
| R084 | GET | `/api/v1/allocations` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getAllAllocationsCtrl` | routes/academic/subjectAllocationRouter.js:15 |
| R085 | DELETE | `/api/v1/allocations/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, deleteAllocationCtrl` | routes/academic/subjectAllocationRouter.js:16 |
| R086 | GET | `/api/v1/locations/regions` | Admin | None | Global read-only reference proposed; active membership permitted by need | `isLogin, getRegionsCtrl` | routes/academic/locationRouter.js:9 |
| R087 | GET | `/api/v1/locations/regions/:regionId/divisions` | Admin | None | Global read-only reference proposed; active membership permitted by need | `isLogin, getDivisionsCtrl` | routes/academic/locationRouter.js:11 |
| R088 | GET | `/api/v1/locations/divisions/:divisionId/subdivisions` | Admin | None | Global read-only reference proposed; active membership permitted by need | `isLogin, getSubdivisionsCtrl` | routes/academic/locationRouter.js:12 |
| R089 | GET | `/api/v1/marks/students/:classSubjectId/:term/:academicYearId` | Teacher | None | No assignment check today; require offering/year/term and enrolled roster | `isTeacherLogin, getStudentsWithScoresCtrl` | routes/academic/marksRouter.js:11 |
| R090 | POST | `/api/v1/marks/save/:classSubjectId/:term/:sequence/:academicYearId` | Teacher | None | No assignment check today; require offering/year/term and enrolled roster | `isTeacherLogin, saveScoresCtrl` | routes/academic/marksRouter.js:13 |
| R091 | POST | `/api/v1/marks/save-all/:classSubjectId/:term/:academicYearId` | Teacher | None | No assignment check today; require offering/year/term and enrolled roster | `isTeacherLogin, saveAllScoresCtrl` | routes/academic/marksRouter.js:14 |
| R092 | GET | `/api/v1/marks/admin/students/:classSubjectId/:term/:academicYearId` | Admin | None | Same-school approved offering/year/roster; validate all batch IDs | `isLogin, getStudentsWithScoresCtrl` | routes/academic/marksRouter.js:17 |
| R093 | POST | `/api/v1/marks/admin/save/:classSubjectId/:term/:sequence/:academicYearId` | Admin | None | Same-school approved offering/year/roster; validate all batch IDs | `isLogin, saveScoresCtrl` | routes/academic/marksRouter.js:18 |
| R094 | POST | `/api/v1/marks/admin/save-all/:classSubjectId/:term/:academicYearId` | Admin | None | Same-school approved offering/year/roster; validate all batch IDs | `isLogin, saveAllScoresCtrl` | routes/academic/marksRouter.js:19 |
| R095 | GET | `/api/v1/class-subject-students/:classSubjectId/:academicYearId` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getClassSubjectStudentsCtrl` | routes/academic/classSubjectStudentRouter.js:12 |
| R096 | POST | `/api/v1/class-subject-students/enroll` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, enrollStudentCtrl` | routes/academic/classSubjectStudentRouter.js:14 |
| R097 | POST | `/api/v1/class-subject-students/unenroll` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, unenrollStudentCtrl` | routes/academic/classSubjectStudentRouter.js:15 |
| R098 | POST | `/api/v1/class-subject-students/bulk-enroll` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, bulkEnrollCtrl` | routes/academic/classSubjectStudentRouter.js:16 |
| R099 | POST | `/api/v1/class-subject-students/bulk-unenroll` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, bulkUnenrollCtrl` | routes/academic/classSubjectStudentRouter.js:17 |
| R100 | GET | `/api/v1/report-cards/:classId/:term/:academicYearId` | Admin | None | Historical same-school cohort; approved report permission; minimise export | `isLogin, getReportCardCtrl` | routes/academic/reportCardRouter.js:5 |
| R101 | POST | `/api/v1/auxiliary/register` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, registerAuxiliaryCtrl` | routes/staff/auxiliaryRouter.js:13 |
| R102 | GET | `/api/v1/auxiliary` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, getAllAuxiliaryCtrl` | routes/staff/auxiliaryRouter.js:15 |
| R103 | GET | `/api/v1/auxiliary/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, singleAuxiliaryCtrl` | routes/staff/auxiliaryRouter.js:16 |
| R104 | PUT | `/api/v1/auxiliary/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, updateAuxiliaryCtrl` | routes/staff/auxiliaryRouter.js:17 |
| R105 | DELETE | `/api/v1/auxiliary/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, deleteAuxiliaryCtrl` | routes/staff/auxiliaryRouter.js:18 |
| R106 | PUT | `/api/v1/auxiliary/set-status/:id` | Admin | None | Admin global today; require active same-school membership and every parent/nested ID | `isLogin, setStatusAuxiliaryCtrl` | routes/staff/auxiliaryRouter.js:19 |

## Test fixture and row-specific expectations

Use two schools A/B, independent admins, teachers assigned/unassigned to A offerings, students enrolled/not enrolled in A and B, equal legacy role IDs and unequal student/offering IDs, two years and changed placements. For each Rxxx: authorised baseline succeeds according to the handler; wrong-role/foreign-tenant/object variants deny before data access or mutation. Assert payload and counts, not status alone. Public login returns no credential hashes; admin registration must change to invitation-only. Public pages render only shells; navigation cannot authorise API access.

Search/list/form-data/stats rows must exclude school B and sensitive fields, including dropdowns and COUNTs. ID rows test B root IDs and A root with B parent IDs. Profile/self rows ignore forged account/school/year scope and enforce allowed historical own records. Export/print are browser operations over authorised report/roster data and require client encoding tests. Publication rows enforce school exam and do not reveal unpublished results. Marks rows use unassigned teachers, wrong student/year, malformed/max-score cases and rollback injection. Timetable rows add concurrent resource conflicts and failure rollback. Delete rows preserve referenced history or return deliberate conflict.

## Proposed target roles (not currently implemented)

| Capability | Platform admin | School admin | Teacher | Student | Discipline master | Librarian | Lab attendant |
|---|---|---|---|---|---|---|---|
| School onboarding/status | Explicit audited control-plane only | Own settings by grant | No | No | No | No | No |
| Accounts/role grants | Explicit school-targeted workflow | Own school; no platform grants | Self profile | Self profile | Self profile | Self profile | Self profile |
| Academic setup/assignments | No default pupil access | Own school | Assigned read | Own timetable | Roster read by need | Borrower identity only | Assigned request context |
| Marks/reports | Exceptional audited support grant | Own school | Assigned entry/read | Own approved/published view | No default mark access | No | No |
| Attendance/justification | No default medical access | Delegated oversight | Only if granted | Own summary if approved | Enter/review/correct by grant | No | No |
| Library | No default loan access | Own oversight | Eligible borrower | Eligible borrower | Eligible borrower | Catalogue/copies/loans | Eligible borrower |
| Lab | No default inventory action | Own oversight/approvals | Request/availability | No default | No | No | Stock/issue/return/requisition |
| Sensitive evidence | Separate time-bound grant | Explicit privacy permission | No default | Own limited reference | Restricted review permission | No | No |

Roles combine through explicit membership grants; job titles do not imply permissions. Separate attendance entry and approval grants should prevent self-approval where required. Platform admins have no implicit blanket medical or student-data read. All future endpoints must be added to this matrix before feature completion.

## M1 identity HTTP factory — implemented but unmounted

These relative paths belong to `routes/identity/identityRouter.js`; no public mount prefix is configured. Every mutation requires the configured exact HTTPS Origin. Cookie authentication resolves current server-side account/membership/grant state. Existing bearer tokens cannot authenticate this factory.

| ID | Method / relative path | Authority and boundary | Verification |
|---|---|---|---|
| R108 | POST /login | Canonical password; explicit active school membership for schoolCode, or explicit grant for platform-only context; throttled | API cookie/actor contract; SQL wrong password/school and inactive-state cases |
| R109 | POST /accept-invitation | Unexpired one-use token; pending school; inviter still authorised; new account only; throttled | SQL concurrent acceptance/replay/expiry/revocation/collision rollback; API Origin middleware |
| R110 | GET /session | Valid cookie; own minimal account, membership, school and explicit roles/grants only | API server-derived context/no-store and duplicate-cookie rejection; SQL status checks |
| R111 | POST /switch-school | Valid session + CSRF; target membership belongs to same account; atomic rotation | API caller actor ignored; SQL wrong target/concurrent switch/old token denial |
| R112 | POST /logout | Valid session + CSRF; revoke only own cookie token | API cookie expiry; SQL immediate revocation |
| R113 | POST /school-invitations | Valid session + CSRF + fresh explicit platform grant in transaction; no pupil-data permission | API actor/audit fields ignored; SQL school-admin denial and atomic invite |

Actual HTTPS browser acceptance, deployed shared throttling and canonical route activation remain outstanding. No school data endpoint is activated through this factory.

R108 additionally supports schoolCode/accountType/identifier/password login: identifier is pupil matricule or mapped teacher/admin email, resolved only through verified same-school mappings. Server-side membership roles remain authoritative. Tested with real synthetic SQL/API; existing browser login is unchanged.

## M1 personnel factory — implemented but unmounted

Relative paths in `routes/identity/personnelRouter.js`; no production mount prefix exists. All requests require canonical school context. All mutations additionally require exact HTTPS Origin and valid CSRF. SQL transactions recheck active session/account/membership/school/admin role. No hard-delete endpoint is supplied.

| ID | Method / relative path | Authority / data boundary | Verification |
|---|---|---|---|
| R114 | GET /students | School admin; own-school rows/search/count; bounded pagination, safe DTO | Unit and real SQL/API; foreign/unresolved exclusion |
| R115 | GET /students/:id | School admin or verified pupil self mapping; foreign/peer denial | Real SQL/API positive self, peer/foreign denial |
| R116 | POST /students | School admin; server school/fixed pupil role; profile/account/membership/map/audit atomic | SQL/API registration, rejected forged fields and rollback |
| R117 | PATCH /students/:id | School admin; allowed fields, own school, current version | SQL concurrent/stale edits, foreign 404; real HTTP PATCH |
| R118 | POST /students/:id/status | School admin; current version, fixed reason; revoke own-school membership sessions | SQL withdrawal/return and global-disabled refusal; HTTP status |
| R119 | GET /teachers | School admin; own-school list/search/count; bounded safe DTO | SQL/API pagination and teacher-role denial |
| R120 | GET /teachers/:id | School admin or verified teacher self mapping | SQL positive self and cross-school denial |
| R121 | POST /teachers | School admin; fixed teacher role and server school; Government file metadata required | SQL native mapping, no platform grant and authority denial |
| R122 | PATCH /teachers/:id | School admin; own school/version/allowlist; preserve Government file rule | SQL foreign/stale/required-field checks |
| R123 | POST /teachers/:id/status | School admin; scoped verified membership only; no self-disable or global account recovery | SQL school-specific suspension/session preservation and recovery refusal |

Audit records contain coded reasons, versions and changed field names, without credential/profile values. Original global business keys and unscoped legacy routes still prevent complete multi-school activation. Administrator/auxiliary writes and complete academic/retained module boundaries remain outstanding; this matrix does not certify M1 complete.

Update: synthetic migration 006 now scopes assigned-row business keys while preserving unresolved uniqueness. Unscoped legacy routes and remaining workflows still block canonical activation.

## M1 academic setup factory — implemented but unmounted

Relative paths in `routes/identity/academicSetupRouter.js`; no public prefix configured. Every request requires verified canonical school context; every mutation additionally requires exact HTTPS Origin and CSRF. SQL independently checks current authority and exact school. No hard delete, grading, promotion or historical enrolment operation is exposed.

| ID | Method / relative path | Authority / boundary | Verification |
|---|---|---|---|
| R124 | GET /context | Admin/teacher/pupil; own current-year and slot metadata only | SQL/API role context, foreign slot exclusion, revocation |
| R125 | GET /academic-years | School admin; own years/versions only | SQL listing and teacher denial |
| R126 | POST /academic-years | School admin; session-derived canonical creator; scoped optional current-year transaction | SQL canonical actor, same-name keys, audit rollback |
| R127 | PATCH /academic-years/:id | School admin; own row/current version; validated merged years; no actor/current injection | SQL year edit/range validation; unit unknown-field denial |
| R128 | POST /academic-years/:id/current | School admin; own target/current version; clear only own prior current year | SQL independent schools/concurrent conflict/foreign refusal/rollback; HTTP 404 |
| R129 | GET /classes | School admin; exact school; NULL rows excluded | SQL own list/foreign exclusion |
| R130 | POST /classes | School admin; server ownership; same-school active master if supplied | SQL scoped keys and foreign/inactive parent denial |
| R131 | PATCH /classes/:id | School admin; own row/version; same-school changed parents | SQL parent refusal without version mutation |
| R132 | GET /subjects | School admin; exact school; no foreign/NULL rows | SQL listing and scoped business keys |
| R133 | POST /subjects | School admin; same-school class/active master; no new grading policy | SQL create/duplicate/parent checks, real HTTP create/CSRF |
| R134 | PATCH /subjects/:id | School admin; own row/version; same-school parents and legacy numeric constraints | SQL concurrent conflict and real HTTP PATCH |

Actual HTTPS/browser activation and existing offerings/enrolment/assignment/retained domain scopes remain outstanding. These tests do not close M1.

## M1 academic links factory — implemented but unmounted

Relative paths in `routes/identity/academicLinksRouter.js`. Every request requires verified canonical school context; mutations also require exact HTTPS Origin and CSRF. Every SQL statement checks current session authority, and mutations are transactional. The paths do not replace legacy routes until cutover.

| ID | Method / relative path | Authority / boundary | Verification |
|---|---|---|---|
| R135 | GET /offerings | School admin; own roots only | SQL own list and revocation |
| R136 | POST /offerings | School admin; same-school class/subject, bounded decimal coefficient | Unit validation; SQL parent/duplicate checks |
| R137 | POST /enrolments | School admin; own current year/offering/pupils, explicit placement, versions; atomic batch/soft revoke | SQL late foreign-pupil rollback, concurrent conflict, marked-link refusal |
| R138 | POST /assignments | School admin; current explicit year/term and active own teacher; versioned soft revoke | SQL parent/role/year cases; real HTTP assign/CSRF |
| R139 | GET /offerings/:id/roster | Own-school admin or exact mapped active teacher assignment/year/term; basic pupil DTO | SQL NULL-year/foreign/term/year/pupil denial, co-teachers and revocation; HTTP roster |
| R140 | GET /offerings/:id/enrolments | School admin; own root/year and link statuses/versions | SQL safe inventory/soft history retention |
| R141 | GET /offerings/:id/assignments | School admin; own root/year/explicit term; confirmed year links only | SQL revocation inventory; unresolved legacy years excluded |
| R142 | GET /my-enrolments | Pupil self mapping from session; exact year, no caller pupil ID | SQL own/foreign-year and HTTP self view |
| R143 | GET /my-assignments | Teacher self mapping; exact year/term/active status, no caller teacher ID | SQL positive/NULL-year/term/year/revocation cases |

Existing teacher links with NULL year do not grant canonical access. These roster permissions do not automatically secure old marks/exam/report controllers; remaining domains and actual browser/HTTPS acceptance still block M1 completion.

## Isolated preview activation, 26 October

R108–R143 factories are mounted only at https://localhost:2027 under /api/identity, /api/personnel, /api/setup and /api/links. They are not enabled in the existing 2026 application. The preview has no /api/v1 routes and is guarded to the synthetic DB at startup. Browser certificate handoff/visual acceptance remains pending; API/TLS tests pass.

| ID | Preview method/path | Boundary | Verification |
|---|---|---|---|
| R144 | GET /api/identity/memberships | Valid session; only own active memberships/schools/roles | SQL own membership discovery and revoked denial |
| R145 | POST /api/identity/csrf | Valid session + exact Origin; refresh CSRF after reload without extending session expiry | SQL token rotation/revoked refusal; actual HTTPS check |
| R146 | GET /preview/catalog | Fictional school/role/identifier metadata only; no password/key/token | Isolated shell/catalog credential-exclusion test |
| R147 | POST /preview/sign-in | Loopback synthetic preview only; exact Origin/throttle; fixed sample accounts through real credential login | Wrong-Origin test; actual HTTPS secure-cookie/school switch/logout check |
| R148 | GET / | Public isolated role-aware workspace shell; no school data until scoped session | SSR/CSP/client-parse tests; actual visual acceptance pending certificate handoff |

No production sample-access endpoint is enabled. See ../implementation/M1_BROWSER_PREVIEW.md for seed/startup guards and browser handoff evidence.
