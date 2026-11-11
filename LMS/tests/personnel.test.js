const { test }=require('node:test');
const assert=require('node:assert/strict');
const { validatePersonnel,createPersonnelService }=require('../model/identity/personnelService');

test('personnel validation rejects privilege/ownership/placement/password injection and bcrypt truncation',()=>{
    const student={ firstName:'Synthetic',lastName:'Student',matricule:'S1',section:'Anglophone',sex:'Male',password:'synthetic-password-only' };
    assert.equal(validatePersonnel('student',student,{ registration:true }).matricule,'S1');
    for(const key of ['school_id','schoolId','role','accountId','academicYearId','currentClassLevel','isWithdrawn','status'])
        assert.throws(()=>validatePersonnel('student',{ ...student,[key]:'forged' },{ registration:true }),/Unsupported/);
    assert.throws(()=>validatePersonnel('student',{ ...student,password:'é'.repeat(37) },{ registration:true }),/password length/);
    assert.throws(()=>validatePersonnel('student',{ password:'replacement-password' }),/Unsupported/);
    assert.throws(()=>validatePersonnel('student',{medicalStatus:'private medical content'}),/Unsupported/);
    assert.throws(()=>validatePersonnel('student',{dateOfBirth:'2026-02-30'}),/calendar date/);
    assert.throws(()=>validatePersonnel('teacher',{noOfChildren:-1}),/number of children/);
    assert.equal(validatePersonnel('teacher',{noOfChildren:0}).noOfChildren,0);
    assert.throws(()=>validatePersonnel('student',{...student,placement:{classId:1,yearId:2,schoolId:99}},{registration:true}),/placement/);
    assert.throws(()=>validatePersonnel('constructor',{}),/Invalid/);
    assert.throws(()=>validatePersonnel('teacher',{ firstName:'Synthetic',lastName:'Teacher',email:'x@example.invalid',section:'Anglophone',employmentType:'Government',password:'synthetic-password-only' },{ registration:true }),/Matricule file/);
});
test('personnel writes refuse absent authority before constructing a SQL transaction',async()=>{
    const service=createPersonnelService({ async authorize(){ throw Object.assign(new Error('Access denied'),{ statusCode:403 }); } },{
        connect(){ throw new Error('Unexpected SQL access'); },
    });
    await assert.rejects(service.update({},'student',1,1,{ firstName:'Synthetic' }),/Access denied/);
    await assert.rejects(service.setStatus({},'student',1,1,'withdrawn','withdrawal'),/Access denied/);
});
