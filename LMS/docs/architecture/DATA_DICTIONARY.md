# Source data dictionary

Latest synthetic update: 007 adds nullable academic_year_id, assignment_status and link_version to class_subject_teachers; enrolment_status and link_version to class_subject_students. Teacher uniqueness now includes year; trusted single/composite year FKs enforce same-school references. Original teacher years remain NULL (unresolved); no backfill or history deletion occurs. Status values are active/revoked, versions positive. Table count stays 35. See ../implementation/M1_ACADEMIC_LINKS.md; original definitions below are historical.

Newest synthetic update: migration 006 adds setup_version to academic_years/classes/subjects; permits canonical-created academic years through created_by_account_id referencing a same-school membership while retaining legacy createdBy; replaces assigned-row global business/current-year keys with school keys and separate unresolved-row uniqueness. Table count stays 35. See ../implementation/M1_ACADEMIC_SETUP.md for exact constraints, rollback limits and tests. Original DDL below is historical.

Latest synthetic increment, 26 October: migration 005 adds student/teacher profile_version (positive INT, default 1) and audit reason_code/resource_version_before/resource_version_after/changed_fields. These support scoped optimistic writes and coded audit history. No ownership/status/password backfill; table count remains 35. See ../implementation/M1_PERSONNEL_WORKFLOWS.md. Legacy DDL inventory below is historical.

Newest synthetic update: migration 004 adds ownership_reconciliation_runs and ownership_reconciliation_items, binding explicit school/operator/attestation/plan hashes to table/legacy-ID/fingerprint items. Synthetic total is now 35 tables. See ../implementation/M1_RECONCILIATION.md and immutable migration 004 for fields, constraints and execution evidence. This ledger does not assign real-school ownership.

**Synthetic schema update, 26 October 2026:** original legacy definitions below remain a historical source inventory. Baseline migration 001 and ledger are joined by nine canonical tables in migration 002: schools, accounts, school_memberships, membership_roles, legacy_account_map, platform_role_grants, account_sessions, school_invitations, identity_audit_events. Migration 003 adds nullable school_id, unique (school_id,id), a school FK and same-school composite copies of original parent FKs across all 20 school-owned legacy tables. regions/divisions/subdivisions remain global. Exact executable types/defaults/checks are in migrations/002_identity_foundation.sql and migrations/003_school_ownership_expand.sql; docs/implementation/M1_IDENTITY_PROGRESS.md explains constraints and tests. 33 tables are verified in synthetic SQL only. No original data has been assigned a school and no production migration occurred.

Review: 25 October 2026. **Verified source DDL**, not actual live database metadata. All 23 table definitions below are transcribed from CREATE TABLE declarations. SQL Server implicit nullability is labelled unspecified; inspect live sys.columns after explicit authorisation. Inline defaults and UNIQUE/PRIMARY KEY constraints are shown; supporting indexes are SQL-managed unless separately declared. No school_id exists in these definitions. No record values are included.

## Relationship and temporal summary

Every table uses an independent INT IDENTITY primary key. Most business FK columns reference those IDs globally. Terms are First/Second/Third; sequences 1/2. Teacher assignments have term but no year; class offerings have no year; enrolment junction and marks have year; fees have no year. Global reference candidates are regions/divisions/subdivisions. All other tables require school ownership or explicit canonical-account separation. See MIGRATION_PLAN.md for target ownership of every table.

| Table | Source | Declared columns |
|---|---|---|
| academic_years | model/Academic/academicYear.js:23 | 7 |
| academic_year_students | model/Academic/academicYear.js:53 | 4 |
| academic_year_teachers | model/Academic/academicYear.js:66 | 4 |
| classes | model/Academic/class.js:52 | 12 |
| class_subjects | model/Academic/classSubject.js:19 | 5 |
| class_subject_teachers | model/Academic/classSubject.js:41 | 5 |
| class_subject_students | model/Academic/classSubjectStudent.js:8 | 5 |
| exams | model/Academic/exam.js:12 | 14 |
| exam_results | model/Academic/examResult.js:15 | 12 |
| regions | model/Academic/location.js:117 | 2 |
| divisions | model/Academic/location.js:124 | 3 |
| subdivisions | model/Academic/location.js:134 | 3 |
| questions | model/Academic/question.js:10 | 11 |
| students | model/Academic/student.js:22 | 24 |
| student_fees | model/Academic/student.js:70 | 5 |
| subjects | model/Academic/subject.js:9 | 11 |
| subject_allocations | model/Academic/subjectAllocation.js:8 | 6 |
| subject_scores | model/Academic/subjectScore.js:8 | 11 |
| time_slots | model/Academic/timeSlot.js:21 | 6 |
| timetables | model/Academic/timetable.js:10 | 13 |
| Admins | model/staff/admin.js:12 | 6 |
| auxiliary_staff | model/staff/auxiliary.js:12 | 10 |
| teachers | model/staff/teacher.js:15 | 23 |

