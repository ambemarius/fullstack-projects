-- No ownership or account backfill is performed by schema installation.
CREATE TABLE dbo.ownership_reconciliation_runs (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES dbo.schools(id),
    actor_account_id INT NOT NULL REFERENCES dbo.accounts(id),
    attestation_ref NVARCHAR(100) NOT NULL,
    plan_hash CHAR(64) NOT NULL UNIQUE,
    record_count INT NOT NULL CHECK (record_count > 0),
    mapped_account_count INT NOT NULL CHECK (mapped_account_count >= 0),
    completed_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_reconciliation_school_run UNIQUE (school_id,id)
);
CREATE TABLE dbo.ownership_reconciliation_items (
    school_id INT NOT NULL,
    run_id UNIQUEIDENTIFIER NOT NULL,
    source_table VARCHAR(40) NOT NULL,
    legacy_id INT NOT NULL CHECK (legacy_id > 0),
    source_fingerprint CHAR(64) NOT NULL,
    PRIMARY KEY (run_id,source_table,legacy_id),
    CHECK (source_table IN ('Admins','teachers','classes','subjects','academic_years','students',
        'student_fees','auxiliary_staff','class_subjects','class_subject_teachers','class_subject_students',
        'academic_year_students','academic_year_teachers','exams','questions','exam_results','time_slots',
        'subject_allocations','subject_scores','timetables')),
    FOREIGN KEY (school_id,run_id) REFERENCES dbo.ownership_reconciliation_runs(school_id,id)
);
