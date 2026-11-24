const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('node:path');
const { globalErrHandler, notFoundErr } = require('../middlewares/globalErrHandler');

// Pages are server-rendered with self-hosted assets and no inline scripts or event handlers.
// Inline style attributes remain in some views, so styles keep 'unsafe-inline'.
const CONTENT_SECURITY_POLICY = {
    useDefaults: false,
    directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'script-src-attr': ["'none'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
    },
};

const ROUTES = [
    ['/', '../routes/webRouter'],
    ['/api/v1/admin', '../routes/staff/adminRouter'],
    ['/api/v1/teachers', '../routes/staff/teacherRouter'],
    ['/api/v1/students', '../routes/students/studentRouter'],
    ['/api/v1/subjects', '../routes/academic/subjectRouter'],
    ['/api/v1/classes', '../routes/academic/classRouter'],
    ['/api/v1/academic-years', '../routes/academic/academicYearRouter'],
    ['/api/v1/academic-context', '../routes/academic/academicContextRouter'],
    ['/api/v1/exams', '../routes/academic/examRouter'],
    ['/api/v1/exam-results', '../routes/academic/examResultRouter'],
    ['/api/v1/timetables', '../routes/academic/timetableRouter'],
    ['/api/v1/allocations', '../routes/academic/subjectAllocationRouter'],
    ['/api/v1/locations', '../routes/academic/locationRouter'],
    ['/api/v1/marks', '../routes/academic/marksRouter'],
    ['/api/v1/class-subject-students', '../routes/academic/classSubjectStudentRouter'],
    ['/api/v1/report-cards', '../routes/academic/reportCardRouter'],
    ['/api/v1/auxiliary', '../routes/staff/auxiliaryRouter'],
    ['/api/v1/parents', '../routes/parents/parentRouter'],
    ['/api/v1/staff-duties', '../routes/staff/staffDutyRouter'],
    ['/api/v1/department', '../routes/academic/departmentRouter'],
    ['/api/v1/class-master', '../routes/academic/classMasterRouter'],
    ['/api/v1/school-signup', '../routes/platform/schoolSignupRouter'],
    ['/api/v1/platform', '../routes/platform/platformRouter'],
    ['/api/v1/schools', '../routes/platform/schoolDirectoryRouter'],
    ['/finance', '../routes/finance/financeRouter'],
    ['/api/v1/attendance', '../routes/attendance/attendanceRouter'],
    ['/api/v1/library', '../routes/inventory/loansRouter'],
    ['/', '../routes/inventory/inventoryRouter'],
];

