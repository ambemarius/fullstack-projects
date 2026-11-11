const { test }=require('node:test');
const assert=require('node:assert/strict');
const { createApp }=require('../app/app');
const { createIdentityRouter }=require('../routes/identity/identityRouter');
const { serve }=require('./helpers/http');
const origin='https://lms.example.invalid';

test('canonical HTTP boundary uses secure cookies, Origin/CSRF and server-derived identity',async t => {
    const calls=[];
    const token='a'.repeat(43),newToken='b'.repeat(43),csrf='c'.repeat(43);
    const session={ token:newToken,csrfToken:csrf,expiresAt:new Date(Date.now()+60000) };
    const service={
        async login(...args) { calls.push(['login',...args]); return session; },
        async resolveSession(value) { calls.push(['resolve',value]); return value===token ? { accountId:1,membershipId:2,schoolId:3,roles:['admin'],platformPermissions:[] } : null; },
        async validateCsrf(value,proof) { return value===token && proof===csrf; },
        async revokeSession(value) { calls.push(['revoke',value]); },
        async switchSchool(...args) { calls.push(['switch',...args]); return session; },
        async acceptInvitation(...args) { calls.push(['accept',...args]); },
        async inviteSchool(...args) { calls.push(['invite',...args]); return { schoolId:4,invitationToken:'opaque-test-invitation' }; },
    };
    const base=await serve(t,createApp({ logging:false,routes:[['/identity',createIdentityRouter({ service,publicOrigin:origin })]] }));
    const post=(path,body={},headers={})=>fetch(`${base}/identity${path}`,{ method:'POST',headers:{ 'Content-Type':'application/json',Origin:origin,...headers },body:JSON.stringify(body) });
    assert.equal((await post('/login',{}, { Origin:'https://attacker.invalid' })).status,403);
    assert.equal(calls.length,0);
    const login=await post('/login',{ loginKey:'canonical:key',password:'synthetic',schoolCode:'A',accountId:999 });
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie');
    assert.match(cookie,/__Host-lms_session=/);
    assert.match(cookie,/HttpOnly/); assert.match(cookie,/Secure/); assert.match(cookie,/SameSite=Strict/); assert.match(cookie,/Path=\//);
    assert.doesNotMatch(cookie,/Domain=/);
    const payload=await login.json();
    assert.equal(payload.csrfToken,csrf); assert.equal(Object.hasOwn(payload,'token'),false);
    assert.deepEqual(calls[0],['login','canonical:key','synthetic','A']);
    const headers={ Cookie:`__Host-lms_session=${token}`,'X-CSRF-Token':csrf };
    assert.equal((await post('/switch-school',{ schoolCode:'B' },{ Cookie:headers.Cookie })).status,403);
    assert.equal(calls.some(c=>c[0]==='switch'),false);
    assert.equal((await post('/switch-school',{ schoolCode:'B',accountId:999,schoolId:999 },headers)).status,200);
    assert.deepEqual(calls.find(c=>c[0]==='switch'),['switch',token,'B']);
    const info=await fetch(`${base}/identity/session`,{ headers });
    assert.equal(info.headers.get('cache-control'),'no-store');
    assert.equal((await info.json()).identity.schoolId,3);
    assert.equal((await fetch(`${base}/identity/session`,{ headers:{ Cookie:`${headers.Cookie}; ${headers.Cookie}` } })).status,403);
    const invite=await post('/school-invitations',{ code:'NEW',name:'Synthetic',educationSystem:'Bilingual',intendedLoginKey:'new:key',actor:999,requestId:'forged' },headers);
    assert.equal(invite.status,201);
    const call=calls.find(c=>c[0]==='invite');
    assert.equal(call[1],token); assert.equal(call[2].actor,undefined); assert.notEqual(call[2].requestId,'forged');
    const logout=await post('/logout',{},headers);
    assert.equal(logout.status,204); assert.match(logout.headers.get('set-cookie'),/Expires=Thu, 01 Jan 1970/);
});

test('identity credential endpoints limit attempts and require a fixed HTTPS origin',async t=>{
    assert.throws(()=>createIdentityRouter({ publicOrigin:'http://lms.example.invalid' }),/HTTPS/);
    let attempts=0;
    const service={ async login() { attempts++; throw Object.assign(new Error('Access denied'),{ statusCode:403 }); } };
    let time=0;
    const base=await serve(t,createApp({ logging:false,routes:[['/identity',createIdentityRouter({ service,publicOrigin:origin,now:()=>time })]] }));
    for(let i=0;i<11;i++) {
        const response=await fetch(`${base}/identity/login`,{ method:'POST',headers:{ Origin:origin,'Content-Type':'application/json' },body:'{}' });
        assert.equal(response.status,i===10?429:403);
    }
    assert.equal(attempts,10);
    time=15*60*1000;
    assert.equal((await fetch(`${base}/identity/login`,{ method:'POST',headers:{ Origin:origin,'Content-Type':'application/json' },body:'{}' })).status,403);
    assert.equal(attempts,11);
});
