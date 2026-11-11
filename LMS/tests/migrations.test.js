const { test } = require('node:test');
const assert = require('node:assert/strict');
const { migrate, migrationFiles } = require('../scripts/migrate');

function fixture({ tables = [], history = [], failMigration = false } = {}) {
    const calls = [];
    const database = { async connect() { calls.push('connect'); }, getPool: () => ({}) };
    const driver = {
        Transaction: class {
            async begin() { calls.push('begin'); }
            async commit() { calls.push('commit'); }
            async rollback() { calls.push('rollback'); }
        },
        Request: class {
            input() { return this; }
            async query(text) {
                calls.push(text);
                if (text.includes('sp_getapplock')) return { recordset: [{ result: 0 }] };
                if (text.includes('FROM sys.tables')) return { recordset: tables.map(name => ({ name })) };
                if (text.includes('SELECT version, checksum')) return { recordset: history };
                if (failMigration && text === 'synthetic migration') throw new Error('synthetic write failure');
                return { recordset: [] };
            }
        },
    };
    return { calls, database, driver };
}
const file = { name: '001_synthetic.sql', text: 'synthetic migration', checksum: 'synthetic-checksum' };

test('migration runner refuses an existing unversioned schema before writes', async () => {
    const f = fixture({ tables: ['students'] });
    await assert.rejects(migrate(f.database, [file], f.driver), /reviewed legacy/);
    assert.ok(f.calls.includes('rollback'));
    assert.equal(f.calls.some(s => /CREATE TABLE|INSERT INTO/.test(s)), false);
});

test('migration and ledger commit together on an empty target', async () => {
    const f = fixture();
    assert.deepEqual(await migrate(f.database, [file], f.driver), [file.name]);
    assert.equal(f.calls.at(-1), 'commit');
    assert.ok(f.calls.includes(file.text));
    assert.ok(f.calls.some(s => s.includes('INSERT INTO schema_migrations')));
});

test('applied migration is not repeated and checksum tampering is rejected', async () => {
    const f = fixture({ tables: ['schema_migrations'], history: [{ version: file.name, checksum: file.checksum }] });
    assert.deepEqual(await migrate(f.database, [file], f.driver), []);
    assert.equal(f.calls.includes(file.text), false);
    const bad = fixture({ tables: ['schema_migrations'], history: [{ version: file.name, checksum: 'changed' }] });
    await assert.rejects(migrate(bad.database, [file], bad.driver), /checksum mismatch/);
    assert.equal(bad.calls.at(-1), 'rollback');
});

test('failed migration rolls back without a ledger success', async () => {
    const f = fixture({ failMigration: true });
    await assert.rejects(migrate(f.database, [file], f.driver), /synthetic write failure/);
    assert.equal(f.calls.at(-1), 'rollback');
    assert.equal(f.calls.some(s => s.includes('INSERT INTO schema_migrations')), false);
});

test('baseline foreign-key parents are created before their children', () => {
    const [baseline] = migrationFiles();
    const seen = new Set();
    for (const table of baseline.text.matchAll(/CREATE TABLE (\w+)\s*\(([\s\S]*?)\n\);/g)) {
        for (const fk of table[2].matchAll(/REFERENCES (\w+)\(/g)) {
            assert.ok(seen.has(fk[1]), `${table[1]} references unavailable ${fk[1]}`);
        }
        seen.add(table[1]);
    }
    assert.equal(seen.size, 23);
});
