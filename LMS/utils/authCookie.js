function setAuthCookie(res, token) {
    res.cookie('lms_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 1000,
        path: '/',
    });
}

function clearAuthCookie(res) {
    res.clearCookie('lms_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });
}

module.exports = { setAuthCookie, clearAuthCookie };
