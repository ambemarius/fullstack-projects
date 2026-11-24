const jwt = require('jsonwebtoken');
const { authConfiguration } = require('../config/auth');

function verifyToken(token, expectedType) {
    const config = authConfiguration();
    try {
        const claims = jwt.verify(token, config.secret, {
            algorithms: [config.algorithm], issuer: config.issuer, audience: config.audience,
        });
        if (!claims || claims.tokenVersion !== 2 || !Number.isSafeInteger(claims.id) || claims.id < 1 ||
            claims.sub !== String(claims.id) || !Number.isInteger(claims.exp) ||
            !['admin', 'teacher', 'student', 'parent', 'auxiliary', 'platform'].includes(claims.accountType) ||
            (claims.credentialVersion !== undefined && (!Number.isSafeInteger(claims.credentialVersion) || claims.credentialVersion < 1)) ||
            (claims.sid !== undefined && (!Number.isSafeInteger(claims.sid) || claims.sid < 1)) ||
            (expectedType && claims.accountType !== expectedType)) return false;
        return claims;
    } catch {
        return false;
    }
}

module.exports = verifyToken;
