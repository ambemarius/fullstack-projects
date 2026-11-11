const test=require('node:test'),assert=require('node:assert/strict');const {createLegacyPersonnelReads}=require('../model/identity/legacyPersonnelReads');
test('legacy personnel reads reject unknown projections, invalid targets and missing authority before SQL',async()=>{
 const service=createLegacyPersonnelReads({authorize:async()=>{throw Object.assign(Error('Denied'),{statusCode:401});}},{connect(){throw Error('Unexpected SQL');}});
 await assert.rejects(service.list({},'accounts'),e=>e.statusCode===422);await assert.rejects(service.find({},'students',-1),e=>e.statusCode===422);await assert.rejects(service.byClass({},0),e=>e.statusCode===422);
 await assert.rejects(service.list({},'admins'),e=>e.statusCode===401);await assert.rejects(service.stats({}),e=>e.statusCode===401);
});
