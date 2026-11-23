const test=require('node:test'),assert=require('node:assert/strict');
const {ownedAccounts}=require('../scripts/resumeEnrolmentPreview');
const owned={format:'m2-registration-preview-v4',schoolCodes:['LEDGER_0123456789ABA','LEDGER_0123456789ABB'],ids:{a:1,b:2,aa:3,ab:4,ma:5,mb:6}};
test('retained preview accepts only exact paired synthetic school identities',()=>{
 assert.equal(ownedAccounts(owned).length,2);
 for(const patch of [{schoolCodes:['LYCEE_BATOURI','OTHER']},{format:'m2-registration-preview-v1'},{ids:{...owned.ids,ma:0}},{ids:{...owned.ids,ab:3}},{schoolCodes:['LEDGER_0123456789ABA','LEDGER_1123456789ABB']}])assert.throws(()=>ownedAccounts({...owned,...patch}));
});
