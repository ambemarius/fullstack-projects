// Printable report cards ("STUDENT REPORT CARD | BULLETIN DE NOTES").
// Reads the LMS's own data and feeds utils/reportCardEngine.js:
//   marks        subject_scores (per term, sequences 1-2, out of max_score) -> /20, global sequences 1-6
//   coefficients class_subjects.coefficient, else subjects.coefficient, else 1
//   teachers     active class_subject_teachers
//   absences     attendance registers (hours absent in the term)
//   owing        finance ledger balance for the academic year
//   heading, reopening date, subject bands, discipline and council remarks: report_card_* tables (migration 016)
const fs = require('node:fs');
const path = require('node:path');
const { sql, pool, poolConnect } = require('../../config/database');
const { buildReportCards, DEFAULT_CONFIG } = require('../../utils/reportCardEngine');
const { TEMPLATE_IDS } = require('../../utils/reportCardTemplates');

const TERMS = ['First', 'Second', 'Third'];
const TERM_NO = { First: 1, Second: 2, Third: 3 };
const IMAGE_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const SETTINGS_FIELDS = {
    name_en: 200, name_fr: 200, address_line: 255, country_en: 80, motto_en: 80, ministry_en: 120,
    country_fr: 80, motto_fr: 80, ministry_fr: 120, watermark_text: 80, footer_text: 255,
};
const SETTINGS_DEFAULTS = {
    country_en: 'REPUBLIC OF CAMEROON', motto_en: 'PEACE - WORK - FATHERLAND', ministry_en: 'MINISTRY OF SECONDARY EDUCATION',
    country_fr: 'RÉPUBLIQUE DU CAMEROUN', motto_fr: 'PAIX - TRAVAIL - PATRIE', ministry_fr: 'MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES',
};

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
function id(v, label) {
    if (!/^[1-9]\d{0,9}$/.test(String(v)) || Number(v) > 2147483647) throw fail(422, `Choose a ${label}.`);
    return Number(v);
}
function term(v) { if (!TERMS.includes(v)) throw fail(422, 'Choose a term (First, Second or Third).'); return v; }
function count(v, label) {
    const n = v === '' || v === null || v === undefined ? 0 : Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 99) throw fail(422, `${label} must be a whole number from 0 to 99.`);
    return n;
}
function optionalText(v, max, label) {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'string') throw fail(422, `${label} must be text.`);
    const t = v.trim();
    if (t.length > max) throw fail(422, `${label} can be at most ${max} characters.`);
    return t || null;
}
function isoDate(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) throw fail(422, 'Enter a valid date.');
    return v;
}
const toIso = d => (d instanceof Date ? d.toISOString().slice(0, 10) : d || null);

async function defaultRead(statement, params = {}) {
    await poolConnect;
    const r = pool.request();
    for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value);
    return r.query(statement);
}
async function defaultTransaction() {
    await poolConnect;
    const tx = pool.transaction();
    return { begin: level => tx.begin(level), commit: () => tx.commit(), rollback: () => tx.rollback(), request: () => new sql.Request(tx) };
}
function defaultImage(fileName) {
    if (!fileName) return null;
    const { resolveUploadPath } = require('../../middlewares/upload');
    const file = resolveUploadPath(fileName);
    const type = file && IMAGE_TYPES[path.extname(file).toLowerCase()];
    if (!type || !fs.existsSync(file)) return null;
    return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
}
async function defaultAbsences(schoolId, { classId, yearId, term: tm }) {
    const service = require('../attendance/attendanceService').createAttendanceService();
    const totals = await service.classTotals({ schoolId }, { classId, yearId, term: tm });
    return new Map([...totals].map(([studentId, t]) => [studentId, {
        absentHours: t.absentHours || 0, justifiedHours: t.justifiedHours || 0, unjustifiedHours: t.unjustifiedHours || 0, lates: t.lates || 0,
    }]));
}
// Absence totals may be plain hours (older callers and tests) or the detailed object above.
function hoursOf(v) {
    if (v && typeof v === 'object') return v;
    const h = Number(v) || 0;
    return { absentHours: h, justifiedHours: 0, unjustifiedHours: h, lates: 0 };
}

