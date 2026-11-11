const asyncHandler = require('express-async-handler');
const Parent = require('../../model/Academic/parent');
const SubjectScore = require('../../model/Academic/subjectScore');
const generateToken = require('../../utils/generateToken');
const { setAuthCookie } = require('../../utils/authCookie');

const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

exports.registerParentCtrl = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, phone, password, relationship } = req.body || {};
    if (!firstName || !lastName || !phone || !password) {
        throw httpError(400, 'firstName, lastName, phone and password are required');
    }
    const exists = await Parent.findByPhone(phone);
    if (exists) throw httpError(409, 'An account with this phone number already exists');

    const parent = await Parent.create({ firstName, lastName, email, phone, password, relationship });
    const { password: _omit, ...safe } = parent;
    res.status(201).json({ status: 'success', data: safe });
});

exports.loginParentCtrl = asyncHandler(async (req, res) => {
    const { phone, password } = req.body || {};
    if (!phone || !password) throw httpError(400, 'phone and password are required');

    const parent = await Parent.findByPhone(phone);
    const isMatch = parent && await Parent.verifyPassword(password, parent.password);
    if (!parent || !isMatch) throw httpError(401, 'Invalid login credentials');

    const token = generateToken(parent.id, 'parent');
    setAuthCookie(res, token);
    const { password: _omit, ...safe } = parent;
    res.status(200).json({ status: 'success', data: safe, token });
});

exports.getParentProfileCtrl = asyncHandler(async (req, res) => {
    const parent = await Parent.findById(req.auth.id);
    if (!parent) throw httpError(404, 'Parent not found');
    const { password: _omit, ...safe } = parent;
    res.status(200).json({ status: 'success', data: safe });
});

exports.getChildrenCtrl = asyncHandler(async (req, res) => {
    const children = await Parent.getChildren(req.auth.id);
    res.status(200).json({ status: 'success', data: children });
});

exports.linkChildCtrl = asyncHandler(async (req, res) => {
    const { studentId } = req.body || {};
    if (!studentId) throw httpError(400, 'studentId is required');
    await Parent.linkChild(req.auth.id, studentId);
    res.status(200).json({ status: 'success', message: 'Child linked successfully' });
});

exports.getChildReportCtrl = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const children = await Parent.getChildren(req.auth.id);
    const isLinked = children.some(c => c.id === Number(studentId));
    if (!isLinked) throw httpError(403, 'You do not have access to this student');

    const { sql, pool, poolConnect } = require('../../config/database');
    await poolConnect;
    const result = await pool.request()
        .input('studentId', sql.Int, +studentId)
        .query(`SELECT ss.term, ss.sequence, ss.score, ss.max_score,
                       subj.name AS subjectName, subj.code AS subjectCode
                FROM subject_scores ss
                JOIN class_subjects cs ON cs.id = ss.class_subject_id
                JOIN subjects subj ON subj.id = cs.subject_id
                WHERE ss.student_id = @studentId
                ORDER BY ss.term, subj.name, ss.sequence`);

    res.status(200).json({ status: 'success', data: result.recordset });
});
