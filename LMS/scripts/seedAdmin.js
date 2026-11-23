/**
 * Seed the first admin so you can log in.
 *
 *   node scripts/seedAdmin.js
 *
 * Credentials must be supplied explicitly through local environment variables.
 * Safe to run repeatedly (won't create a duplicate).
 */
const Admin = require('../model/staff/admin');

// A fresh install has no school row; school-scoped modules need exactly one.
async function ensureSchool() {
    const { sql, pool, poolConnect } = require('../config/database');
    await poolConnect;
    const active = (await pool.request().query("SELECT id, code FROM dbo.schools WHERE status = 'active'")).recordset;
    if (active.length > 1) throw new Error('More than one active school; single-school seeding does not apply');
    if (!active.length) {
        const code = process.env.SCHOOL_CODE, name = process.env.SCHOOL_NAME;
        const system = process.env.SCHOOL_SYSTEM || 'Bilingual';
        if (!/^[A-Z0-9_-]{2,50}$/.test(code || '') || !name || name.length > 200 || !['Anglophone', 'Francophone', 'Bilingual'].includes(system)) {
            throw new Error('Set SCHOOL_CODE (A-Z, 0-9, _ or -), SCHOOL_NAME and optionally SCHOOL_SYSTEM (Anglophone, Francophone or Bilingual)');
        }
        await pool.request()
            .input('code', sql.NVarChar(50), code).input('name', sql.NVarChar(200), name).input('system', sql.VarChar(20), system)
            .query("INSERT INTO dbo.schools (code, name, education_system, status) VALUES (@code, @name, @system, 'active')");
        console.log(`Created school ${code}.`);
    }
    await pool.request().query('EXEC dbo.lms_apply_single_school_defaults');
}

async function main() {
    require('../config/environment').loadEnvironment();
    await ensureSchool();
    const name = process.env.ADMIN_NAME || 'Super Admin';
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password || password.length < 12) {
        throw new Error('Explicit ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) are required');
    }

    const existing = await Admin.findByEmail(email);
    if (existing) {
        console.log(`Admin already exists: ${email}`);
        return;
    }

    const admin = await Admin.create({ name, email, password, role: 'admin' });
    console.log('Seeded admin:');
    console.table([{ id: admin.id, name: admin.name, email: admin.email, role: admin.role }]);
    console.log('Administrator provisioned. Use the credentials supplied through your local configuration.');
}

if (require.main === module) main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Administrator seeding failed. Check explicit credentials and the prepared schema.');
        process.exit(1);
    });

module.exports = { main };
