const express=require('express');
const {createSchoolAccess}=require('../../model/identity/schoolAccess');
const {createAttendanceService}=require('../../model/identity/attendanceService');
const {originGuard,readSessionToken}=require('../../middlewares/canonicalSession');

function createAttendanceRouter({database,identityService,publicOrigin,tokenFrom=readSessionToken}){
    const router=express.Router(),access=createSchoolAccess(identityService);
    const service=createAttendanceService(access,database);
    router.use(originGuard(publicOrigin));
    router.use(async(req,res,next)=>{
        res.set('Cache-Control','no-store');
        const token=tokenFrom(req);req.schoolContext=await access.resolve(token);
        if(req.method==='POST'&&!await identityService.validateCsrf(token,req.get('X-CSRF-Token')))
            throw Object.assign(Error('Access denied'),{statusCode:403});
        next();
    });
    router.get('/registers',async(req,res)=>res.json(await service.registers(req.schoolContext)));
    router.get('/registers/:id',async(req,res)=>res.json(await service.sheet(req.schoolContext,Number(req.params.id))));
    router.get('/registers/:id/pupils/:pupil/history',async(req,res)=>
        res.json(await service.history(req.schoolContext,Number(req.params.id),Number(req.params.pupil))));
    router.get('/totals',async(req,res)=>res.json(await service.totals(req.schoolContext,{
        ...req.query,registerId:Number(req.query.registerId)
    })));
    router.post('/entries',async(req,res)=>res.json(await service.save(req.schoolContext,req.body)));
    return router;
}
module.exports={createAttendanceRouter};
