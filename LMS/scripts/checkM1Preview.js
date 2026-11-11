// Verify the actual loopback preview with its exact local certificate as a trust anchor.
// Never disable TLS verification or print session cookies/CSRF values.
const https=require('node:https');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const ca=fs.readFileSync(path.join(__dirname,'../backups/runtime/tls/localhost.crt'));
function request(route,{method='GET',body,cookie,csrf}={}) {
    return new Promise((resolve,reject)=>{
        const text=body===undefined?null:JSON.stringify(body);
        const req=https.request({hostname:'localhost',family:4,port:2027,path:route,method,ca,
            headers:{Origin:'https://localhost:2027',...(text?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(text)}:{}),...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})}},res=>{
                let content='';res.on('data',chunk=>content+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:content,json:()=>JSON.parse(content)}));
            });req.on('error',reject);if(text)req.write(text);req.end();
    });
}
async function main() {
    assert.equal((await request('/')).status,200);
    const login=await request('/preview/sign-in',{method:'POST',body:{schoolCode:'M1_DEMO_A',role:'admin'}});
    assert.equal(login.status,200);
    const cookie=login.headers['set-cookie'][0].split(';')[0];
    assert.match(login.headers['set-cookie'][0],/HttpOnly/);assert.match(login.headers['set-cookie'][0],/Secure/);assert.match(login.headers['set-cookie'][0],/SameSite=Strict/);
    const first=(await request('/api/personnel/students',{cookie})).json().data.map(row=>row.id);
    assert.equal((await request('/api/v1/students',{cookie})).status,404);
    assert.equal((await request('/api/personnel/students',{method:'POST',body:{},cookie})).status,403);
    const csrf=(await request('/api/identity/csrf',{method:'POST',body:{},cookie})).json().csrfToken;
    const memberships=(await request('/api/identity/memberships',{cookie})).json().data;
    assert.equal(memberships.length,2);
    const switched=await request('/api/identity/switch-school',{method:'POST',body:{schoolCode:'M1_DEMO_B'},cookie,csrf});
    assert.equal(switched.status,200);
    const nextCookie=switched.headers['set-cookie'][0].split(';')[0],nextCsrf=switched.json().csrfToken;
    const second=(await request('/api/personnel/students',{cookie:nextCookie})).json().data.map(row=>row.id);
    assert.equal(first.some(id=>second.includes(id)),false);
    assert.equal((await request('/api/identity/session',{cookie})).status,403);
    assert.equal((await request('/api/identity/logout',{method:'POST',body:{},cookie:nextCookie,csrf:nextCsrf})).status,204);
    assert.equal((await request('/api/identity/session',{cookie:nextCookie})).status,403);
    console.log('HTTPS preview verified: pinned local certificate, secure cookie, CSRF recovery, isolated school switch, legacy routes disabled and logout. No credentials displayed.');
}
if(require.main===module)main().catch(()=>{console.error('Preview verification failed; session credentials withheld.');process.exitCode=1;});
