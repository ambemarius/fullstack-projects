const express = require('express');
const router = express.Router();
const isLogin = require('../../middlewares/isLogin');
const isTeacherLogin = require('../../middlewares/isTeacherLogin');
const isStudentLogin = require('../../middlewares/isStudentLogin');
const {
    createEntryCtrl,
    getClassGridCtrl,
    getClassTimetableCtrl,
    getClassPeriodsCtrl,
    getTeacherTimetableCtrl,
    getStudentTimetableCtrl,
    getAllEntriesCtrl,
    deleteEntryCtrl,
    getFormDataCtrl,
    generateClassCtrl,
} = require('../../controllers/academic/timetableCtrl');

router.get('/form-data', isLogin, getFormDataCtrl);
router.post('/generate/class/:classId', isLogin, generateClassCtrl);
router.post('/', isLogin, createEntryCtrl);
router.get('/class/:classId/grid', isLogin, getClassGridCtrl);
router.get('/class/:classId/periods', isLogin, getClassPeriodsCtrl);
router.get('/class/:classId', isLogin, getClassTimetableCtrl);
router.get('/teacher', isTeacherLogin, getTeacherTimetableCtrl);
router.get('/student', isStudentLogin, getStudentTimetableCtrl);
router.get('/', isLogin, getAllEntriesCtrl);
router.delete('/:id', isLogin, deleteEntryCtrl);

module.exports = router;
