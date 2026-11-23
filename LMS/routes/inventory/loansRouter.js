// "My loans": a student's own library loans, or a linked guardian's view of a child's.
const express = require('express');
const asyncHandler = require('express-async-handler');
const isStudentLogin = require('../../middlewares/isStudentLogin');
const isParentLogin = require('../../middlewares/isParentLogin');
const { createInventoryService } = require('../../model/inventory/inventoryService');

function createLoansRouter({ service = createInventoryService() } = {}) {
    const router = express.Router();
    const httpError = (status, message) => Object.assign(new Error(message), { statusCode: status });

    router.get('/my-loans', isStudentLogin, asyncHandler(async (req, res) => {
        if (!req.userAuth.school_id) throw httpError(409, 'Your record is not linked to a school yet.');
        res.json({ status: 'success', data: await service.studentLoans(req.userAuth.school_id, req.userAuth.id) });
    }));

    router.get('/children/:studentId', isParentLogin, asyncHandler(async (req, res) => {
        const studentId = Number(req.params.studentId);
        if (!Number.isSafeInteger(studentId) || studentId < 1) throw httpError(400, 'Invalid student');
        if (!await require('../../model/Academic/parent').isLinked(req.auth.legacyId, studentId)) throw httpError(403, 'You do not have access to this student');
        const { sql, pool, poolConnect } = require('../../config/database');
        await poolConnect;
        const school = (await pool.request().input('id', sql.Int, studentId).query('SELECT school_id FROM students WHERE id=@id')).recordset[0]?.school_id;
        if (!school) throw httpError(409, 'This student is not linked to a school yet.');
        res.json({ status: 'success', data: await service.studentLoans(school, studentId) });
    }));
    return router;
}

module.exports = createLoansRouter();
module.exports.createLoansRouter = createLoansRouter;
