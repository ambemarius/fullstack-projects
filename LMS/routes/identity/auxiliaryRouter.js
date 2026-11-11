const express=require('express');const {createSchoolAccess}=require('../../model/identity/schoolAccess');const {createAuxiliaryService}=require('../../model/identity/auxiliaryService');const {readSessionToken,originGuard}=require('../../middlewares/canonicalSession');
function createAuxiliaryRouter({identityService,database,publicOrigin,staffAccounts=false}){
 const access=createSchoolAccess(identityService),service=createAuxiliaryService(access,database,{staffAccounts}),router=express.Router();router.use(originGuard(publicOrigin));
 router.use(async(req,res,next)=>{res.setHeader('Cache-Control','no-store');const token=readSessionToken(req);req.schoolContext=await access.resolve(token);if(!['GET','HEAD'].includes(req.method)&&!await identityService.validateCsrf(token,req.get('X-CSRF-Token')))throw Object.assign(new Error('Access denied'),{statusCode:403});next();});
 const integer=value=>{if(typeof value!=='string'||!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw Object.assign(new Error('Invalid request'),{statusCode:422});return Number(value);};
 router.get('/',async(req,res)=>res.json({status:'success',...await service.list(req.schoolContext,{search:req.query.search??'',limit:req.query.limit===undefined?50:integer(req.query.limit),offset:req.query.offset===undefined?0:integer(req.query.offset)})}));
 router.post('/',async(req,res)=>res.status(201).json({status:'success',data:await service.create(req.schoolContext,req.body)}));
 router.patch('/:id',async(req,res)=>{const {version,...fields}=req.body||{};res.json({status:'success',data:await service.update(req.schoolContext,integer(req.params.id),version,fields)});});
 router.post('/:id/status',async(req,res)=>{if(!req.body||Object.keys(req.body).some(key=>!['version','status'].includes(key)))return res.status(422).json({message:'Unsupported status fields'});res.json({status:'success',data:await service.setStatus(req.schoolContext,integer(req.params.id),req.body.version,req.body.status)});});return router;
}
module.exports={createAuxiliaryRouter};
