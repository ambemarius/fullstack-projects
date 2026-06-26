const express = require("express");
const morgan  = require("morgan");
const path = require("path");

const adminRouter = require("../routes/staff/adminRouter");
const teacherRouter = require("../routes/staff/teacherRouter");
const studentRouter = require("../routes/students/studentRouter");
const subjectRouter = require("../routes/academic/subjectRouter");
const classRouter = require("../routes/academic/classRouter");
const academicYearRouter = require("../routes/academic/academicYearRouter");
const examRouter = require("../routes/academic/examRouter");
const examResultRouter = require("../routes/academic/examResultRouter");
const timetableRouter = require("../routes/academic/timetableRouter");
const allocationRouter = require("../routes/academic/subjectAllocationRouter");
const locationRouter = require("../routes/academic/locationRouter");
const marksRouter = require("../routes/academic/marksRouter");
const classSubjectStudentRouter = require("../routes/academic/classSubjectStudentRouter");
const reportCardRouter = require("../routes/academic/reportCardRouter");
const auxiliaryRouter = require("../routes/staff/auxiliaryRouter");
const webRouter = require("../routes/webRouter");
const {globalErrHandler, notFoundErr} = require('../middlewares/globalErrHandler')

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(morgan("dev"));
app.use((req, res, next) => {
    if (req.accepts('html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// frontend pages (EJS): /, /login, /dashboard
app.use("/", webRouter);

app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/teachers", teacherRouter);
app.use("/api/v1/students", studentRouter);
app.use("/api/v1/subjects", subjectRouter);
app.use("/api/v1/classes", classRouter);
app.use("/api/v1/academic-years", academicYearRouter);
app.use("/api/v1/exams", examRouter);
app.use("/api/v1/exam-results", examResultRouter);
app.use("/api/v1/timetables", timetableRouter);
app.use("/api/v1/allocations", allocationRouter);
app.use("/api/v1/locations", locationRouter);
app.use("/api/v1/marks", marksRouter);
app.use("/api/v1/class-subject-students", classSubjectStudentRouter);
app.use("/api/v1/report-cards", reportCardRouter);
app.use("/api/v1/auxiliary", auxiliaryRouter);

//not found error
app.use(notFoundErr)

// error middleware
app.use(globalErrHandler);



module.exports = app