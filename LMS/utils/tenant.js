// The tenant context: the id of the school the current request (or job) works for.
// Set in one place per request (middlewares/tenantContext.js, refined by middlewares/roleAuth.js),
// from the signed-in account and its signed token, never from a form, query string, body or header.
// config/database.js passes it to SQL Server on every query (SESSION_CONTEXT 'school_id'), where it stamps
// new rows (migration 021) and row-level security (migration 024) shows only that school's rows.
const { AsyncLocalStorage } = require('node:async_hooks');

const storage = new AsyncLocalStorage();
const validId = id => Number.isSafeInteger(id) && id > 0;

// Runs fn with the school set; everything it awaits (queries included) sees the same school.
function runWithSchool(schoolId, fn) {
    if (!validId(schoolId)) throw new Error('A valid school id is required');
    return storage.run({ schoolId }, fn);
}

// The current school, or null when none is set (sign-in pages, health checks, platform tools).
function optionalSchoolId() {
    const store = storage.getStore();
    return store && validId(store.schoolId) ? store.schoolId : null;
}

// The current school; stops with an error instead of working without one.
function currentSchoolId() {
    const id = optionalSchoolId();
    if (id === null) throw Object.assign(new Error('No school is set for this request'), { statusCode: 500 });
    return id;
}

// Runs fn with no school set (for work that must never inherit one, such as platform tasks).
function runWithoutSchool(fn) {
    return storage.run({ schoolId: null }, fn);
}

module.exports = { runWithSchool, runWithoutSchool, optionalSchoolId, currentSchoolId };
