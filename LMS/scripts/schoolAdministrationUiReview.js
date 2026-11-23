// Database-free presentation harness, bound to loopback only. No real sessions,
// credentials, invitations, account creation or database writes are available.
const express=require('express');const {createApp}=require('../app/app');
function createReviewApp(){const routes=express.Router();
 routes.get('/',(req,res)=>res.render('canonical-staff-accounts',{schoolAdministration:true},(error,html)=>{
  if(error)return res.sendStatus(500);res.send(html.replace('LYCEE BATOURI','Synthetic School A').replace('LYCEE BATOURI','Synthetic School A').replace('<main>','<main><p class="ui-fixture-note">Visual review only. Fictional school and staff; forms do not save.</p>'));
 }));
 routes.get('/api/identity/session',(_req,res)=>res.json({identity:{schoolId:1,roles:['admin'],platformPermissions:[]}}));
 routes.post('/api/identity/csrf',(_req,res)=>res.json({csrfToken:'visual-review-only'}));
 routes.get('/api/staff-accounts/context',(_req,res)=>res.json({data:{schoolId:1,schoolName:'Synthetic School A',roleLabel:'School Super Administrator',canManageAccounts:true,schoolLocal:true}}));
 routes.get('/api/staff-accounts/administrators',(_req,res)=>res.json({data:[{profileType:'admin',profileId:1,name:'Sample Administrator',email:'sample@example.invalid',status:'active',linked:true,nativeAccount:true,linkStatus:'active',permission:'admin'}]}));
 routes.get('/api/staff-accounts/directory',(_req,res)=>res.json({data:[]}));
 routes.get('/api/staff-accounts/tokens',(_req,res)=>res.json({data:[]}));
 routes.use('/api',(_req,res)=>res.status(422).json({message:'Visual review only. No account changes were saved.'}));
 return createApp({logging:false,routes:[['/',routes]]});
}
if(require.main===module){const server=createReviewApp().listen(2032,'127.0.0.1',()=>console.log('Database-free staff UI review at http://localhost:2032/'));process.on('SIGINT',()=>server.close(()=>process.exit()));}
module.exports={createReviewApp};
