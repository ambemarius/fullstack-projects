const jwt = require('jsonwebtoken');
const { authConfiguration } = require('../config/auth');
const { runtimeConfiguration } = require('../config/environment');

function generateToken(id, accountType, credentialVersion) {
    if (!Number.isSafeInteger(id) || id < 1 || !['admin', 'teacher', 'student', 'parent', 'auxiliary'].includes(accountType)) {
        throw new Error('A valid account identity and type are required');
    }
    const config = authConfiguration();
    if (credentialVersion !== undefined && (!Number.isSafeInteger(credentialVersion) || credentialVersion < 1)) throw new Error('Invalid credential version');
    return jwt.sign({ id, accountType, tokenVersion: 2, ...(credentialVersion === undefined ? {} : { credentialVersion }) }, config.secret, {
        algorithm: config.algorithm, issuer: config.issuer, audience: config.audience,
        subject: String(id), expiresIn: runtimeConfiguration().jwtExpiresIn,
    });
}

module.exports = generateToken;
