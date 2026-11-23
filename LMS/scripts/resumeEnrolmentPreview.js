// Resume only the recorded disposable ledger fixture. No migrations, reseeding,
// password changes or cleanup-on-exit: reviewed sample work must survive restarts.
const fs=require('node:fs'),path=require('node:path'),https=require('node:https');
const {sql,createDatabase}=require('../config/database');
const {loadTestEnvironment,assertSyntheticDatabase}=require('./testEnvironment');
const {createPreviewApp}=require('./m1Preview');
const {isolatePreviewCookies}=require('./m1AcceptancePreview');
function ownedAccounts(owned){
    if(owned?.format!=='m2-registration-preview-v4'||!Array.isArray(owned.schoolCodes)||owned.schoolCodes.length!==2)throw Error('Invalid ledger ownership evidence');
    const ids=owned.ids;
    if(!ids||!['a','b','aa','ab','ma','mb'].every(k=>Number.isSafeInteger(ids[k])&&ids[k]>0)||ids.a===ids.b||ids.aa===ids.ab||ids.ma===ids.mb)throw Error('Invalid sample identities');
    const [a,b]=owned.schoolCodes;
    if(!/^LEDGER_[A-F0-9]{12}A$/.test(a)||b!==a.slice(0,-1)+'B')throw Error('Not a retained synthetic ledger school');
    return [{schoolId:ids.a,accountId:ids.aa,membershipId:ids.ma,schoolCode:a},
        {schoolId:ids.b,accountId:ids.ab,membershipId:ids.mb,schoolCode:b}].map(row=>({...row,role:'admin',identifier:'Synthetic administrator'}));
}
async function verifyAccount(db,account){
    await assertSyntheticDatabase(db);
    const rows=(await db.getPool().request().input('school',sql.Int,account.schoolId).input('account',sql.Int,account.accountId)
        .input('membership',sql.Int,account.membershipId).input('code',sql.NVarChar(50),account.schoolCode).query(`
        SELECT s.id,s.code,s.name FROM dbo.schools s
        JOIN dbo.school_memberships m ON m.school_id=s.id AND m.id=@membership AND m.account_id=@account AND m.status='active'
        JOIN dbo.accounts a ON a.id=m.account_id AND a.status='active' AND a.login_key=@code
        JOIN dbo.membership_roles r ON r.school_id=m.school_id AND r.membership_id=m.id AND r.role='admin'
        WHERE s.id=@school AND s.code=@code AND s.status='active'
        AND NOT EXISTS(SELECT 1 FROM dbo.platform_role_grants p WHERE p.account_id=a.id)
        AND OBJECT_ID('dbo.student_enrolments') IS NOT NULL
        AND OBJECT_ID('dbo.student_enrolment_revisions') IS NOT NULL`)).recordset;
    if(rows.length!==1)throw Error('Retained sample ownership or schema changed');
    return rows[0];
}
async function main(){
    loadTestEnvironment();const db=createDatabase(),dir=path.join(__dirname,'../backups/runtime');
    const file=path.join(dir,'m2-registration-preview-owned.json'),owned=JSON.parse(fs.readFileSync(file,'utf8'));
    try{
        try{process.kill(owned.pid,0);throw Error('Recorded preview process still exists');}catch(error){if(error.code!=='ESRCH')throw error;}
        const accounts=ownedAccounts(owned),schools=[];
        for(const account of accounts)schools.push(await verifyAccount(db,account));
        const app=isolatePreviewCookies(createPreviewApp(db,{accounts,schools},'https://localhost:2028',{
            enrolmentLedger:true,currentTransfers:true,pupilLifecycle:true,yearOfferings:true,yearArchive:true,
            sampleSignIn:async(account,identity)=>{await verifyAccount(db,account);return identity.createSession(account.accountId,account.membershipId);}
        }));
        const server=https.createServer({key:fs.readFileSync(path.join(dir,'tls/localhost.key')),cert:fs.readFileSync(path.join(dir,'tls/localhost.crt'))},app);
        await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(2028,'127.0.0.1',resolve);});
        fs.writeFileSync(file,JSON.stringify({...owned,pid:process.pid,resumedAt:new Date().toISOString()}));
        console.log('Retained enrolment practice ready on https://localhost:2028; records and credentials preserved.');
        for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>db.close()));
    }catch(error){await db.close();throw error;}
}
if(require.main===module)main().catch(error=>{console.error('Enrolment resume refused: '+error.message);process.exitCode=1;});
module.exports={ownedAccounts,verifyAccount};
