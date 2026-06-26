const asyncHandler = require('express-async-handler');
const Exam = require('../../model/Academic/exam');
const Question = require('../../model/Academic/question');
const ExamResult = require('../../model/Academic/examResult');

const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

// score is 0-100 (scaled to the exam's totalmark)
const gradeFromScore = (s) => (s >= 80 ? 'A' : s >= 70 ? 'B' : s >= 60 ? 'C' : s >= 50 ? 'D' : 'F');
const remarksFromScore = (s) => (s >= 80 ? 'Excellent' : s >= 50 ? 'Good' : 'Poor');

//@desc   Teacher creates an exam
//@route  POST /api/v1/exams
//@access Private (teacher)
exports.createExamCtrl = asyncHandler(async (req, res) => {
    const {
        name, description, subjectId, classLevel, passmark, totalmark,
        coefficient, academicTerm, academicYearId, examDate, examStatus,
    } = req.body || {};
    if (!name || !subjectId || !classLevel || !academicTerm || !academicYearId) {
        throw httpError(400, 'name, subjectId, classLevel, academicTerm and academicYearId are required');
    }
    const exam = await Exam.create({
        name, description, subjectId, classLevel, passmark, totalmark,
        coefficient, academicTerm, academicYearId, examDate, examStatus,
        createdBy: req.userAuth.id, // the teacher from isTeacherLogin
    });
    res.status(201).json({ status: 'success', data: exam });
});

//@desc   List all exams
//@route  GET /api/v1/exams
//@access Private (teacher)
exports.getAllExamsCtrl = asyncHandler(async (req, res) => {
    const exams = await Exam.getAll();
    res.status(200).json({ status: 'success', results: exams.length, data: exams });
});

//@desc   Get a single exam
//@route  GET /api/v1/exams/:id
//@access Private (teacher)
exports.singleExamCtrl = asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (!exam) throw httpError(404, 'Exam not found');
    res.status(200).json({ status: 'success', data: exam });
});

//@desc   Teacher changes an exam's status (Pending|Live|Completed)
//@route  PUT /api/v1/exams/:id/status
//@access Private (teacher)
exports.updateExamStatusCtrl = asyncHandler(async (req, res) => {
    const { status } = req.body || {};
    if (!['Pending', 'Live', 'Completed'].includes(status)) {
        throw httpError(400, 'status must be Pending, Live or Completed');
    }
    const exam = await Exam.findById(req.params.id);
    if (!exam) throw httpError(404, 'Exam not found');
    await Exam.setStatus(req.params.id, status);
    res.status(200).json({ status: 'success', message: `Exam set to ${status}` });
});

//@desc   Teacher adds a multiple-choice question to an exam
//@route  POST /api/v1/exams/:examId/questions
//@access Private (teacher)
exports.addQuestionCtrl = asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) throw httpError(404, 'Exam not found');

    const { questionText, optionA, optionB, optionC, optionD, correctOption, marks } = req.body || {};
    if (!questionText || !optionA || !optionB || !optionC || !optionD || !correctOption) {
        throw httpError(400, 'questionText, optionA-D and correctOption are required');
    }
    if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
        throw httpError(400, 'correctOption must be A, B, C or D');
    }
    const question = await Question.create({
        examId: req.params.examId,
        questionText, optionA, optionB, optionC, optionD, correctOption, marks,
        createdBy: req.userAuth.id,
    });
    res.status(201).json({ status: 'success', data: question });
});

//@desc   Teacher views an exam's questions (with answers)
//@route  GET /api/v1/exams/:examId/questions
//@access Private (teacher)
exports.getExamQuestionsCtrl = asyncHandler(async (req, res) => {
    const questions = await Question.getByExam(req.params.examId);
    res.status(200).json({ status: 'success', results: questions.length, data: questions });
});

//@desc   Student views a live exam's questions (WITHOUT answers)
//@route  GET /api/v1/exams/:examId/take
//@access Private (student)
exports.studentExamQuestionsCtrl = asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) throw httpError(404, 'Exam not found');
    if (exam.examStatus !== 'Live') throw httpError(403, 'Exam is not live');
    const questions = await Question.getByExamForStudent(req.params.examId);
    res.status(200).json({ status: 'success', exam: exam.name, results: questions.length, data: questions });
});

//@desc   Student submits answers; the exam is auto-graded
//@route  POST /api/v1/exams/:examId/write
//@access Private (student)
exports.takeExamCtrl = asyncHandler(async (req, res) => {
    const examId = req.params.examId;
    const studentId = req.userAuth.id;

    const exam = await Exam.findById(examId);
    if (!exam) throw httpError(404, 'Exam not found');
    if (exam.examStatus !== 'Live') throw httpError(403, 'Exam is not live');

    const already = await ExamResult.findForStudentExam(studentId, examId);
    if (already) throw httpError(409, 'You have already taken this exam');

    const { answers } = req.body || {};
    if (!Array.isArray(answers)) {
        throw httpError(400, 'answers must be an array of { questionId, selectedOption }');
    }

    const questions = await Question.getByExam(examId);
    if (questions.length === 0) throw httpError(400, 'This exam has no questions');

    // map questionId -> selected option
    const picked = new Map(answers.map(a => [Number(a.questionId), a.selectedOption]));

    let earned = 0;
    let possible = 0;
    for (const q of questions) {
        possible += q.marks;
        if (picked.get(q.id) === q.correctOption) earned += q.marks;
    }
    const score = possible > 0 ? Math.round((earned / possible) * exam.totalmark) : 0;
    const status = score >= exam.passmark ? 'Passed' : 'Failed';

    await ExamResult.create({
        studentId,
        examId,
        subjectId: exam.subjectId,
        score,
        passmark: exam.passmark,
        grade: gradeFromScore(score),
        status,
        remarks: remarksFromScore(score),
    });

    // result is created unpublished — don't reveal the score yet
    res.status(201).json({
        status: 'success',
        message: 'Exam submitted. Your result will be available once published.',
    });
});
