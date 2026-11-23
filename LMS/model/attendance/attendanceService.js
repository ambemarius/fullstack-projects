// Student attendance: one register per timetabled lesson, versioned marks.
// Teachers mark their own lessons (today and the previous 7 days); administrators and the
// discipline master open and correct any register and justify absences.
const { sql, pool, poolConnect } = require('../../config/database');

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const TERMS = ['First', 'Second', 'Third'];
const STATUSES = ['present', 'absent', 'late'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TEACHER_WINDOW_DAYS = 7;

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function id(v, label = 'record') {
    if (!/^[1-9]\d{0,9}$/.test(String(v)) || Number(v) > 2147483647) throw fail(422, `Choose a ${label}.`);
    return Number(v);
}
function date(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) throw fail(422, 'Enter a valid date.');
    return v;
}
function term(v) { if (!TERMS.includes(v)) throw fail(422, 'Choose a term (First, Second or Third).'); return v; }
function text(v, max, label) {
    if (typeof v !== 'string' || !v.trim() || v.length > max) throw fail(422, `${label} is required (up to ${max} characters).`);
    return v.trim();
}
const weekday = d => DAYS[new Date(d + 'T12:00:00Z').getUTCDay()];
const addDays = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
function minutesBetween(start, end) {
    const [sh, sm] = String(start).split(':').map(Number), [eh, em] = String(end).split(':').map(Number);
    const m = (eh * 60 + em) - (sh * 60 + sm);
    return Number.isFinite(m) && m > 0 ? m : 60;
}

// Latest revision of each student's mark.
const CURRENT_MARKS = `SELECT m.* FROM dbo.attendance_marks m
 WHERE m.school_id=@school AND m.revision=(SELECT MAX(x.revision) FROM dbo.attendance_marks x
   WHERE x.school_id=m.school_id AND x.register_id=m.register_id AND x.student_id=m.student_id)`;
const editorName = `COALESCE(e_ad.name, e_te.name, e_ax.name, 'Former staff member')`;
const editorJoins = t => `
 LEFT JOIN dbo.Admins e_ad ON ${t}.editor_type='admin' AND e_ad.id=${t}.editor_id
 LEFT JOIN dbo.teachers e_te ON ${t}.editor_type='teacher' AND e_te.id=${t}.editor_id
 LEFT JOIN dbo.auxiliary_staff e_ax ON ${t}.editor_type='auxiliary' AND e_ax.id=${t}.editor_id`;

async function defaultTransaction() {
    await poolConnect;
    const tx = pool.transaction();
    return { begin: level => tx.begin(level), commit: () => tx.commit(), rollback: () => tx.rollback(), request: () => new sql.Request(tx) };
}

