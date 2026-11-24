const asyncHandler = require('express-async-handler');
const Student = require('../../model/Academic/student');
const AcademicYear = require('../../model/Academic/academicYear');
const generateToken = require('../../utils/generateToken');
const { setAuthCookie } = require('../../utils/authCookie');
const { findLoginAccount } = require('../../utils/loginSchool');
// The account and school a sign-in opens: super administrators type the school code, other accounts are found
// in the school whose administrator created them (tests may swap the school resolver).
const loginAccount = (req, options) => findLoginAccount({ ...options, schoolCode: (req.body || {}).schoolCode, resolveSchool: req.app.locals.resolveLoginSchool });
const { getPublicUrl } = require('../../middlewares/upload');

const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

exports.registerStudentCtrl = asyncHandler(async (req, res) => {
    const { firstName, middleName, lastName, matricule, password, section, dateOfBirth, sex, yearOfEnrollment, academicYearId, currentClassLevel, address, placeOfBirth, regionOfOrigin, division, parentName, parentPhone, parentPhone2, medicalStatus } = req.body || {};
    const photo = req.file ? getPublicUrl(req.file.path) : null;
    if (!firstName || !lastName || !matricule || !password || !section || !sex) {
        throw httpError(400, 'firstName, lastName, matricule, password, section and sex are required');
    }
    const exists = await Student.findByMatricule(matricule);
    if (exists) throw httpError(409, 'Student with this matricule already exists');

    let finalYear = yearOfEnrollment;
    if (!finalYear && academicYearId) {
        const year = await AcademicYear.findById(academicYearId);
        if (year) finalYear = year.fromYear;
    }

    const student = await Student.create({ firstName, middleName, lastName, matricule, password, section, dateOfBirth, sex, yearOfEnrollment: finalYear, academicYearId, currentClassLevel, address, placeOfBirth, regionOfOrigin, division, parentName, parentPhone, parentPhone2, medicalStatus, photo });
    // Fees are charged in Finance (finance_charges); student_fees is read-only history.
    const feesData = await Student.getFees(student.id);
    res.status(201).json({ status: 'success', data: { ...student, fees: feesData } });
});

exports.loginStudentCtrl = asyncHandler(async (req, res) => {
    const { matricule, password } = req.body || {};
    if (!matricule || !password) throw httpError(400, 'matricule and password are required');

    const { account: student, schoolId } = await loginAccount(req, {
        identifier: matricule, findAll: (m, school) => Student.findAllForLogin(m, school), verify: hash => Student.verifyPassword(password, hash),
    });
    if (!student) throw httpError(401, 'Invalid login credentials');

    if (student.isWithdrawn) throw httpError(403, 'This account is inactive');
    const version = req.app.locals.legacyCredentialVersionsEnabled ? await require('../../model/identity/legacyCredentialVersion').legacyCredentialVersion('student',student.id,undefined,student.password) : undefined;
    const token = generateToken(student.id, 'student', version, schoolId);
    setAuthCookie(res, token);
    const { password: _omit, ...safe } = student;
    res.status(200).json({ status: 'success', data: safe, token });
});

exports.getAllStudentsCtrl = asyncHandler(async (req, res) => {
    const students = req.app.locals.legacyScopedPersonnelReadsEnabled ? await require('../staff/scopedLegacyPersonnelReads').handle(req,'list','students') : await Student.getAllFull();
    res.status(200).json({ status: 'success', results: students.length, data: students });
});

//@desc   Signed-in student's own sequence marks
//@route  GET /api/v1/students/my-scores
//@access Private (student)
exports.getMyScoresCtrl = asyncHandler(async (req, res) => {
    const rows = await require('../../model/Academic/subjectScore').getReportForStudent(req.userAuth.id);
    res.status(200).json({ status: 'success', data: rows });
});

exports.getStudentProfileCtrl = asyncHandler(async (req, res) => {
    res.status(200).json({ status: 'success', data: req.app.locals.legacyScopedSelfEnabled ? await require('../staff/scopedLegacySelf').profile(req) : req.userAuth });
});

exports.updateStudentProfileCtrl = asyncHandler(async (req, res) => {
    const { firstName, middleName, lastName } = req.body || {};
    const updated = await Student.update(req.userAuth.id, { firstName, middleName, lastName });
    res.status(200).json({ status: 'success', data: updated });
});

exports.singleStudentCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedPersonnelReadsEnabled)return res.status(200).json({status:'success',data:await require('../staff/scopedLegacyPersonnelReads').handle(req,'find','students',req.params.id)});
    const ClassModel = require('../../model/Academic/class');
    const student = await Student.findById(req.params.id);
    if (!student) throw httpError(404, 'Student not found');
    const klass = student.currentClassLevel ? await ClassModel.findById(student.currentClassLevel) : null;
    const fees = await Student.getFees(req.params.id);
    res.status(200).json({ status: 'success', data: { ...student, className: klass ? klass.name : null, classStream: klass ? klass.stream : null, fees } });
});

exports.adminUpdateStudentCtrl = asyncHandler(async (req, res) => {
    const student = await Student.findById(req.params.id);
    if (!student) throw httpError(404, 'Student not found');
    const { firstName, middleName, lastName, section, dateOfBirth, sex, yearOfEnrollment, currentClassLevel, academicYearId, isWithdrawn, address, placeOfBirth, regionOfOrigin, division, parentName, parentPhone, parentPhone2, medicalStatus } = req.body || {};
    const photo = req.file ? getPublicUrl(req.file.path) : undefined;

    let finalYear = yearOfEnrollment;
    if (!finalYear && academicYearId) {
        const year = await AcademicYear.findById(academicYearId);
        if (year) finalYear = year.fromYear;
    }

    const updates = { firstName, middleName, lastName, section, dateOfBirth, sex, yearOfEnrollment: finalYear, currentClassLevel, academicYearId, address, placeOfBirth, regionOfOrigin, division, parentName, parentPhone, parentPhone2, medicalStatus };
    if (photo) updates.photo = photo;
    const updated = await Student.update(req.params.id, updates);
    if (isWithdrawn !== undefined) await Student.setWithdrawn(req.params.id, isWithdrawn === true || isWithdrawn === 'true');
    const feesData = await Student.getFees(req.params.id);
    res.status(200).json({ status: 'success', data: { ...updated, fees: feesData } });
});

exports.deleteStudentCtrl = asyncHandler(async (req, res) => {
    const student = await Student.findById(req.params.id);
    if (!student) throw httpError(404, 'Student not found');
    await Student.remove(req.params.id);
    res.status(200).json({ status: 'success', message: 'Student deleted' });
});
