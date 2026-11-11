const express=require('express');
const { createIdentityService }=require('../../model/identity/identityService');
const { createSchoolAccess }=require('../../model/identity/schoolAccess');
const { createAcademicSetupService }=require('../../model/identity/academicSetupService');
const { readSessionToken,originGuard }=require('../../middlewares/canonicalSession');
const invalid=()=>Object.assign(new Error('Invalid academic request'),{ statusCode:422 });
function id(value) {
    if (typeof value!=='string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw invalid();
    return Number(value);
}
// Unmounted until canonical browser authentication and all domain scopes are ready.
function createScopedAcademicRouter({ identityService=createIdentityService(),database,publicOrigin,yearCoverage=false,yearArchive=false }={}) {
    const router=express.Router(),access=createSchoolAccess(identityService);
    const service=createAcademicSetupService(access,database,{yearArchive});
    router.use((_req,res,next)=>{ res.setHeader('Cache-Control','no-store');next(); });
    router.use(originGuard(publicOrigin));
    router.use(async(req,_res,next)=>{
        const token=readSessionToken(req);
        req.schoolContext=await access.resolve(token);
        if (!['GET','HEAD','OPTIONS'].includes(req.method) && !await identityService.validateCsrf(token,req.get('X-CSRF-Token')))
            throw Object.assign(new Error('Access denied'),{ statusCode:403 });
        next();
    });
    router.get('/context',async(req,res)=>res.json({ status:'success',data:await service.context(req.schoolContext) }));
    if (yearArchive) router.post('/academic-years/:id/archive',async(req,res)=>{
        if (Object.keys(req.query).length || Object.keys(req.body || {}).some(key=>!['version','reason'].includes(key))) throw invalid();
        const data=await service.archive(req.schoolContext,id(req.params.id),req.body?.version,req.body?.reason);
        res.json({status:'success',data});
    });
    if (yearCoverage) router.get('/academic-years/:id/coverage',async(req,res)=>{
        if (Object.keys(req.query).length) throw invalid();
        res.json({ status:'success',data:await service.yearCoverage(req.schoolContext,id(req.params.id)) });
    });
    for(const [path,kind] of [['academic-years','year'],['classes','class'],['subjects','subject']]) {
        router.get(`/${path}`,async(req,res)=>res.json({ status:'success',data:await service.list(req.schoolContext,kind) }));
        router.post(`/${path}`,async(req,res)=>res.status(201).json({ status:'success',data:await service.create(req.schoolContext,kind,req.body) }));
        router.patch(`/${path}/:id`,async(req,res)=>{
            const { version,...fields }=req.body || {};
            res.json({ status:'success',data:await service.update(req.schoolContext,kind,id(req.params.id),version,fields) });
        });
    }
    router.post('/academic-years/:id/current',async(req,res)=>{
        const body=req.body || {};
        if (Object.keys(body).some(key=>key!=='version')) throw invalid();
        res.json({ status:'success',data:await service.setCurrent(req.schoolContext,id(req.params.id),body.version) });
    });
    return router;
}
module.exports={ createScopedAcademicRouter };
