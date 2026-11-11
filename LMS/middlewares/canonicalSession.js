const COOKIE='__Host-lms_session';
const denied=()=>Object.assign(new Error('Access denied'),{ statusCode:403 });
function readSessionToken(req) {
    const values=(req.get('Cookie') || '').split(';').map(value=>value.trim()).filter(value=>value.startsWith(`${COOKIE}=`));
    return values.length===1?values[0].slice(COOKIE.length+1):null;
}
function originGuard(publicOrigin) {
    const origin=new URL(publicOrigin);
    if (origin.protocol!=='https:' || origin.origin!==publicOrigin) throw new Error('An exact HTTPS public origin is required');
    return (req,_res,next)=>{
        if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('Origin')!==publicOrigin) return next(denied());
        next();
    };
}
module.exports={ readSessionToken,originGuard,COOKIE };
