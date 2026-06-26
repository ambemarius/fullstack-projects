const express = require('express');
const examResultRouter = express.Router();
const {
    getMyResultsCtrl,
    getExamResultsCtrl,
} = require('../../controllers/academic/examResultCtrl');

const isLogin = require('../../middlewares/isLogin');               // admin
const isStudentLogin = require('../../middlewares/isStudentLogin'); // student

// student sees their own published results
examResultRouter.get('/my-results', isStudentLogin, getMyResultsCtrl);

// admin sees all results for an exam
examResultRouter.get('/exam/:examId', isLogin, getExamResultsCtrl);

module.exports = examResultRouter;
