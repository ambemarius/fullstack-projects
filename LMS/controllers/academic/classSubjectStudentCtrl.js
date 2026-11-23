const asyncHandler = require('express-async-handler');
const ClassSubjectStudent = require('../../model/Academic/classSubjectStudent');
const ClassSubject = require('../../model/Academic/classSubject');

const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

// GET /api/v1/class-subject-students/:classSubjectId/:academicYearId
// Get enrolled + unenrolled students for Course Review UI
exports.getClassSubjectStudentsCtrl = asyncHandler(async (req, res) => {
    const { classSubjectId, academicYearId } = req.params;
    const cs = await ClassSubject.findOfferingById(classSubjectId);
    if (!cs) throw httpError(404, 'Class-subject not found');

    const enrolled = await ClassSubjectStudent.getEnrolled(+classSubjectId, +academicYearId);
    const unenrolled = await ClassSubjectStudent.getUnenrolled(+classSubjectId, +academicYearId);

    res.status(200).json({ status: 'success', data: { enrolled, unenrolled } });
});

// POST /api/v1/class-subject-students/enroll
exports.enrollStudentCtrl = asyncHandler(async (req, res) => {
    const { studentId, classSubjectId, academicYearId } = req.body || {};
    if (!studentId || !classSubjectId || !academicYearId) throw httpError(400, 'studentId, classSubjectId and academicYearId are required');

    const cs = await ClassSubject.findOfferingById(classSubjectId);
    if (!cs) throw httpError(404, 'Class-subject not found');

    await ClassSubjectStudent.enroll(+classSubjectId, +studentId, +academicYearId);
    res.status(200).json({ status: 'success', message: 'Student enrolled' });
});

// POST /api/v1/class-subject-students/unenroll
exports.unenrollStudentCtrl = asyncHandler(async (req, res) => {
    const { studentId, classSubjectId } = req.body || {};
    if (!studentId || !classSubjectId) throw httpError(400, 'studentId and classSubjectId are required');

    const cs = await ClassSubject.findOfferingById(classSubjectId);
    if (!cs) throw httpError(404, 'Class-subject not found');

    await ClassSubjectStudent.unenroll(+classSubjectId, +studentId);
    res.status(200).json({ status: 'success', message: 'Student unenrolled' });
});

// POST /api/v1/class-subject-students/bulk-enroll
exports.bulkEnrollCtrl = asyncHandler(async (req, res) => {
    const { classSubjectId, academicYearId, studentIds } = req.body || {};
    if (!classSubjectId || !academicYearId || !Array.isArray(studentIds) || !studentIds.length) {
        throw httpError(400, 'classSubjectId, academicYearId and studentIds[] are required');
    }

    const cs = await ClassSubject.findOfferingById(classSubjectId);
    if (!cs) throw httpError(404, 'Class-subject not found');

    await ClassSubjectStudent.bulkEnroll(+classSubjectId, +academicYearId, studentIds.map(Number));
    res.status(200).json({ status: 'success', message: `${studentIds.length} students enrolled` });
});

// POST /api/v1/class-subject-students/bulk-unenroll
exports.bulkUnenrollCtrl = asyncHandler(async (req, res) => {
    const { classSubjectId, studentIds } = req.body || {};
    if (!classSubjectId || !Array.isArray(studentIds) || !studentIds.length) {
        throw httpError(400, 'classSubjectId and studentIds[] are required');
    }

    const cs = await ClassSubject.findOfferingById(classSubjectId);
    if (!cs) throw httpError(404, 'Class-subject not found');

    await ClassSubjectStudent.bulkUnenroll(+classSubjectId, studentIds.map(Number));
    res.status(200).json({ status: 'success', message: `${studentIds.length} students unenrolled` });
});

// GET /api/v1/class-subject-students/overview/:academicYearId?term=First
// Every course for the year with class size, enrolments and marks entered per sequence of the term.
exports.getOverviewCtrl = asyncHandler(async (req, res) => {
    const yearId = Number(req.params.academicYearId);
    const term = req.query.term || 'First';
    if (!Number.isInteger(yearId) || yearId <= 0) throw httpError(422, 'Choose an academic year.');
    if (!['First', 'Second', 'Third'].includes(term)) throw httpError(422, 'Choose a term (First, Second or Third).');
    const rows = await ClassSubjectStudent.overview(yearId, term);
    res.status(200).json({ status: 'success', results: rows.length, data: { yearId, term, courses: rows } });
});
