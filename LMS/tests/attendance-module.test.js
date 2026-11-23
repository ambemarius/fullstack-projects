const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../app/app');
const { withDatabase } = require('../config/database');
const generateToken = require('../utils/generateToken');
const { createAttendanceService, weekday, minutesBetween } = require('../model/attendance/attendanceService');
const { syntheticDatabase } = require('./helpers/database');
const { serve } = require('./helpers/http');

const TODAY = '2026-11-16'; // a Monday
const clock = () => TODAY;
const teacher = { schoolId: 1, type: 'teacher', id: 7, name: 'T', duties: [] };
const otherTeacher = { ...teacher, id: 8 };
const disciplineMaster = { schoolId: 1, type: 'auxiliary', id: 5, name: 'DM', duties: ['discipline_master'] };
const bursar = { schoolId: 1, type: 'auxiliary', id: 6, name: 'B', duties: ['bursar'] };
const lesson = { id: 30, class_id: 2, subject_id: 3, teacher_id: 7, day_of_week: 'Monday', time_slot_id: 1, start_time: '07:30', end_time: '08:30', academic_term: 'First', academic_year_id: 5 };
const registerRow = (over = {}) => ({ id: 90, yearId: 5, term: 'First', classId: 2, lessonDate: TODAY, teacherId: 7, startTime: '07:30', endTime: '08:30', minutes: 60, className: 'Form 1', subjectName: 'Maths', teacherName: 'T', ...over });

function fakeTransactions(answer) {
    const log = [];
    const beginTransaction = async () => {
        const state = { statements: [], committed: false, rolledBack: false };
        log.push(state);
        return {
            begin: async () => {}, commit: async () => { state.committed = true; }, rollback: async () => { state.rolledBack = true; },
            request() {
                const params = {};
                return { input(n, _t, v) { params[n] = v; return this; }, query: async s => { state.statements.push({ statement: s, params }); return answer(s, params); } };
            },
        };
    };
    return { log, beginTransaction };
}

test('helpers: weekday and lesson length', () => {
    assert.equal(weekday('2026-11-16'), 'Monday');
    assert.equal(minutesBetween('09:30', '10:15'), 45);
    assert.equal(minutesBetween('bad', 'x'), 60);
});

test('only the lesson’s teacher (within 7 days) or a discipline master can open a register; never for a future date', async () => {
    const { log, beginTransaction } = fakeTransactions(statement => {
        if (statement.includes('FROM dbo.timetables t')) return { recordset: [lesson] };
        if (statement.includes('SELECT id FROM dbo.attendance_registers')) return { recordset: [] };
        if (statement.includes('INSERT dbo.attendance_registers')) return { recordset: [{ id: 90 }] };
        throw new Error('unexpected ' + statement);
    });
    const service = createAttendanceService({ beginTransaction, clock });
    assert.deepEqual(await service.openRegister(teacher, { timetableId: 30, date: TODAY }), { id: 90, created: true });
    const insert = log[0].statements.find(s => s.statement.includes('INSERT dbo.attendance_registers'));
    assert.deepEqual([insert.params.minutes, insert.params.term, insert.params.editor_type, insert.params.editor], [60, 'First', 'teacher', 7]);

    await assert.rejects(service.openRegister(otherTeacher, { timetableId: 30, date: TODAY }), { statusCode: 403 });
    await assert.rejects(service.openRegister(teacher, { timetableId: 30, date: '2026-11-23' }), { statusCode: 422, message: /future/ });
    await assert.rejects(service.openRegister(teacher, { timetableId: 30, date: '2026-11-02' }), { statusCode: 403, message: /7 days/ });
    await assert.rejects(service.openRegister(teacher, { timetableId: 30, date: '2026-11-17' }), { statusCode: 422 }, 'future Tuesday');
    await assert.rejects(service.openRegister(teacher, { timetableId: 30, date: '2026-11-13' }), { statusCode: 422, message: /on Monday/ });
    assert.deepEqual(await service.openRegister(disciplineMaster, { timetableId: 30, date: '2026-11-02' }), { id: 90, created: true });
    await assert.rejects(service.openRegister(bursar, { timetableId: 30, date: TODAY }), { statusCode: 403 });
});

