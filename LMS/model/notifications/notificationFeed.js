// Notification bell: the key items for the signed-in account, worked out from the school's own data each time
// (nothing is copied into a notifications table). Row-level security keeps every query inside the school.
//   everyone         school announcements for their audience, shown between their dates
//   teachers         lesson now / next lesson today, registers not taken yet today, lab requests ready or overdue
//   administrators   registers not taken yet today across the school
//   students         new marks and absences in the last 7 days
//   parents          the same for each linked child, and fees still owed this year
const { sql, pool, poolConnect } = require('../../config/database');

const ZONE = 'Africa/Douala';
const AUDIENCES = {
    admin: ['everyone', 'staff', 'teachers', 'students', 'parents'],
    teacher: ['everyone', 'staff', 'teachers'],
    auxiliary: ['everyone', 'staff'],
    student: ['everyone', 'students'],
    parent: ['everyone', 'parents'],
};
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Today's date, weekday, time and term in Cameroon.
function schoolClock(now = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'long' })
        .formatToParts(now).map(p => [p.type, p.value]));
    const month = Number(parts.month);
    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        day: parts.weekday,
        time: `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`,
        term: month >= 9 ? 'First' : month <= 3 ? 'Second' : 'Third',
    };
}
const minutes = hhmm => { const [h, m] = String(hhmm).slice(0, 5).split(':').map(Number); return h * 60 + m; };
const hm = v => String(v || '').slice(0, 5);
const classLabel = r => `${r.class_name}${r.stream && r.stream !== 'Normal' ? ' ' + r.stream : ''}`;

async function defaultQuery(statement, params = {}) {
    await poolConnect;
    const r = pool.request();
    for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value);
    return r.query(statement);
}

