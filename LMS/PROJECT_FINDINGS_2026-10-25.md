# LMS: complete project findings and continuation report

Review date: 25 October 2026 (Africa/Lagos).  
Workspace: `C:\Users\amben\Desktop\FS_PROJECTS\LMS`.  
Purpose: explain the application, inventory existing work, identify material defects, and give another agent a concrete starting point.

## 1. Executive assessment

This is a substantial secondary-school administration application for a Cameroon school context. It manages student and staff registration, bilingual academic structures, academic years, subject offerings, teacher assignments, timetables, sequence marks, report cards, and class promotion. It also includes a separate online multiple-choice examination API.

The current product is a Node.js/Express application with Microsoft SQL Server, server-rendered EJS pages, CSS, and plain browser JavaScript. It is considerably more developed than the API-oriented README suggests. No React/Vite application is present in the reviewed file inventory.

There is useful implemented functionality, but source-level authentication defects, a broken clean-schema dependency order, authorization gaps, and inconsistent academic history prevent considering it deployment-ready. Syntax checks passed; database integration and browser operation have not been established by this review.

“Implemented” in this report means corresponding application code exists. It does not mean a workflow has passed an end-to-end test or is used in production. File contents cannot establish who implemented features, the chronological development history, or whether changes were previously deployed.

## 2. Review method and evidence limits

Reviewed the first-party file inventory, package scripts, server/application configuration, route definitions, controller/model functions, key workflow implementations, UI scripts/templates, setup and maintenance scripts, README, and the earlier `PROJECT_REVIEW.md` dated 30 September 2026. Findings below use current source inspection; the older report provided context and was checked against important current implementations.

Verification performed without executing the application:

- Parsed all **78 first-party JavaScript files** using Node `vm.Script`: no syntax failures.
- Compiled all **15 EJS templates** using the installed EJS package: no compilation failures.
- Verification runtime: **Node v25.1.0**. This does not establish compatibility with every older Node version.
- Counted **23 distinct SQL table definitions** in model source. This is not a live database inventory.
- Confirmed installed dependencies are present in `node_modules` and `config/.env` exists. Its values are private and are not reproduced here.

No database connection, schema setup, seed, password reset, server startup, destructive maintenance script, or browser workflow was run. No automated test command is defined in `package.json`. Template compilation does not validate HTML layout, browser behavior, included-template rendering, SQL, or API responses.

Git status and repository discovery both failed with `fatal: cannot change to 'C:/Users/amben/Desktop/FS_PROJECTS'`. No local `.git` entry was observed in the project listing. Repository root, branch, commit, remote, and change history are therefore unverified; the failure is not evidence that all project files are untracked or unchanged.

## 3. Product scope and school model

The name LMS describes a school-management system more closely than a learning-content platform. No implemented lesson library, video-course delivery, homework submission, or course-content authoring workflow was found.

Cameroon-specific evidence includes the location hierarchy in `model/Academic/location.js`, parent telephone handling in `model/Academic/student.js`, and Anglophone/Francophone class structures in `model/Academic/class.js`.

The default catalog has 21 classes:

- Anglophone: Form1–Form5, LowerSixth, UpperSixth, each with Normal and Bilingual streams: 14 classes.
- Francophone: 6ème, 5ème, 4ème, 3ème, 2nde, 1ère, Terminale: 7 classes, with a null stream.

Each section has ranks 1–7. Terms use `First`, `Second`, and `Third`. Sequence marks use sequence 1 and sequence 2 within each term.

## 4. Roles and feature inventory

