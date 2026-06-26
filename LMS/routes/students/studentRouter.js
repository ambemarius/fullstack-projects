const express = require('express');
const studentRouter = express.Router();
const {
    registerStudentCtrl,
    loginStudentCtrl,
    getAllStudentsCtrl,
    getStudentProfileCtrl,
    updateStudentProfileCtrl,
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

// admin registers a student
studentRouter.post('/register', isLogin, registerStudentCtrl);

// student login (public)
studentRouter.post('/login', loginStudentCtrl);

// admin lists all students
studentRouter.get('/', isLogin, getAllStudentsCtrl);

// student's own profile (declared before '/:id')
studentRouter.get('/profile', isStudentLogin, getStudentProfileCtrl);
studentRouter.put('/profile', isStudentLogin, updateStudentProfileCtrl);

// promotion
studentRouter.get('/by-class/:classId', isLogin, getStudentsByClassCtrl);
studentRouter.post('/promote/:classId', isLogin, promoteClassCtrl);

// admin gets / updates / deletes a single student
studentRouter.get('/:id', isLogin, singleStudentCtrl);
studentRouter.put('/:id', isLogin, adminUpdateStudentCtrl);
studentRouter.delete('/:id', isLogin, deleteStudentCtrl);

module.exports = studentRouter;
