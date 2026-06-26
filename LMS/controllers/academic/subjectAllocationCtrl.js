const asyncHandler = require('express-async-handler');
const SubjectAllocation = require('../../model/Academic/subjectAllocation');
const ClassSubject = require('../../model/Academic/classSubject');
const ClassModel = require('../../model/Academic/class');
const SubjectModel = require('../../model/Academic/subject');
const AcademicYearModel = require('../../model/Academic/academicYear');

const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

//@desc   Admin sets/updates a subject's periods-per-week for a class in a year
//@route  POST /api/v1/allocations
//@access Private (admin)
exports.setAllocationCtrl = asyncHandler(async (req, res) => {
    const { class_id, subject_id, periods_week, academic_year_id } = req.body || {};
    if (!class_id || !subject_id || !academic_year_id || periods_week == null) {
        throw httpError(400, 'class_id, subject_id, periods_week and academic_year_id are required');
    }
    if (Number(periods_week) < 1) throw httpError(400, 'periods_week must be at least 1');

    // record the allocation AND make sure the subject is offered in that class
    const allocation = await SubjectAllocation.set({ class_id, subject_id, periods_week, academic_year_id });
    await ClassSubject.offer(class_id, subject_id);

    res.status(201).json({ status: 'success', data: allocation });
});

//@desc   All allocations for a class in a year
//@route  GET /api/v1/allocations/class/:classId?yearId=
//@access Private (admin)
exports.getClassAllocationsCtrl = asyncHandler(async (req, res) => {
    const yearId = req.query.yearId || (await AcademicYearModel.findCurrent())?.id;
    if (!yearId) throw httpError(400, 'No academic year (provide yearId or set a current year)');
    const data = await SubjectAllocation.getByClass(req.params.classId, yearId);
    res.status(200).json({ status: 'success', results: data.length, data });
});

//@desc   All allocations for a year (every class)
//@route  GET /api/v1/allocations?yearId=
//@access Private (admin)
exports.getAllAllocationsCtrl = asyncHandler(async (req, res) => {
    const yearId = req.query.yearId || (await AcademicYearModel.findCurrent())?.id;
    if (!yearId) throw httpError(400, 'No academic year (provide yearId or set a current year)');
    const data = await SubjectAllocation.getAll(yearId);
    res.status(200).json({ status: 'success', results: data.length, data });
});

//@desc   Remove an allocation
//@route  DELETE /api/v1/allocations/:id
//@access Private (admin)
exports.deleteAllocationCtrl = asyncHandler(async (req, res) => {
    await SubjectAllocation.delete(req.params.id);
    res.status(200).json({ status: 'success', message: 'Allocation removed' });
});

//@desc   Dropdown data for the allocation page (classes, subjects, years)
//@route  GET /api/v1/allocations/form-data
//@access Private (admin)
exports.getFormDataCtrl = asyncHandler(async (req, res) => {
    const [classes, subjects, academicYears] = await Promise.all([
        ClassModel.getAll(),
        SubjectModel.getAll(),
        AcademicYearModel.getAll(),
    ]);
    res.status(200).json({ status: 'success', data: { classes, subjects, academicYears } });
});
