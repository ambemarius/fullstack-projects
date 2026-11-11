const { test }=require('node:test');
const assert=require('node:assert/strict');
const { canonicalKey,accountState,normalise }=require('../scripts/reconcileSchool');
const password='$2b$12$'+'a'.repeat(53);

test('legacy identity keys preserve role-table identity and never use email matching',()=>{
    assert.notEqual(canonicalKey('Admins',1),canonicalKey('teachers',1));
    assert.notEqual(canonicalKey('students',1),canonicalKey('teachers',1));
    assert.throws(()=>canonicalKey('accounts',1),/invalid legacy identity/);
    assert.throws(()=>canonicalKey('Admins',0),/invalid legacy identity/);
});
test('mapping policy preserves inactive status and refuses unknown roles and credentials',()=>{
    assert.deepEqual(accountState('teachers',{ password,role:'teacher',status:'suspended' }),{ role:'teacher',account:'disabled',membership:'revoked' });
    assert.equal(accountState('students',{ password,role:'student',isWithdrawn:true }).account,'disabled');
    assert.equal(accountState('Admins',{ password,role:'admin' }).account,'active');
    assert.equal(accountState('Admins',{ password,role:'Admin' }).account,'active');
    assert.throws(()=>accountState('Admins',{password,role:'teacher'}),/unexpected legacy role/);
    assert.throws(()=>accountState('teachers',{ password,role:'teacher',status:'unknown' }),/status needs review/);
    assert.throws(()=>accountState('teachers',{ password,role:'teacher',status:'active',isSuspended:true }),/status needs review/);
    assert.throws(()=>accountState('Admins',{ password,role:'platform_operator' }),/unexpected legacy role/);
    assert.throws(()=>accountState('students',{ password,role:'student',isWithdrawn:null }),/status needs review/);
    assert.throws(()=>accountState('Admins',{ password:'plaintext',role:'admin' }),/unsupported credential hash/);
});
test('reconciliation requires explicit bounded selectors and parent-first ordering',()=>{
    const scope={ schoolId:1,actorAccountId:2,attestationRef:'synthetic:fixture',records:[{ table:'students',id:3 },{ table:'Admins',id:1 }] };
    assert.equal(normalise(scope).records[0].table,'Admins');
    assert.throws(()=>normalise({ ...scope,records:[] }),/invalid explicit scope/);
    assert.throws(()=>normalise({ ...scope,records:[{ table:'students;DROP TABLE accounts',id:1 }] }),/invalid record selector/);
    assert.throws(()=>normalise({ ...scope,records:[scope.records[0],scope.records[0]] }),/duplicate record selector/);
    assert.throws(()=>normalise({ ...scope,attestationRef:'name and medical details' }),/invalid explicit scope/);
});
