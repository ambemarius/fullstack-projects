// KodoSchool platform console API (KodoSchool's own administrators; they belong to no school).
//   POST /api/v1/platform/login                  sign in (email + password); bearer token only, no cookie
//   GET  /api/v1/platform/me                     the signed-in KodoSchool admin
//   PUT  /api/v1/platform/password               change own password
//   GET  /api/v1/platform/schools                every school: size and activity (counts and dates only)
//   PUT  /api/v1/platform/schools/:id/status     suspend or reactivate a school
//   GET  /api/v1/platform/signups?status=        school sign-ups
//   POST /api/v1/platform/signups/:id/approve    creates the school and its super administrator
//   POST /api/v1/platform/signups/:id/reject
//   GET  /api/v1/platform/audit                  log of console sign-ins and actions
const express = require('express');
const isPlatformLogin = require('../../middlewares/isPlatformLogin');
const { loginRateLimit } = require('../../middlewares/loginRateLimit');
const PlatformAdmin = require('../../model/platform/platformAdmin');
const generateToken = require('../../utils/generateToken');
const { createPlatformConsoleService } = require('../../model/platform/platformConsoleService');
const { createSchoolSignupService } = require('../../model/platform/schoolSignupService');

const router = express.Router();
let consoleDefault, signupDefault;
const consoleFor = req => req.app.locals.platformConsoleService || (consoleDefault ||= createPlatformConsoleService());
const signupsFor = req => req.app.locals.schoolSignupService || (signupDefault ||= createSchoolSignupService());
const adminsFor = req => req.app.locals.platformAdminModel || PlatformAdmin;
const handle = fn => async (req, res, next) => {
    try { await fn(req, res); } catch (err) {
        if (err.statusCode && err.statusCode < 500) return res.status(err.statusCode).json({ status: 'error', message: err.message, field: err.field });
        next(err);
    }
};
const ok = (res, data, status = 200) => res.status(status).json({ status: 'success', data });
const actor = req => ({ id: req.userAuth.id });

router.post('/login', loginRateLimit, handle(async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
        return res.status(400).json({ status: 'error', message: 'Enter your email and password.' });
    }
    const admin = await adminsFor(req).findForLogin(email);
    const match = admin && await adminsFor(req).verifyPassword(password, admin.password);
    if (!match) return res.status(401).json({ status: 'error', message: 'Invalid login credentials' });
    if (admin.status !== 'active') return res.status(403).json({ status: 'error', message: 'This account is disabled.' });
    await adminsFor(req).touchLogin(admin.id);
    await consoleFor(req).log(admin.id, 'signed_in', { ip: req.ip });
    const { password: _omit, ...safe } = admin;
    ok(res, { admin: safe, token: generateToken(admin.id, 'platform') });
}));

router.get('/me', isPlatformLogin, (req, res) => ok(res, req.userAuth));

router.put('/password', isPlatformLogin, handle(async (req, res) => {
    const { current, next } = req.body || {};
    const hash = await adminsFor(req).passwordHash(req.userAuth.id);
    if (typeof current !== 'string' || !hash || !await adminsFor(req).verifyPassword(current, hash)) {
        return res.status(422).json({ status: 'error', message: 'Your current password is not correct.', field: 'current' });
    }
    if (typeof next !== 'string' || next.length < 12 || next.length > 72 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
        return res.status(422).json({ status: 'error', message: 'Use at least 12 characters with letters and numbers.', field: 'next' });
    }
    await adminsFor(req).setPassword(req.userAuth.id, next);
    await consoleFor(req).log(req.userAuth.id, 'password_changed', { ip: req.ip });
    ok(res, { changed: true });
}));

router.get('/schools', isPlatformLogin, handle(async (req, res) => ok(res, await consoleFor(req).schools())));
router.put('/schools/:id/status', isPlatformLogin, handle(async (req, res) =>
    ok(res, await consoleFor(req).setStatus(actor(req), req.params.id, (req.body || {}).status, (req.body || {}).reason, req.ip))));

router.get('/signups', isPlatformLogin, handle(async (req, res) => ok(res, await signupsFor(req).list(req.query.status))));
router.post('/signups/:id/approve', isPlatformLogin, handle(async (req, res) => {
    const result = await signupsFor(req).approve(actor(req), req.params.id);
    await consoleFor(req).log(req.userAuth.id, 'signup_approved', { targetType: 'school', targetId: result.schoolId, detail: `Sign-up ${req.params.id}, code ${result.schoolCode}`, ip: req.ip });
    ok(res, result);
}));
router.post('/signups/:id/reject', isPlatformLogin, handle(async (req, res) => {
    const result = await signupsFor(req).reject(actor(req), req.params.id, (req.body || {}).note);
    await consoleFor(req).log(req.userAuth.id, 'signup_rejected', { targetType: 'signup', targetId: req.params.id, detail: (req.body || {}).note, ip: req.ip });
    ok(res, result);
}));

router.get('/audit', isPlatformLogin, handle(async (req, res) => ok(res, await consoleFor(req).audit(req.query.limit))));

module.exports = router;
