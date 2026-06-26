const express = require('express');
const reportCardRouter = express.Router();
const { getReportCardCtrl } = require('../../controllers/academic/reportCardCtrl');
const isLogin = require('../../middlewares/isLogin');

reportCardRouter.get('/:classId/:term/:academicYearId', isLogin, getReportCardCtrl);

module.exports = reportCardRouter;
