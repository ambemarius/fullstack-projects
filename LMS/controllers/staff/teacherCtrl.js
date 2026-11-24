const asyncHandler = require('express-async-handler');
const Teacher = require('../../model/staff/teacher');
const Student = require('../../model/Academic/student');
const ClassSubject = require('../../model/Academic/classSubject');
const generateToken = require('../../utils/generateToken');
const { setAuthCookie } = require('../../utils/authCookie');
const { resolveLoginSchool } = require('../../utils/loginSchool');
// The school a sign-in belongs to (school code typed at sign-in; tests may swap the resolver).
const loginSchool = req => (req.app.locals.resolveLoginSchool || resolveLoginSchool)((req.body || {}).schoolCode);
const { getPublicUrl } = require('../../middlewares/upload');

const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

//@desc   Admin registers a teacher
//@route  POST /api/v1/teachers/register
//@access Private (admin)
exports.registerTeacherCtrl = asyncHandler(async (req, res) => {
    const {
        firstName, lastName, email, password, phone, secondaryContactName, secondaryContactPhone,
        employmentType, section, status, middleName,
        address, idCardNo, dateOfIssue, gender, civilStatus, noOfChildren, telephone
    } = req.body || {};
    const matriculeFile = req.file ? getPublicUrl(req.file.path) : (req.body || {}).matriculeFile || null;
    if (!firstName || !lastName || !email || !password || !employmentType || !section) {
        throw httpError(400, 'firstName, lastName, email, password, employmentType and section are required');
    }
    if (employmentType === 'Government' && !matriculeFile) {
        throw httpError(400, 'Matricule file is required for Government teachers');
    }
    const exists = await Teacher.findByEmail(email);
    if (exists) throw httpError(409, 'Teacher with this email already exists');

    const teacher = await Teacher.create({
        firstName, middleName, lastName, email, password, phone, secondaryContactName, secondaryContactPhone,
        employmentType, section, status,
        address, idCardNo, dateOfIssue, gender, civilStatus, noOfChildren, telephone, matriculeFile
    });
    res.status(201).json({ status: 'success', data: teacher });
});

//@desc   Teacher login
//@route  POST /api/v1/teachers/login
//@access Public
exports.loginTeacherCtrl = asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) throw httpError(400, 'email and password are required');

    const school = await loginSchool(req);
    const teacher = await Teacher.findByEmail(email, school.id);
    const isMatch = teacher && await Teacher.verifyPassword(password, teacher.password);
    if (!teacher || !isMatch) throw httpError(401, 'Invalid login credentials');

    if (teacher.status === 'suspended' || teacher.status === 'withdrawn') {
        throw httpError(403, `Your account has been ${teacher.status}`);
    }

    const version = req.app.locals.legacyCredentialVersionsEnabled ? await require('../../model/identity/legacyCredentialVersion').legacyCredentialVersion('teacher',teacher.id,undefined,teacher.password) : undefined;
    const token = generateToken(teacher.id, 'teacher', version, teacher.school_id || school.id);
    setAuthCookie(res, token);
    const { password: _omit, ...safe } = teacher;
    res.status(200).json({ status: 'success', data: safe, token });
});

//@desc   List all teachers
//@route  GET /api/v1/teachers
//@access Private (admin)
exports.getAllTeachersCtrl = asyncHandler(async (req, res) => {
    const teachers = req.app.locals.legacyScopedPersonnelReadsEnabled ? await require('./scopedLegacyPersonnelReads').handle(req,'list','teachers') : await Teacher.getAll();
    res.status(200).json({ status: 'success', results: teachers.length, data: teachers });
});

//@desc   Logged-in teacher's own profile
//@route  GET /api/v1/teachers/profile
//@access Private (teacher)
exports.getTeacherProfileCtrl = asyncHandler(async (req, res) => {
    res.status(200).json({ status: 'success', data: req.app.locals.legacyScopedSelfEnabled ? await require('./scopedLegacySelf').profile(req) : req.userAuth });
});

