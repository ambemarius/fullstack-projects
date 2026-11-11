// Conservative legacy-record interpretation. Does not write or apply a legacy migration.
function flag(value) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    return null;
}

function teacherStatus(row) {
    const withdrawn = flag(row.isWithdrawn);
    const suspended = flag(row.isSuspended);
    const current = ['active', 'suspended', 'withdrawn'].includes(row.status) ? row.status : null;
    const legacy = withdrawn === true ? 'withdrawn' : suspended === true ? 'suspended'
        : withdrawn === false && suspended === false ? 'active' : null;
    const order = ['active', 'suspended', 'withdrawn'];
    const resolved = current && legacy ? order[Math.max(order.indexOf(current), order.indexOf(legacy))]
        : current || legacy;
    return {
        status: resolved,
        needsReview: !resolved || Boolean(current && legacy && current !== legacy),
        original: { status: row.status ?? null, isWithdrawn: row.isWithdrawn ?? null, isSuspended: row.isSuspended ?? null },
    };
}

function studentFacts(row) {
    return {
        firstName: row.firstName ?? null, middleName: row.middleName ?? null, lastName: row.lastName ?? null,
        legacyName: row.name ?? null,
        sex: ['Male', 'Female'].includes(row.sex) ? row.sex : null,
        yearOfEnrollment: Number.isInteger(row.yearOfEnrollment) ? row.yearOfEnrollment : null,
        needsReview: !row.firstName || !row.lastName || !['Male', 'Female'].includes(row.sex) || !Number.isInteger(row.yearOfEnrollment),
    };
}

module.exports = { teacherStatus, studentFacts };
