const asyncHandler = require('express-async-handler');
const Auxiliary = require('../../model/staff/auxiliary');

const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

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
    const staff = await Auxiliary.getAll();
    res.status(200).json({ status: 'success', results: staff.length, data: staff });
});

//@desc   Get a single auxiliary staff
//@route  GET /api/v1/auxiliary/:id
//@access Private (admin)
exports.singleAuxiliaryCtrl = asyncHandler(async (req, res) => {
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
    if (!status) throw httpError(400, 'status is required');

    const updated = await Auxiliary.setStatus(req.params.id, status);
    res.status(200).json({ status: 'success', data: updated });
});
