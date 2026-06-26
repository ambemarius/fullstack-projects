const express = require('express');
const locationRouter = express.Router();
const isLogin = require('../../middlewares/isLogin'); // admin auth
const {
    getRegionsCtrl,
    getDivisionsCtrl,
    getSubdivisionsCtrl,
} = require('../../controllers/academic/locationCtrl');

locationRouter.get('/regions', isLogin, getRegionsCtrl);
locationRouter.get('/regions/:regionId/divisions', isLogin, getDivisionsCtrl);
locationRouter.get('/divisions/:divisionId/subdivisions', isLogin, getSubdivisionsCtrl);

module.exports = locationRouter;
