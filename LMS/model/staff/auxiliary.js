const bcrypt = require('bcrypt');
const { sql, pool, poolConnect } = require('../../config/database');

const SALT_ROUNDS = 12;
// Never select the password hash outside the sign-in path.
const COLUMNS = 'id, name, firstName, middleName, lastName, email, phone, role, status, createdAt, school_id, CAST(CASE WHEN password IS NULL THEN 0 ELSE 1 END AS bit) AS canSignIn';
const INSERTED = 'INSERTED.id, INSERTED.name, INSERTED.firstName, INSERTED.middleName, INSERTED.lastName, INSERTED.email, INSERTED.phone, INSERTED.role, INSERTED.status, INSERTED.createdAt, INSERTED.school_id, CAST(0 AS bit) AS canSignIn';

function buildFullName(firstName, middleName, lastName) {
    return [firstName, middleName, lastName].filter(Boolean).join(' ');
}

const AuxiliaryModel = {
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
                OUTPUT ${INSERTED}
                VALUES (@name, @firstName, @middleName, @lastName, @email, @phone, @role, @status)
            `);
        return result.recordset[0];
    },

    async getAll() {
        await poolConnect;
        const result = await pool.request().query(`SELECT ${COLUMNS} FROM auxiliary_staff ORDER BY name`);
        return result.recordset;
    },

    async findById(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT ${COLUMNS} FROM auxiliary_staff WHERE id = @id`);
        return result.recordset[0] || null;
    },

    async findByEmail(email) {
        await poolConnect;
        const result = await pool.request()
            .input('email', sql.NVarChar(255), email)
            .query(`SELECT ${COLUMNS} FROM auxiliary_staff WHERE email = @email`);
        return result.recordset[0] || null;
    },

    // Sign-in only: includes the password hash.
    async findForLogin(email) {
        await poolConnect;
        const result = await pool.request()
            .input('email', sql.NVarChar(255), email)
            .query(`SELECT ${COLUMNS}, password FROM auxiliary_staff WHERE email = @email`);
        return result.recordset[0] || null;
    },

    async setPassword(id, password) {
        await poolConnect;
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('password', sql.NVarChar(255), hash)
            .query(`UPDATE auxiliary_staff SET password = @password WHERE id = @id; SELECT ${COLUMNS} FROM auxiliary_staff WHERE id = @id;`);
        return result.recordset[0] || null;
    },

    verifyPassword(plain, hash) {
        return bcrypt.compare(plain, hash);
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
                SELECT ${COLUMNS} FROM auxiliary_staff WHERE id = @id;
            `);
        return result.recordset[0] || null;
    },

    async setStatus(id, status) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar(20), status)
            .query(`UPDATE auxiliary_staff SET status = @status WHERE id = @id; SELECT ${COLUMNS} FROM auxiliary_staff WHERE id = @id;`);
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
