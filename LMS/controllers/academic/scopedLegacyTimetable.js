const {createLegacySchoolAccess}=require('../../model/identity/legacySchoolAccess');const {createLegacyTimetableService}=require('../../model/identity/legacyTimetableService');
const defaultTerm=()=>{const month=new Date().getMonth()+1;return month>=9?'First':month<=3?'Second':'Third';};
async function handle(req,operation){const access=createLegacySchoolAccess(),context=await access.resolve(req.headers.authorization,['admin']),service=createLegacyTimetableService(access);
 if(operation==='form')return service.form(context);if(operation==='create')return service.create(context,req.body);if(operation==='remove')return service.remove(context,req.params.id);
 if(operation==='generate'){if(req.body&&Object.keys(req.body).some(key=>!['term','academic_year_id'].includes(key)))throw Object.assign(new Error('Unsupported generation fields'),{statusCode:422});return service.generate(context,req.params.classId,req.body?.academic_year_id,req.body?.term||defaultTerm());}
 return service.entries(context,{classId:req.params.classId,yearId:req.query.yearId,academicTerm:req.query.term||defaultTerm(),section:req.query.section||undefined,mode:operation});
}
module.exports={handle};
