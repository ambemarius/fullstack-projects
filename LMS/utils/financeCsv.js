const {academicCsv}=require('./academicCsv');
const METHOD_LABELS={cash:'Cash',bank:'Bank transfer',mobile:'Mobile money',other:'Other'};
// practice:true keeps the "fictional records" marker used by the practice workspace.
// Rows come as `student` from the main app and `pupil` from the practice workspace's service.
function financeCollectionsCsv(report,{practice=true}={}){
 const marker=practice?'Fictional payments':'School records';
 return academicCsv([practice?'Practice records':'Records','School','From payment date','To payment date','Generated at UTC','Receipt','Payment date','Student','Matricule','Academic year','Fee','Method','Reference','Recorded by','Recorded XAF','Reversed XAF','Current net XAF','Current status','Reversal reason','Recorded at UTC','Reversed at UTC'],
  report.rows.map(r=>[marker,report.school.name,report.from,report.to,report.generatedAt.toISOString(),r.receiptNumber,r.paidOn,r.student??r.pupil,r.matricule,r.year,r.description,METHOD_LABELS[r.method]||r.method,r.reference,r.recordedBy,
   r.amount,r.reversed?r.amount:'0',r.reversed?'0':r.amount,r.reversed?'Reversed':'Recorded',r.reversed||'',r.recordedAt.toISOString(),r.reversedAt?.toISOString()||'']));
}
function financeStatementCsv(report,{practice=true}={}){
 const person=report.student??report.pupil;
 const shared=[practice?'Fictional records':'School records',report.school.name,person.name,person.matricule,report.yearId?report.years.find(y=>y.id===report.yearId).name:'All academic years',report.generatedAt.toISOString()];
 return academicCsv([practice?'Practice records':'Records','School','Student','Matricule','Year selection','Generated at UTC','Entry type','Record','Charge ID','Academic year','Fee / reference','Due date / payment date','Original XAF','Active charge XAF','Current payment XAF','Outstanding XAF','Current status / reason'],[
  ...report.charges.map(c=>[...shared,'Charge',c.id,c.id,c.year,c.description,c.dueDate||'',c.amount,c.cancelled?'0':c.amount,'',c.cancelled?'0':c.balance,c.cancelled?'Cancelled: '+c.cancelled:'Active']),
  ...report.payments.map(p=>[...shared,'Payment',p.receiptNumber,p.charge_id,'',p.reference,p.paidOn,p.amount,'',p.reversed?'0':p.amount,'',p.reversed?'Reversed: '+p.reversed:'Recorded']),
  [...shared,'TOTAL','Current totals','','','','','',report.totals.charged.toString(),report.totals.paid.toString(),report.totals.balance.toString(),'Based only on recorded charges and current corrections']
 ]);
}
module.exports={financeCollectionsCsv,financeStatementCsv};
// Outstanding balances: one row per class (whole school) or per student (one class). Amounts in XAF.
function financeOutstandingCsv(report){
 const year=report.years.find(y=>y.id===report.yearId)?.name||'';
 const STATUS={paid:'Paid in full',partial:'Partly paid',unpaid:'Not paid',none:'No charges'};
 if(!report.classId){
  return academicCsv(['School','Academic year','As of','Class','Students','Paid in full','Partly paid','Not paid','No charges','Charged XAF','Paid XAF','Outstanding XAF','Overdue XAF','Collected %'],
   [...report.summary.map(c=>[report.school.name,year,report.asOf,c.label,c.students,c.fullyPaid,c.partlyPaid,c.notPaid,c.noCharges,c.charged.toString(),c.collected.toString(),c.balance.toString(),c.overdue.toString(),c.charged>0n?(Number(c.collected*1000n/c.charged)/10).toFixed(1):'']),
    [report.school.name,year,report.asOf,'WHOLE SCHOOL',report.totals.students,report.totals.fullyPaid,report.totals.partlyPaid,report.totals.notPaid,report.totals.noCharges,report.totals.charged.toString(),report.totals.collected.toString(),report.totals.balance.toString(),report.totals.overdue.toString(),report.totals.charged>0n?(Number(report.totals.collected*1000n/report.totals.charged)/10).toFixed(1):'']]);
 }
 const cls=report.classes.find(c=>c.id===report.classId)?.label||'';
 return academicCsv(['School','Academic year','As of','Class','Student','Matricule','Parent / guardian','Parent phone','Charged XAF','Paid XAF','Outstanding XAF','Overdue XAF','Last payment','Status'],
  report.students.map(s=>[report.school.name,year,report.asOf,cls,s.name,s.matricule,s.parentName||'',s.parentPhone||'',s.charged,s.paid,s.balance,s.overdue,s.lastPaid||'',STATUS[s.status]]));
}
module.exports.financeOutstandingCsv=financeOutstandingCsv;
