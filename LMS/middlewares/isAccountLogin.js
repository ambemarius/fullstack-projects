const { authenticateRequest } = require('./roleAuth');
const handlers = {
    admin: require('./isLogin'),
    teacher: require('./isTeacherLogin'),
    student: require('./isStudentLogin'),
};

module.exports = async (req, res, next) => {
    try {
        const claims = authenticateRequest(req);
        if (!claims || !handlers[claims.accountType]) {
            const err = new Error('Authentication required');
            err.statusCode = 401;
            return next(err);
        }
        return handlers[claims.accountType](req, res, next);
    } catch (err) {
        next(err);
    }
};
