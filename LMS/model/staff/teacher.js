const { sql, pool, poolConnect } = require('../../config/database');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

function buildFullName(firstName, middleName, lastName) {
    return [firstName, middleName, lastName].filter(Boolean).join(' ');
}

const TeacherModel = {
    async createTable() {
        await poolConnect;
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'teachers')
            CREATE TABLE teachers (
                id                   INT IDENTITY(1,1) PRIMARY KEY,
                name                 NVARCHAR(255) NOT NULL,
                firstName            NVARCHAR(100) NOT NULL,
                middleName           NVARCHAR(100) NULL,
                lastName             NVARCHAR(100) NOT NULL,
                email                NVARCHAR(255) NOT NULL UNIQUE,
                password             NVARCHAR(255) NOT NULL,
                phone                NVARCHAR(30)  NULL,
                secondaryContactName NVARCHAR(200) NULL,
                secondaryContactPhone NVARCHAR(30) NULL,
                employmentType       NVARCHAR(20)  NOT NULL,
                section              NVARCHAR(20)  NOT NULL,
                status               NVARCHAR(20)  NOT NULL DEFAULT 'active',
                role                 NVARCHAR(20)  NOT NULL DEFAULT 'teacher',
                createdAt            DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
                address              NVARCHAR(300) NULL,
                idCardNo             NVARCHAR(50)  NULL,
                dateOfIssue          DATE NULL,
                gender               NVARCHAR(10)  NULL,
                civilStatus          NVARCHAR(20)  NULL,
                noOfChildren         INT NULL,
                telephone            NVARCHAR(30)  NULL,
                matricule        NVARCHAR(255) NULL,
                CONSTRAINT CK_teacher_employment CHECK (employmentType IN ('Government', 'Part-time')),
                CONSTRAINT CK_teacher_section    CHECK (section IN ('Anglophone', 'Francophone')),
                CONSTRAINT CK_teacher_status     CHECK (status IN ('active', 'suspended', 'withdrawn')),
                CONSTRAINT CK_teacher_role       CHECK (role = 'teacher'),
                CONSTRAINT CK_teacher_gender     CHECK (gender IN ('Male', 'Female'))
            );
        `);
    },

    async migrate() {
        await poolConnect;

        // Drop old boolean columns if they still exist
        const hasOld = await pool.request().query(
            "SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('teachers') AND name = 'isSuspended'"
        );
        if (hasOld.recordset.length) {
            await pool.request().query(`
                DECLARE @sql NVARCHAR(MAX);
                SELECT @sql = COALESCE(@sql + '; ', '') +
                    'ALTER TABLE teachers DROP CONSTRAINT ' + QUOTENAME(dc.name)
                FROM sys.default_constraints dc
                JOIN sys.columns c ON dc.parent_column_id = c.column_id AND dc.parent_object_id = c.object_id
                WHERE c.object_id = OBJECT_ID('teachers') AND c.name IN ('isSuspended', 'isWithdrawn');
                EXEC sp_executesql @sql;
            `);
            await pool.request().query("ALTER TABLE teachers DROP COLUMN isSuspended");
            await pool.request().query("ALTER TABLE teachers DROP COLUMN isWithdrawn");
        }

        // Add status column if missing
        const hasStatus = await pool.request().query(
            "SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('teachers') AND name = 'status'"
        );
        if (!hasStatus.recordset.length) {
            await pool.request().query("ALTER TABLE teachers ADD status NVARCHAR(20) NOT NULL DEFAULT 'active'");
        }
        const hasCk = await pool.request().query(
            "SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('teachers') AND name = 'CK_teacher_status'"
        );
        if (!hasCk.recordset.length) {
            await pool.request().query("ALTER TABLE teachers ADD CONSTRAINT CK_teacher_status CHECK (status IN ('active', 'suspended', 'withdrawn'))");
        }

        // Add name-split columns + secondary contact if missing
        const hasFn = await pool.request().query(
            "SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('teachers') AND name = 'firstName'"
        );
        if (!hasFn.recordset.length) {
            await pool.request().query("ALTER TABLE teachers ADD firstName NVARCHAR(100) NULL");
            await pool.request().query("ALTER TABLE teachers ADD middleName NVARCHAR(100) NULL");
            await pool.request().query("ALTER TABLE teachers ADD lastName NVARCHAR(100) NULL");
            await pool.request().query(`
                UPDATE teachers SET
                    firstName = LEFT(name, CHARINDEX(' ', name + ' ') - 1),
                    lastName  = CASE WHEN CHARINDEX(' ', name) > 0 THEN SUBSTRING(name, CHARINDEX(' ', name) + 1, LEN(name) - CHARINDEX(' ', name)) ELSE name END
            `);
            await pool.request().query("ALTER TABLE teachers ALTER COLUMN firstName NVARCHAR(100) NOT NULL");
            await pool.request().query("ALTER TABLE teachers ALTER COLUMN lastName NVARCHAR(100) NOT NULL");
            // Widen name to 255 for full-name storage
            await pool.request().query("ALTER TABLE teachers ALTER COLUMN name NVARCHAR(255) NOT NULL");
        }

        // Add secondary contact columns if missing
        const hasSc = await pool.request().query(
            "SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('teachers') AND name = 'secondaryContactName'"
        );
        if (!hasSc.recordset.length) {
            await pool.request().query("ALTER TABLE teachers ADD secondaryContactName NVARCHAR(200) NULL");
            await pool.request().query("ALTER TABLE teachers ADD secondaryContactPhone NVARCHAR(30) NULL");
        }

        // Add new columns if missing
        const newColumns = [
            { name: 'address', ddl: "ALTER TABLE teachers ADD address NVARCHAR(300) NULL" },
            { name: 'idCardNo', ddl: "ALTER TABLE teachers ADD idCardNo NVARCHAR(50) NULL" },
            { name: 'dateOfIssue', ddl: "ALTER TABLE teachers ADD dateOfIssue DATE NULL" },
            { name: 'gender', ddl: "ALTER TABLE teachers ADD gender NVARCHAR(10) NULL" },
            { name: 'civilStatus', ddl: "ALTER TABLE teachers ADD civilStatus NVARCHAR(20) NULL" },
            { name: 'noOfChildren', ddl: "ALTER TABLE teachers ADD noOfChildren INT NULL" },
            { name: 'telephone', ddl: "ALTER TABLE teachers ADD telephone NVARCHAR(30) NULL" },
            { name: 'matriculeFile', ddl: "ALTER TABLE teachers ADD matriculeFile NVARCHAR(255) NULL" },
        ];
        for (const col of newColumns) {
            const exists = await pool.request().query(
                `SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('teachers') AND name = '${col.name}'`
            );
            if (!exists.recordset.length) {
                await pool.request().query(col.ddl);
            }
        }

        // Add gender check constraint if missing
        const hasGenderCk = await pool.request().query(
            "SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('teachers') AND name = 'CK_teacher_gender'"
        );
        if (!hasGenderCk.recordset.length) {
            await pool.request().query("ALTER TABLE teachers ADD CONSTRAINT CK_teacher_gender CHECK (gender IN ('Male', 'Female'))");
        }
    },

    _safeColumns: `id, name, firstName, middleName, lastName, email, phone, secondaryContactName, secondaryContactPhone, employmentType, section, status, role, createdAt, address, idCardNo, dateOfIssue, gender, civilStatus, noOfChildren, telephone, matriculeFile`,

    async create({ firstName, middleName, lastName, email, password, phone, secondaryContactName, secondaryContactPhone, employmentType, section, status, address, idCardNo, dateOfIssue, gender, civilStatus, noOfChildren, telephone, matriculeFile }) {
        await poolConnect;
        const name = buildFullName(firstName, middleName, lastName);
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        
        if (employmentType === 'Government' && !matriculeFile) {
            const err = new Error('Matricule file is required for Government teachers');
            err.statusCode = 400;
            throw err;
        }

        const result = await pool.request()
            .input('name', sql.NVarChar(255), name)
            .input('firstName', sql.NVarChar(100), firstName)
            .input('middleName', sql.NVarChar(100), middleName || null)
            .input('lastName', sql.NVarChar(100), lastName)
            .input('email', sql.NVarChar(255), email)
            .input('password', sql.NVarChar(255), hashedPassword)
            .input('phone', sql.NVarChar(30), phone || null)
            .input('secondaryContactName', sql.NVarChar(200), secondaryContactName || null)
            .input('secondaryContactPhone', sql.NVarChar(30), secondaryContactPhone || null)
            .input('employmentType', sql.NVarChar(20), employmentType)
            .input('section', sql.NVarChar(20), section)
            .input('status', sql.NVarChar(20), status || 'active')
            .input('address', sql.NVarChar(300), address || null)
            .input('idCardNo', sql.NVarChar(50), idCardNo || null)
            .input('dateOfIssue', sql.Date, dateOfIssue || null)
            .input('gender', sql.NVarChar(10), gender || null)
            .input('civilStatus', sql.NVarChar(20), civilStatus || null)
            .input('noOfChildren', sql.Int, noOfChildren || null)
            .input('telephone', sql.NVarChar(30), telephone || null)
            .input('matricule', sql.NVarChar(255), matriculeFile || null)
            .query(`
                INSERT INTO teachers (name, firstName, middleName, lastName, email, password, phone, secondaryContactName, secondaryContactPhone, employmentType, section, status, address, idCardNo, dateOfIssue, gender, civilStatus, noOfChildren, telephone, matriculeFile)
                OUTPUT INSERTED.id, INSERTED.name, INSERTED.firstName, INSERTED.middleName, INSERTED.lastName,
                       INSERTED.email, INSERTED.phone, INSERTED.secondaryContactName, INSERTED.secondaryContactPhone,
                       INSERTED.employmentType, INSERTED.section, INSERTED.status, INSERTED.role, INSERTED.createdAt,
                       INSERTED.address, INSERTED.idCardNo, INSERTED.dateOfIssue, INSERTED.gender, INSERTED.civilStatus, INSERTED.noOfChildren, INSERTED.telephone, INSERTED.matriculeFile
                VALUES (@name, @firstName, @middleName, @lastName, @email, @password, @phone, @secondaryContactName, @secondaryContactPhone, @employmentType, @section, @status, @address, @idCardNo, @dateOfIssue, @gender, @civilStatus, @noOfChildren, @telephone, @matricule)
            `);
        return result.recordset[0];
    },

    async getAll() {
        await poolConnect;
        const result = await pool.request()
            .query(`SELECT ${this._safeColumns} FROM teachers ORDER BY lastName, firstName`);
        return result.recordset;
    },

    async findById(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT ${this._safeColumns} FROM teachers WHERE id = @id`);
        return result.recordset[0] || null;
    },

    async findByEmail(email) {
        await poolConnect;
        const result = await pool.request()
            .input('email', sql.NVarChar(255), email)
            .query('SELECT * FROM teachers WHERE email = @email');
        return result.recordset[0] || null;
    },

    verifyPassword(plain, hash) {
        return bcrypt.compare(plain, hash);
    },

    async update(id, { firstName, middleName, lastName, phone, secondaryContactName, secondaryContactPhone, employmentType, section, status, address, idCardNo, dateOfIssue, gender, civilStatus, noOfChildren, telephone, matriculeFile }) {
        await poolConnect;
        const name = (firstName || middleName || lastName)
            ? buildFullName(
                firstName || undefined,
                middleName || undefined,
                lastName || undefined
              )
            : undefined;

        if (employmentType === 'Government' && !matriculeFile) {
            const existing = await this.findById(id);
            if (existing && !existing.matriculeFile) {
                const err = new Error('Matricule file is required for Government teachers');
                err.statusCode = 400;
                throw err;
            }
        }

        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar(255), name)
            .input('firstName', sql.NVarChar(100), firstName)
            .input('middleName', sql.NVarChar(100), middleName)
            .input('lastName', sql.NVarChar(100), lastName)
            .input('phone', sql.NVarChar(30), phone)
            .input('secondaryContactName', sql.NVarChar(200), secondaryContactName)
            .input('secondaryContactPhone', sql.NVarChar(30), secondaryContactPhone)
            .input('employmentType', sql.NVarChar(20), employmentType)
            .input('section', sql.NVarChar(20), section)
            .input('status', sql.NVarChar(20), status)
            .input('address', sql.NVarChar(300), address)
            .input('idCardNo', sql.NVarChar(50), idCardNo)
            .input('dateOfIssue', sql.Date, dateOfIssue)
            .input('gender', sql.NVarChar(10), gender)
            .input('civilStatus', sql.NVarChar(20), civilStatus)
            .input('noOfChildren', sql.Int, noOfChildren)
            .input('telephone', sql.NVarChar(30), telephone)
            .input('matriculeFile', sql.NVarChar(255), matriculeFile)
            .query(`
                UPDATE teachers
                SET name                 = COALESCE(@name, name),
                    firstName            = COALESCE(@firstName, firstName),
                    middleName           = COALESCE(@middleName, middleName),
                    lastName             = COALESCE(@lastName, lastName),
                    phone                = COALESCE(@phone, phone),
                    secondaryContactName = COALESCE(@secondaryContactName, secondaryContactName),
                    secondaryContactPhone = COALESCE(@secondaryContactPhone, secondaryContactPhone),
                    employmentType       = COALESCE(@employmentType, employmentType),
                    section              = COALESCE(@section, section),
                    status               = COALESCE(@status, status),
                    address              = COALESCE(@address, address),
                    idCardNo             = COALESCE(@idCardNo, idCardNo),
                    dateOfIssue          = COALESCE(@dateOfIssue, dateOfIssue),
                    gender               = COALESCE(@gender, gender),
                    civilStatus          = COALESCE(@civilStatus, civilStatus),
                    noOfChildren         = COALESCE(@noOfChildren, noOfChildren),
                    telephone            = COALESCE(@telephone, telephone),
                    matriculeFile        = COALESCE(@matriculeFile, matriculeFile)
                WHERE id = @id;
                SELECT ${this._safeColumns} FROM teachers WHERE id = @id;
            `);
        return result.recordset[0] || null;
    },

    async setStatus(id, status) {
        await poolConnect;
        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar(20), status)
            .query("UPDATE teachers SET status = @status WHERE id = @id; SELECT @@ROWCOUNT AS changed");
    },

    async remove(id) {
        await poolConnect;
        await pool.request()
            .input('id', sql.Int, id)
            .query("DELETE FROM teachers WHERE id = @id");
    },
};

module.exports = TeacherModel;
