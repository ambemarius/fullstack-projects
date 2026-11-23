const asyncHandler = require('express-async-handler')
const Admin = require('../../model/staff/admin');
const Teacher = require('../../model/staff/teacher');
const Student = require('../../model/Academic/student');
const Subject = require('../../model/Academic/subject');
const Class = require('../../model/Academic/class');
const ExamResult = require('../../model/Academic/examResult');
const generateToken = require('../../utils/generateToken');
const verifyToken = require('../../utils/verifyToken')
const {isLegacyAdministrator}=require('../../utils/legacyAccountRole');
const { sql, pool, poolConnect } = require('../../config/database');
const { setAuthCookie } = require('../../utils/authCookie');

// build an Error carrying an HTTP status (read by the global error handler)
const httpError = (status, message) => {
    const err = new Error(message);
    err.statusCode = status;
    return err;
};

//@desc register adimn
//route post /api/admin/register

exports.registeradminCtrl =asyncHandler( async (req, res) => {
    const { name, email, password, role = 'admin' } = req.body || {};
    if (role !== 'admin') throw httpError(400, 'Only school administrator accounts can be created here');

    // basic validation
    if (!name || !email || !password || !role) {
        return res.status(400).json({
            status: 'error',
            message: 'name, email, password and role are required'
        });
    }
        // check if admin already exists
        const adminFound = await Admin.findByEmail(email);
        if (adminFound) {
            return res.status(409).json({
                status: 'error',
                message: 'Admin with this email already exists'
            });
        }
        // create the admin (password is hashed inside the model)
        const user = await Admin.create({ name, email, password, role });

        res.status(201).json({
            status: 'success',
            data: user
        });
}
);

// @desc login admin
// post /api/admin/login
exports.loginadminCtrl = asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};

    // basic validation
    if (!email || !password) {
        return res.status(400).json({
            status: 'error',
            message: 'email and password are required'
        });
    }


        // find the admin by email
        const user = await Admin.findByEmail(email);

        // verify the password against the stored hash
        const isMatch = user && isLegacyAdministrator(user.role) && await Admin.verifyPassword(password, user.password);
        if (!user || !isMatch) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid login credentials'
            });
        }

        // issue a JWT and return it (the client sends it back as "Bearer <token>")
        const version = req.app.locals.legacyCredentialVersionsEnabled ? await require('../../model/identity/legacyCredentialVersion').legacyCredentialVersion('admin',user.id,undefined,user.password) : undefined;
        const token = generateToken(user.id, 'admin', version);
        setAuthCookie(res, token);

        // never send the password hash back
        const { password: _omit, ...safeUser } = user;
        res.status(200).json({
            status: 'success',
            data: safeUser,
            token
        });
    }
)
//@desc get all admins
//@route GET /api/v1/admin
exports.alladminCtrl = asyncHandler(async (req, res) => {
    const admins = req.app.locals.legacyScopedPersonnelReadsEnabled ? await require('./scopedLegacyPersonnelReads').handle(req,'list','admins') : await Admin.getAll();
    res.status(200).json({ status: 'success', results: admins.length, data: admins });
});

//@get all single users
//get /api/admin/:id
exports.getadminprofile = asyncHandler( async (req, res) => {
    const admin = req.app.locals.legacyScopedPersonnelReadsEnabled ? await require('./scopedLegacyPersonnelReads').handle(req,'find','admins') : await Admin.findById(req.userAuth.id);
    if (!admin) {
        throw new Error("Admin Not Found");
    }
    const { password, ...safeAdmin } = admin;
    res.status(200).json({
        status: 'success',
        data: safeAdmin,
        message: "Admin logged in successfully"
    });
})

//@desc get a single admin by id
//@route GET /api/v1/admin/:id
exports.singleadminCtrl = asyncHandler(async (req, res) => {
    const admin = req.app.locals.legacyScopedPersonnelReadsEnabled ? await require('./scopedLegacyPersonnelReads').handle(req,'find','admins',req.params.id) : await Admin.findById(req.params.id);
    if (!admin) throw httpError(404, 'Admin not found');
    const { password, ...safeAdmin } = admin;
    res.status(200).json({ status: 'success', data: safeAdmin });
})
//@desc update admin
//@route PUT /api/v1/admin/:id
exports.updateadminCtrl = asyncHandler(async (req, res) => {
    const { name, email, role } = req.body || {};
    if (role !== undefined && role !== 'admin') throw httpError(400, 'Invalid administrator role');
    const updated = await Admin.update(req.params.id, { name, email, role });
    if (!updated) throw httpError(404, 'Admin not found');
    res.status(200).json({ status: 'success', data: updated });
});

