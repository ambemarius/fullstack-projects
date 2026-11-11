const express = require('express');
const parentRouter = express.Router();
const {
    registerParentCtrl,
    loginParentCtrl,
    getParentProfileCtrl,
    getChildrenCtrl,
    linkChildCtrl,
    getChildReportCtrl,
} = require('../../controllers/parents/parentCtrl');

const isParentLogin = require('../../middlewares/isParentLogin');

parentRouter.post('/register', registerParentCtrl);
parentRouter.post('/login', loginParentCtrl);

parentRouter.get('/profile', isParentLogin, getParentProfileCtrl);
parentRouter.get('/children', isParentLogin, getChildrenCtrl);
parentRouter.post('/children/link', isParentLogin, linkChildCtrl);
parentRouter.get('/children/:studentId/report', isParentLogin, getChildReportCtrl);

module.exports = parentRouter;
