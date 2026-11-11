const { createLegacySchoolAccess } = require('../../model/identity/legacySchoolAccess');
const { createLegacySelfReads } = require('../../model/identity/legacySelfReads');
async function profile(req) {
    const access = createLegacySchoolAccess(), context = await access.resolve(req.headers.authorization, ['teacher', 'student']);
    return createLegacySelfReads(access).profile(context);
}
module.exports = { profile };
