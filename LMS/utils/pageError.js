// Browser page presentation only; never changes authorization or API responses.
function wantsErrorPage(req) {
    return ['GET', 'HEAD'].includes(req.method)
        && !/^\/api(?:\/|$)/i.test(req.path)
        && /text\/html/i.test(req.get('Accept') || '')
        && req.accepts(['html', 'json']) === 'html';
}

function errorPageModel(statusCode, requestId = '') {
    const messages = {
        401: ['Sign in to continue', 'Your session may have ended. Return to the workspace to sign in again.'],
        403: ['This page is not available to your account', 'Return to your workspace to choose an available tool. Contact your school administrator if you need access.'],
        404: ['Page not found', 'This page may have moved, or it may not be available in this workspace.'],
        409: ['This page needs a fresh review', 'The record may have changed. Reopen the workspace and review the latest information.'],
        422: ['Check your selection', 'Return to the workspace and check the selected record or filters.'],
        429: ['Please try again shortly', 'There have been too many requests. Wait a moment before returning to the workspace.']
    };
    const [title, description] = messages[statusCode] || (statusCode >= 500
        ? ['We could not open this page', 'Please try again shortly. If the problem continues, share the reference below with your school administrator.']
        : ['We could not complete this request', 'Return to the workspace and review your selection.']);
    return { statusCode, title, description, requestId };
}

function renderErrorPage(res, statusCode, requestId = '') {
    return res.status(statusCode).set('Cache-Control', 'no-store')
        .render('page-error', errorPageModel(statusCode, requestId));
}

function pageDenied(req, res, statusCode, originalMessage) {
    if (wantsErrorPage(req)) return renderErrorPage(res, statusCode);
    return res.status(statusCode).send(originalMessage);
}

module.exports = { wantsErrorPage, errorPageModel, renderErrorPage, pageDenied };
