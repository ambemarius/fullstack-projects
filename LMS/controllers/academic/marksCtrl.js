const asyncHandler = require('express-async-handler');
const SubjectScore = require('../../model/Academic/subjectScore');
const ClassSubject = require('../../model/Academic/classSubject');
const ClassSubjectStudent = require('../../model/Academic/classSubjectStudent');
const { sql, pool, poolConnect } = require('../../config/database');

const TERMS = ['First', 'Second', 'Third'];
// Every sequence mark is out of 20 (also enforced in the database by CK_ss_score_out_of_20, migration 017).
const MAX_SCORE = 20;
const MIN_SEQUENCE = 1;
const MAX_SEQUENCE = 6;

const httpError = (status, message, extra) => Object.assign(new Error(message), { statusCode: status, ...extra });

function positiveInt(value) {
    const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function parseRouteParams(params) {
    const classSubjectId = positiveInt(params.classSubjectId);
    const academicYearId = positiveInt(params.academicYearId);
    if (!classSubjectId || !academicYearId) throw httpError(400, 'classSubjectId and academicYearId must be positive integers');
    if (!TERMS.includes(params.term)) throw httpError(400, `term must be one of ${TERMS.join(', ')}`);
    return { classSubjectId, academicYearId, term: params.term };
}

function parseSequence(value) {
    const seq = positiveInt(value);
    if (!seq || seq < MIN_SEQUENCE || seq > MAX_SEQUENCE) throw httpError(400, `sequence must be between ${MIN_SEQUENCE} and ${MAX_SEQUENCE}`);
    return seq;
}

// The maximum is fixed on the server (out of 20), never taken from the client payload.
function maxScoreFor() {
    return MAX_SCORE;
}

function parseScore(value, maxScore, index, field) {
    const score = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > maxScore) {
        throw httpError(422, `Row ${index}: ${field} must be a number between 0 and ${maxScore}`, { row: index, field });
    }
    return score;
}

async function verifyTeacherAssignment(teacherId, classSubjectId) {
    await poolConnect;
    const result = await pool.request()
        .input('teacherId', sql.Int, teacherId)
        .input('csId', sql.Int, classSubjectId)
        .query(`SELECT 1 FROM class_subject_teachers
                WHERE teacher_id = @teacherId AND class_subject_id = @csId`);
    return result.recordset.length > 0;
}

async function loadAuthorisedOffering(req, classSubjectId) {
    const cs = await ClassSubject.findOfferingById(classSubjectId);
    if (!cs) throw httpError(404, 'Class-subject not found');
    if (req.auth?.accountType === 'teacher') {
        const assigned = await verifyTeacherAssignment(req.userAuth.id, classSubjectId);
        if (!assigned) throw httpError(403, 'You are not assigned to teach this class-subject');
    }
    return cs;
}

async function assertEnrolled(classSubjectId, studentId, academicYearId, index) {
    const enrolled = await ClassSubjectStudent.isEnrolled(classSubjectId, studentId, academicYearId);
    if (!enrolled) throw httpError(422, `Row ${index + 1}: this student is not enrolled in the subject for the selected year. Ask the administrator to enrol them under Evaluation → Course review.`, { row: index, field: 'studentId' });
}

// The synthetic test pool has no transaction support; real mssql pools do.
async function withTransaction(work) {
    await poolConnect;
    const transaction = typeof pool.transaction === 'function' ? pool.transaction() : null;
    if (!transaction) return work(null);
    await transaction.begin();
    try {
        const result = await work(transaction);
        await transaction.commit();
        return result;
    } catch (err) {
        await transaction.rollback().catch(() => {});
        throw err;
    }
}

// GET /api/v1/marks/students/:classSubjectId/:term/:academicYearId
// Get all students in a class with their scores for a subject-term
exports.getStudentsWithScoresCtrl = asyncHandler(async (req, res) => {
    const { classSubjectId, term, academicYearId } = parseRouteParams(req.params);
    const cs = await loadAuthorisedOffering(req, classSubjectId);
    const rows = await SubjectScore.getClassStudentsWithScores(cs.class_id, classSubjectId, academicYearId, term);
    res.status(200).json({ status: 'success', results: rows.length, data: rows });
});