## Column-level definitions and constraints

Type, nullability, default, primary/unique keys and check rules are retained in the definitions rather than inferred from model query parameter types. A CHECK does not make a nullable field required. ON DELETE CASCADE is explicit only where shown.

### academic_years

Source: `model/Academic/academicYear.js:23`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| name | `NVARCHAR(20) NOT NULL UNIQUE` | No |
| fromYear | `INT NOT NULL` | No |
| toYear | `INT NOT NULL` | No |
| isCurrent | `BIT NOT NULL DEFAULT 0` | No |
| createdBy | `INT NOT NULL` | No |
| createdAt | `DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT FK_ay_admin FOREIGN KEY (createdBy) REFERENCES Admins(id)
```

### academic_year_students

Source: `model/Academic/academicYear.js:53`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| academic_year_id | `INT NOT NULL` | No |
| student_id | `INT NOT NULL` | No |
| createdAt | `DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT UQ_ays UNIQUE (academic_year_id, student_id),
CONSTRAINT FK_ays_year    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
CONSTRAINT FK_ays_student FOREIGN KEY (student_id)       REFERENCES students(id)        ON DELETE CASCADE
```

### academic_year_teachers

Source: `model/Academic/academicYear.js:66`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| academic_year_id | `INT NOT NULL` | No |
| teacher_id | `INT NOT NULL` | No |
| createdAt | `DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT UQ_ayt UNIQUE (academic_year_id, teacher_id),
CONSTRAINT FK_ayt_year    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
CONSTRAINT FK_ayt_teacher FOREIGN KEY (teacher_id)       REFERENCES teachers(id)        ON DELETE CASCADE
```

### classes

