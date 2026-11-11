const asyncHandler = require('express-async-handler');
const Timetable = require('../../model/Academic/timetable');
const TimeSlot = require('../../model/Academic/timeSlot');
const ClassModel = require('../../model/Academic/class');
const SubjectModel = require('../../model/Academic/subject');
const TeacherModel = require('../../model/staff/teacher');
const AcademicYearModel = require('../../model/Academic/academicYear');
const SubjectAllocation = require('../../model/Academic/subjectAllocation');
const ClassSubject = require('../../model/Academic/classSubject');

const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const DEFAULT_TERM = () => {
    const m = new Date().getMonth() + 1;
    if (m >= 9 && m <= 12) return 'First';
    if (m >= 1 && m <= 3) return 'Second';
    return 'Third';
};

//@desc   Create a timetable entry
//@route  POST /api/v1/timetables
exports.createEntryCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedTimetablesEnabled)return res.status(201).json({status:'success',data:await require('./scopedLegacyTimetable').handle(req,'create')});
    const { class_id, subject_id, teacher_id, day_of_week, time_slot_id, start_time, end_time, room, academic_term, academic_year_id } = req.body;

    if (!class_id || !subject_id || !teacher_id || !day_of_week || !time_slot_id || !academic_term || !academic_year_id) {
        return res.status(400).json({ status: 'error', message: 'class_id, subject_id, teacher_id, day_of_week, time_slot_id, academic_term, academic_year_id are required' });
    }

    const entry = await Timetable.create({
        class_id, subject_id, teacher_id, day_of_week, time_slot_id,
        start_time: start_time || null, end_time: end_time || null, room,
        academic_term, academic_year_id, created_by: req.userAuth.id,
    });
    res.status(201).json({ status: 'success', data: entry });
});

//@desc   Get full grid timetable for a class
//@route  GET /api/v1/timetables/class/:classId/grid?term=&yearId=
exports.getClassGridCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedTimetablesEnabled)return res.status(200).json({status:'success',data:await require('./scopedLegacyTimetable').handle(req,'grid')});
    const term = req.query.term || DEFAULT_TERM();
    const yearId = req.query.yearId || (await AcademicYearModel.findCurrent())?.id;
    const slots = await TimeSlot.getAll();
    const entries = await Timetable.getGridByClass(req.params.classId, term, yearId);
    const allocations = await SubjectAllocation.getByClass(req.params.classId, yearId);
    res.status(200).json({ status: 'success', data: { slots, entries, allocations } });
});

//@desc   Get timetable for a class (flat list)
//@route  GET /api/v1/timetables/class/:classId?term=&yearId=
exports.getClassTimetableCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedTimetablesEnabled)return res.status(200).json({status:'success',data:await require('./scopedLegacyTimetable').handle(req,'class')});
    const term = req.query.term || DEFAULT_TERM();
    const yearId = req.query.yearId || (await AcademicYearModel.findCurrent())?.id;
    const entries = await Timetable.getByClass(req.params.classId, term, yearId);
    res.status(200).json({ status: 'success', data: entries });
});

//@desc   Get timetable for logged-in teacher
//@route  GET /api/v1/timetables/teacher?term=&yearId=
exports.getTeacherTimetableCtrl = asyncHandler(async (req, res) => {
    const term = req.query.term || DEFAULT_TERM();
    const yearId = req.query.yearId || (await AcademicYearModel.findCurrent())?.id;
    const entries = await Timetable.getByTeacher(req.userAuth.id, term, yearId);
    res.status(200).json({ status: 'success', data: entries });
});

//@desc   Get timetable for logged-in student
//@route  GET /api/v1/timetables/student?term=&yearId=
exports.getStudentTimetableCtrl = asyncHandler(async (req, res) => {
    const term = req.query.term || DEFAULT_TERM();
    const yearId = req.query.yearId || (await AcademicYearModel.findCurrent())?.id;
    const entries = await Timetable.getByStudent(req.userAuth.id, term, yearId);
    res.status(200).json({ status: 'success', data: entries });
});

//@desc   Get all entries grouped by section
//@route  GET /api/v1/timetables?term=&yearId=&section=
exports.getAllEntriesCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedTimetablesEnabled)return res.status(200).json({status:'success',data:await require('./scopedLegacyTimetable').handle(req,'all')});
    const term = req.query.term || DEFAULT_TERM();
    const yearId = req.query.yearId || (await AcademicYearModel.findCurrent())?.id;
    const section = req.query.section;
    let entries = await Timetable.getAll(term, yearId);
    if (section) entries = entries.filter(e => e.section === section);
    res.status(200).json({ status: 'success', data: entries });
});

