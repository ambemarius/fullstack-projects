const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createLegacyAdminRecovery,validateRecoveryInput,safeRecoveryError}=require('../scripts/recoverLegacyAdmin');
const {spawnSync}=require('node:child_process');
function fixture({server='MARIUS\\DEV',database='schooldb',id=1,affected=1,canonical=false}={}) {
    const calls=[];
    const db={async connect(){},pool:{request(){const parameters={};return{input(key,_type,value){parameters[key]=value;return this;},async query(text){calls.push({text,parameters});
        if(text.includes('SERVERPROPERTY'))return{recordset:[{server_name:server,database_name:database}]};
        if(text.includes('canonical_identity_present'))return{recordset:[{canonical_identity_present:canonical?1:0}]};
        if(text.includes('UPDATE dbo.Admins'))return{recordset:[{affected}]};
        return{recordset:[{id,email:'synthetic@example.invalid',role:'admin',password:'synthetic-existing-hash'}]};
    }}}}};return{service:createLegacyAdminRecovery(db),calls};
}
test('legacy recovery review is nonwriting and refuses every other database',async()=>{
    const f=fixture();assert.equal((await f.service.review('synthetic@example.invalid')).changes,0);
    assert.equal(f.calls.some(call=>call.text.includes('UPDATE')),false);
    await assert.rejects(fixture({database:'lms_test_codex'}).service.review('synthetic@example.invalid'),/unexpected database/);
    await assert.rejects(fixture({server:'OTHER'}).service.review('synthetic@example.invalid'),/unexpected database/);
});
test('legacy-only admin recovery refuses canonical databases before updating a credential',async()=>{
    const f=fixture({canonical:true});await assert.rejects(f.service.apply('synthetic@example.invalid','Synthetic-only-password',1),/synchronized recovery/);
    assert.equal(f.calls.some(call=>call.text.includes('UPDATE dbo.Admins')),false);
    assert.equal(safeRecoveryError(new Error('Recovery refused: canonical identity requires synchronized recovery')).code,'CANONICAL_RECOVERY_REQUIRED');
});
test('explicit recovery is bounded by reviewed ID and old credential; output excludes passwords',async()=>{
    const f=fixture();
    await assert.rejects(f.service.apply('synthetic@example.invalid','synthetic-long-password',2),/changed since review/);
    assert.equal(f.calls.some(call=>call.text.includes('UPDATE')),false);
    const result=await f.service.apply('synthetic@example.invalid','synthetic-long-password',1);
    assert.equal(result.changes,1);assert.equal(JSON.stringify(result).includes('synthetic-long-password'),false);
    const update=f.calls.find(call=>call.text.includes('UPDATE'));assert.match(update.text,/password=@previous/);assert.equal(update.parameters.id,1);
    await assert.rejects(fixture({affected:0}).service.apply('synthetic@example.invalid','synthetic-long-password',1),/concurrent/);
});
test('recovery reports precise safe validation errors and never echoes unexpected error data',()=>{
    assert.throws(()=>validateRecoveryInput('short',1),/at least 12/);
    assert.throws(()=>validateRecoveryInput('é'.repeat(37),1),/72 UTF-8/);
    assert.equal(safeRecoveryError(new Error('New password must contain at least 12 characters')).code,'PASSWORD_TOO_SHORT');
    assert.equal(JSON.stringify(safeRecoveryError(new Error('submitted-secret-material'))).includes('submitted-secret-material'),false);
    const sqlError=Object.assign(new Error('private driver material'),{code:'EREQUEST',number:229});
    assert.equal(safeRecoveryError(sqlError).code,'DATABASE_ERROR');
    assert.match(safeRecoveryError(sqlError).message,/229/);
    assert.equal(safeRecoveryError(sqlError).message.includes('private driver material'),false);
});
test('private child-process input supports BOM/UTF-8 and validates without any database access',()=>{
    const script=require.resolve('../scripts/recoverLegacyAdmin');
    const args=[script,'--check-input','--email','synthetic@example.invalid','--expected-id','1'];
    const accepted=spawnSync(process.execPath,args,{input:'\uFEFF'+JSON.stringify({password:'Synthetic-é-private-input'}),encoding:'utf8'});
    assert.equal(accepted.status,0);assert.equal(JSON.parse(accepted.stdout).changes,0);
    const denied=spawnSync(process.execPath,args,{input:JSON.stringify({password:'short'}),encoding:'utf8'});
    assert.equal(denied.status,1);assert.equal(JSON.parse(denied.stderr).code,'PASSWORD_TOO_SHORT');
    assert.equal(denied.stderr.includes('"short"'),false);
});