Source: `model/Academic/class.js:52`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| section | `NVARCHAR(20) NOT NULL` | No |
| name | `NVARCHAR(50) NOT NULL` | No |
| stream | `NVARCHAR(20) NULL` | Yes |
| rank | `INT NOT NULL` | No |
| class_master_id | `INT NULL` | Yes |
| registration_fee | `DECIMAL(10,2) NOT NULL DEFAULT 0` | No |
| tuition_fee | `DECIMAL(10,2) NOT NULL DEFAULT 0` | No |
| pta_fee | `DECIMAL(10,2) NOT NULL DEFAULT 0` | No |
| caution_fee | `DECIMAL(10,2) NOT NULL DEFAULT 0` | No |
| practicals_fee | `DECIMAL(10,2) NOT NULL DEFAULT 0` | No |
| option_name | `NVARCHAR(100) NULL` | Yes |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT UQ_class UNIQUE (section, name, stream),
CONSTRAINT FK_class_master FOREIGN KEY (class_master_id) REFERENCES teachers(id)
```

### class_subjects

Source: `model/Academic/classSubject.js:19`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| class_id | `INT NOT NULL` | No |
| subject_id | `INT NOT NULL` | No |
| coefficient | `DECIMAL(4,2) NOT NULL DEFAULT 1` | No |
| createdAt | `DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT UQ_class_subject UNIQUE (class_id, subject_id),
CONSTRAINT FK_cs_class   FOREIGN KEY (class_id)   REFERENCES classes(id)  ON DELETE CASCADE,
CONSTRAINT FK_cs_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
```

### class_subject_teachers

Source: `model/Academic/classSubject.js:41`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| class_subject_id | `INT NOT NULL` | No |
| teacher_id | `INT NOT NULL` | No |
| term | `NVARCHAR(10) NOT NULL` | No |
| createdAt | `DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT UQ_cst UNIQUE (class_subject_id, teacher_id, term),
CONSTRAINT CK_cst_term CHECK (term IN ('First', 'Second', 'Third')),
CONSTRAINT FK_cst_cs      FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id) ON DELETE CASCADE,
CONSTRAINT FK_cst_teacher FOREIGN KEY (teacher_id)       REFERENCES teachers(id)       ON DELETE CASCADE
```

### class_subject_students

Source: `model/Academic/classSubjectStudent.js:8`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| class_subject_id | `INT NOT NULL` | No |
| student_id | `INT NOT NULL` | No |
| academic_year_id | `INT NOT NULL` | No |
| createdAt | `DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT UQ_cs_student UNIQUE (class_subject_id, student_id, academic_year_id),
CONSTRAINT FK_css_cs      FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id) ON DELETE CASCADE,
CONSTRAINT FK_css_student FOREIGN KEY (student_id)       REFERENCES students(id)        ON DELETE CASCADE,
CONSTRAINT FK_css_year    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
```

### exams

Source: `model/Academic/exam.js:12`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| name | `NVARCHAR(150) NOT NULL` | No |
| description | `NVARCHAR(500) NULL` | Yes |
| subjectId | `INT NOT NULL` | No |
| classLevel | `INT NOT NULL` | No |
| passmark | `INT NOT NULL DEFAULT 50` | No |
| totalmark | `INT NOT NULL DEFAULT 100` | No |
| coefficient | `INT NOT NULL DEFAULT 3` | No |
| academicTerm | `NVARCHAR(10) NOT NULL` | No |
| academicYearId | `INT NOT NULL` | No |
| examDate | `DATE NULL` | Yes |
| examStatus | `NVARCHAR(20) NOT NULL DEFAULT 'Pending'` | No |
| createdBy | `INT NOT NULL` | No |
| createdAt | `DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT CK_exam_term   CHECK (academicTerm IN ('First', 'Second', 'Third')),
CONSTRAINT CK_exam_status CHECK (examStatus IN ('Pending', 'Live', 'Completed')),
CONSTRAINT CK_exam_marks  CHECK (passmark <= totalmark),
CONSTRAINT FK_exam_subject FOREIGN KEY (subjectId)      REFERENCES subjects(id),
CONSTRAINT FK_exam_class   FOREIGN KEY (classLevel)     REFERENCES classes(id),
CONSTRAINT FK_exam_year    FOREIGN KEY (academicYearId) REFERENCES academic_years(id),
CONSTRAINT FK_exam_teacher FOREIGN KEY (createdBy)      REFERENCES teachers(id)
```

### exam_results

Source: `model/Academic/examResult.js:15`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| studentId | `INT NOT NULL` | No |
| examId | `INT NOT NULL` | No |
| subjectId | `INT NOT NULL` | No |
| score | `DECIMAL(5,2) NOT NULL` | No |
| passmark | `INT NOT NULL DEFAULT 50` | No |
| grade | `NVARCHAR(5) NULL` | Yes |
| status | `NVARCHAR(10) NOT NULL` | No |
| remarks | `NVARCHAR(20) NULL` | Yes |
| position | `INT NULL` | Yes |
| isPublished | `BIT NOT NULL DEFAULT 0` | No |
| createdAt | `DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT UQ_result UNIQUE (studentId, examId),
CONSTRAINT CK_result_status  CHECK (status IN ('Passed', 'Failed')),
CONSTRAINT CK_result_remarks CHECK (remarks IN ('Excellent', 'Good', 'Poor')),
CONSTRAINT FK_result_student FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
CONSTRAINT FK_result_exam    FOREIGN KEY (examId)    REFERENCES exams(id),
CONSTRAINT FK_result_subject FOREIGN KEY (subjectId) REFERENCES subjects(id)
```

### regions

Source: `model/Academic/location.js:117`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| name | `NVARCHAR(60) NOT NULL UNIQUE` | No |

Table constraints/FKs (including cascade behaviour):

No separate named table constraints; inline keys are shown above.

### divisions

Source: `model/Academic/location.js:124`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| name | `NVARCHAR(80) NOT NULL` | No |
| region_id | `INT NOT NULL` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT UQ_division UNIQUE (name, region_id),
CONSTRAINT FK_division_region FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE
```

### subdivisions

