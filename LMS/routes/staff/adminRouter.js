const express = require('express');
const adminRouter = express.Router();
const {
    registeradminCtrl,
    loginadminCtrl,
    alladminCtrl,
    singleadminCtrl,
    updateadminCtrl,
    deleteadminCtrl,
    setTeacherStatusCtrl,
    publishexamCtrl,
    unpublishexamCtrl,
    getadminprofile,
    getAdminStatsCtrl,
    getAdminAnalyticsCtrl,
} = require("../../controllers/staff/adminCtrl");

const isLogin = require('../../middlewares/isLogin');


// ---- public ----
// register
adminRouter.post('/register', isLogin, registeradminCtrl)

// login
adminRouter.post('/login', loginadminCtrl)

// ---- protected (admin must be logged in) ----
// get all admins
adminRouter.get('/', isLogin, alladminCtrl)

// logged-in admin's own profile  (declared before '/:id' so it isn't treated as an id)
adminRouter.get('/profile', isLogin, getadminprofile)

// admin dashboard stats
adminRouter.get('/stats', isLogin, getAdminStatsCtrl)

// admin dashboard analytics (detailed breakdown)
adminRouter.get('/analytics', isLogin, getAdminAnalyticsCtrl)

// get single admin by id
adminRouter.get('/:id', isLogin, singleadminCtrl)

// update admin
adminRouter.put('/:id', isLogin, updateadminCtrl)

// delete admin
adminRouter.delete('/:id', isLogin, deleteadminCtrl)

// admin sets teacher status (active/suspended/withdrawn)
adminRouter.put('/set-status/teacher/:id', isLogin, setTeacherStatusCtrl)

// admin publish exam results
adminRouter.put('/publish/exam/:id', isLogin, publishexamCtrl)

// admin unpublish exam results
adminRouter.put('/unpublish/exam/:id', isLogin, unpublishexamCtrl)


module.exports = adminRouter
