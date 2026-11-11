const {authoritySql}=require('./schoolAccess');
const teachingScopeSql=`${authoritySql} AND EXISTS(SELECT 1 FROM dbo.class_subjects o WHERE o.id=@offering AND o.school_id=@school)
    AND EXISTS(SELECT 1 FROM dbo.academic_years y WHERE y.id=@year AND y.school_id=@school)
    AND (@role_one='admin' OR EXISTS(SELECT 1 FROM dbo.legacy_account_map l JOIN dbo.teachers t ON t.id=l.legacy_id AND t.school_id=l.school_id AND t.status='active'
        JOIN dbo.class_subject_teachers a ON a.teacher_id=t.id AND a.school_id=t.school_id
        WHERE l.source_table='teachers' AND l.account_id=@account AND l.membership_id=@membership AND l.school_id=@school AND l.reconciliation_status='verified'
            AND a.class_subject_id=@offering AND a.academic_year_id=@year AND a.term=@term AND a.assignment_status='active'))`;
module.exports={teachingScopeSql};
