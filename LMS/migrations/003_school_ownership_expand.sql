-- Expand only. NULL means unresolved, never a wildcard in future scoped repositories.
-- No inferred school assignment, global-key removal, actor guessing or legacy rewrite.
DECLARE @owned TABLE(name SYSNAME PRIMARY KEY);
INSERT @owned VALUES
    ('Admins'),('teachers'),('classes'),('subjects'),('academic_years'),('students'),
    ('student_fees'),('auxiliary_staff'),('class_subjects'),('class_subject_teachers'),
    ('class_subject_students'),('academic_year_students'),('academic_year_teachers'),
    ('exams'),('questions'),('exam_results'),('time_slots'),('subject_allocations'),
    ('subject_scores'),('timetables');
DECLARE @name SYSNAME,@statement NVARCHAR(MAX);
DECLARE owned_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM @owned ORDER BY name;
OPEN owned_cursor;
FETCH NEXT FROM owned_cursor INTO @name;
WHILE @@FETCH_STATUS=0 BEGIN
    SET @statement=N'ALTER TABLE dbo.'+QUOTENAME(@name)+N' ADD school_id INT NULL;'+
        N'ALTER TABLE dbo.'+QUOTENAME(@name)+N' ADD CONSTRAINT '+QUOTENAME(N'UQ_tenant_'+@name)+N' UNIQUE(school_id,id);'+
        N'ALTER TABLE dbo.'+QUOTENAME(@name)+N' WITH CHECK ADD CONSTRAINT '+QUOTENAME(N'FK_school_'+@name)+
        N' FOREIGN KEY(school_id) REFERENCES dbo.schools(id);';
    EXEC sys.sp_executesql @statement;
    FETCH NEXT FROM owned_cursor INTO @name;
END;
CLOSE owned_cursor;
DEALLOCATE owned_cursor;

-- Every original single-column relationship between school-owned tables gets a
-- second, same-school FK. Keep original constraints and cascade behaviour intact.
DECLARE @child SYSNAME,@parent SYSNAME,@column SYSNAME,@constraint SYSNAME;
DECLARE relation_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT child.name,parent.name,col.name,fk.name
    FROM sys.foreign_keys fk
    JOIN sys.tables child ON child.object_id=fk.parent_object_id
    JOIN sys.tables parent ON parent.object_id=fk.referenced_object_id
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id=fk.object_id
    JOIN sys.columns col ON col.object_id=child.object_id AND col.column_id=fkc.parent_column_id
    JOIN sys.columns refcol ON refcol.object_id=parent.object_id AND refcol.column_id=fkc.referenced_column_id
    WHERE child.schema_id=SCHEMA_ID(N'dbo') AND parent.schema_id=SCHEMA_ID(N'dbo')
        AND child.name IN (SELECT name FROM @owned) AND parent.name IN (SELECT name FROM @owned)
        AND refcol.name='id' AND fk.name NOT LIKE 'TENANT[_]%'
        AND (SELECT COUNT(*) FROM sys.foreign_key_columns allcols WHERE allcols.constraint_object_id=fk.object_id)=1
    ORDER BY child.name,fk.name;
OPEN relation_cursor;
FETCH NEXT FROM relation_cursor INTO @child,@parent,@column,@constraint;
WHILE @@FETCH_STATUS=0 BEGIN
    SET @statement=N'ALTER TABLE dbo.'+QUOTENAME(@child)+N' WITH CHECK ADD CONSTRAINT '+QUOTENAME(N'TENANT_'+@constraint)+
        N' FOREIGN KEY(school_id,'+QUOTENAME(@column)+N') REFERENCES dbo.'+QUOTENAME(@parent)+N'(school_id,id);';
    EXEC sys.sp_executesql @statement;
    FETCH NEXT FROM relation_cursor INTO @child,@parent,@column,@constraint;
END;
CLOSE relation_cursor;
DEALLOCATE relation_cursor;
