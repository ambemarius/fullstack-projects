-- Expand only: no legacy backfill, default school, platform grant or runtime activation.
CREATE TABLE dbo.schools (
    id INT IDENTITY PRIMARY KEY,
    code NVARCHAR(50) NOT NULL UNIQUE,
    name NVARCHAR(200) NOT NULL,
    education_system VARCHAR(20) NOT NULL CHECK (education_system IN ('Anglophone','Francophone','Bilingual')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','closed')),
    timezone NVARCHAR(100) NOT NULL DEFAULT 'Africa/Douala',
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE TABLE dbo.accounts (
    id INT IDENTITY PRIMARY KEY,
    -- Namespaced canonical identifier; legacy emails/IDs are never auto-merged.
    login_key NVARCHAR(255) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','disabled')),
    security_version INT NOT NULL DEFAULT 1 CHECK (security_version > 0),
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE TABLE dbo.school_memberships (
    id INT IDENTITY PRIMARY KEY,
    school_id INT NOT NULL REFERENCES dbo.schools(id),
    account_id INT NOT NULL REFERENCES dbo.accounts(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_membership_school_account UNIQUE (school_id,account_id),
    CONSTRAINT UQ_membership_school_id UNIQUE (school_id,id),
    CONSTRAINT UQ_membership_account_id UNIQUE (account_id,id),
    CONSTRAINT UQ_membership_actor UNIQUE (school_id,id,account_id)
);
CREATE TABLE dbo.membership_roles (
    school_id INT NOT NULL,
    membership_id INT NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('admin','teacher','student','discipline_master','librarian','lab_attendant')),
    PRIMARY KEY (school_id,membership_id,role),
    FOREIGN KEY (school_id,membership_id) REFERENCES dbo.school_memberships(school_id,id)
);
CREATE TABLE dbo.legacy_account_map (
    source_table VARCHAR(20) NOT NULL CHECK (source_table IN ('Admins','teachers','students')),
    legacy_id INT NOT NULL CHECK (legacy_id > 0),
    account_id INT NOT NULL,
    school_id INT NOT NULL,
    membership_id INT NOT NULL,
    reconciliation_status VARCHAR(20) NOT NULL CHECK (reconciliation_status IN ('pending','verified')),
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    PRIMARY KEY (source_table,legacy_id),
    CONSTRAINT UQ_legacy_map_account UNIQUE (account_id),
    FOREIGN KEY (school_id,membership_id,account_id) REFERENCES dbo.school_memberships(school_id,id,account_id)
);
CREATE TABLE dbo.platform_role_grants (
    account_id INT NOT NULL REFERENCES dbo.accounts(id),
    permission VARCHAR(40) NOT NULL CHECK (permission IN ('school_onboarding','platform_operator')),
    granted_by INT NOT NULL REFERENCES dbo.accounts(id),
    granted_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    revoked_at DATETIME2 NULL,
    PRIMARY KEY (account_id,permission)
);
CREATE TABLE dbo.account_sessions (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    account_id INT NOT NULL REFERENCES dbo.accounts(id),
    active_membership_id INT NULL,
    csrf_hash CHAR(64) NOT NULL,
    security_version INT NOT NULL CHECK (security_version > 0),
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    expires_at DATETIME2 NOT NULL,
    revoked_at DATETIME2 NULL,
    CHECK (expires_at > created_at),
    FOREIGN KEY (account_id,active_membership_id) REFERENCES dbo.school_memberships(account_id,id)
);
CREATE INDEX IX_sessions_account ON dbo.account_sessions(account_id,expires_at);
CREATE TABLE dbo.school_invitations (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES dbo.schools(id),
    invited_by INT NOT NULL REFERENCES dbo.accounts(id),
    intended_login_key NVARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('admin','teacher','student','discipline_master','librarian','lab_attendant')),
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    expires_at DATETIME2 NOT NULL,
    consumed_at DATETIME2 NULL,
    revoked_at DATETIME2 NULL,
    CHECK (expires_at > created_at)
);
CREATE TABLE dbo.identity_audit_events (
    id BIGINT IDENTITY PRIMARY KEY,
    school_id INT NULL REFERENCES dbo.schools(id),
    actor_account_id INT NOT NULL REFERENCES dbo.accounts(id),
    actor_membership_id INT NULL,
    action VARCHAR(60) NOT NULL,
    resource_type VARCHAR(40) NOT NULL,
    resource_id NVARCHAR(100) NOT NULL,
    request_id NVARCHAR(100) NOT NULL,
    occurred_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CHECK (actor_membership_id IS NULL OR school_id IS NOT NULL),
    FOREIGN KEY (school_id,actor_membership_id,actor_account_id) REFERENCES dbo.school_memberships(school_id,id,account_id)
);
CREATE INDEX IX_identity_audit_school_time ON dbo.identity_audit_events(school_id,occurred_at);
