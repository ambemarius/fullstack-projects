const { test } = require('node:test');
const assert = require('node:assert/strict');
const { teacherStatus, studentFacts } = require('../migrations/legacyPolicy');

test('legacy teacher interpretation never reactivates an inactive record', () => {
    assert.equal(teacherStatus({ isWithdrawn: 1, isSuspended: 1 }).status, 'withdrawn');
    assert.equal(teacherStatus({ isWithdrawn: 0, isSuspended: 1 }).status, 'suspended');
    assert.equal(teacherStatus({ isWithdrawn: 0, isSuspended: 0 }).status, 'active');
    const conflict = teacherStatus({ status: 'active', isWithdrawn: 1 });
    assert.equal(conflict.status, 'withdrawn');
    assert.equal(conflict.needsReview, true);
    assert.equal(conflict.original.status, 'active');
    assert.equal(teacherStatus({ status: 'withdrawn', isWithdrawn: 0, isSuspended: 0 }).status, 'withdrawn');
    assert.equal(teacherStatus({}).status, null);
    assert.equal(teacherStatus({}).needsReview, true);
});

test('legacy student facts preserve unknown demographics and original name', () => {
    for (const id of [1, 2, 100]) {
        const result = studentFacts({ id, name: 'Synthetic Legacy Name' });
        assert.equal(result.sex, null);
        assert.equal(result.yearOfEnrollment, null);
        assert.equal(result.firstName, null);
        assert.equal(result.legacyName, 'Synthetic Legacy Name');
        assert.equal(result.needsReview, true);
    }
    const known = studentFacts({ firstName: 'Synthetic', lastName: 'Student', sex: 'Female', yearOfEnrollment: 2024 });
    assert.equal(known.needsReview, false);
    assert.equal(known.yearOfEnrollment, 2024);
});
