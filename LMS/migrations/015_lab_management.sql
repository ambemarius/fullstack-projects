-- Laboratory management: subject laboratories, hazard classes, equipment return accounting,
-- stock counts and disposal. Additive; the laboratory tables were empty when this was written.

-- Each item belongs to a subject laboratory.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_lab_items_subject' AND parent_object_id = OBJECT_ID('dbo.lab_items'))
ALTER TABLE dbo.lab_items WITH CHECK ADD CONSTRAINT CK_lab_items_subject CHECK (category IN ('Physics', 'Chemistry', 'Biology', 'Geology', 'General lab'));

IF COL_LENGTH('dbo.lab_items', 'hazard') IS NULL
ALTER TABLE dbo.lab_items ADD hazard VARCHAR(20) NOT NULL CONSTRAINT DF_lab_items_hazard DEFAULT 'none';

-- Statements touching columns added above run through EXEC so they compile after the columns exist.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_lab_items_hazard' AND parent_object_id = OBJECT_ID('dbo.lab_items'))
EXEC(N'ALTER TABLE dbo.lab_items WITH CHECK ADD CONSTRAINT CK_lab_items_hazard CHECK (hazard IN (''none'', ''flammable'', ''corrosive'', ''toxic'', ''oxidising'', ''irritant'', ''environmental'', ''biohazard''))');

-- Requests: the practical's class, when equipment must come back, and how it came back.
IF COL_LENGTH('dbo.lab_requests', 'class_id') IS NULL ALTER TABLE dbo.lab_requests ADD class_id INT NULL;
IF COL_LENGTH('dbo.lab_requests', 'return_by') IS NULL ALTER TABLE dbo.lab_requests ADD return_by DATE NULL;
IF COL_LENGTH('dbo.lab_requests', 'returned_qty') IS NULL ALTER TABLE dbo.lab_requests ADD returned_qty DECIMAL(12,3) NULL;
IF COL_LENGTH('dbo.lab_requests', 'damaged_qty') IS NULL ALTER TABLE dbo.lab_requests ADD damaged_qty DECIMAL(12,3) NULL;
IF COL_LENGTH('dbo.lab_requests', 'missing_qty') IS NULL ALTER TABLE dbo.lab_requests ADD missing_qty DECIMAL(12,3) NULL;
IF COL_LENGTH('dbo.lab_requests', 'closed_at') IS NULL ALTER TABLE dbo.lab_requests ADD closed_at DATETIME2 NULL;
IF COL_LENGTH('dbo.lab_requests', 'close_note') IS NULL ALTER TABLE dbo.lab_requests ADD close_note NVARCHAR(200) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_lab_requests_class')
EXEC(N'ALTER TABLE dbo.lab_requests ADD CONSTRAINT FK_lab_requests_class FOREIGN KEY (class_id) REFERENCES dbo.classes(id)');

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_lab_requests_return_by' AND parent_object_id = OBJECT_ID('dbo.lab_requests'))
EXEC(N'ALTER TABLE dbo.lab_requests WITH CHECK ADD CONSTRAINT CK_lab_requests_return_by CHECK (return_by IS NULL OR return_by >= needed_on)');

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_lab_requests_accounting' AND parent_object_id = OBJECT_ID('dbo.lab_requests'))
EXEC(N'ALTER TABLE dbo.lab_requests WITH CHECK ADD CONSTRAINT CK_lab_requests_accounting CHECK (
    COALESCE(returned_qty, 0) >= 0 AND COALESCE(damaged_qty, 0) >= 0 AND COALESCE(missing_qty, 0) >= 0
    AND COALESCE(returned_qty, 0) + COALESCE(damaged_qty, 0) + COALESCE(missing_qty, 0) <= quantity)');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_lab_requests_open' AND object_id = OBJECT_ID('dbo.lab_requests'))
EXEC(N'CREATE INDEX IX_lab_requests_open ON dbo.lab_requests(school_id, status, return_by) INCLUDE (requested_by_type, requested_by_id)');

-- Movements: notes for counts and disposals, and the new actions.
IF COL_LENGTH('dbo.lab_movements', 'note') IS NULL ALTER TABLE dbo.lab_movements ADD note NVARCHAR(200) NULL;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_lab_movements_action' AND parent_object_id = OBJECT_ID('dbo.lab_movements')
           AND definition NOT LIKE '%adjust%')
ALTER TABLE dbo.lab_movements DROP CONSTRAINT CK_lab_movements_action;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_lab_movements_action' AND parent_object_id = OBJECT_ID('dbo.lab_movements'))
ALTER TABLE dbo.lab_movements WITH CHECK ADD CONSTRAINT CK_lab_movements_action
    CHECK (action IN ('receive', 'approve', 'decline', 'issue', 'return', 'damage', 'lost', 'consume', 'adjust', 'dispose'));
