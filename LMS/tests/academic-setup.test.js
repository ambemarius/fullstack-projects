const { test }=require('node:test');
const assert=require('node:assert/strict');
const { validateAcademicSetup:validate,createAcademicSetupService }=require('../model/identity/academicSetupService');

test('academic setup validates ranges and rejects caller ownership, actor, grade policy and current-year patches',()=>{
    assert.equal(validate('year',{ fromYear:2026,toYear:2027 },true).name,'2026/2027');
    assert.throws(()=>validate('year',{ fromYear:2027,toYear:2026 },true),/range/);
    assert.throws(()=>validate('year',{ fromYear:2026,toYear:2027,createdBy:99 },true),/fields/);
    assert.throws(()=>validate('year',{ isCurrent:true }),/fields/);
    assert.throws(()=>validate('class',{ name:'Test',rank:1,section:'Anglophone',school_id:2 },true),/fields/);
    assert.throws(()=>validate('subject',{ name:'Test',code:'T',passmark:25 },true),/fields/);
    assert.throws(()=>validate('subject',{ name:'Test',code:'T',coefficient:6 },true),/coefficient/);
    assert.throws(()=>validate('subject',{ name:'Test',code:'T',has_lab:'true' },true),/flag/);
    assert.throws(()=>validate('constructor',{},true),/fields/);
    assert.equal(validate('class',{ class_master_id:null }).class_master_id,null);
});
test('academic writes refuse missing authority before SQL construction',async()=>{
    const service=createAcademicSetupService({ async authorize(){ throw Object.assign(new Error('Access denied'),{ statusCode:403 }); } },{
        connect(){ throw new Error('Unexpected SQL access'); },
    });
    await assert.rejects(service.create({},'class',{ name:'Test',section:'Anglophone',rank:1 }),/Access denied/);
    await assert.rejects(service.setCurrent({},1,1),/Access denied/);
    await assert.rejects(service.update({},'subject',1,1,{ name:'Test' }),/Access denied/);
});
