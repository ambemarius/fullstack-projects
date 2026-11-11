const test=require('node:test');const assert=require('node:assert/strict');const {spawnSync}=require('node:child_process');const generateToken=require('../utils/generateToken');const verifyToken=require('../utils/verifyToken');const {createTeacherRecovery}=require('../scripts/recoverTeacherPassword');
test('credential version claims remain typed and old token format is distinguishable after reset',()=>{
 const old=verifyToken(generateToken(1,'teacher'),'teacher');assert.equal(old.credentialVersion,undefined);
 assert.equal(verifyToken(generateToken(1,'teacher',2),'teacher').credentialVersion,2);
 for(const value of [0,-1,'2',NaN])assert.throws(()=>generateToken(1,'teacher',value));
});
test('teacher recovery rejects invalid private inputs before touching a database',async()=>{
 const recovery=createTeacherRecovery({connect(){throw Error('Must not connect');}});
 await assert.rejects(recovery.apply('synthetic@example.invalid','short',1,1),/12 characters/);
 await assert.rejects(recovery.apply('synthetic@example.invalid','Synthetic-password-long',1,0),e=>e.recoveryCode==='INVALID_REVIEW');
 const check=spawnSync(process.execPath,[require.resolve('../scripts/recoverTeacherPassword'),'--check-input','--email','synthetic@example.invalid','--expected-id','1','--expected-version','1'],{input:'\uFEFF'+JSON.stringify({password:'Synthetic-only-private-input'}),encoding:'utf8'});
 assert.equal(check.status,0);assert.equal(JSON.parse(check.stdout).changes,0);assert.equal(check.stdout.includes('Synthetic-only-private-input'),false);
});
