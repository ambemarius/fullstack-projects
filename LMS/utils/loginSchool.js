// The school a sign-in belongs to, from the school code the person typed (schools.code).
// While only one school is active, the code may be left out and that school is used.
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });

async function defaultRead(statement, params) {
    const { sql, pool, poolConnect } = require('../config/database');
    await poolConnect;
    const r = pool.request();
    if (params.code !== undefined) r.input('code', sql.NVarChar(50), params.code);
    return r.query(statement);
}

const normalise = code => String(code || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

async function resolveLoginSchool(schoolCode, read = defaultRead) {
    const code = normalise(schoolCode);
    if (code) {
        if (!/^[A-Z0-9_]{2,50}$/.test(code)) throw fail(400, 'Enter a valid school code.');
        const school = (await read("SELECT id, code, name, status FROM schools WHERE UPPER(code) = @code", { code })).recordset[0];
        // Unknown and suspended schools get the same answer as a wrong password, so codes cannot be probed.
        if (!school || school.status !== 'active') throw fail(401, 'Invalid login credentials');
        return { id: school.id, code: school.code, name: school.name };
    }
    const active = (await read("SELECT TOP (2) id, code, name FROM schools WHERE status = 'active' ORDER BY id", {})).recordset;
    if (active.length === 1) return { id: active[0].id, code: active[0].code, name: active[0].name };
    throw fail(400, 'Enter your school code.');
}

module.exports = { resolveLoginSchool, normaliseSchoolCode: normalise };