| Area | Work present in source | Important boundary |
|---|---|---|
| Admin accounts | Login, registration, profile, list/update/delete, dashboard statistics | Registration is public; authentication needs repair |
| Students | Admin registration and CRUD, matricule login, profile, guardians/origin/medical fields, withdrawal, fees | List endpoint exposes password hashes; historical placement is weak |
| Teachers | Admin registration and CRUD, email login, profile, employment details, status management | Teaching assignment authorization is incomplete |
| Auxiliary personnel | Admin registration, CRUD, status | No dedicated auxiliary login/dashboard found |
| Classes | Seed catalog, list/detail, class masters, fee settings, options | Not a general-purpose configurable class-creation workflow |
| Academic years | Create/list/detail, current-year selection, deletion logic, enrollment junctions | Junction membership can disagree with student records |
| Subjects | Catalog create/list/detail/update/delete, coefficients/categories/master and class references | Creating a subject does not automatically offer it to all classes |
| Teacher assignments | Class-subject-term assignments, co-teaching representation | Assignment rows lack academic-year context |
| Student subject enrollment | Individual/bulk enrollment and removal by offering | Removal does not scope deletion to a year |
| Allocations | Class/year subject periods per week; creates offering if necessary | Multiple writes are not atomic |
| Timetables | Manual entries, generated class schedules, class/teacher/student views | Greedy generator; manual collision validation is incomplete |
| Sequence marks | Teacher/admin entry for two sequences per term | Reversed enrollment arguments; insufficient scope/input checks |
| Reports | Weighted averages, positions, class and subject statistics; UI CSV/print | Current placement drives historical report population |
| Online exams | Teacher exam/question APIs, Live status, student answers, automatic grading | Ownership and student eligibility checks missing |
| Exam results | One result per student/exam, admin publish/unpublish, published student results | Separate from sequence marks; browser workflows incomplete |
| Promotion | Bulk move active students to next class rank | No marks threshold; rank-7 graduation is only a flag |
| Finance | Class fee settings and student fee amounts/paid flags | Finance tab explicitly says features are coming soon |

No payment gateway, accounting ledger, receipt workflow, installment management, or year-specific fee history was found. No complete online-exam/question-management or exam-taking workflow was found in the reviewed dashboard scripts. Student dashboard behavior is principally profile display, with a separate timetable page.

## 5. Technology and request flow

| Layer | Implementation |
|---|---|
| Runtime/module format | Node.js, CommonJS |
| Server | Node HTTP server and Express 5 |
| Persistence | Microsoft SQL Server via `mssql`, handwritten parameterized SQL |
| UI | EJS templates, shared CSS, browser JavaScript and Fetch |
| Authentication | JWT bearer tokens via `jsonwebtoken` |
| Passwords | bcrypt hashing; both bcrypt and bcryptjs are dependencies |
| Environment/logging | dotenv and morgan |
| Development | nodemon |

```text
Browser -> Express web router -> EJS -> public CSS/JavaScript
Browser Fetch -> /api/v1 router -> role middleware -> controller -> SQL model
                                                               -> SQL Server
```

`server.js` imports the application, waits for the shared database connection, ensures the admin table exists, and starts listening. `config/database.js` loads `config/.env` and starts connecting immediately when imported. Importing controllers/models can consequently initiate database work. Use static parsing for inspection; runtime tests will need controlled configuration or dependency isolation.

`app/app.js` configures EJS, logging, static files, request parsers, web/API mounts, and JSON error handling. Browser JWTs and role metadata are stored in localStorage. Web routes render page shells without server-side identity checks; APIs enforce access through middleware. Client redirects do not replace API authorization.

## 6. File map for another agent

| Location | Responsibility |
|---|---|
| `server.js` | Startup, DB wait, admin table creation, port errors |
| `app/app.js` | Express configuration and route mounting |
| `config/database.js` | Shared SQL pool and environment loading |
| `routes/webRouter.js` | Page URLs and EJS template selection |
| `routes/staff`, `controllers/staff` | Admin, teacher, auxiliary APIs |
| `routes/students`, `controllers/students` | Student account/record APIs |
| `routes/academic`, `controllers/academic` | Academic, timetable, mark, reporting, exam workflows |
| `model/Academic` | Academic SQL schemas, migrations, data access; includes student model |
| `model/staff` | Admin, teacher, auxiliary persistence |
| `middlewares` | Three identity middlewares and error responses |
| `utils` | JWT sign/verify |
| `views/admin-layout.ejs`, `public/js/admin-layout.js` | Main integrated admin interface |
| `views/teacher-dashboard.ejs`, `public/js/teacher-dashboard.js` | Teacher profile, assignments, students, marks |
| `views/student-dashboard.ejs`, `public/js/student-dashboard.js` | Student profile dashboard |
| `public/js/app.js`, `auth.js`, `nav.js` | Shared API helper, login, browser session/navigation |
| `public/js/timetable.js`, `allocations.js`, `promotion.js` | Separate academic workflow pages |
| `public/css/style.css` | Shared application styles |
| `scripts` | Setup, seeds, legacy migrations, maintenance |
| `description/description.htm` | Static SILVA design reference; not an application route |

