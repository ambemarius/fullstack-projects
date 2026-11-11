const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createIdentityService } = require('../model/identity/identityService');

test('malformed identity/session input is rejected before touching a database', async () => {
    const service = createIdentityService({ connect() { throw new Error('Unexpected SQL access'); } });
    assert.equal(await service.resolveSession('forged'), null);
    assert.equal(await service.validateCsrf('forged', 'forged'), false);
    await service.revokeSession('forged');
    await assert.rejects(service.createSession('1', 1), /Access denied/);
    await assert.rejects(service.createSession(1, -1), /Access denied/);
    await assert.rejects(service.inviteSchool('forged', {}), /Access denied/);
    await assert.rejects(service.acceptInvitation('forged','long-synthetic-password','request'), /Access denied/);
    await assert.rejects(service.acceptInvitation('a'.repeat(43),'short','request'), /Access denied/);
    await assert.rejects(service.acceptInvitation('a'.repeat(43),'é'.repeat(37),'request'), /Access denied/);
    await assert.rejects(service.switchSchool('forged','SCHOOL'), /Access denied/);
    await assert.rejects(service.login(' padded ','password','SCHOOL'), /Access denied/);
});
