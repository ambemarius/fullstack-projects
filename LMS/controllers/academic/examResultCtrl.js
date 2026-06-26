const asyncHandler = require('express-async-handler');
const ExamResult = require('../../model/Academic/examResult');

//@desc   Logged-in student's PUBLISHED results only
//@route  GET /api/v1/exam-results/my-results
//@access Private (student)
exports.getMyResultsCtrl = asyncHandler(async (req, res) => {
    const results = await ExamResult.getPublishedForStudent(req.userAuth.id);
    res.status(200).json({ status: 'success', results: results.length, data: results });
});

//@desc   All results for an exam (staff view, published or not)
//@route  GET /api/v1/exam-results/exam/:examId
//@access Private (admin)
exports.getExamResultsCtrl = asyncHandler(async (req, res) => {
    const results = await ExamResult.getByExam(req.params.examId);
    res.status(200).json({ status: 'success', results: results.length, data: results });
});
