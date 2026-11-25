-- School announcements shown in the notification bell. Additive: one new school table.
--
-- An administrator posts a short notice to everyone, all staff, teachers, students or parents, shown between
-- two dates. Like every school table it requires school_id, is stamped from the request's school and is
-- covered by row-level security (security.school_isolation, migration 024).

IF OBJECT_ID('dbo.school_announcements', 'U') IS NULL
CREATE TABLE dbo.school_announcements (
    id          INT IDENTITY(1,1) CONSTRAINT PK_school_announcements PRIMARY KEY,
    school_id   INT           NULL CONSTRAINT DF_school_announcements_school_session DEFAULT (CONVERT(INT, SESSION_CONTEXT(N'school_id')))
                              CONSTRAINT FK_school_announcements_school REFERENCES dbo.schools(id),
    title       NVARCHAR(150) NOT NULL,
    body        NVARCHAR(600) NULL,
    audience    VARCHAR(12)   NOT NULL CONSTRAINT CK_school_announcements_audience CHECK (audience IN ('everyone', 'staff', 'teachers', 'students', 'parents')),
    starts_on   DATE          NOT NULL,
    ends_on     DATE          NOT NULL,
    created_by  INT           NOT NULL,
    created_at  DATETIME2     NOT NULL CONSTRAINT DF_school_announcements_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_school_announcements_dates CHECK (ends_on >= starts_on),
    CONSTRAINT CK_school_announcements_school_required CHECK (school_id IS NOT NULL)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_school_announcements_school' AND object_id = OBJECT_ID('dbo.school_announcements'))
    CREATE INDEX IX_school_announcements_school ON dbo.school_announcements (school_id, ends_on, starts_on);

-- Row-level security, like the other school tables.
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'school_isolation')
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates WHERE target_object_id = OBJECT_ID(N'dbo.school_announcements'))
    EXEC (N'ALTER SECURITY POLICY security.school_isolation
        ADD FILTER PREDICATE security.fn_school_rows(school_id) ON dbo.school_announcements,
        ADD BLOCK PREDICATE security.fn_school_rows(school_id) ON dbo.school_announcements AFTER INSERT,
        ADD BLOCK PREDICATE security.fn_school_rows(school_id) ON dbo.school_announcements AFTER UPDATE;');
