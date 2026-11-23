-- Sequence marks are always out of 20 (Cameroon secondary grading).
-- Converts existing marks to /20 (score x 20 / max_score, 2 decimals), makes 20 the default maximum, and
-- enforces 0 <= score <= 20 with max_score = 20 in the database. Mark history values are converted too.

IF EXISTS (SELECT 1 FROM dbo.subject_score_history WHERE old_score > 20 OR new_score > 20)
AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ss_score_out_of_20')
UPDATE h SET
    old_score = CASE WHEN h.old_score IS NULL THEN NULL ELSE ROUND(h.old_score * 20.0 / NULLIF(s.max_score, 0), 2) END,
    new_score = CASE WHEN h.new_score IS NULL THEN NULL ELSE ROUND(h.new_score * 20.0 / NULLIF(s.max_score, 0), 2) END
FROM dbo.subject_score_history h JOIN dbo.subject_scores s ON s.id = h.score_id
WHERE s.max_score <> 20 AND s.max_score > 0;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ss_score_out_of_20')
UPDATE dbo.subject_scores SET score = ROUND(score * 20.0 / max_score, 2), max_score = 20, updated_at = SYSUTCDATETIME()
WHERE max_score <> 20 AND max_score > 0;

-- Default maximum: 20 (the constraint name was generated, so it is looked up).
DECLARE @default sysname = (SELECT dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.subject_scores') AND c.name = 'max_score');
IF @default IS NOT NULL AND @default <> 'DF_subject_scores_max_score'
    EXEC(N'ALTER TABLE dbo.subject_scores DROP CONSTRAINT ' + @default);
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_subject_scores_max_score')
    ALTER TABLE dbo.subject_scores ADD CONSTRAINT DF_subject_scores_max_score DEFAULT 20 FOR max_score;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ss_score_out_of_20')
    ALTER TABLE dbo.subject_scores WITH CHECK ADD CONSTRAINT CK_ss_score_out_of_20 CHECK (max_score = 20 AND score >= 0 AND score <= 20);
