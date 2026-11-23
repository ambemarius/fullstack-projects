const asyncHandler = require('express-async-handler');
const SubjectScore = require('../../model/Academic/subjectScore');
const ClassSubject = require('../../model/Academic/classSubject');
const Student = require('../../model/Academic/student');
const ClassModel = require('../../model/Academic/class');
const { sql, pool, poolConnect } = require('../../config/database');

const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

const GRADING_SCALES = {
    Anglophone: [
        { min: 80, grade: 'A', remark: 'Excellent' },
        { min: 70, grade: 'B', remark: 'Very Good' },
        { min: 60, grade: 'C', remark: 'Good' },
        { min: 50, grade: 'D', remark: 'Fair' },
        { min: 40, grade: 'E', remark: 'Pass' },
        { min: 0,  grade: 'F', remark: 'Fail' },
    ],
    Francophone: [
        { min: 16, grade: '16-20', remark: 'Très Bien' },
        { min: 14, grade: '14-16', remark: 'Bien' },
        { min: 12, grade: '12-14', remark: 'Assez Bien' },
        { min: 10, grade: '10-12', remark: 'Passable' },
        { min: 8,  grade: '08-10', remark: 'Insuffisant' },
        { min: 0,  grade: '00-08', remark: 'Très Insuffisant' },
    ],
};

function gradeFromScore(score, maxScore, section) {
    if (score === null || score === undefined || maxScore === 0) {
        return { grade: section === 'Francophone' ? '00-08' : 'F', remark: section === 'Francophone' ? 'Très Insuffisant' : 'Fail' };
    }
    const scale = GRADING_SCALES[section] || GRADING_SCALES.Anglophone;
    if (section === 'Francophone') {
        const mark = (score / maxScore) * 20;
        for (const entry of scale) {
            if (mark >= entry.min) return { grade: entry.grade, remark: entry.remark };
        }
    } else {
        const pct = (score / maxScore) * 100;
        for (const entry of scale) {
            if (pct >= entry.min) return { grade: entry.grade, remark: entry.remark };
        }
    }
    return { grade: scale[scale.length - 1].grade, remark: scale[scale.length - 1].remark };
}

// GET /api/v1/report-cards/:classId/:term/:academicYearId
exports.gradeFromScore = gradeFromScore;
exports.GRADING_SCALES = GRADING_SCALES;

