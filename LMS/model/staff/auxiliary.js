const { sql, pool, poolConnect } = require('../../config/database');

function buildFullName(firstName, middleName, lastName) {
    return [firstName, middleName, lastName].filter(Boolean).join(' ');
}

const AuxiliaryModel = {
    async createTable() {
        await poolConnect;
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'auxiliary_staff')
            CREATE TABLE auxiliary_staff (
                id          INT IDENTITY(1,1) PRIMARY KEY,
                name        NVARCHAR(255) NOT NULL,
                firstName   NVARCHAR(100) NOT NULL,
                middleName  NVARCHAR(100) NULL,
                lastName    NVARCHAR(100) NOT NULL,
                email       NVARCHAR(255) NOT NULL UNIQUE,
                phone       NVARCHAR(30)  NULL,
                role        NVARCHAR(50)  NOT NULL,
                status      NVARCHAR(20)  NOT NULL DEFAULT 'pending',
                createdAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
            );
        `);
    },

    async create({ firstName, middleName, lastName, email, phone, role, status = 'pending' }) {
        await poolConnect;
        const name = buildFullName(firstName, middleName, lastName);
        const result = await pool.request()
            .input('name', sql.NVarChar(255), name)
            .input('firstName', sql.NVarChar(100), firstName)
            .input('middleName', sql.NVarChar(100), middleName || null)
            .input('lastName', sql.NVarChar(100), lastName)
            .input('email', sql.NVarChar(255), email)
            .input('phone', sql.NVarChar(30), phone || null)
            .input('role', sql.NVarChar(50), role)
            .input('status', sql.NVarChar(20), status)
            .query(`
                INSERT INTO auxiliary_staff (name, firstName, middleName, lastName, email, phone, role, status)
                OUTPUT INSERTED.*
                VALUES (@name, @firstName, @middleName, @lastName, @email, @phone, @role, @status)
            `);
        return result.recordset[0];
    },

    async getAll() {
        await poolConnect;
        const result = await pool.request().query('SELECT * FROM auxiliary_staff ORDER BY name');
        return result.recordset;
    },

    async findById(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM auxiliary_staff WHERE id = @id');
        return result.recordset[0] || null;
    },

    async findByEmail(email) {
        await poolConnect;
        const result = await pool.request()
            .input('email', sql.NVarChar(255), email)
            .query('SELECT * FROM auxiliary_staff WHERE email = @email');
        return result.recordset[0] || null;
    },

    async update(id, { firstName, middleName, lastName, email, phone, role, status }) {
        await poolConnect;
        const name = (firstName || middleName || lastName)
            ? buildFullName(firstName, middleName, lastName)
            : undefined;

        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar(255), name)
            .input('firstName', sql.NVarChar(100), firstName)
            .input('middleName', sql.NVarChar(100), middleName)
            .input('lastName', sql.NVarChar(100), lastName)
            .input('email', sql.NVarChar(255), email)
            .input('phone', sql.NVarChar(30), phone)
            .input('role', sql.NVarChar(50), role)
            .input('status', sql.NVarChar(20), status)
            .query(`
                UPDATE auxiliary_staff
                SET name       = COALESCE(@name, name),
                    firstName  = COALESCE(@firstName, firstName),
                    middleName = COALESCE(@middleName, middleName),
                    lastName   = COALESCE(@lastName, lastName),
                    email      = COALESCE(@email, email),
                    phone      = COALESCE(@phone, phone),
                    role       = COALESCE(@role, role),
                    status     = COALESCE(@status, status)
                WHERE id = @id;
                SELECT * FROM auxiliary_staff WHERE id = @id;
            `);
        return result.recordset[0] || null;
    },

    async setStatus(id, status) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar(20), status)
            .query('UPDATE auxiliary_staff SET status = @status WHERE id = @id; SELECT * FROM auxiliary_staff WHERE id = @id;');
        return result.recordset[0] || null;
    },

    async remove(id) {
        await poolConnect;
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM auxiliary_staff WHERE id = @id');
    }
};

module.exports = AuxiliaryModel;
