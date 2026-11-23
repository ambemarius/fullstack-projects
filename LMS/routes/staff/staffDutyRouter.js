const express = require('express');
const staffDutyRouter = express.Router();
const { listDutiesCtrl, grantDutyCtrl, revokeDutyCtrl, myDutiesCtrl, setDutyClassesCtrl, setDutyDepartmentCtrl } = require('../../controllers/staff/staffDutyCtrl');
const isLogin = require('../../middlewares/isLogin');
const { requireStaff } = require('../../middlewares/staffAccess');

staffDutyRouter.get('/mine', requireStaff({ anyStaff: true }), myDutiesCtrl);
staffDutyRouter.get('/', isLogin, listDutiesCtrl);
staffDutyRouter.post('/', isLogin, grantDutyCtrl);
staffDutyRouter.delete('/:id', isLogin, revokeDutyCtrl);
staffDutyRouter.put('/:id/classes', isLogin, setDutyClassesCtrl);
staffDutyRouter.put('/:id/department', isLogin, setDutyDepartmentCtrl);

module.exports = staffDutyRouter;
