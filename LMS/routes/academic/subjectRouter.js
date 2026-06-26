const express = require('express');
const subjectRouter = express.Router();
const {
    createSubjectCtrl,
    getAllSubjectsCtrl,
    singleSubjectCtrl,
    updateSubjectCtrl,
    deleteSubjectCtrl,
} = require('../../controllers/academic/subjectCtrl');
const isLogin = require('../../middlewares/isLogin'); // admin auth

subjectRouter.post('/', isLogin, createSubjectCtrl);
subjectRouter.get('/', isLogin, getAllSubjectsCtrl);
subjectRouter.get('/:id', isLogin, singleSubjectCtrl);
subjectRouter.put('/:id', isLogin, updateSubjectCtrl);
subjectRouter.delete('/:id', isLogin, deleteSubjectCtrl);

module.exports = subjectRouter;
