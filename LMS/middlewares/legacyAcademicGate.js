function legacyAcademicGate(req,res,next){
 if(['GET','HEAD','OPTIONS'].includes(req.method)||!/^\/api\/v1\/(classes|subjects|academic-years)(\/|$)/i.test(req.path))return next();
 return res.status(409).json({status:'failed',message:'Class, subject and academic-year changes have moved to https://localhost:2027/academic',workspace:'https://localhost:2027/academic'});
}
module.exports={legacyAcademicGate};
