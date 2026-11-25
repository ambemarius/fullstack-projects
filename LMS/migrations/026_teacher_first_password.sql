-- First sign-in password change for teachers. Additive: one column.
--   must_change_password = 1 when the administration sets the password (registration or password recovery);
--   the teacher must choose their own password before using KodoSchool, then it goes back to 0.
-- Existing teachers keep 0 (nothing changes for them until their password is set again by the administration).

IF COL_LENGTH('dbo.teachers', 'must_change_password') IS NULL
    ALTER TABLE dbo.teachers ADD must_change_password BIT NOT NULL CONSTRAINT DF_teachers_must_change_password DEFAULT 0;
