// KodoSchool's own administrators (platform console). They belong to no school.
const bcrypt = require('bcrypt');
const { sql, pool, poolConnect } = require('../../config/database');

const COLUMNS = 'id, name, email, status, created_at, last_login_at';

module.exports = {
    async findById(id) {
        await poolConnect;
        return (await pool.request().input('id', sql.Int, id).query(`SELECT ${COLUMNS} FROM platform_admins WHERE id = @id`)).recordset[0] || null;
    },
    // Sign-in only: includes the password hash.
    async findForLogin(email) {
        await poolConnect;
        return (await pool.request().input('email', sql.NVarChar(255), String(email).trim().toLowerCase())
            .query(`SELECT ${COLUMNS}, password FROM platform_admins WHERE email = @email`)).recordset[0] || null;
    },
    async create({ name, email, password }) {
        await poolConnect;
        const hash = await bcrypt.hash(password, 12);
        return (await pool.request().input('name', sql.NVarChar(200), name).input('email', sql.NVarChar(255), String(email).trim().toLowerCase())
            .input('password', sql.NVarChar(255), hash)
            .query(`INSERT INTO platform_admins (name, email, password) OUTPUT INSERTED.id, INSERTED.name, INSERTED.email VALUES (@name, @email, @password)`)).recordset[0];
    },
    async setPassword(id, password) {
        await poolConnect;
        const hash = await bcrypt.hash(password, 12);
        await pool.request().input('id', sql.Int, id).input('password', sql.NVarChar(255), hash).query('UPDATE platform_admins SET password = @password WHERE id = @id');
    },
    async passwordHash(id) {
        await poolConnect;
        return (await pool.request().input('id', sql.Int, id).query('SELECT password FROM platform_admins WHERE id = @id')).recordset[0]?.password || null;
    },
    async touchLogin(id) {
        await poolConnect;
        await pool.request().input('id', sql.Int, id).query('UPDATE platform_admins SET last_login_at = SYSUTCDATETIME() WHERE id = @id');
    },
    verifyPassword: (plain, hash) => bcrypt.compare(plain, hash),
};
