const jwt = require('jsonwebtoken');
const { authConfiguration } = require('../config/auth');
const { runtimeConfiguration } = require('../config/environment');

// schoolId: the school the account belongs to, carried as the signed claim "sid" (school isolation, lock 1).
function generateToken(id, accountType, credentialVersion, schoolId) {
    if (!Number.isSafeInteger(id) || id < 1 || !['admin', 'teacher', 'student', 'parent', 'auxiliary', 'platform'].includes(accountType)) {
        throw new Error('A valid account identity and type are required');
    }
    const config = authConfiguration();
    if (credentialVersion !== undefined && (!Number.isSafeInteger(credentialVersion) || credentialVersion < 1)) throw new Error('Invalid credential version');
    if (schoolId !== undefined && schoolId !== null && (!Number.isSafeInteger(schoolId) || schoolId < 1)) throw new Error('Invalid school');
    return jwt.sign({ id, accountType, tokenVersion: 2, ...(credentialVersion === undefined ? {} : { credentialVersion }), ...(schoolId ? { sid: schoolId } : {}) }, config.secret, {
        algorithm: config.algorithm, issuer: config.issuer, audience: config.audience,
        subject: String(id), expiresIn: runtimeConfiguration().jwtExpiresIn,
    });
}

module.exports = generateToken;
