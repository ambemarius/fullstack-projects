const { pool, poolConnect } = require('../config/database');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'password123';

(async () => {
    await poolConnect;

    // Reset ALL teacher passwords
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
    const result = await pool.request()
        .input('hash', hash)
        .query('UPDATE teachers SET password = @hash');
    
    console.log(`✓ Reset ${result.rowsAffected[0]} teacher passwords to '${DEFAULT_PASSWORD}'`);

    // Reset all admin passwords (except those matching the seeded admin)
    const adminHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
    const adminResult = await pool.request()
        .input('hash', adminHash)
        .query("UPDATE Admins SET password = @hash WHERE email NOT IN ('admin@school.local')");
    
    console.log(`✓ Reset ${adminResult.rowsAffected[0]} admin passwords to '${DEFAULT_PASSWORD}'`);
    console.log('\nLogin credentials:');
    console.log('  Admin:  admin@school.local  /  Admin@123  (seeded)');
    console.log('  Admin:  any other admin email  /  password123  (reset)');
    console.log('  Teacher:  any teacher email  /  password123  (reset)');

    process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
