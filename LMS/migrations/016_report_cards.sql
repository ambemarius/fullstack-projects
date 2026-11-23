-- Printable report cards (STUDENT REPORT CARD | BULLETIN DE NOTES). Additive: new tables only.
-- Marks, coefficients, teachers, absences and fee balances are read from the existing tables; averages,
-- totals and ranks are never stored (utils/reportCardEngine.js recomputes them from subject_scores).

-- School heading printed on every card (one row per school).
IF OBJECT_ID('dbo.report_card_settings', 'U') IS NULL
CREATE TABLE dbo.report_card_settings (
    school_id       INT           NOT NULL CONSTRAINT PK_report_card_settings PRIMARY KEY
                                  CONSTRAINT FK_report_card_settings_school REFERENCES dbo.schools(id),
    name_en         NVARCHAR(200) NULL,
    name_fr         NVARCHAR(200) NULL,
    address_line    NVARCHAR(255) NULL,
    country_en      NVARCHAR(80)  NOT NULL CONSTRAINT DF_rcs_country_en DEFAULT N'REPUBLIC OF CAMEROON',
    motto_en        NVARCHAR(80)  NOT NULL CONSTRAINT DF_rcs_motto_en DEFAULT N'PEACE - WORK - FATHERLAND',
    ministry_en     NVARCHAR(120) NOT NULL CONSTRAINT DF_rcs_ministry_en DEFAULT N'MINISTRY OF SECONDARY EDUCATION',
    country_fr      NVARCHAR(80)  NOT NULL CONSTRAINT DF_rcs_country_fr DEFAULT N'RÉPUBLIQUE DU CAMEROUN',
    motto_fr        NVARCHAR(80)  NOT NULL CONSTRAINT DF_rcs_motto_fr DEFAULT N'PAIX - TRAVAIL - PATRIE',
    ministry_fr     NVARCHAR(120) NOT NULL CONSTRAINT DF_rcs_ministry_fr DEFAULT N'MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES',
    logo_file       NVARCHAR(200) NULL,   -- file name in UPLOAD_DIR
    signature_file  NVARCHAR(200) NULL,   -- scanned principal signature/stamp
    watermark_text  NVARCHAR(80)  NULL,   -- faint diagonal text behind the marks (anti-forgery)
    footer_text     NVARCHAR(255) NULL,
    updated_by      INT           NULL,
    updated_at      DATETIME2     NOT NULL CONSTRAINT DF_rcs_updated DEFAULT SYSUTCDATETIME()
);

-- "Reopening Date / Date de Réouverture" per academic year and term.
IF OBJECT_ID('dbo.report_card_terms', 'U') IS NULL
CREATE TABLE dbo.report_card_terms (
    school_id         INT          NOT NULL CONSTRAINT FK_report_card_terms_school REFERENCES dbo.schools(id),
    academic_year_id  INT          NOT NULL CONSTRAINT FK_report_card_terms_year REFERENCES dbo.academic_years(id),
    term              NVARCHAR(10) NOT NULL CONSTRAINT CK_report_card_terms_term CHECK (term IN (N'First', N'Second', N'Third')),
    reopening_date    DATE         NULL,
    updated_by        INT          NULL,
    updated_at        DATETIME2    NOT NULL CONSTRAINT DF_rct_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_report_card_terms PRIMARY KEY (school_id, academic_year_id, term)
);

-- Subject bands printed down the left edge of the marks table (e.g. GENERAL EDUCATION, OTHER SUBS).
IF OBJECT_ID('dbo.report_card_groups', 'U') IS NULL
CREATE TABLE dbo.report_card_groups (
    id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_report_card_groups PRIMARY KEY,
    school_id      INT          NOT NULL CONSTRAINT FK_report_card_groups_school REFERENCES dbo.schools(id),
    name           NVARCHAR(80) NOT NULL,
    display_order  SMALLINT     NOT NULL CONSTRAINT DF_rcg_order DEFAULT 0,
    min_rows       SMALLINT     NOT NULL CONSTRAINT DF_rcg_min_rows DEFAULT 0
                                CONSTRAINT CK_report_card_groups_min_rows CHECK (min_rows BETWEEN 0 AND 20),
    CONSTRAINT UX_report_card_groups_name UNIQUE (school_id, name)
);

-- Which band each subject is printed in, and its order inside the band. Unassigned subjects print in a default band.
IF OBJECT_ID('dbo.report_card_group_subjects', 'U') IS NULL
CREATE TABLE dbo.report_card_group_subjects (
    school_id      INT      NOT NULL CONSTRAINT FK_rcgs_school REFERENCES dbo.schools(id),
    subject_id     INT      NOT NULL CONSTRAINT FK_rcgs_subject REFERENCES dbo.subjects(id),
    group_id       INT      NOT NULL CONSTRAINT FK_rcgs_group REFERENCES dbo.report_card_groups(id) ON DELETE CASCADE,
    display_order  SMALLINT NOT NULL CONSTRAINT DF_rcgs_order DEFAULT 0,
    CONSTRAINT PK_report_card_group_subjects PRIMARY KEY (school_id, subject_id)
);

-- Per student and term: disciplinary record, repeater flag and an optional class-council remark override.
-- Absences come from the attendance registers and the amount owing from the finance ledger.
IF OBJECT_ID('dbo.report_card_student_terms', 'U') IS NULL
CREATE TABLE dbo.report_card_student_terms (
    school_id           INT           NOT NULL CONSTRAINT FK_rcst_school REFERENCES dbo.schools(id),
    student_id          INT           NOT NULL CONSTRAINT FK_rcst_student REFERENCES dbo.students(id),
    academic_year_id    INT           NOT NULL CONSTRAINT FK_rcst_year REFERENCES dbo.academic_years(id),
    term                NVARCHAR(10)  NOT NULL CONSTRAINT CK_rcst_term CHECK (term IN (N'First', N'Second', N'Third')),
    is_repeater         BIT           NOT NULL CONSTRAINT DF_rcst_repeater DEFAULT 0,
    council_attendance  SMALLINT      NOT NULL CONSTRAINT DF_rcst_council DEFAULT 0,
    warnings            SMALLINT      NOT NULL CONSTRAINT DF_rcst_warnings DEFAULT 0,
    suspensions         SMALLINT      NOT NULL CONSTRAINT DF_rcst_suspensions DEFAULT 0,
    council_remark      NVARCHAR(120) NULL,
    updated_by          INT           NULL,
    updated_at          DATETIME2     NOT NULL CONSTRAINT DF_rcst_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_rcst_counts CHECK (council_attendance BETWEEN 0 AND 99 AND warnings BETWEEN 0 AND 99 AND suspensions BETWEEN 0 AND 99),
    CONSTRAINT PK_report_card_student_terms PRIMARY KEY (school_id, student_id, academic_year_id, term)
);
