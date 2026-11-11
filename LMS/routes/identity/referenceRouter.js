const express=require('express');
const {sql,pool,connect}=require('../../config/database');
const {createIdentityService}=require('../../model/identity/identityService');
const {createSchoolAccess,authoritySql}=require('../../model/identity/schoolAccess');
const {readSessionToken}=require('../../middlewares/canonicalSession');
function createReferenceRouter({identityService=createIdentityService(),database={connect,getPool:()=>pool}}={}){
    const router=express.Router(),access=createSchoolAccess(identityService);
    router.get('/:type',async(req,res)=>{if(!['regions','divisions'].includes(req.params.type))return res.sendStatus(404);
        const context=await access.resolve(readSessionToken(req));const identity=await access.authorize(context,['admin']);await database.connect();
        const request=database.getPool().request().input('school',sql.Int,identity.schoolId).input('account',sql.Int,identity.accountId)
            .input('membership',sql.Int,identity.membershipId).input('session_hash',sql.Char(64),identity.tokenHash).input('role_one',sql.VarChar(30),'admin').input('role_two',sql.VarChar(30),null);
        if(req.params.type==='divisions'){if(typeof req.query.regionId!=='string'||!/^[1-9]\d*$/.test(req.query.regionId)||Number(req.query.regionId)>2147483647)return res.status(422).json({message:'Select a valid region'});request.input('region',sql.Int,Number(req.query.regionId));}
        const result=await request.query(`SELECT id,name FROM dbo.[${req.params.type}] WHERE ${req.params.type==='divisions'?'region_id=@region AND ':''}${authoritySql} ORDER BY name`);
        res.setHeader('Cache-Control','no-store');res.json({status:'success',data:result.recordset});});return router;
}module.exports={createReferenceRouter};
