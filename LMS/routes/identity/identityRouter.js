const express = require('express');
const { randomUUID } = require('node:crypto');
const { createIdentityService } = require('../../model/identity/identityService');
const { readSessionToken:token,originGuard,COOKIE }=require('../../middlewares/canonicalSession');
const cookieOptions = { httpOnly:true,secure:true,sameSite:'strict',path:'/' };
const deny = () => Object.assign(new Error('Access denied'),{ statusCode:403 });

// Deliberately not mounted in app/app.js. Legacy routes must be scoped before activation.
function createIdentityRouter({ service=createIdentityService(), publicOrigin, now=Date.now } = {}) {
    const checkOrigin=originGuard(publicOrigin);
    const router = express.Router();
    const attempts = new Map();
    router.use((_req,res,next) => { res.setHeader('Cache-Control','no-store'); next(); });
    router.use(checkOrigin);
    function limited(req,_res,next) {
        const key=req.ip;
        const time=now();
        let entry=attempts.get(key);
        if (!entry || time>=entry.until) {
            // Bounded memory; reject new sources at capacity until expired entries can be removed.
            for (const [ip,item] of attempts) if (time>=item.until) attempts.delete(ip);
            if (attempts.size>=1000) return next(Object.assign(new Error('Please try again later'),{ statusCode:429 }));
            entry={ count:0,until:time+15*60*1000 }; attempts.set(key,entry);
        }
        if (++entry.count>10) return next(Object.assign(new Error('Please try again later'),{ statusCode:429 }));
        next();
    }
    async function authenticated(req,_res,next) {
        req.identityToken=token(req);
        req.identity=await service.resolveSession(req.identityToken);
        if (!req.identity) return next(deny());
        next();
    }
    async function csrf(req,_res,next) {
        if (!await service.validateCsrf(req.identityToken,req.get('X-CSRF-Token'))) return next(deny());
        next();
    }
    function sessionResponse(res,session) {
        res.cookie(COOKIE,session.token,{ ...cookieOptions,expires:session.expiresAt });
        res.json({ status:'success',csrfToken:session.csrfToken,expiresAt:session.expiresAt });
    }
    router.post('/login',limited,async (req,res) => {
        const body=req.body || {};
        const session=body.accountType!==undefined
            ? await service.loginSchoolIdentity(body.schoolCode,body.accountType,body.identifier,body.password)
            : await service.login(body.loginKey,body.password,body.schoolCode ?? null);
        // Reauthentication rotates a prior browser session as well.
        await service.revokeSession(token(req));
        sessionResponse(res,session);
    });
    router.post('/accept-invitation',limited,async (req,res) => {
        const body=req.body || {};
        await service.acceptInvitation(body.invitationToken,body.password,randomUUID());
        res.status(201).json({ status:'success' });
    });
    router.get('/session',authenticated,(req,res) => res.json({ status:'success',identity:req.identity }));
    router.get('/memberships',authenticated,async(req,res)=>res.json({ status:'success',data:await service.memberships(req.identityToken) }));
    // Origin-protected recovery after a page reload; no previous CSRF token is needed to issue one.
    router.post('/csrf',authenticated,async(req,res)=>res.json({ status:'success',...await service.refreshCsrf(req.identityToken) }));
    router.post('/switch-school',authenticated,csrf,async (req,res) => {
        const session=await service.switchSchool(req.identityToken,req.body?.schoolCode);
        sessionResponse(res,session);
    });
    router.post('/logout',authenticated,csrf,async (req,res) => {
        await service.revokeSession(req.identityToken);
        res.clearCookie(COOKIE,cookieOptions);
        res.status(204).end();
    });
    router.post('/school-invitations',authenticated,csrf,async (req,res) => {
        const body=req.body || {};
        // Never pass caller-provided actor, account, membership, grant or audit IDs.
        const invitation=await service.inviteSchool(req.identityToken,{ code:body.code,name:body.name,
            educationSystem:body.educationSystem,intendedLoginKey:body.intendedLoginKey,requestId:randomUUID() });
        res.status(201).json({ status:'success',...invitation });
    });
    return router;
}

module.exports={ createIdentityRouter };