function createAttendanceService({ beginTransaction = defaultTransaction, clock = today } = {}) {
    const supervisor = actor => actor.type === 'admin' || (actor.duties || []).includes('discipline_master');
    // actor.disciplineClasses: the classes a discipline master looks after, or null/undefined for the whole school.
    const scopeOf = actor => (actor.type === 'admin' || !Array.isArray(actor.disciplineClasses) ? null : actor.disciplineClasses);
    const oversees = (actor, classId) => supervisor(actor) && (scopeOf(actor) === null || scopeOf(actor).includes(Number(classId)));
    const notYourClass = 'You are the discipline master for other classes. Ask an administrator to add this class to your classes.';

    function who(actor) {
        if (!actor || !Number.isSafeInteger(actor.id)) throw fail(401, 'Authentication required');
        if (!Number.isSafeInteger(actor.schoolId)) throw fail(409, 'This account is not linked to a school. Ask your administrator to run school setup.');
        return actor;
    }

    async function read(actor, statement, params = {}) {
        await poolConnect;
        const r = pool.request().input('school', sql.Int, actor.schoolId);
        for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value);
        return r.query(statement);
    }

    async function write(actor, work) {
        const tx = await beginTransaction();
        await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const query = (statement, params = {}) => {
            const r = tx.request().input('school', sql.Int, actor.schoolId)
                .input('editor_type', sql.NVarChar(20), actor.type).input('editor', sql.Int, actor.id);
            for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value);
            return r.query(statement);
        };
        try {
            const result = await work(query);
            await tx.commit();
            return result;
        } catch (error) {
            await tx.rollback().catch(() => {});
            if ([2601, 2627, 1205].includes(error.number)) throw fail(409, 'This register changed while you were saving. Reopen it and try again.');
            throw error;
        }
    }

    function checkDate(actor, lessonDate, { owner, classId }) {
        const now = clock();
        if (lessonDate > now) throw fail(422, 'Attendance cannot be recorded for a future date.');
        if (!oversees(actor, classId)) {
            if (!owner) throw fail(403, 'Only the lesson’s teacher, an administrator or the discipline master can record this register.');
            if (lessonDate < addDays(now, -TEACHER_WINDOW_DAYS)) throw fail(403, `Teachers can record attendance up to ${TEACHER_WINDOW_DAYS} days back. Ask the discipline master to correct older registers.`);
        }
    }

    const LESSONS_SQL = `SELECT t.id timetableId,t.class_id classId,c.section+' — '+c.name+COALESCE(' ('+c.stream+')','') className,
       t.subject_id subjectId,s.name subjectName,t.teacher_id teacherId,te.name teacherName,t.start_time startTime,t.end_time endTime,t.room,
       t.academic_term term,t.academic_year_id yearId,r.id registerId,
       (SELECT COUNT(*) FROM (${CURRENT_MARKS}) cm WHERE cm.register_id=r.id) marked,
       (SELECT COUNT(*) FROM (${CURRENT_MARKS}) cm WHERE cm.register_id=r.id AND cm.status='absent') absent,
       (SELECT COUNT(*) FROM dbo.students p WHERE p.school_id=@school AND p.currentClassLevel=t.class_id AND p.isWithdrawn=0) students
     FROM dbo.timetables t JOIN dbo.classes c ON c.id=t.class_id JOIN dbo.subjects s ON s.id=t.subject_id
     JOIN dbo.teachers te ON te.id=t.teacher_id
     JOIN dbo.academic_years y ON y.id=t.academic_year_id AND y.school_id=@school AND y.isCurrent=1
     LEFT JOIN dbo.attendance_registers r ON r.school_id=@school AND r.class_id=t.class_id AND r.lesson_date=@date AND r.start_time=t.start_time
     WHERE t.school_id=@school AND t.academic_term=@term AND t.day_of_week=@day`;

    async function myLessons(actor, q) {
        who(actor);
        if (actor.type !== 'teacher') throw fail(403, 'Only teachers have their own lessons.');
        const d = date(q.date || clock()), tm = term(q.term || 'First');
        const rows = (await read(actor, LESSONS_SQL + ' AND t.teacher_id=@teacher ORDER BY t.start_time',
            { date: [sql.Date, d], term: [sql.NVarChar(10), tm], day: [sql.NVarChar(10), weekday(d)], teacher: [sql.Int, actor.id] })).recordset;
        return { date: d, day: weekday(d), term: tm, lessons: rows, canMark: d <= clock() && d >= addDays(clock(), -TEACHER_WINDOW_DAYS) };
    }

    async function classLessons(actor, q) {
        who(actor);
        if (!supervisor(actor)) throw fail(403, 'Only administrators and the discipline master can open any class register.');
        const d = date(q.date || clock()), tm = term(q.term || 'First'), classId = id(q.classId, 'class');
        if (!oversees(actor, classId)) throw fail(403, notYourClass);
        const rows = (await read(actor, LESSONS_SQL + ' AND t.class_id=@class ORDER BY t.start_time',
            { date: [sql.Date, d], term: [sql.NVarChar(10), tm], day: [sql.NVarChar(10), weekday(d)], class: [sql.Int, classId] })).recordset;
        return { date: d, day: weekday(d), term: tm, lessons: rows, canMark: d <= clock() };
    }

    async function openRegister(actor, body) {
        who(actor);
        const timetableId = id(body.timetableId, 'lesson'), d = date(body.date);
        return write(actor, async query => {
            const t = (await query(`SELECT t.id,t.class_id,t.subject_id,t.teacher_id,t.day_of_week,t.time_slot_id,t.start_time,t.end_time,t.academic_term,t.academic_year_id
                FROM dbo.timetables t JOIN dbo.academic_years y ON y.id=t.academic_year_id AND y.school_id=@school
                WHERE t.school_id=@school AND t.id=@tt`, { tt: [sql.Int, timetableId] })).recordset[0];
            if (!t) throw fail(404, 'Lesson not found in this school’s timetable.');
            if (t.day_of_week !== weekday(d)) throw fail(422, `This lesson is on ${t.day_of_week}; ${d} is a ${weekday(d)}.`);
            checkDate(actor, d, { owner: actor.type === 'teacher' && actor.id === t.teacher_id, classId: t.class_id });
            const existing = (await query('SELECT id FROM dbo.attendance_registers WHERE school_id=@school AND class_id=@class AND lesson_date=@date AND start_time=@start',
                { class: [sql.Int, t.class_id], date: [sql.Date, d], start: [sql.NVarChar(5), t.start_time] })).recordset[0];
            if (existing) return { id: existing.id, created: false };
            const created = (await query(`INSERT dbo.attendance_registers(school_id,year_id,term,class_id,lesson_date,timetable_id,time_slot_id,subject_id,teacher_id,start_time,end_time,minutes,opened_by_type,opened_by_id)
                OUTPUT inserted.id VALUES(@school,@year,@term,@class,@date,@tt,@slot,@subject,@teacher,@start,@end,@minutes,@editor_type,@editor)`, {
                year: [sql.Int, t.academic_year_id], term: [sql.NVarChar(10), t.academic_term], class: [sql.Int, t.class_id], date: [sql.Date, d],
                tt: [sql.Int, t.id], slot: [sql.Int, t.time_slot_id], subject: [sql.Int, t.subject_id], teacher: [sql.Int, t.teacher_id],
                start: [sql.NVarChar(5), t.start_time], end: [sql.NVarChar(5), t.end_time], minutes: [sql.Int, minutesBetween(t.start_time, t.end_time)],
            })).recordset[0];
            return { id: created.id, created: true };
        });
    }

    async function loadRegister(actor, registerId, run = (s, p) => read(actor, s, p)) {
        const r = (await run(`SELECT r.id,r.year_id yearId,r.term,r.class_id classId,CONVERT(char(10),r.lesson_date,23) lessonDate,r.teacher_id teacherId,
              r.start_time startTime,r.end_time endTime,r.minutes,c.section+' — '+c.name+COALESCE(' ('+c.stream+')','') className,
              s.name subjectName,te.name teacherName
            FROM dbo.attendance_registers r JOIN dbo.classes c ON c.id=r.class_id
            LEFT JOIN dbo.subjects s ON s.id=r.subject_id LEFT JOIN dbo.teachers te ON te.id=r.teacher_id
            WHERE r.school_id=@school AND r.id=@register`, { register: [sql.Int, registerId] })).recordset[0];
        if (!r) throw fail(404, 'Register not found.');
        return r;
    }

    async function getRegister(actor, registerId) {
        who(actor);
        const rid = id(registerId, 'register');
        const register = await loadRegister(actor, rid);
        const owner = actor.type === 'teacher' && actor.id === register.teacherId;
        if (!owner && !oversees(actor, register.classId)) throw fail(403, supervisor(actor) ? notYourClass : 'You can only open registers for your own lessons.');
        const students = (await read(actor, `SELECT p.id studentId,p.firstName+' '+p.lastName name,p.matricule,
              cm.status,cm.minutes_late minutesLate,cm.justified,cm.justification,cm.revision,cm.recorded_at recordedAt
            FROM dbo.students p LEFT JOIN (${CURRENT_MARKS}) cm ON cm.register_id=@register AND cm.student_id=p.id
            WHERE p.school_id=@school AND ((p.currentClassLevel=@class AND p.isWithdrawn=0) OR cm.id IS NOT NULL)
            ORDER BY p.lastName,p.firstName,p.id`, { register: [sql.Int, rid], class: [sql.Int, register.classId] })).recordset;
        let canEdit = true;
        try { checkDate(actor, register.lessonDate, { owner, classId: register.classId }); } catch { canEdit = false; }
        return { register, students, canEdit, canJustify: oversees(actor, register.classId) };
    }

    async function saveMarks(actor, registerId, body) {
        who(actor);
        const rid = id(registerId, 'register');
        const marks = Array.isArray(body.marks) ? body.marks : [];
        if (!marks.length || marks.length > 200) throw fail(422, 'Send between 1 and 200 student marks.');
        const wanted = new Map();
        for (const [i, m] of marks.entries()) {
            const studentId = id(m.studentId, 'student');
            if (wanted.has(studentId)) throw fail(422, `Student ${studentId} appears twice.`);
            if (!STATUSES.includes(m.status)) throw fail(422, `Row ${i + 1}: choose present, absent or late.`);
            let minutesLate = null;
            if (m.status === 'late') {
                minutesLate = Number(m.minutesLate);
                if (!Number.isInteger(minutesLate) || minutesLate < 1 || minutesLate > 600) throw fail(422, `Row ${i + 1}: enter the minutes late (1–600).`);
            }
            wanted.set(studentId, { status: m.status, minutesLate });
        }
        const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 300) : null;
        return write(actor, async query => {
            const register = await loadRegister(actor, rid, query);
            checkDate(actor, register.lessonDate, { owner: actor.type === 'teacher' && actor.id === register.teacherId, classId: register.classId });
            const params = { register: [sql.Int, rid], class: [sql.Int, register.classId] };
            const roster = (await query(`SELECT p.id studentId,cm.status,cm.minutes_late minutesLate,cm.justified,cm.justification,cm.revision
                FROM dbo.students p LEFT JOIN (${CURRENT_MARKS}) cm ON cm.register_id=@register AND cm.student_id=p.id
                WHERE p.school_id=@school AND ((p.currentClassLevel=@class AND p.isWithdrawn=0) OR cm.id IS NOT NULL)`, params)).recordset;
            const byId = new Map(roster.map(r => [r.studentId, r]));
            const changes = [];
            for (const [studentId, next] of wanted) {
                const cur = byId.get(studentId);
                if (!cur) throw fail(422, `Student ${studentId} is not in this class.`);
                if (cur.revision && cur.status === next.status && (cur.minutesLate ?? null) === next.minutesLate) continue;
                if (cur.revision && !reason) throw fail(422, 'Give a reason when correcting a mark that was already saved.');
                const keepJustification = cur.revision && cur.justified && next.status !== 'present' && cur.status !== 'present';
                changes.push({ studentId, ...next, revision: (cur.revision || 0) + 1, previous: cur.status || null,
                    justified: keepJustification ? 1 : 0, justification: keepJustification ? cur.justification : null });
            }
            for (const c of changes) {
                await query(`INSERT dbo.attendance_marks(school_id,register_id,student_id,revision,status,minutes_late,justified,justification,reason,editor_type,editor_id)
                    VALUES(@school,@register,@student,@revision,@status,@late,@justified,@justification,@reason,@editor_type,@editor)`, {
                    register: [sql.Int, rid], student: [sql.Int, c.studentId], revision: [sql.Int, c.revision], status: [sql.VarChar(10), c.status],
                    late: [sql.Int, c.minutesLate], justified: [sql.Bit, c.justified], justification: [sql.NVarChar(300), c.justification],
                    reason: [sql.NVarChar(300), c.revision > 1 ? reason : null],
                });
            }
            return {
                saved: changes.length, unchanged: wanted.size - changes.length,
                newlyAbsent: changes.filter(c => c.status === 'absent' && c.previous !== 'absent').map(c => c.studentId),
                register,
            };
        });
    }

    async function history(actor, registerId, studentId) {
        who(actor);
        const rid = id(registerId, 'register'), sid = id(studentId, 'student');
        const register = await loadRegister(actor, rid);
        if (!(actor.type === 'teacher' && actor.id === register.teacherId) && !oversees(actor, register.classId)) throw fail(403, 'You can only view history for your own lessons.');
        return (await read(actor, `SELECT m.revision,m.status,m.minutes_late minutesLate,m.justified,m.justification,m.reason,m.recorded_at recordedAt,${editorName} editor
            FROM dbo.attendance_marks m ${editorJoins('m')}
            WHERE m.school_id=@school AND m.register_id=@register AND m.student_id=@student ORDER BY m.revision`,
            { register: [sql.Int, rid], student: [sql.Int, sid] })).recordset;
    }

    async function justify(actor, body) {
        who(actor);
        if (!supervisor(actor)) throw fail(403, 'Only administrators and the discipline master can justify absences.');
        const rid = id(body.registerId, 'register'), sid = id(body.studentId, 'student');
        const justification = text(body.justification, 300, 'A justification');
        return write(actor, async query => {
            const register = await loadRegister(actor, rid, query);
            if (!oversees(actor, register.classId)) throw fail(403, notYourClass);
            const cur = (await query(`SELECT cm.* FROM (${CURRENT_MARKS}) cm WHERE cm.register_id=@register AND cm.student_id=@student`,
                { register: [sql.Int, rid], student: [sql.Int, sid] })).recordset[0];
            if (!cur) throw fail(404, 'No mark recorded for this student in this register.');
            if (cur.status === 'present') throw fail(409, 'Only absences and lateness can be justified.');
            if (cur.justified) throw fail(409, 'This absence is already justified.');
            await query(`INSERT dbo.attendance_marks(school_id,register_id,student_id,revision,status,minutes_late,justified,justification,reason,editor_type,editor_id)
                VALUES(@school,@register,@student,@revision,@status,@late,1,@justification,@reason,@editor_type,@editor)`, {
                register: [sql.Int, rid], student: [sql.Int, sid], revision: [sql.Int, cur.revision + 1], status: [sql.VarChar(10), cur.status],
                late: [sql.Int, cur.minutes_late], justification: [sql.NVarChar(300), justification], reason: [sql.NVarChar(300), 'Justified: ' + justification],
            });
            return { justified: true };
        });
    }

    async function absences(actor, q) {
        who(actor);
        if (!supervisor(actor)) throw fail(403, 'Only administrators and the discipline master can review absences.');
        const to = date(q.to || clock()), from = date(q.from || addDays(to, -13));
        if (from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 120) throw fail(422, 'Choose a date range of up to 120 days.');
        const classId = q.classId ? id(q.classId, 'class') : null;
        if (classId && !oversees(actor, classId)) throw fail(403, notYourClass);
        const scope = scopeOf(actor);
        const scopeSql = !classId && scope ? ` AND r.class_id IN (${scope.map(Number).filter(Number.isSafeInteger).join(',') || 'NULL'})` : '';
        const rows = (await read(actor, `SELECT TOP(2001) r.id registerId,r.class_id classId,te.name teacherName,CONVERT(char(10),r.lesson_date,23) lessonDate,r.start_time startTime,r.end_time endTime,r.minutes,
              c.section+' — '+c.name+COALESCE(' ('+c.stream+')','') className,s.name subjectName,
              p.id studentId,p.firstName+' '+p.lastName student,p.matricule,cm.status,cm.minutes_late minutesLate,cm.justified,cm.justification
            FROM dbo.attendance_registers r JOIN (${CURRENT_MARKS}) cm ON cm.register_id=r.id
            JOIN dbo.students p ON p.id=cm.student_id JOIN dbo.classes c ON c.id=r.class_id LEFT JOIN dbo.subjects s ON s.id=r.subject_id
            LEFT JOIN dbo.teachers te ON te.id=r.teacher_id
            WHERE r.school_id=@school AND r.lesson_date BETWEEN @from AND @to AND cm.status<>'present'
              AND (@class IS NULL OR r.class_id=@class) AND (@pending=0 OR cm.justified=0)${scopeSql}
            ORDER BY r.lesson_date DESC,r.start_time,p.lastName,p.firstName`,
            { from: [sql.Date, from], to: [sql.Date, to], class: [sql.Int, classId], pending: [sql.Bit, q.pending === '1' || q.pending === true ? 1 : 0] })).recordset;
        if (rows.length > 2000) throw fail(422, 'More than 2,000 entries. Narrow the dates or choose a class.');
        return { from, to, classId, rows };
    }

    const TOTALS = `COUNT(*) periods,
        SUM(CASE WHEN cm.status='absent' THEN 1 ELSE 0 END) absences,
        SUM(CASE WHEN cm.status='absent' THEN r.minutes ELSE 0 END) absentMinutes,
        SUM(CASE WHEN cm.status='absent' AND cm.justified=1 THEN r.minutes ELSE 0 END) justifiedMinutes,
        SUM(CASE WHEN cm.status='late' THEN 1 ELSE 0 END) lates,
        SUM(CASE WHEN cm.status='late' THEN cm.minutes_late ELSE 0 END) lateMinutes`;
    const hours = row => ({
        periods: row.periods || 0, absences: row.absences || 0, lates: row.lates || 0, lateMinutes: row.lateMinutes || 0,
        absentHours: Math.round((row.absentMinutes || 0) / 6) / 10,
        justifiedHours: Math.round((row.justifiedMinutes || 0) / 6) / 10,
        unjustifiedHours: Math.round(((row.absentMinutes || 0) - (row.justifiedMinutes || 0)) / 6) / 10,
    });

    // Per-student totals for a class and term (report cards, discipline master).
    async function classTotals(schoolActor, { classId, yearId, term: tm }) {
        const rows = (await read(schoolActor, `SELECT cm.student_id studentId,${TOTALS}
            FROM dbo.attendance_registers r JOIN (${CURRENT_MARKS}) cm ON cm.register_id=r.id
            WHERE r.school_id=@school AND r.class_id=@class AND r.year_id=@year AND r.term=@term
            GROUP BY cm.student_id`, { class: [sql.Int, classId], year: [sql.Int, yearId], term: [sql.NVarChar(10), tm] })).recordset;
        return new Map(rows.map(r => [r.studentId, hours(r)]));
    }

    async function classSummary(actor, q) {
        who(actor);
        if (!supervisor(actor)) throw fail(403, 'Only administrators and the discipline master can view class attendance.');
        const classId = id(q.classId, 'class'), yearId = id(q.yearId, 'academic year'), tm = term(q.term);
        if (!oversees(actor, classId)) throw fail(403, notYourClass);
        const totals = await classTotals(actor, { classId, yearId, term: tm });
        const students = (await read(actor, `SELECT id studentId,firstName+' '+lastName name,matricule FROM dbo.students
            WHERE school_id=@school AND currentClassLevel=@class AND isWithdrawn=0 ORDER BY lastName,firstName`, { class: [sql.Int, classId] })).recordset;
        return { classId, yearId, term: tm, students: students.map(p => ({ ...p, ...hours({}), ...(totals.get(p.studentId) || {}) })) };
    }

    // One student's totals plus recent absences; callers must already have checked access.
    async function studentSummary(schoolActor, { studentId, yearId, term: tm }) {
        const sid = id(studentId, 'student');
        const year = yearId ? id(yearId, 'academic year')
            : (await read(schoolActor, 'SELECT id FROM dbo.academic_years WHERE school_id=@school AND isCurrent=1')).recordset[0]?.id ?? null;
        const filters = { student: [sql.Int, sid], year: [sql.Int, year], term: [sql.NVarChar(10), tm ? term(tm) : null] };
        const where = `r.school_id=@school AND cm.student_id=@student AND (@year IS NULL OR r.year_id=@year) AND (@term IS NULL OR r.term=@term)`;
        const total = (await read(schoolActor, `SELECT ${TOTALS} FROM dbo.attendance_registers r JOIN (${CURRENT_MARKS}) cm ON cm.register_id=r.id WHERE ${where}`, filters)).recordset[0] || {};
        const recent = (await read(schoolActor, `SELECT TOP(20) CONVERT(char(10),r.lesson_date,23) lessonDate,r.start_time startTime,r.end_time endTime,r.term,
              s.name subjectName,cm.status,cm.minutes_late minutesLate,cm.justified,cm.justification
            FROM dbo.attendance_registers r JOIN (${CURRENT_MARKS}) cm ON cm.register_id=r.id LEFT JOIN dbo.subjects s ON s.id=r.subject_id
            WHERE ${where} AND cm.status<>'present' ORDER BY r.lesson_date DESC,r.start_time DESC`, filters)).recordset;
        return { studentId: sid, yearId: year, term: tm || null, ...hours(total), recent };
    }

    // Class and year lists for the supervisors' attendance page.
    async function options(actor) {
        who(actor);
        if (!supervisor(actor)) throw fail(403, 'Only administrators and the discipline master can view class attendance.');
        const scope = scopeOf(actor);
        const classes = (await read(actor, `SELECT id,section+' — '+name+COALESCE(' ('+stream+')','') label FROM dbo.classes WHERE school_id=@school ORDER BY section,rank,name`)).recordset
            .filter(c => scope === null || scope.includes(c.id));
        const years = (await read(actor, 'SELECT id,name label,isCurrent FROM dbo.academic_years WHERE school_id=@school ORDER BY fromYear DESC')).recordset;
        return { classes, years, today: clock(), wholeSchool: scope === null };
    }

    return { options, myLessons, classLessons, openRegister, getRegister, saveMarks, history, justify, absences, classSummary, classTotals, studentSummary, supervisor, oversees };
}

module.exports = { createAttendanceService, TERMS, weekday, minutesBetween, today };
