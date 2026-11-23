-- Reviewed synthetic expand: retain unresolved-row uniqueness; scope resolved business keys.
-- Canonical accounts remain globally unique. No ownership or actor backfill is inferred.
DECLARE @keys TABLE(table_name SYSNAME,column_name SYSNAME);
INSERT @keys VALUES('Admins','email'),('teachers','email'),('students','matricule'),('auxiliary_staff','email'),
    ('subjects','code'),('academic_years','name');
DECLARE @table SYSNAME,@column SYSNAME,@constraint SYSNAME,@statement NVARCHAR(MAX);
DECLARE key_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT table_name,column_name FROM @keys ORDER BY table_name;
OPEN key_cursor;FETCH NEXT FROM key_cursor INTO @table,@column;
WHILE @@FETCH_STATUS=0 BEGIN
    SET @constraint=NULL;
    SELECT @constraint=kc.name FROM sys.key_constraints kc
    JOIN sys.tables t ON t.object_id=kc.parent_object_id
    JOIN sys.index_columns ic ON ic.object_id=t.object_id AND ic.index_id=kc.unique_index_id AND ic.key_ordinal=1
    JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=ic.column_id
    WHERE t.schema_id=SCHEMA_ID('dbo') AND t.name=@table AND kc.type='UQ' AND c.name=@column
        AND (SELECT COUNT(*) FROM sys.index_columns allcols WHERE allcols.object_id=t.object_id
            AND allcols.index_id=kc.unique_index_id AND allcols.key_ordinal>0)=1;
    IF @constraint IS NULL THROW 50030,'Expected original business key missing; review schema',1;
    SET @statement=N'ALTER TABLE dbo.'+QUOTENAME(@table)+N' DROP CONSTRAINT '+QUOTENAME(@constraint)+N';'+
        N'CREATE UNIQUE INDEX '+QUOTENAME('UX_school_'+@table+'_'+@column)+N' ON dbo.'+QUOTENAME(@table)+N'(school_id,'+QUOTENAME(@column)+N') WHERE school_id IS NOT NULL;'+
        N'CREATE UNIQUE INDEX '+QUOTENAME('UX_unresolved_'+@table+'_'+@column)+N' ON dbo.'+QUOTENAME(@table)+N'('+QUOTENAME(@column)+N') WHERE school_id IS NULL;';
    EXEC sys.sp_executesql @statement;
    FETCH NEXT FROM key_cursor INTO @table,@column;
END;
CLOSE key_cursor;DEALLOCATE key_cursor;
ALTER TABLE dbo.classes DROP CONSTRAINT UQ_class;
CREATE UNIQUE INDEX UX_class_school ON dbo.classes(school_id,section,name,stream) WHERE school_id IS NOT NULL;
CREATE UNIQUE INDEX UX_class_unresolved ON dbo.classes(section,name,stream) WHERE school_id IS NULL;
DROP INDEX UX_academic_year_current ON dbo.academic_years;
-- Preserve the old index name for the unresolved compatibility check in legacy model DDL.
CREATE UNIQUE INDEX UX_academic_year_current ON dbo.academic_years(isCurrent) WHERE isCurrent=1 AND school_id IS NULL;
CREATE UNIQUE INDEX UX_academic_year_current_school ON dbo.academic_years(school_id) WHERE isCurrent=1 AND school_id IS NOT NULL;

ALTER TABLE dbo.academic_years ALTER COLUMN createdBy INT NULL;
ALTER TABLE dbo.academic_years ADD created_by_account_id INT NULL,setup_version INT NOT NULL CONSTRAINT DF_year_setup_version DEFAULT 1;
ALTER TABLE dbo.classes ADD setup_version INT NOT NULL CONSTRAINT DF_class_setup_version DEFAULT 1;
ALTER TABLE dbo.subjects ADD setup_version INT NOT NULL CONSTRAINT DF_subject_setup_version DEFAULT 1;
EXEC(N'ALTER TABLE dbo.academic_years WITH CHECK ADD CONSTRAINT FK_year_canonical_creator
    FOREIGN KEY(school_id,created_by_account_id) REFERENCES dbo.school_memberships(school_id,account_id);
ALTER TABLE dbo.academic_years WITH CHECK ADD CONSTRAINT CK_year_creator CHECK(createdBy IS NOT NULL OR created_by_account_id IS NOT NULL);
ALTER TABLE dbo.academic_years ADD CONSTRAINT CK_year_setup_version CHECK(setup_version>0);
ALTER TABLE dbo.classes ADD CONSTRAINT CK_class_setup_version CHECK(setup_version>0);
ALTER TABLE dbo.subjects ADD CONSTRAINT CK_subject_setup_version CHECK(setup_version>0);');