function createApp({ routes, requestContext, logging = true, legacyPersonnelReadOnly = false, legacyAcademicReadOnly = false, legacyAuxiliaryReadOnly = false, legacyCredentialVersionsEnabled = false, legacyAcademicLinksReadOnly = false, legacyScopedExamResultsEnabled = false, legacyScopedPersonnelReadsEnabled = false, legacyScopedTimetablesEnabled = false, legacyScopedAllocationsEnabled = false, legacyScopedReferencesEnabled = false, legacyScopedReportsEnabled = false, legacyScopedSelfEnabled = false } = {}) {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '..', 'views'));
    app.disable('x-powered-by');
    app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
    app.use(helmet({ contentSecurityPolicy: CONTENT_SECURITY_POLICY, crossOriginEmbedderPolicy: false }));
    app.locals.publicOrigin = process.env.PUBLIC_ORIGIN || '';
    app.locals.workspaceBaseUrl = process.env.WORKSPACE_BASE_URL || '';
    // Changes on every start, so browsers fetch new stylesheets after an upgrade.
    app.locals.assetVersion = Date.now().toString(36);
    app.use(require('../middlewares/stagedFeaturesGate').stagedFeaturesGate);
    // School isolation: each request runs inside the school of its signed sign-in token.
    app.use(require('../middlewares/tenantContext').tenantContext);
    app.locals.legacyCredentialVersionsEnabled = legacyCredentialVersionsEnabled;
    app.locals.legacyScopedExamResultsEnabled = legacyScopedExamResultsEnabled;
    app.locals.legacyScopedPersonnelReadsEnabled=legacyScopedPersonnelReadsEnabled;
    app.locals.legacyScopedTimetablesEnabled=legacyScopedTimetablesEnabled;
    app.locals.legacyScopedAllocationsEnabled=legacyScopedAllocationsEnabled;
    app.locals.legacyScopedReferencesEnabled=legacyScopedReferencesEnabled;
    app.locals.legacyScopedReportsEnabled=legacyScopedReportsEnabled;
    app.locals.legacyScopedSelfEnabled=legacyScopedSelfEnabled;
    if(legacyScopedSelfEnabled)app.use((req,res,next)=>{res.setHeader('X-LMS-Scoped-Self','1');if(/^\/api\/v1\/(teachers|students)\/profile\/?$/i.test(req.path))res.setHeader('Cache-Control','no-store');next();});
    if(legacyScopedReportsEnabled)app.use((req,res,next)=>{res.setHeader('X-LMS-Scoped-Reports','1');if(/^\/api\/v1\/report-cards(\/|$)/i.test(req.path))res.setHeader('Cache-Control','no-store');next();});
    if(legacyScopedReferencesEnabled)app.use((req,res,next)=>{res.setHeader('X-LMS-Scoped-References','1');if(/^\/api\/v1\/(academic-context|academic-years|classes|subjects|auxiliary|locations)(\/|$)/i.test(req.path))res.setHeader('Cache-Control','no-store');next();});
    if(legacyScopedAllocationsEnabled)app.use((req,res,next)=>{res.setHeader('X-LMS-Scoped-Allocations','1');if(/^\/api\/v1\/allocations(\/|$)/i.test(req.path))res.setHeader('Cache-Control','no-store');next();});
    if(legacyScopedTimetablesEnabled)app.use((req,res,next)=>{res.setHeader('X-LMS-Scoped-Timetables','1');if(/^\/api\/v1\/timetables(\/|$)/i.test(req.path))res.setHeader('Cache-Control','no-store');next();});
    if(legacyScopedPersonnelReadsEnabled)app.use((req,res,next)=>{res.setHeader('X-LMS-Scoped-Personnel-Reads','1');if(/^\/api\/v1\/(admin|teachers|students)(\/|$)/i.test(req.path))res.setHeader('Cache-Control','no-store');next();});
    if(legacyScopedExamResultsEnabled)app.use((req,res,next)=>{res.setHeader('X-LMS-Scoped-Exam-Results','1');if(/^\/api\/v1\/(exam-results|admin\/(publish|unpublish)\/exam)(\/|$)/i.test(req.path))res.setHeader('Cache-Control','no-store');next();});
    if (legacyCredentialVersionsEnabled) app.use((_req,res,next)=>{res.setHeader('X-LMS-Credential-Versions','1');next();});
    if (logging) app.use(morgan('dev'));
    app.use((req, res, next) => {
        if (req.accepts('html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
        next();
    });
    app.use(express.static(path.join(__dirname, '..', 'public')));
    app.use(express.json({ limit: '200kb' }));
    app.use(express.urlencoded({ extended: true, limit: '200kb' }));
    app.locals.canonicalPersonnelEnabled = legacyPersonnelReadOnly;
    app.locals.canonicalAcademicEnabled = legacyAcademicReadOnly;
    app.locals.canonicalAuxiliaryEnabled = legacyAuxiliaryReadOnly;
    app.locals.canonicalAcademicLinksEnabled = legacyAcademicLinksReadOnly;
    if (legacyAcademicLinksReadOnly) app.use(require('../middlewares/legacyAcademicLinksGate').legacyAcademicLinksGate);
    if (legacyAuxiliaryReadOnly) app.use(require('../middlewares/legacyAuxiliaryGate').legacyAuxiliaryGate);
    if (legacyAcademicReadOnly) app.use(require('../middlewares/legacyAcademicGate').legacyAcademicGate);
    if (legacyPersonnelReadOnly) app.use(require('../middlewares/legacyPersonnelGate').legacyPersonnelGate);
    if (requestContext) app.use(requestContext);
    for (const [mount, router] of routes || ROUTES.map(([mount, file]) => [mount, require(file)])) {
        app.use(mount, router);
    }
    app.use(notFoundErr);
    app.use(globalErrHandler);
    return app;
}

module.exports = { createApp, ROUTES };
