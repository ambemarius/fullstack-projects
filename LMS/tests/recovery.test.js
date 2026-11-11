const { test } = require('node:test');
const assert = require('node:assert/strict');
const { restoreScript, reconstructedCounts } = require('../scripts/recoveryRehearsal');

const plan = {
    backupPath: 'C:\\SQL Backups\\synthetic.bak', dataPath: 'C:\\SQL Data', logPath: 'C:\\SQL Logs',
    suffix: '0123456789abcdef', files: [{ LogicalName: 'synthetic_data', Type: 'D' }, { LogicalName: 'synthetic_log', Type: 'L' }],
};

test('recovery script names only the dedicated restore target and refuses replacement', () => {
    const text = restoreScript(plan);
    assert.match(text, /IF DB_ID\(N'lms_test_codex_restore'\) IS NOT NULL/);
    assert.match(text, /RESTORE DATABASE \[lms_test_codex_restore\]/);
    assert.doesNotMatch(text, /WITH[^;]*\bREPLACE\b/i);
    assert.doesNotMatch(text, /DROP DATABASE|SINGLE_USER|ALTER LOGIN/i);
    assert.match(text, /CHECKSUM/);
});

test('recovery rejects unsupported layouts and escapes backup paths', () => {
    assert.throws(() => restoreScript({ ...plan, suffix: '../escape' }));
    assert.throws(() => restoreScript({ ...plan, files: [] }));
    assert.match(restoreScript({ ...plan, backupPath: "C:\\O'Brien\\backup.bak" }), /O''Brien/);
});

test('manifest reconstruction adjusts only the recorded probe table', () => {
    const original = { 'dbo.Admins': '0', 'dbo.subjects': '5' };
    assert.deepEqual(reconstructedCounts(original), { 'dbo.Admins': '0', 'dbo.subjects': '6' });
    assert.equal(original['dbo.subjects'], '5');
    assert.throws(() => reconstructedCounts({}));
});

test('unique restore packets validate namespace and assert their exact probe', () => {
    const target = 'lms_test_codex_restore_0123456789abcdef';
    const text = restoreScript({ ...plan, target, probeCode: 'REC_0123456789abcdef' });
    assert.match(text, /RESTORE DATABASE \[lms_test_codex_restore_0123456789abcdef\]/);
    assert.match(text, /Recovery probe missing/);
    assert.match(text, /REC_0123456789abcdef/);
    assert.throws(() => restoreScript({ ...plan, target: 'schooldb' }));
    assert.throws(() => restoreScript({ ...plan, probeCode: "invalid'code" }));
});
