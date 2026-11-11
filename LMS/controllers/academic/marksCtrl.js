const asyncHandler = require('express-async-handler');
const SubjectScore = require('../../model/Academic/subjectScore');
const ClassSubject = require('../../model/Academic/classSubject');
const ClassSubjectStudent = require('../../model/Academic/classSubjectStudent');
const { sql, pool, poolConnect } = require('../../config/database');

const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

async function verifyTeacherAssignment(teacherId, classSubjectId) {
    await poolConnect;
    const result = await pool.request()
        .input('teacherId', sql.Int, teacherId)
        .input('csId', sql.Int, classSubjectId)
        .query(`SELECT 1 FROM class_subject_teachers
                WHERE teacher_id = @teacherId AND class_subject_id = @csId`);
    return result.recordset.length > 0;
}

// GET /api/v1/marks/students/:classSubjectId/:term/:academicYearId
// Get all students in a class with their scores for a subject-term
exports.getStudentsWithScoresCtrl = asyncHandler(async (req, res) => {
    const { classSubjectId, term, academicYearId } = req.params;
    const cs = await ClassSubject.findOfferingById(classSubjectId);
    if (!cs) throw httpError(404, 'Class-subject not found');

    if (req.auth?.accountType === 'teacher') {
        const assigned = await verifyTeacherAssignment(req.userAuth.id, +classSubjectId);
        if (!assigned) throw httpError(403, 'You are not assigned to teach this class-subject');
    }

    const rows = await SubjectScore.getClassStudentsWithScores(cs.class_id, classSubjectId, +academicYearId, term);
    res.status(200).json({ status: 'success', results: rows.length, data: rows });
});

// POST /api/v1/marks/save/:classSubjectId/:term/:sequence/:academicYearId
// Save scores for one sequence (batch of students)
exports.saveScoresCtrl = asyncHandler(async (req, res) => {
    const { classSubjectId, term, sequence, academicYearId } = req.params;
    const { scores } = req.body; // [{ studentId, score, maxScore }]
    if (!Array.isArray(scores) || !scores.length) {
        throw httpError(400, 'scores array is required');
    }

    const cs = await ClassSubject.findOfferingById(classSubjectId);
    if (!cs) throw httpError(404, 'Class-subject not found');

    if (req.auth?.accountType === 'teacher') {
        const assigned = await verifyTeacherAssignment(req.userAuth.id, +classSubjectId);
        if (!assigned) throw httpError(403, 'You are not assigned to teach this class-subject');
    }

    const seq = +sequence;
    if (seq !== 1 && seq !== 2) throw httpError(400, 'sequence must be 1 or 2');

    let saved = 0;
    for (const s of scores) {
        if (s.score === undefined || s.score === null) continue;
        const maxScore = s.maxScore || 50;
        const isEnrolled = await ClassSubjectStudent.isEnrolled(+classSubjectId, s.studentId, +academicYearId);
        if (!isEnrolled) {
            await ClassSubjectStudent.enroll(+classSubjectId, s.studentId, +academicYearId);
        }
        await SubjectScore.upsertScore(
            s.studentId, +classSubjectId, +academicYearId,
            term, seq, Math.min(s.score, maxScore), maxScore, req.userAuth.id
        );
        saved++;
    }

    res.status(200).json({ status: 'success', message: `${saved} scores saved` });
});

// POST /api/v1/marks/save-all/:classSubjectId/:term/:academicYearId
// Save scores for BOTH sequences in one call
// Body: { entries: [{ studentId, seq1, seq2, maxScore }] }
exports.saveAllScoresCtrl = asyncHandler(async (req, res) => {
    const { classSubjectId, term, academicYearId } = req.params;
    const { entries } = req.body;
    if (!Array.isArray(entries) || !entries.length) {
        throw httpError(400, 'entries array is required');
    }

    const cs = await ClassSubject.findOfferingById(classSubjectId);
    if (!cs) throw httpError(404, 'Class-subject not found');

    if (req.auth?.accountType === 'teacher') {
        const assigned = await verifyTeacherAssignment(req.userAuth.id, +classSubjectId);
        if (!assigned) throw httpError(403, 'You are not assigned to teach this class-subject');
    }

    let saved = 0;
    for (const e of entries) {
        const maxScore = e.maxScore || 50;
        const isEnrolled = await ClassSubjectStudent.isEnrolled(+classSubjectId, e.studentId, +academicYearId);
        if (!isEnrolled) {
            await ClassSubjectStudent.enroll(+classSubjectId, e.studentId, +academicYearId);
        }
        if (e.seq1 !== undefined && e.seq1 !== null) {
            await SubjectScore.upsertScore(e.studentId, +classSubjectId, +academicYearId, term, 1, Math.min(e.seq1, maxScore), maxScore, req.userAuth.id);
            saved++;
        }
        if (e.seq2 !== undefined && e.seq2 !== null) {
            await SubjectScore.upsertScore(e.studentId, +classSubjectId, +academicYearId, term, 2, Math.min(e.seq2, maxScore), maxScore, req.userAuth.id);
            saved++;
        }
    }

    res.status(200).json({ status: 'success', message: `${saved} scores saved` });
});
