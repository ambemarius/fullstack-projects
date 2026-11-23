-- Preserve ambiguous legacy created_by values; new writes name a verified canonical editor.
ALTER TABLE dbo.subject_scores ALTER COLUMN created_by INT NULL;
ALTER TABLE dbo.subject_scores ADD score_version INT NOT NULL CONSTRAINT DF_score_version DEFAULT 1,
    last_editor_account_id INT NULL,last_editor_membership_id INT NULL;
EXEC(N'ALTER TABLE dbo.subject_scores ADD CONSTRAINT CK_score_version CHECK(score_version>0);
ALTER TABLE dbo.subject_scores WITH CHECK ADD CONSTRAINT FK_score_canonical_editor
    FOREIGN KEY(school_id,last_editor_membership_id,last_editor_account_id) REFERENCES dbo.school_memberships(school_id,id,account_id);
ALTER TABLE dbo.subject_scores WITH CHECK ADD CONSTRAINT CK_score_editor CHECK(created_by IS NOT NULL OR
    (last_editor_account_id IS NOT NULL AND last_editor_membership_id IS NOT NULL AND school_id IS NOT NULL));');
