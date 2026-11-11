const express=require('express');
const https=require('node:https');
const fs=require('node:fs');
const path=require('node:path');
const {createApp}=require('../app/app');
const {createDatabase}=require('../config/database');
const {createIdentityService}=require('../model/identity/identityService');
const {originGuard}=require('../middlewares/canonicalSession');
const {createAttendanceRouter}=require('../routes/identity/attendanceRouter');
const {loadTestEnvironment}=require('./testEnvironment');
const {prepareAttendanceSample}=require('./attendanceSample');
const origin='https://localhost:2029',cookie='__Host-lms_attendance_sample';

function sampleToken(req){
    const matches=(req.get('Cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(cookie+'='));
    return matches.length===1?matches[0].slice(cookie.length+1):null;
}
function previewApp(database,account){
    const identityService=createIdentityService(database),pages=express.Router();
    pages.get('/',(_req,res)=>res.render('attendance'));
    pages.post('/practice/sign-in',originGuard(origin),async(req,res)=>{
        const token=sampleToken(req),current=await identityService.resolveSession(token);
        if(current?.membershipId===account.membershipId)return res.json(await identityService.refreshCsrf(token));
        const session=await identityService.createSession(account.accountId,account.membershipId);
        res.cookie(cookie,session.token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',expires:session.expiresAt});
        res.json({csrfToken:session.csrfToken});
    });
    return createApp({logging:false,requestContext:(req,res,next)=>{
        res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
            'Content-Security-Policy':"default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
        next();
    },routes:[['/',pages],['/api/attendance',createAttendanceRouter({database,identityService,publicOrigin:origin,tokenFrom:sampleToken})]]});
}
async function main(){
    loadTestEnvironment();const db=createDatabase();
    try{
        const account=await prepareAttendanceSample(db,'ATT_SAMPLE_PRACTICE');
        const tls=path.join(__dirname,'../backups/runtime/tls');
        const server=https.createServer({key:fs.readFileSync(path.join(tls,'localhost.key')),cert:fs.readFileSync(path.join(tls,'localhost.crt'))},previewApp(db,account));
        await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(2029,'127.0.0.1',resolve);});
        console.log('Attendance practice register ready at '+origin);
    }catch(error){await db.close();throw error;}
}
if(require.main===module)main().catch(error=>{console.error(error.code||'Attendance preview failed');process.exitCode=1;});
module.exports={previewApp};
