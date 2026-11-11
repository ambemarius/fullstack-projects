const test=require('node:test'),assert=require('node:assert/strict');
const {createUiReviewApp,pages}=require('../scripts/uiReviewPreview');
const {serve}=require('./helpers/http');
test('UI review renders every source screen without mounting authentication, APIs or writes',async t=>{
 const base=await serve(t,createUiReviewApp());
 for(const page of pages){const response=await fetch(base+'/review/'+page);assert.equal(response.status,200,page);
  const html=await response.text();assert.match(html,/workspace-ui.css/,page);assert.match(html,/Visual review only/);
  assert.doesNotMatch(html,/<script[^>]+src="\/js\/(?:auth|canonical|admin-layout|m1-preview|m1-original)/);
 }
 assert.equal((await fetch(base+'/api/identity/session')).status,404);
 assert.equal((await fetch(base+'/review/login',{method:'POST'})).status,404);
 assert.equal((await fetch(base+'/review/unrecognised')).status,404);
});
