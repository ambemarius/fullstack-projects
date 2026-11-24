// School directory.
//   GET /api/v1/schools/search?q=   public: active schools (all, or those whose name or code contains q) for the sign-in page,
//                                   with the town and region given at sign-up. Names and codes only.
//   GET /api/v1/schools/mine        the signed-in account's school (name and code), for page headings.
const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { sql, pool, poolConnect } = require('../../config/database');

const router = express.Router();
async function defaultQuery(statement, params = {}) {
    await poolConnect;
    const r = pool.request();
    for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value);
    return r.query(statement);
}
const queryFor = req => req.app.locals.schoolDirectoryQuery || defaultQuery;

const searchLimit = rateLimit({
    windowMs: 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false,
    keyGenerator: req => ipKeyGenerator(req.ip || ''),
    skip: () => process.env.NODE_ENV === 'test',
    handler: (_req, res) => res.status(429).json({ status: 'error', message: 'Too many searches. Wait a minute.' }),
});

router.get('/search', searchLimit, async (req, res, next) => {
    try {
        // Empty q: every active school, for the dropdown; otherwise schools whose name or code contains q.
        const q = String(req.query.q || '').trim().replace(/\s+/g, ' ').slice(0, 60);
        // LIKE wildcards typed by the visitor are matched literally ("!" is the escape character).
        const like = '%' + q.replace(/[!%_[]/g, ch => '!' + ch) + '%';
        const rows = (await queryFor(req)(`SELECT TOP (300) s.code, s.name, r.address, rg.name AS region, d.name AS division
            FROM schools s
            OUTER APPLY (SELECT TOP 1 x.address, x.region_id, x.division_id FROM school_signup_requests x
                         WHERE x.activated_school_id = s.id ORDER BY x.reviewed_at DESC) r
            LEFT JOIN regions rg ON rg.id = r.region_id
            LEFT JOIN divisions d ON d.id = r.division_id
            WHERE s.status = 'active' AND (s.name LIKE @like ESCAPE '!' OR s.code LIKE @like ESCAPE '!')
            ORDER BY CASE WHEN s.name LIKE @start ESCAPE '!' THEN 0 ELSE 1 END, s.name`,
        { like: [sql.NVarChar(130), like], start: [sql.NVarChar(130), like.slice(1)] })).recordset;
        res.json({ status: 'success', data: rows.map(r => ({ code: r.code, name: r.name, place: [r.division, r.region].filter(Boolean).join(' · ') })) });
    } catch (err) { next(err); }
});

// The school comes from the signed sign-in token (middlewares/tenantContext.js), never from the request.
router.get('/mine', async (req, res, next) => {
    try {
        if (!req.schoolId) return res.status(401).json({ status: 'error', message: 'Sign in to see your school.' });
        const school = (await queryFor(req)('SELECT code, name FROM schools WHERE id = @id', { id: [sql.Int, req.schoolId] })).recordset[0];
        if (!school) return res.status(404).json({ status: 'error', message: 'School not found.' });
        res.set('Cache-Control', 'private, no-store').json({ status: 'success', data: school });
    } catch (err) { next(err); }
});

module.exports = router;
