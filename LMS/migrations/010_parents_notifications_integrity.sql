-- Additive, idempotent: guardian accounts, in-app notifications, mark-change history,
-- subject passmark, score range check and hot-path indexes. No backfill, no drops.

IF OBJECT_ID('dbo.parents', 'U') IS NULL
CREATE TABLE dbo.parents (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    firstName  NVARCHAR(100) NOT NULL,
    lastName   NVARCHAR(100) NOT NULL,
    phone      NVARCHAR(20)  NOT NULL,
    email      NVARCHAR(255) NULL,
    password   NVARCHAR(255) NOT NULL,
    status     NVARCHAR(20)  NOT NULL DEFAULT 'active',
    school_id  INT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_parents_phone UNIQUE (phone),
    CONSTRAINT CK_parents_status CHECK (status IN ('active', 'suspended'))
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_parents_email' AND object_id = OBJECT_ID('dbo.parents'))
CREATE UNIQUE INDEX UX_parents_email ON dbo.parents(email) WHERE email IS NOT NULL;

IF OBJECT_ID('dbo.parent_students', 'U') IS NULL
CREATE TABLE dbo.parent_students (
    parent_id          INT NOT NULL,
    student_id         INT NOT NULL,
    relationship       NVARCHAR(30) NULL,
    linked_by_admin_id INT NULL,
    created_at         DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_parent_students PRIMARY KEY (parent_id, student_id),
    CONSTRAINT FK_ps_parent  FOREIGN KEY (parent_id)  REFERENCES dbo.parents(id)  ON DELETE CASCADE,
    CONSTRAINT FK_ps_student FOREIGN KEY (student_id) REFERENCES dbo.students(id) ON DELETE CASCADE
);

IF OBJECT_ID('dbo.notifications', 'U') IS NULL
CREATE TABLE dbo.notifications (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    recipient_type NVARCHAR(20)  NOT NULL,
    recipient_id   INT           NOT NULL,
    title          NVARCHAR(200) NOT NULL,
    body           NVARCHAR(MAX) NULL,
    is_read        BIT           NOT NULL DEFAULT 0,
    created_at     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_notifications_recipient' AND object_id = OBJECT_ID('dbo.notifications'))
CREATE INDEX IX_notifications_recipient ON dbo.notifications(recipient_type, recipient_id, is_read);

IF COL_LENGTH('dbo.subjects', 'passmark') IS NULL
ALTER TABLE dbo.subjects ADD passmark INT NULL;

IF COL_LENGTH('dbo.subject_scores', 'updated_by') IS NULL
ALTER TABLE dbo.subject_scores ADD updated_by INT NULL;

IF OBJECT_ID('dbo.subject_score_history', 'U') IS NULL
CREATE TABLE dbo.subject_score_history (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    score_id         INT NULL,
    class_subject_id INT NOT NULL,
    student_id       INT NOT NULL,
    academic_year_id INT NOT NULL,
    term             NVARCHAR(10) NOT NULL,
    sequence         TINYINT NOT NULL,
    old_score        DECIMAL(5,2) NULL,
    new_score        DECIMAL(5,2) NOT NULL,
    changed_by       INT NOT NULL,
    changed_by_type  NVARCHAR(20) NOT NULL,
    changed_at       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ssh_score' AND object_id = OBJECT_ID('dbo.subject_score_history'))
CREATE INDEX IX_ssh_score ON dbo.subject_score_history(student_id, class_subject_id, academic_year_id, term, sequence);

-- WITH NOCHECK: existing rows are not re-validated so an out-of-range legacy mark cannot block the migration;
-- new and updated rows are enforced.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ss_score_range' AND parent_object_id = OBJECT_ID('dbo.subject_scores'))
ALTER TABLE dbo.subject_scores WITH NOCHECK ADD CONSTRAINT CK_ss_score_range CHECK (score >= 0 AND score <= max_score);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_students_class_withdrawn' AND object_id = OBJECT_ID('dbo.students'))
CREATE INDEX IX_students_class_withdrawn ON dbo.students(currentClassLevel, isWithdrawn);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_cst_teacher' AND object_id = OBJECT_ID('dbo.class_subject_teachers'))
CREATE INDEX IX_cst_teacher ON dbo.class_subject_teachers(teacher_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_timetables_teacher_day' AND object_id = OBJECT_ID('dbo.timetables'))
CREATE INDEX IX_timetables_teacher_day ON dbo.timetables(teacher_id, day_of_week);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_exam_results_student' AND object_id = OBJECT_ID('dbo.exam_results'))
CREATE INDEX IX_exam_results_student ON dbo.exam_results(studentId);
