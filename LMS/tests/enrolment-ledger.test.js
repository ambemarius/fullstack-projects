const test = require('node:test'), assert = require('node:assert/strict');
const { validatePlacement, validateTransfer, validLedgerDate, createEnrolmentLedgerService } = require('../model/identity/enrolmentLedgerService');
const placement = { studentId: 1, classId: 2, yearId: 3, fromDate: '2024-09-01', toDate: null, status: 'enrolled', sourceReference: 'Register page 7', reason: 'Verified placement' };
test('ledger dates and provenance are explicit and invalid or injected fields are refused', () => {
    assert.equal(validLedgerDate('2024-02-29'), true);
    for (const value of ['2023-02-29', '2024-04-31', '2024-1-01', '2024-01-01T00:00:00Z', '0000-01-01', null, 2024]) assert.equal(validLedgerDate(value), false);
    assert.equal(validatePlacement(placement), placement);
    for (const patch of [{ schoolId: 9 }, { studentId: '1' }, { fromDate: '2024-02-30' }, { toDate: undefined }, { status: 'active' },
        { toDate: '2024-09-01' }, { sourceReference: '' }, { sourceReference: 'a'.repeat(201) }, { reason: '\n' }, { actorAccountId: 4 }, { status: 'completed' }]) {
        assert.throws(() => validatePlacement({ ...placement, ...patch }), e => e.statusCode === 422);
    }
    assert.equal(validatePlacement({ ...placement, toDate: '2025-06-01', status: 'completed' }).status, 'completed');
    const { studentId, ...fields } = placement;
    assert.equal(validatePlacement({ ...fields, version: 1, status: 'voided' }, true).status, 'voided');
    assert.throws(() => validatePlacement({ ...placement, version: 1 }, true), e => e.statusCode === 422);
    const transfer = { version: 1, classId: 2, yearId: 3, onDate: '2025-01-01', toDate: null, sourceReference: 'Transfer register 2', reason: 'Reviewed transfer' };
    assert.equal(validateTransfer(transfer), transfer);
    assert.throws(() => validateTransfer({ ...transfer, onDate: '2025-02-29' }), e => e.statusCode === 422);
    assert.throws(() => validateTransfer({ ...transfer, toDate: '2024-12-31' }), e => e.statusCode === 422);
});
test('enrolment service refuses non-admin authority before any SQL or transaction', async () => {
    const service = createEnrolmentLedgerService({ authorize: async () => { throw Object.assign(new Error('Access denied'), { statusCode: 403 }); } },
        { connect: () => { throw Error('Unexpected SQL access'); } });
    await assert.rejects(service.record({}, placement), e => e.statusCode === 403);
    const { studentId, ...fields } = placement;
    await assert.rejects(service.revise({}, 1, { ...fields, version: 1 }), e => e.statusCode === 403);
    await assert.rejects(service.transfer({}, 1, { version: 1, classId: 3, yearId: 4, onDate: '2025-01-01', toDate: null, sourceReference: 'Source', reason: 'Transfer' }), e => e.statusCode === 403);
    await assert.rejects(service.history({}, 1), e => e.statusCode === 403);
    await assert.rejects(service.roster({}, { classId: 2, yearId: 3, onDate: '2024-10-01' }), e => e.statusCode === 403);
});
