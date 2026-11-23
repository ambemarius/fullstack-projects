-- Library and laboratory (ported from the staged 015 draft for the single application).
-- Library copies keep an append-only event history (checkout, renew, return, lost, damaged, repair);
-- a copy's state is its latest event. Laboratory stock is the sum of its movements.
-- People are (type, id): pupils by student id; staff as admin / teacher / auxiliary.

IF OBJECT_ID('dbo.library_copies', 'U') IS NULL
CREATE TABLE dbo.library_copies (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    school_id  INT NOT NULL,
    accession  NVARCHAR(60) NOT NULL,
    title      NVARCHAR(160) NOT NULL,
    author     NVARCHAR(120) NOT NULL,
    shelf      NVARCHAR(80) NOT NULL,
    isbn       NVARCHAR(30) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_library_copies_tenant UNIQUE (school_id, id),
    CONSTRAINT UQ_library_copies_accession UNIQUE (school_id, accession),
    CONSTRAINT FK_library_copies_school FOREIGN KEY (school_id) REFERENCES dbo.schools(id)
);

IF OBJECT_ID('dbo.library_events', 'U') IS NULL
CREATE TABLE dbo.library_events (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    school_id   INT NOT NULL,
    copy_id     INT NOT NULL,
    action      VARCHAR(12) NOT NULL,
    pupil_id    INT NULL,
    staff_type  NVARCHAR(20) NULL,
    staff_id    INT NULL,
    due_date    DATE NULL,
    note        NVARCHAR(200) NULL,
    actor_type  NVARCHAR(20) NOT NULL,
    actor_id    INT NOT NULL,
    occurred_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_library_events_action CHECK (action IN ('checkout', 'renew', 'return', 'lost', 'damaged', 'repair')),
    CONSTRAINT CK_library_events_staff CHECK ((staff_type IS NULL AND staff_id IS NULL) OR (staff_type IN ('admin', 'teacher', 'auxiliary') AND staff_id IS NOT NULL)),
    CONSTRAINT CK_library_events_loan CHECK (action NOT IN ('checkout', 'renew') OR (due_date IS NOT NULL AND
        ((pupil_id IS NULL AND staff_id IS NOT NULL) OR (pupil_id IS NOT NULL AND staff_id IS NULL)))),
    CONSTRAINT CK_library_events_actor CHECK (actor_type IN ('admin', 'teacher', 'auxiliary')),
    CONSTRAINT FK_library_events_copy FOREIGN KEY (school_id, copy_id) REFERENCES dbo.library_copies(school_id, id),
    CONSTRAINT FK_library_events_pupil FOREIGN KEY (school_id, pupil_id) REFERENCES dbo.students(school_id, id)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_library_history' AND object_id = OBJECT_ID('dbo.library_events'))
CREATE INDEX IX_library_history ON dbo.library_events(school_id, copy_id, id DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_library_pupil' AND object_id = OBJECT_ID('dbo.library_events'))
CREATE INDEX IX_library_pupil ON dbo.library_events(school_id, pupil_id) WHERE pupil_id IS NOT NULL;

IF OBJECT_ID('dbo.lab_items', 'U') IS NULL
CREATE TABLE dbo.lab_items (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    school_id  INT NOT NULL,
    name       NVARCHAR(120) NOT NULL,
    category   NVARCHAR(60) NOT NULL,
    kind       VARCHAR(12) NOT NULL,
    unit       NVARCHAR(30) NOT NULL,
    location   NVARCHAR(80) NOT NULL,
    batch      NVARCHAR(60) NOT NULL,
    minimum    DECIMAL(12,3) NOT NULL,
    expiry     DATE NULL,
    restricted BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_lab_items_tenant UNIQUE (school_id, id),
    CONSTRAINT UQ_lab_items_batch UNIQUE (school_id, name, location, batch),
    CONSTRAINT CK_lab_items_kind CHECK (kind IN ('equipment', 'consumable', 'reagent')),
    CONSTRAINT CK_lab_items_minimum CHECK (minimum >= 0),
    CONSTRAINT FK_lab_items_school FOREIGN KEY (school_id) REFERENCES dbo.schools(id)
);

IF OBJECT_ID('dbo.lab_requests', 'U') IS NULL
CREATE TABLE dbo.lab_requests (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    school_id         INT NOT NULL,
    item_id           INT NOT NULL,
    requested_by_type NVARCHAR(20) NOT NULL,
    requested_by_id   INT NOT NULL,
    quantity          DECIMAL(12,3) NOT NULL,
    purpose           NVARCHAR(200) NOT NULL,
    needed_on         DATE NOT NULL,
    status            VARCHAR(12) NOT NULL DEFAULT 'pending',
    created_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_lab_requests_item UNIQUE (school_id, item_id, id),
    CONSTRAINT CK_lab_requests_quantity CHECK (quantity > 0),
    CONSTRAINT CK_lab_requests_status CHECK (status IN ('pending', 'declined', 'approved', 'issued', 'returned', 'damaged', 'consumed')),
    CONSTRAINT CK_lab_requests_requester CHECK (requested_by_type IN ('admin', 'teacher', 'auxiliary')),
    CONSTRAINT FK_lab_requests_item FOREIGN KEY (school_id, item_id) REFERENCES dbo.lab_items(school_id, id)
);

IF OBJECT_ID('dbo.lab_movements', 'U') IS NULL
CREATE TABLE dbo.lab_movements (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    school_id   INT NOT NULL,
    item_id     INT NOT NULL,
    request_id  INT NULL,
    action      VARCHAR(12) NOT NULL,
    delta       DECIMAL(12,3) NOT NULL,
    actor_type  NVARCHAR(20) NOT NULL,
    actor_id    INT NOT NULL,
    occurred_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_lab_movements_action CHECK (action IN ('receive', 'approve', 'decline', 'issue', 'return', 'damage', 'consume')),
    CONSTRAINT CK_lab_movements_actor CHECK (actor_type IN ('admin', 'teacher', 'auxiliary')),
    CONSTRAINT FK_lab_movements_item FOREIGN KEY (school_id, item_id) REFERENCES dbo.lab_items(school_id, id),
    CONSTRAINT FK_lab_movements_request FOREIGN KEY (school_id, item_id, request_id) REFERENCES dbo.lab_requests(school_id, item_id, id)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_lab_balance' AND object_id = OBJECT_ID('dbo.lab_movements'))
CREATE INDEX IX_lab_balance ON dbo.lab_movements(school_id, item_id) INCLUDE (delta);

-- Retried form submissions are refused once (operation ids are single-use per person).
IF OBJECT_ID('dbo.inventory_operations', 'U') IS NULL
CREATE TABLE dbo.inventory_operations (
    school_id    INT NOT NULL,
    actor_type   NVARCHAR(20) NOT NULL,
    actor_id     INT NOT NULL,
    operation_id UNIQUEIDENTIFIER NOT NULL,
    created_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_inventory_operations PRIMARY KEY (school_id, actor_type, actor_id, operation_id)
);
