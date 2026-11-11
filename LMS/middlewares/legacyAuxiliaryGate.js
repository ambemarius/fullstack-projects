function legacyAuxiliaryGate(req,res,next){
 if(['GET','HEAD','OPTIONS'].includes(req.method)||!/^\/api\/v1\/auxiliary(\/|$)/i.test(req.path))return next();
 res.status(409).json({status:'failed',message:'Auxiliary staff changes have moved to https://localhost:2027/auxiliary',workspace:'https://localhost:2027/auxiliary'});
}
module.exports={legacyAuxiliaryGate};
