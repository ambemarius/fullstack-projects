const test=require('node:test'),assert=require('node:assert/strict');const {planLegacyTimetable:plan,createLegacyTimetableService}=require('../model/identity/legacyTimetableService');
const early={id:1,start_time:'07:30',end_time:'08:30'},late={id:2,start_time:'08:30',end_time:'09:30'};
test('timetable planning retains first-fit weekday/slot order and respects already-busy teachers',()=>{const slots=[early,late],result=plan([{subject_id:4,periods_week:3}],slots,[{subject_id:4,teacher_id:8}],[{teacher_id:8,day_of_week:'Monday',time_slot_id:1,start_time:'07:30',end_time:'08:30'}]);assert.deepEqual(result.entries.map(e=>[e.day,e.slot.id]),[['Monday',2],['Tuesday',1],['Tuesday',2]]);assert.equal(result.overflow,0);});
test('generation refuses missing/ambiguous authority and counts large overflow without allocating a lesson per period',()=>{
 assert.throws(()=>plan([{subject_id:4,periods_week:2}],[early],[],[]),e=>e.statusCode===409);assert.throws(()=>plan([{subject_id:4,periods_week:2}],[early],[{subject_id:4,teacher_id:8},{subject_id:4,teacher_id:9}],[]),e=>e.statusCode===409);
 const result=plan([{subject_id:4,periods_week:1000000}],[early],[{subject_id:4,teacher_id:8}],[]);assert.equal(result.entries.length,5);assert.equal(result.overflow,999995);
});
test('scoped timetable rejects actor/school injection, invalid targets and absent authority before SQL',async()=>{const service=createLegacyTimetableService({authorize:async()=>{throw Object.assign(Error('Denied'),{statusCode:401});}},{connect(){throw Error('Unexpected SQL');}});await assert.rejects(service.create({},{school_id:2}),e=>e.statusCode===422);await assert.rejects(service.remove({},0),e=>e.statusCode===422);await assert.rejects(service.form({}),e=>e.statusCode===401);await assert.rejects(service.generate({},1,2,'First'),e=>e.statusCode===401);});

test('generator checks actual lesson times for the class and teacher across slot IDs',()=>{
 const overlap={id:3,start_time:'08:15',end_time:'09:00'};
 const external={teacher_id:8,day_of_week:'monday ',time_slot_id:null,start_time:'07:00',end_time:'07:45'};
 const result=plan([{subject_id:4,periods_week:3}],[early,overlap,late],[{subject_id:4,teacher_id:8}],[external]);
 assert.deepEqual(result.entries.map(row=>[row.day,row.slot.id]),[['Monday',3],['Tuesday',1],['Tuesday',2]]);
 assert.equal(result.overflow,0);
});