// POST /api/v1/marks/save/:classSubjectId/:term/:sequence/:academicYearId
// Save scores for one sequence (batch of students)
exports.saveScoresCtrl = asyncHandler(async (req, res) => {
    const { classSubjectId, term, academicYearId } = parseRouteParams(req.params);
    const sequence = parseSequence(req.params.sequence);
    const { scores } = req.body || {}; // [{ studentId, score }]
    if (!Array.isArray(scores) || !scores.length) throw httpError(400, 'scores array is required');

    const cs = await loadAuthorisedOffering(req, classSubjectId);
    const maxScore = maxScoreFor(cs);

    const rows = [];
    const seen = new Set();
    scores.forEach((s, index) => {
        if (s?.score === undefined || s?.score === null || s?.score === '') return;
        const studentId = positiveInt(s.studentId);
        if (!studentId) throw httpError(422, `Row ${index}: studentId must be a positive integer`, { row: index, field: 'studentId' });
        if (seen.has(studentId)) throw httpError(422, `Row ${index}: duplicate studentId ${studentId}`, { row: index, field: 'studentId' });
        seen.add(studentId);
        rows.push({ index, studentId, score: parseScore(s.score, maxScore, index, 'score') });
    });
    for (const row of rows) await assertEnrolled(classSubjectId, row.studentId, academicYearId, row.index);

    const saved = await withTransaction(async transaction => {
        for (const row of rows) {
            await SubjectScore.upsertScore(row.studentId, classSubjectId, academicYearId, term, sequence, row.score, maxScore, req.userAuth.id, { transaction });
        }
        return rows.length;
    });

    res.status(200).json({ status: 'success', message: `${saved} scores saved` });
});

// POST /api/v1/marks/save-all/:classSubjectId/:term/:academicYearId
// Save scores for BOTH sequences in one call
// Body: { entries: [{ studentId, seq1, seq2 }] }
exports.saveAllScoresCtrl = asyncHandler(async (req, res) => {
    const { classSubjectId, term, academicYearId } = parseRouteParams(req.params);
    const { entries } = req.body || {};
    if (!Array.isArray(entries) || !entries.length) throw httpError(400, 'entries array is required');

    const cs = await loadAuthorisedOffering(req, classSubjectId);
    const maxScore = maxScoreFor(cs);

    const rows = [];
    const seen = new Set();
    entries.forEach((e, index) => {
        const studentId = positiveInt(e?.studentId);
        if (!studentId) throw httpError(422, `Row ${index}: studentId must be a positive integer`, { row: index, field: 'studentId' });
        if (seen.has(studentId)) throw httpError(422, `Row ${index}: duplicate studentId ${studentId}`, { row: index, field: 'studentId' });
        seen.add(studentId);
        const present = v => v !== undefined && v !== null && v !== '';
        rows.push({
            index, studentId,
            seq1: present(e.seq1) ? parseScore(e.seq1, maxScore, index, 'seq1') : null,
            seq2: present(e.seq2) ? parseScore(e.seq2, maxScore, index, 'seq2') : null,
        });
    });
    for (const row of rows) await assertEnrolled(classSubjectId, row.studentId, academicYearId, row.index);

    const saved = await withTransaction(async transaction => {
        let count = 0;
        for (const row of rows) {
            if (row.seq1 !== null) { await SubjectScore.upsertScore(row.studentId, classSubjectId, academicYearId, term, 1, row.seq1, maxScore, req.userAuth.id, { transaction }); count++; }
            if (row.seq2 !== null) { await SubjectScore.upsertScore(row.studentId, classSubjectId, academicYearId, term, 2, row.seq2, maxScore, req.userAuth.id, { transaction }); count++; }
        }
        return count;
    });

    res.status(200).json({ status: 'success', message: `${saved} scores saved` });
});
