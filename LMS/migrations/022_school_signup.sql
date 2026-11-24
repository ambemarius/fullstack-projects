-- School sign-up from the public site, validated by KodoSchool staff. Additive: two new tables.
--
-- school_signup_requests  one row per sign-up: the school (name, language system, address, region, division),
--                         its super administrator (name, phone, email, function, password hash) and the review.
--                         On approval the school and its administrator are created; activated_school_id points at it.
-- platform_staff          administrators who work for KodoSchool and may review sign-ups (empty until granted).
--
-- Platform tables: no school_id column (the request exists before its school does).

IF OBJECT_ID('dbo.school_signup_requests', 'U') IS NULL
CREATE TABLE dbo.school_signup_requests (
    id                   INT IDENTITY(1,1) CONSTRAINT PK_school_signup_requests PRIMARY KEY,
    reference            NVARCHAR(20)  NOT NULL CONSTRAINT UQ_school_signup_reference UNIQUE,
    school_name          NVARCHAR(200) NOT NULL,
    education_system     VARCHAR(20)   NOT NULL CONSTRAINT CK_school_signup_system CHECK (education_system IN ('Anglophone', 'Francophone', 'Bilingual')),
    address              NVARCHAR(255) NOT NULL,
    region_id            INT           NOT NULL CONSTRAINT FK_school_signup_region REFERENCES dbo.regions(id),
    division_id          INT           NOT NULL CONSTRAINT FK_school_signup_division REFERENCES dbo.divisions(id),
    proposed_code        NVARCHAR(50)  NOT NULL,
    admin_name           NVARCHAR(200) NOT NULL,
    admin_phone          NVARCHAR(20)  NOT NULL,
    admin_email          NVARCHAR(255) NOT NULL,
    admin_function       NVARCHAR(80)  NOT NULL,
    admin_password_hash  NVARCHAR(255) NOT NULL,
    status               VARCHAR(12)   NOT NULL CONSTRAINT DF_school_signup_status DEFAULT 'pending'
                                       CONSTRAINT CK_school_signup_status CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at           DATETIME2     NOT NULL CONSTRAINT DF_school_signup_created DEFAULT SYSUTCDATETIME(),
    request_ip           NVARCHAR(45)  NULL,
    reviewed_by          INT           NULL,
    reviewed_at          DATETIME2     NULL,
    review_note          NVARCHAR(500) NULL,
    activated_school_id  INT           NULL CONSTRAINT FK_school_signup_school REFERENCES dbo.schools(id)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_school_signup_status' AND object_id = OBJECT_ID('dbo.school_signup_requests'))
    CREATE INDEX IX_school_signup_status ON dbo.school_signup_requests (status, created_at);
-- A school code is reserved while its request is pending.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_school_signup_pending_code' AND object_id = OBJECT_ID('dbo.school_signup_requests'))
    CREATE UNIQUE INDEX UX_school_signup_pending_code ON dbo.school_signup_requests (proposed_code) WHERE status = 'pending';

IF OBJECT_ID('dbo.platform_staff', 'U') IS NULL
CREATE TABLE dbo.platform_staff (
    admin_id    INT       NOT NULL CONSTRAINT PK_platform_staff PRIMARY KEY CONSTRAINT FK_platform_staff_admin REFERENCES dbo.Admins(id),
    granted_by  INT       NULL,
    granted_at  DATETIME2 NOT NULL CONSTRAINT DF_platform_staff_granted DEFAULT SYSUTCDATETIME()
);
