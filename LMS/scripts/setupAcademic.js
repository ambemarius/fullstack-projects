// Legacy command name retained; automatic inline legacy migrations are intentionally disabled.
const { loadTestEnvironment, assertSyntheticDatabase } = require('./testEnvironment');
const { migrate } = require('./migrate');

async function main() {
    if (!process.argv.includes('--approved-synthetic-only')) {
        throw new Error('Setup requires an approved synthetic target; existing databases need reviewed versioned migrations');
    }
    loadTestEnvironment();
    const database = require('../config/database');
    const adapter = { connect: database.connect, getPool: () => database.pool };
    try {
        await assertSyntheticDatabase(adapter);
        await migrate(adapter);
        await require('../model/Academic/class').seedDefaults();
        await require('../model/Academic/timeSlot').seed();
        await require('../model/Academic/location').seed();
        console.log('Synthetic schema and reference data ready. No student or staff data was seeded.');
    } finally {
        await database.close();
    }
}

if (require.main === module) main().catch(() => {
    console.error('Setup stopped. Use the approved synthetic configuration and acknowledgement; legacy upgrade is not automatic.');
    process.exitCode = 1;
});

module.exports = { main };
