const express = require('express');
const { createIdentityService } = require('../../model/identity/identityService');
const { createSchoolAccess } = require('../../model/identity/schoolAccess');
const { createAcademicHistoryReviewService } = require('../../model/identity/academicHistoryReviewService');
const { readSessionToken, originGuard } = require('../../middlewares/canonicalSession');
const invalid = () => Object.assign(new Error('Invalid history scope'), { statusCode: 422 });
function id(value) {
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > 2147483647) throw invalid();
    return Number(value);
}
// Review existing year evidence without requiring the staged enrolment ledger.
function createAcademicHistoryReviewRouter({ identityService = createIdentityService(), database, publicOrigin } = {}) {
    const router = express.Router(), access = createSchoolAccess(identityService);
    const service = createAcademicHistoryReviewService(access, database);
    router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
    router.use(originGuard(publicOrigin));
    router.use(async (req, res, next) => {
        req.schoolContext = await access.resolve(readSessionToken(req));
        await access.authorize(req.schoolContext, ['admin']);
        if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).set('Allow', 'GET, HEAD').json({ message: 'History review is read-only' });
        next();
    });
    router.get('/placement-review',async(req,res)=>{
        if(Object.keys(req.query).some(key=>!['yearId','afterStudentId'].includes(key)))throw invalid();
        const after=req.query.afterStudentId===undefined?undefined:id(req.query.afterStudentId);
        res.json({status:'success',data:await service.placementReviewList(req.schoolContext,id(req.query.yearId),after)});
    });
    router.use((req,_res,next)=>{
        if (Object.keys(req.query).some(key => key !== 'yearId')) throw invalid();
        next();
    });
    router.get('/students/:id', async (req, res) => res.json({ status: 'success', data: await service.student(req.schoolContext, id(req.params.id), id(req.query.yearId)) }));
    router.get('/teachers/:id', async (req, res) => res.json({ status: 'success', data: await service.teacher(req.schoolContext, id(req.params.id), id(req.query.yearId)) }));
    return router;
}
module.exports = { createAcademicHistoryReviewRouter };
