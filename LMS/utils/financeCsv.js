const {academicCsv}=require('./academicCsv');
function financeCollectionsCsv(report){
 return academicCsv(['Practice records','School','From payment date','To payment date','Generated at UTC','Receipt','Payment date','Pupil','Matricule','Academic year','Fee','Method','Reference','Recorded by','Recorded XAF','Reversed XAF','Current net XAF','Current status','Reversal reason','Recorded at UTC','Reversed at UTC'],
  report.rows.map(r=>['Fictional payments',report.school.name,report.from,report.to,report.generatedAt.toISOString(),r.receiptNumber,r.paidOn,r.pupil,r.matricule,r.year,r.description,r.method,r.reference,r.recordedBy,
   r.amount,r.reversed?r.amount:'0',r.reversed?'0':r.amount,r.reversed?'Reversed':'Recorded',r.reversed||'',r.recordedAt.toISOString(),r.reversedAt?.toISOString()||'']));
}
function financeStatementCsv(report){
 const shared=['Fictional records',report.school.name,report.pupil.name,report.pupil.matricule,report.yearId?report.years.find(y=>y.id===report.yearId).name:'All academic years',report.generatedAt.toISOString()];
 return academicCsv(['Practice records','School','Pupil','Matricule','Year selection','Generated at UTC','Entry type','Record','Charge ID','Academic year','Fee / reference','Due date / payment date','Original XAF','Active charge XAF','Current payment XAF','Outstanding XAF','Current status / reason'],[
  ...report.charges.map(c=>[...shared,'Charge',c.id,c.id,c.year,c.description,c.dueDate||'',c.amount,c.cancelled?'0':c.amount,'',c.cancelled?'0':c.balance,c.cancelled?'Cancelled: '+c.cancelled:'Active']),
  ...report.payments.map(p=>[...shared,'Payment',p.receiptNumber,p.charge_id,'',p.reference,p.paidOn,p.amount,'',p.reversed?'0':p.amount,'',p.reversed?'Reversed: '+p.reversed:'Recorded']),
  [...shared,'TOTAL','Current totals','','','','','',report.totals.charged.toString(),report.totals.paid.toString(),report.totals.balance.toString(),'Based only on recorded charges and current corrections']
 ]);
}
module.exports={financeCollectionsCsv,financeStatementCsv};