The main admin screen has Home, Registration, Finance, Evaluation, and Personnel tabs. Older separate student/teacher/subject management pages remain alongside it. A future UI change may need to account for both implementations. Do not begin a replacement React frontend on the assumption that the README describes the existing UI correctly.

## 7. API and page map

All API groups are mounted below `/api/v1`:

| Group | Router |
|---|---|
| `/admin` | `routes/staff/adminRouter.js` |
| `/teachers` | `routes/staff/teacherRouter.js` |
| `/students` | `routes/students/studentRouter.js` |
| `/auxiliary` | `routes/staff/auxiliaryRouter.js` |
| `/subjects` | `routes/academic/subjectRouter.js` |
| `/classes` | `routes/academic/classRouter.js` |
| `/academic-years` | `routes/academic/academicYearRouter.js` |
| `/class-subject-students` | `routes/academic/classSubjectStudentRouter.js` |
| `/allocations` | `routes/academic/subjectAllocationRouter.js` |
| `/timetables` | `routes/academic/timetableRouter.js` |
| `/marks` | `routes/academic/marksRouter.js` |
| `/report-cards` | `routes/academic/reportCardRouter.js` |
| `/exams` | `routes/academic/examRouter.js` |
| `/exam-results` | `routes/academic/examResultRouter.js` |
| `/locations` | `routes/academic/locationRouter.js` |

Important workflows include teacher assignment at `/teachers/:id/assign`, class promotion at `/students/promote/:classId`, timetable generation at `/timetables/generate/class/:classId`, reports at `/report-cards/:classId/:term/:academicYearId`, student exam questions at `/exams/:examId/take`, submission at `/exams/:examId/write`, and results at `/exam-results/my-results`. Consult actual router definitions for methods, payloads, and middleware; comments are occasionally stale.

Rendered page URLs: `/`, `/login`, `/admin-dashboard`, `/teacher-dashboard`, `/student-dashboard`, `/teachers`, `/students`, `/subjects`, `/allocations`, `/timetable`, `/timetable-teacher`, `/timetable-student`, and `/promotion`.

## 8. Persistence and domain relationships

| Domain | Tables defined in source |
|---|---|
| Accounts/personnel | `Admins`, `teachers`, `auxiliary_staff`, `students` |
| Academic structure | `classes`, `subjects`, `academic_years` |
| Offering/assignment/enrollment | `class_subjects`, `class_subject_teachers`, `class_subject_students`, `academic_year_students`, `academic_year_teachers` |
| Assessment | `exams`, `questions`, `exam_results`, `subject_scores` |
| Scheduling | `time_slots`, `subject_allocations`, `timetables` |
| Fees | `student_fees` |
| Geography | `regions`, `divisions`, `subdivisions` |

`class_subjects` is the class/subject offering, with an offering coefficient. Teacher assignments reference that offering and term; student subject enrollment references offering/student/year. Sequence scores reference student/offering/year/term/sequence. Online exams instead reference subject/class/year/teacher directly.

Teacher assignments are not repeated by year. Fees have no academic-year field. Student current class/year fields are mutable and are not a sufficient enrollment-history model. Report coefficients come from offerings, so changing a catalog coefficient does not by itself prove historical reports will use the intended value.

Useful safeguards already present include parameterized SQL in many queries, foreign keys, unique offering and score identities, a single-current-year filtered unique index, password hashing, and publication gating for online results. These do not close the authorization and historical-data gaps below.

## 9. Core workflows and current semantics

### Academic preparation

Create an academic year and select the current year; maintain subjects/classes; allocate subject periods to a class/year; assign teachers for each offering and term; enroll students in class subjects where required. Subject creation is catalog-only. `setAllocationCtrl` writes an allocation then calls `ClassSubject.offer`.

