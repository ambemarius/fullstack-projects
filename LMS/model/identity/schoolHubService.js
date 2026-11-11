const crypto=require('node:crypto');
const {sql}=require('../../config/database');
const {authoritySql}=require('./schoolAccess');
const {liveHub}=require('../../utils/schoolHub');
function createSchoolHubService(database,identityService,enabled){
 return async token=>{
  const identity=await identityService.resolveSession(token);
  if(!identity?.schoolId||!identity.roles.length)return null;
  await database.connect();
  const result=await database.getPool().request()
   .input('school',sql.Int,identity.schoolId).input('account',sql.Int,identity.accountId)
   .input('membership',sql.Int,identity.membershipId).input('session_hash',sql.Char(64),crypto.createHash('sha256').update(token).digest('hex'))
   .input('role_one',sql.VarChar(30),identity.roles[0]).input('role_two',sql.VarChar(30),identity.roles[0]).query(`
    SELECT name FROM dbo.schools WHERE id=@school AND ${authoritySql};
    SELECT name FROM dbo.academic_years WHERE school_id=@school AND isCurrent=1 AND ${authoritySql};`);
  if(result.recordsets[0].length!==1)return null;
  // Fail closed if membership changed during the context read; use refreshed roles.
  const fresh=await identityService.resolveSession(token);
  if(!fresh||fresh.schoolId!==identity.schoolId||fresh.membershipId!==identity.membershipId||fresh.accountId!==identity.accountId)return null;
  return liveHub(fresh,result.recordsets[0][0],result.recordsets[1],enabled);
 };
}
module.exports={createSchoolHubService};