test('saving marks versions every change and demands a reason for corrections', async () => {
    let roster = [
        { studentId: 1, status: null, minutesLate: null, justified: false, justification: null, revision: null },
        { studentId: 2, status: null, minutesLate: null, justified: false, justification: null, revision: null },
    ];
    const { log, beginTransaction } = fakeTransactions(statement => {
        if (statement.includes('FROM dbo.attendance_registers r JOIN dbo.classes')) return { recordset: [registerRow()] };
        if (statement.includes('FROM dbo.students p LEFT JOIN')) return { recordset: roster };
        if (statement.includes('INSERT dbo.attendance_marks')) return { recordset: [] };
        throw new Error('unexpected ' + statement);
    });
    const service = createAttendanceService({ beginTransaction, clock });
    const first = await service.saveMarks(teacher, 90, { marks: [{ studentId: 1, status: 'present' }, { studentId: 2, status: 'absent' }] });
    assert.equal(first.saved, 2);
    assert.deepEqual(first.newlyAbsent, [2]);
    const inserts = log[0].statements.filter(s => s.statement.includes('INSERT dbo.attendance_marks'));
    assert.deepEqual(inserts.map(i => [i.params.student, i.params.revision, i.params.reason]), [[1, 1, null], [2, 1, null]]);

    roster = [
        { studentId: 1, status: 'present', minutesLate: null, justified: false, justification: null, revision: 1 },
        { studentId: 2, status: 'absent', minutesLate: null, justified: true, justification: 'Medical note', revision: 2 },
    ];
    const unchanged = await service.saveMarks(teacher, 90, { marks: [{ studentId: 1, status: 'present' }, { studentId: 2, status: 'absent' }] });
    assert.deepEqual([unchanged.saved, unchanged.unchanged], [0, 2]);
    await assert.rejects(service.saveMarks(teacher, 90, { marks: [{ studentId: 1, status: 'late', minutesLate: 10 }] }), { statusCode: 422, message: /reason/ });
    await assert.rejects(service.saveMarks(teacher, 90, { marks: [{ studentId: 1, status: 'late' }], reason: 'x' }), { statusCode: 422, message: /minutes late/ });
    await assert.rejects(service.saveMarks(teacher, 90, { marks: [{ studentId: 99, status: 'present' }] }), { statusCode: 422, message: /not in this class/ });
    await assert.rejects(service.saveMarks(otherTeacher, 90, { marks: [{ studentId: 1, status: 'present' }] }), { statusCode: 403 });

    const corrected = await service.saveMarks(teacher, 90, { marks: [{ studentId: 1, status: 'late', minutesLate: 10 }, { studentId: 2, status: 'late', minutesLate: 5 }], reason: 'Arrived after the register' });
    assert.equal(corrected.saved, 2);
    const fix = log.at(-1).statements.filter(s => s.statement.includes('INSERT dbo.attendance_marks'));
    assert.deepEqual(fix.map(i => [i.params.student, i.params.revision, i.params.late, i.params.reason]),
        [[1, 2, 10, 'Arrived after the register'], [2, 3, 5, 'Arrived after the register']]);
    assert.equal(fix[1].params.justified, 1, 'a justified absence stays justified when it becomes lateness');
});

test('only supervisors justify, and only absences or lateness', async () => {
    let current = { revision: 1, status: 'absent', minutes_late: null, justified: false };
    const { log, beginTransaction } = fakeTransactions(statement => {
        if (statement.includes('SELECT cm.*')) return { recordset: [current] };
        if (statement.includes('INSERT dbo.attendance_marks')) return { recordset: [] };
        throw new Error('unexpected ' + statement);
    });
    const service = createAttendanceService({ beginTransaction, clock });
    await assert.rejects(service.justify(teacher, { registerId: 90, studentId: 2, justification: 'note' }), { statusCode: 403 });
    await assert.rejects(service.justify(disciplineMaster, { registerId: 90, studentId: 2, justification: '  ' }), { statusCode: 422 });
    await service.justify(disciplineMaster, { registerId: 90, studentId: 2, justification: 'Medical certificate 14/11' });
    const insert = log.at(-1).statements.find(s => s.statement.includes('INSERT dbo.attendance_marks'));
    assert.deepEqual([insert.params.revision, insert.params.status, insert.params.justification, insert.params.editor_type], [2, 'absent', 'Medical certificate 14/11', 'auxiliary']);
    current = { revision: 1, status: 'present', minutes_late: null, justified: false };
    await assert.rejects(service.justify(disciplineMaster, { registerId: 90, studentId: 2, justification: 'x' }), { statusCode: 409 });
});

test('attendance API keeps students, parents and bursars out of registers, and parents to their own children', async t => {
    const db = syntheticDatabase((statement, params) => {
        if (statement.includes('FROM teachers WHERE id')) return { recordset: [{ id: 7, status: 'active', name: 'T', school_id: 1 }] };
        if (statement.includes('FROM Admins WHERE id')) return { recordset: [{ id: 1, role: 'admin', name: 'A', school_id: 1 }] };
        if (statement.includes('FROM auxiliary_staff WHERE id')) return { recordset: [{ id: 6, status: 'active', canSignIn: true, name: 'B', school_id: 1 }] };
        if (statement.includes('FROM staff_duties')) return { recordset: params.type === 'auxiliary' ? [{ duty: 'bursar' }] : [] };
        if (statement.includes('FROM parents WHERE id')) return { recordset: [{ id: 4, status: 'active', firstName: 'P', lastName: 'G' }] };
        if (statement.includes('FROM parent_students WHERE parent_id')) return { recordset: [] };
        throw new Error('unexpected statement: ' + statement);
    });
    const base = await serve(t, createApp({ logging: false, requestContext: (_req, _res, next) => withDatabase(db, next) }));
    const get = (url, token) => fetch(base + url, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal((await get('/api/v1/attendance/registers/90', generateToken(3, 'student'))).status, 403);
    assert.equal((await get('/api/v1/attendance/registers/90', generateToken(4, 'parent'))).status, 403);
    assert.equal((await get('/api/v1/attendance/registers/90', generateToken(6, 'auxiliary'))).status, 403, 'a bursar is not a discipline master');
    assert.equal((await get('/api/v1/attendance/absences', generateToken(7, 'teacher'))).status, 403, 'teachers cannot review the whole school');
    assert.equal((await get('/api/v1/attendance/my-lessons', generateToken(1, 'admin'))).status, 403);
    assert.equal((await get('/api/v1/attendance/children/42', generateToken(4, 'parent'))).status, 403, 'unlinked child');
    assert.equal((await fetch(base + '/api/v1/attendance/me')).status, 401);
});

test('migration 013 versions marks, requires reasons for corrections, and never deletes', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/013_attendance.sql'), 'utf8');
    assert.match(sql, /CREATE TABLE dbo\.attendance_registers/);
    assert.match(sql, /CREATE TABLE dbo\.attendance_marks/);
    assert.match(sql, /CK_attendance_marks_reason CHECK \(revision = 1 OR/);
    assert.match(sql, /UX_attendance_register_lesson ON dbo\.attendance_registers\(school_id, class_id, lesson_date, start_time\)/);
    assert.equal(/\bDROP\b|\bDELETE\b|school_memberships/i.test(sql), false);
});
