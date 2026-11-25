// Any signed-in school account (administrator, teacher, student, parent or staff member), checked the same way
// as its own pages; the request then runs inside the account's school.
const { authenticateRequest } = require('./roleAuth');
const handlers = {
    admin: require('./isLogin'),
    teacher: require('./isTeacherLogin'),
    student: require('./isStudentLogin'),
    parent: require('./isParentLogin'),
    auxiliary: require('./isAuxiliaryLogin'),
};

module.exports = (req, res, next) => {
    try {
        const claims = authenticateRequest(req);
        if (!claims || !handlers[claims.accountType]) return next(Object.assign(new Error('Authentication required'), { statusCode: 401 }));
        return handlers[claims.accountType](req, res, next);
    } catch (err) {
        next(err);
    }
};
