const { AsyncLocalStorage } = require('node:async_hooks');
const sql = require('mssql');
const { databaseConfiguration, isTestEnvironment, loadEnvironment } = require('./environment');

function createDatabase({ driver = sql, configuration = () => databaseConfiguration(), onError = () => {} } = {}) {
    let instance;
    let connecting;
    function getPool() {
        if (!instance) {
            instance = new driver.ConnectionPool(configuration());
            instance.on('error', onError);
        }
        return instance;
    }
    function connect() {
        if (!connecting) {
            connecting = Promise.resolve().then(() => getPool().connect()).catch(err => {
                connecting = undefined;
                throw err;
            });
        }
        return connecting;
    }
    async function close() {
        if (!instance) return;
        if (connecting) await connecting.catch(() => {});
        await instance.close();
        instance = undefined;
        connecting = undefined;
    }
    return { getPool, connect, close };
}

// School isolation: every query first tells SQL Server which school the request works for
// (SESSION_CONTEXT 'school_id', or NULL when none is set). New rows are stamped from it (migration 021) and
// row-level security can filter on it. Setting it on every query, NULL included, means a pooled connection
// never carries one request's school into the next request.
const { optionalSchoolId } = require('../utils/tenant');
// Batches whose first statement must be CREATE/ALTER of a view, procedure, function, trigger or schema.
const OWN_BATCH = /^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)*(?:CREATE|ALTER)\s+(?:OR\s+ALTER\s+)?(?:PROCEDURE|PROC|VIEW|FUNCTION|TRIGGER|SCHEMA)\b/i;
function schoolContextPrefix() {
    const id = optionalSchoolId();
    return `EXEC sys.sp_set_session_context @key = N'school_id', @value = ${id === null ? 'NULL' : Number(id)};\n`;
}
function withSchoolContext(command) {
    return typeof command === 'string' && !OWN_BATCH.test(command) ? schoolContextPrefix() + command : command;
}
if (!sql.Request.prototype.kodoSchoolContext) {
    const originalQuery = sql.Request.prototype.query;
    sql.Request.prototype.query = function query(command, ...rest) {
        return originalQuery.call(this, withSchoolContext(command), ...rest);
    };
    Object.defineProperty(sql.Request.prototype, 'kodoSchoolContext', { value: true });
}

const context = new AsyncLocalStorage();
const defaultDatabase = createDatabase({
    configuration() { loadEnvironment(); return databaseConfiguration(); },
    onError: () => console.error('SQL Server pool error'),
});
const current = () => context.getStore() || defaultDatabase;
// Preserve existing models' pool/poolConnect contract without import-time connections.
const pool = new Proxy({}, {
    get(_target, property) {
        const actual = current().getPool();
        const value = Reflect.get(actual, property, actual);
        return typeof value === 'function' ? value.bind(actual) : value;
    },
});
const poolConnect = { then(resolve, reject) { return current().connect().then(resolve, reject); } };

function withDatabase(database, operation) {
    if (!isTestEnvironment()) throw new Error('Database overrides are restricted to isolated tests');
    return context.run(database, operation);
}

module.exports = {
    sql, pool, poolConnect, createDatabase, withDatabase, withSchoolContext,
    connect: () => current().connect(), close: () => current().close(),
};
