const verifyToken = require('../utils/verifyToken');
const {isLegacyAdministrator}=require('../utils/legacyAccountRole');

function extractToken(req) {
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
    if (match) return match[1];
    const cookies = req.headers.cookie;
    if (!cookies) return null;
    const tokenCookie = cookies.split(';').map(c => c.trim()).find(c => c.startsWith('lms_token='));
    return tokenCookie ? tokenCookie.slice('lms_token='.length) : null;
}

function createRoleAuth({ accountType, findById }) {
    return async (req, _res, next) => {
        try {
            const token = extractToken(req);
            const claims = token && verifyToken(token, accountType);
            if (!claims) {
                const err = new Error('Authentication required');
                err.statusCode = 401;
                return next(err);
            }
            const account = await findById(claims.id);
            if (!account) {
                const err = new Error('Authentication required');
                err.statusCode = 401;
                return next(err);
            }
            if ((accountType === 'admin' && !isLegacyAdministrator(account.role)) ||
                (accountType === 'teacher' && account.status !== 'active') ||
                (accountType === 'student' && account.isWithdrawn)) {
                const err = new Error('This account is inactive');
                err.statusCode = 403;
                return next(err);
            }
            const { password, ...safe } = account;
            if (req.app?.locals?.legacyCredentialVersionsEnabled) {
                const version = await require('../model/identity/legacyCredentialVersion').legacyCredentialVersion(accountType, claims.id);
                if ((claims.credentialVersion ?? 1) !== version) return next(Object.assign(new Error('Sign in again after credential recovery'), {statusCode:401}));
            }
            req.userAuth = safe;
            req.auth = { accountType, legacyId: claims.id };
            next();
        } catch (err) {
            next(err);
        }
    };
}

module.exports = { createRoleAuth };