### Scheduling

The generator uses Monday–Friday and seeded non-break teaching slots. The default catalog has eight teaching periods and two breaks per day, from 07:30 to 15:30. It places requested lessons in the first available cells, checking teacher/day/slot occupancy in other classes. It reports overflow and unassigned subjects. It selects the first teacher returned for a co-taught subject and deletes the existing class timetable before inserting replacement entries.

This is a scheduling baseline. It does not optimize subject distribution, balance days, enforce room availability, or model teacher availability preferences. A failed insertion can leave a partially replaced timetable.

### Marks and reporting

Two sequence marks per subject/term/year are stored separately. The report averages two available raw scores, or uses the single available score; a missing pair yields null. Weighted totals include only subjects with an average. Positions are assigned consecutively after descending average sort, without equal positions for ties. Class general average treats a student with no overall average as zero.

The report uses the first sequence maximum for subject grading, even if maxima differ. This behavior needs an agreed grading/missing-score policy before changing it.

### Online examinations

Teachers create an exam and MCQ questions, then set Pending/Live/Completed status. Students fetch questions without correct answers and submit selected options when Live. Scores scale earned question marks to `exam.totalmark`; results are stored unpublished. Admin publication makes those results visible through the student results endpoint. Online results do not automatically populate sequence marks.

### Promotion

The implementation promotes active students by class rank within section/stream and overwrites their class/year. Rank-7 students are counted as graduated by setting the promotion flag while retaining their class. There is no report-score eligibility threshold, explicit graduation state, or preserved class membership snapshot in this operation.

## 10. Prioritized findings

All findings here are source-backed observations or clearly described consequences. They were not reproduced against a live database.

### F01 — Critical: JWT forgery and cross-role identity confusion

**Evidence:** `utils/generateToken.js`, `utils/verifyToken.js`, and all three login middlewares.

Tokens use the hardcoded secret `anykey`, contain only an ID, and last five days. Each middleware resolves that ID against its own role table. A student or teacher token can therefore identify an administrator when independent identity values overlap. The known secret also allows arbitrary signed IDs.

**Required correction:** environment-managed signing secret; signed account type; explicit expected-type checks in every middleware; account status checks; invalidate existing tokens when changing authentication. Verify rejection of a token from each other role even when numeric IDs match.

### F02 — Critical: public administrator provisioning

**Evidence:** `routes/staff/adminRouter.js` public POST `/register`; `controllers/staff/adminCtrl.js` registration handler.

An unauthenticated caller can create an admin account and supply its role. Restrict provisioning to an authorized administrator or controlled bootstrap process. Verify unauthenticated creation is rejected while intended initialization still works.

### F03 — High: fresh schema setup violates dependencies

**Evidence:** `scripts/setupAcademic.js`, subject/class `createTable` definitions.

Setup creates subjects before teachers/classes, although subject foreign keys reference both. It also creates classes before teachers, although class masters reference teachers. An empty database is expected to fail. Existing tables may hide this problem.

**Required correction:** create Admins/teachers before classes, then subjects and other dependencies. Test the full setup in an empty disposable database and test a second run. Do not treat comments claiming dependency order or README idempotence as proof.

### F04 — High: mark entry passes enrollment arguments in reverse order

**Evidence:** both mark save handlers in `controllers/academic/marksCtrl.js`; `isEnrolled` and `enroll` in `model/Academic/classSubjectStudent.js`.

Controllers pass student ID then offering ID; model methods expect offering ID then student ID. Distinct IDs can create/check the wrong association or fail foreign keys. Correct every call and test with deliberately unequal IDs.

### F05 — High: teacher authorization is insufficiently scoped

**Evidence:** marks router/controller and exam router/controller.

Teacher login is required, but marks handlers do not verify assignment to the requested offering. Exam handlers do not require ownership when retrieving answer-bearing questions, adding questions, or changing status. A teacher can address another teacher's work by ID.

**Required correction:** enforce ownership or an explicitly authorized shared-teaching rule, plus offering/term/year scope, on each relevant read/write. Keep intentional admin mark access separate.

