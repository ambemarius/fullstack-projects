const express = require('express');
const staffDutyRouter = express.Router();
const { listDutiesCtrl, grantDutyCtrl, revokeDutyCtrl, myDutiesCtrl, setDutyClassesCtrl } = require('../../controllers/staff/staffDutyCtrl');
const isLogin = require('../../middlewares/isLogin');
const { requireStaff } = require('../../middlewares/staffAccess');

staffDutyRouter.get('/mine', requireStaff({ anyStaff: true }), myDutiesCtrl);
staffDutyRouter.get('/', isLogin, listDutiesCtrl);
staffDutyRouter.post('/', isLogin, grantDutyCtrl);
staffDutyRouter.delete('/:id', isLogin, revokeDutyCtrl);
staffDutyRouter.put('/:id/classes', isLogin, setDutyClassesCtrl);

module.exports = staffDutyRouter;
