# LMS Project Review

> Historical review from 30 September 2026. See [the 25 October findings report](PROJECT_FINDINGS_2026-10-25.md) and [agent handoff](AGENT_HANDOFF.md) for the current review. In particular, `config/.env` is present in the currently reviewed workspace; its contents and connectivity remain unverified.

**Review date:** 30 September 2026  
**Scope:** First-party application code, models, controllers, routes, middleware, browser scripts, EJS templates, styles, setup/maintenance scripts, package configuration, README, and the HTML design reference. Installed dependency internals and tool metadata were excluded.

## 1. What this project is about

LMS is a web-based **secondary-school management system**. Its main purpose is to bring school registration, academic organization, teaching assignments, timetabling, assessment, and student progression into one application.

Despite the name “LMS,” the implemented emphasis is school administration rather than course-content delivery. There is no observed lesson-content library, video learning platform, or assignment submission system.

The school model is tailored to **Cameroon**: it includes Anglophone and Francophone sections, Cameroon regions/divisions/subdivisions, and parent phone normalization using the `+237` country code. This conclusion is supported directly by `model/Academic/class.js`, `location.js`, and `student.js`.

The application combines a JSON REST API with an existing browser interface. The actual frontend uses **EJS, CSS, and plain JavaScript**, rather than the React/Vite frontend mentioned in the README.

## 2. Users and responsibilities

| User | Implemented responsibilities |
|---|---|
| Administrator | Manage students, teachers, auxiliary staff, subjects, academic years, class settings and fees; assign teachers; allocate weekly periods; manage timetables; enter marks; review subject enrollment; generate reports; promote classes; publish/unpublish exam results. |
| Teacher | Log in, view/update selected profile fields, view assigned subjects and students, view timetable, enter sequence marks, and use exam/question APIs. |
| Student | Log in with matricule and password, view/update selected profile fields, view class timetable, take live exams through APIs, and retrieve published exam results through APIs. |
| Auxiliary staff | Stored and managed by administrators as personnel records. No dedicated auxiliary login/dashboard was found. |

Role-specific dashboards exist, but some API capabilities have no corresponding complete browser workflow. In particular, the student dashboard script principally displays profile information; exam-taking and published-result endpoints are not exposed by that script.

## 3. Technology and architecture

| Layer | Implementation |
|---|---|
| Runtime | Node.js, CommonJS modules |
| HTTP application | Express 5; Node HTTP server |
| Database | Microsoft SQL Server through `mssql` |
| Database access | Handwritten SQL in entity model objects; no ORM |
| UI rendering | EJS templates served by Express |
| Browser behavior | Plain JavaScript, Fetch API, localStorage |
| Authentication | JWT bearer tokens using `jsonwebtoken` |
| Password storage | bcrypt hashes, generally with 10 salt rounds |
| Supporting packages | dotenv, morgan, express-async-handler, nodemon |

The normal request flow is:

```text
Browser -> EJS page + public assets
Browser Fetch request -> /api/v1 router -> authentication middleware
                     -> controller -> model -> SQL Server
                     <- JSON response
```

`server.js` waits for the SQL connection, ensures the admin table exists, and starts listening. `app/app.js` configures middleware, static assets, views, API mounts, and error handling. `config/database.js` loads `config/.env` and creates a shared SQL connection pool immediately when imported.

The backend is organized consistently into routes, controllers, and models. Controllers handle HTTP requests and basic validation; models manage SQL operations. Some controllers, including report cards and academic-year deletion, also contain direct SQL.

## 4. Main features and workflows

### Registration and personnel

Student records contain names, matricule, section, birth details, class/year, guardian contacts, address/origin, medical information, withdrawal status, and promotion status. Registration can save a list of fees with amount and paid/unpaid flags.

Teacher records include employment type, section, contact information, identity and family details, and active/suspended/withdrawn status. Government teachers require a matricule value. Although some code calls it `matriculeFile`, the admin UI currently collects text; a file-upload pipeline was not found.

Auxiliary staff have a separate model, API, and administrator registration panel.

### Academic organization

The default class catalog contains **21 classes**:

- Anglophone: Form1–Form5, LowerSixth, UpperSixth, each in Normal and Bilingual streams: 14 classes.
- Francophone: 6ème, 5ème, 4ème, 3ème, 2nde, 1ère, Terminale: 7 classes.

