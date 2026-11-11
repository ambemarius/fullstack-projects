const test=require('node:test'),assert=require('node:assert/strict');const generateToken=require('../utils/generateToken');
const {createLegacySchoolAccess}=require('../model/identity/legacySchoolAccess');const {createLegacyExamResultsService}=require('../model/identity/legacyExamResultsService');
test('legacy scoped context rejects forged objects, missing tokens and wrong roles before SQL',async()=>{
 const database={connect(){throw Error('Unexpected SQL');}},access=createLegacySchoolAccess(database);
 await assert.rejects(access.resolve(''),e=>e.statusCode===401);await assert.rejects(access.resolve('Bearer '+generateToken(1,'teacher')),e=>e.statusCode===401);await assert.rejects(access.authorize({accountId:1,schoolId:1,membershipId:1}),e=>e.statusCode===401);
 const service=createLegacyExamResultsService({authorize:async()=>{throw Object.assign(Error('Denied'),{statusCode:403});}},database);
 await assert.rejects(service.publish({},1,true),e=>e.statusCode===403);await assert.rejects(service.publish({},1,'true'),e=>e.statusCode===422);await assert.rejects(service.list({},-1),e=>e.statusCode===422);
});
