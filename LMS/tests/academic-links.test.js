const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateEnrolmentBatch,createAcademicLinksService}=require('../model/identity/academicLinksService');
test('enrolment batches require explicit unique pupils, bounded versions and an exact allowlist',()=>{
    const input={offeringId:1,yearId:2,changes:[{studentId:3,action:'enrol',version:0}]};
    assert.equal(validateEnrolmentBatch(input),input);
    assert.throws(()=>validateEnrolmentBatch({...input,schoolId:4}),/fields/);
    assert.throws(()=>validateEnrolmentBatch({...input,changes:[...input.changes,...input.changes]}),/change/);
    assert.throws(()=>validateEnrolmentBatch({...input,changes:[{studentId:3,action:'delete',version:1}]}),/change/);
    assert.throws(()=>validateEnrolmentBatch({...input,changes:[{studentId:3,action:'enrol',version:'0'}]}),/change/);
    assert.throws(()=>validateEnrolmentBatch({...input,changes:[]}),/batch/);
    assert.throws(()=>validateEnrolmentBatch({...input,changes:Array.from({length:101},(_,index)=>({studentId:index+1,action:'enrol',version:0}))}),/batch/);
});
test('academic link mutations reject missing authority without opening a transaction',async()=>{
    const service=createAcademicLinksService({async authorize(){throw Object.assign(new Error('Access denied'),{statusCode:403});}},{connect(){throw new Error('Unexpected SQL access');}});
    await assert.rejects(service.createOffering({},{classId:1,subjectId:2}),/Access denied/);
    await assert.rejects(service.createOffering({},{classId:1,subjectId:2,coefficient:0.00000000001}),/Invalid offering/);
    await assert.rejects(service.createOffering({},{classId:1,subjectId:2,coefficient:null}),/Invalid offering/);
    await assert.rejects(service.enrol({},{offeringId:1,yearId:2,changes:[{studentId:3,action:'enrol',version:0}]}),/Access denied/);
    await assert.rejects(service.assign({},{offeringId:1,yearId:2,teacherId:3,term:'First',action:'assign',version:0}),/Access denied/);
});
