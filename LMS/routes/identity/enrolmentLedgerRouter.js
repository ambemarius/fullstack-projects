const express = require('express');
const { createIdentityService } = require('../../model/identity/identityService');
const { createSchoolAccess } = require('../../model/identity/schoolAccess');
const { createEnrolmentLedgerService } = require('../../model/identity/enrolmentLedgerService');
const { readSessionToken, originGuard } = require('../../middlewares/canonicalSession');
const invalid = () => Object.assign(new Error('Invalid enrolment scope'), { statusCode: 422 });
function integer(value) {
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > 2147483647) throw invalid();
    return Number(value);
}
// Staged factory only. Production requires reviewed schema, UI and projection integration.
function createEnrolmentLedgerRouter({ identityService = createIdentityService(), database, publicOrigin,readOnly=false } = {}) {
    const router = express.Router(), access = createSchoolAccess(identityService), service = createEnrolmentLedgerService(access, database);
    router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
    router.use(originGuard(publicOrigin));
    router.use(async (req, res, next) => {
        const token = readSessionToken(req); req.schoolContext = await access.resolve(token);
        await access.authorize(req.schoolContext, ['admin']);
        if(readOnly&&!['GET','HEAD'].includes(req.method))return res.status(405).set('Allow','GET, HEAD').json({message:'Enrolment changes are not enabled in this workspace'});
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !await identityService.validateCsrf(token, req.get('X-CSRF-Token')))
            throw Object.assign(new Error('Access denied'), { statusCode: 403 });
        next();
    });
    router.post('/', async (req, res) => res.status(201).json({ status: 'success', data: await service.record(req.schoolContext, req.body) }));
    router.post('/:id/revisions', async (req, res) => res.json({ status: 'success', data: await service.revise(req.schoolContext, integer(req.params.id), req.body) }));
    router.post('/:id/transfers', async (req, res) => res.json({ status: 'success', data: await service.transfer(req.schoolContext, integer(req.params.id), req.body) }));
    router.get('/students/:id/history', async (req, res) => {
        if (Object.keys(req.query).length) throw invalid();
        res.json({ status: 'success', data: await service.history(req.schoolContext, integer(req.params.id)) });
    });
    router.get('/roster', async (req, res) => {
        if (Object.keys(req.query).some(key => !['classId', 'yearId', 'onDate', 'afterStudentId'].includes(key))) throw invalid();
        res.json({ status: 'success', data: await service.roster(req.schoolContext, {
            classId: integer(req.query.classId), yearId: integer(req.query.yearId), onDate: req.query.onDate,
            ...(req.query.afterStudentId === undefined ? {} : { afterStudentId: integer(req.query.afterStudentId) })
        }) });
    });
    return router;
}
module.exports = { createEnrolmentLedgerRouter };
