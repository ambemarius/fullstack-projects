// Whole-school timetable generation for administrators.
//
// preview(): reads allocations, active teacher assignments and time slots, builds the timetable with
//            utils/timetableScheduler.js and returns a summary plus every class grid. Writes nothing.
// apply():   rebuilds inside one SERIALIZABLE transaction and refuses if anything changed since the preview
//            (fingerprint). It then backs up the term's current rows to a JSON file, detaches past attendance
//            registers from the rows being replaced (each register keeps its own class/subject/teacher/time
//            copy), replaces the rows, verifies there are no clashes and commits.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { sql, pool, poolConnect } = require('../../config/database');
const { buildTimetable } = require('../../utils/timetableScheduler');

const TERMS = ['First', 'Second', 'Third'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const STUDY_CODE = 'STUDY';
const INSERT_BATCH = 100; // 10 parameters per row, well under SQL Server's 2100-parameter limit

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });

function parseOptions({ yearId, term, study } = {}) {
    if (!/^[1-9]\d{0,9}$/.test(String(yearId)) || Number(yearId) > 2147483647) throw fail(422, 'Choose an academic year.');
    if (!TERMS.includes(term)) throw fail(422, 'Choose a term (First, Second or Third).');
    return { yearId: Number(yearId), term, study: study === true || study === 'true' };
}

// Reads everything the scheduler needs. `query(statement, params)` runs either on the pool or in a transaction.
async function loadSchedulerInput(query, yearId) {
    const year = (await query('SELECT id, name FROM academic_years WHERE id = @year', { year: [sql.Int, yearId] })).recordset[0];
    if (!year) throw fail(404, 'Academic year not found.');
    const periods = (await query('SELECT id, start_time, end_time FROM time_slots WHERE is_break = 0 ORDER BY sort_order')).recordset
        .map(s => ({ slotId: s.id, label: `${s.start_time}-${s.end_time}`, start: s.start_time, end: s.end_time }));
    // Only class subjects allocated for this year; inactive assignments and teachers are left out.
    const rows = (await query(`
        SELECT c.id AS class_id, c.section, LTRIM(c.name + ISNULL(' ' + c.stream, '')) AS class_name,
               s.id AS subject_id, s.name AS subject, a.periods_week,
               t.id AS teacher_id, t.name AS teacher
        FROM class_subjects cs
        JOIN classes c ON c.id = cs.class_id
        JOIN subjects s ON s.id = cs.subject_id
        JOIN subject_allocations a ON a.class_id = cs.class_id AND a.subject_id = cs.subject_id AND a.academic_year_id = @year
        LEFT JOIN class_subject_teachers cst ON cst.class_subject_id = cs.id AND cst.assignment_status = 'active'
        LEFT JOIN teachers t ON t.id = cst.teacher_id AND t.status = 'active'
        ORDER BY c.section, c.rank, s.name, t.id`, { year: [sql.Int, yearId] })).recordset;
    return { academicYear: year, days: DAYS, periods, rows };
}

async function defaultTransaction() {
    await poolConnect;
    const tx = pool.transaction();
    return { begin: level => tx.begin(level), commit: () => tx.commit(), rollback: () => tx.rollback(), request: () => new sql.Request(tx) };
}

async function defaultRead(statement, params = {}) {
    await poolConnect;
    const r = pool.request();
    for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value);
    return r.query(statement);
}

const defaultBackupDir = () => process.env.TIMETABLE_BACKUP_DIR || path.join(__dirname, '..', '..', 'backups', 'timetable', 'auto');
function defaultSaveBackup(name, data) {
    const dir = defaultBackupDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    fs.writeFileSync(file, JSON.stringify(data, null, 1), { flag: 'wx' });
    return file;
}

