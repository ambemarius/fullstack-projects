// First sign-in: a teacher whose password was set by the administration must choose their own before using
// KodoSchool. Until then every teacher request is refused (403, code PASSWORD_CHANGE_REQUIRED) except the few
// the change-password page needs. Used by roleAuth and staffAccess, so no teacher screen can skip it.
const ALLOWED = new Set(['POST /api/v1/teachers/change-password', 'GET /api/v1/teachers/profile']);

async function firstPasswordBlock(req, accountType, accountId) {
    if (accountType !== 'teacher') return null;
    if (ALLOWED.has(`${req.method} ${req.originalUrl.split('?')[0].replace(/\/+$/, '')}`)) return null;
    const check = req.app?.locals?.mustChangePassword || (id => require('../model/staff/teacher').mustChangePassword(id));
    let mustChange = false;
    // A prompt for an already signed-in teacher, not a credential check: if the flag cannot be read, let the request through.
    try { mustChange = await check(accountId); } catch { mustChange = false; }
    if (!mustChange) return null;
    return Object.assign(new Error('Choose your own password before continuing.'), { statusCode: 403, publicCode: 'PASSWORD_CHANGE_REQUIRED' });
}

module.exports = { firstPasswordBlock };
