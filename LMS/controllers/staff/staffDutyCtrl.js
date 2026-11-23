const asyncHandler = require('express-async-handler');
const StaffDuty = require('../../model/staff/staffDuty');

const httpError = (status, message) => Object.assign(new Error(message), { statusCode: status });

//@desc   Active duties, the duty catalogue and the staff who can hold them
//@route  GET /api/v1/staff-duties
//@access Private (admin)
exports.listDutiesCtrl = asyncHandler(async (_req, res) => {
    const { pool, poolConnect } = require('../../config/database');
    await poolConnect;
    const people = await pool.request().query(`
        SELECT 'teacher' AS staffType, id AS staffId, name, email, status FROM teachers WHERE status = 'active'
        UNION ALL
        SELECT 'auxiliary', id, name, email, status FROM auxiliary_staff WHERE status IN ('active', 'pending')
        ORDER BY name`);
    const classes = await pool.request().query(`SELECT id, section + ' — ' + name + COALESCE(' (' + NULLIF(stream, 'Normal') + ')', '') AS label
        FROM classes ORDER BY section, rank, name`);
    const byDuty = await StaffDuty.classesByDuty();
    const duties = (await StaffDuty.listActive()).map(d => ({ ...d, classes: d.duty === 'discipline_master' ? byDuty.get(d.id) || [] : undefined }));
    res.status(200).json({
        status: 'success',
        data: { duties, catalogue: StaffDuty.DUTIES, staff: people.recordset, classes: classes.recordset },
    });
});

//@desc   Choose the classes a discipline master looks after (empty list = the whole school)
//@route  PUT /api/v1/staff-duties/:id/classes   { classIds: [..] }
//@access Private (admin)
exports.setDutyClassesCtrl = asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw httpError(400, 'Invalid duty');
    const classIds = (req.body || {}).classIds;
    if (!Array.isArray(classIds) || classIds.length > 60) throw httpError(422, 'Send the classes as a list');
    const saved = await StaffDuty.setClasses(id, classIds, req.userAuth.id);
    res.status(200).json({ status: 'success', message: saved.length ? `Discipline master now looks after ${saved.length} class${saved.length === 1 ? '' : 'es'}` : 'Discipline master now covers the whole school', data: { classIds: saved } });
});

//@desc   Grant a duty to a teacher or auxiliary staff member
//@route  POST /api/v1/staff-duties
//@access Private (admin)
exports.grantDutyCtrl = asyncHandler(async (req, res) => {
    const { staffType, staffId, duty } = req.body || {};
    const id = Number(staffId);
    if (!['teacher', 'auxiliary'].includes(staffType)) throw httpError(422, 'Choose a teacher or auxiliary staff member');
    if (!Number.isSafeInteger(id) || id < 1) throw httpError(422, 'Choose a staff member');
    if (!Object.hasOwn(StaffDuty.DUTIES, duty)) throw httpError(422, 'Choose a valid duty');
    const classIds = Array.isArray((req.body || {}).classIds) ? req.body.classIds : [];
    if (classIds.length && duty !== 'discipline_master') throw httpError(422, 'Only a discipline master looks after classes');
    const dutyId = await StaffDuty.grant({ staffType, staffId: id, duty, adminId: req.userAuth.id });
    if (classIds.length) {
        try {
            await StaffDuty.setClasses(dutyId, classIds, req.userAuth.id);
        } catch (err) {
            // Never leave a discipline master with school-wide access when their classes could not be saved.
            await StaffDuty.revoke(dutyId, req.userAuth.id).catch(() => {});
            throw err;
        }
    }
    res.status(201).json({ status: 'success', message: `${StaffDuty.DUTIES[duty]} duty granted${classIds.length ? ` for ${classIds.length} class${classIds.length === 1 ? '' : 'es'}` : ''}`, data: { id: dutyId } });
});

//@desc   Remove a duty
//@route  DELETE /api/v1/staff-duties/:id
//@access Private (admin)
exports.revokeDutyCtrl = asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw httpError(400, 'Invalid duty');
    await StaffDuty.revoke(id, req.userAuth.id);
    res.status(200).json({ status: 'success', message: 'Duty removed' });
});

//@desc   The signed-in staff member's own duties
//@route  GET /api/v1/staff-duties/mine
//@access Private (admin, teacher or auxiliary)
exports.myDutiesCtrl = asyncHandler(async (req, res) => {
    res.status(200).json({
        status: 'success',
        data: {
            name: req.actor.name,
            accountType: req.actor.type,
            duties: req.actor.duties.map(duty => ({ duty, label: StaffDuty.DUTIES[duty] })),
            disciplineClasses: req.actor.disciplineClasses,   // null = whole school
        },
    });
});
