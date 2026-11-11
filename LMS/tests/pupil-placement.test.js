const test = require('node:test'), assert = require('node:assert/strict');
const { validateCurrentTransfer, createEnrolmentLedgerService } = require('../model/identity/enrolmentLedgerService');
const input = { version: 1, profileVersion: 1, classId: 2, yearId: 3, onDate: '2025-01-01', sourceReference: 'Transfer register 1', reason: 'Reviewed class transfer' };
test('current transfers require both versions, explicit provenance and no caller access or historical correction fields', () => {
    assert.equal(validateCurrentTransfer(input), input);
    for (const patch of [{ profileVersion: 0 }, { profileVersion: '1' }, { profileVersion: 2147483647 }, { version: 0 },
        { schoolId: 9 }, { studentId: 7 }, { toDate: null }, { status: 'withdrawn' }, { password: 'ignored' }, { onDate: '2025-02-29' }, { reason: '' }])
        assert.throws(() => validateCurrentTransfer({ ...input, ...patch }), e => e.statusCode === 422);
});
test('current transfers refuse unauthorized callers before opening SQL', async () => {
    const service = createEnrolmentLedgerService({ authorize: async () => { throw Object.assign(new Error('Denied'), { statusCode: 403 }); } },
        { connect: () => { throw Error('Unexpected connection'); } });
    await assert.rejects(service.transferCurrent({}, 1, input), e => e.statusCode === 403);
});
