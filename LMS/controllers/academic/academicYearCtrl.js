const asyncHandler = require('express-async-handler');
const { sql, pool } = require('../../config/database');
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
    const years = await AcademicYear.getAll();
    res.status(200).json({ status: 'success', results: years.length, data: years });
});

//@desc   Get a single academic year
//@route  GET /api/v1/academic-years/:id
//@access Private (admin)
exports.singleAcademicYearCtrl = asyncHandler(async (req, res) => {
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

exports.deleteAcademicYearCtrl = asyncHandler(async (req, res) => {
    const year = await AcademicYear.findById(req.params.id);
    if (!year) throw httpError(404, 'Academic year not found');

    const enrolledCount = await pool.request()
        .input('yearId', sql.Int, req.params.id)
        .query('SELECT COUNT(*) AS cnt FROM academic_year_students WHERE academic_year_id = @yearId');

    if (enrolledCount.recordset[0].cnt > 0) {
        throw httpError(409, 'Cannot delete academic year with enrolled students');
    }

    await pool.request()
        .input('id', sql.Int, req.params.id)
        .query('DELETE FROM academic_years WHERE id = @id');

    res.status(200).json({ status: 'success', message: 'Academic year deleted' });
});
