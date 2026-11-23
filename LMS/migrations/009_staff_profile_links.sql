-- Reviewed additive staff-account foundation. No backfill or grants.
-- Each school's membership chooses its own explicit staff profile; accounts are
-- never matched across schools by email or by legacy numeric ID.
CREATE TABLE dbo.staff_profile_links (
    id INT IDENTITY PRIMARY KEY,
    school_id INT NOT NULL,
    membership_id INT NOT NULL,
    account_id INT NOT NULL,
    admin_profile_id INT NULL,
    teacher_profile_id INT NULL,
    auxiliary_profile_id INT NULL,
    required_role VARCHAR(30) NOT NULL,
    link_status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (link_status IN ('active','revoked')),
    link_version INT NOT NULL DEFAULT 1 CHECK (link_version > 0),
    created_by INT NOT NULL REFERENCES dbo.accounts(id),
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_staff_link_membership UNIQUE (school_id,membership_id),
    CONSTRAINT UQ_staff_link_account UNIQUE (school_id,account_id),
    CONSTRAINT FK_staff_link_actor FOREIGN KEY (school_id,membership_id,account_id)
        REFERENCES dbo.school_memberships(school_id,id,account_id),
    CONSTRAINT FK_staff_link_admin FOREIGN KEY (school_id,admin_profile_id) REFERENCES dbo.Admins(school_id,id),
    CONSTRAINT FK_staff_link_teacher FOREIGN KEY (school_id,teacher_profile_id) REFERENCES dbo.teachers(school_id,id),
    CONSTRAINT FK_staff_link_auxiliary FOREIGN KEY (school_id,auxiliary_profile_id) REFERENCES dbo.auxiliary_staff(school_id,id),
    CONSTRAINT CK_staff_link_profile CHECK (
        (admin_profile_id IS NOT NULL AND teacher_profile_id IS NULL AND auxiliary_profile_id IS NULL AND required_role='admin') OR
        (admin_profile_id IS NULL AND teacher_profile_id IS NOT NULL AND auxiliary_profile_id IS NULL AND required_role='teacher') OR
        (admin_profile_id IS NULL AND teacher_profile_id IS NULL AND auxiliary_profile_id IS NOT NULL AND required_role IN ('discipline_master','librarian','lab_attendant'))
    )
);
CREATE UNIQUE INDEX UQ_staff_link_admin ON dbo.staff_profile_links(school_id,admin_profile_id) WHERE admin_profile_id IS NOT NULL;
CREATE UNIQUE INDEX UQ_staff_link_teacher ON dbo.staff_profile_links(school_id,teacher_profile_id) WHERE teacher_profile_id IS NOT NULL;
CREATE UNIQUE INDEX UQ_staff_link_auxiliary ON dbo.staff_profile_links(school_id,auxiliary_profile_id) WHERE auxiliary_profile_id IS NOT NULL;
