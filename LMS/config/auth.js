const { loadEnvironment } = require('./environment');

function authConfiguration(env = process.env) {
    if (env === process.env) loadEnvironment();
    const secret = env.JWT_SECRET;
    if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
        throw new Error('JWT_SECRET must be configured with at least 32 bytes');
    }
    return { secret, issuer: 'lms', audience: 'lms-web', algorithm: 'HS256' };
}

module.exports = { authConfiguration };
