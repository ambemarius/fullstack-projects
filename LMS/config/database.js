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
    sql, pool, poolConnect, createDatabase, withDatabase,
    connect: () => current().connect(), close: () => current().close(),
};
