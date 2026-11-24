-- Report card template chosen by the school. Additive: one nullable column.
--   classic      the bilingual "STUDENT REPORT CARD | BULLETIN DE NOTES" (default when NULL)
--   anglophone   MINESEC layout in English
--   francophone  MINESEC layout in French
--   technical    MINESEC layout, bilingual, for technical schools
--   auto         anglophone for Anglophone-section classes, francophone for Francophone-section classes

IF COL_LENGTH('dbo.report_card_settings', 'card_template') IS NULL
    ALTER TABLE dbo.report_card_settings ADD card_template NVARCHAR(20) NULL
        CONSTRAINT CK_report_card_settings_template CHECK (card_template IN (N'classic', N'anglophone', N'francophone', N'technical', N'auto'));
