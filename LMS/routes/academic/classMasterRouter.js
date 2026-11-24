// Class master's end-of-term report. Teachers see the classes they are class master of; administrators see any class.
const express = require('express');
const asyncHandler = require('express-async-handler');
const { requireStaff } = require('../../middlewares/staffAccess');
const { createClassMasterReport } = require('../../model/Academic/classMasterReport');

function createClassMasterRouter({ service = createClassMasterReport() } = {}) {
    const router = express.Router();
    const staff = requireStaff({ allowTeacher: true });
    router.get('/options', staff, asyncHandler(async (req, res) => res.json({ status: 'success', data: await service.options(req.actor) })));
    router.get('/report', staff, asyncHandler(async (req, res) => res.json({ status: 'success', data: await service.report(req.actor, req.query) })));
    return router;
}

module.exports = createClassMasterRouter();
module.exports.createClassMasterRouter = createClassMasterRouter;
