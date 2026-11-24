// School sign-up: a school registers itself from the public site and KodoSchool staff validate it.
//   submit   public; stores a pending request (school, super administrator, password hash) with a reference
//   list     KodoSchool admins (platform console)
//   approve  creates the school (status active) and its super administrator, inside one transaction
//   reject   records the reason
// Activating a second school is refused while reads are not isolated by school (row-level security off),
// because the older screens would otherwise show it the first school's records.
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { sql, pool, poolConnect } = require('../../config/database');

const SYSTEMS = ['Anglophone', 'Francophone', 'Bilingual'];
const FUNCTIONS = ['Principal', 'Vice-principal', 'Discipline master', 'Bursar', 'Head of studies', 'IT officer', 'Proprietor / founder', 'Other'];
const fail = (statusCode, message, field) => Object.assign(new Error(message), { statusCode, field });

function text(value, label, max, { min = 2, field } = {}) {
    const t = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    if (t.length < min) throw fail(422, `Enter the ${label}.`, field);
    if (t.length > max) throw fail(422, `The ${label} can be at most ${max} characters.`, field);
    return t;
}
function positiveId(value, label, field) {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < 1) throw fail(422, `Choose the ${label}.`, field);
    return n;
}
// Cameroon mobile numbers: 9 digits starting with 6 (or 2 for fixed lines), with or without +237.
function phone(value) {
    const digits = String(value || '').replace(/[\s().-]/g, '').replace(/^(\+?237|00237)/, '');
    if (!/^[26]\d{8}$/.test(digits)) throw fail(422, 'Enter a Cameroon phone number, for example 6 77 12 34 56.', 'adminPhone');
    return '+237' + digits;
}
function email(value) {
    const e = String(value || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || e.length > 255) throw fail(422, 'Enter a valid email address.', 'adminEmail');
    return e;
}
function password(value) {
    if (typeof value !== 'string' || value.length < 8 || value.length > 72 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) {
        throw fail(422, 'Choose a password of at least 8 characters with letters and numbers.', 'password');
    }
    return value;
}
// "Lycée Bilingue de Batouri" -> "LYCEE_BILINGUE_BATOURI"
function codeFromName(name) {
    const stop = new Set(['DE', 'DU', 'DES', 'LA', 'LE', 'LES', 'OF', 'THE', 'AND', 'ET', 'D', 'L']);
    const words = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(w => w && !stop.has(w));
    let code = words.join('_').slice(0, 40).replace(/_+$/, '');
    if (code.length < 2) code = 'SCHOOL';
    return code;
}
const reference = () => 'KS-' + crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 8);

async function defaultQuery(statement, params = {}) {
    await poolConnect;
    const r = pool.request();
    for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value);
    return r.query(statement);
}
async function defaultTransaction() {
    await poolConnect;
    const tx = pool.transaction();
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    return {
        query(statement, params = {}) {
            const r = new sql.Request(tx);
            for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value);
            return r.query(statement);
        },
        commit: () => tx.commit(),
        rollback: () => tx.rollback(),
    };
}
async function defaultIsolationReady(query) {
    const row = (await query('SELECT COUNT(*) AS n FROM sys.security_policies WHERE is_enabled = 1')).recordset[0];
    return row.n > 0;
}

