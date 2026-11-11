const asyncHandler = require('express-async-handler');
const Subject = require('../../model/Academic/subject');
const ClassSubject = require('../../model/Academic/classSubject');

const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

//@desc   Create a subject (catalog only — offerings are set per class via allocations)
//@route  POST /api/v1/subjects
//@access Private (admin)
  exports.createSubjectCtrl = asyncHandler(async (req, res) => {
    const { name, code, description, coefficient, categories, subject_master, class_id, hours_per_week, has_lab } = req.body || {};
    if (!name || !code) throw httpError(400, 'name and code are required');

    const exists = await Subject.findByCode(code);
    if (exists) throw httpError(409, 'Subject with this code already exists');

    // Creating a subject only adds it to the catalog. Which classes offer it
    // (and how many periods/week) is decided per class via subject allocations.
    const subject = await Subject.create({ name, code, description, coefficient, categories, subject_master, class_id, hours_per_week, has_lab });

    res.status(201).json({ status: 'success', data: subject });
  });

//@desc   List all subjects
//@route  GET /api/v1/subjects
//@access Private (admin)
exports.getAllSubjectsCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedReferencesEnabled){const data=await require('./scopedLegacyReferences').handle(req, 'records', 'subjects');return res.status(200).json({status:'success',results:data.length,data});}

    const subjects = await Subject.getAll();
    res.status(200).json({ status: 'success', results: subjects.length, data: subjects });
});

//@desc   Get a single subject
//@route  GET /api/v1/subjects/:id
//@access Private (admin)
exports.singleSubjectCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedReferencesEnabled){const data=await require('./scopedLegacyReferences').handle(req, 'records', 'subjects', req.params.id);return res.status(200).json({status:'success',data});}

    const subject = await Subject.findById(req.params.id);
    if (!subject) throw httpError(404, 'Subject not found');
    res.status(200).json({ status: 'success', data: subject });
});

//@desc   Admin updates a subject
//@route  PUT /api/v1/subjects/:id
//@access Private (admin)
  exports.updateSubjectCtrl = asyncHandler(async (req, res) => {
    const subject = await Subject.findById(req.params.id);
    if (!subject) throw httpError(404, 'Subject not found');
    const { name, code, description, coefficient, categories, subject_master, class_id, hours_per_week, has_lab } = req.body || {};
    const updated = await Subject.update(req.params.id, { name, code, description, coefficient, categories, subject_master, class_id, hours_per_week, has_lab });
    res.status(200).json({ status: 'success', data: updated });
  });

//@desc   Admin deletes a subject
//@route  DELETE /api/v1/subjects/:id
//@access Private (admin)
exports.deleteSubjectCtrl = asyncHandler(async (req, res) => {
    const subject = await Subject.findById(req.params.id);
    if (!subject) throw httpError(404, 'Subject not found');
    await Subject.remove(req.params.id);
    res.status(200).json({ status: 'success', message: 'Subject deleted' });
});