//@desc   Auto-generate a class's timetable from its subject allocations
//@route  POST /api/v1/timetables/generate/class/:classId
//@access Private (admin)
exports.generateClassCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedTimetablesEnabled){const result=await require('./scopedLegacyTimetable').handle(req,'generate');return res.status(201).json({status:'success',message:`Timetable generated: ${result.placed} periods placed`,...result});}
    const classId = req.params.classId;
    const term = req.body.term || DEFAULT_TERM();
    const yearId = req.body.academic_year_id || (await AcademicYearModel.findCurrent())?.id;
    if (!yearId) throw httpError(400, 'No academic year (provide academic_year_id or set a current year)');

    const allocations = await SubjectAllocation.getByClass(classId, yearId);
    if (!allocations.length) {
        throw httpError(400, 'No subject allocations for this class/year. Allocate subjects first.');
    }

    const slots = await TimeSlot.getTeaching(); // non-break slots, ordered
    const teacherRows = await ClassSubject.getTeacherMap(classId, term);
    const teacherOf = {};
    teacherRows.forEach(r => { if (!teacherOf[r.subject_id]) teacherOf[r.subject_id] = r.teacher_id; });

    // teacher/day/slot already used by OTHER classes (avoid double-booking)
    const busyRows = await Timetable.getTeacherBusy(term, yearId, classId);
    const teacherBusy = new Set(busyRows.map(b => `${b.teacher_id}|${b.day_of_week}|${b.time_slot_id}`));

    // build the list of lessons to place
    const lessons = [];
    const unassigned = [];
    for (const a of allocations) {
        const teacherId = teacherOf[a.subject_id];
        if (!teacherId) { unassigned.push(a.subject_name); continue; }
        for (let i = 0; i < a.periods_week; i++) lessons.push({ subjectId: a.subject_id, teacherId });
    }

    // every (day, teaching-slot) cell
    const cells = [];
    for (const day of DAYS) for (const slot of slots) cells.push({ day, slot });

    const classUsed = new Set();
    const entries = [];
    let overflow = 0;
    for (const lesson of lessons) {
        let placed = false;
        for (const cell of cells) {
            const cKey = `${cell.day}|${cell.slot.id}`;
            const tKey = `${lesson.teacherId}|${cell.day}|${cell.slot.id}`;
            if (!classUsed.has(cKey) && !teacherBusy.has(tKey)) {
                classUsed.add(cKey);
                teacherBusy.add(tKey);
                entries.push({ day: cell.day, slot: cell.slot, subjectId: lesson.subjectId, teacherId: lesson.teacherId });
                placed = true;
                break;
            }
        }
        if (!placed) overflow++;
    }

    // persist: clear the class's existing entries, then insert the new ones
    await Timetable.deleteForClass(classId, term, yearId);
    for (const e of entries) {
        await Timetable.create({
            class_id: classId, subject_id: e.subjectId, teacher_id: e.teacherId,
            day_of_week: e.day, time_slot_id: e.slot.id,
            start_time: e.slot.start_time, end_time: e.slot.end_time,
            room: null, academic_term: term, academic_year_id: yearId, created_by: req.userAuth.id,
        });
    }

    res.status(201).json({
        status: 'success',
        message: `Timetable generated: ${entries.length} periods placed`,
        placed: entries.length,
        overflow,
        unassignedSubjects: [...new Set(unassigned)],
    });
});

//@desc   Delete a timetable entry
//@route  DELETE /api/v1/timetables/:id
exports.deleteEntryCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedTimetablesEnabled){await require('./scopedLegacyTimetable').handle(req,'remove');return res.status(200).json({status:'success',message:'Entry deleted'});}
    await Timetable.delete(req.params.id);
    res.status(200).json({ status: 'success', message: 'Entry deleted' });
});

//@desc   Get form data (slots, classes, subjects, teachers, years)
//@route  GET /api/v1/timetables/form-data
exports.getFormDataCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedTimetablesEnabled)return res.status(200).json({status:'success',data:await require('./scopedLegacyTimetable').handle(req,'form')});
    const [slots, classes, subjects, teachers, academicYears] = await Promise.all([
        TimeSlot.getAll(),
        ClassModel.getAll(),
        SubjectModel.getAll(),
        TeacherModel.getAll(),
        AcademicYearModel.getAll(),
    ]);
    res.status(200).json({
        status: 'success',
        data: { slots, classes, subjects, teachers, academicYears, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
    });
});

//@desc   Get period summary per subject for a class
//@route  GET /api/v1/timetables/class/:classId/periods?term=&yearId=
exports.getClassPeriodsCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedTimetablesEnabled)return res.status(200).json({status:'success',data:await require('./scopedLegacyTimetable').handle(req,'periods')});
    const term = req.query.term || DEFAULT_TERM();
    const yearId = req.query.yearId || (await AcademicYearModel.findCurrent())?.id;
    const periods = await Timetable.getPeriodsPerSubject(req.params.classId, term, yearId);
    res.status(200).json({ status: 'success', data: periods });
});
