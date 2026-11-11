const asyncHandler = require('express-async-handler');
const AcademicYear = require('../../model/Academic/academicYear');

const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

//@desc   Create an academic year (created by the logged-in admin)
//@route  POST /api/v1/academic-years
//@access Private (admin)
exports.createAcademicYearCtrl = asyncHandler(async (req, res) => {
    const { name, fromYear, toYear, isCurrent } = req.body || {};
    if (!fromYear || !toYear) throw httpError(400, 'fromYear and toYear are required');

    const year = await AcademicYear.create({
        name,
        fromYear,
        toYear,
        isCurrent: !!isCurrent,
        createdBy: req.userAuth.id, // the admin from isLogin
    });
    res.status(201).json({ status: 'success', data: year });
});

//@desc   List all academic years (with student/teacher counts)
//@route  GET /api/v1/academic-years
//@access Private (admin)
exports.getAllAcademicYearsCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedReferencesEnabled){const data=await require('./scopedLegacyReferences').handle(req, 'records', 'years');return res.status(200).json({status:'success',results:data.length,data});}

    const years = await AcademicYear.getAll();
    res.status(200).json({ status: 'success', results: years.length, data: years });
});

//@desc   Get a single academic year
//@route  GET /api/v1/academic-years/:id
//@access Private (admin)
exports.singleAcademicYearCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedReferencesEnabled){const data=await require('./scopedLegacyReferences').handle(req, 'records', 'years', req.params.id);return res.status(200).json({status:'success',data});}

    const year = await AcademicYear.findById(req.params.id);
    if (!year) throw httpError(404, 'Academic year not found');
    res.status(200).json({ status: 'success', data: year });
});

//@desc   Mark an academic year as the current one
//@route  PUT /api/v1/academic-years/:id/current
//@access Private (admin)
exports.setCurrentAcademicYearCtrl = asyncHandler(async (req, res) => {
    const year = await AcademicYear.findById(req.params.id);
    if (!year) throw httpError(404, 'Academic year not found');
    await AcademicYear.setCurrent(req.params.id);
    res.status(200).json({ status: 'success', message: 'Academic year set as current' });
});

exports.deleteAcademicYearCtrl = (_req, res) =>
    res.status(405).set('Allow','GET, HEAD').json({ status:'failed', message:'Academic years are retained for historical records.' });
