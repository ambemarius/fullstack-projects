const { getFeatureFlag } = require('../config/environment');

// Staged features stay unreachable until their runtimePolicy flag is turned on,
// so unfinished code can ship without exposing unscoped reads or writes.
function createStagedFeaturesGate(flag = getFeatureFlag) {
    return function stagedFeaturesGate(req, res, next) {
        const path = req.path.replace(/\/+$/, '');
        const parentsApi = /^\/api\/v1\/parents(?:\/|$)/i.test(path);
        const parentsPage = /^\/parent-dashboard$/i.test(path);
        const analytics = /^\/api\/v1\/admin\/analytics$/i.test(path);
        if ((parentsApi || parentsPage) && flag('parents.enabled', false)) return next();
        if (analytics && flag('analytics.enabled', false)) return next();
        if (parentsApi || analytics) {
            return res.status(404).set('Cache-Control', 'no-store').json({
                status: 'failed', message: 'This feature is not available in this workspace yet.'
            });
        }
        if (parentsPage) {
            res.set('Cache-Control', 'no-store');
            return require('../utils/pageError').pageDenied(req, res, 404, 'Parent access is not available yet.');
        }
        next();
    };
}

module.exports = { stagedFeaturesGate: createStagedFeaturesGate(), createStagedFeaturesGate };
