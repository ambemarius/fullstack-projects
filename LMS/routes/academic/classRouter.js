const express = require('express');
const classRouter = express.Router();
const {
    getAllClassesCtrl,
    singleClassCtrl,
    classSubjectsCtrl,
    updateClassCtrl,
    getClassesWithFeesCtrl,
} = require('../../controllers/academic/classCtrl');
const isLogin = require('../../middlewares/isLogin'); // admin auth

classRouter.get('/', isLogin, getAllClassesCtrl);
classRouter.get('/with-fees', isLogin, getClassesWithFeesCtrl);
classRouter.get('/:id', isLogin, singleClassCtrl);
classRouter.put('/:id', isLogin, updateClassCtrl);
classRouter.get('/:id/subjects', isLogin, classSubjectsCtrl);

module.exports = classRouter;
