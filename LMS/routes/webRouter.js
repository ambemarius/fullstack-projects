const express = require('express');
const webRouter = express.Router();

// Server-rendered EJS pages (the frontend)
webRouter.get('/', (req, res) => res.render('landing'));
webRouter.get('/login', (req, res) => res.render('login'));
webRouter.get('/admin-dashboard', (req, res) => res.render('admin-layout'));
webRouter.get('/teachers', (req, res) => res.render('teachers'));
webRouter.get('/students', (req, res) => res.render('students'));
webRouter.get('/subjects', (req, res) => res.render('subjects'));
webRouter.get('/allocations', (req, res) => res.render('allocations'));
webRouter.get('/teacher-dashboard', (req, res) => res.render('teacher-dashboard'));
webRouter.get('/student-dashboard', (req, res) => res.render('student-dashboard'));
webRouter.get('/timetable', (req, res) => res.render('timetable'));
webRouter.get('/timetable-teacher', (req, res) => res.render('timetable-teacher'));
webRouter.get('/timetable-student', (req, res) => res.render('timetable-student'));
webRouter.get('/promotion', (req, res) => res.render('promotion'));

module.exports = webRouter;
