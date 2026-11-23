-- Classes a discipline master looks after. Additive: one new table.
-- A discipline-master duty with no rows here keeps school-wide oversight (how the duty worked before).
-- With rows, the discipline master reviews, corrects and justifies attendance only for those classes.

IF OBJECT_ID('dbo.staff_duty_classes', 'U') IS NULL
CREATE TABLE dbo.staff_duty_classes (
    duty_id    INT       NOT NULL CONSTRAINT FK_staff_duty_classes_duty REFERENCES dbo.staff_duties(id) ON DELETE CASCADE,
    class_id   INT       NOT NULL CONSTRAINT FK_staff_duty_classes_class REFERENCES dbo.classes(id),
    added_by   INT       NULL,
    added_at   DATETIME2 NOT NULL CONSTRAINT DF_staff_duty_classes_added DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_staff_duty_classes PRIMARY KEY (duty_id, class_id)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_staff_duty_classes_class' AND object_id = OBJECT_ID('dbo.staff_duty_classes'))
CREATE INDEX IX_staff_duty_classes_class ON dbo.staff_duty_classes (class_id);
