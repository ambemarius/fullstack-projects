const test=require('node:test');const assert=require('node:assert/strict');const {createAuxiliaryService,validateAuxiliary,auxiliaryVersion}=require('../model/identity/auxiliaryService');
test('auxiliary validation separates job labels from account authority and rejects hidden status/password/ownership changes',()=>{
 const valid={firstName:'Synthetic',lastName:'Staff',email:'staff@example.invalid',jobTitle:'Librarian',phone:null};assert.deepEqual(validateAuxiliary(valid,true),valid);
 for(const key of ['role','password','accountId','school_id','status','permission'])assert.throws(()=>validateAuxiliary({...valid,[key]:'admin'},true),error=>error.statusCode===422);
 assert.throws(()=>validateAuxiliary({...valid,email:'not-email'},true));assert.throws(()=>validateAuxiliary({},false));
 const row={id:1,school_id:1,firstName:'Synthetic',lastName:'Staff',role:'Librarian',status:'pending'};assert.equal(auxiliaryVersion(row),auxiliaryVersion({...row}));assert.notEqual(auxiliaryVersion(row),auxiliaryVersion({...row,status:'active'}));assert.notEqual(auxiliaryVersion(row),auxiliaryVersion({...row,phone:'123'}));
});
test('auxiliary writes reject absent authority before constructing any SQL transaction',async()=>{
 const service=createAuxiliaryService({authorize:async()=>{throw Object.assign(new Error('Access denied'),{statusCode:403});}},{connect(){throw new Error('Must not connect');}});
 await assert.rejects(service.create({}, {firstName:'Synthetic',lastName:'Staff',email:'staff@example.invalid',jobTitle:'Admin'}),error=>error.statusCode===403);
});
