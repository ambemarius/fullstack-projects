// Printable report cards (bulletins): settings, subject bands, discipline records and the A4 print page.
// All routes are administrator-only (isLogin). The service can be swapped through app.locals for tests.
const asyncHandler = require('express-async-handler');
const { createReportCardService, schoolIdFor } = require('../../model/Academic/reportCardService');
const { code128Svg } = require('../../utils/code128');

let defaultService;
const serviceFor = req => req.app.locals.reportCardService || (defaultService ||= createReportCardService());
const schoolOf = req => (req.app.locals.reportCardSchoolId ? Promise.resolve(req.app.locals.reportCardSchoolId) : schoolIdFor(req.userAuth));
const actorOf = req => ({ id: req.userAuth.id });
const ok = (res, data, status = 200) => res.status(status).json({ status: 'success', data });

exports.getSettings = asyncHandler(async (req, res) => ok(res, await serviceFor(req).getSettings(await schoolOf(req))));
exports.saveSettings = asyncHandler(async (req, res) => ok(res, await serviceFor(req).saveSettings(actorOf(req), await schoolOf(req), req.body || {})));

exports.uploadImage = asyncHandler(async (req, res) => {
    if (!req.file) return res.status(422).json({ status: 'error', message: 'Choose a PNG, JPEG or WebP image (up to 5 MB).' });
    ok(res, await serviceFor(req).setImage(actorOf(req), await schoolOf(req), req.params.kind, req.file.filename));
});
exports.removeImage = asyncHandler(async (req, res) => ok(res, await serviceFor(req).setImage(actorOf(req), await schoolOf(req), req.params.kind, null)));

exports.getReopening = asyncHandler(async (req, res) => ok(res, await serviceFor(req).getReopening(await schoolOf(req), { yearId: req.params.yearId })));
exports.saveReopening = asyncHandler(async (req, res) => {
    const { yearId, term, reopeningDate } = req.body || {};
    ok(res, await serviceFor(req).saveReopening(actorOf(req), await schoolOf(req), { yearId, term, reopeningDate }));
});

exports.getGroups = asyncHandler(async (req, res) => ok(res, await serviceFor(req).getGroups(await schoolOf(req))));
exports.saveGroups = asyncHandler(async (req, res) => ok(res, await serviceFor(req).saveGroups(actorOf(req), await schoolOf(req), (req.body || {}).groups)));

const classParams = req => ({ classId: req.params.classId, term: req.params.term, yearId: req.params.yearId });
exports.getRecords = asyncHandler(async (req, res) => ok(res, await serviceFor(req).getRecords(classParams(req))));
exports.saveRecords = asyncHandler(async (req, res) => ok(res, await serviceFor(req).saveRecords(actorOf(req), { ...classParams(req), records: (req.body || {}).records })));

// Every computed figure as JSON (for previews, exports or a snapshot when a term is published).
exports.getCards = asyncHandler(async (req, res) => {
    const data = await serviceFor(req).classCards({ ...classParams(req), studentId: req.query.studentId });
    const strip = c => ({ ...c, school: { ...c.school, logo: c.school.logo ? true : null, principal_signature: c.school.principal_signature ? true : null } });
    ok(res, { ...data, cards: data.cards.map(strip) });
});

// ---- print page helpers (same output as the original template's filters) ----
const num = (v, empty = '') => (v === null || v === undefined ? empty : Number(v).toFixed(2));
const coef = v => (v === null || v === undefined ? '' : Number.isInteger(Number(v)) ? String(Number(v)) : String(Number(v)));
const money = v => (!v ? '0' : Math.round(Number(v)).toLocaleString('en-US').replace(/,/g, ' '));
const dmy = v => {
    if (!v) return '';
    const iso = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
    const [y, m, d] = iso.split('-');
    return d && m && y ? `${d}.${m}.${y}` : '';
};

//@route GET /report-cards/print?classId=&term=&yearId=[&studentId=]   (A4, one page per student)
exports.printPage = asyncHandler(async (req, res) => {
    const { classId, term, yearId, studentId } = req.query;
    const data = await serviceFor(req).classCards({ classId, term, yearId, studentId });
    res.set('Cache-Control', 'private, no-store');
    res.render('report-card-print', {
        ...data,
        cards: data.cards.map(card => ({ ...card, barcode: code128Svg(card.student.matricule) })),
        fmt: { num, coef, money, dmy },
    });
});

exports.formatters = { num, coef, money, dmy };
