const express=require('express');const {originGuard,readSessionToken,COOKIE}=require('../../middlewares/canonicalSession');
const {createNativeStaffService}=require('../../model/identity/nativeStaffService');const {createAuxiliaryInvitationService}=require('../../model/identity/auxiliaryInvitationService');
function createStaffAccountsRouter({identityService,database,publicOrigin,schoolCode=null,schoolAdministration=false,now=Date.now}){
 const native=createNativeStaffService(identityService,database,{schoolCode,schoolAdministration}),existing=createAuxiliaryInvitationService(identityService,database,{schoolCode}),router=express.Router(),attempts=new Map();
 router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});router.use(originGuard(publicOrigin));
 router.use((req,res,next)=>{if(req.method==='GET')return next();const time=now();for(const [key,item]of attempts)if(time>=item.until)attempts.delete(key);let item=attempts.get(req.ip);if(!item){if(attempts.size>=1000)return res.status(429).json({message:'Try again later'});item={count:0,until:time+900000};attempts.set(req.ip,item);}if(++item.count>20)return res.status(429).json({message:'Try again later'});next();});
 for(const [path,method]of [['/activate','accept'],['/reset','reset']])router.post(path,async(req,res)=>{if(!req.body||Object.keys(req.body).length!==2||!Object.hasOwn(req.body,'invitationToken')||!Object.hasOwn(req.body,'password'))return res.status(422).json({message:'Use the token and your private password only'});const data=await native[method](req.body.invitationToken,req.body.password);res.clearCookie(COOKIE,{httpOnly:true,secure:true,sameSite:'strict',path:'/'});res.json({status:'success',data});});
 router.use(async(req,_res,next)=>{const token=readSessionToken(req);if(!await identityService.resolveSession(token)||req.method!=='GET'&&!await identityService.validateCsrf(token,req.get('X-CSRF-Token')))throw Object.assign(new Error('Access denied'),{statusCode:403});req.staffToken=token;next();});
 router.get('/context',async(req,res)=>res.json({status:'success',data:await native.managementContext(req.staffToken)}));
 // Other institutions' account directories/invitations are never school administration tools.
 if(schoolAdministration)router.use((req,res,next)=>{if(req.path==='/existing'||req.path==='/existing-accounts')return res.status(404).json({message:'Not available in this school workspace'});next();});
 for(const [path,method]of [['/directory','directory'],['/administrators','administrators'],['/tokens','tokens'],['/existing-accounts','existingAccounts']])router.get(path,async(req,res)=>{const id=typeof req.query.schoolId==='string'&&/^[1-9]\d*$/.test(req.query.schoolId)?Number(req.query.schoolId):null;res.json({status:'success',data:await native[method](req.staffToken,id)});});
 router.post('/administrators',async(req,res)=>res.status(201).json({status:'success',data:await native.createAdministrator(req.staffToken,req.body)}));
 router.post('/administrators/disable',async(req,res)=>res.json({status:'success',data:await native.disableAdministrator(req.staffToken,req.body)}));
 router.post('/invite',async(req,res)=>res.status(201).json({status:'success',data:await native.issue(req.staffToken,req.body)}));
 router.post('/recover',async(req,res)=>res.status(201).json({status:'success',data:await native.issueRecovery(req.staffToken,req.body)}));
 router.post('/:id/revoke',async(req,res)=>{if(req.body&&Object.keys(req.body).length)return res.status(422).json({message:'No additional fields permitted'});res.json({status:'success',data:await native.revoke(req.staffToken,req.params.id)});});
 router.post('/existing',async(req,res)=>res.status(201).json({status:'success',data:await existing.issue(req.staffToken,req.body)}));
 router.post('/existing/accept',async(req,res)=>{if(!req.body||Object.keys(req.body).length!==1||!Object.hasOwn(req.body,'invitationToken'))return res.status(422).json({message:'Only the invitation token is permitted'});const data=await existing.accept(req.staffToken,req.body.invitationToken);res.clearCookie(COOKIE,{httpOnly:true,secure:true,sameSite:'strict',path:'/'});res.json({status:'success',data});});
 return router;
}
module.exports={createStaffAccountsRouter};
