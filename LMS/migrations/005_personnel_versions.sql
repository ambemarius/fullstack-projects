-- Additive support for scoped personnel writes; no profile/status backfill.
ALTER TABLE dbo.students ADD profile_version INT NOT NULL CONSTRAINT DF_student_profile_version DEFAULT 1
    CONSTRAINT CK_student_profile_version CHECK(profile_version>0);
ALTER TABLE dbo.teachers ADD profile_version INT NOT NULL CONSTRAINT DF_teacher_profile_version DEFAULT 1
    CONSTRAINT CK_teacher_profile_version CHECK(profile_version>0);
ALTER TABLE dbo.identity_audit_events ADD
    reason_code VARCHAR(40) NULL,
    resource_version_before INT NULL,
    resource_version_after INT NULL,
    changed_fields NVARCHAR(500) NULL;
-- Compile only after the new column exists; migration files execute as one batch.
EXEC(N'ALTER TABLE dbo.identity_audit_events ADD CONSTRAINT CK_identity_audit_reason CHECK(reason_code IN
    (''registration'',''profile_correction'',''administrative'',''withdrawal'',''return_to_school'',''employment_change''));');
