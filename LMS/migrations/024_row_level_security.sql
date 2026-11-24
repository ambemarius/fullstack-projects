-- School data isolation, lock 3 (KodoSchool_school_data_isolation_build_plan.md, task 5, on SQL Server).
--
-- SQL Server itself separates schools. On every school table (the ones migration 021 made require school_id):
--   FILTER predicate   reads, updates and deletes only see rows of the school in SESSION_CONTEXT('school_id')
--   BLOCK predicates   a row cannot be inserted, or changed, to belong to another school
-- The app sets SESSION_CONTEXT('school_id') on every query from the signed-in account (config/database.js), so
-- every request of a school's administrator, teacher, parent, student or staff member works inside that school
-- only, even if a query forgets its school filter or asks for another school's record by id.
--
-- Phase: when no school is set (sign-in pages before the account is known, the KodoSchool platform console,
-- migrations and maintenance scripts) rows are not filtered, as before. Making "no school" return no rows comes
-- once those tools all set a school.

IF SCHEMA_ID(N'security') IS NULL EXEC (N'CREATE SCHEMA security AUTHORIZATION dbo;');

IF OBJECT_ID(N'security.fn_school_rows', N'IF') IS NULL
    EXEC (N'CREATE FUNCTION security.fn_school_rows (@school_id INT)
    RETURNS TABLE
    WITH SCHEMABINDING
    AS RETURN
        SELECT 1 AS allowed
        WHERE CONVERT(INT, SESSION_CONTEXT(N''school_id'')) IS NULL
           OR @school_id = CONVERT(INT, SESSION_CONTEXT(N''school_id''));');

IF NOT EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'school_isolation')
BEGIN
    DECLARE @predicates NVARCHAR(MAX);
    -- every table on which migration 021 made school_id required
    SELECT @predicates = STRING_AGG(CONVERT(NVARCHAR(MAX),
              N'ADD FILTER PREDICATE security.fn_school_rows(school_id) ON dbo.' + QUOTENAME(t.name)
            + N', ADD BLOCK PREDICATE security.fn_school_rows(school_id) ON dbo.' + QUOTENAME(t.name) + N' AFTER INSERT'
            + N', ADD BLOCK PREDICATE security.fn_school_rows(school_id) ON dbo.' + QUOTENAME(t.name) + N' AFTER UPDATE'), N', ')
           WITHIN GROUP (ORDER BY t.name)
    FROM sys.tables t
    WHERE EXISTS (SELECT 1 FROM sys.check_constraints c WHERE c.parent_object_id = t.object_id AND c.name = N'CK_' + t.name + N'_school_required');

    IF @predicates IS NULL THROW 51024, N'No school tables found: run migration 021 first.', 1;

    DECLARE @q NVARCHAR(MAX) = N'CREATE SECURITY POLICY security.school_isolation ' + @predicates + N' WITH (STATE = ON, SCHEMABINDING = ON);';
    EXEC sys.sp_executesql @q;
END
