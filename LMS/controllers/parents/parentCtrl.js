const asyncHandler = require('express-async-handler');
const Parent = require('../../model/Academic/parent');
const Student = require('../../model/Academic/student');
const generateToken = require('../../utils/generateToken');
const { setAuthCookie } = require('../../utils/authCookie');

const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

const PHONE_MISMATCH = "This student's registered guardian phone does not match your account";

function phoneOrNull(raw) {
    try { return Student.normalizePhone(raw); } catch { return null; }
}

exports.registerParentCtrl = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, phone, password } = req.body || {};
    if (!firstName || !lastName || !phone || !password) {
        throw httpError(400, 'firstName, lastName, phone and password are required');
    }
    if (typeof password !== 'string' || password.length < 8) {
        throw httpError(400, 'Password must be at least 8 characters');
    }
    const normalizedPhone = phoneOrNull(phone);
    if (!normalizedPhone) throw httpError(400, 'Phone must be a 9-digit Cameroonian number (optionally prefixed with +237)');

    const exists = await Parent.findByPhone(normalizedPhone);
    if (exists) throw httpError(409, 'An account with this phone number already exists');

    const parent = await Parent.create({ firstName, lastName, email, phone: normalizedPhone, password });
    const { password: _omit, ...safe } = parent;
    res.status(201).json({ status: 'success', data: safe });
});

exports.loginParentCtrl = asyncHandler(async (req, res) => {
    const { phone, password } = req.body || {};
    if (!phone || !password) throw httpError(400, 'phone and password are required');

    const normalizedPhone = phoneOrNull(phone);
    const parent = normalizedPhone && await Parent.findByPhone(normalizedPhone);
    const isMatch = parent && await Parent.verifyPassword(password, parent.password);
    if (!parent || !isMatch) throw httpError(401, 'Invalid login credentials');
    if (parent.status && parent.status !== 'active') throw httpError(403, 'This account is inactive');

    const token = generateToken(parent.id, 'parent');
    setAuthCookie(res, token);
    const { password: _omit, ...safe } = parent;
    res.status(200).json({ status: 'success', data: safe, token });
});

exports.getParentProfileCtrl = asyncHandler(async (req, res) => {
    const parent = await Parent.findById(req.auth.legacyId);
    if (!parent) throw httpError(404, 'Parent not found');
    const { password: _omit, ...safe } = parent;
    res.status(200).json({ status: 'success', data: safe });
});

exports.getChildrenCtrl = asyncHandler(async (req, res) => {
    const children = await Parent.getChildren(req.auth.legacyId);
    res.status(200).json({ status: 'success', data: children });
});

// A guardian may only self-link a student whose registered guardian phone is their own.
exports.linkChildCtrl = asyncHandler(async (req, res) => {
    const { matricule, relationship } = req.body || {};
    if (!matricule || typeof matricule !== 'string') throw httpError(400, 'matricule is required');

    const student = await Student.findByMatricule(matricule.trim());
    const parentPhone = req.userAuth.phone;
    const registered = student ? [student.parentPhone, student.parentPhone2].map(phoneOrNull).filter(Boolean) : [];
    if (!student || student.isWithdrawn || !parentPhone || !registered.includes(parentPhone)) {
        throw httpError(403, PHONE_MISMATCH);
    }

    await Parent.linkChild(req.auth.legacyId, student.id, { relationship: relationship || null });
    res.status(200).json({ status: 'success', message: 'Child linked successfully', data: { studentId: student.id } });
});

exports.adminLinkChildCtrl = asyncHandler(async (req, res) => {
    const parentId = Number(req.body?.parentId);
    const studentId = Number(req.body?.studentId);
    if (!Number.isInteger(parentId) || parentId <= 0 || !Number.isInteger(studentId) || studentId <= 0) {
        throw httpError(400, 'parentId and studentId are required');
    }
    const parent = await Parent.findById(parentId);
    if (!parent) throw httpError(404, 'Parent not found');
    const student = await Student.findById(studentId);
    if (!student) throw httpError(404, 'Student not found');

    await Parent.linkChild(parentId, studentId, {
        relationship: req.body?.relationship || null,
        linkedByAdminId: req.userAuth.id,
    });
    res.status(200).json({ status: 'success', message: 'Child linked to guardian' });
});

exports.getChildReportCtrl = asyncHandler(async (req, res) => {
    const studentId = Number(req.params.studentId);
    if (!Number.isInteger(studentId) || studentId <= 0) throw httpError(400, 'Invalid student');
    if (!await Parent.isLinked(req.auth.legacyId, studentId)) throw httpError(403, 'You do not have access to this student');

    const rows = await require('../../model/Academic/subjectScore').getReportForStudent(studentId);
    res.status(200).json({ status: 'success', data: rows });
});
