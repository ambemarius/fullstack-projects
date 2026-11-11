const express=require('express');
const { createIdentityService }=require('../../model/identity/identityService');
const { createSchoolAccess }=require('../../model/identity/schoolAccess');
const { createAcademicLinksService }=require('../../model/identity/academicLinksService');
const { readSessionToken,originGuard }=require('../../middlewares/canonicalSession');
const { academicCsv }=require('../../utils/academicCsv');
function integer(value) {
    if(typeof value!=='string'||!/^[1-9]\d*$/.test(value)||!Number.isSafeInteger(Number(value))) throw Object.assign(new Error('Invalid link scope'),{statusCode:422});
    return Number(value);
}
// Unmounted: existing domain APIs and browser authentication must switch together.
function createScopedAcademicLinksRouter({ identityService=createIdentityService(),database,publicOrigin,datedPlacement=false,yearOfferings=false }={}) {
    const router=express.Router(),access=createSchoolAccess(identityService),service=createAcademicLinksService(access,database,{datedPlacement,yearOfferings});
    router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
    router.use(originGuard(publicOrigin));
    router.use(async(req,_res,next)=>{
        const token=readSessionToken(req);req.schoolContext=await access.resolve(token);
        if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!await identityService.validateCsrf(token,req.get('X-CSRF-Token')))
            throw Object.assign(new Error('Access denied'),{statusCode:403});
        next();
    });
    router.get('/offerings',async(req,res)=>res.json({status:'success',data:await service.listOfferings(req.schoolContext)}));
    router.post('/offerings',async(req,res)=>res.status(201).json({status:'success',data:await service.createOffering(req.schoolContext,req.body)}));
    router.post('/enrolments',async(req,res)=>res.json({status:'success',data:await service.enrol(req.schoolContext,req.body)}));
    router.post('/assignments',async(req,res)=>res.json({status:'success',data:await service.assign(req.schoolContext,req.body)}));
    if(yearOfferings){
        router.post('/year-offerings',async(req,res)=>{
            if(Object.keys(req.query).length)throw Object.assign(new Error('Invalid offering scope'),{statusCode:422});
            res.status(201).json({status:'success',data:await service.configureYear(req.schoolContext,req.body)});
        });
        router.get('/offerings/:id/years/:year/history',async(req,res)=>{
            if(Object.keys(req.query).length)throw Object.assign(new Error('Invalid offering scope'),{statusCode:422});
            res.json({status:'success',data:await service.offeringHistory(req.schoolContext,integer(req.params.id),integer(req.params.year))});
        });
    }
    router.get('/offerings/:id/roster',async(req,res)=>res.json({status:'success',data:await service.roster(req.schoolContext,integer(req.params.id),integer(req.query.yearId),req.query.term)}));
    router.get('/offerings/:id/enrolments',async(req,res)=>res.json({status:'success',data:await service.linkList(req.schoolContext,integer(req.params.id),integer(req.query.yearId))}));
    router.get('/offerings/:id/assignments',async(req,res)=>{
        if(typeof req.query.term!=='string') throw Object.assign(new Error('Invalid assignment term'),{statusCode:422});
        res.json({status:'success',data:await service.linkList(req.schoolContext,integer(req.params.id),integer(req.query.yearId),req.query.term)});
    });
    router.get('/my-timetable',async(req,res)=>{
        const { term,format }=req.query;
        if(Object.keys(req.query).some(key=>!['yearId','term','format'].includes(key)) ||
            (format!==undefined && !['csv','print'].includes(format)))
            throw Object.assign(new Error('Invalid timetable scope'),{statusCode:422});
        const yearId=integer(req.query.yearId);
        const data=await service.myTimetable(req.schoolContext,yearId,term);
        if(format==='csv'){
            const columns=['Academic year','Term','Day','Start','End','Class','Stream','Subject','Teacher','Room'];
            const rows=data.map(row=>[row.yearName,term,row.day,row.startTime,row.endTime,row.className,
                row.stream,row.subjectName,row.teacherName,row.room]);
            return res.attachment(`my-timetable-${yearId}-${term}.csv`).type('text/csv').send(academicCsv(columns,rows));
        }
        if(format==='print')return res.render('personal-timetable-print',{lessons:data,term});
        res.json({status:'success',data});
    });
    router.get('/my-enrolments',async(req,res)=>res.json({status:'success',data:await service.myEnrolments(req.schoolContext,integer(req.query.yearId))}));
    router.get('/my-assignments',async(req,res)=>res.json({status:'success',data:await service.myAssignments(req.schoolContext,integer(req.query.yearId),req.query.term)}));
    return router;
}
module.exports={createScopedAcademicLinksRouter};
