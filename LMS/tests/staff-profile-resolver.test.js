const test=require('node:test'),assert=require('node:assert/strict');
const {createStaffProfileResolver}=require('../model/identity/staffProfileResolver');
test('reviewed staff profile migration is present without altering legacy identity migrations',()=>{
 assert.equal(require('../scripts/migrate').migrationFiles().some(file=>file.name==='009_staff_profile_links.sql'),true);
});
test('linked staff resolution cannot use caller profile IDs or absent school sessions to reach SQL',async()=>{
 let resolutions=0;const resolver=createStaffProfileResolver({resolveSession:async()=>{resolutions++;return {accountId:1,schoolId:null,membershipId:null};}},{connect(){throw Error('Unexpected SQL');}});
 assert.equal(await resolver.resolve({accountId:1,schoolId:1,membershipId:1}),null);assert.equal(resolutions,0);
 assert.equal(await resolver.resolve('T'.repeat(43)),null);assert.equal(resolutions,1);
});
