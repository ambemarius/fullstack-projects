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
    res.status(200).json({
        status: 'success',
        data: { duties: await StaffDuty.listActive(), catalogue: StaffDuty.DUTIES, staff: people.recordset },
    });
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
    const dutyId = await StaffDuty.grant({ staffType, staffId: id, duty, adminId: req.userAuth.id });
    res.status(201).json({ status: 'success', message: `${StaffDuty.DUTIES[duty]} duty granted`, data: { id: dutyId } });
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
        },
    });
});
