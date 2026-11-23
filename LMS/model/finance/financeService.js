// Financial management for the single application. Ported from model/identity/financeService.js:
// validation, SQL and transaction rules are unchanged; identity comes from req.actor
// (middlewares/staffAccess.js) instead of identity-layer sessions.
const crypto = require('node:crypto');
const { sql, pool, poolConnect } = require('../../config/database');

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function text(v, max, optional = false) {
    if (typeof v !== 'string' || v.length > max || (!optional && !v.trim())) throw fail(422, 'Complete the text fields within their limits.');
    return v.trim();
}
function id(v) { if (!/^[1-9]\d{0,9}$/.test(String(v)) || Number(v) > 2147483647) throw fail(422, 'Choose a record.'); return Number(v); }
function amount(v) { if (!/^[1-9]\d{0,11}$/.test(String(v))) throw fail(422, 'Enter a positive amount in whole CFA francs (up to 12 digits).'); return String(v); }
function date(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v < '0001-01-01' || Number.isNaN(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) throw fail(422, 'Enter a valid date.');
    return v;
}
const formatMoney = v => new Intl.NumberFormat('en-CM').format(BigInt(v)) + ' XAF';
const METHODS = ['cash', 'bank', 'mobile', 'other'];
const METHOD_LABELS = { cash: 'Cash', bank: 'Bank transfer', mobile: 'Mobile money', other: 'Other' };
const methodLabel = m => METHOD_LABELS[m] || m;
const FEE_COLUMNS = [['registration_fee', 'Registration fee'], ['tuition_fee', 'Tuition'], ['pta_fee', 'PTA levy'], ['caution_fee', 'Caution fee'], ['practicals_fee', 'Practicals fee']];

// Display name of whoever recorded an entry, from the right staff table.
const actorName = alias => `COALESCE(${alias}_ad.name, ${alias}_te.name, ${alias}_ax.name, 'Former staff member')`;
const actorJoins = (alias, table) => `
 LEFT JOIN dbo.Admins ${alias}_ad ON ${table}.actor_type='admin' AND ${alias}_ad.id=${table}.actor_id
 LEFT JOIN dbo.teachers ${alias}_te ON ${table}.actor_type='teacher' AND ${alias}_te.id=${table}.actor_id
 LEFT JOIN dbo.auxiliary_staff ${alias}_ax ON ${table}.actor_type='auxiliary' AND ${alias}_ax.id=${table}.actor_id`;

const chargesSql = `SELECT c.id,c.student_id,c.year_id,c.description,CONVERT(varchar(30),c.amount) amount,c.currency,
 CONVERT(char(10),c.due_date,23) dueDate,p.firstName+' '+p.lastName student,p.matricule,y.name year,
 CONVERT(varchar(30),COALESCE(paid.total,0)) paid,CONVERT(varchar(30),c.amount-COALESCE(paid.total,0)) balance,
 x.reason cancelled,c.created_at createdAt
 FROM dbo.finance_charges c JOIN dbo.students p ON p.school_id=c.school_id AND p.id=c.student_id
 JOIN dbo.academic_years y ON y.school_id=c.school_id AND y.id=c.year_id
 LEFT JOIN dbo.finance_cancellations x ON x.school_id=c.school_id AND x.charge_id=c.id
 OUTER APPLY(SELECT SUM(CONVERT(decimal(38,0),f.amount)) total FROM dbo.finance_payments f
 WHERE f.school_id=c.school_id AND f.charge_id=c.id AND NOT EXISTS(SELECT 1 FROM dbo.finance_reversals r WHERE r.school_id=f.school_id AND r.payment_id=f.id)) paid
 WHERE c.school_id=@school`;
