const express = require('express');
const examRouter = express.Router();
const {
    createExamCtrl,
    getAllExamsCtrl,
    singleExamCtrl,
    updateExamStatusCtrl,
    addQuestionCtrl,
    getExamQuestionsCtrl,
    studentExamQuestionsCtrl,
    takeExamCtrl,
} = require('../../controllers/academic/examCtrl');

const isTeacherLogin = require('../../middlewares/isTeacherLogin');
const isStudentLogin = require('../../middlewares/isStudentLogin');

// ---- teacher ----
examRouter.post('/', isTeacherLogin, createExamCtrl);
examRouter.get('/', isTeacherLogin, getAllExamsCtrl);
examRouter.get('/:id', isTeacherLogin, singleExamCtrl);
examRouter.put('/:id/status', isTeacherLogin, updateExamStatusCtrl);
examRouter.post('/:examId/questions', isTeacherLogin, addQuestionCtrl);
examRouter.get('/:examId/questions', isTeacherLogin, getExamQuestionsCtrl);

// ---- student ----
examRouter.get('/:examId/take', isStudentLogin, studentExamQuestionsCtrl);
examRouter.post('/:examId/write', isStudentLogin, takeExamCtrl);

module.exports = examRouter;
