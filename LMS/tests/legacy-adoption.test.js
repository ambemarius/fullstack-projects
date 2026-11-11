const test=require('node:test');const assert=require('node:assert/strict');
const {targetName,rowDigest,adopt}=require('../scripts/legacyAdoption');
test('adoption refuses every unapproved database name and unreviewed original execution',async()=>{
 for(const target of ['master','lms_test_codex','schooldb];DROP DATABASE x','other'])assert.throws(()=>targetName(target));
 await assert.rejects(adopt({target:'schooldb',commit:true}),/reviewed rehearsal/);
 await assert.rejects(adopt({target:'schooldb',commit:false,expectedFingerprint:'anything'}),/reviewed rehearsal/);
});
test('field preservation digest ignores row order but detects edits, missing and duplicate rows',()=>{
 const rows=[{id:1,name:'a',active:false},{id:2,name:'b',active:true}];
 assert.equal(rowDigest(rows),rowDigest([...rows].reverse()));
 for(const changed of [[rows[0]],[...rows,rows[0]],[{...rows[0],active:true},rows[1]]])assert.notEqual(rowDigest(rows),rowDigest(changed));
});
