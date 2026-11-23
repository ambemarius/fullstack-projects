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
