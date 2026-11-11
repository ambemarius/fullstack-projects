// Read-only UI health checks. No login, fixture creation or database access.
const http=require('node:http'),https=require('node:https'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ca=fs.readFileSync(path.join(__dirname,'../backups/runtime/tls/localhost.crt'));
function read(port,url,accept='text/html'){
 return new Promise((resolve,reject)=>{
  const client=port===2026?http:https;
  const request=client.get({hostname:'localhost',family:4,port,path:url,ca,headers:{Accept:accept}},response=>{
   let body='';response.on('data',chunk=>body+=chunk);response.on('end',()=>resolve({status:response.statusCode,type:response.headers['content-type']||'',body}));
  });request.setTimeout(10000,()=>request.destroy(Error('UI route check timed out')));request.on('error',reject);
 });
}
async function main(){
 for(const port of [2026,2027,2029,2030]){
  const missing=await read(port,'/__lms_ui_missing_page_check__');
  assert.equal(missing.status,404,port+' missing page status');assert.match(missing.type,/text\/html/);assert.match(missing.body,/Page not found/);assert.match(missing.body,/Return to workspace/);
  const api=await read(port,'/api/__lms_ui_missing_api_check__');
  assert.equal(api.status,404);assert.match(api.type,/application\/json/);
  const css=await read(port,'/css/workspace-ui.css','text/css');assert.equal(css.status,200);assert.match(css.body,/lms-error-panel/);
  const feedback=await read(port,'/js/form-feedback.js','text/javascript');assert.equal(feedback.status,200);assert.match(feedback.body,/lms-validation-summary/);
  assert.match(missing.body,/\/js\/form-feedback\.js/);
 }
 const denied=await read(2030,'/workspace/finance');assert.equal(denied.status,403);assert.match(denied.body,/This page is not available to your account/);
 const login=await read(2026,'/login');assert.equal(login.status,200);assert.match(login.body,/id="loginForm"/);
 assert.match(login.body,/\/js\/form-feedback\.js/);
 const registration=await read(2027,'/registration');assert.equal(registration.status,302);
 console.log('Browser 404 pages, API JSON compatibility and shared assets passed on 2026/2027/2029/2030. Practice access denial and canonical sign-in redirect preserved. No records changed.');
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