Classes have ordered ranks, class masters, fee settings, and optional option names. Academic years have start/end years and an enforced single-current-year flag.

Subjects are catalog records with code, coefficient, category, master/class references, hours per week, and lab flag. Creating a subject currently adds it to the catalog. Class offerings are established through allocations or other offering operations; the README's claim that creation automatically offers a subject in every class is outdated.

Teacher assignments link a teacher to a class-subject and term. The schema permits co-teaching. Student subject enrollment is tracked separately by academic year.

### Timetables

Administrators allocate periods per week to subjects for a class/year, then assign teachers and generate a timetable. Generation uses weekday teaching slots and a greedy first-available placement algorithm. It checks teacher slots already occupied by other classes, reports unassigned subjects and overflow, and replaces the selected class's previous timetable.

Teacher and student timetable views retrieve schedules for their identity/class. The generator is a useful scheduling baseline, but it does not implement an optimization solver, balanced daily subject distribution, room-conflict management, or explicit teacher availability rules. For co-taught offerings it selects the first teacher encountered.

### Assessment and reporting

There are **two separate assessment systems**:

1. **Online multiple-choice exams:** Teachers create exams/questions, change exam status, and students submit answers while an exam is Live. Answers are graded automatically. One result per student/exam is enforced in the data model, and students see results only after publication by an admin.
2. **Sequence marks:** Teachers/admins save two sequences per subject/term/year. Report cards compute subject averages, coefficient-weighted overall averages, positions, class averages, and subject statistics. The admin UI supports CSV export and browser printing.

These systems use separate tables and grading logic. No automatic transfer of online exam scores into sequence marks was found.

### Promotion

An administrator can promote all active students in a class to the next rank within the same section/stream and supply an academic year. Students in rank 7 are counted as graduated by setting the promotion flag. This is a bulk progression operation; it does not evaluate report-card results or a promotion threshold.

### Finance coverage

Class fee definitions and per-student amounts/paid flags are implemented. The dedicated Finance tab explicitly says financial management is coming soon. There is no observed payment gateway, receipt ledger, installment tracking, accounting module, or year-specific payment history.

## 5. Data model

The source defines **23 distinct SQL tables**; this is a source-code count, not a verified live database inventory.

| Area | Tables |
|---|---|
| Accounts/personnel | `Admins`, `teachers`, `auxiliary_staff`, `students` |
| Academic structure | `classes`, `subjects`, `academic_years` |
| Assignments/enrollment | `class_subjects`, `class_subject_teachers`, `class_subject_students`, `academic_year_students`, `academic_year_teachers` |
| Assessments | `exams`, `questions`, `exam_results`, `subject_scores` |
| Scheduling | `time_slots`, `subject_allocations`, `timetables` |
| Fees | `student_fees` |
| Geography | `regions`, `divisions`, `subdivisions` |

The core relationship is class -> class-subject offering -> teacher assignment/student enrollment. Scores reference offerings, students, years, terms, and sequences. Exams instead reference subject, class, year, and teacher directly.

SQL parameters are used extensively for data values. Foreign keys, unique constraints, term/status checks, and a filtered unique index on the current academic year provide useful integrity controls. However, year context is inconsistent: teacher assignments have a term but no academic-year field, and student fees have no academic-year field.

## 6. Code and API map

| Location | Purpose |
|---|---|
| `server.js` | Database-dependent server startup and port error handling |
| `app/app.js` | Express configuration and API/page wiring |
| `config/database.js` | Environment loading and SQL connection pool |
| `routes/webRouter.js`, `views/` | Landing/login, admin/teacher/student dashboards, management and timetable pages |
| `routes/staff/`, `controllers/staff/` | Admin, teacher, auxiliary personnel APIs |
| `routes/students/`, `controllers/students/` | Student account and record APIs |
| `routes/academic/`, `controllers/academic/` | Classes, years, subjects, enrollment, allocation, marks, reports, exams, schedules |
| `model/Academic/`, `model/staff/` | SQL schemas, migrations, queries, password operations |
| `middlewares/`, `utils/` | Authentication, JWT generation/verification, errors |
| `public/js/`, `public/css/style.css` | Browser interactions and shared styling |
| `scripts/` | Schema setup, demo/admin/student seeds, migrations, password reset, port cleanup |
| `description/description.htm` | SILVA-branded static design reference, not mounted as an application route |