### F06 — High: students can access unrelated live exams

**Evidence:** `studentExamQuestionsCtrl` and `takeExamCtrl` in `controllers/academic/examCtrl.js`.

Live status is checked, but student class/year/enrollment eligibility is not. Add eligibility checks to both question retrieval and submission; do not rely on the browser hiding exam IDs.

### F07 — High: student listing exposes password hashes

**Evidence:** `Student.getAllFull()` selects `s.*`; `getAllStudentsCtrl` returns it directly.

Admin list responses include password hashes. Replace broad selection with explicit safe columns and verify every account response omits credentials. This is hash disclosure, not evidence of plaintext password storage.

### F08 — High data-integrity concern: weak mark validation

**Evidence:** mark save handlers and `subject_scores` schema.

Scores are capped with `Math.min` but lack explicit finite-number, nonnegative, and positive-maximum checks. Student class/year eligibility is not checked before auto-enrollment. `getClassStudentsWithScores` filters current class/withdrawal but not student academic year. Add server-side validation and scope checks before writes; verify malformed and out-of-scope entries cannot create partial batches.

### F09 — Medium: reports lose historical membership after promotion

**Evidence:** report query filters current student class/year; promotion overwrites both fields.

Stored old scores can remain while students disappear from prior reports. Introduce historical class/year enrollment and query it consistently. Existing year junctions do not capture class history by themselves.

### F10 — Medium: year membership and enrollment operations disagree

**Evidence:** student registration/promotion, academic-year counts/deletion logic, and subject enrollment model.

Student year fields are updated without corresponding year-junction maintenance. Counts and deletion decisions based on those junctions can disagree. Subject unenrollment deletes every year for the offering/student pair, and reports include class offerings without consistently using subject enrollment. Define authoritative enrollment records and include year scope in removals.

### F11 — Medium: grading and aggregation policies differ

**Evidence:** exam and report-card controllers.

Online A begins at raw score 80 after scaling to a configurable maximum; report A begins at 91 percent. Online grade thresholds distort non-100 maxima. Reports average raw scores with potentially different maxima and use the first maximum for grading. Agree on scales, normalization, pass marks, missing scores, and tie ranking, then centralize those rules.

### F12 — Medium: multiple-write operations can partially succeed

**Evidence:** timetable replacement, mark loops, fee replacement, allocation/offering creation, bulk enrollment, promotion.

Transactions do not consistently protect these logical units. Add transaction boundaries after defining whether each operation should be atomic or report individual partial results. Timetable replacement should retain its old schedule on failure.

### F13 — Medium: manual timetable integrity is weaker

**Evidence:** manual timetable controller/model, timetable schema/migration.

Manual entry lacks equivalent collision checks. Fresh DDL has `time_slot_id` without a foreign key; the migration adds that constraint only when adding a missing column. Verify existing schemas before adding constraints, enforce class/teacher slot integrity, and handle concurrent generation.

### F14 — Medium: operational and error-handling concerns

**Evidence:** `scripts/freePort.js`, package lifecycle scripts, `middlewares/globalErrHandler.js`.

`npm start` and `npm run server` first run a Windows helper that can force-kill any process listening on the selected port. It does not verify ownership and does not load `config/.env` before selecting the port. Error responses always include stack traces. Remove automatic unrelated-process termination and make production errors omit internal details.

### F15 — Further review: browser session and HTML injection exposure

**Evidence:** localStorage authentication and shared `esc` helper in `public/js/app.js`.

The helper escapes ampersands/angle brackets but not quotes, while some output goes into attributes. Audit each HTML/attribute/URL context, prefer DOM properties and textContent, and review session storage choices. This review did not demonstrate a complete browser exploit.

## 11. Setup and maintenance notes

Documented workflow is dependency installation, setting `DB_STRING` and optionally `PORT`, `npm run init`, then starting the application. Default port is 2026. The SQL connection string uses SQL Server ADO.NET-style syntax, with named instance or host/port configuration supported by the driver.

`config/.env` **does exist in this workspace**, unlike the earlier review's statement. Connection success and environment values were not validated. No example environment file was found. Do not copy local credentials into documentation or source control.

