const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {validatePersonnel}=require('../model/identity/personnelService');
const {recordEnrolmentInTransaction}=require('../model/identity/enrolmentLedgerService');
test('ledger registration requires explicit dates and provenance only in the enabled workflow',async()=>{
    const pupil={firstName:'Synthetic',lastName:'Pupil',matricule:'TEST',section:'Anglophone',sex:'Male',password:'synthetic-password-only'};
    const placement={classId:1,yearId:2,fromDate:'2024-09-01',sourceReference:'Register page 1',reason:'Verified admission'};
    assert.equal(validatePersonnel('student',{...pupil,placement},{registration:true,enrolmentLedger:true}).matricule,'TEST');
    assert.throws(()=>validatePersonnel('student',{...pupil,placement},{registration:true}),/placement/);
    assert.throws(()=>validatePersonnel('student',pupil,{registration:true,enrolmentLedger:true}),/initial enrolment/);
    for(const change of [{fromDate:'2024-02-30'},{fromDate:undefined},{sourceReference:''},{reason:''},{toDate:null},{status:'enrolled'},{schoolId:4}])
        assert.throws(()=>validatePersonnel('student',{...pupil,placement:{...placement,...change}},{registration:true,enrolmentLedger:true}));
    await assert.rejects(recordEnrolmentInTransaction(()=>({parent:{}}),{...placement,studentId:1,toDate:null,status:'enrolled'}),/serializable transaction/);
});
function browserFixture(transfers=false,lifecycle=false,sourceReview=false){
    const elements=new Map(),pending=[];
    function element(){return {value:'',hidden:false,textContent:'',children:[],selectedOptions:[],append(...rows){this.children.push(...rows);},replaceChildren(...rows){this.children=rows;},setAttribute(){},focus(){this.focused=true;},scrollIntoView(){},reset(){}};}
    const document={body:{dataset:{enrolmentLedger:'true'}},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,querySelectorAll:()=>[]};
    document.querySelector=selector=>({'#transferForm':transfers,'#pupilStatusForm':lifecycle,'#sourceReview':sourceReview,'#placementReview':sourceReview})[selector]?document.getElementById(selector.slice(1)):null;
    const context=vm.createContext({document,URLSearchParams,fetch:(path,options)=>new Promise(resolve=>pending.push({path,options,resolve}))});
    const source=fs.readFileSync(require.resolve('../public/js/m1-original-registration.js'),'utf8');
    vm.runInContext(source.slice(0,source.indexOf('\nfor(const kind of'))+'\nglobalThis.subject={loadPlacementReview,clearPlacementReview,openSourceReview,showEnrolmentHistory,clearHistory,lockout,model,submit,offerTransfer,submitTransfer,offerPupilStatus,submitPupilStatus,reviewReturnCourses};',context);
    return {elements,document,pending,context,subject:context.subject};
}
const response=(data,status=200)=>({status,ok:status===200,json:async()=>data});
test('placement review pages in current-year scope and discards results after closing',async()=>{
    const {subject:s,pending,elements}=browserFixture(false,false,true);
    s.model.years=[{id:2,isCurrent:true}];elements.get('placementReview').open=true;
    const first=s.loadPlacementReview();
    assert.equal(pending[0].path,'/api/academic-history/placement-review?yearId=2');
    pending[0].resolve(response({data:{yearName:'Current',pupils:[{id:7,firstName:'Sample'}],nextAfterStudentId:7}}));
    await first;assert.equal(elements.get('placementReviewNext').hidden,false);
    const next=elements.get('placementReviewNext').onclick();
    assert.equal(pending[1].path,'/api/academic-history/placement-review?yearId=2&afterStudentId=7');
    s.clearPlacementReview();pending[1].resolve(response({data:{yearName:'Other',pupils:[],nextAfterStudentId:null}}));await next;
    assert.equal(elements.get('placementReviewMessage').textContent,'');assert.equal(elements.get('placementReviewRows').children.length,0);
});
test('registration reviews year evidence for the selected person and discards superseded responses',async()=>{
    const {subject:s,pending,elements}=browserFixture(false,false,true);
    s.model.years=[{id:1,name:'Year',isCurrent:true}];s.model.classes=[{id:3,name:'Form 3'}];
    const row={id:4,firstName:'Sample',lastName:'Person'};
    const old=s.openSourceReview('teacher',row,{});
    assert.equal(pending[0].path,'/api/academic-history/teachers/4?yearId=1');
    const current=s.openSourceReview('student',row,{});
    pending[1].resolve(response({data:{yearMembershipRecorded:true,placement:{candidateClassIds:[3]},subjectLinks:[],scoreReferences:[]}}));await current;
    const box=elements.get('sourceReviewResults');
    assert.match(box.children.map(n=>n.textContent).join(' '),/Form 3/);
    pending[0].resolve(response({data:{yearName:'Wrong',assignments:[],unresolvedYearAssignments:[]}}));await old;
    assert.doesNotMatch(box.children.map(n=>n.textContent).join(' '),/Wrong/);
    const teacher=s.openSourceReview('teacher',row,{});
    pending[2].resolve(response({data:{yearName:'2025',assignments:[],unresolvedYearAssignments:[]}}));await teacher;
    assert.match(box.children.map(n=>n.textContent).join(' '),/Assignments for 2025.*Assignments with no recorded year/);
});
test('pupil status form submits each dated action using the reviewed local placement and clears school drafts',async()=>{
    for(const returning of [false,true]){
        const f=browserFixture(true,true),s=f.subject,m=s.model;
        m.csrf='test-csrf';m.years=[{id:9,isCurrent:true,name:'Current year'}];
        m.classes=[{id:12,section:'Anglophone',name:'Form 2'},{id:13,section:'Francophone',name:'Other'}];
        const row={id:7,version:3,section:'Anglophone',isWithdrawn:returning};
        const source={id:8,version:2,isLatest:true,status:returning?'withdrawn':'enrolled',toDate:returning?'2025-02-01':null};
        s.clearHistory();s.offerPupilStatus(row,[]);assert.equal(m.statusDraft,null);
        s.offerPupilStatus(row,[source]);assert.equal(f.elements.get('returnClassLabel').hidden,!returning);
        for(const [id,v] of Object.entries({returnClass:'12',statusDate:'2025-03-01',statusReason:'Reviewed register',statusSource:' Register 6 '}))
            f.document.getElementById(id).value=v;
        vm.runInContext('load=async()=>{};',f.context);
        if(returning){
            await assert.rejects(s.submitPupilStatus(),/Review the subjects/);
            const review=s.reviewReturnCourses();f.pending[0].resolve(response({data:[{id:17,version:2,name:'Geometry'}]}));await review;
            await assert.rejects(s.submitPupilStatus(),/Review the subjects/);
            f.document.getElementById('confirmReturnCourses').checked=true;
        }
        const submit=s.submitPupilStatus(),req=f.pending.at(-1);
        assert.equal(req.path,'/api/pupil-placements/8/'+(returning?'returns':'withdrawals'));
        assert.equal(req.options.headers['X-CSRF-Token'],'test-csrf');
        assert.deepEqual(JSON.parse(req.options.body),{version:2,profileVersion:3,onDate:'2025-03-01',reason:'Reviewed register',sourceReference:'Register 6',
            ...(returning?{classId:12,yearId:9,reviewedCourses:[{id:17,version:2}]}:{})});
        if(returning){m.epoch++;s.clearHistory();}
        req.resolve(response({data:{pupil:{id:7,version:4}}}));await submit;
        assert.equal(f.elements.get('workspaceMessage')?.textContent,returning?undefined:'Withdrawal recorded.');
        assert.equal(m.statusDraft,null);assert.equal(f.elements.get('pupilStatusPanel').hidden,true);
    }
});
test('transfer form offers eligible destinations and uses the reviewed revisions; a conflict clears the draft without a retry',async()=>{
    const f=browserFixture(true),s=f.subject,m=s.model;
    m.csrf='synthetic';m.years=[{id:2,name:'Current year',isCurrent:true}];
    m.classes=[{id:3,name:'Form 1',section:'Anglophone'},{id:4,name:'Form 2',section:'Anglophone'},{id:5,name:'Other section',section:'Francophone'}];
    const row={id:7,version:8,section:'Anglophone'},current={id:10,version:2,status:'enrolled',isLatest:true,toDate:null,classId:3,yearId:2};
    s.clearHistory();s.offerTransfer(row,[]);assert.equal(m.transfer,null);
    s.offerTransfer(row,[current,current]);assert.equal(m.transfer,null);
    s.offerTransfer({...row,isWithdrawn:true},[current]);assert.equal(m.transfer,null);
    s.offerTransfer(row,[current]);
    assert.deepEqual(f.elements.get('transferClass').children.map(c=>c.textContent),['-- select --','Form 2']);
    for(const[id,v]of Object.entries({transferClass:'4',transferSource:'  Register 2 ',transferReason:'Verified transfer',transferDate:'2025-01-01'}))f.document.getElementById(id).value=v;
    vm.runInContext('load=async()=>{};',f.context);
    const submitted=s.submitTransfer();assert.equal(f.pending[0].path,'/api/pupil-placements/10/transfers');
    assert.equal(f.pending[0].options.headers['X-CSRF-Token'],'synthetic');
    assert.deepEqual(JSON.parse(f.pending[0].options.body),{version:2,profileVersion:8,yearId:2,classId:4,onDate:'2025-01-01',sourceReference:'Register 2',reason:'Verified transfer'});
    f.pending[0].resolve(response({message:'Current placement requires review'},409));await assert.rejects(submitted,/Reopen/);
    assert.equal(m.transfer,null);assert.equal(f.elements.get('transferPanel').hidden,true);assert.equal(f.pending.length,1);
});
test('registration UI submits the explicit enrolment with the original pupil fields in one request',async()=>{
    const f=browserFixture();
    for(const[id,value]of Object.entries({sFirstName:'Synthetic',sLastName:'Pupil',sMatricule:'M2_TEST',sSex:'Male',sSection:'Anglophone',sAcademicYear:'2',sClass:'3',sPassword:'synthetic-test-only',sEnrolmentFrom:'2024-09-01',sEnrolmentSource:'Register page 1',sEnrolmentReason:'Verified admission'}))f.document.getElementById(id).value=value;
    f.subject.model.csrf='test-csrf';vm.runInContext('reset=()=>{};load=async()=>{};',f.context);
    const submitted=f.subject.submit('student');assert.equal(f.pending.length,1);
    assert.equal(f.pending[0].path,'/api/personnel/students');assert.equal(f.pending[0].options.headers['X-CSRF-Token'],'test-csrf');
    const body=JSON.parse(f.pending[0].options.body);assert.deepEqual(body.placement,{yearId:2,classId:3,fromDate:'2024-09-01',sourceReference:'Register page 1',reason:'Verified admission'});
    assert.equal(body.firstName,'Synthetic');assert.equal(body.schoolId,undefined);
    f.pending[0].resolve(response({data:{id:4,enrolment:{id:5,version:1}}}));await submitted;
    assert.equal(f.elements.get('workspaceMessage').textContent,'Registration completed.');
});
test('successful transfer refreshes the displayed pupil and a changed school ignores an old success response',async()=>{
    for(const switched of [false,true]){
        const f=browserFixture(true),m=f.subject.model;
        m.transfer={pupilId:7,profileVersion:3,root:11,version:2,yearId:1,epoch:m.epoch};
        f.context.refreshed=[];m.rows.student=[{id:7,version:4}];
        vm.runInContext('load=async kind=>refreshed.push(kind);showEnrolmentHistory=async row=>refreshed.push(row.version);',f.context);
        const submit=f.subject.submitTransfer();if(switched){m.epoch++;f.subject.clearHistory();}
        f.pending[0].resolve(response({data:{pupil:{id:7,version:4}}}));await submit;
        assert.deepEqual(f.context.refreshed,switched?[]:['student',4]);
        assert.equal(f.elements.get('workspaceMessage')?.textContent,switched?undefined:'Transfer recorded.');
    }
});
test('history UI clears private evidence immediately and ignores a response after school context changes',async()=>{
    const f=browserFixture();f.document.getElementById('enrolmentHistoryBody').append('OLD_PRIVATE_ROW');
    const load=f.subject.showEnrolmentHistory({id:7,firstName:'Synthetic',lastName:'Pupil'});
    assert.equal(f.elements.get('enrolmentHistoryBody').children.length,0);assert.equal(f.elements.get('enrolmentHistory').hidden,true);
    f.subject.model.epoch++;f.pending[0].resolve(response({data:[{sourceReference:'Old school evidence'}]}));await load;
    assert.equal(f.elements.get('enrolmentHistoryBody').children.length,0);assert.equal(f.elements.get('enrolmentHistory').hidden,true);
});
test('history UI renders source text safely and distinguishes missing history from an empty cohort',async()=>{
    const f=browserFixture(),load=f.subject.showEnrolmentHistory({id:7,firstName:'Synthetic',lastName:'Pupil'});
    f.pending[0].resolve(response({data:[{id:4,version:1,isLatest:true,classId:1,yearId:2,fromDate:'2024-09-01',toDate:null,status:'enrolled',sourceReference:'<script>bad()</script>',reason:'Verified'}]}));await load;
    const cells=f.elements.get('enrolmentHistoryBody').children[0].children;
    assert.equal(cells[5].textContent,'<script>bad()</script> — Verified');assert.equal(cells[5].innerHTML,undefined);
    assert.equal(f.elements.get('enrolmentHistoryTitle').focused,true);
    const empty=f.subject.showEnrolmentHistory({id:8});f.pending[1].resolve(response({data:[]}));await empty;
    assert.match(f.elements.get('enrolmentCoverage').textContent,/does not mean/);
    const denied=f.subject.showEnrolmentHistory({id:8});f.pending[2].resolve(response({message:'Access denied'},403));await assert.rejects(denied,/Access denied/);
    assert.equal(f.elements.get('enrolmentHistory').hidden,true);assert.equal(f.elements.get('enrolmentHistoryBody').children.length,0);
});