Source: `model/Academic/location.js:134`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| name | `NVARCHAR(80) NOT NULL` | No |
| division_id | `INT NOT NULL` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT UQ_subdivision UNIQUE (name, division_id),
CONSTRAINT FK_subdivision_division FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE CASCADE
```

### questions

Source: `model/Academic/question.js:10`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| examId | `INT NOT NULL` | No |
| questionText | `NVARCHAR(MAX) NOT NULL` | No |
| optionA | `NVARCHAR(500) NOT NULL` | No |
| optionB | `NVARCHAR(500) NOT NULL` | No |
| optionC | `NVARCHAR(500) NOT NULL` | No |
| optionD | `NVARCHAR(500) NOT NULL` | No |
| correctOption | `CHAR(1) NOT NULL` | No |
| marks | `INT NOT NULL DEFAULT 1` | No |
| createdBy | `INT NOT NULL` | No |
| createdAt | `DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT CK_question_correct CHECK (correctOption IN ('A', 'B', 'C', 'D')),
CONSTRAINT FK_question_exam    FOREIGN KEY (examId)    REFERENCES exams(id) ON DELETE CASCADE,
CONSTRAINT FK_question_teacher FOREIGN KEY (createdBy) REFERENCES teachers(id)
```

### students

Source: `model/Academic/student.js:22`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| firstName | `NVARCHAR(100) NOT NULL` | No |
| middleName | `NVARCHAR(100) NULL` | Yes |
| lastName | `NVARCHAR(100) NOT NULL` | No |
| matricule | `NVARCHAR(50)  NOT NULL UNIQUE` | No |
| password | `NVARCHAR(255) NOT NULL` | No |
| section | `NVARCHAR(20)  NOT NULL` | No |
| dateOfBirth | `DATE NULL` | Yes |
| sex | `NVARCHAR(10)  NOT NULL CHECK (sex IN ('Male', 'Female'))` | No |
| yearOfEnrollment | `INT NULL` | Yes |
| role | `NVARCHAR(20)  NOT NULL DEFAULT 'student'` | No |
| academicYearId | `INT NULL` | Yes |
| currentClassLevel | `INT NULL` | Yes |
| isWithdrawn | `BIT NOT NULL DEFAULT 0` | No |
| promoted | `BIT NOT NULL DEFAULT 0` | No |
| address | `NVARCHAR(200) NULL` | Yes |
| placeOfBirth | `NVARCHAR(100) NULL` | Yes |
| regionOfOrigin | `NVARCHAR(100) NULL` | Yes |
| division | `NVARCHAR(100) NULL` | Yes |
| parentName | `NVARCHAR(200) NULL` | Yes |
| parentPhone | `NVARCHAR(15)  NULL` | Yes |
| parentPhone2 | `NVARCHAR(15)  NULL` | Yes |
| medicalStatus | `NVARCHAR(200) NULL` | Yes |
| createdAt | `DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT CK_student_section CHECK (section IN ('Anglophone', 'Francophone')),
CONSTRAINT CK_student_role    CHECK (role = 'student'),
CONSTRAINT FK_student_class FOREIGN KEY (currentClassLevel) REFERENCES classes(id),
CONSTRAINT FK_student_year  FOREIGN KEY (academicYearId)    REFERENCES academic_years(id)
```

### student_fees

Source: `model/Academic/student.js:70`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| student_id | `INT NOT NULL` | No |
| fee_type | `NVARCHAR(50) NOT NULL` | No |
| amount | `DECIMAL(10,2) NOT NULL DEFAULT 0` | No |
| paid | `BIT NOT NULL DEFAULT 0` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT UQ_student_fee UNIQUE (student_id, fee_type),
CONSTRAINT FK_student_fee_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
```

### subjects

Source: `model/Academic/subject.js:9`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| name | `NVARCHAR(100) NOT NULL` | No |
| code | `NVARCHAR(20)  NOT NULL UNIQUE` | No |
| description | `NVARCHAR(200) NULL` | Yes |
| coefficient | `INT NOT NULL DEFAULT 1` | No |
| categories | `NVARCHAR(20) NULL` | Yes |
| subject_master | `INT NULL` | Yes |
| class_id | `INT NULL` | Yes |
| hours_per_week | `INT NOT NULL DEFAULT 4` | No |
| has_lab | `BIT NOT NULL DEFAULT 0` | No |
| createdAt | `DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT FK_subject_master FOREIGN KEY (subject_master) REFERENCES teachers(id),
CONSTRAINT FK_subject_class FOREIGN KEY (class_id) REFERENCES classes(id),
CONSTRAINT CK_subjects_categories CHECK (categories IN ('Science', 'Arts', 'Compulsory')),
CONSTRAINT CK_subjects_coefficient CHECK (coefficient BETWEEN 1 AND 5),
CONSTRAINT CK_subjects_hours CHECK (hours_per_week BETWEEN 1 AND 10)
```