//@desc   Teacher updates own profile
//@route  PUT /api/v1/teachers/profile
//@access Private (teacher)
exports.updateTeacherProfileCtrl = asyncHandler(async (req, res) => {
    const { firstName, middleName, lastName, phone, secondaryContactName, secondaryContactPhone } = req.body || {};
    const updated = await Teacher.update(req.userAuth.id, { firstName, middleName, lastName, phone, secondaryContactName, secondaryContactPhone });
    res.status(200).json({ status: 'success', data: updated });
});

//@desc   Subjects/classes the logged-in teacher teaches
//@route  GET /api/v1/teachers/my-subjects
//@access Private (teacher)
exports.getMySubjectsCtrl = asyncHandler(async (req, res) => {
    const data = await ClassSubject.getTeacherTeaching(req.userAuth.id);
    res.status(200).json({ status: 'success', results: data.length, data });
});

//@desc   Students in the classes the logged-in teacher teaches
//@route  GET /api/v1/teachers/my-students
//@access Private (teacher)
exports.getMyStudentsCtrl = asyncHandler(async (req, res) => {
    const data = await Student.getForTeacher(req.userAuth.id);
    res.status(200).json({ status: 'success', results: data.length, data });
});

//@desc   Admin assigns a teacher to teach a subject in a class for a term
//@route  POST /api/v1/teachers/:id/assign
//@access Private (admin)
exports.assignTeacherCtrl = asyncHandler(async (req, res) => {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) throw httpError(404, 'Teacher not found');

    const { classId, subjectId, term } = req.body || {};
    if (!classId || !subjectId || !term) {
        throw httpError(400, 'classId, subjectId and term are required');
    }
    const offering = await ClassSubject.findOffering(classId, subjectId);
    if (!offering) throw httpError(404, 'That subject is not offered in that class');

    await ClassSubject.assignTeacher(offering.id, req.params.id, term);
    res.status(200).json({ status: 'success', message: 'Teacher assigned' });
});

//@desc   Get a single teacher by id
//@route  GET /api/v1/teachers/:id
//@access Private (admin)
exports.singleTeacherCtrl = asyncHandler(async (req, res) => {
    const teacher = req.app.locals.legacyScopedPersonnelReadsEnabled ? await require('./scopedLegacyPersonnelReads').handle(req,'find','teachers',req.params.id) : await Teacher.findById(req.params.id);
    if (!teacher) throw httpError(404, 'Teacher not found');
    res.status(200).json({ status: 'success', data: teacher });
});

//@desc   Admin updates a teacher
//@route  PUT /api/v1/teachers/:id
//@access Private (admin)
exports.adminUpdateTeacherCtrl = asyncHandler(async (req, res) => {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) throw httpError(404, 'Teacher not found');
    const {
        firstName, middleName, lastName, phone, secondaryContactName, secondaryContactPhone,
        employmentType, section, status,
        address, idCardNo, dateOfIssue, gender, civilStatus, noOfChildren, telephone
    } = req.body || {};
    const matriculeFile = req.file ? getPublicUrl(req.file.path) : undefined;
    const updates = {
        firstName, middleName, lastName, phone, secondaryContactName, secondaryContactPhone,
        employmentType, section, status,
        address, idCardNo, dateOfIssue, gender, civilStatus, noOfChildren, telephone,
    };
    if (matriculeFile) updates.matriculeFile = matriculeFile;
    const updated = await Teacher.update(req.params.id, updates);
    res.status(200).json({ status: 'success', data: updated });
});

//@desc   Admin deletes a teacher
//@route  DELETE /api/v1/teachers/:id
//@access Private (admin)
exports.deleteTeacherCtrl = asyncHandler(async (req, res) => {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) throw httpError(404, 'Teacher not found');
    await Teacher.remove(req.params.id);
    res.status(200).json({ status: 'success', message: 'Teacher deleted' });
});
