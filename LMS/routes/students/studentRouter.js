const express = require('express');
const studentRouter = express.Router();
const {
    registerStudentCtrl,
    loginStudentCtrl,
    getAllStudentsCtrl,
    getStudentProfileCtrl,
    updateStudentProfileCtrl,
    getMyScoresCtrl,
    singleStudentCtrl,
    adminUpdateStudentCtrl,
    deleteStudentCtrl,
} = require('../../controllers/students/studentCtrl');
const {
    promoteClassCtrl,
    getStudentsByClassCtrl,
} = require('../../controllers/academic/promotionCtrl');

const isLogin = require('../../middlewares/isLogin');               // admin auth
const isStudentLogin = require('../../middlewares/isStudentLogin'); // student auth
const { uploadSingle } = require('../../middlewares/upload');
const { loginRateLimit } = require('../../middlewares/loginRateLimit');

// admin registers a student (with optional photo upload)
studentRouter.post('/register', isLogin, ...uploadSingle('photo', { category: 'image', subDir: 'photos' }), registerStudentCtrl);

// student login (public)
studentRouter.post('/login', loginRateLimit, loginStudentCtrl);

// admin lists all students
studentRouter.get('/', isLogin, getAllStudentsCtrl);

// student's own profile (declared before '/:id')
studentRouter.get('/profile', isStudentLogin, getStudentProfileCtrl);
studentRouter.put('/profile', isStudentLogin, updateStudentProfileCtrl);
studentRouter.get('/my-scores', isStudentLogin, getMyScoresCtrl);

// promotion
studentRouter.get('/by-class/:classId', isLogin, getStudentsByClassCtrl);
studentRouter.post('/promote/:classId', isLogin, promoteClassCtrl);

// admin gets / updates / deletes a single student
studentRouter.get('/:id', isLogin, singleStudentCtrl);
studentRouter.put('/:id', isLogin, ...uploadSingle('photo', { category: 'image', subDir: 'photos' }), adminUpdateStudentCtrl);
studentRouter.delete('/:id', isLogin, deleteStudentCtrl);

module.exports = studentRouter;
