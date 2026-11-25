// Notification bell and school announcements.
//   GET    /api/v1/notifications              the signed-in account's key items (any school account)
//   GET    /api/v1/notifications/announcements          administrators: current, upcoming and recent announcements
//   POST   /api/v1/notifications/announcements          administrators: post one
//   DELETE /api/v1/notifications/announcements/:id      administrators: remove one
const express = require('express');
const isSchoolAccount = require('../../middlewares/isSchoolAccount');
const isLogin = require('../../middlewares/isLogin');
const { sql, pool, poolConnect } = require('../../config/database');
const { createNotificationFeed, schoolClock } = require('../../model/notifications/notificationFeed');

const router = express.Router();
let defaultFeed;
const feedFor = req => req.app.locals.notificationFeed || (defaultFeed ||= createNotificationFeed());
async function defaultQuery(statement, params = {}) {
    await poolConnect;
    const r = pool.request();
    for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value);
    return r.query(statement);
}
const queryFor = req => req.app.locals.announcementQuery || defaultQuery;
const fail = (res, status, message, field) => res.status(status).json({ status: 'error', message, field });
const AUDIENCE = ['everyone', 'staff', 'teachers', 'students', 'parents'];
const isoDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;

router.get('/', isSchoolAccount, async (req, res, next) => {
    try {
        const data = await feedFor(req).feed({ type: req.auth.accountType, id: req.auth.legacyId, schoolId: req.schoolId });
        res.set('Cache-Control', 'private, no-store').json({ status: 'success', data });
    } catch (err) { next(err); }
});

router.get('/announcements', isLogin, async (req, res, next) => {
    try {
        const today = schoolClock().date;
        const rows = (await queryFor(req)(`SELECT TOP (100) id, title, body, audience, CONVERT(char(10), starts_on, 23) AS starts_on, CONVERT(char(10), ends_on, 23) AS ends_on, created_at
            FROM school_announcements WHERE school_id = @school AND ends_on >= DATEADD(day, -30, @today) ORDER BY starts_on DESC, id DESC`,
        { school: [sql.Int, req.schoolId], today: [sql.Date, today] })).recordset;
        res.json({ status: 'success', data: rows.map(r => ({ ...r, state: r.ends_on < today ? 'ended' : r.starts_on > today ? 'upcoming' : 'showing' })) });
    } catch (err) { next(err); }
});

router.post('/announcements', isLogin, async (req, res, next) => {
    try {
        const b = req.body || {};
        const title = typeof b.title === 'string' ? b.title.trim() : '';
        const body = typeof b.body === 'string' ? b.body.trim() : '';
        if (title.length < 3 || title.length > 150) return fail(res, 422, 'Write a title of 3 to 150 characters.', 'title');
        if (body.length > 600) return fail(res, 422, 'The message can be at most 600 characters.', 'body');
        if (!AUDIENCE.includes(b.audience)) return fail(res, 422, 'Choose who sees it.', 'audience');
        if (!isoDate(b.startsOn)) return fail(res, 422, 'Choose the first day it shows.', 'startsOn');
        if (!isoDate(b.endsOn) || b.endsOn < b.startsOn) return fail(res, 422, 'Choose a last day on or after the first day.', 'endsOn');
        const row = (await queryFor(req)(`INSERT INTO school_announcements (school_id, title, body, audience, starts_on, ends_on, created_by)
            OUTPUT INSERTED.id VALUES (@school, @title, @body, @audience, @starts, @ends, @actor)`, {
            school: [sql.Int, req.schoolId], title: [sql.NVarChar(150), title], body: [sql.NVarChar(600), body || null],
            audience: [sql.VarChar(12), b.audience], starts: [sql.Date, b.startsOn], ends: [sql.Date, b.endsOn], actor: [sql.Int, req.auth.legacyId],
        })).recordset[0];
        res.status(201).json({ status: 'success', data: { id: row.id } });
    } catch (err) { next(err); }
});

router.delete('/announcements/:id', isLogin, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id < 1) return fail(res, 404, 'Announcement not found.');
        const gone = (await queryFor(req)('DELETE FROM school_announcements OUTPUT DELETED.id WHERE id = @id AND school_id = @school',
            { id: [sql.Int, id], school: [sql.Int, req.schoolId] })).recordset;
        if (!gone.length) return fail(res, 404, 'Announcement not found.');
        res.json({ status: 'success', data: { id } });
    } catch (err) { next(err); }
});

module.exports = router;
