const express=require('express');
const {createIdentityService}=require('../../model/identity/identityService');
const {createSchoolAccess}=require('../../model/identity/schoolAccess');
const {createMarksService}=require('../../model/identity/marksService');
const {originGuard,readSessionToken}=require('../../middlewares/canonicalSession');
function createScopedMarksRouter({identityService=createIdentityService(),database,publicOrigin,datedPlacement=false}={}){
    const router=express.Router(),access=createSchoolAccess(identityService),service=createMarksService(access,database,{datedPlacement});
    router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});router.use(originGuard(publicOrigin));
    router.use(async(req,_res,next)=>{const token=readSessionToken(req);req.schoolContext=await access.resolve(token);
        if(req.method!=='GET'&&!await identityService.validateCsrf(token,req.get('X-CSRF-Token')))throw Object.assign(new Error('Access denied'),{statusCode:403});next();});
    router.get('/sheet',async(req,res)=>{const parse=value=>typeof value==='string'&&/^[1-9]\d*$/.test(value)?Number(value):null;
        res.json({status:'success',data:await service.sheet(req.schoolContext,{offeringId:parse(req.query.offeringId),yearId:parse(req.query.yearId),term:req.query.term})});});
    router.post('/scores',async(req,res)=>res.json({status:'success',data:await service.save(req.schoolContext,req.body)}));return router;
}
module.exports={createScopedMarksRouter};
