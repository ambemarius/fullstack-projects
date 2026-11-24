// School sign-up (public) and its validation by KodoSchool staff.
//   GET  /api/v1/school-signup/regions               public: regions for the form
//   GET  /api/v1/school-signup/divisions?regionId=   public: divisions of a region
//   POST /api/v1/school-signup                       public: send a sign-up for validation (rate limited)
// Validation happens in the KodoSchool platform console (routes/platform/platformRouter.js).
const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { createSchoolSignupService } = require('../../model/platform/schoolSignupService');

const router = express.Router();
let defaultService;
const serviceFor = req => req.app.locals.schoolSignupService || (defaultService ||= createSchoolSignupService());
const handle = fn => async (req, res, next) => {
    try { await fn(req, res); } catch (err) {
        if (err.statusCode && err.statusCode < 500) return res.status(err.statusCode).json({ status: 'error', message: err.message, field: err.field });
        next(err);
    }
};
const ok = (res, data, status = 200) => res.status(status).json({ status: 'success', data });

const signupLimit = rateLimit({
    windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false,
    keyGenerator: req => ipKeyGenerator(req.ip || ''),
    skip: () => process.env.NODE_ENV === 'test' && process.env.SIGNUP_RATE_LIMIT !== 'on',
    handler: (_req, res) => res.status(429).json({ status: 'error', message: 'Too many sign-ups from this connection. Try again in an hour.' }),
});

router.get('/regions', handle(async (req, res) => ok(res, await serviceFor(req).regions())));
router.get('/divisions', handle(async (req, res) => ok(res, await serviceFor(req).divisions(req.query.regionId))));
router.post('/', signupLimit, handle(async (req, res) => ok(res, await serviceFor(req).submit(req.body || {}, { ip: req.ip }), 201)));

module.exports = router;
