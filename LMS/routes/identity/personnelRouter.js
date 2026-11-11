const express=require('express');
const { createIdentityService }=require('../../model/identity/identityService');
const { createSchoolAccess }=require('../../model/identity/schoolAccess');
const { createPersonnelRepository }=require('../../model/identity/personnelRepository');
const { createPersonnelService }=require('../../model/identity/personnelService');
const { readSessionToken,originGuard }=require('../../middlewares/canonicalSession');
const invalid=()=>Object.assign(new Error('Invalid personnel request'),{ statusCode:422 });
function integer(value,fallback) {
    if (value===undefined) return fallback;
    if (typeof value!=='string' || !/^\d+$/.test(value)) throw invalid();
    const number=Number(value);
    if (!Number.isSafeInteger(number)) throw invalid();
    return number;
}
// Not mounted until all legacy APIs and browser authentication can switch together.
function createScopedPersonnelRouter({ identityService=createIdentityService(),database,publicOrigin,enrolmentLedger=false }={}) {
    const router=express.Router();
    const access=createSchoolAccess(identityService);
    const repository=createPersonnelRepository(access,database);
    const service=createPersonnelService(access,database,{enrolmentLedger});
    router.use((_req,res,next)=>{ res.setHeader('Cache-Control','no-store');next(); });
    router.use(originGuard(publicOrigin));
    router.use(async(req,_res,next)=>{
        const token=readSessionToken(req);
        req.schoolContext=await access.resolve(token);
        if (!['GET','HEAD','OPTIONS'].includes(req.method) && !await identityService.validateCsrf(token,req.get('X-CSRF-Token')))
            throw Object.assign(new Error('Access denied'),{ statusCode:403 });
        next();
    });
    router.get('/students',async(req,res)=>res.json({ status:'success',...await repository.listStudents(req.schoolContext,{
        search:req.query.search??'',limit:integer(req.query.limit,50),offset:integer(req.query.offset,0) }) }));
    router.get('/teachers',async(req,res)=>res.json({ status:'success',...await repository.listTeachers(req.schoolContext,{
        search:req.query.search??'',limit:integer(req.query.limit,50),offset:integer(req.query.offset,0) }) }));
    for (const [path,kind] of [['students','student'],['teachers','teacher']]) {
        router.get(`/${path}/:id/edit-profile`,async(req,res)=>{
            const record=await repository.editProfile(req.schoolContext,kind,integer(req.params.id));
            if(!record)return res.status(404).json({status:'failed',message:'Personnel record not found'});
            res.json({status:'success',data:record});
        });
        router.get(`/${path}/:id`,async(req,res)=>{
            const id=integer(req.params.id);
            const result=await (kind==='student'?repository.getStudent(req.schoolContext,id):repository.getTeacher(req.schoolContext,id));
            if (!result) return res.status(404).json({ status:'failed',message:'Personnel record not found' });
            res.json({ status:'success',data:result });
        });
        router.post(`/${path}`,async(req,res)=>res.status(201).json({ status:'success',data:await service.register(req.schoolContext,kind,req.body) }));
        router.patch(`/${path}/:id`,async(req,res)=>{
            const { version,...fields }=req.body || {};
            const result=await service.update(req.schoolContext,kind,integer(req.params.id),version,fields);
            res.json({ status:'success',data:result });
        });
        router.post(`/${path}/:id/status`,async(req,res)=>{
            const body=req.body || {};
            if (Object.keys(body).some(key=>!['version','status','reason'].includes(key))) throw invalid();
            const result=await service.setStatus(req.schoolContext,kind,integer(req.params.id),body.version,body.status,body.reason);
            res.json({ status:'success',data:result });
        });
    }
    return router;
}
module.exports={ createScopedPersonnelRouter };
