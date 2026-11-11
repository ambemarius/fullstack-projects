const {pageDenied}=require('../utils/pageError');
const express=require('express'),fs=require('node:fs'),path=require('node:path'),https=require('node:https'),crypto=require('node:crypto');
const {createDatabase}=require('../config/database');
const {createApp}=require('../app/app');
const {createIdentityService}=require('../model/identity/identityService');
const {createSchoolAccess}=require('../model/identity/schoolAccess');
const {createInventoryService,roles}=require('../model/identity/inventoryService');
const {originGuard}=require('../middlewares/canonicalSession');
const {loadTestEnvironment}=require('./testEnvironment');
const {prepareInventorySample}=require('./inventorySample');
const {prepareFinanceSample}=require('./financeSample');
const {createFinanceService,formatMoney,today}=require('../model/identity/financeService');
const {financeCollectionsCsv,financeStatementCsv}=require('../utils/financeCsv');
const origin='https://localhost:2030';
function cookie(req,name){
    const matches=(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='));
    return matches.length===1?matches[0].slice(name.length+1):null;
}
function createPracticeApp(database,accounts){
    const identity=createIdentityService(database),access=createSchoolAccess(identity),service=createInventoryService(database,access);
    const finance=createFinanceService(database,access),isFinance=area=>['finance','cashier'].includes(area);
    const areas={...roles,finance:'admin',cashier:'bursar'};
    const routes=express.Router();routes.use(originGuard(origin));
    routes.get('/',(_req,res)=>res.render('school-practice',{hub:require('../utils/schoolHub').practiceHub(accounts)}));
    routes.param('area',(req,res,next,area)=>{
        if(!Object.hasOwn(areas,area)||!accounts[area])return pageDenied(req,res,404,'Not Found');
        req.area=area;req.cookieName='__Host-lms_inventory_'+area;next();
    });
    routes.post('/open/:area',async(req,res)=>{
        const a=accounts[req.area],previous=cookie(req,req.cookieName);
        const old=await identity.resolveSession(previous);
        if(old?.membershipId!==a.membershipId||!await identity.validateCsrf(previous,cookie(req,req.cookieName+'_csrf'))){
            const session=await identity.createSession(a.accountId,a.membershipId);
            const options={httpOnly:true,secure:true,sameSite:'strict',path:'/',expires:session.expiresAt};
            res.cookie(req.cookieName,session.token,options);res.cookie(req.cookieName+'_csrf',session.csrfToken,options);
        }
        res.redirect(303,'/workspace/'+req.area);
    });
    routes.get('/workspace/:area',async(req,res)=>{
        const context=await access.resolve(cookie(req,req.cookieName));
        const search=req.query.search??'';
        if(isFinance(req.area)){
            const data=req.query.charge?await finance.detail(context,req.query.charge):await finance.list(context,search);
            return res.render(req.query.charge?'finance-charge':'practice-finance',{...data,area:req.area,search,
                csrf:cookie(req,req.cookieName+'_csrf'),uuid:crypto.randomUUID,today:today(),formatMoney,saved:req.query.saved==='1'});
        }
        const data=await service.list(context,req.area,search);
        res.render('practice-inventory',{...data,search,area:req.area,csrf:cookie(req,req.cookieName+'_csrf'),uuid:crypto.randomUUID,
            today:new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Douala',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),saved:req.query.saved==='1'});
    });
    routes.post('/workspace/:area',async(req,res)=>{
        const token=cookie(req,req.cookieName),context=await access.resolve(token);
        if(!await identity.validateCsrf(token,req.body.csrf))return res.sendStatus(403);
        try{
            if(isFinance(req.area)){
                const saved=await finance.save(context,req.body);
                return res.redirect(303,saved.paymentId?'/workspace/'+req.area+'/receipt/'+saved.paymentId:
                    '/workspace/'+req.area+'?charge='+saved.id+'&saved=1');
            }
            await service.save(context,req.area,req.body);
        }
        catch(error){if(![404,409,422].includes(error.statusCode))throw error;
            return res.status(error.statusCode).render('inventory-error',{message:error.message,area:req.area});}
        res.redirect(303,'/workspace/'+req.area+'?saved=1');
    });
    routes.get('/workspace/:area/receipt/:payment',async(req,res)=>{
        if(!isFinance(req.area))return res.sendStatus(404);
        const context=await access.resolve(cookie(req,req.cookieName));
        res.render('finance-receipt',{...await finance.receipt(context,req.params.payment),area:req.area,formatMoney});
    });
    routes.get('/workspace/:area/collections',async(req,res)=>{
        if(!isFinance(req.area))return res.sendStatus(404);
        const context=await access.resolve(cookie(req,req.cookieName));
        if(req.query.format!==undefined&&req.query.format!=='csv')return res.sendStatus(422);
        try{
            const report=await finance.collections(context,{from:req.query.from??today(),to:req.query.to??today(),method:req.query.method,operator:req.query.operator});
            if(req.query.format==='csv')return res.set({'Content-Type':'text/csv; charset=utf-8',
                'Content-Disposition':`attachment; filename="practice-collections-${report.from}-${report.to}.csv"`}).send(financeCollectionsCsv(report));
            res.render('finance-collections',{...report,area:req.area,formatMoney,
                exportQuery:new URLSearchParams({from:report.from,to:report.to,method:report.method,operator:report.operator||'',format:'csv'}).toString()});
        }catch(error){if(![404,422].includes(error.statusCode))throw error;
            res.status(error.statusCode).render('inventory-error',{message:error.message,area:req.area});}
    });
    routes.get('/workspace/:area/statements',async(req,res)=>{
        if(!isFinance(req.area))return res.sendStatus(404);
        const context=await access.resolve(cookie(req,req.cookieName));
        if(req.query.format!==undefined&&req.query.format!=='csv')return res.sendStatus(422);
        try{
            const statement=await finance.pupilStatement(context,{pupil:req.query.pupil,year:req.query.year,search:req.query.search});
            if(req.query.format==='csv'){
                if(!statement.pupil)return res.status(422).render('inventory-error',{message:'Select a pupil before downloading a statement.',area:req.area});
                return res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="practice-statement-${statement.pupil.id}.csv"`}).send(financeStatementCsv(statement));
            }
            res.render('finance-statement',{...statement,area:req.area,formatMoney,
                exportQuery:new URLSearchParams({pupil:statement.pupil?.id||'',year:statement.yearId||'',format:'csv'}).toString()});
        }catch(error){if(![404,422].includes(error.statusCode))throw error;
            res.status(error.statusCode).render('inventory-error',{message:error.message,area:req.area});}
    });
    routes.post('/workspace/:area/bulk/:step',async(req,res)=>{
        if(!isFinance(req.area)||!['review','confirm'].includes(req.params.step))return res.sendStatus(404);
        const session=cookie(req,req.cookieName),context=await access.resolve(session);
        if(!await identity.validateCsrf(session,req.body.csrf))return res.sendStatus(403);
        try{
            const result=req.params.step==='review'?await finance.reviewBulk(context,req.body):await finance.confirmBulk(context,req.body.review);
            res.render('finance-bulk',{result,confirmed:req.params.step==='confirm',area:req.area,formatMoney,csrf:cookie(req,req.cookieName+'_csrf')});
        }catch(error){if(![404,409,422].includes(error.statusCode))throw error;
            res.status(error.statusCode).render('inventory-error',{message:error.message,area:req.area});}
    });
    return createApp({logging:false,requestContext:(_req,res,next)=>{
        res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});next();
    },routes:[['/',routes]]});
}
async function main(){
    loadTestEnvironment();const db=createDatabase();
    try{
        const {school,accounts}=await prepareInventorySample(db,'ATT_SAMPLE_PRACTICE');
        accounts.finance=await prepareFinanceSample(db,school);
        accounts.cashier=await prepareFinanceSample(db,school,'bursar');
        const dir=path.join(__dirname,'../backups/runtime/tls');
        const server=https.createServer({key:fs.readFileSync(path.join(dir,'localhost.key')),cert:fs.readFileSync(path.join(dir,'localhost.crt'))},createPracticeApp(db,accounts));
        await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(2030,'127.0.0.1',resolve);});
        console.log('School feature menu ready at '+origin);
    }catch(error){await db.close();throw error;}
}
if(require.main===module)main().catch(error=>{console.error(error.code||error.message);process.exitCode=1;});
module.exports={createPracticeApp};
