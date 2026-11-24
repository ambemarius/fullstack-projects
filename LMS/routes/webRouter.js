const express = require('express');
const { clearAuthCookie } = require('../utils/authCookie');
const { authenticateRequest } = require('../middlewares/roleAuth');
const { resolveUploadPath } = require('../middlewares/upload');
const { version } = require('../package.json');
const webRouter = express.Router();

// Server-rendered EJS pages (the frontend)
// Public KodoSchool site: home, modules and pricing (static pages, no school data).
webRouter.get('/', (req, res) => res.render('landing'));
webRouter.get('/modules', (req, res) => res.render('modules'));
webRouter.get('/pricing', (req, res) => res.render('pricing'));
webRouter.get('/signup', (req, res) => res.render('school-signup'));
// KodoSchool platform console (KodoSchool's own administrators; the API checks the platform account).
webRouter.get('/platform/login', (req, res) => res.render('platform-login'));
webRouter.get('/platform', (req, res) => res.render('platform-console'));
webRouter.get('/platform/signups', (req, res) => res.redirect('/platform#signups'));

webRouter.get('/health', async (_req, res) => {
    const body = { status: 'ok', version, uptime: Math.round(process.uptime()) };
    try {
        const { pool, poolConnect } = require('../config/database');
        await poolConnect;
        await pool.request().query('SELECT 1 AS ok');
        body.database = 'ok';
        res.status(200);
    } catch {
        body.status = 'degraded';
        body.database = 'unavailable';
        res.status(503);
    }
    res.set('Cache-Control', 'no-store').json(body);
});

webRouter.post('/logout', (req, res) => {
    clearAuthCookie(res);
    res.status(200).json({ status: 'success', message: 'Logged out' });
});
webRouter.get('/login', (req, res) => res.render('login'));
webRouter.get('/admin-dashboard', (req, res) => res.render('admin-layout'));
webRouter.get('/teachers', (req, res) => res.render('teachers'));
webRouter.get('/students', (req, res) => res.render('students'));
webRouter.get('/subjects', (req, res) => res.render('subjects'));
webRouter.get('/allocations', (req, res) => res.render('allocations'));
webRouter.get('/teacher-dashboard', (req, res) => res.render('teacher-dashboard'));
webRouter.get('/student-dashboard', (req, res) => res.render('student-dashboard'));
webRouter.get('/timetable', (req, res) => res.render('timetable'));
for (const page of ['timetable-teacher','timetable-student']) {
    webRouter.get('/'+page,(req,res)=>{
        if (req.app.locals.canonicalAcademicLinksEnabled) return res.redirect('https://localhost:2027/courses');
        res.render(page);
    });
}
webRouter.get('/promotion', (req, res) => res.render('promotion'));
webRouter.get('/parent-dashboard', (req, res) => res.render('parent-dashboard'));
webRouter.get('/staff-dashboard', (req, res) => res.render('staff-dashboard'));
webRouter.get('/attendance', (req, res) => res.render('attendance-register'));
// Printable bulletins: rendered on the server for signed-in administrators (cookie session).
webRouter.get('/report-cards/print', require('../middlewares/isLogin'), require('../controllers/academic/bulletinCtrl').printPage);

// Uploaded student photos and staff documents: any signed-in account, never anonymous.
webRouter.get('/files/:name', (req, res, next) => {
    try {
        if (!authenticateRequest(req)) {
            return next(Object.assign(new Error('Authentication required'), { statusCode: 401 }));
        }
        const filePath = resolveUploadPath(req.params.name);
        if (!filePath) return next(Object.assign(new Error('Resource not found'), { statusCode: 404 }));
        res.set('Cache-Control', 'private, no-store');
        res.sendFile(filePath, { dotfiles: 'deny' }, err => {
            if (err) next(Object.assign(new Error('Resource not found'), { statusCode: 404 }));
        });
    } catch (err) {
        next(err);
    }
});

module.exports = webRouter;
