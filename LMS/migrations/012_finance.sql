-- Financial management (ported from the staged 016 draft for the single application).
-- Append-only ledger: charges, payments, reversals and cancellations are never updated or deleted.
-- Actors are recorded as (actor_type, actor_id): an administrator, or a teacher / auxiliary
-- staff member holding the bursar duty (see staff_duties).

IF OBJECT_ID('dbo.finance_charges', 'U') IS NULL
CREATE TABLE dbo.finance_charges (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    school_id    INT NOT NULL,
    student_id   INT NOT NULL,
    year_id      INT NOT NULL,
    description  NVARCHAR(120) NOT NULL,
    amount       BIGINT NOT NULL,
    currency     CHAR(3) NOT NULL DEFAULT 'XAF',
    due_date     DATE NULL,
    actor_type   NVARCHAR(20) NOT NULL,
    actor_id     INT NOT NULL,
    operation_id UNIQUEIDENTIFIER NOT NULL,
    source       NVARCHAR(30) NULL,
    created_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_finance_charges_tenant UNIQUE (school_id, id),
    CONSTRAINT UQ_finance_charges_operation UNIQUE (school_id, actor_type, actor_id, operation_id),
    CONSTRAINT CK_finance_charges_amount CHECK (amount > 0),
    CONSTRAINT CK_finance_charges_currency CHECK (currency = 'XAF'),
    CONSTRAINT CK_finance_charges_actor CHECK (actor_type IN ('admin', 'teacher', 'auxiliary')),
    CONSTRAINT FK_finance_charges_student FOREIGN KEY (school_id, student_id) REFERENCES dbo.students(school_id, id),
    CONSTRAINT FK_finance_charges_year FOREIGN KEY (school_id, year_id) REFERENCES dbo.academic_years(school_id, id)
);

IF OBJECT_ID('dbo.finance_payments', 'U') IS NULL
CREATE TABLE dbo.finance_payments (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    school_id    INT NOT NULL,
    charge_id    INT NOT NULL,
    amount       BIGINT NOT NULL,
    paid_on      DATE NOT NULL,
    method       VARCHAR(12) NOT NULL,
    reference    NVARCHAR(100) NOT NULL,
    actor_type   NVARCHAR(20) NOT NULL,
    actor_id     INT NOT NULL,
    operation_id UNIQUEIDENTIFIER NOT NULL,
    created_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_finance_payments_tenant UNIQUE (school_id, id),
    CONSTRAINT UQ_finance_payments_operation UNIQUE (school_id, actor_type, actor_id, operation_id),
    CONSTRAINT CK_finance_payments_amount CHECK (amount > 0),
    CONSTRAINT CK_finance_payments_method CHECK (method IN ('cash', 'bank', 'mobile', 'other')),
    CONSTRAINT CK_finance_payments_actor CHECK (actor_type IN ('admin', 'teacher', 'auxiliary')),
    CONSTRAINT FK_finance_payments_charge FOREIGN KEY (school_id, charge_id) REFERENCES dbo.finance_charges(school_id, id)
);

IF OBJECT_ID('dbo.finance_reversals', 'U') IS NULL
CREATE TABLE dbo.finance_reversals (
    school_id  INT NOT NULL,
    payment_id INT NOT NULL,
    reason     NVARCHAR(300) NOT NULL,
    actor_type NVARCHAR(20) NOT NULL,
    actor_id   INT NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_finance_reversals PRIMARY KEY (school_id, payment_id),
    CONSTRAINT CK_finance_reversals_reason CHECK (LEN(LTRIM(RTRIM(reason))) > 0),
    CONSTRAINT CK_finance_reversals_actor CHECK (actor_type IN ('admin', 'teacher', 'auxiliary')),
    CONSTRAINT FK_finance_reversals_payment FOREIGN KEY (school_id, payment_id) REFERENCES dbo.finance_payments(school_id, id)
);

IF OBJECT_ID('dbo.finance_cancellations', 'U') IS NULL
CREATE TABLE dbo.finance_cancellations (
    school_id  INT NOT NULL,
    charge_id  INT NOT NULL,
    reason     NVARCHAR(300) NOT NULL,
    actor_type NVARCHAR(20) NOT NULL,
    actor_id   INT NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_finance_cancellations PRIMARY KEY (school_id, charge_id),
    CONSTRAINT CK_finance_cancellations_reason CHECK (LEN(LTRIM(RTRIM(reason))) > 0),
    CONSTRAINT CK_finance_cancellations_actor CHECK (actor_type IN ('admin', 'teacher', 'auxiliary')),
    CONSTRAINT FK_finance_cancellations_charge FOREIGN KEY (school_id, charge_id) REFERENCES dbo.finance_charges(school_id, id)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_finance_charge_student' AND object_id = OBJECT_ID('dbo.finance_charges'))
CREATE INDEX IX_finance_charge_student ON dbo.finance_charges(school_id, student_id, year_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_finance_payment_charge' AND object_id = OBJECT_ID('dbo.finance_payments'))
CREATE INDEX IX_finance_payment_charge ON dbo.finance_payments(school_id, charge_id) INCLUDE (amount);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_finance_payment_date' AND object_id = OBJECT_ID('dbo.finance_payments'))
CREATE INDEX IX_finance_payment_date ON dbo.finance_payments(school_id, paid_on);
