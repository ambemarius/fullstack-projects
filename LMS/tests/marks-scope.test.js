const{test}=require('node:test');const assert=require('node:assert/strict');
const{validateMarkBatch,createMarksService}=require('../model/identity/marksService');
test('scoped mark batches reject clamping, implicit maxima, duplicate sequences and actor injection',()=>{
    const input={offeringId:1,yearId:2,term:'First',scores:[{studentId:3,sequence:1,score:0,maxScore:50,version:0}]};
    assert.equal(validateMarkBatch(input),input);
    for(const score of [-1,51,NaN,Infinity,'20',0.001])assert.throws(()=>validateMarkBatch({...input,scores:[{...input.scores[0],score}]}),/Invalid score/);
    assert.throws(()=>validateMarkBatch({...input,schoolId:99}),/batch/);
    assert.throws(()=>validateMarkBatch({...input,scores:[{...input.scores[0],maxScore:undefined}]}),/Invalid score/);
    assert.throws(()=>validateMarkBatch({...input,scores:[...input.scores,...input.scores]}),/Duplicate/);
    assert.throws(()=>validateMarkBatch({...input,scores:[{...input.scores[0],createdBy:99}]}),/Invalid score/);
});
test('mark mutations refuse missing authority before opening SQL',async()=>{
    const service=createMarksService({async authorize(){throw new Error('Access denied');}},{connect(){throw new Error('Unexpected SQL access');}});
    await assert.rejects(service.save({},{offeringId:1,yearId:2,term:'First',scores:[{studentId:3,sequence:1,score:20,maxScore:50,version:0}]}),/Access denied/);
});
