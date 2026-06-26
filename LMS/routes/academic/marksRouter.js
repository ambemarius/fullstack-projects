const express = require('express');
const marksRouter = express.Router();
const {
    getStudentsWithScoresCtrl,
    saveScoresCtrl,
    saveAllScoresCtrl,
} = require('../../controllers/academic/marksCtrl');

const isTeacherLogin = require('../../middlewares/isTeacherLogin');
const isLogin = require('../../middlewares/isLogin');

marksRouter.get('/students/:classSubjectId/:term/:academicYearId', isTeacherLogin, getStudentsWithScoresCtrl);
marksRouter.post('/save/:classSubjectId/:term/:sequence/:academicYearId', isTeacherLogin, saveScoresCtrl);
marksRouter.post('/save-all/:classSubjectId/:term/:academicYearId', isTeacherLogin, saveAllScoresCtrl);

// Admin-compatible endpoints for Evaluation tab (same controllers, isLogin middleware)
marksRouter.get('/admin/students/:classSubjectId/:term/:academicYearId', isLogin, getStudentsWithScoresCtrl);
marksRouter.post('/admin/save/:classSubjectId/:term/:sequence/:academicYearId', isLogin, saveScoresCtrl);
marksRouter.post('/admin/save-all/:classSubjectId/:term/:academicYearId', isLogin, saveAllScoresCtrl);

module.exports = marksRouter;
