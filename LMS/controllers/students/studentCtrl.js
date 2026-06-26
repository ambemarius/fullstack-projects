const asyncHandler = require('express-async-handler');
const Student = require('../../model/Academic/student');
const AcademicYear = require('../../model/Academic/academicYear');
const generateToken = require('../../utils/generateToken');

const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

exports.registerStudentCtrl = asyncHandler(async (req, res) => {
    const { firstName, middleName, lastName, matricule, password, section, dateOfBirth, sex, yearOfEnrollment, academicYearId, currentClassLevel, address, placeOfBirth, regionOfOrigin, division, parentName, parentPhone, parentPhone2, medicalStatus, fees } = req.body || {};
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

    const student = await Student.create({ firstName, middleName, lastName, matricule, password, section, dateOfBirth, sex, yearOfEnrollment: finalYear, academicYearId, currentClassLevel, address, placeOfBirth, regionOfOrigin, division, parentName, parentPhone, parentPhone2, medicalStatus });
    if (fees && Array.isArray(fees) && fees.length) {
        await Student.saveFees(student.id, fees);
    }
    const feesData = await Student.getFees(student.id);
    res.status(201).json({ status: 'success', data: { ...student, fees: feesData } });
});

exports.loginStudentCtrl = asyncHandler(async (req, res) => {
    const { matricule, password } = req.body || {};
    if (!matricule || !password) throw httpError(400, 'matricule and password are required');

    const student = await Student.findByMatricule(matricule);
    const isMatch = student && await Student.verifyPassword(password, student.password);
    if (!student || !isMatch) throw httpError(401, 'Invalid login credentials');

    const token = generateToken(student.id);
    const { password: _omit, ...safe } = student;
    res.status(200).json({ status: 'success', data: safe, token });
});

exports.getAllStudentsCtrl = asyncHandler(async (req, res) => {
    const students = await Student.getAllFull();
    res.status(200).json({ status: 'success', results: students.length, data: students });
});

exports.getStudentProfileCtrl = asyncHandler(async (req, res) => {
    res.status(200).json({ status: 'success', data: req.userAuth });
});

exports.updateStudentProfileCtrl = asyncHandler(async (req, res) => {
    const { firstName, middleName, lastName } = req.body || {};
    const updated = await Student.update(req.userAuth.id, { firstName, middleName, lastName });
    res.status(200).json({ status: 'success', data: updated });
});

exports.singleStudentCtrl = asyncHandler(async (req, res) => {
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
    const { firstName, middleName, lastName, section, dateOfBirth, sex, yearOfEnrollment, currentClassLevel, academicYearId, isWithdrawn, address, placeOfBirth, regionOfOrigin, division, parentName, parentPhone, parentPhone2, medicalStatus, fees } = req.body || {};

    let finalYear = yearOfEnrollment;
    if (!finalYear && academicYearId) {
        const year = await AcademicYear.findById(academicYearId);
        if (year) finalYear = year.fromYear;
    }

    const updated = await Student.update(req.params.id, { firstName, middleName, lastName, section, dateOfBirth, sex, yearOfEnrollment: finalYear, currentClassLevel, academicYearId, address, placeOfBirth, regionOfOrigin, division, parentName, parentPhone, parentPhone2, medicalStatus });
    if (isWithdrawn !== undefined) await Student.setWithdrawn(req.params.id, isWithdrawn === true || isWithdrawn === 'true');
    if (fees && Array.isArray(fees) && fees.length) {
        await Student.saveFees(req.params.id, fees);
    }
    const feesData = await Student.getFees(req.params.id);
    res.status(200).json({ status: 'success', data: { ...updated, fees: feesData } });
});

exports.deleteStudentCtrl = asyncHandler(async (req, res) => {
    const student = await Student.findById(req.params.id);
    if (!student) throw httpError(404, 'Student not found');
    await Student.remove(req.params.id);
    res.status(200).json({ status: 'success', message: 'Student deleted' });
});
