const { createLegacySchoolAccess } = require('../../model/identity/legacySchoolAccess');
const { createLegacyAllocationReads } = require('../../model/identity/legacyAllocationReads');
function id(value) {
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
        throw Object.assign(Error('Invalid academic reference'), { statusCode: 422 });
    }
    return Number(value);
}
async function handle(req, form = false) {
    const access = createLegacySchoolAccess();
    const context = await access.resolve(req.headers.authorization, ['admin']);
    const service = createLegacyAllocationReads(access);
    if (form) return service.formData(context);
    return service.list(context, {
        yearId: req.query.yearId === undefined ? undefined : id(req.query.yearId),
        classId: req.params.classId === undefined ? undefined : id(req.params.classId)
    });
}
module.exports = { handle };
