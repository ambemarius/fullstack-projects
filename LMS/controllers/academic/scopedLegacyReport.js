const { createLegacySchoolAccess } = require('../../model/identity/legacySchoolAccess');
const { createLegacyReportReads } = require('../../model/identity/legacyReportReads');
async function rows(req) {
    const access = createLegacySchoolAccess(), context = await access.resolve(req.headers.authorization, ['admin']);
    const { classId, academicYearId, term } = req.params;
    if (![classId, academicYearId].every(value => typeof value === 'string' && /^[1-9]\d*$/.test(value))) {
        throw Object.assign(Error('Invalid report reference'), { statusCode: 422 });
    }
    return createLegacyReportReads(access).rows(context, { classId: Number(classId), yearId: Number(academicYearId), term });
}
module.exports = { rows };
