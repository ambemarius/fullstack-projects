const path = require('node:path');

let loaded = false;

function isTestEnvironment(env = process.env) {
    return env.NODE_ENV === 'test' || Boolean(env.NODE_TEST_CONTEXT);
}

function loadEnvironment() {
    // Tests must never inherit workstation credentials.
    if (loaded || isTestEnvironment()) return;
    require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
    loaded = true;
}

function databaseConfiguration(env = process.env) {
    if (isTestEnvironment(env)) {
        const server = env.LMS_TEST_DB_SERVER;
        const database = env.LMS_TEST_DB_NAME;
        if (env.LMS_TEST_DB_ACK !== 'synthetic-only' ||
            !server || server !== env.LMS_TEST_DB_ALLOWED_SERVER ||
            !database || database !== env.LMS_TEST_DB_ALLOWED_NAME ||
            !/^lms_test_[a-z0-9_]+$/.test(database)) {
            throw new Error('Test database access requires an explicitly allowlisted synthetic-only target');
        }
        if (!env.LMS_TEST_DB_USER || !env.LMS_TEST_DB_PASSWORD) {
            throw new Error('Separate test database credentials are required');
        }
        return {
            server, database,
            user: env.LMS_TEST_DB_USER, password: env.LMS_TEST_DB_PASSWORD,
            options: { encrypt: true, trustServerCertificate: env.LMS_TEST_DB_TRUST_CERTIFICATE === 'true' },
        };
    }
    if (!env.DB_STRING) throw new Error('Database configuration is missing');
    return env.DB_STRING;
}

let policyCache = null;
function getFeatureFlag(key, defaultValue = false) {
    if (!policyCache) {
        try { policyCache = require('./runtimePolicy.json'); } catch { policyCache = {}; }
    }
    return key in policyCache ? policyCache[key] : defaultValue;
}

module.exports = { isTestEnvironment, loadEnvironment, databaseConfiguration, getFeatureFlag };