function createTimetableGenerator({ beginTransaction = defaultTransaction, read = defaultRead, saveBackup = defaultSaveBackup, clock = () => new Date() } = {}) {
    const existingState = async (query, { yearId, term }, lock = '') => (await query(`
        SELECT COUNT(*) AS lessons, ISNULL(MAX(id), 0) AS maxId,
               ISNULL(CHECKSUM_AGG(CHECKSUM(id, class_id, subject_id, teacher_id, day_of_week, time_slot_id)), 0) AS checksum
        FROM timetables ${lock} WHERE academic_year_id = @year AND academic_term = @term`,
    { year: [sql.Int, yearId], term: [sql.NVarChar(10), term] })).recordset[0];

    function fingerprint(input, existing, opts) {
        return crypto.createHash('sha256')
            .update(JSON.stringify({ periods: input.periods, rows: input.rows, existing, opts }))
            .digest('hex').slice(0, 32);
    }

    async function build(query, opts) {
        const input = await loadSchedulerInput(query, opts.yearId);
        if (!input.periods.length) throw fail(422, 'No teaching periods are set up. Add time slots first.');
        if (!input.rows.length) throw fail(422, 'No subject allocations for this academic year. Allocate subjects to classes first.');
        const existing = await existingState(query, opts, opts.lock || '');
        const result = buildTimetable(input, { study: opts.study });
        return { input, existing, result, fingerprint: fingerprint(input, existing, { yearId: opts.yearId, term: opts.term, study: opts.study }) };
    }

    function summarise({ input, existing, result, fingerprint: fp }, opts) {
        const { teachers, tuples, classes, classGrid, validation } = result;
        const cname = id => classes.get(id).name;
        return {
            fingerprint: fp,
            academicYear: input.academicYear,
            term: opts.term,
            study: opts.study,
            existingLessons: existing.lessons,
            validation,
            teacherLoad: [...teachers.values()]
                .map(t => ({ teacherId: t.id, name: t.name, required: Math.round(t.demand), lessons: t.placed, supervision: t.supervision, shortfall: Math.max(0, Math.round(t.demand) - t.placed) }))
                .sort((a, b) => b.shortfall - a.shortfall || b.required - a.required),
            shortfall: [...tuples.values()].filter(t => t.placed < t.required)
                .map(t => ({ classId: t.classId, className: cname(t.classId), section: classes.get(t.classId).section, subject: t.subject, required: t.required, placed: t.placed, teachers: t.teachers.map(id => teachers.get(id).name) })),
            periods: result.periods,
            days: result.days,
            classes: [...classGrid].map(([id, grid]) => ({
                classId: id, name: cname(id), section: classes.get(id).section,
                grid: grid.map(day => day.map(c => c && { subject: c.subject, teacher: c.teacherId != null ? teachers.get(c.teacherId).name : null, study: !!c.study })),
            })),
        };
    }

    async function preview(options) {
        const opts = parseOptions(options);
        return summarise(await build(read, opts), opts);
    }

    async function apply(actor, options) {
        if (!actor || !Number.isSafeInteger(actor.id)) throw fail(401, 'Authentication required');
        const opts = parseOptions(options);
        if (typeof options.fingerprint !== 'string' || !/^[0-9a-f]{32}$/.test(options.fingerprint)) throw fail(422, 'Preview the timetable before applying it.');

        const tx = await beginTransaction();
        await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const query = (statement, params = {}) => {
            const r = tx.request();
            for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value);
            return r.query(statement);
        };
        const scope = { year: [sql.Int, opts.yearId], term: [sql.NVarChar(10), opts.term] };
        try {
            const built = await build(query, { ...opts, lock: 'WITH (UPDLOCK, HOLDLOCK)' });
            if (built.fingerprint !== options.fingerprint) throw fail(409, 'The timetable, allocations or teacher assignments changed since the preview. Preview again before applying.');
            const { result } = built;
            if (!result.validation.valid) throw fail(500, 'The generated timetable failed validation. Nothing was changed.');
            if (!result.validation.totalPlaced) throw fail(422, 'No lessons could be placed. Assign teachers to class subjects first.');

            // 1. Back up the rows being replaced (and register links) before any change.
            const oldRows = (await query('SELECT * FROM timetables WHERE academic_year_id = @year AND academic_term = @term ORDER BY id', scope)).recordset;
            const links = (await query(`SELECT id, timetable_id FROM attendance_registers WHERE timetable_id IN
                (SELECT id FROM timetables WHERE academic_year_id = @year AND academic_term = @term)`, scope)).recordset;
            const stamp = clock().toISOString().replace(/[:.]/g, '-');
            const backup = saveBackup(`timetable_${opts.yearId}_${opts.term}_${stamp}.json`, {
                createdAt: clock().toISOString(), createdBy: { type: 'admin', id: actor.id }, academicYear: built.input.academicYear,
                term: opts.term, timetables: oldRows, attendance_register_links: links,
            });

            // 2. Study Period subject (never linked to class_subjects, so it stays off report cards and mark entry).
            let studyId = null;
            if (result.validation.studySlots > result.validation.studyUnsupervised) {
                studyId = (await query('SELECT id FROM subjects WHERE code = @code', { code: [sql.NVarChar(20), STUDY_CODE] })).recordset[0]?.id;
                if (!studyId) {
                    studyId = (await query(`INSERT INTO subjects (name, code, description) OUTPUT INSERTED.id
                        VALUES ('Study Period', @code, 'Supervised study (timetable filler, not graded)')`, { code: [sql.NVarChar(20), STUDY_CODE] })).recordset[0].id;
                }
            }

            // 3. Detach past registers, replace rows.
            const detached = (await query(`UPDATE attendance_registers SET timetable_id = NULL WHERE timetable_id IN
                (SELECT id FROM timetables WHERE academic_year_id = @year AND academic_term = @term)`, scope)).rowsAffected[0];
            const removed = (await query('DELETE FROM timetables WHERE academic_year_id = @year AND academic_term = @term', scope)).rowsAffected[0];

            const lessons = [];
            for (const [classId, grid] of result.classGrid) {
                grid.forEach((day, d) => day.forEach((cell, p) => {
                    if (!cell || cell.teacherId == null) return; // empty or unsupervised slots stay empty
                    lessons.push({ classId, subjectId: cell.study ? studyId : cell.subjectId, teacherId: cell.teacherId, day: result.days[d], period: result.periods[p], study: !!cell.study });
                }));
            }
            for (let i = 0; i < lessons.length; i += INSERT_BATCH) {
                const batch = lessons.slice(i, i + INSERT_BATCH);
                const params = { ...scope, admin: [sql.Int, actor.id] };
                const values = batch.map((l, j) => {
                    params[`c${j}`] = [sql.Int, l.classId]; params[`s${j}`] = [sql.Int, l.subjectId]; params[`t${j}`] = [sql.Int, l.teacherId];
                    params[`d${j}`] = [sql.NVarChar(10), l.day]; params[`slot${j}`] = [sql.Int, l.period.slotId];
                    params[`st${j}`] = [sql.NVarChar(5), l.period.start]; params[`en${j}`] = [sql.NVarChar(5), l.period.end];
                    return `(@c${j}, @s${j}, @t${j}, @d${j}, @slot${j}, @st${j}, @en${j}, @term, @year, @admin)`;
                });
                await query(`INSERT INTO timetables (class_id, subject_id, teacher_id, day_of_week, time_slot_id, start_time, end_time, academic_term, academic_year_id, created_by)
                    VALUES ${values.join(', ')}`, params);
            }

            // 4. Verify inside the transaction.
            const check = (await query(`SELECT
                (SELECT COUNT(*) FROM timetables WHERE academic_year_id = @year AND academic_term = @term) AS total,
                (SELECT COUNT(*) FROM (SELECT teacher_id FROM timetables WHERE academic_year_id = @year AND academic_term = @term
                    GROUP BY teacher_id, day_of_week, time_slot_id HAVING COUNT(*) > 1) x) AS teacherClashes,
                (SELECT COUNT(*) FROM (SELECT class_id FROM timetables WHERE academic_year_id = @year AND academic_term = @term
                    GROUP BY class_id, day_of_week, time_slot_id HAVING COUNT(*) > 1) x) AS classClashes`, scope)).recordset[0];
            if (check.total !== lessons.length || check.teacherClashes || check.classClashes) throw fail(500, 'Verification failed after writing. Nothing was changed.');

            await tx.commit();
            return {
                academicYear: built.input.academicYear, term: opts.term, removed, inserted: lessons.length,
                studyPeriods: lessons.filter(l => l.study).length, detachedRegisters: detached,
                backup: path.basename(backup), validation: result.validation,
            };
        } catch (error) {
            await tx.rollback().catch(() => {});
            if (error.number === 1205) throw fail(409, 'Someone else changed the timetable at the same time. Preview again.');
            throw error;
        }
    }

    return { preview, apply };
}

module.exports = { createTimetableGenerator, loadSchedulerInput, parseOptions, TERMS };