function createSchoolSignupService({ query = defaultQuery, transaction = defaultTransaction, isolationReady = defaultIsolationReady, hash = p => bcrypt.hash(p, 12) } = {}) {
    async function regions() {
        return (await query('SELECT id, name FROM regions ORDER BY name')).recordset;
    }
    async function divisions(regionId) {
        const region = positiveId(regionId, 'region', 'regionId');
        return (await query('SELECT id, name FROM divisions WHERE region_id = @region ORDER BY name', { region: [sql.Int, region] })).recordset;
    }

    async function freeCode(base) {
        const taken = new Set((await query(`SELECT UPPER(code) AS code FROM schools WHERE UPPER(code) LIKE @like
            UNION SELECT UPPER(proposed_code) FROM school_signup_requests WHERE status = 'pending' AND UPPER(proposed_code) LIKE @like`,
        { like: [sql.NVarChar(60), base + '%'] })).recordset.map(r => r.code));
        if (!taken.has(base)) return base;
        for (let i = 2; i < 1000; i++) if (!taken.has(`${base}_${i}`)) return `${base}_${i}`;
        throw fail(409, 'Choose a more specific school name.');
    }

    async function submit(body = {}, { ip = null } = {}) {
        if (body.website) throw fail(422, 'Your request could not be sent.'); // honeypot: hidden from people
        const school = {
            name: text(body.schoolName, 'school name', 200, { min: 3, field: 'schoolName' }),
            system: SYSTEMS.includes(body.educationSystem) ? body.educationSystem : (() => { throw fail(422, 'Choose the language system.', 'educationSystem'); })(),
            address: text(body.address, 'address', 255, { min: 3, field: 'address' }),
            region: positiveId(body.regionId, 'region', 'regionId'),
            division: positiveId(body.divisionId, 'division', 'divisionId'),
        };
        const admin = {
            name: text(body.adminName, 'full name', 200, { min: 3, field: 'adminName' }),
            phone: phone(body.adminPhone),
            email: email(body.adminEmail),
            function: body.adminFunction === 'Other'
                ? text(body.adminFunctionOther, 'function', 80, { field: 'adminFunctionOther' })
                : FUNCTIONS.includes(body.adminFunction) ? body.adminFunction : (() => { throw fail(422, 'Choose the function.', 'adminFunction'); })(),
        };
        const pass = password(body.password);
        if (body.acceptTerms !== true) throw fail(422, 'Confirm that the details are correct and that you may register this school.', 'acceptTerms');

        const division = (await query('SELECT region_id FROM divisions WHERE id = @d', { d: [sql.Int, school.division] })).recordset[0];
        if (!division || division.region_id !== school.region) throw fail(422, 'Choose a division in the selected region.', 'divisionId');
        const duplicate = (await query(`SELECT reference FROM school_signup_requests WHERE status = 'pending' AND admin_email = @email AND school_name = @name`,
            { email: [sql.NVarChar(255), admin.email], name: [sql.NVarChar(200), school.name] })).recordset[0];
        if (duplicate) throw fail(409, `This school is already waiting for validation (reference ${duplicate.reference}).`);

        const code = await freeCode(codeFromName(school.name));
        const ref = reference();
        await query(`INSERT INTO school_signup_requests (reference, school_name, education_system, address, region_id, division_id, proposed_code,
                admin_name, admin_phone, admin_email, admin_function, admin_password_hash, request_ip)
            VALUES (@ref, @name, @system, @address, @region, @division, @code, @aname, @aphone, @aemail, @afunction, @hash, @ip)`, {
            ref: [sql.NVarChar(20), ref], name: [sql.NVarChar(200), school.name], system: [sql.VarChar(20), school.system],
            address: [sql.NVarChar(255), school.address], region: [sql.Int, school.region], division: [sql.Int, school.division],
            code: [sql.NVarChar(50), code], aname: [sql.NVarChar(200), admin.name], aphone: [sql.NVarChar(20), admin.phone],
            aemail: [sql.NVarChar(255), admin.email], afunction: [sql.NVarChar(80), admin.function],
            hash: [sql.NVarChar(255), await hash(pass)], ip: [sql.NVarChar(45), ip ? String(ip).slice(0, 45) : null],
        });
        return { reference: ref, schoolCode: code, schoolName: school.name, adminEmail: admin.email, status: 'pending' };
    }

    // ---------------------------------------------------------------- KodoSchool admins (routes/platform/platformRouter.js)
    const COLUMNS = `r.id, r.reference, r.school_name, r.education_system, r.address, r.proposed_code, r.admin_name, r.admin_phone, r.admin_email,
        r.admin_function, r.status, r.created_at, r.reviewed_at, r.review_note, r.activated_school_id, rg.name AS region, d.name AS division, a.name AS reviewed_by_name`;
    const FROM = 'FROM school_signup_requests r JOIN regions rg ON rg.id = r.region_id JOIN divisions d ON d.id = r.division_id LEFT JOIN platform_admins a ON a.id = r.reviewed_by';

    async function list(status = 'pending') {
        const st = ['pending', 'approved', 'rejected', 'all'].includes(status) ? status : 'pending';
        const rows = (await query(`SELECT TOP (500) ${COLUMNS} ${FROM} WHERE @status = 'all' OR r.status = @status ORDER BY r.created_at DESC`,
            { status: [sql.VarChar(12), st] })).recordset;
        const counts = (await query("SELECT status, COUNT(*) AS n FROM school_signup_requests GROUP BY status")).recordset;
        return { status: st, requests: rows, counts: Object.fromEntries(['pending', 'approved', 'rejected'].map(s => [s, counts.find(c => c.status === s)?.n || 0])), isolationReady: await isolationReady(query) };
    }

    async function approve(actor, id) {
        const requestId = positiveId(id, 'request');
        if (!await isolationReady(query)) {
            throw fail(409, 'Approving is paused: school data is not yet separated on every screen (row-level security is off). Turn it on first, then approve.');
        }
        const tx = await transaction();
        try {
            const r = (await tx.query(`SELECT * FROM school_signup_requests WITH (UPDLOCK, HOLDLOCK) WHERE id = @id`, { id: [sql.Int, requestId] })).recordset[0];
            if (!r) throw fail(404, 'Request not found.');
            if (r.status !== 'pending') throw fail(409, `This request was already ${r.status}.`);
            const clash = (await tx.query('SELECT 1 AS x FROM schools WITH (UPDLOCK, HOLDLOCK) WHERE UPPER(code) = UPPER(@code)', { code: [sql.NVarChar(50), r.proposed_code] })).recordset.length;
            if (clash) throw fail(409, `The school code ${r.proposed_code} is already in use.`);
            const schoolId = (await tx.query(`INSERT INTO schools (code, name, education_system, status) OUTPUT INSERTED.id VALUES (@code, @name, @system, 'active')`, {
                code: [sql.NVarChar(50), r.proposed_code], name: [sql.NVarChar(200), r.school_name], system: [sql.VarChar(20), r.education_system],
            })).recordset[0].id;
            await tx.query(`INSERT INTO Admins (name, email, password, role, school_id) VALUES (@name, @email, @hash, 'Admin', @school)`, {
                name: [sql.NVarChar(200), r.admin_name], email: [sql.NVarChar(255), r.admin_email], hash: [sql.NVarChar(255), r.admin_password_hash], school: [sql.Int, schoolId],
            });
            await tx.query(`UPDATE school_signup_requests SET status = 'approved', reviewed_by = @actor, reviewed_at = SYSUTCDATETIME(), activated_school_id = @school WHERE id = @id`,
                { actor: [sql.Int, actor.id], school: [sql.Int, schoolId], id: [sql.Int, requestId] });
            await tx.commit();
            return { id: requestId, status: 'approved', schoolId, schoolCode: r.proposed_code, adminEmail: r.admin_email };
        } catch (error) {
            await tx.rollback().catch(() => {});
            throw error;
        }
    }

    async function reject(actor, id, note) {
        const requestId = positiveId(id, 'request');
        const reason = text(note, 'reason', 500, { min: 3, field: 'note' });
        const updated = (await query(`UPDATE school_signup_requests SET status = 'rejected', reviewed_by = @actor, reviewed_at = SYSUTCDATETIME(), review_note = @note
            OUTPUT INSERTED.id WHERE id = @id AND status = 'pending'`, { actor: [sql.Int, actor.id], note: [sql.NVarChar(500), reason], id: [sql.Int, requestId] })).recordset;
        if (!updated.length) throw fail(409, 'This request is not waiting for validation.');
        return { id: requestId, status: 'rejected' };
    }

    return { regions, divisions, submit, list, approve, reject };
}

module.exports = { createSchoolSignupService, codeFromName, SYSTEMS, FUNCTIONS };
