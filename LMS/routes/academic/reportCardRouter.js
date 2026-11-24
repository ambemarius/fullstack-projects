const express = require('express');
const reportCardRouter = express.Router();
const { getReportCardCtrl } = require('../../controllers/academic/reportCardCtrl');
const bulletin = require('../../controllers/academic/bulletinCtrl');
const isLogin = require('../../middlewares/isLogin');
const { uploadSingle } = require('../../middlewares/upload');

// Printable report cards (bulletins): heading, reopening dates, subject bands, discipline records, figures.
const imageKind = (req, res, next) => (['logo', 'signature'].includes(req.params.kind) ? next() : res.status(404).json({ status: 'error', message: 'Resource not found' }));
reportCardRouter.get('/settings', isLogin, bulletin.getSettings);
reportCardRouter.put('/settings', isLogin, bulletin.saveSettings);
reportCardRouter.get('/templates', isLogin, bulletin.templates);
reportCardRouter.put('/settings/template', isLogin, bulletin.saveTemplate);
reportCardRouter.post('/settings/:kind', isLogin, imageKind, ...uploadSingle('image', { category: 'image', subDir: 'reportcard' }), bulletin.uploadImage);
reportCardRouter.delete('/settings/:kind', isLogin, imageKind, bulletin.removeImage);
reportCardRouter.get('/reopening/:yearId', isLogin, bulletin.getReopening);
reportCardRouter.put('/reopening', isLogin, bulletin.saveReopening);
reportCardRouter.get('/groups', isLogin, bulletin.getGroups);
reportCardRouter.put('/groups', isLogin, bulletin.saveGroups);
reportCardRouter.get('/records/:classId/:term/:yearId', isLogin, bulletin.getRecords);
reportCardRouter.put('/records/:classId/:term/:yearId', isLogin, bulletin.saveRecords);
reportCardRouter.get('/bulletins/:classId/:term/:yearId', isLogin, bulletin.getCards);

// Class broadsheet (existing).
reportCardRouter.get('/:classId/:term/:academicYearId', isLogin, getReportCardCtrl);

module.exports = reportCardRouter;
