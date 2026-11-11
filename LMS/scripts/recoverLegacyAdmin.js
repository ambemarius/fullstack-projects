const {sql}=require('../config/database');
const bcrypt=require('bcrypt');
const fail=message=>{throw new Error(message);};
function validateRecoveryInput(password,expectedId) {
    if(typeof password!=='string'||password.length<12) fail('New password must contain at least 12 characters');
    if(Buffer.byteLength(password,'utf8')>72) fail('New password must not exceed 72 UTF-8 bytes');
    if(!Number.isSafeInteger(expectedId)||expectedId<1) fail('Invalid reviewed account ID');
}
function safeRecoveryError(err) {
    const known={
        'New password must contain at least 12 characters':['PASSWORD_TOO_SHORT','Use at least 12 characters. Validation stopped before any database update.'],
        'New password must not exceed 72 UTF-8 bytes':['PASSWORD_TOO_LONG','Use no more than 72 UTF-8 bytes. Validation stopped before any database update.'],
        'Invalid reviewed account ID':['INVALID_REVIEW','Review the account again before applying recovery.'],
        'Recovery refused: unexpected database':['WRONG_TARGET','The configured server/database is not the approved original target.'],
        'Recovery refused: administrator not uniquely identified':['ACCOUNT_NOT_FOUND','The selected email does not identify exactly one administrator.'],
        'Recovery refused: account changed since review':['ACCOUNT_CHANGED','The account ID changed after review; review again.'],
        'Recovery refused: concurrent account change':['CONCURRENT_CHANGE','The stored credential changed during recovery; review again.'],
        'Recovery refused: canonical identity requires synchronized recovery':['CANONICAL_RECOVERY_REQUIRED','This database has canonical accounts. Use synchronized recovery; this legacy-only updater is disabled.'],
        'Invalid private input':['INPUT_FORMAT','The private input could not be decoded. Use the updated PowerShell wrapper.'],
    };
    const entry=known[err.message] || (err.code==='ELOGIN'?['DATABASE_LOGIN_FAILED','SQL Server rejected its configured login.']:
        err.code==='EREQUEST'?['DATABASE_ERROR',`SQL Server rejected recovery (error ${Number.isInteger(err.number)?err.number:'unknown'}). No credentials displayed.`]:
        ['RECOVERY_FAILED','Recovery could not be completed. Check connectivity and database permissions; credentials withheld.']);
    return {code:entry[0],message:entry[1]};
}
function createLegacyAdminRecovery(database=require('../config/database')) {
    async function target() {
        await database.connect();
        const row=(await database.pool.request().query("SELECT DB_NAME() AS database_name,CAST(SERVERPROPERTY(N'ServerName') AS nvarchar(128)) AS server_name")).recordset[0];
        if(row.database_name!=='schooldb'||row.server_name.toUpperCase()!=='MARIUS\\DEV') fail('Recovery refused: unexpected database');
    }
    async function account(email,secret=false) {
        if(typeof email!=='string'||email!==email.trim()||email.length>255||!email.includes('@')) fail('Invalid account email');
        const rows=(await database.pool.request().input('email',sql.NVarChar(255),email).query(`SELECT id,email,role${secret?',password':''} FROM dbo.Admins WHERE email=@email AND LOWER(role)=N'admin'`)).recordset;
        if(rows.length!==1) fail('Recovery refused: administrator not uniquely identified');
        return rows[0];
    }
    async function review(email) {
        await target();const row=await account(email);
        return {mode:'review',server:'MARIUS\\DEV',database:'schooldb',accountId:row.id,email:row.email,changes:0};
    }
    async function apply(email,password,expectedId) {
        validateRecoveryInput(password,expectedId);
        await target();
        const identity=(await database.pool.request().query("SELECT CASE WHEN OBJECT_ID(N'dbo.accounts',N'U') IS NOT NULL OR OBJECT_ID(N'dbo.legacy_account_map',N'U') IS NOT NULL THEN 1 ELSE 0 END AS canonical_identity_present")).recordset[0];
        if(identity?.canonical_identity_present!==0)fail('Recovery refused: canonical identity requires synchronized recovery');
        const row=await account(email,true);
        if(row.id!==expectedId) fail('Recovery refused: account changed since review');
        const replacement=await bcrypt.hash(password,12);
        const result=await database.pool.request().input('id',sql.Int,row.id).input('email',sql.NVarChar(255),row.email)
            .input('previous',sql.NVarChar(255),row.password).input('replacement',sql.NVarChar(255),replacement).query(`
                UPDATE dbo.Admins SET password=@replacement
                WHERE id=@id AND email=@email AND LOWER(role)=N'admin' AND password=@previous;
                SELECT @@ROWCOUNT AS affected;
            `);
        if(result.recordset[0].affected!==1) fail('Recovery refused: concurrent account change');
        return {mode:'applied',server:'MARIUS\\DEV',database:'schooldb',accountId:row.id,email:row.email,changes:1,
            sessions:'Existing legacy tokens retain their normal expiry; no other accounts or signing keys changed'};
    }
    return {review,apply};
}
async function main() {
    const args=process.argv.slice(2),email=args[args.indexOf('--email')+1];
    const database=require('../config/database'),recovery=createLegacyAdminRecovery(database);
    try {
        if(!args.includes('--email')) fail('An explicit administrator email is required');
        if(args.includes('--apply')||args.includes('--check-input')) {
            if(!args.includes('--expected-id')) fail('Reviewed account ID is required');
            process.stdin.setEncoding('utf8');
            let content='';for await(const chunk of process.stdin){content+=chunk;if(content.length>4096)fail('Invalid private input');}
            let input;try{input=JSON.parse(content.replace(/^\uFEFF/,''));}catch{fail('Invalid private input');}
            const expectedId=Number(args[args.indexOf('--expected-id')+1]);
            validateRecoveryInput(input.password,expectedId);
            console.log(JSON.stringify(args.includes('--check-input')?{mode:'input-check',changes:0,passwordAccepted:true}:await recovery.apply(email,input.password,expectedId)));
        } else console.log(JSON.stringify(await recovery.review(email)));
    } catch(err) {console.error(JSON.stringify(safeRecoveryError(err)));process.exitCode=1;}
    finally {await database.close();}
}
if(require.main===module)main();
module.exports={createLegacyAdminRecovery,validateRecoveryInput,safeRecoveryError};
