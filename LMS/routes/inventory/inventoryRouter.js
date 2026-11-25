// Server-rendered library, laboratory and teacher lab-request pages.
const crypto = require('node:crypto');
const express = require('express');
const asyncHandler = require('express-async-handler');
const { requireStaff } = require('../../middlewares/staffAccess');
const { createInventoryService } = require('../../model/inventory/inventoryService');
const Teacher = require('../../model/staff/teacher');

// Teachers make laboratory requests only when they teach a subject marked "Requires practicals".
function practicalsOnly(staffGate, teachesPracticals) {
    return (req, res, next) => staffGate(req, res, async err => {
        if (err) return next(err);
        try {
            if (req.actor.type === 'teacher' && !await teachesPracticals(req.actor.id)) {
                return next(Object.assign(new Error('Laboratory requests are for teachers of subjects with practicals. Ask your administrator to tick "Requires practicals" on your subject.'), { statusCode: 403 }));
            }
            next();
        } catch (e) { next(e); }
    });
}

const PATHS = { library: '/library', laboratory: '/laboratory', requests: '/lab-requests' };
const HOME = { admin: '/admin-dashboard', teacher: '/teacher-dashboard', auxiliary: '/staff-dashboard' };
const ROLE_LABEL = { library: 'Librarian', laboratory: 'Laboratory attendant', requests: 'Teacher' };

function createInventoryRouter({ service = createInventoryService(), teachesPracticals = id => Teacher.teachesPracticals(id) } = {}) {
    const router = express.Router();
    const gates = {
        library: requireStaff({ duties: ['librarian'] }),
        laboratory: requireStaff({ duties: ['lab_attendant'] }),
        requests: practicalsOnly(requireStaff({ allowTeacher: true, allowAdmin: false }), teachesPracticals),
    };

    const base = (req, area, extra = {}) => ({
        area, paths: PATHS, uuid: crypto.randomUUID, actorName: req.actor?.name || '',
        roleLabel: !req.actor ? '' : req.actor.type === 'admin' ? 'Administrator' : ROLE_LABEL[area], home: HOME[req.actor?.type] || '/',
        isAdmin: req.actor?.type === 'admin', ...extra,
    });

    function renderError(req, res, area, err) {
        const status = err.statusCode || 500;
        if (status >= 500) throw err;
        res.status(status).render('inventory/error', base(req, area, { message: err.message, status }));
    }

    function gate(area) {
        return (req, res, next) => gates[area](req, res, err => {
            if (!err) return next();
            if (err.statusCode === 401 && req.method === 'GET') return res.redirect('/login?next=' + encodeURIComponent(PATHS[area]));
            try { renderError(req, res, area, err); } catch (e) { next(e); }
        });
    }

    const handle = (area, fn) => [gate(area), asyncHandler(async (req, res) => {
        try { await fn(req, res); } catch (err) { renderError(req, res, area, err); }
    })];

    router.get(PATHS.library, ...handle('library', async (req, res) => {
        const data = await service.listLibrary(req.actor, { search: typeof req.query.search === 'string' ? req.query.search : '', status: req.query.status || '', classId: req.query.classId || '' });
        res.render('inventory/library', base(req, 'library', { ...data, saved: req.query.saved === '1' }));
    }));
    // The signed-in teacher's own requests as JSON, for the summary on the teacher dashboard (same gate as the page).
    router.get(PATHS.requests + '/mine', gate('requests'), asyncHandler(async (req, res) => {
        try {
            const data = await service.listLab(req.actor, 'requests', { subject: '' });
            res.set('Cache-Control', 'private, no-store').json({ status: 'success', data: { requests: data.requests || [], today: data.today || null } });
        } catch (err) {
            res.status(err.statusCode && err.statusCode < 500 ? err.statusCode : 500).json({ status: 'error', message: err.statusCode && err.statusCode < 500 ? err.message : 'Could not load your requests.' });
        }
    }));
    for (const area of ['laboratory', 'requests']) {
        router.get(PATHS[area], ...handle(area, async (req, res) => {
            const data = await service.listLab(req.actor, area, { subject: typeof req.query.subject === 'string' ? req.query.subject : '' });
            res.render('inventory/laboratory', base(req, area, { ...data, saved: req.query.saved === '1' }));
        }));
    }
    for (const area of Object.keys(PATHS)) {
        router.post(PATHS[area], ...handle(area, async (req, res) => {
            await service.save(req.actor, area, req.body || {});
            const keep = typeof req.body?.returnTo === 'string' && /^\?[\w=&%.+-]+$/.test(req.body.returnTo) ? '&' + req.body.returnTo.slice(1) : '';
            res.redirect(303, `${PATHS[area]}?saved=1${keep}`);
        }));
    }
    return router;
}

module.exports = createInventoryRouter();
module.exports.createInventoryRouter = createInventoryRouter;
