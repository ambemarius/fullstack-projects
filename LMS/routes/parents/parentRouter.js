const express = require('express');
const parentRouter = express.Router();
const {
    registerParentCtrl,
    loginParentCtrl,
    getParentProfileCtrl,
    getChildrenCtrl,
    linkChildCtrl,
    adminLinkChildCtrl,
    getChildReportCtrl,
} = require('../../controllers/parents/parentCtrl');

const isParentLogin = require('../../middlewares/isParentLogin');
const isAdminLogin = require('../../middlewares/isLogin');
const { loginRateLimit } = require('../../middlewares/loginRateLimit');

parentRouter.post('/register', registerParentCtrl);
parentRouter.post('/login', loginRateLimit, loginParentCtrl);

parentRouter.post('/admin/link', isAdminLogin, adminLinkChildCtrl);

parentRouter.get('/profile', isParentLogin, getParentProfileCtrl);
parentRouter.get('/children', isParentLogin, getChildrenCtrl);
parentRouter.post('/children/link', isParentLogin, linkChildCtrl);
parentRouter.get('/children/:studentId/report', isParentLogin, getChildReportCtrl);

module.exports = parentRouter;
