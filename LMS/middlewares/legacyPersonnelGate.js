// Prevent two independent writers once canonical personnel workflows are activated.
function legacyPersonnelGate(req,res,next){
 if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
 const path=req.path.replace(/\/+$/,'');
 if(!/^\/api\/v1\/(admin|teachers|students)(\/|$)/i.test(path))return next();
 if(req.method==='POST'&&/^\/api\/v1\/(admin|teachers|students)\/login$/i.test(path))return next();
 if(req.method==='PUT'&&/^\/api\/v1\/admin\/(publish|unpublish)\/exam\/[0-9]+$/i.test(path))return next();
 return res.status(409).json({status:'failed',message:'Personnel changes have moved to the school workspace. Open https://localhost:2027/registration and sign in there.',workspace:'https://localhost:2027/registration'});
}
module.exports={legacyPersonnelGate};
