// Head of Department report: the HOD's subject across every class of their section.
// Teachers holding the head_of_department duty see their own department; administrators choose any subject.
const express = require('express');
const asyncHandler = require('express-async-handler');
const { requireStaff } = require('../../middlewares/staffAccess');
const { createDepartmentReport } = require('../../model/Academic/departmentReport');

function createDepartmentRouter({ service = createDepartmentReport() } = {}) {
    const router = express.Router();
    const heads = requireStaff({ duties: ['head_of_department'] });
    router.get('/options', heads, asyncHandler(async (req, res) => res.json({ status: 'success', data: await service.options(req.actor) })));
    router.get('/report', heads, asyncHandler(async (req, res) => res.json({ status: 'success', data: await service.report(req.actor, req.query) })));
    // Whole school, every subject: administrators only.
    router.get('/school-report', requireStaff(), asyncHandler(async (req, res) => res.json({ status: 'success', data: await service.schoolReport(req.actor, req.query) })));
    return router;
}

module.exports = createDepartmentRouter();
module.exports.createDepartmentRouter = createDepartmentRouter;
