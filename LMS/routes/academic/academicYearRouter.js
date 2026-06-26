const express = require('express');
const academicYearRouter = express.Router();
const {
    createAcademicYearCtrl,
    getAllAcademicYearsCtrl,
    singleAcademicYearCtrl,
    setCurrentAcademicYearCtrl,
    deleteAcademicYearCtrl,
} = require('../../controllers/academic/academicYearCtrl');
const isLogin = require('../../middlewares/isLogin'); // admin auth

academicYearRouter.post('/', isLogin, createAcademicYearCtrl);
academicYearRouter.get('/', isLogin, getAllAcademicYearsCtrl);
academicYearRouter.get('/:id', isLogin, singleAcademicYearCtrl);
academicYearRouter.put('/:id/current', isLogin, setCurrentAcademicYearCtrl);
academicYearRouter.delete('/:id', isLogin, deleteAcademicYearCtrl);

module.exports = academicYearRouter;
