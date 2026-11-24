-- School data isolation, foundation (KodoSchool_school_data_isolation_build_plan.md, tasks 1-3, on SQL Server).
--
-- 1. school_id is added to the school tables that lacked it, filled from the row each one belongs to:
--    parent_students (student), subject_score_history (class subject), staff_duty_classes and
--    staff_duty_departments (duty), notifications (the only school).
-- 2. On every school table, school_id is required (CHECK school_id IS NOT NULL), has an index that starts with
--    it and a foreign key to schools. Existing indexes and keys are left as they are.
-- 3. New rows are stamped with the request's school: DEFAULT SESSION_CONTEXT('school_id') replaces the fixed
--    DEFAULT 1. The app sets SESSION_CONTEXT on every query (config/database.js); an insert that leaves
--    school_id out while no school is set now fails instead of landing in school 1.
-- 4. A parent's phone and email are unique within a school, not across the platform.
--
-- Rows that still have no school are given the only school; with more than one school the migration stops.
-- Identity and platform bookkeeping tables (accounts, memberships, invitations, legacy maps, reconciliation runs,
-- audit events) keep their own rules. Row-level security (task 5) comes in a later migration.

DECLARE @only INT = (SELECT CASE WHEN COUNT(*) = 1 THEN MIN(id) END FROM dbo.schools);

-- ---------------------------------------------------------------- 1. tables that lacked school_id
IF COL_LENGTH('dbo.parent_students', 'school_id') IS NULL ALTER TABLE dbo.parent_students ADD school_id INT NULL;
IF COL_LENGTH('dbo.subject_score_history', 'school_id') IS NULL ALTER TABLE dbo.subject_score_history ADD school_id INT NULL;
IF COL_LENGTH('dbo.staff_duty_classes', 'school_id') IS NULL ALTER TABLE dbo.staff_duty_classes ADD school_id INT NULL;
IF COL_LENGTH('dbo.staff_duty_departments', 'school_id') IS NULL ALTER TABLE dbo.staff_duty_departments ADD school_id INT NULL;
IF COL_LENGTH('dbo.notifications', 'school_id') IS NULL ALTER TABLE dbo.notifications ADD school_id INT NULL;

EXEC (N'UPDATE ps SET school_id = s.school_id FROM dbo.parent_students ps JOIN dbo.students s ON s.id = ps.student_id WHERE ps.school_id IS NULL;');
EXEC (N'UPDATE h SET school_id = cs.school_id FROM dbo.subject_score_history h JOIN dbo.class_subjects cs ON cs.id = h.class_subject_id WHERE h.school_id IS NULL;');
EXEC (N'UPDATE c SET school_id = d.school_id FROM dbo.staff_duty_classes c JOIN dbo.staff_duties d ON d.id = c.duty_id WHERE c.school_id IS NULL;');
EXEC (N'UPDATE x SET school_id = d.school_id FROM dbo.staff_duty_departments x JOIN dbo.staff_duties d ON d.id = x.duty_id WHERE x.school_id IS NULL;');

-- ---------------------------------------------------------------- 2-3. every school table
DECLARE @skip TABLE (name SYSNAME PRIMARY KEY);
INSERT INTO @skip (name) VALUES (N'schools'), (N'identity_audit_events'), (N'legacy_account_map'), (N'legacy_adoption_runs'),
    (N'membership_roles'), (N'ownership_reconciliation_items'), (N'ownership_reconciliation_runs'), (N'school_invitations'),
    (N'school_memberships'), (N'staff_profile_links');

DECLARE @t SYSNAME, @q NVARCHAR(MAX), @df SYSNAME;
DECLARE school_tables CURSOR LOCAL FAST_FORWARD FOR
    SELECT t.name FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
    WHERE c.name = N'school_id' AND t.is_ms_shipped = 0 AND SCHEMA_NAME(t.schema_id) = N'dbo' AND t.name NOT IN (SELECT name FROM @skip)
    ORDER BY t.name;