function createReportCardService({ read = defaultRead, beginTransaction = defaultTransaction, image = defaultImage, absences = defaultAbsences, config = DEFAULT_CONFIG } = {}) {
    async function writeTx(work) {
        const tx = await beginTransaction();
        await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const query = (statement, params = {}) => {
            const r = tx.request();
            for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value);
            return r.query(statement);
        };
        try {
            const result = await work(query);
            await tx.commit();
            return result;
        } catch (error) {
            await tx.rollback().catch(() => {});
            if (error.number === 1205) throw fail(409, 'Someone else saved at the same time. Reload and try again.');
            throw error;
        }
    }

    async function schoolRow(schoolId) {
        const school = (await read('SELECT id, name FROM schools WHERE id = @school', { school: [sql.Int, schoolId] })).recordset[0];
        if (!school) throw fail(404, 'School not found.');
        return school;
    }

    // ---------------------------------------------------------------- settings
    async function getSettings(schoolId) {
        const school = await schoolRow(schoolId);
        const row = (await read('SELECT * FROM report_card_settings WHERE school_id = @school', { school: [sql.Int, schoolId] })).recordset[0] || {};
        const settings = { school_id: schoolId, school_name: school.name };
        for (const field of Object.keys(SETTINGS_FIELDS)) settings[field] = row[field] ?? SETTINGS_DEFAULTS[field] ?? '';
        settings.logo_file = row.logo_file || null;
        settings.signature_file = row.signature_file || null;
        settings.card_template = TEMPLATE_IDS.includes(row.card_template) ? row.card_template : 'classic';
        return settings;
    }

    async function saveSettings(actor, schoolId, body = {}) {
        const values = {};
        for (const [field, max] of Object.entries(SETTINGS_FIELDS)) values[field] = optionalText(body[field], max, field.replace(/_/g, ' '));
        for (const field of ['country_en', 'motto_en', 'ministry_en', 'country_fr', 'motto_fr', 'ministry_fr']) values[field] ||= SETTINGS_DEFAULTS[field];
        await schoolRow(schoolId);
        const params = { school: [sql.Int, schoolId], actor: [sql.Int, actor.id] };
        for (const [field, max] of Object.entries(SETTINGS_FIELDS)) params[field] = [sql.NVarChar(max), values[field]];
        const fields = Object.keys(SETTINGS_FIELDS);
        await writeTx(query => query(`MERGE report_card_settings WITH (HOLDLOCK) AS t USING (SELECT @school AS school_id) AS s ON t.school_id = s.school_id
            WHEN MATCHED THEN UPDATE SET ${fields.map(f => `${f} = @${f}`).join(', ')}, updated_by = @actor, updated_at = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (school_id, ${fields.join(', ')}, updated_by) VALUES (@school, ${fields.map(f => '@' + f).join(', ')}, @actor);`, params));
        return getSettings(schoolId);
    }

    // kind: 'logo' | 'signature'; fileName: stored upload name, or null to remove.
    async function setImage(actor, schoolId, kind, fileName) {
        const column = { logo: 'logo_file', signature: 'signature_file' }[kind];
        if (!column) throw fail(422, 'Unknown image.');
        await schoolRow(schoolId);
        await writeTx(query => query(`MERGE report_card_settings WITH (HOLDLOCK) AS t USING (SELECT @school AS school_id) AS s ON t.school_id = s.school_id
            WHEN MATCHED THEN UPDATE SET ${column} = @file, updated_by = @actor, updated_at = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (school_id, ${column}, updated_by) VALUES (@school, @file, @actor);`,
        { school: [sql.Int, schoolId], file: [sql.NVarChar(200), fileName], actor: [sql.Int, actor.id] }));
        return getSettings(schoolId);
    }

    // The report card template the school prints with by default (migration 020 adds the column).
    async function saveTemplate(actor, schoolId, template) {
        if (!TEMPLATE_IDS.includes(template)) throw fail(422, 'Choose a report card template.');
        await schoolRow(schoolId);
        try {
            await writeTx(query => query(`MERGE report_card_settings WITH (HOLDLOCK) AS t USING (SELECT @school AS school_id) AS s ON t.school_id = s.school_id
                WHEN MATCHED THEN UPDATE SET card_template = @template, updated_by = @actor, updated_at = SYSUTCDATETIME()
                WHEN NOT MATCHED THEN INSERT (school_id, card_template, updated_by) VALUES (@school, @template, @actor);`,
            { school: [sql.Int, schoolId], template: [sql.NVarChar(20), template], actor: [sql.Int, actor.id] }));
        } catch (error) {
            if (error.number === 207) throw fail(409, 'Saving a default template needs a database update (migration 020). You can still choose a template each time you print.');
            throw error;
        }
        return getSettings(schoolId);
    }

    async function getReopening(schoolId, { yearId }) {
        const y = id(yearId, 'academic year');
        const rows = (await read('SELECT term, CONVERT(char(10), reopening_date, 23) AS reopening_date FROM report_card_terms WHERE school_id = @school AND academic_year_id = @year',
            { school: [sql.Int, schoolId], year: [sql.Int, y] })).recordset;
        return Object.fromEntries(TERMS.map(t => [t, rows.find(r => r.term === t)?.reopening_date || null]));
    }

    async function saveReopening(actor, schoolId, { yearId, term: tm, reopeningDate }) {
        const y = id(yearId, 'academic year'), t = term(tm), date = isoDate(reopeningDate);
        await writeTx(async query => {
            const year = (await query('SELECT id FROM academic_years WHERE id = @year', { year: [sql.Int, y] })).recordset[0];
            if (!year) throw fail(404, 'Academic year not found.');
            await query(`MERGE report_card_terms WITH (HOLDLOCK) AS x USING (SELECT @school AS school_id, @year AS academic_year_id, @term AS term) AS s
                ON x.school_id = s.school_id AND x.academic_year_id = s.academic_year_id AND x.term = s.term
                WHEN MATCHED THEN UPDATE SET reopening_date = @date, updated_by = @actor, updated_at = SYSUTCDATETIME()
                WHEN NOT MATCHED THEN INSERT (school_id, academic_year_id, term, reopening_date, updated_by) VALUES (@school, @year, @term, @date, @actor);`,
            { school: [sql.Int, schoolId], year: [sql.Int, y], term: [sql.NVarChar(10), t], date: [sql.Date, date], actor: [sql.Int, actor.id] });
        });
        return getReopening(schoolId, { yearId: y });
    }

    // ---------------------------------------------------------------- subject bands
    async function getGroups(schoolId) {
        const params = { school: [sql.Int, schoolId] };
        const groups = (await read('SELECT id, name, display_order, min_rows FROM report_card_groups WHERE school_id = @school ORDER BY display_order, id', params)).recordset;
        const members = (await read('SELECT subject_id, group_id, display_order FROM report_card_group_subjects WHERE school_id = @school', params)).recordset;
        // Subjects actually taught in a class (not timetable-only subjects such as Study Period).
        const subjects = (await read(`SELECT DISTINCT s.id, s.name, s.code FROM subjects s
            JOIN class_subjects cs ON cs.subject_id = s.id WHERE s.school_id = @school OR s.school_id IS NULL ORDER BY s.name`, params)).recordset;
        return {
            groups: groups.map(g => ({ ...g, subjects: members.filter(m => m.group_id === g.id).sort((a, b) => a.display_order - b.display_order).map(m => m.subject_id) })),
            subjects,
        };
    }

    // groups: [{ name, min_rows, subjects: [subjectId, ...] }] in print order; replaces the whole configuration.
    async function saveGroups(actor, schoolId, groups) {
        if (!Array.isArray(groups) || groups.length > 12) throw fail(422, 'Send up to 12 subject bands.');
        const clean = groups.map((g, i) => {
            const name = optionalText(g?.name, 80, `Band ${i + 1} name`);
            if (!name) throw fail(422, `Band ${i + 1} needs a name.`);
            const minRows = count(g.min_rows, `${name}: minimum rows`);
            if (minRows > 20) throw fail(422, `${name}: minimum rows can be at most 20.`);
            if (!Array.isArray(g.subjects)) throw fail(422, `${name}: choose its subjects.`);
            return { name: name.toUpperCase(), minRows, subjects: g.subjects.map(s => id(s, 'subject')) };
        });
        const names = clean.map(g => g.name);
        if (new Set(names).size !== names.length) throw fail(422, 'Each band needs a different name.');
        const allSubjects = clean.flatMap(g => g.subjects);
        if (new Set(allSubjects).size !== allSubjects.length) throw fail(422, 'A subject can only be in one band.');

        await writeTx(async query => {
            if (allSubjects.length) {
                const known = (await query(`SELECT id FROM subjects WHERE id IN (${allSubjects.map((_, i) => '@s' + i).join(', ')})`,
                    Object.fromEntries(allSubjects.map((s, i) => ['s' + i, [sql.Int, s]])))).recordset.map(r => r.id);
                const unknown = allSubjects.filter(s => !known.includes(s));
                if (unknown.length) throw fail(422, `Unknown subject ${unknown[0]}.`);
            }
            const school = { school: [sql.Int, schoolId] };
            await query('DELETE FROM report_card_group_subjects WHERE school_id = @school', school);
            await query('DELETE FROM report_card_groups WHERE school_id = @school', school);
            for (const [order, g] of clean.entries()) {
                const groupId = (await query(`INSERT INTO report_card_groups (school_id, name, display_order, min_rows) OUTPUT INSERTED.id VALUES (@school, @name, @order, @min)`,
                    { ...school, name: [sql.NVarChar(80), g.name], order: [sql.SmallInt, order + 1], min: [sql.SmallInt, g.minRows] })).recordset[0].id;
                for (const [i, subjectId] of g.subjects.entries()) {
                    await query('INSERT INTO report_card_group_subjects (school_id, subject_id, group_id, display_order) VALUES (@school, @subject, @group, @order)',
                        { ...school, subject: [sql.Int, subjectId], group: [sql.Int, groupId], order: [sql.SmallInt, i] });
                }
            }
        });
        return getGroups(schoolId);
    }

    // ---------------------------------------------------------------- class data
    async function classInfo(classId) {
        const cls = (await read('SELECT id, name, stream, section, school_id FROM classes WHERE id = @class', { class: [sql.Int, classId] })).recordset[0];
        if (!cls) throw fail(404, 'Class not found.');
        return cls;
    }
    async function yearInfo(yearId) {
        const year = (await read('SELECT id, name FROM academic_years WHERE id = @year', { year: [sql.Int, yearId] })).recordset[0];
        if (!year) throw fail(404, 'Academic year not found.');
        return year;
    }
    // Students currently in the class who are not withdrawn (and not recorded against another year).
    async function classStudents(classId, yearId) {
        return (await read(`SELECT id, matricule, firstName, middleName, lastName, CONVERT(char(10), dateOfBirth, 23) AS dateOfBirth, address, parentName
            FROM students WHERE currentClassLevel = @class AND isWithdrawn = 0 AND (academicYearId IS NULL OR academicYearId = @year)
            ORDER BY lastName, firstName, id`, { class: [sql.Int, classId], year: [sql.Int, yearId] })).recordset;
    }
    async function studentRecords(schoolId, classId, yearId, tm) {
        const rows = (await read(`SELECT r.student_id, r.is_repeater, r.council_attendance, r.warnings, r.suspensions, r.council_remark
            FROM report_card_student_terms r JOIN students s ON s.id = r.student_id
            WHERE r.school_id = @school AND r.academic_year_id = @year AND r.term = @term AND s.currentClassLevel = @class`,
        { school: [sql.Int, schoolId], year: [sql.Int, yearId], term: [sql.NVarChar(10), tm], class: [sql.Int, classId] })).recordset;
        return new Map(rows.map(r => [r.student_id, r]));
    }
    const fullName = s => [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ') || s.matricule;

    // ---------------------------------------------------------------- discipline and remarks
    async function getRecords(options) {
        const classId = id(options.classId, 'class'), yearId = id(options.yearId, 'academic year'), tm = term(options.term);
        const cls = await classInfo(classId);
        const [students, records, absent] = await Promise.all([
            classStudents(classId, yearId), studentRecords(cls.school_id, classId, yearId, tm), absences(cls.school_id, { classId, yearId, term: tm }),
        ]);
        return {
            classId, yearId, term: tm,
            students: students.map(s => {
                const r = records.get(s.id) || {};
                return {
                    studentId: s.id, name: fullName(s), matricule: s.matricule, absences: hoursOf(absent.get(s.id)).absentHours,
                    is_repeater: Boolean(r.is_repeater), council_attendance: r.council_attendance || 0, warnings: r.warnings || 0,
                    suspensions: r.suspensions || 0, council_remark: r.council_remark || '',
                };
            }),
        };
    }

    async function saveRecords(actor, options) {
        const classId = id(options.classId, 'class'), yearId = id(options.yearId, 'academic year'), tm = term(options.term);
        if (!Array.isArray(options.records) || options.records.length > 300) throw fail(422, 'Send the class records as a list.');
        const records = options.records.map(r => ({
            studentId: id(r?.studentId, 'student'), isRepeater: r.is_repeater === true,
            councilAttendance: count(r.council_attendance, 'Council attendance'), warnings: count(r.warnings, 'Warnings'),
            suspensions: count(r.suspensions, 'Suspensions'), remark: optionalText(r.council_remark ?? null, 120, 'Class council remark'),
        }));
        const cls = await classInfo(classId);
        await yearInfo(yearId);
        const allowed = new Set((await classStudents(classId, yearId)).map(s => s.id));
        const stranger = records.find(r => !allowed.has(r.studentId));
        if (stranger) throw fail(422, `Student ${stranger.studentId} is not in this class.`);
        await writeTx(async query => {
            for (const r of records) {
                await query(`MERGE report_card_student_terms WITH (HOLDLOCK) AS t
                    USING (SELECT @school AS school_id, @student AS student_id, @year AS academic_year_id, @term AS term) AS s
                    ON t.school_id = s.school_id AND t.student_id = s.student_id AND t.academic_year_id = s.academic_year_id AND t.term = s.term
                    WHEN MATCHED THEN UPDATE SET is_repeater = @rep, council_attendance = @council, warnings = @warnings, suspensions = @susp,
                        council_remark = @remark, updated_by = @actor, updated_at = SYSUTCDATETIME()
                    WHEN NOT MATCHED THEN INSERT (school_id, student_id, academic_year_id, term, is_repeater, council_attendance, warnings, suspensions, council_remark, updated_by)
                        VALUES (@school, @student, @year, @term, @rep, @council, @warnings, @susp, @remark, @actor);`, {
                    school: [sql.Int, cls.school_id], student: [sql.Int, r.studentId], year: [sql.Int, yearId], term: [sql.NVarChar(10), tm],
                    rep: [sql.Bit, r.isRepeater], council: [sql.SmallInt, r.councilAttendance], warnings: [sql.SmallInt, r.warnings],
                    susp: [sql.SmallInt, r.suspensions], remark: [sql.NVarChar(120), r.remark], actor: [sql.Int, actor.id],
                });
            }
        });
        return getRecords({ classId, yearId, term: tm });
    }

    // ---------------------------------------------------------------- report cards
    async function classCards(options) {
        const classId = id(options.classId, 'class'), yearId = id(options.yearId, 'academic year'), tm = term(options.term);
        const studentId = options.studentId ? id(options.studentId, 'student') : null;
        const cls = await classInfo(classId);
        const schoolId = cls.school_id;
        const p = { class: [sql.Int, classId], year: [sql.Int, yearId], school: [sql.Int, schoolId] };

        const [year, settings, reopening, students, records] = await Promise.all([
            yearInfo(yearId), getSettings(schoolId), getReopening(schoolId, { yearId }), classStudents(classId, yearId), studentRecords(schoolId, classId, yearId, tm),
        ]);
        const subjects = (await read(`SELECT cs.id, s.id AS subject_id, s.name,
                CONVERT(float, COALESCE(NULLIF(cs.coefficient, 0), NULLIF(s.coefficient, 0), 1)) AS coefficient,
                gs.group_id, COALESCE(gs.display_order, 0) AS display_order, tch.name AS teacher_name
            FROM class_subjects cs
            JOIN subjects s ON s.id = cs.subject_id
            LEFT JOIN report_card_group_subjects gs ON gs.school_id = @school AND gs.subject_id = s.id
            OUTER APPLY (SELECT TOP 1 t.name FROM class_subject_teachers cst JOIN teachers t ON t.id = cst.teacher_id
                         WHERE cst.class_subject_id = cs.id AND cst.assignment_status = 'active' ORDER BY cst.id) tch
            WHERE cs.class_id = @class ORDER BY COALESCE(gs.display_order, 0), s.name`, p)).recordset;
        const groups = (await read('SELECT id, name, display_order, min_rows FROM report_card_groups WHERE school_id = @school ORDER BY display_order, id', p)).recordset;
        const scores = (await read(`SELECT ss.student_id, ss.class_subject_id, ss.term, ss.sequence, CONVERT(float, ss.score) AS score, CONVERT(float, ss.max_score) AS max_score
            FROM subject_scores ss JOIN class_subjects cs ON cs.id = ss.class_subject_id
            WHERE cs.class_id = @class AND ss.academic_year_id = @year`, p)).recordset;
        const owingRows = (await read(`SELECT c.student_id, CONVERT(float, SUM(CONVERT(decimal(38,0), c.amount) - COALESCE(paid.total, 0))) AS owing
            FROM finance_charges c
            JOIN students st ON st.id = c.student_id AND st.currentClassLevel = @class
            LEFT JOIN finance_cancellations x ON x.school_id = c.school_id AND x.charge_id = c.id
            OUTER APPLY (SELECT SUM(CONVERT(decimal(38,0), f.amount)) AS total FROM finance_payments f
                         WHERE f.school_id = c.school_id AND f.charge_id = c.id
                           AND NOT EXISTS (SELECT 1 FROM finance_reversals r WHERE r.school_id = f.school_id AND r.payment_id = f.id)) paid
            WHERE c.school_id = @school AND c.year_id = @year AND x.charge_id IS NULL
            GROUP BY c.student_id`, p)).recordset;
        const absent = await absences(schoolId, { classId, yearId, term: tm });

        // Subject bands: configured ones, plus a catch-all for subjects not assigned to a band.
        const DEFAULT_GROUP = 'default';
        const engineGroups = groups.map(g => ({ id: String(g.id), name: g.name, order: g.display_order, min_rows: g.min_rows }));
        if (subjects.some(s => s.group_id === null || s.group_id === undefined)) {
            engineGroups.push({ id: DEFAULT_GROUP, name: groups.length ? 'OTHER SUBJECTS' : 'SUBJECTS', order: 9999, min_rows: 0 });
        }
        const classroom = {
            id: String(classId),
            name: `${cls.name}${cls.stream && cls.stream !== 'Normal' ? ' ' + cls.stream : ''}`,
            section: String(cls.section || '').toUpperCase(),
            academic_year: year.name,
            groups: engineGroups,
            subjects: subjects.map((s, i) => ({
                id: String(s.id), name: String(s.name).toUpperCase(), group_id: s.group_id ? String(s.group_id) : DEFAULT_GROUP,
                coefficient: s.coefficient, teacher_name: s.teacher_name || '', order: i,
            })),
        };

        // Marks: the term's sequence 1/2 become global sequences 1-6; scores are converted to /20.
        const marks = [];
        for (const m of scores) {
            const t = TERM_NO[m.term];
            if (!t || ![1, 2].includes(m.sequence) || m.score === null) continue;
            const max = m.max_score > 0 ? m.max_score : config.maxMark;
            marks.push([String(m.student_id), String(m.class_subject_id), (t - 1) * 2 + m.sequence, (m.score / max) * config.maxMark]);
        }

        const engineStudents = students.map(s => ({
            id: String(s.id), matricule: s.matricule || '', full_name: fullName(s), date_of_birth: toIso(s.dateOfBirth),
            photo: null, parent_address: s.address || s.parentName || '', is_repeater: Boolean(records.get(s.id)?.is_repeater),
        }));
        const discipline = {}, councilRemarks = {}, owing = {};
        for (const s of students) {
            const r = records.get(s.id) || {};
            const h = hoursOf(absent.get(s.id));
            discipline[s.id] = { absences: h.absentHours, justified: h.justifiedHours, unjustified: h.unjustifiedHours, lateness: h.lates,
                council_attendance: r.council_attendance || 0, warnings: r.warnings || 0, suspensions: r.suspensions || 0 };
            if (r.council_remark) councilRemarks[s.id] = r.council_remark;
        }
        for (const o of owingRows) owing[o.student_id] = Math.max(0, o.owing || 0);

        const school = {
            name_en: settings.name_en || settings.school_name, name_fr: settings.name_fr || settings.school_name,
            address_line: settings.address_line || '', country_en: settings.country_en, motto_en: settings.motto_en, ministry_en: settings.ministry_en,
            country_fr: settings.country_fr, motto_fr: settings.motto_fr, ministry_fr: settings.ministry_fr,
            logo: image(settings.logo_file), principal_signature: image(settings.signature_file),
            watermark_text: settings.watermark_text || null, footer_text: settings.footer_text || '',
        };
        let cards = buildReportCards(school, classroom, engineStudents, marks, { term: TERM_NO[tm], reopening_date: reopening[tm] },
            { discipline, owing, councilRemarks, config });
        cards = cards.map(c => ({ ...c, council_remark_set: Boolean(councilRemarks[c.student.id]) }));
        if (studentId) cards = cards.filter(c => c.student.id === String(studentId));
        return { classId, yearId, term: tm, className: classroom.name, yearName: year.name, section: cls.section || '', template: settings.card_template, cards };
    }

    return { getSettings, saveSettings, saveTemplate, setImage, getReopening, saveReopening, getGroups, saveGroups, getRecords, saveRecords, classCards };
}

// The school an administrator works in (single-school installs fall back to the only active school).
async function schoolIdFor(user, read = defaultRead) {
    if (Number.isSafeInteger(user?.school_id)) return user.school_id;
    const fromRequest = require('../../utils/tenant').optionalSchoolId();
    if (fromRequest) return fromRequest;
    const rows = (await read("SELECT id FROM schools WHERE status = 'active'")).recordset;
    if (rows.length !== 1) throw fail(409, 'This account is not linked to a school.');
    return rows[0].id;
}

module.exports = { createReportCardService, schoolIdFor, TERMS };
