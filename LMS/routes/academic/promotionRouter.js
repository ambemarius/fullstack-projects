// End-of-year promotion (administrators).
//   GET  /api/v1/promotion/preview?classId=&yearId=   students, averages and proposed decisions
//   POST /api/v1/promotion/apply                       { classId, yearId, nextClassId, decisions }
const express = require('express');
const isLogin = require('../../middlewares/isLogin');
const { createPromotionService } = require('../../model/Academic/promotionService');

const router = express.Router();
let defaultService;
const serviceFor = req => req.app.locals.promotionService || (defaultService ||= createPromotionService());
const handle = fn => async (req, res, next) => {
    try { await fn(req, res); } catch (err) {
        if (err.statusCode && err.statusCode < 500) return res.status(err.statusCode).json({ status: 'error', message: err.message });
        next(err);
    }
};

router.get('/preview', isLogin, handle(async (req, res) => {
    res.set('Cache-Control', 'private, no-store').json({ status: 'success', data: await serviceFor(req).preview({ classId: req.query.classId, yearId: req.query.yearId }) });
}));
router.post('/apply', isLogin, handle(async (req, res) => {
    res.json({ status: 'success', data: await serviceFor(req).apply({ id: req.auth.legacyId }, req.body || {}) });
}));

module.exports = router;
