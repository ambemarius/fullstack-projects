const asyncHandler = require('express-async-handler');
const Auxiliary = require('../../model/staff/auxiliary');
const StaffDuty = require('../../model/staff/staffDuty');
const generateToken = require('../../utils/generateToken');
const { setAuthCookie } = require('../../utils/authCookie');

const STATUSES = ['pending', 'active', 'suspended'];
const MIN_PASSWORD = 12;

const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

//@desc   Auxiliary staff sign-in (bursar, librarian, lab attendant, discipline master)
//@route  POST /api/v1/auxiliary/login
//@access Public
exports.loginAuxiliaryCtrl = asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
        throw httpError(400, 'email and password are required');
    }
    const staff = await Auxiliary.findForLogin(email.trim());
    const isMatch = staff?.password && await Auxiliary.verifyPassword(password, staff.password);
    if (!isMatch) throw httpError(401, 'Invalid login credentials');
    if (staff.status !== 'active') throw httpError(403, 'Your account is not active. Contact your school administrator.');

    const token = generateToken(staff.id, 'auxiliary');
    setAuthCookie(res, token);
    const { password: _omit, ...safe } = staff;
    res.status(200).json({ status: 'success', data: { ...safe, duties: await StaffDuty.forStaff('auxiliary', staff.id) }, token });
});

//@desc   Signed-in auxiliary staff member's profile and duties
//@route  GET /api/v1/auxiliary/profile
//@access Private (auxiliary)
exports.getAuxiliaryProfileCtrl = asyncHandler(async (req, res) => {
    res.status(200).json({ status: 'success', data: { ...req.userAuth, duties: await StaffDuty.forStaff('auxiliary', req.userAuth.id) } });
});

//@desc   Admin sets (or resets) an auxiliary staff member's sign-in password
//@route  PUT /api/v1/auxiliary/:id/password
//@access Private (admin)
exports.setAuxiliaryPasswordCtrl = asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw httpError(400, 'Invalid staff member');
    const { password } = req.body || {};
    if (typeof password !== 'string' || password.length < MIN_PASSWORD || Buffer.byteLength(password, 'utf8') > 72) {
        throw httpError(422, `Password must be ${MIN_PASSWORD} to 72 characters`);
    }
    const staff = await Auxiliary.findById(id);
    if (!staff) throw httpError(404, 'Auxiliary staff not found');
    const updated = await Auxiliary.setPassword(id, password);
    res.status(200).json({ status: 'success', message: `Sign-in password set for ${updated.name}`, data: updated });
});

//@desc   Admin registers auxiliary staff
//@route  POST /api/v1/auxiliary/register
//@access Private (admin)
exports.registerAuxiliaryCtrl = asyncHandler(async (req, res) => {
    const { firstName, middleName, lastName, email, phone, role, status } = req.body || {};
    if (!firstName || !lastName || !email || !role) {
        throw httpError(400, 'firstName, lastName, email and role are required');
    }
    const exists = await Auxiliary.findByEmail(email);
    if (exists) throw httpError(409, 'Auxiliary staff with this email already exists');

    const staff = await Auxiliary.create({ firstName, middleName, lastName, email, phone, role, status });
    res.status(201).json({ status: 'success', data: staff });
});

//@desc   List all auxiliary staff
//@route  GET /api/v1/auxiliary
//@access Private (admin)
exports.getAllAuxiliaryCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedReferencesEnabled){const data=await require('../academic/scopedLegacyReferences').handle(req, 'records', 'auxiliary');return res.status(200).json({status:'success',results:data.length,data});}

    const staff = await Auxiliary.getAll();
    res.status(200).json({ status: 'success', results: staff.length, data: staff });
});

//@desc   Get a single auxiliary staff
//@route  GET /api/v1/auxiliary/:id
//@access Private (admin)
exports.singleAuxiliaryCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedReferencesEnabled){const data=await require('../academic/scopedLegacyReferences').handle(req, 'records', 'auxiliary', req.params.id);return res.status(200).json({status:'success',data});}

    const staff = await Auxiliary.findById(req.params.id);
    if (!staff) throw httpError(404, 'Auxiliary staff not found');
    res.status(200).json({ status: 'success', data: staff });
});

//@desc   Admin updates auxiliary staff
//@route  PUT /api/v1/auxiliary/:id
//@access Private (admin)
exports.updateAuxiliaryCtrl = asyncHandler(async (req, res) => {
    const staff = await Auxiliary.findById(req.params.id);
    if (!staff) throw httpError(404, 'Auxiliary staff not found');

    const { firstName, middleName, lastName, email, phone, role, status } = req.body || {};
    const updated = await Auxiliary.update(req.params.id, { firstName, middleName, lastName, email, phone, role, status });
    res.status(200).json({ status: 'success', data: updated });
});

//@desc   Admin deletes auxiliary staff
//@route  DELETE /api/v1/auxiliary/:id
//@access Private (admin)
exports.deleteAuxiliaryCtrl = asyncHandler(async (req, res) => {
    const staff = await Auxiliary.findById(req.params.id);
    if (!staff) throw httpError(404, 'Auxiliary staff not found');

    await StaffDuty.revokeAllFor('auxiliary', staff.id, req.userAuth.id);
    await Auxiliary.remove(req.params.id);
    res.status(200).json({ status: 'success', message: 'Auxiliary staff deleted' });
});

//@desc   Admin sets status of auxiliary staff
//@route  PUT /api/v1/auxiliary/set-status/:id
//@access Private (admin)
exports.setStatusAuxiliaryCtrl = asyncHandler(async (req, res) => {
    const staff = await Auxiliary.findById(req.params.id);
    if (!staff) throw httpError(404, 'Auxiliary staff not found');

    const { status } = req.body || {};
    if (!STATUSES.includes(status)) throw httpError(400, `status must be one of ${STATUSES.join(', ')}`);

    const updated = await Auxiliary.setStatus(req.params.id, status);
    res.status(200).json({ status: 'success', data: updated });
});
