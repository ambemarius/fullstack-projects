// Shared access check for school modules (finance, attendance, library, laboratory).
// Accepts an administrator, teacher or auxiliary-staff session and sets req.actor,
// the only identity those modules should rely on.
const { authenticateRequest } = require('./roleAuth');
const { isLegacyAdministrator } = require('../utils/legacyAccountRole');
const StaffDuty = require('../model/staff/staffDuty');

const LOADERS = {
    admin: id => require('../model/staff/admin').findById(id),
    teacher: id => require('../model/staff/teacher').findById(id),
    auxiliary: id => require('../model/staff/auxiliary').findById(id),
};

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });

function isActive(type, account) {
    if (type === 'admin') return isLegacyAdministrator(account.role);
    if (type === 'teacher') return account.status === 'active';
    return account.status === 'active' && Boolean(account.canSignIn);
}

// duties: any one of these grants access. allowAdmin: administrators always pass.
// allowTeacher: any active teacher passes (e.g. lab requests, marking own lessons).
// anyStaff: every active staff account passes (e.g. "my duties").
function requireStaff({ duties = [], allowAdmin = true, allowTeacher = false, anyStaff = false } = {}) {
    return async (req, _res, next) => {
        try {
            const claims = authenticateRequest(req);
            if (!claims) return next(fail(401, 'Authentication required'));
            const type = claims.accountType;
            if (!LOADERS[type]) return next(fail(403, 'A school staff account is required'));
            const account = await LOADERS[type](claims.id);
            if (!account) return next(fail(401, 'Authentication required'));
            if (!isActive(type, account)) return next(fail(403, 'This account is inactive'));

            const held = await StaffDuty.forStaff(type, claims.id);
            const allowed = anyStaff
                || (type === 'admin' && allowAdmin)
                || (type === 'teacher' && allowTeacher)
                || held.some(d => duties.includes(d));
            if (!allowed) return next(fail(403, 'Your account does not have this duty'));

            // A discipline master may look after chosen classes only (null = the whole school).
            const disciplineClasses = held.includes('discipline_master') ? await StaffDuty.disciplineClasses(type, claims.id) : null;

            const { password: _omit, ...safe } = account;
            req.userAuth = safe;
            req.auth = { accountType: type, legacyId: claims.id };
            req.actor = Object.freeze({
                schoolId: account.school_id ?? null,
                type,
                id: claims.id,
                name: account.name,
                duties: Object.freeze(held),
                disciplineClasses: disciplineClasses ? Object.freeze(disciplineClasses) : null,
            });
            next();
        } catch (err) {
            next(err);
        }
    };
}

module.exports = { requireStaff };
