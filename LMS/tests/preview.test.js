const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createPreviewApp}=require('../scripts/m1Preview');
const {serve}=require('./helpers/http');
test('M1 preview serves an isolated shell/catalog without legacy API exposure or credentials',async t=>{
    const samples={schools:[{id:1,code:'M1_DEMO_A',name:'Fictional school'}],accounts:[{schoolCode:'M1_DEMO_A',role:'admin',identifier:'example.invalid',loginKey:'private-key',password:'private-synthetic-password'}]};
    const app=createPreviewApp({connect(){throw new Error('Unexpected database access');}},samples,'https://localhost:2027');
    const base=await serve(t,app);
    const page=await fetch(base+'/');assert.equal(page.status,200);
    assert.match(await page.text(),/Fictional records only/);
    assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    const catalog=await(await fetch(base+'/preview/catalog')).text();
    assert.equal(catalog.includes('private-synthetic-password'),false);assert.equal(catalog.includes('private-key'),false);
    assert.equal((await fetch(base+'/api/v1/students')).status,404);
    const denied=await fetch(base+'/preview/sign-in',{method:'POST',headers:{Origin:'https://attacker.invalid','Content-Type':'application/json'},body:'{}'});
    assert.equal(denied.status,403);
    assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(require.resolve('../public/js/m1-preview.js'),'utf8')));
    assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(require.resolve('../public/js/m1-original-registration.js'),'utf8')));
    const original=await fetch(base+'/registration');assert.equal(original.status,200);const html=await original.text();
    assert.match(html,/reg-student-layout/);assert.match(html,/teacher-split-form/);assert.match(html,/sParentName/);assert.match(html,/tIdCard/);
    assert.equal(html.includes('src="/js/admin-layout.js'),false);
    assert.equal(html.includes('id="transferForm"'),false);
    assert.equal(html.includes('id="pupilStatusForm"'),false);
    assert.equal((await fetch(base+'/api/pupil-placements/1/transfers',{method:'POST'})).status,404);
    const source=fs.readFileSync(require.resolve('../views/admin-layout.ejs'),'utf8').replace(/\r\n/g,'\n');
    for(const kind of ['student','teacher'])assert.equal(source.includes(fs.readFileSync(require.resolve(`../views/partials/canonical-${kind}-registration.ejs`),'utf8').replace(/\r\n/g,'\n')),true);
});
test('pupil status preview renders its form and requires a session at both mutation routes',async t=>{
    const origin='https://localhost:2028',db={connect(){throw Error('Unexpected database access');}},samples={schools:[],accounts:[]};
    assert.throws(()=>createPreviewApp(db,samples,origin,{pupilLifecycle:true}),/placement workspace/);
    const base=await serve(t,createPreviewApp(db,samples,origin,{enrolmentLedger:true,currentTransfers:true,pupilLifecycle:true}));
    assert.match(await(await fetch(base+'/registration')).text(),/<form id="pupilStatusForm">/);
    for(const action of ['withdrawals','returns'])
        assert.equal((await fetch(base+'/api/pupil-placements/1/'+action,{method:'POST',headers:{Origin:origin}})).status,403);
});
test('synthetic transfer preview mounts only with the ledger and renders a separate transfer form',async t=>{
    const db={connect(){throw Error('Unexpected database access');}}, samples={accounts:[],schools:[]}, origin='https://localhost:2028';
    assert.throws(()=>createPreviewApp(db,samples,origin,{currentTransfers:true}),/require the enrolment ledger/);
    const base=await serve(t,createPreviewApp(db,samples,origin,{enrolmentLedger:true,currentTransfers:true}));
    const html=await(await fetch(base+'/registration')).text();
    assert.match(html,/<form id="transferForm">/);assert.match(html,/id="transferClass" required/);
    assert.ok(html.indexOf('<form id="transferForm">')>html.indexOf('</form>',html.indexOf('id="teacherForm"')));
    assert.equal((await fetch(base+'/api/pupil-placements/1/transfers',{method:'POST',headers:{Origin:origin}})).status,403);
});
