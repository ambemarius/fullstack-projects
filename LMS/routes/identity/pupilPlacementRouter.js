const express = require('express');
const { createIdentityService } = require('../../model/identity/identityService');
const { createSchoolAccess } = require('../../model/identity/schoolAccess');
const { createEnrolmentLedgerService } = require('../../model/identity/enrolmentLedgerService');
const { readSessionToken, originGuard } = require('../../middlewares/canonicalSession');

// Unmounted until the complete dated placement workflow and activation review pass.
// Deliberately exposes no standalone ledger create/revise writer.
function createPupilPlacementRouter({ identityService = createIdentityService(), database, publicOrigin, pupilLifecycle=false } = {}) {
    const router = express.Router(), access = createSchoolAccess(identityService), service = createEnrolmentLedgerService(access, database);
    router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
    router.use(originGuard(publicOrigin));
    router.use(async (req, _res, next) => {
        const token = readSessionToken(req);
        req.schoolContext = await access.resolve(token);
        await access.authorize(req.schoolContext, ['admin']);
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !await identityService.validateCsrf(token, req.get('X-CSRF-Token')))
            throw Object.assign(new Error('Access denied'), { statusCode: 403 });
        next();
    });
    router.param('id',(req,_res,next,value)=>{
        if (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647 || (req.method==='POST' && Object.keys(req.query).length))
            throw Object.assign(new Error('Invalid placement scope'), { statusCode: 422 });
        next();
    });
    router.post('/:id/transfers', async (req, res) => {
        res.json({ status: 'success', data: await service.transferCurrent(req.schoolContext, Number(req.params.id), req.body) });
    });
    if(pupilLifecycle)for(const [path,action] of [['withdrawals','withdraw'],['returns','return']]){
        router.post(`/:id/${path}`,async(req,res)=>res.json({status:'success',
            data:await service.changeStatus(req.schoolContext,Number(req.params.id),action,req.body)}));
    }
    if(pupilLifecycle)router.get('/:id/return-courses',async(req,res)=>{
        const scope={};
        for(const [key,value] of Object.entries(req.query)){
            if(!['version','profileVersion','classId','yearId'].includes(key)||typeof value!=='string'||!/^[1-9]\d*$/.test(value))
                throw Object.assign(new Error('Invalid return review scope'),{statusCode:422});
            scope[key]=Number(value);
        }
        res.json({status:'success',data:await service.returnCourses(req.schoolContext,Number(req.params.id),scope)});
    });
    return router;
}
module.exports = { createPupilPlacementRouter };
