-- Pupil attendance (replaces the staged 014 daily-count draft with per-lesson registers).
-- One register per class, date and timetabled period. Marks are versioned: every change adds
-- a revision (status, lateness, justification) and later revisions must carry a reason.
-- Editors are (editor_type, editor_id): the lesson's teacher, an administrator, or staff
-- holding the discipline_master duty.

IF OBJECT_ID('dbo.attendance_registers', 'U') IS NULL
CREATE TABLE dbo.attendance_registers (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    school_id       INT NOT NULL,
    year_id         INT NOT NULL,
    term            NVARCHAR(10) NOT NULL,
    class_id        INT NOT NULL,
    lesson_date     DATE NOT NULL,
    timetable_id    INT NULL,
    time_slot_id    INT NULL,
    subject_id      INT NULL,
    teacher_id      INT NULL,
    start_time      NVARCHAR(5) NOT NULL,
    end_time        NVARCHAR(5) NOT NULL,
    minutes         INT NOT NULL,
    opened_by_type  NVARCHAR(20) NOT NULL,
    opened_by_id    INT NOT NULL,
    created_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_attendance_registers_tenant UNIQUE (school_id, id),
    CONSTRAINT CK_attendance_registers_term CHECK (term IN ('First', 'Second', 'Third')),
    CONSTRAINT CK_attendance_registers_minutes CHECK (minutes BETWEEN 1 AND 600),
    CONSTRAINT CK_attendance_registers_opener CHECK (opened_by_type IN ('admin', 'teacher', 'auxiliary')),
    CONSTRAINT FK_attendance_registers_year FOREIGN KEY (school_id, year_id) REFERENCES dbo.academic_years(school_id, id),
    CONSTRAINT FK_attendance_registers_class FOREIGN KEY (school_id, class_id) REFERENCES dbo.classes(school_id, id),
    CONSTRAINT FK_attendance_registers_timetable FOREIGN KEY (timetable_id) REFERENCES dbo.timetables(id),
    CONSTRAINT FK_attendance_registers_slot FOREIGN KEY (time_slot_id) REFERENCES dbo.time_slots(id)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_attendance_register_lesson' AND object_id = OBJECT_ID('dbo.attendance_registers'))
CREATE UNIQUE INDEX UX_attendance_register_lesson ON dbo.attendance_registers(school_id, class_id, lesson_date, start_time);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_attendance_register_term' AND object_id = OBJECT_ID('dbo.attendance_registers'))
CREATE INDEX IX_attendance_register_term ON dbo.attendance_registers(school_id, year_id, term, class_id);

IF OBJECT_ID('dbo.attendance_marks', 'U') IS NULL
CREATE TABLE dbo.attendance_marks (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    school_id      INT NOT NULL,
    register_id    INT NOT NULL,
    student_id     INT NOT NULL,
    revision       INT NOT NULL,
    status         VARCHAR(10) NOT NULL,
    minutes_late   INT NULL,
    justified      BIT NOT NULL DEFAULT 0,
    justification  NVARCHAR(300) NULL,
    reason         NVARCHAR(300) NULL,
    editor_type    NVARCHAR(20) NOT NULL,
    editor_id      INT NOT NULL,
    recorded_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_attendance_marks_revision UNIQUE (school_id, register_id, student_id, revision),
    CONSTRAINT CK_attendance_marks_status CHECK (status IN ('present', 'absent', 'late')),
    CONSTRAINT CK_attendance_marks_revision CHECK (revision >= 1),
    CONSTRAINT CK_attendance_marks_reason CHECK (revision = 1 OR LEN(LTRIM(RTRIM(COALESCE(reason, '')))) > 0),
    CONSTRAINT CK_attendance_marks_late CHECK ((status = 'late' AND minutes_late BETWEEN 1 AND 600) OR (status <> 'late' AND minutes_late IS NULL)),
    CONSTRAINT CK_attendance_marks_justified CHECK (justified = 0 OR (status <> 'present' AND LEN(LTRIM(RTRIM(COALESCE(justification, '')))) > 0)),
    CONSTRAINT CK_attendance_marks_editor CHECK (editor_type IN ('admin', 'teacher', 'auxiliary')),
    CONSTRAINT FK_attendance_marks_register FOREIGN KEY (school_id, register_id) REFERENCES dbo.attendance_registers(school_id, id),
    CONSTRAINT FK_attendance_marks_student FOREIGN KEY (school_id, student_id) REFERENCES dbo.students(school_id, id)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_attendance_marks_student' AND object_id = OBJECT_ID('dbo.attendance_marks'))
CREATE INDEX IX_attendance_marks_student ON dbo.attendance_marks(school_id, student_id, register_id, revision);
