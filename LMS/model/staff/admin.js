const { sql, pool, poolConnect } = require('../../config/database');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const Admin = {
    // Create the Admins table if it does not already exist.
    async createTable() {
        await poolConnect;
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Admins')
            CREATE TABLE Admins (
                id        INT IDENTITY(1,1) PRIMARY KEY,
                name      NVARCHAR(100) NOT NULL,
                email     NVARCHAR(255) NOT NULL UNIQUE,
                password  NVARCHAR(255) NOT NULL,
                role      NVARCHAR(50)  NOT NULL,
                createdAt DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
            );
        `);
    },

    // Find a single admin by email, or return null.
    async findByEmail(email) {
        await poolConnect;
        const result = await pool.request()
            .input('email', sql.NVarChar(255), email)
            .query('SELECT * FROM Admins WHERE email = @email');
        return result.recordset[0] || null;
    },

    // Find a single admin by id, or return null.
    async findById(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM Admins WHERE id = @id');
        return result.recordset[0] || null;
    },

    // Insert a new admin. The password is hashed before storing.
    async create({ name, email, password, role }) {
        await poolConnect;
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const result = await pool.request()
            .input('name', sql.NVarChar(100), name)
            .input('email', sql.NVarChar(255), email)
            .input('password', sql.NVarChar(255), hashedPassword)
            .input('role', sql.NVarChar(50), role)
            .query(`
                INSERT INTO Admins (name, email, password, role)
                OUTPUT INSERTED.id, INSERTED.name, INSERTED.email,
                       INSERTED.role, INSERTED.createdAt
                VALUES (@name, @email, @password, @role);
            `);
        return result.recordset[0];
    },

    // Verify a plaintext password against a stored hash.
    verifyPassword(plain, hash) {
        return bcrypt.compare(plain, hash);
    },

    async getAll() {
        await poolConnect;
        const result = await pool.request()
            .query('SELECT id, name, email, role, createdAt FROM Admins ORDER BY name');
        return result.recordset;
    },

    async update(id, { name, email, role }) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar(100), name)
            .input('email', sql.NVarChar(255), email)
            .input('role', sql.NVarChar(50), role)
            .query(`
                UPDATE Admins
                SET name  = COALESCE(@name, name),
                    email = COALESCE(@email, email),
                    role  = COALESCE(@role, role)
                WHERE id = @id;
                SELECT id, name, email, role, createdAt FROM Admins WHERE id = @id;
            `);
        return result.recordset[0] || null;
    },

    async remove(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Admins WHERE id = @id; SELECT @@ROWCOUNT AS affected;');
        return result.recordset[0].affected > 0;
    },
};




module.exports = Admin;
