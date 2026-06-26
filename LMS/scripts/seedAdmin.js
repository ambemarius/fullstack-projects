/**
 * Seed the first admin so you can log in.
 *
 *   node scripts/seedAdmin.js
 *
 * Credentials come from env vars if set, otherwise sensible defaults.
 * Safe to run repeatedly (won't create a duplicate).
 */
const Admin = require('../model/staff/admin');

async function main() {
    const name = process.env.ADMIN_NAME || 'Super Admin';
    const email = process.env.ADMIN_EMAIL || 'admin@school.local';
    const password = process.env.ADMIN_PASSWORD || 'Admin@123';

    await Admin.createTable(); // make sure the table exists

    const existing = await Admin.findByEmail(email);
    if (existing) {
        console.log(`Admin already exists: ${email}`);
        return;
    }

    const admin = await Admin.create({ name, email, password, role: 'admin' });
    console.log('Seeded admin:');
    console.table([{ id: admin.id, name: admin.name, email: admin.email, role: admin.role }]);
    console.log(`\nLogin ->  email: ${email}   password: ${password}`);
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Seed failed:', err.message);
        process.exit(1);
    });
