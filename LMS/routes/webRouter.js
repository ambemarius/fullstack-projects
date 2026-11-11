const express = require('express');
const { clearAuthCookie } = require('../utils/authCookie');
const webRouter = express.Router();

// Server-rendered EJS pages (the frontend)
webRouter.get('/', (req, res) => res.render('landing'));

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

module.exports = webRouter;