| Command/file | Actual purpose and implications |
|---|---|
| `npm run setup` | Create/migrate schema and seed classes, slots, locations; clean order needs repair |
| `npm run seed` | Seed first admin; supports ADMIN_EMAIL/ADMIN_PASSWORD |
| `npm run init` | Setup followed by admin seed |
| `npm run seed:demo` | Populate demo academic/assignment/scheduling/exam data; mutates DB |
| `npm start` | Runs free-port hook then Node |
| `npm run server` | Runs free-port hook then nodemon |
| `node server.js` | Bypasses automatic npm port-kill hook, but still connects and ensures admin table |
| `scripts/seedStudents.js` | Deletes exam results, year-student rows, and students before reseeding |
| `scripts/resetPasswords.js` | Resets all teacher and selected admin passwords to a shared value |
| `scripts/migrateStudents.js` | Legacy student schema migration/backfill |

Seed credentials are development defaults documented in the original README, not proof of live credentials. Maintenance scripts are not routine validation commands. Use a disposable database for setup/seed verification.

## 12. Documentation and engineering gaps

- README incorrectly references a React/Vite skeleton, 13 tables, and automatic all-class subject offering.
- The September review incorrectly states that `config/.env` is absent in this currently reviewed workspace.
- No test suite/test command, CI workflow, deployment configuration, or versioned migration framework was found in the reviewed first-party inventory.
- Package metadata does not enforce an `engines` runtime range.
- The main admin JavaScript is roughly 2,000 lines, with duplicated management workflows in separate pages.
- No reliable repository history was available to distinguish released features from local experiments.
- No runtime evidence establishes SQL compatibility, real schema completeness, expected UI behavior, performance, or deployment status.

## 13. Recommended continuation order and acceptance checks

1. **Secure identities and provisioning.** Fix F01/F02; verify cross-role tokens with matching IDs are rejected, public admin creation fails, allowed provisioning succeeds, and suspended/withdrawn account policy is consistently enforced.
2. **Establish repeatable installation.** Fix schema ordering; create and seed an empty disposable SQL Server database, rerun setup, then start the server without killing unrelated processes.
3. **Repair direct data defects.** Fix enrollment argument ordering, safe student columns, and score validation. Verify unequal IDs and malformed/out-of-class/out-of-year rows.
4. **Enforce academic authorization.** Exercise two teachers, two classes, and students from different years; deny unauthorized mark and exam actions while keeping intended admin actions working.
5. **Model academic history.** Preserve class/year membership, teacher assignments, coefficients and fees as required by school policy. Verify an old report is unchanged after promotion and year rollover.
6. **Define grading policy.** Confirm percentages, sequence maxima, missing marks, report pass criteria, ranking ties, and graduation decisions with the project owner before implementing policy changes.
7. **Protect batch writes and schedules.** Add appropriate transactions and integrity checks. Simulate a failure during replacement and ensure prior timetable/data survives.
8. **Run focused browser checks.** Login per role, student/staff registration and editing, assignments, allocations, generation, mark save/reload, report CSV/print, publication and promotion. Only then describe workflows as operationally verified.
9. **Complete product gaps.** Finance and online-exam browser experiences follow core correctness work. Consolidate duplicated UI deliberately rather than deleting pages without checking use.
10. **Update operational documentation.** Add a redacted environment example, supported runtime, migration strategy, test command, and deployment/runbook details once established.

Suggested first regression coverage: cross-role identity rejection; protected admin creation; clean setup twice; student-list redaction; mark save with unequal student/offering IDs; unauthorized teacher denial; wrong-class exam denial; historical report stability after promotion; transaction rollback during timetable replacement.

## 14. What this review changed

This review produced this report and `AGENT_HANDOFF.md`, and added documentation pointers. The earlier review remains historical. No application implementation, credentials, database contents, schema, seeds, or dependency versions were changed. Findings are outstanding unless a later agent records and verifies a fix.

The next agent should read `AGENT_HANDOFF.md`, this report, then the entrypoints and exact files for the selected issue. There is no user-approved next feature or grading policy recorded by this review; the authorized work was inspection and reporting.
