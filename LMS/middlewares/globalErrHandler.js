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
    if (wantsErrorPage(req)) return renderErrorPage(res, statusCode, requestId);
    res.status(statusCode).json({ status: 'failed', message, requestId });
}

function notFoundErr(_req, _res, next) {
    const err = new Error('Resource not found');
    err.statusCode = 404;
    next(err);
}

module.exports = { globalErrHandler, notFoundErr };
