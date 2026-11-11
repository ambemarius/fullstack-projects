const verifyToken=require('../utils/verifyToken');
function legacyAcademicLinksGate(req,res,next){
 const path=req.path,read=['GET','HEAD','OPTIONS'].includes(req.method);
 const moved=/^\/api\/v1\/(marks|class-subject-students)(\/|$)/i.test(path)||/^\/api\/v1\/teachers\/(my-subjects|my-students)\/?$/i.test(path)||(!read&&/^\/api\/v1\/allocations(\/|$)/i.test(path));
 // Retired teacher/pupil academic reads must not bypass explicit year/term assignments.
 const academic=/^\/api\/v1\/(subjects|classes|academic-years|academic-context|report-cards|timetables|exams|exam-results|allocations)(\/|$)/i.test(path);
 const bearer=/^Bearer ([^\s]+)$/.exec(req.headers.authorization||'');const claims=academic&&bearer?verifyToken(bearer[1]):null;
 if(moved||(academic&&claims&&claims.accountType!=='admin'))return res.status(409).json({status:'failed',message:'Use the school course workspace. Current-year teaching assignments must be confirmed there.',workspace:'https://localhost:2027/courses'});
 next();
}
module.exports={legacyAcademicLinksGate};
