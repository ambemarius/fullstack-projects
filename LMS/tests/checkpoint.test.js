const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { permitted, verify } = require('../scripts/sourceCheckpoint');

test('source checkpoints exclude secrets, dependencies and traversal paths', () => {
    for (const file of ['config/.env', 'config/.env.test.local', '../config/auth.js', '/config/auth.js', 'C:/config/auth.js', 'config\\auth.js', 'node_modules/package.json', 'backups/source.json']) {
        assert.equal(permitted(file), false, file);
    }
    assert.equal(permitted('config/.env.example'), true);
    assert.equal(permitted('config/auth.js'), true);
});

test('source checkpoint rejects tampering and duplicate entries', () => {
    const bytes = Buffer.from('synthetic source');
    const file = { path: 'server.js', content: bytes.toString('base64'), sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    assert.equal(verify({ format: 'lms-source-checkpoint-v1', files: [file] }), 1);
    assert.throws(() => verify({ format: 'lms-source-checkpoint-v1', files: [file, file] }));
    assert.throws(() => verify({ format: 'lms-source-checkpoint-v1', files: [{ ...file, content: '' }] }));
});