function createNotificationFeed({ query = defaultQuery, clock = () => new Date() } = {}) {
    async function announcements(actor, today) {
        const audiences = AUDIENCES[actor.type] || ['everyone'];
        const rows = (await query(`SELECT id, title, body, audience, starts_on, ends_on, created_at FROM school_announcements
            WHERE school_id = @school AND starts_on <= @today AND ends_on >= @today AND audience IN (${audiences.map((_, i) => '@a' + i).join(',')})
            ORDER BY starts_on DESC, id DESC`,
        { school: [sql.Int, actor.schoolId], today: [sql.Date, today], ...Object.fromEntries(audiences.map((a, i) => ['a' + i, [sql.VarChar(12), a]])) })).recordset;
        return rows.map(r => ({ id: `announcement:${r.id}`, kind: 'announcement', level: 'info', title: r.title, detail: r.body || '', at: r.created_at }));
    }

    async function teacherItems(actor, c) {
        const items = [];
        const lessons = (await query(`SELECT t.start_time, t.end_time, t.room, s.name AS subject, c.name AS class_name, c.stream,
                (SELECT COUNT(*) FROM attendance_registers r WHERE r.school_id = @school AND r.class_id = t.class_id AND r.lesson_date = @today AND r.start_time = t.start_time) AS taken
            FROM timetables t JOIN subjects s ON s.id = t.subject_id JOIN classes c ON c.id = t.class_id
            JOIN academic_years y ON y.id = t.academic_year_id AND y.isCurrent = 1
            WHERE t.school_id = @school AND t.teacher_id = @teacher AND t.day_of_week = @day AND t.academic_term = @term AND s.name NOT LIKE '%study%'
            ORDER BY t.start_time`,
        { school: [sql.Int, actor.schoolId], teacher: [sql.Int, actor.id], day: [sql.NVarChar(10), c.day], term: [sql.NVarChar(10), c.term], today: [sql.Date, c.date] })).recordset;
        const now = minutes(c.time);
        const current = lessons.find(l => minutes(l.start_time) <= now && minutes(l.end_time) > now);
        const next = lessons.find(l => minutes(l.start_time) > now);
        if (current) items.push({ id: `lesson:now:${c.date}:${hm(current.start_time)}`, kind: 'lesson', level: 'info', title: `Now: ${current.subject}, ${classLabel(current)}`,
            detail: `Until ${hm(current.end_time)}${current.room ? ' · ' + current.room : ''}`, link: '/teacher-dashboard#attendance', at: `${c.date}T${hm(current.start_time)}` });
        if (next && minutes(next.start_time) - now <= 120) items.push({ id: `lesson:next:${c.date}:${hm(next.start_time)}`, kind: 'lesson', level: 'info',
            title: `Next lesson at ${hm(next.start_time)}: ${next.subject}, ${classLabel(next)}`, detail: `In ${minutes(next.start_time) - now} minutes${next.room ? ' · ' + next.room : ''}`,
            link: '/teacher-dashboard#timetable', at: `${c.date}T${hm(next.start_time)}` });
        const missing = lessons.filter(l => !l.taken && minutes(l.start_time) <= now);
        if (missing.length) items.push({ id: `registers:${c.date}:${missing.length}`, kind: 'register', level: 'warn',
            title: missing.length === 1 ? 'Register not taken yet' : `${missing.length} registers not taken yet`,
            detail: missing.map(l => `${hm(l.start_time)} ${l.subject}, ${classLabel(l)}`).join(' · '), link: '/teacher-dashboard#attendance', at: `${c.date}T${hm(missing[0].start_time)}` });

        const lab = (await query(`SELECT r.id, r.status, CONVERT(char(10), r.return_by, 23) AS return_by, CONVERT(char(10), r.needed_on, 23) AS needed_on, i.name
            FROM lab_requests r JOIN lab_items i ON i.id = r.item_id
            WHERE r.school_id = @school AND r.requested_by_type = 'teacher' AND r.requested_by_id = @teacher
              AND (r.status = 'approved' OR (r.status = 'issued' AND r.return_by < @today))`,
        { school: [sql.Int, actor.schoolId], teacher: [sql.Int, actor.id], today: [sql.Date, c.date] })).recordset;
        for (const r of lab) {
            items.push(r.status === 'approved'
                ? { id: `lab:approved:${r.id}`, kind: 'lab', level: 'info', title: `Lab request approved: ${r.name}`, detail: r.needed_on ? `Needed on ${r.needed_on}` : 'Ready to collect', link: '/teacher-dashboard#lab', at: r.needed_on }
                : { id: `lab:overdue:${r.id}`, kind: 'lab', level: 'warn', title: `Return overdue: ${r.name}`, detail: `Was due on ${r.return_by}`, link: '/teacher-dashboard#lab', at: r.return_by });
        }
        return items;
    }

    async function adminItems(actor, c) {
        const row = (await query(`SELECT COUNT(*) AS missing FROM timetables t
            JOIN academic_years y ON y.id = t.academic_year_id AND y.isCurrent = 1 JOIN subjects s ON s.id = t.subject_id
            WHERE t.school_id = @school AND t.day_of_week = @day AND t.academic_term = @term AND t.start_time <= @now AND s.name NOT LIKE '%study%'
              AND NOT EXISTS (SELECT 1 FROM attendance_registers r WHERE r.school_id = @school AND r.class_id = t.class_id AND r.lesson_date = @today AND r.start_time = t.start_time)`,
        { school: [sql.Int, actor.schoolId], day: [sql.NVarChar(10), c.day], term: [sql.NVarChar(10), c.term], now: [sql.VarChar(8), c.time + ':00'], today: [sql.Date, c.date] })).recordset[0];
        return row && row.missing ? [{ id: `registers:school:${c.date}:${row.missing}`, kind: 'register', level: 'warn',
            title: `${row.missing} register${row.missing === 1 ? '' : 's'} not taken yet today`, detail: 'Lessons that have started without attendance.', link: '/attendance', at: `${c.date}T${c.time}` }] : [];
    }

    // New marks and absences in the last 7 days for one or more students.
    async function pupilItems(actor, students, c, { prefixNames = false } = {}) {
        if (!students.length) return [];
        const ids = students.map(s => s.id);
        const params = { school: [sql.Int, actor.schoolId], since: [sql.Date, addDays(c.date, -7)], ...Object.fromEntries(ids.map((id, i) => ['s' + i, [sql.Int, id]])) };
        const list = ids.map((_, i) => '@s' + i).join(',');
        const marks = (await query(`SELECT ss.student_id, s.name AS subject, ss.term, ss.sequence, CONVERT(float, ss.score) AS score, CONVERT(float, ss.max_score) AS max_score, ss.updated_at
            FROM subject_scores ss JOIN class_subjects cs ON cs.id = ss.class_subject_id JOIN subjects s ON s.id = cs.subject_id
            WHERE ss.school_id = @school AND ss.student_id IN (${list}) AND ss.updated_at >= @since AND ss.score IS NOT NULL
            ORDER BY ss.updated_at DESC`, params)).recordset;
        const absences = (await query(`SELECT m.student_id, CONVERT(char(10), r.lesson_date, 23) AS lesson_date, r.start_time, s.name AS subject, m.status
            FROM attendance_marks m JOIN attendance_registers r ON r.id = m.register_id LEFT JOIN subjects s ON s.id = r.subject_id
            WHERE m.school_id = @school AND m.student_id IN (${list}) AND r.lesson_date >= @since AND m.status IN ('absent', 'late')
              AND m.revision = (SELECT MAX(x.revision) FROM attendance_marks x WHERE x.school_id = m.school_id AND x.register_id = m.register_id AND x.student_id = m.student_id)
            ORDER BY r.lesson_date DESC, r.start_time DESC`, params)).recordset;
        const name = id => (prefixNames ? (students.find(s => s.id === id)?.name || '') + ': ' : '');
        const seqNo = m => ({ First: 0, Second: 2, Third: 4 }[m.term] || 0) + m.sequence;
        const items = [];
        const byStudent = new Map();
        for (const m of marks) (byStudent.get(m.student_id) || byStudent.set(m.student_id, []).get(m.student_id)).push(m);
        for (const [sid, ms] of byStudent) {
            const latest = ms[0];
            const out20 = latest.max_score > 0 ? Math.round((latest.score / latest.max_score) * 2000) / 100 : latest.score;
            items.push({ id: `marks:${sid}:${ms.length}:${new Date(latest.updated_at).getTime()}`, kind: 'mark', level: 'info',
                title: `${name(sid)}${ms.length === 1 ? 'New mark' : `${ms.length} new marks`}`,
                detail: `Latest: ${latest.subject}, Seq. ${seqNo(latest)}: ${out20}/20`, link: actor.type === 'parent' ? '/parent-dashboard#results' : '/student-dashboard#results', at: latest.updated_at });
        }
        const absBy = new Map();
        for (const a of absences) (absBy.get(a.student_id) || absBy.set(a.student_id, []).get(a.student_id)).push(a);
        for (const [sid, list2] of absBy) {
            const abs = list2.filter(a => a.status === 'absent').length, late = list2.length - abs;
            const last = list2[0];
            items.push({ id: `attendance:${sid}:${list2.length}:${last.lesson_date}`, kind: 'absence', level: abs ? 'warn' : 'info',
                title: `${name(sid)}${[abs ? `${abs} absence${abs === 1 ? '' : 's'}` : '', late ? `${late} late arrival${late === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ')} this week`,
                detail: `Last: ${last.lesson_date}${last.subject ? ', ' + last.subject : ''}`, link: actor.type === 'parent' ? '/parent-dashboard#attendance' : '/student-dashboard#attendance', at: last.lesson_date });
        }
        return items;
    }

    async function parentItems(actor, c) {
        const children = (await query(`SELECT st.id, COALESCE(st.firstName + ' ', '') + COALESCE(st.lastName, '') AS name
            FROM parent_students ps JOIN students st ON st.id = ps.student_id
            WHERE ps.parent_id = @parent AND st.school_id = @school AND st.isWithdrawn = 0`,
        { parent: [sql.Int, actor.id], school: [sql.Int, actor.schoolId] })).recordset.map(r => ({ id: r.id, name: r.name.trim() }));
        const items = await pupilItems(actor, children, c, { prefixNames: children.length > 1 });
        if (children.length) {
            const owing = (await query(`SELECT c.student_id, CONVERT(float, SUM(CONVERT(decimal(38,0), c.amount) - COALESCE(paid.total, 0))) AS owing
                FROM finance_charges c
                JOIN academic_years y ON y.id = c.year_id AND y.isCurrent = 1
                LEFT JOIN finance_cancellations x ON x.school_id = c.school_id AND x.charge_id = c.id
                OUTER APPLY (SELECT SUM(CONVERT(decimal(38,0), f.amount)) AS total FROM finance_payments f
                             WHERE f.school_id = c.school_id AND f.charge_id = c.id
                               AND NOT EXISTS (SELECT 1 FROM finance_reversals r WHERE r.school_id = f.school_id AND r.payment_id = f.id)) paid
                WHERE c.school_id = @school AND x.charge_id IS NULL AND c.student_id IN (${children.map((_, i) => '@c' + i).join(',')})
                GROUP BY c.student_id`,
            { school: [sql.Int, actor.schoolId], ...Object.fromEntries(children.map((ch, i) => ['c' + i, [sql.Int, ch.id]])) })).recordset;
            for (const o of owing) {
                if (!(o.owing > 0)) continue;
                const child = children.find(ch => ch.id === o.student_id);
                items.push({ id: `fees:${o.student_id}:${Math.round(o.owing)}`, kind: 'fees', level: 'warn',
                    title: `${children.length > 1 && child ? child.name + ': ' : ''}Fees outstanding`, detail: `${Math.round(o.owing).toLocaleString('en-US').replace(/,/g, ' ')} FCFA still to pay this year`,
                    link: '/parent-dashboard', at: c.date });
            }
        }
        return items;
    }

    // actor: { type, id, schoolId }
    async function feed(actor) {
        if (!actor || !actor.schoolId || !AUDIENCES[actor.type]) return { items: [], clock: null };
        const c = schoolClock(clock());
        const lists = [announcements(actor, c.date)];
        if (actor.type === 'teacher') lists.push(teacherItems(actor, c));
        if (actor.type === 'admin') lists.push(adminItems(actor, c));
        if (actor.type === 'student') lists.push(pupilItems(actor, [{ id: actor.id, name: '' }], c));
        if (actor.type === 'parent') lists.push(parentItems(actor, c));
        const items = (await Promise.all(lists)).flat()
            .map(i => ({ ...i, at: i.at instanceof Date ? i.at.toISOString() : i.at ? String(i.at) : '' }));
        const rank = { warn: 0, info: 1 };
        items.sort((a, b) => rank[a.level] - rank[b.level] || String(b.at || '').localeCompare(String(a.at || '')));
        return { items: items.slice(0, 30), clock: c };
    }

    return { feed, schoolClock };
}

function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

module.exports = { createNotificationFeed, schoolClock, AUDIENCES, DAYS };
