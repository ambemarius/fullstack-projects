-- Existing teacher links have unknown years; never infer one from current school settings.
ALTER TABLE dbo.class_subject_teachers ADD academic_year_id INT NULL,
    assignment_status VARCHAR(10) NOT NULL CONSTRAINT DF_assignment_status DEFAULT 'active',
    link_version INT NOT NULL CONSTRAINT DF_assignment_version DEFAULT 1;
ALTER TABLE dbo.class_subject_students ADD
    enrolment_status VARCHAR(10) NOT NULL CONSTRAINT DF_enrolment_status DEFAULT 'active',
    link_version INT NOT NULL CONSTRAINT DF_enrolment_version DEFAULT 1;
ALTER TABLE dbo.class_subject_teachers DROP CONSTRAINT UQ_cst;
EXEC(N'ALTER TABLE dbo.class_subject_teachers ADD CONSTRAINT UQ_cst_year UNIQUE(class_subject_id,teacher_id,term,academic_year_id);
ALTER TABLE dbo.class_subject_teachers WITH CHECK ADD CONSTRAINT FK_assignment_year FOREIGN KEY(academic_year_id) REFERENCES dbo.academic_years(id);
ALTER TABLE dbo.class_subject_teachers WITH CHECK ADD CONSTRAINT TENANT_FK_assignment_year FOREIGN KEY(school_id,academic_year_id) REFERENCES dbo.academic_years(school_id,id);
ALTER TABLE dbo.class_subject_teachers ADD CONSTRAINT CK_assignment_status CHECK(assignment_status IN (''active'',''revoked'')),CONSTRAINT CK_assignment_version CHECK(link_version>0);
ALTER TABLE dbo.class_subject_students ADD CONSTRAINT CK_enrolment_status CHECK(enrolment_status IN (''active'',''revoked'')),CONSTRAINT CK_enrolment_version CHECK(link_version>0);');
