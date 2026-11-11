const { createLegacySchoolAccess } = require('../../model/identity/legacySchoolAccess');
const { createLegacyReferenceReads } = require('../../model/identity/legacyReferenceReads');
function id(value) {
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw Object.assign(Error('Invalid reference'), { statusCode: 422 });
    return Number(value);
}
async function handle(req, method, kind, target) {
    const access = createLegacySchoolAccess(), context = await access.resolve(req.headers.authorization, ['admin']);
    const service = createLegacyReferenceReads(access);
    if (method === 'context') return service.context(context);
    if (method === 'classSubjects') return service.classSubjects(context, id(target), req.query.term || undefined);
    if (method === 'geography') return service.geography(context, kind, target === undefined ? undefined : id(target));
    return service.records(context, kind, target === undefined ? undefined : id(target));
}
module.exports = { handle };
