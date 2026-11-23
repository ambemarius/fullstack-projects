const jwt = require('jsonwebtoken');

const COOKIE_OPTIONS = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
});

// The JWT's own exp is authoritative; the cookie just must not outlive it.
function cookieMaxAge(token) {
    const exp = jwt.decode(token)?.exp;
    return exp ? Math.max(0, exp * 1000 - Date.now()) : 60 * 60 * 1000;
}

function setAuthCookie(res, token) {
    res.cookie('lms_token', token, { ...COOKIE_OPTIONS(), maxAge: cookieMaxAge(token) });
}

function clearAuthCookie(res) {
    res.clearCookie('lms_token', COOKIE_OPTIONS());
}

module.exports = { setAuthCookie, clearAuthCookie };