OPEN school_tables;
FETCH NEXT FROM school_tables INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    -- rows without a school: only the single existing school can own them
    SET @q = N'IF EXISTS (SELECT 1 FROM dbo.' + QUOTENAME(@t) + N' WHERE school_id IS NULL)
               BEGIN
                   IF @only IS NULL THROW 51021, N''Rows without a school cannot be assigned while several schools exist.'', 1;
                   UPDATE dbo.' + QUOTENAME(@t) + N' SET school_id = @only WHERE school_id IS NULL;
               END';
    EXEC sys.sp_executesql @q, N'@only INT', @only = @only;

    -- required
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.' + @t) AND name = N'CK_' + @t + N'_school_required')
        BEGIN SET @q = N'ALTER TABLE dbo.' + QUOTENAME(@t) + N' WITH CHECK ADD CONSTRAINT ' + QUOTENAME(N'CK_' + @t + N'_school_required') + N' CHECK (school_id IS NOT NULL);'; EXEC sys.sp_executesql @q; END

    -- stamped from the request's school instead of a fixed school
    SET @df = (SELECT dc.name FROM sys.default_constraints dc
               JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
               WHERE dc.parent_object_id = OBJECT_ID(N'dbo.' + @t) AND c.name = N'school_id');
    IF @df IS NOT NULL AND @df <> N'DF_' + @t + N'_school_session'
        BEGIN SET @q = N'ALTER TABLE dbo.' + QUOTENAME(@t) + N' DROP CONSTRAINT ' + QUOTENAME(@df) + N';'; EXEC sys.sp_executesql @q; END
    IF @df IS NULL OR @df <> N'DF_' + @t + N'_school_session'
        BEGIN SET @q = N'ALTER TABLE dbo.' + QUOTENAME(@t) + N' ADD CONSTRAINT ' + QUOTENAME(N'DF_' + @t + N'_school_session')
              + N' DEFAULT (CONVERT(INT, SESSION_CONTEXT(N''school_id''))) FOR school_id;'; EXEC sys.sp_executesql @q; END

    -- an index that starts with school_id
    IF NOT EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                   WHERE ic.object_id = OBJECT_ID(N'dbo.' + @t) AND c.name = N'school_id' AND ic.key_ordinal = 1)
        BEGIN SET @q = N'CREATE INDEX ' + QUOTENAME(N'IX_' + @t + N'_school') + N' ON dbo.' + QUOTENAME(@t) + N' (school_id);'; EXEC sys.sp_executesql @q; END

    -- a foreign key to schools
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_key_columns f JOIN sys.columns c ON c.object_id = f.parent_object_id AND c.column_id = f.parent_column_id
                   WHERE f.parent_object_id = OBJECT_ID(N'dbo.' + @t) AND c.name = N'school_id' AND f.referenced_object_id = OBJECT_ID(N'dbo.schools'))
        BEGIN SET @q = N'ALTER TABLE dbo.' + QUOTENAME(@t) + N' WITH CHECK ADD CONSTRAINT ' + QUOTENAME(N'FK_' + @t + N'_school') + N' FOREIGN KEY (school_id) REFERENCES dbo.schools(id);'; EXEC sys.sp_executesql @q; END

    FETCH NEXT FROM school_tables INTO @t;
END
CLOSE school_tables;
DEALLOCATE school_tables;

-- ---------------------------------------------------------------- 4. parents: unique within a school
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'UQ_parents_phone' AND parent_object_id = OBJECT_ID(N'dbo.parents'))
    ALTER TABLE dbo.parents DROP CONSTRAINT UQ_parents_phone;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_parents_email' AND object_id = OBJECT_ID(N'dbo.parents'))
    DROP INDEX UX_parents_email ON dbo.parents;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_parents_school_phone' AND object_id = OBJECT_ID(N'dbo.parents'))
    CREATE UNIQUE INDEX UX_parents_school_phone ON dbo.parents (school_id, phone) WHERE phone IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_parents_school_email' AND object_id = OBJECT_ID(N'dbo.parents'))
    CREATE UNIQUE INDEX UX_parents_school_email ON dbo.parents (school_id, email) WHERE email IS NOT NULL;