The API is mounted under `/api/v1`: `/admin`, `/teachers`, `/students`, `/subjects`, `/classes`, `/academic-years`, `/exams`, `/exam-results`, `/timetables`, `/allocations`, `/locations`, `/marks`, `/class-subject-students`, `/report-cards`, and `/auxiliary`.

The admin interface is concentrated in a large `views/admin-layout.ejs` template and a roughly 2,000-line `public/js/admin-layout.js` script. Separate older/smaller management pages also remain, creating multiple UI implementations for some features.

## 7. Setup and operational behavior

The documented workflow is `npm install`, configure `config/.env`, `npm run init`, and start the server. The configuration expects an ADO.NET-style SQL Server connection string in `DB_STRING`; the default HTTP port is 2026. No `config/.env` file was present in the reviewed working directory, and no example environment file was found.

| Command/script | Behavior |
|---|---|
| `npm run setup` | Creates/migrates tables and seeds locations, time slots, and classes |
| `npm run seed` | Seeds an admin; supports `ADMIN_EMAIL`/`ADMIN_PASSWORD` overrides |
| `npm run init` | Runs setup followed by admin seeding |
| `npm run seed:demo` | Creates demo academic data, assignments, scheduling and exam examples |
| `npm start` | Runs port cleanup automatically, then starts Node |
| `npm run server` | Runs port cleanup automatically, then starts nodemon |
| `scripts/seedStudents.js` | Deletes existing student-related records before inserting generated students |
| `scripts/resetPasswords.js` | Bulk-resets teacher and selected admin passwords to a shared value |
| `scripts/migrateStudents.js` | Legacy student-column migration/backfill |

**The documented clean setup should not currently be treated as reliable:** schema creation has dependency-order defects described below. Server startup only creates the admin table; it does not replace full schema setup.

The automatic port-cleanup script uses Windows `netstat`, `findstr`, and `taskkill`. It terminates the listening process without checking whether it belongs to this project, and does not load `config/.env` before choosing its port. This is an operational concern and limits portability.

## 8. Significant findings

These findings are supported by source inspection. Database-dependent outcomes were not reproduced against SQL Server during this review.

### Critical: authentication and administrator provisioning

- **JWT secret is hardcoded and tokens lack account type.** `utils/generateToken.js` and `verifyToken.js` use the literal secret `anykey`; the payload contains only `{ id }` and lasts five days. The three authentication middlewares resolve that ID against different tables. Since those tables have independent identity sequences, a token issued to a student/teacher can resolve to an admin with the same ID. The known signing secret also permits token forgery. Use a deployment secret and verify a signed account type/role with a consistent account identity scheme.
- **Administrator registration is public.** `routes/staff/adminRouter.js` mounts `/register` without authentication. `controllers/staff/adminCtrl.js` accepts the supplied role and creates an admin account. Restrict provisioning to an authorized admin or a controlled bootstrap process.

### High: setup and primary feature defects

- **Fresh setup creates referenced tables too late.** `scripts/setupAcademic.js` creates and migrates subjects before classes/teachers. `model/Academic/subject.js` declares foreign keys to both; `model/Academic/class.js` also references teachers, which setup creates afterward. An empty database should fail at subject creation. Create teachers, then classes, then subjects, and apply dependent constraints in a controlled order.

### High: academic authorization and data handling

- **Teacher access is not scoped to assigned subjects or exam ownership.** Marks controllers accept arbitrary offering IDs without checking teaching assignment. Exam controllers allow any authenticated teacher to inspect questions/answers or change another teacher's exam. Verify assignment, ownership, term, and year on every relevant operation.
- **Students are not checked for exam eligibility.** Exam take/write handlers check Live status, but not matching class, year, or subject enrollment. Students can request an unrelated live exam by ID.
- **Mark enrollment arguments are reversed.** `marksCtrl.js` passes student ID before class-subject ID into `ClassSubjectStudent.isEnrolled` and `.enroll`; the model expects class-subject ID first. This can check or create the wrong association, or fail foreign-key checks.
- **Student list query selects password hashes.** `getAllFull()` in `model/Academic/student.js` selects `s.*`, and the list controller returns its result directly. This exposes password hashes to authorized list API callers. Use explicit safe columns.

### Medium: consistency and historical accuracy