const paymentsSql = `SELECT f.id,f.charge_id,CONVERT(varchar(30),f.amount) amount,CONVERT(char(10),f.paid_on,23) paidOn,
 f.method,f.reference,f.created_at recordedAt,r.reason reversed,${actorName('rec')} recordedBy
 FROM dbo.finance_payments f LEFT JOIN dbo.finance_reversals r ON r.school_id=f.school_id AND r.payment_id=f.id
 ${actorJoins('rec', 'f')}
 WHERE f.school_id=@school`;

async function defaultTransaction() {
    await poolConnect;
    const tx = pool.transaction();
    return { begin: level => tx.begin(level), commit: () => tx.commit(), rollback: () => tx.rollback(), request: () => new sql.Request(tx) };
}

function createFinanceService({ beginTransaction = defaultTransaction } = {}) {
    const bulkReviews = new Map();

    // The bursar is in charge of fee collection: administrators and bursars may view, take payments ('pay') and
    // manage fees ('manage': charge students or a class, cancel a charge, reverse a mistaken payment).
    // Every entry records who made it, and corrections always need a reason and keep the original history.
    function authorize(actor, permission) {
        if (!actor || !Number.isSafeInteger(actor.id)) throw fail(401, 'Authentication required');
        if (!Number.isSafeInteger(actor.schoolId)) throw fail(409, 'This account is not linked to a school. Ask your administrator to run school setup.');
        const admin = actor.type === 'admin';
        const bursar = Array.isArray(actor.duties) && actor.duties.includes('bursar');
        if (!['view', 'pay', 'manage'].includes(permission) || !(admin || bursar)) throw fail(403, 'Your account does not have this finance permission');
        return { ...actor, admin, canManage: admin || bursar };
    }

    async function scoped(actor, permission, work) {
        const who = authorize(actor, permission);
        const tx = await beginTransaction();
        // Keep balances and their payment history consistent, including concurrent inserts.
        await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const query = (statement, params = {}) => {
            const r = tx.request().input('school', sql.Int, who.schoolId)
                .input('actor_type', sql.NVarChar(20), who.type).input('actor', sql.Int, who.id);
            for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value);
            return r.query(statement);
        };
        try {
            const result = await work(query, who);
            await tx.commit();
            return result;
        } catch (error) {
            await tx.rollback().catch(() => {});
            if ([2601, 2627, 1205].includes(error.number)) throw fail(409, 'This entry changed or was already saved. Reopen it before retrying.');
            throw error;
        }
    }

    async function list(actor, search = '') {
        search = text(search, 120, true);
        return scoped(actor, 'view', async (query, who) => {
            const sets = (await query(chargesSql + ` AND (@search='' OR CHARINDEX(@search,CONCAT(p.firstName,' ',p.lastName,' ',p.matricule,' ',y.name,' ',c.description))>0) ORDER BY c.id DESC;
    SELECT id,firstName+' '+lastName+' · '+matricule label,currentClassLevel classId FROM dbo.students WHERE school_id=@school AND isWithdrawn=0 ORDER BY lastName,firstName;
    SELECT id,name label,isCurrent FROM dbo.academic_years WHERE school_id=@school ORDER BY fromYear DESC;
    SELECT id,section,name,stream,${FEE_COLUMNS.map(([c]) => `CONVERT(varchar(30),CONVERT(bigint,ROUND(${c},0))) ${c}`).join(',')}
      FROM dbo.classes WHERE school_id=@school ORDER BY section,rank,name;`, { search: [sql.NVarChar(120), search] })).recordsets;
            const totals = { charged: 0n, paid: 0n, balance: 0n };
            for (const c of sets[0]) if (!c.cancelled) { totals.charged += BigInt(c.amount); totals.paid += BigInt(c.paid); totals.balance += BigInt(c.balance); }
            const classes = sets[3].map(c => ({
                id: c.id, label: c.section + ' — ' + c.name + (c.stream ? ' (' + c.stream + ')' : ''),
                fees: FEE_COLUMNS.map(([col, label]) => ({ key: col, label, amount: c[col] })).filter(f => f.amount && f.amount !== '0'),
            }));
            return { charges: sets[0], students: sets[1], years: sets[2], classes, totals, canManage: who.canManage };
        });
    }

    async function detail(actor, chargeId) {
        return scoped(actor, 'view', async (query, who) => {
            const params = { charge: [sql.Int, id(chargeId)] };
            const charge = (await query(chargesSql + ' AND c.id=@charge', params)).recordset[0];
            if (!charge) throw fail(404, 'Charge not found.');
            return { charge, payments: (await query(paymentsSql + ' AND f.charge_id=@charge ORDER BY f.id DESC', params)).recordset, canManage: who.canManage };
        });
    }

    async function receipt(actor, paymentId) {
        return scoped(actor, 'view', async query => {
            const payment = (await query(paymentsSql + ' AND f.id=@payment', { payment: [sql.Int, id(paymentId)] })).recordset[0];
            if (!payment) throw fail(404, 'Receipt not found.');
            const charge = (await query(chargesSql + ' AND c.id=@charge', { charge: [sql.Int, payment.charge_id] })).recordset[0];
            const school = (await query('SELECT id,name FROM dbo.schools WHERE id=@school')).recordset[0];
            return { payment, charge, school, receiptNumber: 'PAY-' + school.id + '-' + payment.id };
        });
    }

    async function collections(actor, filters = {}) {
        const from = date(filters.from), to = date(filters.to), method = filters.method ?? '';
        const operator = filters.operator ? String(filters.operator) : '';
        if (from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 365) throw fail(422, 'Choose an inclusive date range of up to 366 days.');
        if (!['', ...METHODS].includes(method)) throw fail(422, 'Choose a payment method.');
        if (operator && !/^(admin|teacher|auxiliary):[1-9]\d{0,9}$/.test(operator)) throw fail(422, 'Choose a cashier.');
        const [opType, opId] = operator ? operator.split(':') : [null, null];
        return scoped(actor, 'view', async query => {
            const operators = (await query(`SELECT DISTINCT f.actor_type+':'+CONVERT(varchar(12),f.actor_id) id,${actorName('op')} label
    FROM dbo.finance_payments f ${actorJoins('op', 'f')} WHERE f.school_id=@school ORDER BY label`)).recordset;
            if (operator && !operators.some(o => o.id === operator)) throw fail(404, 'Payment operator not found in this school.');
            const rows = (await query(`SELECT TOP(5001) f.id,f.actor_type+':'+CONVERT(varchar(12),f.actor_id) operatorId,CONVERT(varchar(30),f.amount) amount,
    CONVERT(char(10),f.paid_on,23) paidOn,f.method,f.reference,f.created_at recordedAt,
    p.firstName+' '+p.lastName student,p.matricule,y.name year,c.description,${actorName('rec')} recordedBy,
    r.reason reversed,r.created_at reversedAt
    FROM dbo.finance_payments f JOIN dbo.finance_charges c ON c.school_id=f.school_id AND c.id=f.charge_id
    JOIN dbo.students p ON p.school_id=c.school_id AND p.id=c.student_id
    JOIN dbo.academic_years y ON y.school_id=c.school_id AND y.id=c.year_id
    ${actorJoins('rec', 'f')}
    LEFT JOIN dbo.finance_reversals r ON r.school_id=f.school_id AND r.payment_id=f.id
    WHERE f.school_id=@school AND f.paid_on BETWEEN @from AND @to
      AND (@method='' OR f.method=@method) AND (@opType IS NULL OR (f.actor_type=@opType AND f.actor_id=@opId))
    ORDER BY f.paid_on,f.id`, { from: [sql.Date, from], to: [sql.Date, to], method: [sql.VarChar(12), method], opType: [sql.NVarChar(20), opType], opId: [sql.Int, opId ? Number(opId) : null] })).recordset;
            if (rows.length > 5000) throw fail(422, 'This report exceeds 5,000 payments. Narrow the dates, method or cashier. No partial totals were returned.');
            const school = (await query('SELECT id,name FROM dbo.schools WHERE id=@school')).recordset[0];
            const empty = () => ({ count: 0, recorded: 0n, reversed: 0n, net: 0n });
            const totals = empty(), methods = new Map(), cashiers = new Map();
            for (const row of rows) {
                row.receiptNumber = 'PAY-' + school.id + '-' + row.id;
                if (!methods.has(row.method)) methods.set(row.method, { label: methodLabel(row.method), ...empty() });
                if (!cashiers.has(row.operatorId)) cashiers.set(row.operatorId, { label: row.recordedBy, ...empty() });
                for (const group of [totals, methods.get(row.method), cashiers.get(row.operatorId)]) {
                    group.count++; group.recorded += BigInt(row.amount); group.reversed += row.reversed ? BigInt(row.amount) : 0n; group.net += row.reversed ? 0n : BigInt(row.amount);
                }
            }
            return { from, to, method, operator, operators, rows, school, totals, methods: [...methods.values()], cashiers: [...cashiers.values()], generatedAt: new Date() };
        });
    }

    async function studentStatement(actor, options = {}) {
        const studentId = options.student ? id(options.student) : null, yearId = options.year ? id(options.year) : null, search = text(options.search ?? '', 120, true);
        return scoped(actor, 'view', async query => {
            const school = (await query('SELECT id,name FROM dbo.schools WHERE id=@school')).recordset[0];
            const years = (await query('SELECT id,name FROM dbo.academic_years WHERE school_id=@school ORDER BY fromYear DESC')).recordset;
            if (yearId && !years.some(y => y.id === yearId)) throw fail(404, 'Academic year not found in this school.');
            if (!studentId) {
                const students = (await query(`SELECT TOP(201) id,firstName+' '+lastName name,matricule,isWithdrawn FROM dbo.students
     WHERE school_id=@school AND (@search='' OR CHARINDEX(@search,CONCAT(firstName,' ',lastName,' ',matricule))>0)
     ORDER BY lastName,firstName,id`, { search: [sql.NVarChar(120), search] })).recordset;
                return { school, years, yearId, search, students: students.slice(0, 200), moreStudents: students.length > 200, student: null };
            }
            const params = { student: [sql.Int, studentId], year: [sql.Int, yearId] };
            const student = (await query("SELECT id,firstName+' '+lastName name,matricule,isWithdrawn FROM dbo.students WHERE school_id=@school AND id=@student", params)).recordset[0];
            if (!student) throw fail(404, 'Student not found in this school.');
            const charges = (await query('SELECT TOP(501) * FROM (' + chargesSql + ' AND c.student_id=@student AND (@year IS NULL OR c.year_id=@year)) selectedCharges ORDER BY id', params)).recordset;
            const payments = (await query('SELECT TOP(5001) * FROM (' + paymentsSql + ` AND EXISTS(SELECT 1 FROM dbo.finance_charges c
    WHERE c.school_id=f.school_id AND c.id=f.charge_id AND c.student_id=@student AND (@year IS NULL OR c.year_id=@year))) selectedPayments ORDER BY paidOn,id`, params)).recordset;
            if (charges.length > 500 || payments.length > 5000) throw fail(422, 'This statement is too large. Select a narrower academic year. No partial totals were returned.');
            const asOf = today(), totals = { charged: 0n, paid: 0n, balance: 0n, overdue: 0n };
            for (const c of charges) if (!c.cancelled) {
                totals.charged += BigInt(c.amount); totals.paid += BigInt(c.paid); totals.balance += BigInt(c.balance);
                if (c.dueDate && c.dueDate < asOf) totals.overdue += BigInt(c.balance);
            }
            for (const p of payments) p.receiptNumber = 'PAY-' + school.id + '-' + p.id;
            return { school, years, yearId, search, student, charges, payments, totals, asOf, generatedAt: new Date() };
        });
    }

    async function bulkFacts(query, definition) {
        const params = { year: [sql.Int, definition.year], description: [sql.NVarChar(120), definition.description] };
        definition.students.forEach((p, i) => { params['sel' + i] = [sql.Int, p]; });
        const year = (await query('SELECT id,name,fromYear,toYear FROM dbo.academic_years WHERE school_id=@school AND id=@year', params)).recordset[0];
        if (!year) throw fail(404, 'Academic year not found in this school.');
        const students = (await query(`SELECT p.id,p.firstName,p.lastName,p.matricule,
    (SELECT COUNT(*) FROM dbo.finance_charges c WHERE c.school_id=p.school_id AND c.student_id=p.id AND c.year_id=@year AND c.description=@description
      AND NOT EXISTS(SELECT 1 FROM dbo.finance_cancellations x WHERE x.school_id=c.school_id AND x.charge_id=c.id)) existing
    FROM dbo.students p WHERE p.school_id=@school AND p.isWithdrawn=0 AND p.id IN (${definition.students.map((_, i) => '@sel' + i).join(',')}) ORDER BY p.id`, params)).recordset;
        if (students.length !== definition.students.length) throw fail(409, 'A selected student is unavailable in this school. Review the selection again.');
        if (students.some(p => p.existing > 0)) throw fail(409, 'A selected student already has an active charge with this fee description for this year. Review existing charges; use a distinct description for a different instalment.');
        return { year, students };
    }

    async function reviewBulk(actor, b) {
        const selected = Array.isArray(b.students) ? b.students : b.students ? [b.students] : [];
        if (!selected.length || selected.length > 200) throw fail(422, 'Select between 1 and 200 students.');
        const students = selected.map(id).sort((x, y) => x - y);
        if (new Set(students).size !== students.length) throw fail(422, 'Each student must appear only once.');
        const definition = { students, year: id(b.year), description: text(b.description, 120), amount: amount(b.amount), due: b.due ? date(b.due) : null };
        const review = await scoped(actor, 'manage', async (query, who) => ({
            ...await bulkFacts(query, definition), definition, scope: who.type + ':' + who.id, schoolId: who.schoolId,
            token: crypto.randomBytes(32).toString('hex'), expires: Date.now() + 15 * 60 * 1000, operations: students.map(() => crypto.randomUUID()),
        }));
        for (const [key, old] of bulkReviews) if (old.expires < Date.now()) bulkReviews.delete(key);
        if (bulkReviews.size >= 256 && !bulkReviews.has(review.scope)) throw fail(409, 'Too many pending reviews. Try again after existing reviews expire.');
        bulkReviews.set(review.scope, review);
        return structuredClone({
            token: review.token, year: review.year, students: review.students, description: definition.description,
            amount: definition.amount, due: definition.due, total: (BigInt(definition.amount) * BigInt(students.length)).toString(),
        });
    }

    async function confirmBulk(actor, token) {
        let completedScope;
        const result = await scoped(actor, 'manage', async (query, who) => {
            const scope = who.type + ':' + who.id;
            const review = bulkReviews.get(scope);
            if (typeof token !== 'string' || !review || review.token !== token || review.expires < Date.now() || review.schoolId !== who.schoolId)
                throw fail(409, 'This review expired, was replaced or was already saved. Prepare a new review.');
            const facts = await bulkFacts(query, review.definition);
            if (JSON.stringify(facts) !== JSON.stringify({ year: review.year, students: review.students })) throw fail(409, 'Student or year details changed. Prepare a new review before saving.');
            const charges = [];
            for (const [index, student] of review.students.entries()) {
                const charge = (await query(`INSERT dbo.finance_charges(school_id,student_id,year_id,description,amount,currency,due_date,actor_type,actor_id,operation_id)
      OUTPUT inserted.id VALUES(@school,@student,@year,@description,@amount,'XAF',@due,@actor_type,@actor,@operation)`, {
                    student: [sql.Int, student.id], year: [sql.Int, review.definition.year], description: [sql.NVarChar(120), review.definition.description], amount: [sql.BigInt, review.definition.amount],
                    due: [sql.Date, review.definition.due], operation: [sql.UniqueIdentifier, review.operations[index]],
                })).recordset[0];
                charges.push({ id: charge.id, student: student.firstName + ' ' + student.lastName, matricule: student.matricule });
            }
            completedScope = scope;
            return { charges, description: review.definition.description, year: review.year.name, total: (BigInt(review.definition.amount) * BigInt(charges.length)).toString() };
        });
        if (bulkReviews.get(completedScope)?.token === token) bulkReviews.delete(completedScope);
        return result;
    }

    async function save(actor, b) {
        const actions = ['charge', 'pay', 'reverse', 'cancel']; if (!actions.includes(b.action)) throw fail(422, 'Choose a finance action.');
        return scoped(actor, b.action === 'pay' ? 'pay' : 'manage', async query => {
            if (['charge', 'pay'].includes(b.action) && !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(b.operation || '')) throw fail(422, 'Reopen the form before saving.');
            if (b.action === 'charge') {
                const params = {
                    student: [sql.Int, id(b.student)], year: [sql.Int, id(b.year)], description: [sql.NVarChar(120), text(b.description, 120)],
                    amount: [sql.BigInt, amount(b.amount)], due: [sql.Date, b.due ? date(b.due) : null], op: [sql.UniqueIdentifier, b.operation],
                };
                const valid = (await query(`SELECT 1 ok FROM dbo.students p JOIN dbo.academic_years y ON y.school_id=p.school_id
     WHERE p.school_id=@school AND p.id=@student AND p.isWithdrawn=0 AND y.id=@year`, params)).recordset.length;
                if (!valid) throw fail(404, 'Student or academic year not found.');
                return (await query(`INSERT dbo.finance_charges(school_id,student_id,year_id,description,amount,currency,due_date,actor_type,actor_id,operation_id)
     OUTPUT inserted.id VALUES(@school,@student,@year,@description,@amount,'XAF',@due,@actor_type,@actor,@op)`, params)).recordset[0];
            }
            const chargeId = id(b.charge), params = { charge: [sql.Int, chargeId] };
            // A single charge lock serializes payment, reversal and cancellation decisions.
            if (!(await query('SELECT id FROM dbo.finance_charges WITH(UPDLOCK,HOLDLOCK) WHERE school_id=@school AND id=@charge', params)).recordset.length) throw fail(404, 'Charge not found.');
            const charge = (await query(chargesSql + ' AND c.id=@charge', params)).recordset[0];
            if (charge.cancelled) throw fail(409, 'This charge has been cancelled.');
            if (b.action === 'pay') {
                const value = amount(b.amount), paidOn = date(b.paidOn);
                if (paidOn > today()) throw fail(422, 'Payment dates cannot be in the future.');
                if (BigInt(value) > BigInt(charge.balance)) throw fail(409, 'The payment exceeds the outstanding balance.');
                if (!METHODS.includes(b.method)) throw fail(422, 'Choose a payment method.');
                const reference = text(b.reference || '', 100, true);
                if (b.method !== 'cash' && !reference) throw fail(422, 'Enter a transaction reference for this payment method.');
                const payment = (await query(`INSERT dbo.finance_payments(school_id,charge_id,amount,paid_on,method,reference,actor_type,actor_id,operation_id)
     OUTPUT inserted.id VALUES(@school,@charge,@amount,@paid,@method,@reference,@actor_type,@actor,@op)`, {
                    ...params, amount: [sql.BigInt, value], paid: [sql.Date, paidOn],
                    method: [sql.VarChar(12), b.method], reference: [sql.NVarChar(100), reference], op: [sql.UniqueIdentifier, b.operation],
                })).recordset[0];
                return { id: chargeId, paymentId: payment.id };
            }
            const reason = [sql.NVarChar(300), text(b.reason, 300)];
            if (b.action === 'reverse') {
                const payment = [sql.Int, id(b.payment)];
                if (!(await query('SELECT id FROM dbo.finance_payments WHERE school_id=@school AND charge_id=@charge AND id=@payment', { ...params, payment })).recordset.length) throw fail(404, 'Payment not found.');
                await query('INSERT dbo.finance_reversals(school_id,payment_id,reason,actor_type,actor_id) VALUES(@school,@payment,@reason,@actor_type,@actor)', { payment, reason });
            } else {
                if (BigInt(charge.paid) !== 0n) throw fail(409, 'Reverse recorded payments before cancelling this charge.');
                await query('INSERT dbo.finance_cancellations(school_id,charge_id,reason,actor_type,actor_id) VALUES(@school,@charge,@reason,@actor_type,@actor)', { ...params, reason });
            }
            return { id: chargeId };
        });
    }

    // Totals across all years for one student (registration form summary).
    async function studentBalance(actor, studentId) {
        const sid = id(studentId);
        return scoped(actor, 'view', async query => {
            const charges = (await query(chargesSql + ' AND c.student_id=@student', { student: [sql.Int, sid] })).recordset;
            const asOf = today(), totals = { charged: 0n, paid: 0n, balance: 0n, overdue: 0n };
            for (const c of charges) if (!c.cancelled) {
                totals.charged += BigInt(c.amount); totals.paid += BigInt(c.paid); totals.balance += BigInt(c.balance);
                if (c.dueDate && c.dueDate < asOf) totals.overdue += BigInt(c.balance);
            }
            return { studentId: sid, charges: charges.filter(c => !c.cancelled).length,
                charged: formatMoney(totals.charged), paid: formatMoney(totals.paid), balance: formatMoney(totals.balance), overdue: formatMoney(totals.overdue) };
        });
    }

    // Outstanding balances for one academic year: the whole school class by class, or one class student by student.
    // Balances count active charges minus payments that were not reversed; cancelled charges are left out.
    async function outstanding(actor, options = {}) {
        const classId = options.class ? id(options.class) : null;
        const requestedYear = options.year ? id(options.year) : null;
        const show = ['owing', 'overdue', 'all'].includes(options.show) ? options.show : 'owing';
        return scoped(actor, 'view', async query => {
            const school = (await query('SELECT id,name FROM dbo.schools WHERE id=@school')).recordset[0];
            const years = (await query('SELECT id,name,isCurrent FROM dbo.academic_years WHERE school_id=@school ORDER BY fromYear DESC')).recordset;
            if (requestedYear && !years.some(y => y.id === requestedYear)) throw fail(404, 'Academic year not found in this school.');
            const yearId = requestedYear ?? years.find(y => y.isCurrent)?.id ?? years[0]?.id ?? null;
            const classes = (await query(`SELECT id,section,name,stream FROM dbo.classes WHERE school_id=@school ORDER BY section,rank,name`)).recordset
                .map(c => ({ id: c.id, section: c.section, label: c.section + ' — ' + c.name + (c.stream && c.stream !== 'Normal' ? ' (' + c.stream + ')' : '') }));
            if (classId && !classes.some(c => c.id === classId)) throw fail(404, 'Class not found in this school.');
            const asOf = today();
            if (!yearId) return { school, years, yearId, classes, classId, show, asOf, summary: [], totals: emptyTotals(), students: [], generatedAt: new Date() };

            const rows = (await query(`
                WITH ch AS (
                    SELECT c.student_id, CONVERT(decimal(38,0), c.amount) amount, c.due_date, COALESCE(p.total, 0) paid
                    FROM dbo.finance_charges c
                    LEFT JOIN dbo.finance_cancellations x ON x.school_id = c.school_id AND x.charge_id = c.id
                    OUTER APPLY (SELECT SUM(CONVERT(decimal(38,0), f.amount)) total FROM dbo.finance_payments f
                        WHERE f.school_id = c.school_id AND f.charge_id = c.id
                          AND NOT EXISTS (SELECT 1 FROM dbo.finance_reversals r WHERE r.school_id = f.school_id AND r.payment_id = f.id)) p
                    WHERE c.school_id = @school AND c.year_id = @year AND x.charge_id IS NULL)
                SELECT s.id, s.firstName + ' ' + s.lastName name, s.matricule, s.currentClassLevel classId, s.parentName, s.parentPhone,
                       COUNT(ch.student_id) charges,
                       CONVERT(varchar(40), COALESCE(SUM(ch.amount), 0)) charged,
                       CONVERT(varchar(40), COALESCE(SUM(ch.paid), 0)) paid,
                       CONVERT(varchar(40), COALESCE(SUM(ch.amount - ch.paid), 0)) balance,
                       CONVERT(varchar(40), COALESCE(SUM(CASE WHEN ch.due_date < @asOf THEN ch.amount - ch.paid ELSE 0 END), 0)) overdue,
                       (SELECT CONVERT(char(10), MAX(f.paid_on), 23) FROM dbo.finance_payments f
                          JOIN dbo.finance_charges c2 ON c2.school_id = f.school_id AND c2.id = f.charge_id
                         WHERE f.school_id = @school AND c2.student_id = s.id AND c2.year_id = @year
                           AND NOT EXISTS (SELECT 1 FROM dbo.finance_reversals r WHERE r.school_id = f.school_id AND r.payment_id = f.id)) lastPaid
                FROM dbo.students s
                LEFT JOIN ch ON ch.student_id = s.id
                WHERE s.school_id = @school AND s.isWithdrawn = 0 AND (s.academicYearId IS NULL OR s.academicYearId = @year)
                GROUP BY s.id, s.firstName, s.lastName, s.matricule, s.currentClassLevel, s.parentName, s.parentPhone`,
            { year: [sql.Int, yearId], asOf: [sql.Date, asOf] })).recordset;

            const status = r => (!r.charges ? 'none' : BigInt(r.balance) <= 0n ? 'paid' : BigInt(r.paid) === 0n ? 'unpaid' : 'partial');
            for (const r of rows) r.status = status(r);
            const COUNT = { paid: 'fullyPaid', partial: 'partlyPaid', unpaid: 'notPaid', none: 'noCharges' };
            const tally = list => list.reduce((t, r) => {
                t.students += 1; t[COUNT[r.status]] += 1;
                t.charged += BigInt(r.charged); t.collected += BigInt(r.paid); t.balance += BigInt(r.balance); t.overdue += BigInt(r.overdue);
                return t;
            }, emptyTotals());
            const summary = classes.map(c => ({ ...c, ...tally(rows.filter(r => r.classId === c.id)) })).filter(c => c.students);
            const students = !classId ? [] : rows.filter(r => r.classId === classId)
                .filter(r => show === 'all' || (show === 'overdue' ? BigInt(r.overdue) > 0n : BigInt(r.balance) > 0n))
                .sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : BigInt(b.balance) < BigInt(a.balance) ? -1 : a.name.localeCompare(b.name)));
            const totals = tally(classId ? rows.filter(r => r.classId === classId) : rows);
            return { school, years, yearId, classes, classId, show, asOf, summary, totals, students, generatedAt: new Date() };
        });
    }
    // Counts of students by payment status, and money totals (BigInt XAF).
    function emptyTotals() { return { students: 0, fullyPaid: 0, partlyPaid: 0, notPaid: 0, noCharges: 0, charged: 0n, collected: 0n, balance: 0n, overdue: 0n }; }

    return { list, detail, receipt, collections, studentStatement, studentBalance, reviewBulk, confirmBulk, save, outstanding };
}

module.exports = { createFinanceService, formatMoney, today, FEE_COLUMNS, methodLabel };
