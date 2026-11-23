const asyncHandler = require('express-async-handler');
const StudentModel = require('../../model/Academic/student');
const ClassModel = require('../../model/Academic/class');

const TERMS = ['First', 'Second', 'Third'];
const httpError = (status, message) => Object.assign(new Error(message), { statusCode: status });

// Francophone averages are out of 20; Anglophone pass marks are percentages.
function parseMinAverage(value, section) {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    const max = section === 'Francophone' ? 20 : 100;
    if (!Number.isFinite(n) || n < 0 || n > max) throw httpError(400, `minAverage must be a number between 0 and ${max}`);
    return n;
}

//@desc   Promote all students in a class to the next level
//@route  POST /api/v1/students/promote/:classId
//@access Private (admin)
exports.promoteClassCtrl = asyncHandler(async (req, res) => {
    const classId = Number(req.params.classId);
    if (!Number.isSafeInteger(classId) || classId < 1) throw httpError(400, 'classId must be a positive integer');
    const { academicYearId, term, minAverage, confirm } = req.body || {};

    const cls = await ClassModel.findById(classId);
    if (!cls) {
        return res.status(404).json({ status: 'error', message: 'Class not found' });
    }

    if (term !== undefined && term !== null && term !== '' && !TERMS.includes(term)) {
        throw httpError(400, `term must be one of ${TERMS.join(', ')}`);
    }
    const yearId = academicYearId === undefined || academicYearId === null || academicYearId === '' ? null : Number(academicYearId);
    if (yearId !== null && (!Number.isSafeInteger(yearId) || yearId < 1)) throw httpError(400, 'academicYearId must be a positive integer');
    const passMinimum = parseMinAverage(minAverage, cls.section);

    // Promotion rewrites every student's class; require an explicit confirmation,
    // otherwise answer with a preview so the administrator can check the counts.
    if (confirm !== true) {
        const students = await StudentModel.getByClass(classId);
        return res.status(200).json({
            status: 'success',
            dryRun: true,
            message: 'Preview only. Resend with confirm: true to apply the promotion.',
            data: {
                class: cls.name,
                section: cls.section,
                passMinimum: passMinimum ?? (cls.section === 'Francophone' ? 10 : 50),
                candidates: students.length,
                finalYear: cls.rank >= 7,
            },
        });
    }

    const result = await StudentModel.promoteClass(classId, yearId, { minAverage: passMinimum, term: term || undefined });
    res.status(200).json({
        status: 'success',
        data: {
            class: cls.name,
            section: cls.section,
            passMinimum: result.passMinimum,
            promoted: result.promoted,
            graduated: result.graduated,
            retained: result.retained,
            errors: result.errors,
        },
    });
});

//@desc   Get students in a class ready for promotion view
//@route  GET /api/v1/students/by-class/:classId
//@access Private (admin)
exports.getStudentsByClassCtrl = asyncHandler(async (req, res) => {
    const students = req.app.locals.legacyScopedPersonnelReadsEnabled ? await require('../staff/scopedLegacyPersonnelReads').handle(req,'byClass','students',req.params.classId) : await StudentModel.getByClass(req.params.classId);
    res.status(200).json({ status: 'success', data: students });
});
