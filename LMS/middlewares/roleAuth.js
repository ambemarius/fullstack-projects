const verifyToken = require('../utils/verifyToken');
const {isLegacyAdministrator}=require('../utils/legacyAccountRole');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function extractToken(req) {
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
    if (match) return { token: match[1], source: 'bearer' };
    const cookies = req.headers.cookie;
    if (!cookies) return null;
    const tokenCookie = cookies.split(';').map(c => c.trim()).find(c => c.startsWith('lms_token='));
    return tokenCookie ? { token: tokenCookie.slice('lms_token='.length), source: 'cookie' } : null;
}

function originOf(value) {
    try { return new URL(value).origin; } catch { return null; }
}

// Cookie credentials are sent automatically by browsers, so state-changing
// requests must prove they came from this site (Origin/Referer check).
function sameOriginRequest(req) {
    const header = req.headers.origin || req.headers.referer;
    if (!header) return false;
    const requestOrigin = originOf(header);
    if (!requestOrigin) return false;
    const configured = originOf(req.app?.locals?.publicOrigin || '');
    if (configured) return requestOrigin === configured;
    const host = req.headers.host;
    return Boolean(host) && new URL(requestOrigin).host === host;
}

function crossSiteError() {
    const err = new Error('Cross-site request blocked');
    err.statusCode = 403;
    return err;
}

function authenticateRequest(req, expectedType) {
    const credential = extractToken(req);
    const claims = credential && verifyToken(credential.token, expectedType);
    if (!claims) return null;
    if (credential.source === 'cookie' && !SAFE_METHODS.has(req.method) && !sameOriginRequest(req)) {
        throw crossSiteError();
    }
    return claims;
}

function createRoleAuth({ accountType, findById }) {
    return async (req, _res, next) => {
        try {
            const claims = authenticateRequest(req, accountType);
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
                (accountType === 'student' && account.isWithdrawn) ||
                (accountType === 'parent' && account.status && account.status !== 'active') ||
                (accountType === 'auxiliary' && (account.status !== 'active' || !account.canSignIn))) {
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

module.exports = { createRoleAuth, extractToken, authenticateRequest, sameOriginRequest };
