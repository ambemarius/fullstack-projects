const test = require('node:test'), assert = require('node:assert/strict');
const { placementReview, createAcademicHistoryReviewService } = require('../model/identity/academicHistoryReviewService');
test('history candidates never fabricate a placement or effective dates', () => {
    assert.deepEqual(placementReview([]), { status: 'unknown', candidateClassIds: [], authoritative: false, effectiveFrom: null, effectiveTo: null });
    assert.equal(placementReview([{ classId: 5 }, { classId: 5 }]).status, 'requires_confirmation');
    const multiple = placementReview([{ classId: 7 }, { classId: 5 }]);
    assert.equal(multiple.status, 'multiple_candidates');
    assert.deepEqual(multiple.candidateClassIds, [5, 7]);
    assert.equal(multiple.authoritative, false);
});
test('history rejects invalid scope and non-admin authority before SQL access', async () => {
    const service = createAcademicHistoryReviewService({ authorize: async () => { throw Object.assign(new Error('Access denied'), { statusCode: 403 }); } },
        { connect: () => { throw Error('Unexpected SQL access'); } });
    for (const method of ['student', 'teacher']) {
        for (const value of [0, -1, 1.5, '1', 2147483648, null, undefined]) await assert.rejects(service[method]({}, value, 1), e => e.statusCode === 422);
        await assert.rejects(service[method]({}, 1, 2), e => e.statusCode === 403);
    }
});
test('oversized history evidence fails rather than silently certifying a truncated candidate set', async () => {
    const descriptor = { schoolId: 1, accountId: 2, membershipId: 3, tokenHash: 'a'.repeat(64) };
    const rows = Array.from({ length: 1001 }, (_, i) => ({ sourceId: i + 1, classId: 5, yearId: 7 }));
    let sets = [[{ studentId: 4 }], rows, []];
    const req = { input() { return this; }, async query() { return { recordsets: sets }; } };
    const service = createAcademicHistoryReviewService({ authorize: async () => descriptor },
        { connect: async () => {}, getPool: () => ({ request: () => req }) });
    await assert.rejects(service.student({}, 4, 7), e => e.statusCode === 409);
    sets = [[{ teacherId: 4 }], rows];
    await assert.rejects(service.teacher({}, 4, 7), e => e.statusCode === 409);
});
