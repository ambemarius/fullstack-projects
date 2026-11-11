const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createDatabase,sql}=require('../../config/database');
const {loadTestEnvironment}=require('../../scripts/testEnvironment');
const {createIdentityService}=require('../../model/identity/identityService');
const {prepareAttendanceSample}=require('../../scripts/attendanceSample');
const {previewApp}=require('../../scripts/attendancePreview');
const {serve}=require('../helpers/http');

test('discipline register persists dated counts, audits corrections and rejects foreign, stale and unauthorized entries',async t=>{
    loadTestEnvironment();const db=createDatabase(),fixtures=[];t.after(()=>db.close());
    async function sample(){
        const account=await prepareAttendanceSample(db,'ATT_SAMPLE_'+crypto.randomBytes(6).toString('hex').toUpperCase());
        fixtures.push(account);return account;
    }
    try{
        const a=await sample(),b=await sample(),identity=createIdentityService(db);
        const base=await serve(t,previewApp(db,a)),origin='https://localhost:2029';
        const entry=await fetch(base+'/practice/sign-in',{method:'POST',headers:{Origin:origin}});
        assert.equal(entry.status,200);const cookie=entry.headers.get('set-cookie').split(';')[0];
        const {csrfToken}=await entry.json(),headers={Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':csrfToken};
        const get=(path,h=headers)=>fetch(base+'/api/attendance/registers'+path,{headers:h});
        const post=(input,h=headers)=>fetch(base+'/api/attendance/entries',{method:'POST',headers:h,body:JSON.stringify(input)});
        const registers=await (await get('')).json();
        assert.deepEqual(registers.map(r=>r.periods),[6,8]);
        const register=registers[1],rows=await (await get('/'+register.id)).json();
        assert.equal(rows.length,3);assert.ok(rows.every(p=>p.attended===null));
        const input={sessionId:register.id,studentId:rows[0].studentId,attended:7,version:0,reason:''};
        assert.equal((await post(input,{...headers,'X-CSRF-Token':''})).status,403);
        assert.equal((await post(input,{...headers,Origin:'https://wrong.invalid'})).status,403);
        assert.equal((await post({...input,attended:9})).status,422);
        const races=await Promise.all([post(input),post(input)]);
        assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);
        assert.deepEqual(await races.find(r=>r.status===200).json(),{version:1,attended:7,missed:1});
        assert.equal((await post({...input,attended:0,version:1})).status,422);
        const correction=await post({...input,attended:0,version:1,reason:'Corrected paper count'});
        assert.deepEqual(await correction.json(),{version:2,attended:0,missed:8});
        assert.equal((await (await get('/'+register.id)).json())[0].attended,0);
        assert.equal((await (await get('/'+registers[0].id)).json())[0].attended,null);
        const totals=(h=headers,extra='')=>fetch(base+'/api/attendance/totals?registerId='+register.id+'&from=2026-11-04&to=2026-11-05'+extra,{headers:h});
        let totalRows=await (await totals()).json();
        assert.equal(totalRows[0].scheduled,14);assert.equal(totalRows[0].attended,0);
        assert.equal(totalRows[0].missed,8);assert.equal(totalRows[0].unrecorded,6);
        assert.equal(totalRows[1].missed,0);assert.equal(totalRows[1].unrecorded,14);
        const correctionHistory=await (await get('/'+register.id+'/pupils/'+rows[0].studentId+'/history')).json();
        assert.deepEqual(correctionHistory.map(e=>[e.previousAttended,e.attended,e.reason]),[[null,7,null],[7,0,'Corrected paper count']]);
        await post({...input,sessionId:registers[0].id,attended:6});
        totalRows=await (await totals()).json();
        assert.deepEqual([totalRows[0].attended,totalRows[0].missed,totalRows[0].unrecorded],[6,8,0]);
        assert.equal((await totals(headers,'&schoolId=1')).status,422);
        assert.equal((await fetch(base+'/api/attendance/totals?registerId='+register.id+'&from=2026-02-30&to=2026-11-05',{headers})).status,422);
        const audit=await db.getPool().request().input('s',sql.Int,a.schoolId).query('SELECT attended,reason,editor_membership_id FROM dbo.attendance_revisions WHERE school_id=@s ORDER BY revision');
        assert.equal(audit.recordset.length,3);
        assert.ok(audit.recordset.every(row=>row.editor_membership_id===a.membershipId));
        assert.equal(audit.recordset.find(row=>row.reason==='Corrected paper count').attended,0);
        const other=await identity.createSession(b.accountId,b.membershipId),otherHeaders={...headers,Cookie:'__Host-lms_attendance_sample='+other.token,'X-CSRF-Token':other.csrfToken};
        assert.equal((await get('/'+register.id,otherHeaders)).status,404);
        assert.equal((await post(input,otherHeaders)).status,404);
        assert.equal((await totals(otherHeaders)).status,404);
        assert.equal((await get('/'+register.id+'/pupils/'+rows[0].studentId+'/history',otherHeaders)).status,404);
        await db.getPool().request().input('s',sql.Int,b.schoolId).query("UPDATE dbo.membership_roles SET role='teacher' WHERE school_id=@s");
        assert.equal((await get('',otherHeaders)).status,403);
        assert.equal((await totals(otherHeaders)).status,403);
        assert.equal((await get('',{Cookie:'__Host-lms_session='+other.token})).status,403);
    }finally{
        for(const f of fixtures)await db.getPool().request().input('s',sql.Int,f.schoolId).input('a',sql.Int,f.accountId).query(`
            SET XACT_ABORT ON; BEGIN TRANSACTION;
            DELETE dbo.attendance_revisions WHERE school_id=@s;DELETE dbo.attendance_roster WHERE school_id=@s;
            DELETE dbo.attendance_sessions WHERE school_id=@s;DELETE dbo.students WHERE school_id=@s;DELETE dbo.classes WHERE school_id=@s;
            DELETE dbo.academic_years WHERE school_id=@s;DELETE dbo.account_sessions WHERE account_id=@a;
            DELETE dbo.membership_roles WHERE school_id=@s;DELETE dbo.school_memberships WHERE school_id=@s;
            DELETE dbo.accounts WHERE id=@a;DELETE dbo.schools WHERE id=@s;COMMIT;`);
    }
});
