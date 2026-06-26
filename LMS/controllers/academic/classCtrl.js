const asyncHandler = require('express-async-handler');
const ClassModel = require('../../model/Academic/class');
const ClassSubject = require('../../model/Academic/classSubject');

const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

//@desc   List all classes (the 21 seeded classes)
//@route  GET /api/v1/classes
//@access Private (admin)
exports.getAllClassesCtrl = asyncHandler(async (req, res) => {
    const classes = await ClassModel.getAll();
    res.status(200).json({ status: 'success', results: classes.length, data: classes });
});

//@desc   Get a single class
//@route  GET /api/v1/classes/:id
//@access Private (admin)
exports.singleClassCtrl = asyncHandler(async (req, res) => {
    const klass = await ClassModel.findById(req.params.id);
    if (!klass) throw httpError(404, 'Class not found');
    res.status(200).json({ status: 'success', data: klass });
});

//@desc   Subjects (and their teachers) offered in a class, optionally for a term
//@route  GET /api/v1/classes/:id/subjects?term=First
//@access Private (admin)
exports.classSubjectsCtrl = asyncHandler(async (req, res) => {
    const rows = await ClassSubject.getClassSubjects(req.params.id, req.query.term || null);
    res.status(200).json({ status: 'success', results: rows.length, data: rows });
});

//@desc   Update a class (master, fees, option)
//@route  PUT /api/v1/classes/:id
//@access Private (admin)
exports.updateClassCtrl = asyncHandler(async (req, res) => {
    const { class_master_id, registration_fee, tuition_fee, pta_fee, caution_fee, practicals_fee, option_name } = req.body || {};
    const updated = await ClassModel.updateClass(req.params.id, { class_master_id, registration_fee, tuition_fee, pta_fee, caution_fee, practicals_fee, option_name });
    if (!updated) throw httpError(404, 'Class not found');
    res.status(200).json({ status: 'success', data: updated });
});

//@desc   Get classes with fee/master info for registration table
//@route  GET /api/v1/classes/with-fees
//@access Private (admin)
exports.getClassesWithFeesCtrl = asyncHandler(async (req, res) => {
    const classes = await ClassModel.getAll();
    res.status(200).json({ status: 'success', results: classes.length, data: classes });
});
