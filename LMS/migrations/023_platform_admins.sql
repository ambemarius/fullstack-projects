-- KodoSchool's own administrators (the platform console). Additive: two new tables.
--
-- platform_admins     accounts that belong to KodoSchool, not to a school: they validate school sign-ups,
--                     follow each school's activity and can suspend or reactivate a school. They never see
--                     pupils' names, marks or payments (the console reads counts and dates only).
-- platform_audit_log  every sign-in and action taken in the console, with who did it and when.

IF OBJECT_ID('dbo.platform_admins', 'U') IS NULL
CREATE TABLE dbo.platform_admins (
    id             INT IDENTITY(1,1) CONSTRAINT PK_platform_admins PRIMARY KEY,
    name           NVARCHAR(200) NOT NULL,
    email          NVARCHAR(255) NOT NULL CONSTRAINT UQ_platform_admins_email UNIQUE,
    password       NVARCHAR(255) NOT NULL,
    status         VARCHAR(12)   NOT NULL CONSTRAINT DF_platform_admins_status DEFAULT 'active'
                                 CONSTRAINT CK_platform_admins_status CHECK (status IN ('active', 'disabled')),
    created_at     DATETIME2     NOT NULL CONSTRAINT DF_platform_admins_created DEFAULT SYSUTCDATETIME(),
    last_login_at  DATETIME2     NULL
);

IF OBJECT_ID('dbo.platform_audit_log', 'U') IS NULL
CREATE TABLE dbo.platform_audit_log (
    id                 BIGINT IDENTITY(1,1) CONSTRAINT PK_platform_audit_log PRIMARY KEY,
    platform_admin_id  INT           NULL CONSTRAINT FK_platform_audit_admin REFERENCES dbo.platform_admins(id),
    action             VARCHAR(40)   NOT NULL,
    target_type        VARCHAR(40)   NULL,
    target_id          NVARCHAR(50)  NULL,
    detail             NVARCHAR(500) NULL,
    ip                 NVARCHAR(45)  NULL,
    created_at         DATETIME2     NOT NULL CONSTRAINT DF_platform_audit_created DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_platform_audit_created' AND object_id = OBJECT_ID('dbo.platform_audit_log'))
    CREATE INDEX IX_platform_audit_created ON dbo.platform_audit_log (created_at DESC);
