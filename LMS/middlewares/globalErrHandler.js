const { randomUUID } = require('node:crypto');
const { wantsErrorPage, renderErrorPage } = require('../utils/pageError');

function globalErrHandler(err, req, res, next) {
    if (res.headersSent) return next(err);
    const statusCode = Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode <= 599
        ? err.statusCode : 500;
    // Unexpected driver/parser messages may contain SQL or submitted secrets.
    const message = statusCode >= 500 ? 'An unexpected error occurred'
        : err.type === 'entity.parse.failed' ? 'Invalid JSON request'
        : err.message || 'Request failed';
    const requestId = randomUUID();
    // The client only sees the request id; the operator needs the cause. Never log the request body.
    if (statusCode >= 500 && process.env.NODE_ENV !== 'test') {
        console.error(`[${new Date().toISOString()}] ${requestId} ${req.method} ${req.originalUrl.split('?')[0]} -> ${statusCode}: ${err.stack || err.message}`);
    }
    if (wantsErrorPage(req)) return renderErrorPage(res, statusCode, requestId);
    // A short machine-readable reason for the few cases the browser acts on (e.g. PASSWORD_CHANGE_REQUIRED).
    res.status(statusCode).json({ status: 'failed', message, requestId, ...(statusCode < 500 && err.publicCode ? { code: err.publicCode } : {}) });
}

function notFoundErr(_req, _res, next) {
    const err = new Error('Resource not found');
    err.statusCode = 404;
    next(err);
}

module.exports = { globalErrHandler, notFoundErr };