- **Historical reports depend on current student placement.** `reportCardCtrl.js` filters `students.currentClassLevel` and `students.academicYearId`. Promotion overwrites those fields, so prior class/year reports can lose students even though scores remain stored. Report from historical enrollment records instead.
- **Academic-year membership has competing representations.** Normal registration/promotion updates student year fields without corresponding junction-table maintenance. Year counts/deletion checks use `academic_year_students`, which can therefore disagree with current records.
- **Subject enrollment does not consistently constrain reporting.** Reports join all class offerings, while mark entry can auto-enroll students. Course-review choices are not consistently applied to reporting, and unenrollment deletes associations across all years for a student/offering.
- **Grading scales differ and are not consistently normalized.** Online exams assign A at 80 and apply thresholds to the raw scaled score, even when totalmark differs from 100. Reports assign A at 91% and average raw sequence scores using the first sequence maximum for grading. Differing maxima can distort grades and overall averages. Define one explicit grading policy and normalize before aggregation.
- **Promotion has limited graduation/history semantics.** Rank-7 students remain in their current class with a promotion flag, and no result-based eligibility or distinct graduation status is enforced.
- **Several multi-step operations lack transactions.** Timetable replacement deletes then inserts; marks, fees, enrollment batches, and promotion can partially succeed. Existing academic-year transactions demonstrate a useful pattern to extend.
- **Manual timetable integrity is weaker than generated scheduling.** Manual insertion has no equivalent teacher/class collision checks. The fresh timetable DDL includes `time_slot_id` without a foreign key, while migration only adds the foreign key if the column is absent.

### Maintenance and production readiness

- Error responses expose stack traces through `middlewares/globalErrHandler.js`.
- Tokens are stored in localStorage; shared HTML escaping only handles `&`, `<`, and `>`, although some values are used in HTML attributes. Review context-specific escaping and script-injection risks before deployment.
- No automated test suite, test script, CI configuration, deployment configuration, or versioned migration framework was found in first-party files.
- Maintenance scripts can delete records or reset many passwords. They should be documented and limited to explicitly selected environments.
- The README understates the schema, references a nonexistent React frontend, omits newer API groups, and inaccurately describes subject offering behavior. Node compatibility is not enforced through a package `engines` field.

## 9. Strengths

- Clear routes/controllers/models separation and a coherent school domain.
- Substantial implemented UI beyond a backend skeleton.
- Password hashing and many explicit safe account queries.
- Extensive parameterized SQL and useful database integrity constraints.
- Separate publication gating for exam results.
- Practical timetable generation with cross-class teacher-busy checks and overflow reporting.
- Weighted reporting, CSV export, and printable output.
- Setup and migration intent is generally repeatable, with transaction-backed academic-year changes.

## 10. Recommended next steps

1. Fix account-type validation, JWT secret management, and public admin registration before exposing the application.
2. Repair clean schema setup, student-list safe columns, and mark enrollment argument ordering.
3. Enforce teacher assignment/ownership and student exam eligibility on the server.
4. Preserve enrollment history and make reports, promotion, counts, and deletion rules use that history consistently.
5. Agree on grading, missing-score, maximum-score, ranking/tie, and graduation policies; implement those rules centrally.
6. Add transactions and timetable collision constraints/checks for multi-step writes.
7. Add focused integration coverage for clean setup, cross-role access rejection, registration/listing, assigned-teacher mark entry, historical reporting after promotion, and timetable replacement failure.
8. Update setup documentation/environment examples, split the large admin UI by feature, and decide which legacy pages to retain.
9. Complete finance and exam/result browser workflows only after the core data/security issues are addressed.

## 11. Verification and limitations

- **78 first-party JavaScript files parsed successfully** using Node's `vm.Script`, without executing application code.
- **15 EJS templates compiled successfully** with the installed EJS package. This checks template syntax, not full rendered behavior or browser layout.
- Review environment: Node `v25.1.0`, npm `11.6.2`; this does not establish compatibility with the README's Node 18 recommendation.
- An initial subprocess-based syntax-check attempt could not launch child checks in this environment; in-process parsing supplied the successful verification above.
- No server, database initialization, seed, password reset, or destructive maintenance operation was run. SQL Server connectivity, actual schema/data, API integration, and browser workflows remain unverified.
- No application fixes were made as part of this report. Existing unrelated working-tree changes were preserved.

**Overall assessment:** This is a substantial school-management application with broad administrative and academic coverage. Source-level security defects, setup failures, and historical-data inconsistencies prevent treating it as deployment-ready, even though its JavaScript and templates pass syntax checks.
