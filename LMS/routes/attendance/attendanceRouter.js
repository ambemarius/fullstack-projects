const express = require('express');
const asyncHandler = require('express-async-handler');
const { requireStaff } = require('../../middlewares/staffAccess');
const isStudentLogin = require('../../middlewares/isStudentLogin');
const isParentLogin = require('../../middlewares/isParentLogin');
const { createAttendanceService } = require('../../model/attendance/attendanceService');

function createAttendanceRouter({ service = createAttendanceService(), notifier = require('../../services/notificationService') } = {}) {
    const router = express.Router();
    const markers = requireStaff({ duties: ['discipline_master'], allowTeacher: true });
    const supervisors = requireStaff({ duties: ['discipline_master'] });
    const ok = (res, data, status = 200) => res.status(status).json({ status: 'success', data });

    // Tell linked guardians about a new absence. Never blocks or fails the register save.
    async function notifyGuardians(result) {
        if (!result.newlyAbsent.length) return;
        try {
            const { sql, pool, poolConnect } = require('../../config/database');
            await poolConnect;
            const request = pool.request();
            result.newlyAbsent.forEach((sid, i) => request.input('s' + i, sql.Int, sid));
            const rows = (await request.query(`SELECT ps.parent_id parentId,p.firstName+' '+p.lastName student
                FROM parent_students ps JOIN students p ON p.id=ps.student_id
                WHERE ps.student_id IN (${result.newlyAbsent.map((_, i) => '@s' + i).join(',')})`)).recordset;
            const r = result.register;
            for (const row of rows) {
                await notifier.notify(['inApp'], {
                    recipientId: row.parentId, recipientType: 'parent', title: 'Absence recorded',
                    message: `${row.student} was marked absent for ${r.subjectName || 'a lesson'} on ${r.lessonDate} (${r.startTime}–${r.endTime}).`,
                });
            }
        } catch (err) {
            console.error('Guardian absence notice failed:', err.message);
        }
    }

    router.get('/options', supervisors, asyncHandler(async (req, res) => ok(res, await service.options(req.actor))));
    router.get('/my-lessons', requireStaff({ allowTeacher: true, allowAdmin: false }), asyncHandler(async (req, res) => ok(res, await service.myLessons(req.actor, req.query))));
    router.get('/class-lessons', supervisors, asyncHandler(async (req, res) => ok(res, await service.classLessons(req.actor, req.query))));
    router.post('/registers', markers, asyncHandler(async (req, res) => {
        const result = await service.openRegister(req.actor, req.body || {});
        ok(res, result, result.created ? 201 : 200);
    }));
    router.get('/registers/:id', markers, asyncHandler(async (req, res) => ok(res, await service.getRegister(req.actor, req.params.id))));
    router.post('/registers/:id/marks', markers, asyncHandler(async (req, res) => {
        const result = await service.saveMarks(req.actor, req.params.id, req.body || {});
        await notifyGuardians(result);
        res.status(200).json({ status: 'success', message: result.saved ? `Saved ${result.saved} mark(s).` : 'No changes to save.', data: { saved: result.saved, unchanged: result.unchanged } });
    }));
    router.get('/registers/:id/students/:studentId/history', markers, asyncHandler(async (req, res) => ok(res, await service.history(req.actor, req.params.id, req.params.studentId))));
    router.post('/justify', supervisors, asyncHandler(async (req, res) => {
        await service.justify(req.actor, req.body || {});
        res.status(200).json({ status: 'success', message: 'Absence justified.' });
    }));
    router.get('/absences', supervisors, asyncHandler(async (req, res) => ok(res, await service.absences(req.actor, req.query))));
    router.get('/summary', supervisors, asyncHandler(async (req, res) => ok(res, await service.classSummary(req.actor, req.query))));

    router.get('/me', isStudentLogin, asyncHandler(async (req, res) => {
        const student = req.userAuth;
        if (!student.school_id) throw Object.assign(new Error('Your record is not linked to a school yet.'), { statusCode: 409 });
        ok(res, await service.studentSummary({ schoolId: student.school_id }, { studentId: student.id, yearId: req.query.yearId, term: req.query.term }));
    }));
    router.get('/children/:studentId', isParentLogin, asyncHandler(async (req, res) => {
        const Parent = require('../../model/Academic/parent');
        const studentId = Number(req.params.studentId);
        if (!Number.isSafeInteger(studentId) || studentId < 1) throw Object.assign(new Error('Invalid student'), { statusCode: 400 });
        if (!await Parent.isLinked(req.auth.legacyId, studentId)) throw Object.assign(new Error('You do not have access to this student'), { statusCode: 403 });
        const { sql, pool, poolConnect } = require('../../config/database');
        await poolConnect;
        const school = (await pool.request().input('id', sql.Int, studentId).query('SELECT school_id FROM students WHERE id=@id')).recordset[0]?.school_id;
        if (!school) throw Object.assign(new Error('This student is not linked to a school yet.'), { statusCode: 409 });
        ok(res, await service.studentSummary({ schoolId: school }, { studentId, yearId: req.query.yearId, term: req.query.term }));
    }));

    return router;
}

module.exports = createAttendanceRouter();
module.exports.createAttendanceRouter = createAttendanceRouter;