### subject_allocations

Source: `model/Academic/subjectAllocation.js:8`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| class_id | `INT NOT NULL` | No |
| subject_id | `INT NOT NULL` | No |
| periods_week | `INT NOT NULL` | No |
| academic_year_id | `INT NOT NULL` | No |
| createdAt | `DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT UQ_sa UNIQUE (class_id, subject_id, academic_year_id),
CONSTRAINT FK_sa_class   FOREIGN KEY (class_id)   REFERENCES classes(id) ON DELETE CASCADE,
CONSTRAINT FK_sa_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
CONSTRAINT FK_sa_year    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
```

### subject_scores

Source: `model/Academic/subjectScore.js:8`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| student_id | `INT NOT NULL` | No |
| class_subject_id | `INT NOT NULL` | No |
| academic_year_id | `INT NOT NULL` | No |
| term | `NVARCHAR(10) NOT NULL` | No |
| sequence | `TINYINT NOT NULL` | No |
| score | `DECIMAL(5,2) NOT NULL` | No |
| max_score | `DECIMAL(5,2) NOT NULL DEFAULT 50` | No |
| created_by | `INT NOT NULL` | No |
| created_at | `DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()` | No |
| updated_at | `DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT CK_ss_term     CHECK (term IN ('First', 'Second', 'Third')),
CONSTRAINT CK_ss_sequence CHECK (sequence IN (1, 2)),
CONSTRAINT UQ_ss UNIQUE (student_id, class_subject_id, academic_year_id, term, sequence),
CONSTRAINT FK_ss_student  FOREIGN KEY (student_id)       REFERENCES students(id)       ON DELETE CASCADE,
CONSTRAINT FK_ss_cs       FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id) ON DELETE CASCADE,
CONSTRAINT FK_ss_year     FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
```

### time_slots

Source: `model/Academic/timeSlot.js:21`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| slot_number | `INT NOT NULL` | No |
| start_time | `NVARCHAR(5) NOT NULL` | No |
| end_time | `NVARCHAR(5) NOT NULL` | No |
| is_break | `BIT NOT NULL DEFAULT 0` | No |
| sort_order | `INT NOT NULL` | No |

Table constraints/FKs (including cascade behaviour):

No separate named table constraints; inline keys are shown above.

### timetables

