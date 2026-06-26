/**
 * Populate the whole app with realistic demo data.
 *   node scripts/seedDemo.js
 *
 * Safe to re-run (guards on unique keys). Assumes tables exist (run npm run setup first).
 */
const Admin = require('../model/staff/admin');
const Subject = require('../model/Academic/subject');
const Teacher = require('../model/staff/teacher');
const Student = require('../model/Academic/student');
const ClassModel = require('../model/Academic/class');
const ClassSubject = require('../model/Academic/classSubject');
const AcademicYear = require('../model/Academic/academicYear');
const SubjectAllocation = require('../model/Academic/subjectAllocation');
const TimeSlot = require('../model/Academic/timeSlot');
const Timetable = require('../model/Academic/timetable');
const Exam = require('../model/Academic/exam');
const Question = require('../model/Academic/question');
const ExamResult = require('../model/Academic/examResult');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// one dedicated teacher per subject
const SUBJECTS = [
  { code: 'MATH', name: 'Mathematics' },
  { code: 'ENG', name: 'English Language' },
  { code: 'FRE', name: 'French' },
  { code: 'BIO', name: 'Biology' },
  { code: 'CHE', name: 'Chemistry' },
  { code: 'PHY', name: 'Physics' },
  { code: 'GEO', name: 'Geography' },
  { code: 'HIS', name: 'History' },
  { code: 'LIT', name: 'Literature' },
  { code: 'CMP', name: 'Computer Science' },
  { code: 'CIT', name: 'Citizenship' },
  { code: 'FMATH', name: 'Further Mathematics' },
];

// secondary (Form1-5) gets many subjects; advanced (LS/US) gets fewer — as required
const SEC_ALLOC = [['MATH', 5], ['ENG', 5], ['FRE', 3], ['BIO', 4], ['CHE', 4], ['PHY', 4], ['GEO', 3], ['HIS', 3], ['LIT', 3], ['CMP', 2]];
const ADV_ALLOC = [['MATH', 6], ['PHY', 6], ['CHE', 6], ['FMATH', 6]];

async function ensureSubjects() {
  const map = {};
  for (const s of SUBJECTS) {
    let row = await Subject.findByCode(s.code);
    if (!row) row = await Subject.create({ name: s.name, code: s.code, description: `${s.name} subject` });
    map[s.code] = row;
  }
  return map;
}

async function ensureTeachers() {
  const map = {};
  for (const s of SUBJECTS) {
    const email = `${s.code.toLowerCase()}.teacher@school.local`;
    let row = await Teacher.findByEmail(email);
    if (!row) {
      row = await Teacher.create({
        name: `${s.name} Teacher`, email, password: 'Teacher@123',
        phone: '67' + (1000000 + Math.floor(Math.abs(Math.sin(s.code.length * 7)) * 8999999)).toString().slice(0, 7),
        employmentType: s.code === 'FRE' || s.code === 'CIT' ? 'Part-time' : 'Government',
        section: 'Anglophone',
      });
    }
    map[s.code] = row;
  }
  return map;
}

