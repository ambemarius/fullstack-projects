const express = require('express');
const cssRouter = express.Router();
const {
    getClassSubjectStudentsCtrl,
    enrollStudentCtrl,
    unenrollStudentCtrl,
    bulkEnrollCtrl,
    bulkUnenrollCtrl,
} = require('../../controllers/academic/classSubjectStudentCtrl');

const isLogin = require('../../middlewares/isLogin');

cssRouter.get('/:classSubjectId/:academicYearId', isLogin, getClassSubjectStudentsCtrl);
cssRouter.post('/enroll', isLogin, enrollStudentCtrl);
cssRouter.post('/unenroll', isLogin, unenrollStudentCtrl);
cssRouter.post('/bulk-enroll', isLogin, bulkEnrollCtrl);
cssRouter.post('/bulk-unenroll', isLogin, bulkUnenrollCtrl);

module.exports = cssRouter;
