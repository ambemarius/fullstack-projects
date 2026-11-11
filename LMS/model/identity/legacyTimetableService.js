const crypto=require('node:crypto'),db=require('../../config/database');const {legacyAdminAuthoritySql}=require('./legacySchoolAccess');
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday'];const fail=(statusCode,message)=>Object.assign(new Error(message),{statusCode});
function positive(value){const id=typeof value==='string'&&/^[1-9]\d*$/.test(value)?Number(value):value;if(!Number.isSafeInteger(id)||id<1||id>2147483647)throw fail(422,'Invalid timetable reference');return id;}
function term(value){if(!['First','Second','Third'].includes(value))throw fail(422,'Invalid academic term');return value;}
const clockTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
function validPeriod(row) {
    return typeof row.start_time === 'string' && typeof row.end_time === 'string' &&
        clockTime.test(row.start_time) && clockTime.test(row.end_time) && row.start_time < row.end_time;
}
function clashes(slot, booked) {
    // Older entries may have a clock range without a slot reference.
    return slot.id === booked.time_slot_id || !validPeriod(booked) ||
        (slot.start_time < booked.end_time && booked.start_time < slot.end_time);
}
function plan(allocations, slots, teachers, busy) {
    const wanted = new Set(allocations.map(row => row.subject_id));
    const teacherOf = new Map();
    for (const row of teachers) {
        if (!wanted.has(row.subject_id)) continue;
        if (teacherOf.has(row.subject_id) && teacherOf.get(row.subject_id) !== row.teacher_id)
            throw fail(409, 'Confirm one teaching assignment per subject before generation');
        teacherOf.set(row.subject_id, row.teacher_id);
    }
    if (slots.some(slot => !validPeriod(slot))) throw fail(409, 'Review the configured teaching slot times before generation');
    const entries = [];
    const teacherBookings = new Map();
    for (const booking of busy) {
        const key = booking.teacher_id + '|' + booking.day_of_week.trim().toLowerCase();
        if (!teacherBookings.has(key)) teacherBookings.set(key, []);
        teacherBookings.get(key).push(booking);
    }
    // Once a period is filled, remove every overlapping slot for this class and day.
    const available = new Map(DAYS.map(day => [day, slots]));
    let overflow = 0;
    for (const allocation of allocations) {
        const teacherId = teacherOf.get(allocation.subject_id);
        if (!teacherId) throw fail(409, 'Confirm the teaching year and term for every allocated subject before generation');
        if (!Number.isSafeInteger(allocation.periods_week) || allocation.periods_week < 1)
            throw fail(409, 'Subject allocation requires review');
        let remaining = allocation.periods_week;
        for (const day of DAYS) {
            const bookings = teacherBookings.get(teacherId + '|' + day.toLowerCase()) || [];
            while (remaining) {
                const candidates = available.get(day);
                const slot = candidates.find(candidate => !bookings.some(b => clashes(candidate, b)));
                if (!slot) break;
                entries.push({day, slot, subjectId: allocation.subject_id, teacherId});
                const placed = {...slot, time_slot_id: slot.id};
                available.set(day, candidates.filter(candidate => !clashes(candidate, placed)));
                remaining--;
            }
            if (!remaining) break;
        }
        overflow += remaining;
    }
    return {entries, overflow};
}

