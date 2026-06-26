const asyncHandler = require('express-async-handler');
const StudentModel = require('../../model/Academic/student');
const ClassModel = require('../../model/Academic/class');

//@desc   Promote all students in a class to the next level
//@route  POST /api/v1/students/promote/:classId
//@access Private (admin)
exports.promoteClassCtrl = asyncHandler(async (req, res) => {
    const { classId } = req.params;
    const { academicYearId } = req.body;

    const cls = await ClassModel.findById(classId);
    if (!cls) {
        return res.status(404).json({ status: 'error', message: 'Class not found' });
    }

    const result = await StudentModel.promoteClass(Number(classId), Number(academicYearId) || null);
    res.status(200).json({
        status: 'success',
        data: {
            class: cls.name,
            promoted: result.promoted,
            graduated: result.graduated,
            errors: result.errors,
        },
    });
});

//@desc   Get students in a class ready for promotion view
//@route  GET /api/v1/students/by-class/:classId
//@access Private (admin)
exports.getStudentsByClassCtrl = asyncHandler(async (req, res) => {
    const students = await StudentModel.getByClass(req.params.classId);
    res.status(200).json({ status: 'success', data: students });
});
