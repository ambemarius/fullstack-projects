// Temporary synthetic-only visual acceptance. Never uses real-school configuration.
const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),crypto=require('node:crypto'),readline=require('node:readline');
const bcrypt=require('bcrypt');
const {createDatabase,sql}=require('../config/database');
const {loadTestEnvironment,assertSyntheticDatabase}=require('./testEnvironment');
const {createPreviewApp}=require('./m1Preview');
const {isolatePreviewCookies}=require('./m1AcceptancePreview');
const {seedEnrolmentFixture,removeEnrolmentFixture}=require('../tests/helpers/enrolmentFixture');
const manifestPath=path.join(__dirname,'../backups/runtime/m2-registration-preview-owned.json');
async function cleanup(db,owned){
    await assertSyntheticDatabase(db);
    const ids=owned.ids;
    if(!ids||![ids.a,ids.b,ids.aa,ids.ab,ids.at].every(n=>Number.isSafeInteger(n)&&n>0))throw Error('Invalid cleanup evidence');
    const roots=(await db.getPool().request().input('a',sql.Int,ids.a).input('b',sql.Int,ids.b).query(`
        SELECT code FROM dbo.schools WHERE id IN(@a,@b) ORDER BY id;
        SELECT COUNT(*) n FROM dbo.student_enrolments WHERE school_id NOT IN(@a,@b);`)).recordsets;
    if(JSON.stringify(roots[0].map(r=>r.code))!==JSON.stringify(owned.schoolCodes)||roots[1][0].n!==0)throw Error('Preview ownership changed; cleanup refused');
    if(owned.format!=='m2-registration-preview-v1')await require('./stagedPupilSchema').remove(db,ids,{
        yearOfferings:['m2-registration-preview-v3','m2-registration-preview-v4'].includes(owned.format),yearArchive:owned.format==='m2-registration-preview-v4'});
    else await db.getPool().request().query('DROP TABLE dbo.student_enrolment_revisions;DROP TABLE dbo.student_enrolments;');
    await removeEnrolmentFixture(db,ids);
    fs.unlinkSync(manifestPath);
}
async function main(){
    loadTestEnvironment();const db=createDatabase();let owned,created=false,server;
    try{
        await assertSyntheticDatabase(db);
        if(process.argv.includes('--cleanup')){
            const saved=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
            if(!['m2-registration-preview-v1','m2-registration-preview-v2','m2-registration-preview-v3','m2-registration-preview-v4'].includes(saved.format))throw Error('Unknown preview evidence');
            let running=true;try{process.kill(saved.pid,0);}catch(e){if(e.code==='ESRCH')running=false;else throw e;}
            if(running)throw Error('Preview process still exists; use its finish command');
            await cleanup(db,saved);console.log('Owned synthetic preview cleaned up');return;
        }
        if(fs.existsSync(manifestPath))throw Error('Earlier preview requires reviewed cleanup');
        const state=(await db.getPool().request().query("SELECT OBJECT_ID('dbo.student_enrolments') root,OBJECT_ID('dbo.student_enrolment_revisions') revisions")).recordset[0];
        if(state.root||state.revisions)throw Error('Ledger schema already exists; preview refused');
        const expected=require('./migrate').migrationFiles(),installed=(await db.getPool().request().query('SELECT version,checksum FROM dbo.schema_migrations ORDER BY version')).recordset;
        if(JSON.stringify(expected.map(r=>[r.name,r.checksum]))!==JSON.stringify(installed.map(r=>[r.version,r.checksum])))throw Error('Schema history mismatch');
        await require('./stagedPupilSchema').install(db,false,{yearOfferings:true,yearArchive:true});created=true;
        const ids=await seedEnrolmentFixture(db);
        const schools=(await db.getPool().request().input('a',sql.Int,ids.a).input('b',sql.Int,ids.b).query('SELECT id,code,name FROM dbo.schools WHERE id IN(@a,@b) ORDER BY id')).recordset;
        owned={format:'m2-registration-preview-v4',pid:process.pid,ids,schoolCodes:schools.map(r=>r.code)};
        fs.writeFileSync(manifestPath,JSON.stringify(owned),{flag:'wx'});
        const password=crypto.randomBytes(24).toString('base64url'),hash=await bcrypt.hash(password,12);
        await db.getPool().request().input('hash',sql.NVarChar(255),hash).input('aa',sql.Int,ids.aa).input('ab',sql.Int,ids.ab)
            .input('a',sql.Int,ids.a).input('pa',sql.Int,ids.pa).input('b',sql.Int,ids.b).input('ya',sql.Int,ids.ya).input('yb',sql.Int,ids.yb).query(`
            UPDATE dbo.accounts SET password_hash=@hash WHERE id IN(@aa,@ab);
            UPDATE dbo.academic_years SET isCurrent=1 WHERE id IN(@ya,@yb);
            INSERT dbo.academic_year_students(school_id,student_id,academic_year_id) VALUES(@a,@pa,@ya);
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@b,@aa,'active');DECLARE @m INT=SCOPE_IDENTITY();
            INSERT dbo.membership_roles(school_id,membership_id,role) VALUES(@b,@m,'admin');`);
        const accounts=(await db.getPool().request().input('aa',sql.Int,ids.aa).input('ab',sql.Int,ids.ab).query('SELECT id,login_key FROM dbo.accounts WHERE id IN(@aa,@ab) ORDER BY id')).recordset;
        const samples={schools,accounts:accounts.map((a,index)=>({schoolCode:schools[index].code,role:'admin',identifier:'Synthetic administrator',loginKey:a.login_key,password}))};
        // Pre-existing synthetic pupil history for read-only visual verification; no pupil credential is created or changed.
        const identity=require('../model/identity/identityService').createIdentityService(db);
        for(const account of samples.accounts){const probe=await identity.login(account.loginKey,account.password,account.schoolCode);await identity.revokeSession(probe.token);}
        const access=require('../model/identity/schoolAccess').createSchoolAccess(identity),session=await identity.createSession(ids.aa,ids.ma);
        try{
            const context=await access.resolve(session.token),ledger=require('../model/identity/enrolmentLedgerService').createEnrolmentLedgerService(access,db);
            const placement={studentId:ids.pa,classId:ids.ca,yearId:ids.ya,fromDate:'2024-09-01',toDate:null,status:'enrolled',sourceReference:'Synthetic admission register, page 3',reason:'Verified sample placement'};
            const entry=await ledger.record(context,placement),{studentId,...fields}=placement;
            await ledger.revise(context,entry.id,{...fields,version:1,sourceReference:'Synthetic admission register, page 4',reason:'Reviewed reference correction'});
            await require('../model/identity/personnelService').createPersonnelService(access,db,{enrolmentLedger:true}).register(context,'student',{
                firstName:'Sample',lastName:'Lifecycle',matricule:'LIFECYCLE',password:crypto.randomBytes(24).toString('base64url'),
                section:'Anglophone',sex:'Male',placement:{classId:ids.ca,yearId:ids.ya,fromDate:'2024-09-01',sourceReference:'Sample register 5',reason:'Sample admission'}});
            const subject=await require('../model/identity/academicSetupService').createAcademicSetupService(access,db).create(context,'subject',{name:'Geometry',code:'GEOM'});
            await require('../model/identity/academicLinksService').createAcademicLinksService(access,db).createOffering(context,{classId:ids.ca,subjectId:subject.id,coefficient:1});
            await require('../model/identity/personnelService').createPersonnelService(access,db).register(context,'teacher',{
                firstName:'Sample',lastName:'Teacher',email:'geometry@example.invalid',employmentType:'Part-time',section:'Anglophone',
                password:crypto.randomBytes(24).toString('base64url')});
        }finally{await identity.revokeSession(session.token);}
        const tls=path.join(__dirname,'../backups/runtime/tls');
        server=https.createServer({key:fs.readFileSync(path.join(tls,'localhost.key')),cert:fs.readFileSync(path.join(tls,'localhost.crt'))},
            isolatePreviewCookies(createPreviewApp(db,samples,'https://localhost:2028',{enrolmentLedger:true,currentTransfers:true,pupilLifecycle:true,yearOfferings:true,yearArchive:true})));
        await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(2028,'127.0.0.1',resolve);});
        console.log('M2 synthetic registration preview: https://localhost:2028 — enter finish to stop and remove only this preview data.');
        await new Promise(resolve=>{
            const input=readline.createInterface({input:process.stdin});let done=false;
            const finish=()=>{if(done)return;done=true;input.close();process.removeListener('SIGINT',finish);process.removeListener('SIGTERM',finish);resolve();};
            input.on('line',line=>{if(line.trim()==='finish')finish();});process.once('SIGINT',finish);process.once('SIGTERM',finish);
        });
    }finally{
        if(server?.listening)await new Promise(resolve=>server.close(resolve));
        try{if(owned){await cleanup(db,owned);console.log('Temporary ledger schema and synthetic preview fixtures removed');}
            else if(created)await require('./stagedPupilSchema').remove(db,undefined,{yearOfferings:true,yearArchive:true});}
        finally{await db.close();}
    }
}
if(require.main===module)main().catch(()=>{console.error('M2 preview stopped with an error; review owned cleanup evidence. Credentials withheld.');process.exitCode=1;});
