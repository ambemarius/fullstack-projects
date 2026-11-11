/**
 * Seed the first admin so you can log in.
 *
 *   node scripts/seedAdmin.js
 *
 * Credentials must be supplied explicitly through local environment variables.
 * Safe to run repeatedly (won't create a duplicate).
 */
const Admin = require('../model/staff/admin');

async function main() {
    require('../config/environment').loadEnvironment();
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
