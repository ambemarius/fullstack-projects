const express=require('express');
const {originGuard,readSessionToken,COOKIE}=require('../../middlewares/canonicalSession');
const {createAuxiliaryInvitationService}=require('../../model/identity/auxiliaryInvitationService');
// Staged factory only. Not mounted in canonicalSchool or the legacy application.
function createAuxiliaryInvitationRouter({identityService,database,publicOrigin,now=Date.now}){
 const router=express.Router(),service=createAuxiliaryInvitationService(identityService,database),attempts=new Map();
 router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});router.use(originGuard(publicOrigin));
 router.use(async(req,_res,next)=>{const token=readSessionToken(req);if(!await identityService.resolveSession(token)||!await identityService.validateCsrf(token,req.get('X-CSRF-Token')))throw Object.assign(new Error('Access denied'),{statusCode:403});req.staffInvitationToken=token;next();});
 router.use((req,res,next)=>{const time=now();for(const [key,value]of attempts)if(time>=value.until)attempts.delete(key);let entry=attempts.get(req.ip);if(!entry){if(attempts.size>=1000)return res.status(429).json({message:'Please try again later'});entry={count:0,until:time+900000};attempts.set(req.ip,entry);}if(++entry.count>30)return res.status(429).json({message:'Please try again later'});next();});
 router.post('/',async(req,res)=>res.status(201).json({status:'success',data:await service.issue(req.staffInvitationToken,req.body)}));
 router.post('/accept',async(req,res)=>{
  if(!req.body||Object.keys(req.body).length!==1||!Object.hasOwn(req.body,'invitationToken'))return res.status(422).json({message:'Only the invitation token is accepted'});
  const data=await service.accept(req.staffInvitationToken,req.body.invitationToken);
  res.clearCookie(COOKIE,{httpOnly:true,secure:true,sameSite:'strict',path:'/'});res.json({status:'success',data});
 });
 router.post('/:id/revoke',async(req,res)=>{if(req.body&&Object.keys(req.body).length)return res.status(422).json({message:'Revocation takes no account or role fields'});res.json({status:'success',data:await service.revoke(req.staffInvitationToken,req.params.id)});});
 return router;
}
module.exports={createAuxiliaryInvitationRouter};
