const {sql}=require('../../config/database');
const {authoritySql}=require('./schoolAccess');
const roles={library:'librarian',laboratory:'lab_attendant',requests:'teacher'};
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
function text(value,max,optional=false){
    if(typeof value!=='string'||(!optional&&!value.trim())||value.length>max)throw fail(422,'Check the text fields and their lengths.');
    return value.trim();
}
function number(value){
    if(!/^\d{1,9}(\.\d{1,3})?$/.test(String(value)))throw fail(422,'Enter a non-negative quantity with up to three decimal places.');
    return Number(value);
}
function id(value){
    if(!/^[1-9]\d{0,9}$/.test(String(value))||Number(value)>2147483647)throw fail(422,'Choose a record.');
    return Number(value);
}
function date(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'0001-01-01'||Number.isNaN(Date.parse(value))||
        new Date(value).toISOString().slice(0,10)!==value)throw fail(422,'Enter a valid date.');
    return value;
}
function choice(value,allowed){
    if(!allowed.includes(value))throw fail(422,'Choose one of the available options.');
    return value;
}
function createInventoryService(db,access){
    async function scoped(context,area,work,operation){
        const role=Object.hasOwn(roles,area)?roles[area]:null;
        if(!role)throw fail(404,'Area not found.');
        const identity=await access.authorize(context,[role]);
        await db.connect();
        const tx=new sql.Transaction(db.getPool());
        await tx.begin(operation?sql.ISOLATION_LEVEL.SERIALIZABLE:sql.ISOLATION_LEVEL.REPEATABLE_READ);
        function query(statement,params={}){
            const req=new sql.Request(tx);
            req.input('school',sql.Int,identity.schoolId).input('actor',sql.Int,identity.membershipId);
            for(const [name,[type,value]] of Object.entries(params))req.input(name,type,value);
            return req.query(statement);
        }
        try{
            const auth=await query('SELECT 1 ok WHERE '+authoritySql,{
                account:[sql.Int,identity.accountId],membership:[sql.Int,identity.membershipId],session_hash:[sql.Char(64),identity.tokenHash],
                role_one:[sql.VarChar(30),role],role_two:[sql.VarChar(30),null]});
            if(!auth.recordset.length)throw fail(403,'Access denied');
            if(operation){
                if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(operation))throw fail(422,'Reopen the form before saving.');
                await query('INSERT dbo.inventory_operations VALUES(@school,@actor,@op)',{op:[sql.UniqueIdentifier,operation]});
            }
            const result=await work(query);await tx.commit();return result;
        }catch(error){
            await tx.rollback().catch(()=>{});
            if([2601,2627,1205].includes(error.number))throw fail(409,'This record changed or already exists. Reopen it to check its status.');
            throw error;
        }
    }
    const libraryRows=`SELECT c.*,COALESCE(e.id,0) version,e.action,e.pupil_id,e.staff_id,CONVERT(char(10),e.due_date,23) due,
        COALESCE(p.firstName+' '+p.lastName,a.login_key) borrower
        FROM dbo.library_copies c OUTER APPLY(SELECT TOP(1) * FROM dbo.library_events x
            WHERE x.school_id=c.school_id AND x.copy_id=c.id ORDER BY x.id DESC)e
        LEFT JOIN dbo.students p ON p.school_id=c.school_id AND p.id=e.pupil_id
        LEFT JOIN dbo.school_memberships sm ON sm.school_id=c.school_id AND sm.id=e.staff_id
        LEFT JOIN dbo.accounts a ON a.id=sm.account_id WHERE c.school_id=@school
            AND (@search='' OR CHARINDEX(@search,CONCAT(c.title,' ',c.author,' ',c.accession,' ',c.isbn,' ',c.shelf,' ',p.firstName,' ',p.lastName,' ',a.login_key))>0)
        ORDER BY c.title,c.accession`;
    async function list(context,area,search=''){
        search=text(search,120,true);
        return scoped(context,area,async query=>{
            if(area==='library'){
                const sets=(await query(libraryRows+`;
                    SELECT id,firstName+' '+lastName+' · '+matricule label FROM dbo.students WHERE school_id=@school AND isWithdrawn=0 ORDER BY lastName,firstName;
                    SELECT DISTINCT m.id,a.login_key label FROM dbo.school_memberships m JOIN dbo.accounts a ON a.id=m.account_id
                    JOIN dbo.membership_roles r ON r.school_id=m.school_id AND r.membership_id=m.id
                    WHERE m.school_id=@school AND m.status='active' AND a.status='active' AND r.role IN ('teacher','librarian','lab_attendant','discipline_master','admin');
                    SELECT TOP(50) c.accession,e.action,e.occurred_at FROM dbo.library_events e JOIN dbo.library_copies c ON c.school_id=e.school_id AND c.id=e.copy_id
                    WHERE e.school_id=@school ORDER BY e.id DESC;`,{search:[sql.NVarChar(120),search]})).recordsets;
                return {copies:sets[0],pupils:sets[1],staff:sets[2],history:sets[3]};
            }
            const teacher=area==='requests';
            const sets=(await query(`SELECT i.*,CONVERT(char(10),i.expiry,23) expiryDate,COALESCE(b.balance,0) available
                FROM dbo.lab_items i OUTER APPLY(SELECT SUM(delta) balance FROM dbo.lab_movements m WHERE m.school_id=i.school_id AND m.item_id=i.id)b
                WHERE i.school_id=@school ${teacher?'AND i.restricted=0':''} ORDER BY i.name;
                SELECT r.id,r.status,r.quantity,r.purpose,CONVERT(char(10),r.needed_on,23) needed,i.name,i.unit,i.kind,a.login_key requester
                FROM dbo.lab_requests r JOIN dbo.lab_items i ON i.school_id=r.school_id AND i.id=r.item_id
                JOIN dbo.school_memberships sm ON sm.school_id=r.school_id AND sm.id=r.requested_by JOIN dbo.accounts a ON a.id=sm.account_id
                WHERE r.school_id=@school ${teacher?'AND r.requested_by=@actor':''} ORDER BY r.id DESC;
                SELECT TOP(50) i.name,i.unit,m.action,m.delta,m.request_id AS requestId,m.occurred_at AS occurredAt,a.login_key AS editor
                FROM dbo.lab_movements m
                JOIN dbo.lab_items i ON i.school_id=m.school_id AND i.id=m.item_id
                JOIN dbo.school_memberships sm ON sm.school_id=m.school_id AND sm.id=m.actor_id
                JOIN dbo.accounts a ON a.id=sm.account_id
                WHERE m.school_id=@school ${teacher?'AND 1=0':''} ORDER BY m.id DESC;`)).recordsets;
            return {items:sets[0],requests:sets[1],movements:sets[2]};
        });
    }
    async function library(query,b,today){
        if(b.action==='add'){
            return query('INSERT dbo.library_copies(school_id,accession,title,author,shelf,isbn) VALUES(@school,@acc,@title,@author,@shelf,@isbn)',{
                acc:[sql.NVarChar(60),text(b.accession,60)],title:[sql.NVarChar(160),text(b.title,160)],author:[sql.NVarChar(120),text(b.author,120)],
                shelf:[sql.NVarChar(80),text(b.shelf,80)],isbn:[sql.NVarChar(30),text(b.isbn||'',30,true)||null]});
        }
        const copy=[sql.Int,id(b.copy)];
        const state=(await query(`SELECT c.id,COALESCE(e.id,0) version,e.action,e.pupil_id,e.staff_id,CONVERT(char(10),e.due_date,23) due FROM dbo.library_copies c WITH(UPDLOCK)
            OUTER APPLY(SELECT TOP(1) * FROM dbo.library_events l WHERE l.school_id=c.school_id AND l.copy_id=c.id ORDER BY id DESC)e
            WHERE c.school_id=@school AND c.id=@copy`,{copy})).recordset[0];
        if(!state)throw fail(404,'Copy not found.');
        if(!/^(0|[1-9]\d*)$/.test(String(b.version))||String(state.version)!==String(b.version))
            throw fail(409,'This copy changed. Reopen its latest record.');
        const loan=['checkout','renew'].includes(state.action),unavailable=['lost','damaged'].includes(state.action);
        let pupil=state.pupil_id,staff=state.staff_id,due=null;
        switch(b.action){
        case 'checkout':{
            if(loan||unavailable)throw fail(409,'This copy is unavailable.');
            const match=/^(pupil|staff):([1-9]\d*)$/.exec(b.borrower);
            if(!match)throw fail(422,'Choose a borrower.');
            const borrower=[sql.Int,id(match[2])];
            const eligible=match[1]==='pupil'?'SELECT id FROM dbo.students WHERE id=@b AND school_id=@school AND isWithdrawn=0':
                `SELECT m.id FROM dbo.school_memberships m JOIN dbo.accounts a ON a.id=m.account_id JOIN dbo.membership_roles r ON r.membership_id=m.id AND r.school_id=m.school_id
                WHERE m.id=@b AND m.school_id=@school AND m.status='active' AND a.status='active' AND r.role IN ('teacher','librarian','lab_attendant','discipline_master','admin')`;
            if(!(await query(eligible,{b:borrower})).recordset.length)throw fail(404,'Borrower not found.');
            pupil=match[1]==='pupil'?borrower[1]:null;staff=pupil?null:borrower[1];
            due=date(b.due);if(due<today)throw fail(422,'Choose today or a later due date.');break;
        }
        case 'renew':
            if(!loan)throw fail(409,'There is no active loan.');
            due=date(b.due);if(due<=state.due||due<today)throw fail(422,'Choose a later due date.');break;
        case 'return':if(!loan)throw fail(409,'There is no active loan.');break;
        case 'lost':case 'damaged':if(unavailable)throw fail(409,'This copy already needs review.');break;
        case 'repair':if(!unavailable)throw fail(409,'This copy is already in circulation.');pupil=null;staff=null;break;
        default:throw fail(422,'Unknown library action.');
        }
        return query('INSERT dbo.library_events(school_id,copy_id,action,pupil_id,staff_id,due_date,actor_id) VALUES(@school,@copy,@action,@p,@s,@due,@actor)',
            {copy,action:[sql.VarChar(12),b.action],p:[sql.Int,pupil],s:[sql.Int,staff],due:[sql.Date,due]});
    }
    async function lab(query,area,b,today){
        const teacher=area==='requests';
        if(teacher!==(b.action==='request'))throw fail(403,'Access denied');
        if(b.action==='add'){
            const kind=choice(b.kind,['equipment','consumable','reagent']);
            return query(`INSERT dbo.lab_items(school_id,name,category,kind,unit,location,batch,minimum,expiry,restricted)
            VALUES(@school,@name,@category,@kind,@unit,@location,@batch,@min,@expiry,@restricted)`,{
                name:[sql.NVarChar(120),text(b.name,120)],category:[sql.NVarChar(60),text(b.category,60)],kind:[sql.VarChar(12),kind],
                unit:[sql.NVarChar(30),text(b.unit,30)],location:[sql.NVarChar(80),text(b.location,80)],batch:[sql.NVarChar(60),text(b.batch||'',60,true)],
                min:[sql.Decimal(12,3),number(b.minimum)],expiry:[sql.Date,b.expiry?date(b.expiry):null],restricted:[sql.Bit,b.restricted==='on']});
        }
        let request=null;
        if(!['receive','request'].includes(b.action)){
            request=(await query('SELECT * FROM dbo.lab_requests WITH(UPDLOCK) WHERE school_id=@school AND id=@id',{id:[sql.Int,id(b.request)]})).recordset[0];
            if(!request)throw fail(404,'Request not found.');
        }
        const item=[sql.Int,request?request.item_id:id(b.item)];
        const stock=(await query(`SELECT i.kind,i.restricted,CONVERT(char(10),i.expiry,23) expiry,
            (SELECT COALESCE(SUM(delta),0) FROM dbo.lab_movements m WHERE m.school_id=i.school_id AND m.item_id=i.id) balance
            FROM dbo.lab_items i WITH(UPDLOCK) WHERE i.school_id=@school AND i.id=@item`,{item})).recordset[0];
        if(!stock||(teacher&&stock.restricted))throw fail(404,'Item not found.');
        const quantity=request?request.quantity:number(b.quantity);
        if(quantity<=0||(stock.kind==='equipment'&&!Number.isInteger(quantity)))throw fail(422,'Enter a positive quantity. Equipment uses whole units.');
        if(['request','approve','issue'].includes(b.action)&&(stock.restricted||(stock.expiry&&stock.expiry<today)))throw fail(409,'This stock is restricted or expired.');
        if(teacher){
            const needed=date(b.needed);
            if(needed<today||(stock.expiry&&stock.expiry<needed))throw fail(422,'Choose a current date within the stock expiry.');
            return query(`INSERT dbo.lab_requests(school_id,item_id,requested_by,quantity,purpose,needed_on)
                VALUES(@school,@item,@actor,@qty,@purpose,@needed)`,{item,qty:[sql.Decimal(12,3),quantity],purpose:[sql.NVarChar(200),text(b.purpose,200)],needed:[sql.Date,needed]});
        }
        let delta=quantity;
        if(request){
            const steps={approve:['pending','approved'],decline:['pending','declined'],issue:['approved','issued'],
                return:['issued','returned'],damage:['issued','damaged'],consume:['issued','consumed']};
            const step=Object.hasOwn(steps,b.action)&&steps[b.action];
            if(!step||request.status!==step[0])throw fail(409,'This action does not match the request status.');
            if(b.action==='consume'&&stock.kind==='equipment')throw fail(422,'Return equipment or record damage.');
            if(b.action==='issue'&&stock.balance<quantity)throw fail(409,'Available stock is insufficient.');
            delta=b.action==='issue'?-quantity:b.action==='return'?quantity:0;
            await query('UPDATE dbo.lab_requests SET status=@status WHERE school_id=@school AND id=@id',{status:[sql.VarChar(12),step[1]],id:[sql.Int,request.id]});
        }
        return query('INSERT dbo.lab_movements(school_id,item_id,request_id,action,delta,actor_id) VALUES(@school,@item,@id,@action,@delta,@actor)',
            {item,id:[sql.Int,request?.id??null],action:[sql.VarChar(12),b.action],delta:[sql.Decimal(12,3),delta]});
    }
    async function save(context,area,body){
        if(!body||typeof body.operation!=='string'||!body.operation)throw fail(422,'Reopen the form before saving.');
        const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Douala',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        await scoped(context,area,query=>area==='library'?library(query,body,today):lab(query,area,body,today),body.operation);
    }
    return {list,save};
}
module.exports={createInventoryService,roles};