exports.getReportCardCtrl = asyncHandler(async (req, res) => {
    const { classId, term, academicYearId } = req.params;
    if (!classId || !term || !academicYearId) throw httpError(400, 'classId, term and academicYearId are required');

    const classInfo = await ClassModel.findById(+classId);
    if (!classInfo) throw httpError(404, 'Class not found');
    const section = classInfo.section;

    const result = req.app.locals.legacyScopedReportsEnabled
        ? {recordset: await require('./scopedLegacyReport').rows(req)}
        : await (async()=>{await poolConnect;return pool.request()
        .input('classId', sql.Int, +classId)
        .input('term', sql.NVarChar(10), term)
        .input('academicYearId', sql.Int, +academicYearId)
        .query(`
            SELECT s.id AS studentId, s.firstName, s.middleName, s.lastName, s.matricule, s.sex,
                   cs.id AS classSubjectId, subj.name AS subjectName, subj.code AS subjectCode,
                   cs.coefficient,
                   ss1.score AS seq1, ss1.max_score AS max1,
                   ss2.score AS seq2, ss2.max_score AS max2,
                   subj.passmark
            FROM students s
            JOIN class_subjects cs ON cs.class_id = s.currentClassLevel
            JOIN subjects subj ON subj.id = cs.subject_id
            LEFT JOIN subject_scores ss1 ON ss1.student_id = s.id
                AND ss1.class_subject_id = cs.id
                AND ss1.academic_year_id = @academicYearId
                AND ss1.term = @term
                AND ss1.sequence = 1
            LEFT JOIN subject_scores ss2 ON ss2.student_id = s.id
                AND ss2.class_subject_id = cs.id
                AND ss2.academic_year_id = @academicYearId
                AND ss2.term = @term
                AND ss2.sequence = 2
            WHERE s.currentClassLevel = @classId
              AND s.isWithdrawn = 0
              AND s.academicYearId = @academicYearId
            ORDER BY s.lastName, s.firstName, subj.name
        `);

    })();

    const rows = result.recordset;

    // Build pivot: { studentId: { info, subjects: [{...}], totals } }
    const studentMap = new Map();
    for (const r of rows) {
        if (!studentMap.has(r.studentId)) {
            studentMap.set(r.studentId, {
                studentId: r.studentId,
                name: [r.firstName, r.middleName, r.lastName].filter(Boolean).join(' '),
                matricule: r.matricule,
                sex: r.sex,
                subjects: [],
                weightedTotal: 0,
                totalCoefficient: 0,
            });
        }
        const student = studentMap.get(r.studentId);
        const seq1 = r.seq1 ?? null;
        const seq2 = r.seq2 ?? null;
        const max1 = r.max1 ?? 50;
        const max2 = r.max2 ?? 50;
        const avg = (seq1 !== null && seq2 !== null)
            ? (seq1 + seq2) / 2
            : (seq1 !== null ? seq1 : (seq2 !== null ? seq2 : null));
        const coef = parseFloat(r.coefficient) || 1;
        const gradeResult = avg !== null ? gradeFromScore(avg, max1, section) : null;

        student.subjects.push({
            classSubjectId: r.classSubjectId,
            subjectCode: r.subjectCode,
            subjectName: r.subjectName,
            coefficient: coef,
            seq1,
            seq2,
            avg,
            grade: gradeResult ? gradeResult.grade : null,
            remark: gradeResult ? gradeResult.remark : null,
            passmark: r.passmark || (section === 'Francophone' ? 10 : 50),
            maxScore: max1,
        });

        if (avg !== null) {
            student.weightedTotal += avg * coef;
            student.totalCoefficient += coef;
        }
    }

    // Absence hours ("heures d'absence") for the bulletin, from the term's attendance registers.
    const attendance = classInfo.school_id
        ? await require('../../model/attendance/attendanceService').createAttendanceService()
            .classTotals({ schoolId: classInfo.school_id }, { classId: +classId, yearId: +academicYearId, term })
        : new Map();
    const noAbsence = { periods: 0, absences: 0, absentHours: 0, justifiedHours: 0, unjustifiedHours: 0, lates: 0, lateMinutes: 0 };

    const students = Array.from(studentMap.values()).map(s => ({
        ...s,
        overallAvg: s.totalCoefficient > 0 ? s.weightedTotal / s.totalCoefficient : null,
        attendance: attendance.get(s.studentId) || noAbsence,
    }));

    // Sort by overall average descending
    students.sort((a, b) => (b.overallAvg ?? -1) - (a.overallAvg ?? -1));

    // Positions only for students with an average; equal averages share a place (ex aequo: 1, 2, 2, 4).
    let lastAvg = null, lastPosition = 0;
    students.forEach((s, i) => {
        if (s.overallAvg === null) { s.position = null; return; }
        const rounded = Math.round(s.overallAvg * 100) / 100;
        s.position = rounded === lastAvg ? lastPosition : i + 1;
        lastAvg = rounded; lastPosition = s.position;
    });

    // KPIs
    const classGeneralAvg = students.length > 0
        ? students.reduce((sum, s) => sum + (s.overallAvg ?? 0), 0) / students.length
        : 0;

    const subjectStats = {};
    for (const s of students) {
        for (const sub of s.subjects) {
            if (!subjectStats[sub.classSubjectId]) {
                subjectStats[sub.classSubjectId] = {
                    classSubjectId: sub.classSubjectId,
                    subjectCode: sub.subjectCode,
                    subjectName: sub.subjectName,
                    coefficient: sub.coefficient,
                    totalScore: 0,
                    count: 0,
                };
            }
            if (sub.avg !== null) {
                subjectStats[sub.classSubjectId].totalScore += sub.avg;
                subjectStats[sub.classSubjectId].count += 1;
            }
        }
    }

    const subjectAverages = Object.values(subjectStats).map(s => ({
        ...s,
        classAvg: s.count > 0 ? s.totalScore / s.count : 0,
    }));

    const bestSubject = subjectAverages.length > 0
        ? subjectAverages.reduce((a, b) => a.classAvg > b.classAvg ? a : b)
        : null;
    const worstSubject = subjectAverages.length > 0
        ? subjectAverages.reduce((a, b) => a.classAvg < b.classAvg ? a : b)
        : null;

    const passThreshold = section === 'Francophone' ? 10 : 50;

    res.status(200).json({
        status: 'success',
        data: {
            section,
            passThreshold,
            gradingScale: section === 'Francophone' ? 'French (0-20)' : 'GCE (A-F)',
            students,
            classGeneralAvg: Math.round(classGeneralAvg * 100) / 100,
            totalEnrolled: students.length,
            subjectAverages,
            bestSubject,
            worstSubject,
        },
    });
});
