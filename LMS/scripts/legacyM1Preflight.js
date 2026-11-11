// Read-only metadata/count preflight. No legacy values, hashes, medical data or credentials are returned.
const db=require('../config/database');
const {OWNED}=require('./reconcileSchool');
async function inspect(database=db){await database.connect();const request=()=>database.pool.request();
    const identity=(await request().query("SELECT DB_NAME() AS database_name,CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) AS server_name,CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(128)) AS sql_version")).recordset[0];
    if(identity.database_name!=='schooldb'||identity.server_name.toUpperCase()!=='MARIUS\\DEV')throw new Error('Unexpected original database');
    const tables=(await request().query("SELECT t.name FROM sys.tables t WHERE t.schema_id=SCHEMA_ID('dbo') AND t.is_ms_shipped=0 ORDER BY t.name")).recordset.map(row=>row.name);
    const report={reviewedAt:new Date().toISOString(),mode:'read-only',school:'LYCEE BATOURI',ownership:'Owner attests all schooldb records belong to this school',proposedPlatformOperator:'admin@school.local',...identity,
        hasMigrationLedger:tables.includes('schema_migrations'),hasCanonicalSchools:tables.includes('schools'),schoolOwnedTables:[],untrustedForeignKeys:[],accountReview:{},changes:0};
    for(const table of OWNED){if(!tables.includes(table)){report.schoolOwnedTables.push({table,present:false});continue;}
        const metadata=(await request().input('table',db.sql.NVarChar(128),table).query(`SELECT c.name,ty.name AS type,c.max_length,c.is_nullable FROM sys.columns c
            JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE t.schema_id=SCHEMA_ID('dbo') AND t.name=@table ORDER BY c.column_id`)).recordset;
        const count=(await request().query(`SELECT COUNT_BIG(*) AS count FROM dbo.[${table}]`)).recordset[0].count;
        report.schoolOwnedTables.push({table,present:true,count:String(count),columns:metadata});}
    report.untrustedForeignKeys=(await request().query('SELECT name FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1')).recordset.map(row=>row.name);
    if(tables.includes('Admins'))report.accountReview=(await request().query(`SELECT COUNT(*) AS adminTableRows,
        COALESCE(SUM(CASE WHEN LOWER(LTRIM(RTRIM(role)))='admin' THEN 1 ELSE 0 END),0) AS recognisedAdministrators,
        COALESCE(SUM(CASE WHEN LOWER(LTRIM(RTRIM(role)))<>'admin' OR role IS NULL THEN 1 ELSE 0 END),0) AS roleExceptions FROM dbo.Admins`)).recordset[0];
    report.executionGate='No changes made. Existing unversioned schema needs reviewed adoption/expand migrations and verified original-source backup/rehearsal; do not run synthetic setup over it.';
    return report;
}
if(require.main===module)inspect().then(report=>console.log(JSON.stringify(report,null,2))).catch(()=>{console.error('Original database preflight stopped; credentials and row values withheld.');process.exitCode=1;}).finally(()=>db.close());
module.exports={inspect};
