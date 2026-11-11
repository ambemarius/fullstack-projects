const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {createApp} = require('../app/app');
const {createSchoolApp} = require('../scripts/canonicalSchool');
const {serve} = require('./helpers/http');
const browserHeaders = {Accept:'text/html'};

test('browser error pages retain statuses and never expose raw errors or requested URLs', async t => {
    const routes = express.Router();
    routes.get('/broken', () => {throw Error('SQL connection password=do-not-display');});
    const base = await serve(t, createApp({logging:false,routes:[['/',routes]]}));
    for (const [path,status,title] of [['/missing?private=do-not-display',404,'Page not found'],['/broken',500,'We could not open this page']]) {
        const res = await fetch(base+path,{headers:browserHeaders});
        assert.equal(res.status,status);assert.match(res.headers.get('content-type'),/text\/html/);
        assert.equal(res.headers.get('cache-control'),'no-store');
        const html=await res.text();assert.ok(html.includes(title));assert.match(html,/Return to workspace/);
        assert.doesNotMatch(html,/do-not-display|SQL connection/);assert.match(html,/Support reference/);
    }
});

test('API paths, JSON-preferring clients and POST failures keep JSON error contracts', async t => {
    const base = await serve(t,createApp({logging:false,routes:[]}));
    for(const [path,options] of [
        ['/api/missing',{headers:browserHeaders}],
        ['/API/missing',{headers:browserHeaders}],
        ['/missing',{}],
        ['/missing',{headers:{Accept:'application/json, text/html;q=0.5'}}],
        ['/missing',{method:'POST',headers:browserHeaders}]
    ]) {
        const res=await fetch(base+path,options);assert.equal(res.status,404);
        assert.match(res.headers.get('content-type'),/application\/json/);
        const json=await res.json();assert.equal(json.status,'failed');assert.equal(json.message,'Resource not found');assert.ok(json.requestId);
    }
});

test('canonical denied page routes retain role checks and anonymous sign-in redirects', async t => {
    let current={roles:['student']};
    const service={resolveSession:async()=>current};
    const db={getPool(){throw Error('Page denial must not access SQL');}};
    const base=await serve(t,createSchoolApp(db,{identityService:service,personnelWrites:true,academicWrites:true,auxiliaryWrites:true,membershipInvitations:true,academicLinks:true}));
    for(const path of ['/registration','/academic','/auxiliary','/invitations']) {
        const res=await fetch(base+path,{headers:browserHeaders});assert.equal(res.status,403,path);
        const html=await res.text();assert.match(html,/This page is not available to your account/);assert.doesNotMatch(html,/id="(?:editor|studentForm|invite-form)"/);
    }
    current={roles:['librarian']};
    assert.equal((await fetch(base+'/courses',{headers:browserHeaders})).status,403);
    current={roles:['teacher']};
    assert.equal((await fetch(base+'/courses',{headers:browserHeaders})).status,200);
    assert.equal((await fetch(base+'/registration',{headers:browserHeaders})).status,403);
    current=null;
    const redirect=await fetch(base+'/registration',{headers:browserHeaders,redirect:'manual'});
    assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'/?next=registration');
});
