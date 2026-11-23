// Server-rendered finance workspace: administrators, and staff holding the bursar duty.
const crypto = require('node:crypto');
const express = require('express');
const asyncHandler = require('express-async-handler');
const { requireStaff } = require('../../middlewares/staffAccess');
const { createFinanceService, formatMoney, today, methodLabel } = require('../../model/finance/financeService');
const { financeCollectionsCsv, financeStatementCsv, financeOutstandingCsv } = require('../../utils/financeCsv');

const BASE = '/finance';
const HOME = { admin: '/admin-dashboard', teacher: '/teacher-dashboard', auxiliary: '/staff-dashboard' };

function createFinanceRouter({ service = createFinanceService() } = {}) {
    const router = express.Router();
    const gate = requireStaff({ duties: ['bursar'] });

    function locals(req, extra) {
        const a = req.actor;
        return {
            base: BASE, formatMoney, methodLabel, uuid: crypto.randomUUID, today: today(),
            actorName: a.name, roleLabel: a.type === 'admin' ? 'Administrator' : 'Bursar', home: HOME[a.type] || '/',
            ...extra,
        };
    }

    function renderError(req, res, err) {
        const status = err.statusCode || 500;
        if (status >= 500) throw err;
        res.status(status).render('finance/error', {
            base: BASE, message: err.message, status,
            actorName: req.actor?.name || '', roleLabel: '', home: HOME[req.actor?.type] || '/',
        });
    }

    // Pages: a signed-out visitor goes to sign-in; a signed-in person without the duty sees why.
    router.use((req, res, next) => gate(req, res, err => {
        if (!err) return next();
        if (err.statusCode === 401 && req.method === 'GET') return res.redirect('/login?next=' + encodeURIComponent(BASE));
        try { renderError(req, res, err); } catch (e) { next(e); }
    }));

    const handle = fn => asyncHandler(async (req, res) => {
        try { await fn(req, res); } catch (err) { renderError(req, res, err); }
    });

    router.get('/', handle(async (req, res) => {
        const search = typeof req.query.search === 'string' ? req.query.search : '';
        if (req.query.charge) {
            const data = await service.detail(req.actor, req.query.charge);
            return res.render('finance/charge', locals(req, { ...data, saved: req.query.saved === '1' }));
        }
        const data = await service.list(req.actor, search);
        res.render('finance/index', locals(req, { ...data, search }));
    }));

    router.post('/', handle(async (req, res) => {
        const saved = await service.save(req.actor, req.body || {});
        res.redirect(303, saved.paymentId ? `${BASE}/receipt/${saved.paymentId}` : `${BASE}?charge=${saved.id}&saved=1`);
    }));

    // JSON for the registration form's finance summary.
    router.get('/balance/:student', asyncHandler(async (req, res) => {
        res.set('Cache-Control', 'no-store').json({ status: 'success', data: await service.studentBalance(req.actor, req.params.student) });
    }));

    router.get('/receipt/:payment', handle(async (req, res) => {
        res.render('finance/receipt', locals(req, await service.receipt(req.actor, req.params.payment)));
    }));

    router.get('/collections', handle(async (req, res) => {
        if (req.query.format !== undefined && req.query.format !== 'csv') return res.sendStatus(422);
        const report = await service.collections(req.actor, {
            from: req.query.from ?? today(), to: req.query.to ?? today(), method: req.query.method, operator: req.query.operator,
        });
        if (req.query.format === 'csv') {
            return res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="collections-${report.from}-${report.to}.csv"` })
                .send(financeCollectionsCsv(report, { practice: false }));
        }
        res.render('finance/collections', locals(req, {
            ...report,
            exportQuery: new URLSearchParams({ from: report.from, to: report.to, method: report.method, operator: report.operator || '', format: 'csv' }).toString(),
        }));
    }));

    router.get('/statements', handle(async (req, res) => {
        if (req.query.format !== undefined && req.query.format !== 'csv') return res.sendStatus(422);
        const statement = await service.studentStatement(req.actor, { student: req.query.student, year: req.query.year, search: req.query.search });
        if (req.query.format === 'csv') {
            if (!statement.student) throw Object.assign(new Error('Select a student before downloading a statement.'), { statusCode: 422 });
            return res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="statement-${statement.student.matricule}.csv"` })
                .send(financeStatementCsv(statement, { practice: false }));
        }
        res.render('finance/statement', locals(req, {
            ...statement,
            exportQuery: new URLSearchParams({ student: statement.student?.id || '', year: statement.yearId || '', format: 'csv' }).toString(),
        }));
    }));

    // Who still owes: the whole school class by class, or one class student by student.
    router.get('/outstanding', handle(async (req, res) => {
        if (req.query.format !== undefined && req.query.format !== 'csv') return res.sendStatus(422);
        const report = await service.outstanding(req.actor, { year: req.query.year, class: req.query.class, show: req.query.show });
        if (req.query.format === 'csv') {
            const cls = report.classId ? report.classes.find(c => c.id === report.classId).label.replace(/[^\w]+/g, '-') : 'whole-school';
            return res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="outstanding-${cls}-${report.asOf}.csv"` })
                .send(financeOutstandingCsv(report));
        }
        const query = extra => new URLSearchParams({ year: report.yearId || '', ...(report.classId ? { class: report.classId, show: report.show } : {}), ...extra }).toString();
        res.render('finance/outstanding', locals(req, { ...report, query, exportQuery: query({ format: 'csv' }) }));
    }));

    router.post('/bulk/:step', handle(async (req, res) => {
        if (!['review', 'confirm'].includes(req.params.step)) return res.sendStatus(404);
        const confirmed = req.params.step === 'confirm';
        const result = confirmed ? await service.confirmBulk(req.actor, req.body?.review) : await service.reviewBulk(req.actor, req.body || {});
        res.render('finance/bulk', locals(req, { result, confirmed }));
    }));

    return router;
}

module.exports = createFinanceRouter();
module.exports.createFinanceRouter = createFinanceRouter;
