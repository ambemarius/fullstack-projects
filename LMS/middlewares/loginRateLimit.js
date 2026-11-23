const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

function identifierOf(body) {
    const value = body?.email ?? body?.matricule ?? body?.phone ?? '';
    return String(value).trim().toLowerCase();
}

const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: req => `${ipKeyGenerator(req.ip || '')}|${identifierOf(req.body)}`,
    skip: () => process.env.NODE_ENV === 'test' && process.env.LOGIN_RATE_LIMIT !== 'on',
    handler: (_req, res) => res.status(429).json({
        status: 'failed',
        message: 'Too many login attempts. Try again in a few minutes.',
    }),
});

module.exports = { loginRateLimit };
