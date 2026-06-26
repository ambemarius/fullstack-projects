/**
 * Create the full schema and seed the classes.
 *
 *   node scripts/setupAcademic.js
 *
 * Tables are created in dependency order (parents before the join tables
 * that reference them via foreign keys). Safe to run repeatedly.
 */
const Admin = require('../model/staff/admin');
const SubjectModel = require('../model/Academic/subject');
const ClassModel = require('../model/Academic/class');
const TeacherModel = require('../model/staff/teacher');
const StudentModel = require('../model/Academic/student');
const ClassSubjectModel = require('../model/Academic/classSubject');
const AcademicYearModel = require('../model/Academic/academicYear');
const ExamModel = require('../model/Academic/exam');
const QuestionModel = require('../model/Academic/question');
const ExamResultModel = require('../model/Academic/examResult');
const TimeSlotModel = require('../model/Academic/timeSlot');
const SubjectAllocationModel = require('../model/Academic/subjectAllocation');
const SubjectScoreModel = require('../model/Academic/subjectScore');
const TimetableModel = require('../model/Academic/timetable');
const ClassSubjectStudentModel = require('../model/Academic/classSubjectStudent');
const AuxiliaryModel = require('../model/staff/auxiliary');
const LocationModel = require('../model/Academic/location');

async function main() {
    // Parents first (referenced by foreign keys below)...
    await Admin.createTable();              // Admins          <- academic_years.createdBy
    await SubjectModel.createTable();       // subjects
    await SubjectModel.migrate();            // add coefficient/categories/subject_master/class_id columns
    await ClassModel.createTable();         // classes         <- students.currentClassLevel, class_subjects
    await TeacherModel.createTable();       // teachers
    await TeacherModel.migrate();            // add status column, drop isSuspended/isWithdrawn
    await AcademicYearModel.createTable();  // academic_years  <- students.academicYearId (needs Admins)
    await StudentModel.createTable();       // students        (needs classes + academic_years)
    await StudentModel.migrate();            // add firstName/middleName/lastName/sex/dob/enrollmentYear columns
    await AuxiliaryModel.createTable();     // auxiliary_staff

    // Cameroon locations (regions / divisions / subdivisions) for student origin
    await LocationModel.createTable();
    const loc = await LocationModel.seed();
    console.log('Locations:', loc.skipped ? 'already seeded' : `${loc.regions} regions, ${loc.divisions} divisions, ${loc.subs} subdivisions`);

    // ...then the join tables that reference the above.
    await ClassSubjectModel.createTable();          // class_subjects, class_subject_teachers
    await ClassSubjectStudentModel.createTable();    // class_subject_students (needs class_subjects + students + academic_years)
    await AcademicYearModel.createEnrollmentTables(); // academic_year_students/teachers (needs students + teachers)

    // exams + questions + results
    await ExamModel.createTable();          // exams      (needs subjects, classes, academic_years, teachers)
    await QuestionModel.createTable();      // questions  (needs exams, teachers)
    await ExamResultModel.createTable();    // exam_results (needs students, exams, subjects)

    // time slots + timetable
    await TimeSlotModel.createTable();               // time_slots
    await TimeSlotModel.seed();
    await SubjectAllocationModel.createTable();       // subject_allocations
    await SubjectScoreModel.createTable();             // subject_scores
    await TimetableModel.createTable();              // timetables (needs classes, subjects, teachers, academic_years, admins)
    await TimetableModel.migrate();                  // add time_slot_id if missing

    console.log('Tables ready: Admins, subjects, classes, teachers, academic_years, students,');
    console.log('              class_subjects, class_subject_teachers,');
    console.log('              academic_year_students, academic_year_teachers,');
    console.log('              exams, questions, exam_results, timetables, time_slots, subject_allocations');

    await ClassModel.migrate();                // add class_master_id, fees, option_name columns
    await ClassModel.seedDefaults();
    const classes = await ClassModel.getAll();
    console.log(`\nClasses (${classes.length}):`);
    console.table(classes);
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Setup failed:', err.message);
        process.exit(1);
    });
