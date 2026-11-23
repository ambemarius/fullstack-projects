-- Additive: staff duties (bursar, librarian, lab attendant, discipline master),
-- sign-in passwords for auxiliary staff, and single-school ownership defaults.
-- The single-application deployment owns exactly one school; every school-owned
-- row written by the main app must carry that school's id so school-scoped
-- modules (finance, attendance, library, laboratory) can see it.

IF COL_LENGTH('dbo.auxiliary_staff', 'password') IS NULL
ALTER TABLE dbo.auxiliary_staff ADD password NVARCHAR(255) NULL;

IF OBJECT_ID('dbo.staff_duties', 'U') IS NULL
CREATE TABLE dbo.staff_duties (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    school_id           INT NULL,
    staff_type          NVARCHAR(20) NOT NULL,
    staff_id            INT NOT NULL,
    duty                NVARCHAR(30) NOT NULL,
    granted_by_admin_id INT NOT NULL,
    granted_at          DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    revoked_by_admin_id INT NULL,
    revoked_at          DATETIME2 NULL,
    CONSTRAINT FK_staff_duties_school FOREIGN KEY (school_id) REFERENCES dbo.schools(id),
    CONSTRAINT CK_staff_duties_type CHECK (staff_type IN ('admin', 'teacher', 'auxiliary')),
    CONSTRAINT CK_staff_duties_duty CHECK (duty IN ('bursar', 'librarian', 'lab_attendant', 'discipline_master')),
    CONSTRAINT CK_staff_duties_revoked CHECK ((revoked_at IS NULL AND revoked_by_admin_id IS NULL) OR (revoked_at IS NOT NULL AND revoked_by_admin_id IS NOT NULL))
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_staff_duties_active' AND object_id = OBJECT_ID('dbo.staff_duties'))
CREATE UNIQUE INDEX UX_staff_duties_active ON dbo.staff_duties(staff_type, staff_id, duty) WHERE revoked_at IS NULL;

-- Applies a school_id default and backfills NULLs, but only when exactly one active
-- school exists. Parents are backfilled before children so composite tenant keys hold.
-- Seeding calls this again after it creates the first school on a fresh install.
EXEC(N'CREATE OR ALTER PROCEDURE dbo.lms_apply_single_school_defaults
AS
BEGIN
    SET NOCOUNT ON;
    IF (SELECT COUNT(*) FROM dbo.schools WHERE status = ''active'') <> 1 RETURN;
    DECLARE @school INT = (SELECT id FROM dbo.schools WHERE status = ''active'');
    DECLARE @tables TABLE (ord INT PRIMARY KEY, name SYSNAME NOT NULL);
    INSERT @tables VALUES
        (1, ''Admins''), (2, ''teachers''), (3, ''classes''), (4, ''subjects''), (5, ''academic_years''),
        (6, ''auxiliary_staff''), (7, ''time_slots''), (8, ''students''), (9, ''parents''), (10, ''staff_duties''),
        (11, ''student_fees''), (12, ''class_subjects''), (13, ''academic_year_students''), (14, ''academic_year_teachers''),
        (15, ''subject_allocations''), (16, ''timetables''), (17, ''exams''),
        (18, ''class_subject_teachers''), (19, ''class_subject_students''), (20, ''questions''),
        (21, ''exam_results''), (22, ''subject_scores'');
    DECLARE @name SYSNAME, @sql NVARCHAR(MAX);
    DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM @tables ORDER BY ord;
    OPEN c; FETCH NEXT FROM c INTO @name;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF COL_LENGTH(N''dbo.'' + @name, ''school_id'') IS NOT NULL
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM sys.default_constraints d
                JOIN sys.columns col ON col.object_id = d.parent_object_id AND col.column_id = d.parent_column_id
                WHERE d.parent_object_id = OBJECT_ID(N''dbo.'' + @name) AND col.name = ''school_id'')
            BEGIN
                SET @sql = N''ALTER TABLE dbo.'' + QUOTENAME(@name) + N'' ADD CONSTRAINT '' + QUOTENAME(N''DF_school_'' + @name)
                    + N'' DEFAULT ('' + CAST(@school AS NVARCHAR(12)) + N'') FOR school_id;'';
                EXEC sp_executesql @sql;
            END;
            SET @sql = N''UPDATE dbo.'' + QUOTENAME(@name) + N'' SET school_id = @school WHERE school_id IS NULL;'';
            EXEC sp_executesql @sql, N''@school INT'', @school = @school;
        END;
        FETCH NEXT FROM c INTO @name;
    END;
    CLOSE c; DEALLOCATE c;
END');

EXEC dbo.lms_apply_single_school_defaults;
