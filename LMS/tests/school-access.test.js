const { test }=require('node:test');
const assert=require('node:assert/strict');
const { createSchoolAccess }=require('../model/identity/schoolAccess');
const { createPersonnelRepository }=require('../model/identity/personnelRepository');

test('school access cannot be forged or widened by platform permissions and revalidates revocation',async()=>{
    let identity={ accountId:1,schoolId:2,membershipId:3,roles:['admin'],platformPermissions:[] };
    const access=createSchoolAccess({ async resolveSession(){ return identity; } });
    const context=await access.resolve('a'.repeat(43));
    assert.equal(Object.isFrozen(context),true);
    await assert.rejects(access.authorize({ ...context },['admin']),/Access denied/);
    assert.equal((await access.authorize(context,['admin'])).schoolId,2);
    identity={ ...identity,roles:['teacher'],platformPermissions:['platform_operator'] };
    await assert.rejects(access.authorize(context,['admin']),/Access denied/);
    identity=null;
    await assert.rejects(access.authorize(context,['teacher']),/Access denied/);
    identity={ accountId:1,schoolId:null,membershipId:null,roles:[],platformPermissions:['platform_operator'] };
    await assert.rejects(access.resolve('a'.repeat(43)),/Access denied/);
});

test('personnel reads refuse forged context and invalid pagination before SQL construction',async()=>{
    const access=createSchoolAccess({ async resolveSession(){ return null; } });
    const repository=createPersonnelRepository(access,{ connect(){ throw new Error('Unexpected SQL access'); } });
    await assert.rejects(repository.listStudents({ schoolId:1 }),/Access denied/);
    await assert.rejects(repository.listStudents({}, { limit:1001 }),/Access denied/);
    await assert.rejects(repository.getStudent({},'1 OR 1=1'),/Access denied/);
});