Source: `model/Academic/timetable.js:10`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| class_id | `INT NOT NULL` | No |
| subject_id | `INT NOT NULL` | No |
| teacher_id | `INT NOT NULL` | No |
| day_of_week | `NVARCHAR(10) NOT NULL` | No |
| time_slot_id | `INT NULL` | Yes |
| start_time | `NVARCHAR(5)  NOT NULL` | No |
| end_time | `NVARCHAR(5)  NOT NULL` | No |
| room | `NVARCHAR(50) NULL` | Yes |
| academic_term | `NVARCHAR(10) NOT NULL` | No |
| academic_year_id | `INT NOT NULL` | No |
| created_by | `INT NOT NULL` | No |
| createdAt | `DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME()` | No |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT FK_tt_class  FOREIGN KEY (class_id)  REFERENCES classes(id),
CONSTRAINT FK_tt_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
CONSTRAINT FK_tt_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id),
CONSTRAINT FK_tt_year   FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
CONSTRAINT FK_tt_admin  FOREIGN KEY (created_by) REFERENCES Admins(id)
```

### Admins

Source: `model/staff/admin.js:12`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| name | `NVARCHAR(100) NOT NULL` | No |
| email | `NVARCHAR(255) NOT NULL UNIQUE` | No |
| password | `NVARCHAR(255) NOT NULL` | No |
| role | `NVARCHAR(50)  NOT NULL` | No |
| createdAt | `DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()` | No |

Table constraints/FKs (including cascade behaviour):

No separate named table constraints; inline keys are shown above.

### auxiliary_staff

Source: `model/staff/auxiliary.js:12`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| name | `NVARCHAR(255) NOT NULL` | No |
| firstName | `NVARCHAR(100) NOT NULL` | No |
| middleName | `NVARCHAR(100) NULL` | Yes |
| lastName | `NVARCHAR(100) NOT NULL` | No |
| email | `NVARCHAR(255) NOT NULL UNIQUE` | No |
| phone | `NVARCHAR(30)  NULL` | Yes |
| role | `NVARCHAR(50)  NOT NULL` | No |
| status | `NVARCHAR(20)  NOT NULL DEFAULT 'pending'` | No |
| createdAt | `DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()` | No |

Table constraints/FKs (including cascade behaviour):

No separate named table constraints; inline keys are shown above.

### teachers

Source: `model/staff/teacher.js:15`.

| Column | Type and declared rules | Nullable |
|---|---|---|
| id | `INT IDENTITY(1,1) PRIMARY KEY` | No |
| name | `NVARCHAR(255) NOT NULL` | No |
| firstName | `NVARCHAR(100) NOT NULL` | No |
| middleName | `NVARCHAR(100) NULL` | Yes |
| lastName | `NVARCHAR(100) NOT NULL` | No |
| email | `NVARCHAR(255) NOT NULL UNIQUE` | No |
| password | `NVARCHAR(255) NOT NULL` | No |
| phone | `NVARCHAR(30)  NULL` | Yes |
| secondaryContactName | `NVARCHAR(200) NULL` | Yes |
| secondaryContactPhone | `NVARCHAR(30) NULL` | Yes |
| employmentType | `NVARCHAR(20)  NOT NULL` | No |
| section | `NVARCHAR(20)  NOT NULL` | No |
| status | `NVARCHAR(20)  NOT NULL DEFAULT 'active'` | No |
| role | `NVARCHAR(20)  NOT NULL DEFAULT 'teacher'` | No |
| createdAt | `DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()` | No |
| address | `NVARCHAR(300) NULL` | Yes |
| idCardNo | `NVARCHAR(50)  NULL` | Yes |
| dateOfIssue | `DATE NULL` | Yes |
| gender | `NVARCHAR(10)  NULL` | Yes |
| civilStatus | `NVARCHAR(20)  NULL` | Yes |
| noOfChildren | `INT NULL` | Yes |
| telephone | `NVARCHAR(30)  NULL` | Yes |
| matricule | `NVARCHAR(255) NULL` | Yes |

Table constraints/FKs (including cascade behaviour):

```sql
CONSTRAINT CK_teacher_employment CHECK (employmentType IN ('Government', 'Part-time')),
CONSTRAINT CK_teacher_section    CHECK (section IN ('Anglophone', 'Francophone')),
CONSTRAINT CK_teacher_status     CHECK (status IN ('active', 'suspended', 'withdrawn')),
CONSTRAINT CK_teacher_role       CHECK (role = 'teacher'),
CONSTRAINT CK_teacher_gender     CHECK (gender IN ('Male', 'Female'))
```

## Explicit index and migration drift inventory

Only a global filtered unique current-year index is explicitly created outside inline constraints: academicYear.js UX_academic_year_current on isCurrent where 1. No tenant-prefix lookup indexes exist. Unique/PK declarations create supporting indexes; actual names/options cannot be certified without live metadata.

Fresh versus upgraded schema differences matter:

- teachers DDL declares matricule; migration adds matriculeFile; safe queries and writes use matriculeFile. Both may exist after setup. Old boolean status columns are dropped without status backfill.
- student migration adds several names/date/sex/year/address fields as nullable, unlike fresh first/last/sex NOT NULL; it may fill guessed sex/year. parentPhone2 is added in createTable, with redundant phone-width adjustment using sys.columns max_length (bytes, not character count).
- class migration adds master/fee/option fields and attempts master FK, swallowing failure.
- subject migration adds coefficient/category/master/class/hours/lab fields and named checks/FKs. Neither fresh DDL nor migration declares passmark, although report SQL selects it.
- timetable fresh DDL includes time_slot_id without FK; migration adds slot FK only if the column itself is missing. Existing schemas may therefore lack the relation.
- subjectScore.createTable invokes migrate to drop a teacher-only created_by FK because admins can also enter marks. Actor role is not persisted, making overlapping IDs ambiguous.
- classSubject.createTable can ALTER coefficient NOT NULL on an existing table; null legacy values would need reconciliation first.

The following source lines identify inline schema mutation entrypoints. They were not executed. Inspect full functions and actual metadata before replacing them with versioned migrations.

- `model/Academic/academicYear.js:42`: `CREATE UNIQUE INDEX UX_academic_year_current`
- `model/Academic/class.js:101`: `case 'class_master_id': ddl = "ALTER TABLE classes ADD class_master_id INT NULL"; break;`
- `model/Academic/class.js:102`: `case 'registration_fee': ddl = "ALTER TABLE classes ADD registration_fee DECIMAL(10,2) NOT NULL DEFAULT 0"; break;`
- `model/Academic/class.js:103`: `case 'tuition_fee': ddl = "ALTER TABLE classes ADD tuition_fee DECIMAL(10,2) NOT NULL DEFAULT 0"; break;`
- `model/Academic/class.js:104`: `case 'pta_fee': ddl = "ALTER TABLE classes ADD pta_fee DECIMAL(10,2) NOT NULL DEFAULT 0"; break;`
- `model/Academic/class.js:105`: `case 'caution_fee': ddl = "ALTER TABLE classes ADD caution_fee DECIMAL(10,2) NOT NULL DEFAULT 0"; break;`
- `model/Academic/class.js:106`: `case 'practicals_fee': ddl = "ALTER TABLE classes ADD practicals_fee DECIMAL(10,2) NOT NULL DEFAULT 0"; break;`
- `model/Academic/class.js:107`: `case 'option_name': ddl = "ALTER TABLE classes ADD option_name NVARCHAR(100) NULL"; break;`
- `model/Academic/class.js:116`: `await pool.request().query("ALTER TABLE classes ADD CONSTRAINT FK_class_master FOREIGN KEY (class_master_id) REFERENCES teachers(id)");`
- `model/Academic/classSubject.js:35`: `ALTER TABLE class_subjects ALTER COLUMN coefficient DECIMAL(4,2) NOT NULL;`
- `model/Academic/student.js:58`: `ALTER TABLE students ALTER COLUMN parentPhone NVARCHAR(15);`
- `model/Academic/student.js:62`: `ALTER TABLE students ADD parentPhone2 NVARCHAR(15) NULL;`
- `model/Academic/student.js:91`: `case 'firstName': ddl = "ALTER TABLE students ADD firstName NVARCHAR(100) NULL"; break;`
- `model/Academic/student.js:92`: `case 'middleName': ddl = "ALTER TABLE students ADD middleName NVARCHAR(100) NULL"; break;`
- `model/Academic/student.js:93`: `case 'lastName': ddl = "ALTER TABLE students ADD lastName NVARCHAR(100) NULL"; break;`
- `model/Academic/student.js:94`: `case 'dateOfBirth': ddl = "ALTER TABLE students ADD dateOfBirth DATE NULL"; break;`
- `model/Academic/student.js:95`: `case 'sex': ddl = "ALTER TABLE students ADD sex NVARCHAR(10) NULL"; break;`
- `model/Academic/student.js:96`: `case 'yearOfEnrollment': ddl = "ALTER TABLE students ADD yearOfEnrollment INT NULL"; break;`
- `model/Academic/student.js:97`: `case 'address': ddl = "ALTER TABLE students ADD address NVARCHAR(200) NULL"; break;`
- `model/Academic/student.js:98`: `case 'placeOfBirth': ddl = "ALTER TABLE students ADD placeOfBirth NVARCHAR(100) NULL"; break;`
- `model/Academic/student.js:99`: `case 'regionOfOrigin': ddl = "ALTER TABLE students ADD regionOfOrigin NVARCHAR(100) NULL"; break;`
- `model/Academic/student.js:100`: `case 'division': ddl = "ALTER TABLE students ADD division NVARCHAR(100) NULL"; break;`
- `model/Academic/student.js:101`: `case 'parentName': ddl = "ALTER TABLE students ADD parentName NVARCHAR(200) NULL"; break;`
- `model/Academic/student.js:102`: `case 'parentPhone': ddl = "ALTER TABLE students ADD parentPhone NVARCHAR(15) NULL"; break;`
- `model/Academic/student.js:103`: `case 'parentPhone2': ddl = "ALTER TABLE students ADD parentPhone2 NVARCHAR(15) NULL"; break;`
- `model/Academic/student.js:104`: `case 'medicalStatus': ddl = "ALTER TABLE students ADD medicalStatus NVARCHAR(200) NULL"; break;`
- `model/Academic/student.js:111`: `await pool.request().query("ALTER TABLE students ADD CONSTRAINT CK_student_sex CHECK (sex IN ('Male', 'Female'))");`
- `model/Academic/subject.js:37`: `if (!r.recordset.length) await pool.request().query('ALTER TABLE subjects ADD ${ddl}');`
- `model/Academic/subject.js:49`: `if (!r.recordset.length) await pool.request().query('ALTER TABLE subjects ADD CONSTRAINT ${ddl}');`
- `model/Academic/subjectScore.js:37`: `ALTER TABLE subject_scores DROP CONSTRAINT FK_ss_teacher;`
- `model/Academic/timetable.js:42`: `ALTER TABLE timetables ADD time_slot_id INT NULL`
- `model/staff/teacher.js:59`: `'ALTER TABLE teachers DROP CONSTRAINT ' + QUOTENAME(dc.name)`
- `model/staff/teacher.js:65`: `await pool.request().query("ALTER TABLE teachers DROP COLUMN isSuspended");`
- `model/staff/teacher.js:66`: `await pool.request().query("ALTER TABLE teachers DROP COLUMN isWithdrawn");`
- `model/staff/teacher.js:74`: `await pool.request().query("ALTER TABLE teachers ADD status NVARCHAR(20) NOT NULL DEFAULT 'active'");`
- `model/staff/teacher.js:80`: `await pool.request().query("ALTER TABLE teachers ADD CONSTRAINT CK_teacher_status CHECK (status IN ('active', 'suspended', 'withdrawn'))");`
- `model/staff/teacher.js:88`: `await pool.request().query("ALTER TABLE teachers ADD firstName NVARCHAR(100) NULL");`
- `model/staff/teacher.js:89`: `await pool.request().query("ALTER TABLE teachers ADD middleName NVARCHAR(100) NULL");`
- `model/staff/teacher.js:90`: `await pool.request().query("ALTER TABLE teachers ADD lastName NVARCHAR(100) NULL");`
- `model/staff/teacher.js:96`: `await pool.request().query("ALTER TABLE teachers ALTER COLUMN firstName NVARCHAR(100) NOT NULL");`
- `model/staff/teacher.js:97`: `await pool.request().query("ALTER TABLE teachers ALTER COLUMN lastName NVARCHAR(100) NOT NULL");`
- `model/staff/teacher.js:99`: `await pool.request().query("ALTER TABLE teachers ALTER COLUMN name NVARCHAR(255) NOT NULL");`
- `model/staff/teacher.js:107`: `await pool.request().query("ALTER TABLE teachers ADD secondaryContactName NVARCHAR(200) NULL");`
- `model/staff/teacher.js:108`: `await pool.request().query("ALTER TABLE teachers ADD secondaryContactPhone NVARCHAR(30) NULL");`
- `model/staff/teacher.js:113`: `{ name: 'address', ddl: "ALTER TABLE teachers ADD address NVARCHAR(300) NULL" },`
- `model/staff/teacher.js:114`: `{ name: 'idCardNo', ddl: "ALTER TABLE teachers ADD idCardNo NVARCHAR(50) NULL" },`
- `model/staff/teacher.js:115`: `{ name: 'dateOfIssue', ddl: "ALTER TABLE teachers ADD dateOfIssue DATE NULL" },`
- `model/staff/teacher.js:116`: `{ name: 'gender', ddl: "ALTER TABLE teachers ADD gender NVARCHAR(10) NULL" },`
- `model/staff/teacher.js:117`: `{ name: 'civilStatus', ddl: "ALTER TABLE teachers ADD civilStatus NVARCHAR(20) NULL" },`
- `model/staff/teacher.js:118`: `{ name: 'noOfChildren', ddl: "ALTER TABLE teachers ADD noOfChildren INT NULL" },`
- `model/staff/teacher.js:119`: `{ name: 'telephone', ddl: "ALTER TABLE teachers ADD telephone NVARCHAR(30) NULL" },`
- `model/staff/teacher.js:120`: `{ name: 'matriculeFile', ddl: "ALTER TABLE teachers ADD matriculeFile NVARCHAR(255) NULL" },`
- `model/staff/teacher.js:136`: `await pool.request().query("ALTER TABLE teachers ADD CONSTRAINT CK_teacher_gender CHECK (gender IN ('Male', 'Female'))");`

## Authorised future metadata validation

Compare sys.tables, sys.columns (type/length/nullability/default), sys.key_constraints, sys.indexes/index_columns, sys.foreign_keys/foreign_key_columns, sys.check_constraints and migration ledger. Record trusted/disabled constraints, duplicate/orphan counts and schema-only differences without PII. This is required before any migration; no query has been run here.
