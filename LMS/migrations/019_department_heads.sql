-- Head of Department: the subject and section a head-of-department duty covers. Additive: one new table.
-- section NULL = both sections (the whole school).

IF OBJECT_ID('dbo.staff_duty_departments', 'U') IS NULL
CREATE TABLE dbo.staff_duty_departments (
    duty_id    INT          NOT NULL CONSTRAINT PK_staff_duty_departments PRIMARY KEY
                            CONSTRAINT FK_staff_duty_departments_duty REFERENCES dbo.staff_duties(id) ON DELETE CASCADE,
    subject_id INT          NOT NULL CONSTRAINT FK_staff_duty_departments_subject REFERENCES dbo.subjects(id),
    section    NVARCHAR(20) NULL CONSTRAINT CK_staff_duty_departments_section CHECK (section IN ('Anglophone', 'Francophone')),
    set_by     INT          NULL,
    set_at     DATETIME2    NOT NULL CONSTRAINT DF_staff_duty_departments_set DEFAULT SYSUTCDATETIME()
);

-- Allow the new duty name (the list is otherwise unchanged).
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_staff_duties_duty' AND parent_object_id = OBJECT_ID('dbo.staff_duties'))
    ALTER TABLE dbo.staff_duties DROP CONSTRAINT CK_staff_duties_duty;
ALTER TABLE dbo.staff_duties WITH CHECK ADD CONSTRAINT CK_staff_duties_duty
    CHECK (duty IN ('bursar', 'librarian', 'lab_attendant', 'discipline_master', 'head_of_department'));
