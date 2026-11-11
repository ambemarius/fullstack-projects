const test = require('node:test'), assert = require('node:assert/strict');
const { createLegacyReferenceReads } = require('../model/identity/legacyReferenceReads');
const { createLegacyReportReads } = require('../model/identity/legacyReportReads');
const { createLegacySelfReads } = require('../model/identity/legacySelfReads');
const denied = { async authorize() { throw Object.assign(Error('Denied'), { statusCode: 401 }); } };
const noDatabase = { connect() { throw Error('Unexpected SQL'); } };
test('retained reference reads reject unknown projections, malformed IDs, terms and missing authority before SQL', async () => {
    const service = createLegacyReferenceReads(denied, noDatabase);
    for (const action of [() => service.records({}, 'accounts'), () => service.records({}, 'classes', 0),
        () => service.classSubjects({}, undefined), () => service.classSubjects({}, 1, 'Invalid'),
        () => service.geography({}, 'schools'), () => service.geography({}, 'divisions', '1')]) {
        await assert.rejects(action(), error => error.statusCode === 422);
    }
    for (const action of [() => service.records({}, 'classes'), () => service.context({}), () => service.geography({}, 'regions')]) {
        await assert.rejects(action(), error => error.statusCode === 401);
    }
});
test('report reads validate references and require administrator authority before opening SQL', async () => {
    const service = createLegacyReportReads(denied, noDatabase);
    await assert.rejects(service.rows({}, { classId: 1, yearId: 2, term: 'Unknown' }), error => error.statusCode === 422);
    await assert.rejects(service.rows({}, { classId: 1, yearId: 2, term: 'First' }), error => error.statusCode === 401);
});
test('self-profile reads refuse absent authority and reject administrator contexts before SQL', async () => {
    await assert.rejects(createLegacySelfReads(denied, noDatabase).profile({}), error => error.statusCode === 401);
    await assert.rejects(createLegacySelfReads({ authorize: async () => ({ accountType: 'admin' }) }, noDatabase).profile({}), error => error.statusCode === 401);
});