//@desc delete admin
//@route DELETE /api/v1/admin/:id
exports.deleteadminCtrl = asyncHandler(async (req, res) => {
    const targetId = Number(req.params.id);
    if (targetId === Number(req.userAuth.id)) {
        throw httpError(409, 'You cannot delete the account you are signed in with');
    }
    const admins = await Admin.getAll();
    const remaining = admins.filter(a => isLegacyAdministrator(a.role) && Number(a.id) !== targetId);
    if (remaining.length === 0) {
        throw httpError(409, 'At least one administrator account must remain');
    }
    const ok = await Admin.remove(req.params.id);
    if (!ok) throw httpError(404, 'Admin not found');
    res.status(200).json({ status: 'success', message: 'Admin deleted' });
});

//@desc admin sets a teacher's status (active / suspended / withdrawn)
//@route PUT /api/v1/admin/set-status/teacher/:id
exports.setTeacherStatusCtrl = asyncHandler(async (req, res) => {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) throw httpError(404, 'Teacher not found');
    const { status } = req.body || {};
    if (!['active', 'suspended', 'withdrawn'].includes(status)) {
        throw httpError(400, 'status must be active, suspended or withdrawn');
    }
    await Teacher.setStatus(req.params.id, status);
    res.status(200).json({ status: 'success', message: `Teacher ${status}` });
});

//@desc admin publishes an exam's results
//@route PUT /api/v1/admin/publish/exam/:id   (:id = examId)
exports.publishexamCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedExamResultsEnabled)await require('../academic/scopedLegacyExamResults').handle(req,req.params.id,true);
    else await ExamResult.publishByExam(req.params.id);
    res.status(200).json({ status: 'success', message: 'Exam results published' });
});

//@desc admin unpublishes an exam's results
//@route PUT /api/v1/admin/unpublish/exam/:id   (:id = examId)
exports.unpublishexamCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedExamResultsEnabled)await require('../academic/scopedLegacyExamResults').handle(req,req.params.id,false);
    else await ExamResult.unpublishByExam(req.params.id);
    res.status(200).json({ status: 'success', message: 'Exam results unpublished' });
});

//@desc admin dashboard stats (counts)
//@route GET /api/v1/admin/stats
exports.getAdminStatsCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedPersonnelReadsEnabled)return res.status(200).json({status:'success',data:await require('./scopedLegacyPersonnelReads').handle(req,'stats')});
    const teachers = await Teacher.getAll();
    const students = await Student.getAll();
    const subjects = await Subject.getAll();
    const classes = await Class.getAll();
    res.status(200).json({
        status: 'success',
        data: {
            teachers: teachers.length,
            students: students.length,
            subjects: subjects.length,
            classes: classes.length,
        }
    });
});

//@desc   Admin dashboard analytics (enrollment breakdown, teacher distribution, fee summary)
//@route  GET /api/v1/admin/analytics
exports.getAdminAnalyticsCtrl = asyncHandler(async (req, res) => {
    await poolConnect;

    const [enrollmentResult, teacherResult, feeResult] = await Promise.all([
        pool.request().query(`
            SELECT c.section, COUNT(s.id) AS count
            FROM students s
            JOIN classes c ON c.id = s.currentClassLevel
            WHERE s.isWithdrawn = 0
            GROUP BY c.section
        `),
        pool.request().query(`
            SELECT section, employmentType, status, COUNT(*) AS count
            FROM teachers
            GROUP BY section, employmentType, status
        `),
        pool.request().query(`
            SELECT c.section, c.name AS className,
                   SUM(CASE WHEN sf.fee_type = 'registration' THEN sf.amount ELSE 0 END) AS registration,
                   SUM(CASE WHEN sf.fee_type = 'tuition' THEN sf.amount ELSE 0 END) AS tuition,
                   SUM(sf.amount) AS total
            FROM student_fees sf
            JOIN students s ON s.id = sf.student_id
            JOIN classes c ON c.id = s.currentClassLevel
            WHERE sf.paid = 1
            GROUP BY c.section, c.name
        `),
    ]);

    const enrollmentBySection = {};
    for (const r of enrollmentResult.recordset) {
        enrollmentBySection[r.section] = r.count;
    }

    const teacherBreakdown = teacherResult.recordset;

    const activeTeachers = teacherBreakdown
        .filter(t => t.status === 'active')
        .reduce((sum, t) => sum + t.count, 0);
    const suspendedTeachers = teacherBreakdown
        .filter(t => t.status === 'suspended')
        .reduce((sum, t) => sum + t.count, 0);

    const feesByClass = feeResult.recordset;
    const totalFeesCollected = feesByClass.reduce((sum, r) => sum + (r.total || 0), 0);

    res.status(200).json({
        status: 'success',
        data: {
            enrollment: {
                bySection: enrollmentBySection,
                total: Object.values(enrollmentBySection).reduce((a, b) => a + b, 0),
            },
            teachers: {
                active: activeTeachers,
                suspended: suspendedTeachers,
                bySection: teacherBreakdown,
            },
            fees: {
                byClass: feesByClass,
                totalCollected: totalFeesCollected,
            },
        },
    });
});