async function main() {
  const admin = await Admin.findByEmail('admin@school.local')
    || await Admin.create({ name: 'Super Admin', email: 'admin@school.local', password: 'Admin@123', role: 'admin' });

  // current academic year
  let year = (await AcademicYear.getAll()).find(y => y.name === '2026/2027');
  if (!year) year = await AcademicYear.create({ fromYear: 2026, toYear: 2027, isCurrent: true, createdBy: admin.id });
  await AcademicYear.setCurrent(year.id);

  const subjects = await ensureSubjects();
  const teachers = await ensureTeachers();
  const classes = await ClassModel.getAll();
  console.log(`Subjects: ${Object.keys(subjects).length}, Teachers: ${Object.keys(teachers).length}, Classes: ${classes.length}`);

  // students: 2 per class
  let studentCount = 0;
  const demoFirstNames = ['Ada', 'Bih', 'Che', 'Eni', 'Fon', 'Ngu', 'Tabi', 'Mbah', 'Sama', 'Etta'];
  const demoLastNames = ['Tanka', 'Mbah', 'Nformi', 'Ngwa', 'Achiri', 'Nde', 'Fotso', 'Bayemi', 'Essomba', 'Eyebe'];
  for (const c of classes) {
    for (let i = 1; i <= 2; i++) {
      const matricule = `STU-${c.id}-${i}`;
      if (await Student.findByMatricule(matricule)) continue;
      await Student.create({
        firstName: demoFirstNames[(c.id + i) % demoFirstNames.length],
        lastName: demoLastNames[(c.id * 2 + i) % demoLastNames.length],
        matricule, password: 'Student@123', section: c.section,
        sex: i % 2 === 0 ? 'Female' : 'Male',
        dateOfBirth: `200${Math.min(9, (c.id + i) % 9 + 1)}-0${(i % 9) + 1}-15`,
        yearOfEnrollment: 2025,
        academicYearId: year.id, currentClassLevel: c.id,
      });
      studentCount++;
    }
  }
  console.log(`Students created this run: ${studentCount}`);

  // enroll all of the year's students + teachers into the academic year (for the counts)
  let enrolled = 0;
  for (const c of classes) {
    for (const st of await Student.getByClass(c.id)) {
      await AcademicYear.enrollStudent(year.id, st.id);
      enrolled++;
    }
  }
  for (const code of Object.keys(teachers)) {
    await AcademicYear.assignTeacher(year.id, teachers[code].id);
  }
  console.log(`Enrolled in ${year.name}: ${enrolled} students, ${Object.keys(teachers).length} teachers`);

  // allocations + teacher assignments for every class
  let allocCount = 0, assignCount = 0;
  for (const c of classes) {
    const plan = c.rank >= 6 ? ADV_ALLOC : SEC_ALLOC;
    for (const [code, periods] of plan) {
      const subj = subjects[code];
      await SubjectAllocation.set({ class_id: c.id, subject_id: subj.id, periods_week: periods, academic_year_id: year.id });
      const offering = await ClassSubject.offer(c.id, subj.id);
      await ClassSubject.assignTeacher(offering.id, teachers[code].id, 'First');
      allocCount++; assignCount++;
    }
  }
  console.log(`Allocations set: ${allocCount}, teacher assignments: ${assignCount}`);

  // generate timetables for a representative selection
  const pickNames = ['Form1', 'Form3', 'LowerSixth', '6ème'];
  const toGenerate = classes.filter(c => pickNames.includes(c.name) && (c.stream === 'Normal' || c.stream === null));
  for (const c of toGenerate) {
    const res = await generateClass(c.id, 'First', year.id, admin.id);
    console.log(`Timetable ${c.section} ${c.name}${c.stream ? ' ' + c.stream : ''}: placed ${res.placed}, overflow ${res.overflow}`);
  }

  // an exam with questions + published results for Form1 Normal Anglophone
  const form1 = classes.find(c => c.name === 'Form1' && c.section === 'Anglophone' && c.stream === 'Normal');
  if (form1) {
    const mathT = teachers['MATH'];
    const exam = await Exam.create({
      name: 'Maths Sequence 1', subjectId: subjects['MATH'].id, classLevel: form1.id,
      passmark: 50, totalmark: 100, coefficient: 4, academicTerm: 'First',
      academicYearId: year.id, examStatus: 'Completed', createdBy: mathT.id,
    });
    await Question.create({ examId: exam.id, questionText: '2 + 3 = ?', optionA: '4', optionB: '5', optionC: '6', optionD: '7', correctOption: 'B', marks: 1, createdBy: mathT.id });
    await Question.create({ examId: exam.id, questionText: '10 / 2 = ?', optionA: '2', optionB: '4', optionC: '5', optionD: '10', correctOption: 'C', marks: 1, createdBy: mathT.id });
    const studs = await Student.getByClass(form1.id);
    const scores = [78, 46];
    for (let i = 0; i < studs.length; i++) {
      const score = scores[i % scores.length];
      const existing = await ExamResult.findForStudentExam(studs[i].id, exam.id);
      if (!existing) {
        await ExamResult.create({
          studentId: studs[i].id, examId: exam.id, subjectId: subjects['MATH'].id,
          score, passmark: 50, grade: score >= 80 ? 'A' : score >= 50 ? 'D' : 'F',
          status: score >= 50 ? 'Passed' : 'Failed', remarks: score >= 80 ? 'Excellent' : score >= 50 ? 'Good' : 'Poor',
        });
      }
    }
    await ExamResult.publishByExam(exam.id);
    console.log(`Exam '${exam.name}' created with questions + published results for ${studs.length} students`);
  }

  console.log('\nDemo data ready. Login admin@school.local / Admin@123');
}

// replicate the timetable generator
async function generateClass(classId, term, yearId, adminId) {
  const allocations = await SubjectAllocation.getByClass(classId, yearId);
  if (!allocations.length) return { placed: 0, overflow: 0 };
  const slots = await TimeSlot.getTeaching();
  const tmap = await ClassSubject.getTeacherMap(classId, term);
  const teacherOf = {};
  tmap.forEach(r => { if (!teacherOf[r.subject_id]) teacherOf[r.subject_id] = r.teacher_id; });
  const busyRows = await Timetable.getTeacherBusy(term, yearId, classId);
  const teacherBusy = new Set(busyRows.map(b => `${b.teacher_id}|${b.day_of_week}|${b.time_slot_id}`));

  const lessons = [];
  for (const a of allocations) {
    const t = teacherOf[a.subject_id];
    if (!t) continue;
    for (let i = 0; i < a.periods_week; i++) lessons.push({ s: a.subject_id, t });
  }
  const cells = [];
  for (const d of DAYS) for (const sl of slots) cells.push({ d, sl });

  const used = new Set();
  const entries = [];
  let overflow = 0;
  for (const L of lessons) {
    let placed = false;
    for (const c of cells) {
      const ck = `${c.d}|${c.sl.id}`, tk = `${L.t}|${c.d}|${c.sl.id}`;
      if (!used.has(ck) && !teacherBusy.has(tk)) {
        used.add(ck); teacherBusy.add(tk);
        entries.push({ d: c.d, sl: c.sl, s: L.s, t: L.t });
        placed = true; break;
      }
    }
    if (!placed) overflow++;
  }
  await Timetable.deleteForClass(classId, term, yearId);
  for (const e of entries) {
    await Timetable.create({
      class_id: classId, subject_id: e.s, teacher_id: e.t, day_of_week: e.d,
      time_slot_id: e.sl.id, start_time: e.sl.start_time, end_time: e.sl.end_time,
      room: null, academic_term: term, academic_year_id: yearId, created_by: adminId,
    });
  }
  return { placed: entries.length, overflow };
}

main().then(() => process.exit(0)).catch(e => { console.error('Seed failed:', e.message); process.exit(1); });
