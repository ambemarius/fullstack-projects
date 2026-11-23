-- Empty-database baseline only. Existing legacy databases are refused by the runner.
-- Preserves legacy column names; adds teacher compatibility field and timetable slot FK.

CREATE TABLE Admins (
                id        INT IDENTITY(1,1) PRIMARY KEY,
                name      NVARCHAR(100) NOT NULL,
                email     NVARCHAR(255) NOT NULL UNIQUE,
                password  NVARCHAR(255) NOT NULL,
                role      NVARCHAR(50)  NOT NULL,
                createdAt DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE teachers (
                id                   INT IDENTITY(1,1) PRIMARY KEY,
                name                 NVARCHAR(255) NOT NULL,
                firstName            NVARCHAR(100) NOT NULL,
                middleName           NVARCHAR(100) NULL,
                lastName             NVARCHAR(100) NOT NULL,
                email                NVARCHAR(255) NOT NULL UNIQUE,
                password             NVARCHAR(255) NOT NULL,
                phone                NVARCHAR(30)  NULL,
                secondaryContactName NVARCHAR(200) NULL,
                secondaryContactPhone NVARCHAR(30) NULL,
                employmentType       NVARCHAR(20)  NOT NULL,
                section              NVARCHAR(20)  NOT NULL,
                status               NVARCHAR(20)  NOT NULL DEFAULT 'active',
                role                 NVARCHAR(20)  NOT NULL DEFAULT 'teacher',
                createdAt            DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
                address              NVARCHAR(300) NULL,
                idCardNo             NVARCHAR(50)  NULL,
                dateOfIssue          DATE NULL,
                gender               NVARCHAR(10)  NULL,
                civilStatus          NVARCHAR(20)  NULL,
                noOfChildren         INT NULL,
                telephone            NVARCHAR(30)  NULL,
                matricule        NVARCHAR(255) NULL,
                matriculeFile NVARCHAR(255) NULL,
                CONSTRAINT CK_teacher_employment CHECK (employmentType IN ('Government', 'Part-time')),
                CONSTRAINT CK_teacher_section    CHECK (section IN ('Anglophone', 'Francophone')),
                CONSTRAINT CK_teacher_status     CHECK (status IN ('active', 'suspended', 'withdrawn')),
                CONSTRAINT CK_teacher_role       CHECK (role = 'teacher'),
                CONSTRAINT CK_teacher_gender     CHECK (gender IN ('Male', 'Female'))
);

CREATE TABLE classes (
                id      INT IDENTITY(1,1) PRIMARY KEY,
                section NVARCHAR(20) NOT NULL,
                name    NVARCHAR(50) NOT NULL,
                stream  NVARCHAR(20) NULL,
                rank    INT NOT NULL,
                class_master_id INT NULL,
                registration_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
                tuition_fee      DECIMAL(10,2) NOT NULL DEFAULT 0,
                pta_fee          DECIMAL(10,2) NOT NULL DEFAULT 0,
                caution_fee      DECIMAL(10,2) NOT NULL DEFAULT 0,
                practicals_fee   DECIMAL(10,2) NOT NULL DEFAULT 0,
                option_name      NVARCHAR(100) NULL,
                CONSTRAINT UQ_class UNIQUE (section, name, stream),
                CONSTRAINT FK_class_master FOREIGN KEY (class_master_id) REFERENCES teachers(id)
);

CREATE TABLE subjects (
                id          INT IDENTITY(1,1) PRIMARY KEY,
                name        NVARCHAR(100) NOT NULL,
                code        NVARCHAR(20)  NOT NULL UNIQUE,
                description NVARCHAR(200) NULL,
                coefficient INT NOT NULL DEFAULT 1,
                categories  NVARCHAR(20) NULL,
                subject_master INT NULL,
                class_id    INT NULL,
                hours_per_week INT NOT NULL DEFAULT 4,
                has_lab BIT NOT NULL DEFAULT 0,
                createdAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT FK_subject_master FOREIGN KEY (subject_master) REFERENCES teachers(id),
                CONSTRAINT FK_subject_class FOREIGN KEY (class_id) REFERENCES classes(id),
                CONSTRAINT CK_subjects_categories CHECK (categories IN ('Science', 'Arts', 'Compulsory')),
                CONSTRAINT CK_subjects_coefficient CHECK (coefficient BETWEEN 1 AND 5),
                CONSTRAINT CK_subjects_hours CHECK (hours_per_week BETWEEN 1 AND 10)
);

CREATE TABLE academic_years (
                id        INT IDENTITY(1,1) PRIMARY KEY,
                name      NVARCHAR(20) NOT NULL UNIQUE,
                fromYear  INT NOT NULL,
                toYear    INT NOT NULL,
                isCurrent BIT NOT NULL DEFAULT 0,
                createdBy INT NOT NULL,
                createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT FK_ay_admin FOREIGN KEY (createdBy) REFERENCES Admins(id)
);

CREATE TABLE students (
                id                INT IDENTITY(1,1) PRIMARY KEY,
                firstName         NVARCHAR(100) NOT NULL,
                middleName        NVARCHAR(100) NULL,
                lastName          NVARCHAR(100) NOT NULL,
                matricule         NVARCHAR(50)  NOT NULL UNIQUE,
                password          NVARCHAR(255) NOT NULL,
                section           NVARCHAR(20)  NOT NULL,
                dateOfBirth       DATE NULL,
                sex               NVARCHAR(10)  NOT NULL CHECK (sex IN ('Male', 'Female')),
                yearOfEnrollment  INT NULL,
                role              NVARCHAR(20)  NOT NULL DEFAULT 'student',
                academicYearId    INT NULL,
                currentClassLevel INT NULL,
                isWithdrawn       BIT NOT NULL DEFAULT 0,
                promoted          BIT NOT NULL DEFAULT 0,
                address           NVARCHAR(200) NULL,
                placeOfBirth      NVARCHAR(100) NULL,
                regionOfOrigin    NVARCHAR(100) NULL,
                division          NVARCHAR(100) NULL,
                parentName        NVARCHAR(200) NULL,
                parentPhone       NVARCHAR(15)  NULL,
                parentPhone2      NVARCHAR(15)  NULL,
                medicalStatus     NVARCHAR(200) NULL,
                createdAt         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT CK_student_section CHECK (section IN ('Anglophone', 'Francophone')),
                CONSTRAINT CK_student_role    CHECK (role = 'student'),
                CONSTRAINT FK_student_class FOREIGN KEY (currentClassLevel) REFERENCES classes(id),
                CONSTRAINT FK_student_year  FOREIGN KEY (academicYearId)    REFERENCES academic_years(id)
);

CREATE TABLE student_fees (
                id         INT IDENTITY(1,1) PRIMARY KEY,
                student_id INT NOT NULL,
                fee_type   NVARCHAR(50) NOT NULL,
                amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
                paid       BIT NOT NULL DEFAULT 0,
                CONSTRAINT UQ_student_fee UNIQUE (student_id, fee_type),
                CONSTRAINT FK_student_fee_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE auxiliary_staff (
                id          INT IDENTITY(1,1) PRIMARY KEY,
                name        NVARCHAR(255) NOT NULL,
                firstName   NVARCHAR(100) NOT NULL,
                middleName  NVARCHAR(100) NULL,
                lastName    NVARCHAR(100) NOT NULL,
                email       NVARCHAR(255) NOT NULL UNIQUE,
                phone       NVARCHAR(30)  NULL,
                role        NVARCHAR(50)  NOT NULL,
                status      NVARCHAR(20)  NOT NULL DEFAULT 'pending',
                createdAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE regions (
                id   INT IDENTITY(1,1) PRIMARY KEY,
                name NVARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE divisions (
                id        INT IDENTITY(1,1) PRIMARY KEY,
                name      NVARCHAR(80) NOT NULL,
                region_id INT NOT NULL,
                CONSTRAINT UQ_division UNIQUE (name, region_id),
                CONSTRAINT FK_division_region FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE
);

CREATE TABLE subdivisions (
                id          INT IDENTITY(1,1) PRIMARY KEY,
                name        NVARCHAR(80) NOT NULL,
                division_id INT NOT NULL,
                CONSTRAINT UQ_subdivision UNIQUE (name, division_id),
                CONSTRAINT FK_subdivision_division FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE CASCADE
);

CREATE TABLE class_subjects (
                id           INT IDENTITY(1,1) PRIMARY KEY,
                class_id     INT NOT NULL,
                subject_id   INT NOT NULL,
                coefficient  DECIMAL(4,2) NOT NULL DEFAULT 1,
                createdAt    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT UQ_class_subject UNIQUE (class_id, subject_id),
                CONSTRAINT FK_cs_class   FOREIGN KEY (class_id)   REFERENCES classes(id)  ON DELETE CASCADE,
                CONSTRAINT FK_cs_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

CREATE TABLE class_subject_teachers (
                id               INT IDENTITY(1,1) PRIMARY KEY,
                class_subject_id INT NOT NULL,
                teacher_id       INT NOT NULL,
                term             NVARCHAR(10) NOT NULL,
                createdAt        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT UQ_cst UNIQUE (class_subject_id, teacher_id, term),
                CONSTRAINT CK_cst_term CHECK (term IN ('First', 'Second', 'Third')),
                CONSTRAINT FK_cst_cs      FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id) ON DELETE CASCADE,
                CONSTRAINT FK_cst_teacher FOREIGN KEY (teacher_id)       REFERENCES teachers(id)       ON DELETE CASCADE
);

CREATE TABLE class_subject_students (
                id               INT IDENTITY(1,1) PRIMARY KEY,
                class_subject_id INT NOT NULL,
                student_id       INT NOT NULL,
                academic_year_id INT NOT NULL,
                createdAt        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT UQ_cs_student UNIQUE (class_subject_id, student_id, academic_year_id),
                CONSTRAINT FK_css_cs      FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id) ON DELETE CASCADE,
                CONSTRAINT FK_css_student FOREIGN KEY (student_id)       REFERENCES students(id)        ON DELETE CASCADE,
                CONSTRAINT FK_css_year    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
);

CREATE TABLE academic_year_students (
                id               INT IDENTITY(1,1) PRIMARY KEY,
                academic_year_id INT NOT NULL,
                student_id       INT NOT NULL,
                createdAt        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT UQ_ays UNIQUE (academic_year_id, student_id),
                CONSTRAINT FK_ays_year    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
                CONSTRAINT FK_ays_student FOREIGN KEY (student_id)       REFERENCES students(id)        ON DELETE CASCADE
);

CREATE TABLE academic_year_teachers (
                id               INT IDENTITY(1,1) PRIMARY KEY,
                academic_year_id INT NOT NULL,
                teacher_id       INT NOT NULL,
                createdAt        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT UQ_ayt UNIQUE (academic_year_id, teacher_id),
                CONSTRAINT FK_ayt_year    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
                CONSTRAINT FK_ayt_teacher FOREIGN KEY (teacher_id)       REFERENCES teachers(id)        ON DELETE CASCADE
);

CREATE TABLE exams (
                id             INT IDENTITY(1,1) PRIMARY KEY,
                name           NVARCHAR(150) NOT NULL,
                description    NVARCHAR(500) NULL,
                subjectId      INT NOT NULL,
                classLevel     INT NOT NULL,
                passmark       INT NOT NULL DEFAULT 50,
                totalmark      INT NOT NULL DEFAULT 100,
                coefficient    INT NOT NULL DEFAULT 3,
                academicTerm   NVARCHAR(10) NOT NULL,
                academicYearId INT NOT NULL,
                examDate       DATE NULL,
                examStatus     NVARCHAR(20) NOT NULL DEFAULT 'Pending',
                createdBy      INT NOT NULL,
                createdAt      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT CK_exam_term   CHECK (academicTerm IN ('First', 'Second', 'Third')),
                CONSTRAINT CK_exam_status CHECK (examStatus IN ('Pending', 'Live', 'Completed')),
                CONSTRAINT CK_exam_marks  CHECK (passmark <= totalmark),
                CONSTRAINT FK_exam_subject FOREIGN KEY (subjectId)      REFERENCES subjects(id),
                CONSTRAINT FK_exam_class   FOREIGN KEY (classLevel)     REFERENCES classes(id),
                CONSTRAINT FK_exam_year    FOREIGN KEY (academicYearId) REFERENCES academic_years(id),
                CONSTRAINT FK_exam_teacher FOREIGN KEY (createdBy)      REFERENCES teachers(id)
);

CREATE TABLE questions (
                id            INT IDENTITY(1,1) PRIMARY KEY,
                examId        INT NOT NULL,
                questionText  NVARCHAR(MAX) NOT NULL,
                optionA       NVARCHAR(500) NOT NULL,
                optionB       NVARCHAR(500) NOT NULL,
                optionC       NVARCHAR(500) NOT NULL,
                optionD       NVARCHAR(500) NOT NULL,
                correctOption CHAR(1) NOT NULL,
                marks         INT NOT NULL DEFAULT 1,
                createdBy     INT NOT NULL,
                createdAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT CK_question_correct CHECK (correctOption IN ('A', 'B', 'C', 'D')),
                CONSTRAINT FK_question_exam    FOREIGN KEY (examId)    REFERENCES exams(id) ON DELETE CASCADE,
                CONSTRAINT FK_question_teacher FOREIGN KEY (createdBy) REFERENCES teachers(id)
);

CREATE TABLE exam_results (
                id          INT IDENTITY(1,1) PRIMARY KEY,
                studentId   INT NOT NULL,
                examId      INT NOT NULL,
                subjectId   INT NOT NULL,
                score       DECIMAL(5,2) NOT NULL,
                passmark    INT NOT NULL DEFAULT 50,
                grade       NVARCHAR(5) NULL,
                status      NVARCHAR(10) NOT NULL,
                remarks     NVARCHAR(20) NULL,
                position    INT NULL,
                isPublished BIT NOT NULL DEFAULT 0,
                createdAt   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT UQ_result UNIQUE (studentId, examId),
                CONSTRAINT CK_result_status  CHECK (status IN ('Passed', 'Failed')),
                CONSTRAINT CK_result_remarks CHECK (remarks IN ('Excellent', 'Good', 'Poor')),
                CONSTRAINT FK_result_student FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
                CONSTRAINT FK_result_exam    FOREIGN KEY (examId)    REFERENCES exams(id),
                CONSTRAINT FK_result_subject FOREIGN KEY (subjectId) REFERENCES subjects(id)
);

CREATE TABLE time_slots (
                id          INT IDENTITY(1,1) PRIMARY KEY,
                slot_number INT NOT NULL,
                start_time  NVARCHAR(5) NOT NULL,
                end_time    NVARCHAR(5) NOT NULL,
                is_break    BIT NOT NULL DEFAULT 0,
                sort_order  INT NOT NULL
);

CREATE TABLE subject_allocations (
                id            INT IDENTITY(1,1) PRIMARY KEY,
                class_id      INT NOT NULL,
                subject_id    INT NOT NULL,
                periods_week  INT NOT NULL,
                academic_year_id INT NOT NULL,
                createdAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT UQ_sa UNIQUE (class_id, subject_id, academic_year_id),
                CONSTRAINT FK_sa_class   FOREIGN KEY (class_id)   REFERENCES classes(id) ON DELETE CASCADE,
                CONSTRAINT FK_sa_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
                CONSTRAINT FK_sa_year    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
);

CREATE TABLE subject_scores (
                id               INT IDENTITY(1,1) PRIMARY KEY,
                student_id       INT NOT NULL,
                class_subject_id INT NOT NULL,
                academic_year_id INT NOT NULL,
                term             NVARCHAR(10) NOT NULL,
                sequence         TINYINT NOT NULL,
                score            DECIMAL(5,2) NOT NULL,
                max_score        DECIMAL(5,2) NOT NULL DEFAULT 50,
                created_by       INT NOT NULL,
                created_at       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                updated_at       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT CK_ss_term     CHECK (term IN ('First', 'Second', 'Third')),
                CONSTRAINT CK_ss_sequence CHECK (sequence IN (1, 2)),
                CONSTRAINT UQ_ss UNIQUE (student_id, class_subject_id, academic_year_id, term, sequence),
                CONSTRAINT FK_ss_student  FOREIGN KEY (student_id)       REFERENCES students(id)       ON DELETE CASCADE,
                CONSTRAINT FK_ss_cs       FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id) ON DELETE CASCADE,
                CONSTRAINT FK_ss_year     FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
);

CREATE TABLE timetables (
                id              INT IDENTITY(1,1) PRIMARY KEY,
                class_id        INT NOT NULL,
                subject_id      INT NOT NULL,
                teacher_id      INT NOT NULL,
                day_of_week     NVARCHAR(10) NOT NULL,
                time_slot_id    INT NULL,
                start_time      NVARCHAR(5)  NOT NULL,
                end_time        NVARCHAR(5)  NOT NULL,
                room            NVARCHAR(50) NULL,
                academic_term   NVARCHAR(10) NOT NULL,
                academic_year_id INT NOT NULL,
                created_by      INT NOT NULL,
                createdAt       DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT FK_tt_slot FOREIGN KEY (time_slot_id) REFERENCES time_slots(id),
                CONSTRAINT FK_tt_class  FOREIGN KEY (class_id)  REFERENCES classes(id),
                CONSTRAINT FK_tt_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
                CONSTRAINT FK_tt_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id),
                CONSTRAINT FK_tt_year   FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
                CONSTRAINT FK_tt_admin  FOREIGN KEY (created_by) REFERENCES Admins(id)
);

CREATE UNIQUE INDEX UX_academic_year_current ON academic_years(isCurrent) WHERE isCurrent=1;
