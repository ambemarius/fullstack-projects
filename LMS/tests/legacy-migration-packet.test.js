const test=require('node:test');const assert=require('node:assert/strict');
const {packet}=require('../scripts/prepareLegacyMigration');
const input={suffix:'0123456789abcdef',backupPath:'D:\\Dev\\fresh.bak',dataPath:'D:\\Dev\\',logPath:'L:\\Dev\\',files:[{name:"school'data",type:0},{name:'log',type:1},{name:'secondary',type:0}]};
test('original restore packet uses a unique separate target and checks instance, backup and integrity',()=>{
 const sql=packet(input);assert.match(sql,/MARIUS\\DEV/);assert.match(sql,/IF DB_ID/);assert.match(sql,/VERIFYONLY/);assert.match(sql,/DBCC CHECKDB/);assert.match(sql,/school''data/);assert.match(sql,/_2\.ndf/);assert.doesNotMatch(sql,/WITH REPLACE|RESTORE DATABASE \[schooldb\]|ALTER DATABASE \[schooldb\]/i);
});
test('original restore packet rejects injected identifiers and unsupported file layouts',()=>{
 for(const override of [{suffix:'x];DROP'},{backupPath:'relative.bak'},{files:[{name:'stream',type:2}]}])assert.throws(()=>packet({...input,...override}));
});