function createLegacyTimetableService(access,database={connect:db.connect,getPool:()=>db.pool}){
 function bound(identity,request){return request.input('school',db.sql.Int,identity.schoolId).input('account',db.sql.Int,identity.accountId).input('membership',db.sql.Int,identity.membershipId).input('legacy_id',db.sql.Int,identity.legacyId).input('credential_version',db.sql.Int,identity.securityVersion).input('jwt_expires',db.sql.DateTime2,identity.expiresAt);}
 async function read(context){const identity=await access.authorize(context,['admin']);await database.connect();return()=>bound(identity,database.getPool().request());}
 async function parent(request,type,id){const tables={class:'classes',subject:'subjects',teacher:'teachers',slot:'time_slots',year:'academic_years'};const row=(await request().input('parent',db.sql.Int,positive(id)).query(`SELECT ${type==='slot'?'id,start_time,end_time,is_break':'id'} FROM dbo.${tables[type]} WHERE id=@parent AND school_id=@school AND ${legacyAdminAuthoritySql}`)).recordset[0];if(!row)throw fail(404,'Timetable resource not found');return row;}
 async function scope(context,yearId,academicTerm){term(academicTerm);const request=await read(context);if(yearId===undefined||yearId===null||yearId===''){const rows=(await request().query(`SELECT id FROM dbo.academic_years WHERE school_id=@school AND isCurrent=1 AND ${legacyAdminAuthoritySql}`)).recordset;if(rows.length!==1)throw fail(400,'Select an academic year for this school');yearId=rows[0].id;}await parent(request,'year',yearId);return{yearId:positive(yearId),term:academicTerm};}
 async function audit(request,action,id){await request().input('action',db.sql.VarChar(60),action).input('resource',db.sql.NVarChar(100),String(id)).input('request',db.sql.NVarChar(100),crypto.randomUUID()).query(`IF NOT ${legacyAdminAuthoritySql} THROW 50041,'Legacy authority changed',1; INSERT dbo.identity_audit_events(school_id,actor_account_id,actor_membership_id,action,resource_type,resource_id,request_id) VALUES(@school,@account,@membership,@action,'timetable',@resource,@request)`);}
 async function write(context,selected,work){const identity=await access.authorize(context,['admin']);await database.connect();const tx=new db.sql.Transaction(database.getPool());await tx.begin(db.sql.ISOLATION_LEVEL.SERIALIZABLE);const request=()=>bound(identity,new db.sql.Request(tx));try{const lock=(await request().input('lock',db.sql.NVarChar(255),`lms-timetable:${identity.schoolId}:${selected.yearId}:${selected.term.trim().toUpperCase()}`).query("DECLARE @r INT;EXEC @r=sys.sp_getapplock @Resource=@lock,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;SELECT @r result;")).recordset[0].result;if(lock<0)throw fail(409,'Timetable is busy; retry');await parent(request,'year',selected.yearId);const result=await work(request);await tx.commit();return result;}catch(error){await tx.rollback().catch(()=>{});if(error.statusCode)throw error;if([error,...(error.precedingErrors||[])].some(e=>e.number===50041))throw fail(401,'Authentication required');if([error,...(error.precedingErrors||[])].some(e=>[1205,2601,2627].includes(e.number)))throw fail(409,'Timetable changed; retry');throw fail(500,'Timetable operation failed');}}
 async function insert(request,body,selected){const row=(await request().input('class',db.sql.Int,body.class_id).input('subject',db.sql.Int,body.subject_id).input('teacher',db.sql.Int,body.teacher_id).input('slot',db.sql.Int,body.time_slot_id).input('day',db.sql.NVarChar(10),body.day_of_week).input('start',db.sql.NVarChar(5),body.start_time).input('end',db.sql.NVarChar(5),body.end_time).input('room',db.sql.NVarChar(50),body.room||null).input('term',db.sql.NVarChar(10),selected.term).input('year',db.sql.Int,selected.yearId).query(`INSERT dbo.timetables(class_id,subject_id,teacher_id,day_of_week,time_slot_id,start_time,end_time,room,academic_term,academic_year_id,created_by,school_id) OUTPUT INSERTED.* SELECT c.id,s.id,t.id,@day,slot.id,@start,@end,@room,@term,y.id,@legacy_id,@school FROM dbo.classes c JOIN dbo.subjects s ON s.id=@subject AND s.school_id=c.school_id JOIN dbo.teachers t ON t.id=@teacher AND t.school_id=c.school_id JOIN dbo.time_slots slot ON slot.id=@slot AND slot.school_id=c.school_id JOIN dbo.academic_years y ON y.id=@year AND y.school_id=c.school_id WHERE c.id=@class AND c.school_id=@school AND ${legacyAdminAuthoritySql}`)).recordset[0];if(!row)throw fail(404,'Timetable resource not found');return row;}
 async function create(context,input){const allowed=['class_id','subject_id','teacher_id','day_of_week','time_slot_id','start_time','end_time','room','academic_term','academic_year_id'];if(!input||Object.keys(input).some(k=>!allowed.includes(k)))throw fail(422,'Unsupported timetable fields');const body={...input};for(const key of ['class_id','subject_id','teacher_id','time_slot_id','academic_year_id'])body[key]=positive(body[key]);if(!DAYS.includes(body.day_of_week)||body.room!=null&&(typeof body.room!=='string'||body.room.length>50))throw fail(422,'Invalid timetable fields');const selected={yearId:body.academic_year_id,term:term(body.academic_term)};
  return write(context,selected,async request=>{await parent(request,'class',body.class_id);await parent(request,'subject',body.subject_id);await parent(request,'teacher',body.teacher_id);const slot=await parent(request,'slot',body.time_slot_id);if(slot.is_break)throw fail(422,'Select a teaching slot outside the break');
   body.start_time=body.start_time??slot.start_time;
   body.end_time=body.end_time??slot.end_time;
   if(!validPeriod(body))throw fail(422,'Enter a valid start time earlier than the end time');
   body.room=body.room?.trim()||null;
   const booked=(await request().input('year',db.sql.Int,selected.yearId).input('term',db.sql.NVarChar(10),selected.term)
    .input('day',db.sql.NVarChar(10),body.day_of_week).query(`SELECT class_id,teacher_id,room,time_slot_id,start_time,end_time
      FROM dbo.timetables WHERE school_id=@school AND academic_year_id=@year AND academic_term=@term
      AND LOWER(LTRIM(RTRIM(day_of_week)))=LOWER(@day) AND ${legacyAdminAuthoritySql}`)).recordset;
   const proposed={id:slot.id,start_time:body.start_time,end_time:body.end_time};
   for(const entry of booked){
    if(!clashes(proposed,entry))continue;
    if(entry.class_id===body.class_id)throw fail(409,'This class already has a lesson during that period');
    if(entry.teacher_id===body.teacher_id)throw fail(409,'This teacher already has a lesson during that period');
    if(body.room && entry.room?.trim().toUpperCase()===body.room.toUpperCase())
     throw fail(409,'This room is already booked during that period');
   }
   const row=await insert(request,body,selected);await audit(request,'legacy_timetable_entry_created',row.id);return row;});}
 async function remove(context,id){id=positive(id);const request=await read(context),rows=(await request().input('target',db.sql.Int,id).query(`SELECT academic_year_id,academic_term FROM dbo.timetables WHERE id=@target AND school_id=@school AND ${legacyAdminAuthoritySql}`)).recordset;if(rows.length!==1)throw fail(404,'Timetable entry not found');const selected={yearId:rows[0].academic_year_id,term:rows[0].academic_term};return write(context,selected,async req=>{const changed=(await req().input('target',db.sql.Int,id).input('year',db.sql.Int,selected.yearId).input('term',db.sql.NVarChar(10),selected.term).query(`DELETE FROM dbo.timetables WHERE id=@target AND school_id=@school AND academic_year_id=@year AND academic_term=@term AND ${legacyAdminAuthoritySql};SELECT @@ROWCOUNT changed;`)).recordset[0].changed;if(changed!==1)throw fail(404,'Timetable entry not found');await audit(req,'legacy_timetable_entry_deleted',id);return{deleted:true};});}
 async function allocations(request,classId,yearId){return(await request().input('class',db.sql.Int,classId).input('year',db.sql.Int,yearId).query(`SELECT a.*,s.name subject_name,s.code subject_code FROM dbo.subject_allocations a JOIN dbo.subjects s ON s.id=a.subject_id AND s.school_id=a.school_id WHERE a.class_id=@class AND a.academic_year_id=@year AND a.school_id=@school AND ${legacyAdminAuthoritySql} ORDER BY s.name`)).recordset;}
 async function generate(context,classId,yearId,academicTerm){classId=positive(classId);const selected=await scope(context,yearId,academicTerm);return write(context,selected,async request=>{await parent(request,'class',classId);const assigned=await allocations(request,classId,selected.yearId);if(!assigned.length)throw fail(400,'No subject allocations for this class/year');const slots=(await request().query(`SELECT * FROM dbo.time_slots WHERE school_id=@school AND is_break=0 AND ${legacyAdminAuthoritySql} ORDER BY sort_order,id`)).recordset;if(!slots.length)throw fail(400,'No teaching slots configured');
   const teachers=(await request().input('class',db.sql.Int,classId).input('year',db.sql.Int,selected.yearId).input('term',db.sql.NVarChar(10),selected.term).query(`SELECT cs.subject_id,a.teacher_id FROM dbo.class_subjects cs JOIN dbo.class_subject_teachers a ON a.class_subject_id=cs.id AND a.school_id=cs.school_id JOIN dbo.teachers t ON t.id=a.teacher_id AND t.school_id=a.school_id WHERE cs.class_id=@class AND cs.school_id=@school AND a.academic_year_id=@year AND a.term=@term AND a.assignment_status='active' AND t.status='active' AND ${legacyAdminAuthoritySql} ORDER BY a.id`)).recordset;
   const busy=(await request().input('class',db.sql.Int,classId).input('year',db.sql.Int,selected.yearId).input('term',db.sql.NVarChar(10),selected.term).query(`SELECT teacher_id,day_of_week,time_slot_id,start_time,end_time FROM dbo.timetables WHERE school_id=@school AND academic_year_id=@year AND academic_term=@term AND class_id<>@class AND ${legacyAdminAuthoritySql}`)).recordset;
   const result=plan(assigned,slots,teachers,busy);if(result.overflow)throw fail(409,`Could not place ${result.overflow} allocated period(s). The existing timetable was kept.`);await request().input('class',db.sql.Int,classId).input('year',db.sql.Int,selected.yearId).input('term',db.sql.NVarChar(10),selected.term).query(`DELETE FROM dbo.timetables WHERE class_id=@class AND academic_year_id=@year AND academic_term=@term AND school_id=@school AND ${legacyAdminAuthoritySql}`);
   for(const e of result.entries)await insert(request,{class_id:classId,subject_id:e.subjectId,teacher_id:e.teacherId,time_slot_id:e.slot.id,day_of_week:e.day,start_time:e.slot.start_time,end_time:e.slot.end_time,room:null},selected);await audit(request,'legacy_timetable_generated',classId);return{placed:result.entries.length,overflow:result.overflow,unassignedSubjects:[]};});}
 const joins=`FROM dbo.timetables t JOIN dbo.subjects s ON s.id=t.subject_id AND s.school_id=t.school_id JOIN dbo.teachers tc ON tc.id=t.teacher_id AND tc.school_id=t.school_id JOIN dbo.classes c ON c.id=t.class_id AND c.school_id=t.school_id LEFT JOIN dbo.time_slots ts ON ts.id=t.time_slot_id AND ts.school_id=t.school_id`;
 async function entries(context,{classId,yearId,academicTerm,section,mode='all'}){if(!['all','class','grid','periods'].includes(mode)||section!==undefined&&(typeof section!=='string'||section.length>20))throw fail(422,'Invalid timetable scope');const selected=await scope(context,yearId,academicTerm),request=await read(context);if(mode!=='all')await parent(request,'class',classId);const req=request().input('class',db.sql.Int,mode==='all'?null:positive(classId)).input('year',db.sql.Int,selected.yearId).input('term',db.sql.NVarChar(10),selected.term).input('section',db.sql.NVarChar(20),section??null);
  const where=`t.school_id=@school AND t.academic_year_id=@year AND t.academic_term=@term AND (@class IS NULL OR t.class_id=@class) AND (@section IS NULL OR c.section=@section) AND ${legacyAdminAuthoritySql}`;
  if(mode==='grid'){const slots=(await request().query(`SELECT * FROM dbo.time_slots WHERE school_id=@school AND ${legacyAdminAuthoritySql} ORDER BY sort_order`)).recordset;const rows=(await req.query(`SELECT ts.id slot_id,ts.slot_number,ts.start_time,ts.end_time,ts.is_break,ts.sort_order,t.id entry_id,t.subject_id,t.teacher_id,t.day_of_week,t.room,s.name subject_name,s.code subject_code,tc.name teacher_name ${joins} WHERE ${where} ORDER BY ts.sort_order`)).recordset;const data=[];for(const slot of slots){const found=rows.filter(r=>r.slot_id===slot.id);if(found.length)data.push(...found);else data.push({slot_id:slot.id,slot_number:slot.slot_number,start_time:slot.start_time,end_time:slot.end_time,is_break:slot.is_break,sort_order:slot.sort_order,entry_id:null,subject_id:null,teacher_id:null,day_of_week:null,room:null,subject_name:null,subject_code:null,teacher_name:null});}return{slots,entries:data,allocations:await allocations(request,positive(classId),selected.yearId)};}
  if(mode==='periods')return(await req.query(`SELECT t.subject_id,s.name subject_name,s.code subject_code,COUNT(*) periods_per_week ${joins} WHERE ${where} GROUP BY t.subject_id,s.name,s.code ORDER BY s.name`)).recordset;
  return(await req.query(`SELECT t.*,s.name subject_name,s.code subject_code,tc.name teacher_name,c.name class_name,c.stream,c.section${mode==='all'?',ts.slot_number,ts.is_break':''} ${mode==='all'?joins.replace('LEFT JOIN dbo.time_slots','JOIN dbo.time_slots'):joins} WHERE ${where} ORDER BY ${mode==='all'?'c.section,c.rank,t.day_of_week,ts.sort_order':'t.day_of_week,t.start_time'}`)).recordset;
 }
 async function form(context){const request=await read(context);const slots=(await request().query(`SELECT * FROM dbo.time_slots WHERE school_id=@school AND ${legacyAdminAuthoritySql} ORDER BY sort_order`)).recordset,classes=(await request().query(`SELECT c.*,t.name class_master_name,CASE WHEN c.rank<=5 THEN 'Secondary' ELSE 'Advanced' END schoolLevel FROM dbo.classes c LEFT JOIN dbo.teachers t ON t.id=c.class_master_id AND t.school_id=c.school_id WHERE c.school_id=@school AND ${legacyAdminAuthoritySql} ORDER BY c.section,c.rank,c.stream`)).recordset,subjects=(await request().query(`SELECT s.*,t.name subject_master_name,c.name class_name FROM dbo.subjects s LEFT JOIN dbo.teachers t ON t.id=s.subject_master AND t.school_id=s.school_id LEFT JOIN dbo.classes c ON c.id=s.class_id AND c.school_id=s.school_id WHERE s.school_id=@school AND ${legacyAdminAuthoritySql} ORDER BY s.name`)).recordset,teacherFields=require('../staff/teacher')._safeColumns.split(',').map(f=>'t.'+f.trim()).join(','),teachers=(await request().query(`SELECT ${teacherFields} FROM dbo.teachers t WHERE t.school_id=@school AND ${legacyAdminAuthoritySql} ORDER BY t.lastName,t.firstName`)).recordset,academicYears=(await request().query(`SELECT y.*,(SELECT COUNT(*) FROM dbo.academic_year_students a WHERE a.academic_year_id=y.id AND a.school_id=y.school_id) numberOfStudents,(SELECT COUNT(*) FROM dbo.academic_year_teachers a WHERE a.academic_year_id=y.id AND a.school_id=y.school_id) numberOfTeachers FROM dbo.academic_years y WHERE y.school_id=@school AND ${legacyAdminAuthoritySql} ORDER BY y.fromYear DESC`)).recordset;return{slots,classes,subjects,teachers,academicYears,days:DAYS};}
 return{create,remove,generate,entries,form};
}
module.exports={createLegacyTimetableService,planLegacyTimetable:plan};
