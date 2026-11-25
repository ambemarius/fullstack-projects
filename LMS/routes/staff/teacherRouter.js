const express = require('express');
const teacherRouter = express.Router();
const {
    registerTeacherCtrl,
    loginTeacherCtrl,
    getAllTeachersCtrl,
    getTeacherProfileCtrl,
    updateTeacherProfileCtrl,
    changeOwnPasswordCtrl,
    getMySubjectsCtrl,
    getMyStudentsCtrl,
    assignTeacherCtrl,
    singleTeacherCtrl,
    adminUpdateTeacherCtrl,
    deleteTeacherCtrl,
} = require('../../controllers/staff/teacherCtrl');

const isLogin = require('../../middlewares/isLogin');               // admin auth
const isTeacherLogin = require('../../middlewares/isTeacherLogin'); // teacher auth
const { uploadSingle } = require('../../middlewares/upload');
const { loginRateLimit } = require('../../middlewares/loginRateLimit');

// admin registers a teacher (with optional matricule file upload)
teacherRouter.post('/register', isLogin, ...uploadSingle('matriculeFile', { category: 'document', subDir: 'matricules' }), registerTeacherCtrl);

// teacher login (public)
teacherRouter.post('/login', loginRateLimit, loginTeacherCtrl);

// admin lists all teachers
teacherRouter.get('/', isLogin, getAllTeachersCtrl);

// teacher's own profile + scoped views (all declared before '/:id')
teacherRouter.get('/profile', isTeacherLogin, getTeacherProfileCtrl);
teacherRouter.put('/profile', isTeacherLogin, updateTeacherProfileCtrl);
teacherRouter.post('/change-password', isTeacherLogin, changeOwnPasswordCtrl);
teacherRouter.get('/my-subjects', isTeacherLogin, getMySubjectsCtrl);
teacherRouter.get('/my-students', isTeacherLogin, getMyStudentsCtrl);

// admin assigns a teacher to a class-subject
teacherRouter.post('/:id/assign', isLogin, assignTeacherCtrl);

// admin gets / updates a single teacher
teacherRouter.get('/:id', isLogin, singleTeacherCtrl);
teacherRouter.put('/:id', isLogin, ...uploadSingle('matriculeFile', { category: 'document', subDir: 'matricules' }), adminUpdateTeacherCtrl);
teacherRouter.delete('/:id', isLogin, deleteTeacherCtrl);

module.exports = teacherRouter;
