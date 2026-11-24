// School isolation, lock 1: every request runs inside the school of its signed token (claim "sid").
// Nothing else sets the school: a school id in a form, query string, body or header is ignored.
// Account middlewares (roleAuth, staffAccess) then confirm the school against the account itself.
const verifyToken = require('../utils/verifyToken');
const { runWithSchool, runWithoutSchool, optionalSchoolId } = require('../utils/tenant');

function tokenSchool(req, extractToken) {
    try {
        const credential = extractToken(req);
        const claims = credential && verifyToken(credential.token);
        return claims && claims.sid ? claims.sid : null;
    } catch {
        return null;
    }
}

function tenantContext(req, _res, next) {
    const { extractToken } = require('./roleAuth');
    const sid = tokenSchool(req, extractToken);
    req.schoolId = sid;
    return sid ? runWithSchool(sid, next) : runWithoutSchool(next);
}

// Used by account middlewares once the account is loaded: the account's own school wins, a token for
// another school is refused, and the rest of the request runs inside that school.
function confirmSchool(req, claims, account, next) {
    const accountSchool = Number.isSafeInteger(account?.school_id) && account.school_id > 0 ? account.school_id : null;
    if (claims.sid && accountSchool && claims.sid !== accountSchool) {
        return next(Object.assign(new Error('Sign in again'), { statusCode: 401 }));
    }
    const schoolId = accountSchool || claims.sid || null;
    req.schoolId = schoolId;
    return schoolId && schoolId !== optionalSchoolId() ? runWithSchool(schoolId, next) : next();
}

module.exports = { tenantContext, confirmSchool };
