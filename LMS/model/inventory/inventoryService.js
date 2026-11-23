// Library and laboratory for the single application. Ported from model/identity/inventoryService.js:
// validation, state machines and locking are unchanged; people come from req.actor.
const { sql, pool, poolConnect } = require('../../config/database');
const { getFeatureFlag } = require('../../config/environment');

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const addDays = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
function text(value, max, optional = false) {
    if (typeof value !== 'string' || (!optional && !value.trim()) || value.length > max) throw fail(422, 'Check the text fields and their lengths.');
    return value.trim();
}
function number(value) {
    if (!/^\d{1,9}(\.\d{1,3})?$/.test(String(value))) throw fail(422, 'Enter a non-negative quantity with up to three decimal places.');
    return Number(value);
}
function id(value) {
    if (!/^[1-9]\d{0,9}$/.test(String(value)) || Number(value) > 2147483647) throw fail(422, 'Choose a record.');
    return Number(value);
}
function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value) throw fail(422, 'Enter a valid date.');
    return value;
}
function choice(value, allowed) {
    if (!allowed.includes(value)) throw fail(422, 'Choose one of the available options.');
    return value;
}

// Subject laboratories with practicals, plus a shared general laboratory.
const LAB_SUBJECTS = ['Physics', 'Chemistry', 'Biology', 'Geology', 'General lab'];
const HAZARDS = ['none', 'flammable', 'corrosive', 'toxic', 'oxidising', 'irritant', 'environmental', 'biohazard'];

const AREAS = {
    library: { duty: 'librarian', title: 'Library' },
    laboratory: { duty: 'lab_attendant', title: 'Laboratory' },
    requests: { teacher: true, title: 'Laboratory requests' },
};
const STAFF_TYPES = ['admin', 'teacher', 'auxiliary'];
const personName = (alias, typeCol, idCol) => `COALESCE(${alias}_ad.name, ${alias}_te.name, ${alias}_ax.name)`;
const personJoins = (alias, typeCol, idCol) => `
 LEFT JOIN dbo.Admins ${alias}_ad ON ${typeCol}='admin' AND ${alias}_ad.id=${idCol}
 LEFT JOIN dbo.teachers ${alias}_te ON ${typeCol}='teacher' AND ${alias}_te.id=${idCol}
 LEFT JOIN dbo.auxiliary_staff ${alias}_ax ON ${typeCol}='auxiliary' AND ${alias}_ax.id=${idCol}`;

async function defaultTransaction() {
    await poolConnect;
    const tx = pool.transaction();
    return { begin: level => tx.begin(level), commit: () => tx.commit(), rollback: () => tx.rollback(), request: () => new sql.Request(tx) };
}

function createInventoryService({ beginTransaction = defaultTransaction, clock = today, loanLimit = () => Number(getFeatureFlag('library.studentLoanLimit', 3)) } = {}) {
    function allowed(actor, area) {
        const spec = AREAS[area];
        if (!spec) throw fail(404, 'Area not found.');
        if (!actor || !Number.isSafeInteger(actor.id)) throw fail(401, 'Authentication required');
        if (!Number.isSafeInteger(actor.schoolId)) throw fail(409, 'This account is not linked to a school. Ask your administrator to run school setup.');
        const ok = spec.teacher ? actor.type === 'teacher' : actor.type === 'admin' || (actor.duties || []).includes(spec.duty);
        if (!ok) throw fail(403, spec.teacher ? 'Laboratory requests are made by teachers.' : `${spec.title} is open to administrators and staff with the ${spec.duty.replace('_', ' ')} duty.`);
    }

    async function scoped(actor, area, work, operation) {
        allowed(actor, area);
        const tx = await beginTransaction();
        await tx.begin(operation ? sql.ISOLATION_LEVEL.SERIALIZABLE : sql.ISOLATION_LEVEL.REPEATABLE_READ);
        const query = (statement, params = {}) => {
            const r = tx.request().input('school', sql.Int, actor.schoolId)
                .input('actor_type', sql.NVarChar(20), actor.type).input('actor', sql.Int, actor.id);
            for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value);
            return r.query(statement);
        };
        try {
            if (operation) {
                if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(operation)) throw fail(422, 'Reopen the form before saving.');
                await query('INSERT dbo.inventory_operations(school_id,actor_type,actor_id,operation_id) VALUES(@school,@actor_type,@actor,@op)', { op: [sql.UniqueIdentifier, operation] });
            }
            const result = await work(query);
            await tx.commit();
            return result;
        } catch (error) {
            await tx.rollback().catch(() => {});
            if ([2601, 2627, 1205].includes(error.number)) throw fail(409, 'This record changed or already exists. Reopen it to check its status.');
            throw error;
        }
    }

    const latestEvent = `OUTER APPLY(SELECT TOP(1) * FROM dbo.library_events x WHERE x.school_id=c.school_id AND x.copy_id=c.id ORDER BY x.id DESC) e`;
    const ACTIVE_STUDENT_LOANS = `SELECT COUNT(*) n FROM dbo.library_copies c ${latestEvent}
        WHERE c.school_id=@school AND e.action IN ('checkout','renew') AND e.pupil_id=@student`;

    async function listLibrary(actor, filters = {}) {
        const search = text(filters.search ?? '', 120, true);
        const status = filters.status ?? '';
        if (!['', 'available', 'loan', 'overdue', 'review'].includes(status)) throw fail(422, 'Choose a status filter.');
        const classId = filters.classId ? id(filters.classId) : null;
        const now = clock();
        return scoped(actor, 'library', async query => {
            const sets = (await query(`
              SELECT TOP(301) c.id,c.accession,c.title,c.author,c.shelf,c.isbn,COALESCE(e.id,0) version,e.action,
                CONVERT(char(10),e.due_date,23) due,e.pupil_id studentId,
                COALESCE(p.firstName+' '+p.lastName+' · '+p.matricule, ${personName('b')}) borrower,
                cl.section+' — '+cl.name borrowerClass
              FROM dbo.library_copies c ${latestEvent}
              LEFT JOIN dbo.students p ON p.school_id=c.school_id AND p.id=e.pupil_id
              LEFT JOIN dbo.classes cl ON cl.id=p.currentClassLevel
              ${personJoins('b', 'e.staff_type', 'e.staff_id')}
              WHERE c.school_id=@school
                AND (@search='' OR CHARINDEX(@search,CONCAT(c.title,' ',c.author,' ',c.accession,' ',c.isbn,' ',c.shelf,' ',p.firstName,' ',p.lastName,' ',p.matricule))>0)
                AND (@status='' OR (@status='available' AND (e.action IS NULL OR e.action IN ('return','repair')))
                     OR (@status='loan' AND e.action IN ('checkout','renew'))
                     OR (@status='overdue' AND e.action IN ('checkout','renew') AND e.due_date<@today)
                     OR (@status='review' AND e.action IN ('lost','damaged')))
                AND (@class IS NULL OR p.currentClassLevel=@class)
              ORDER BY CASE WHEN e.action IN ('checkout','renew') AND e.due_date<@today THEN 0 ELSE 1 END, c.title, c.accession;
              SELECT COUNT(*) total,
                SUM(CASE WHEN e.action IN ('checkout','renew') THEN 1 ELSE 0 END) onLoan,
                SUM(CASE WHEN e.action IN ('checkout','renew') AND e.due_date<@today THEN 1 ELSE 0 END) overdue,
                SUM(CASE WHEN e.action IN ('lost','damaged') THEN 1 ELSE 0 END) review
              FROM dbo.library_copies c ${latestEvent} WHERE c.school_id=@school;
              SELECT id,firstName+' '+lastName+' · '+matricule label FROM dbo.students WHERE school_id=@school AND isWithdrawn=0 ORDER BY lastName,firstName;
              SELECT 'teacher:'+CONVERT(varchar(12),id) id,name+' (teacher)' label FROM dbo.teachers WHERE school_id=@school AND status='active'
              UNION ALL SELECT 'auxiliary:'+CONVERT(varchar(12),id),name+' ('+role+')' FROM dbo.auxiliary_staff WHERE school_id=@school AND status='active'
              UNION ALL SELECT 'admin:'+CONVERT(varchar(12),id),name+' (administrator)' FROM dbo.Admins WHERE school_id=@school AND LOWER(LTRIM(RTRIM(role)))='admin'
              ORDER BY label;
              SELECT id,section+' — '+name+COALESCE(' ('+stream+')','') label FROM dbo.classes WHERE school_id=@school ORDER BY section,rank,name;
              SELECT TOP(30) c.accession,c.title,e.action,e.occurred_at occurredAt,${personName('ed')} editor
              FROM dbo.library_events e JOIN dbo.library_copies c ON c.school_id=e.school_id AND c.id=e.copy_id
              ${personJoins('ed', 'e.actor_type', 'e.actor_id')}
              WHERE e.school_id=@school ORDER BY e.id DESC;`,
            { search: [sql.NVarChar(120), search], status: [sql.VarChar(10), status], class: [sql.Int, classId], today: [sql.Date, now] })).recordsets;
            const totals = sets[1][0] || {};
            return {
                copies: sets[0].slice(0, 300), moreCopies: sets[0].length > 300,
                totals: { total: totals.total || 0, onLoan: totals.onLoan || 0, overdue: totals.overdue || 0, review: totals.review || 0 },
                students: sets[2], staff: sets[3], classes: sets[4], history: sets[5],
                search, status, classId, loanLimit: loanLimit(), today: now,
            };
        });
    }

    async function listLab(actor, area, filters = {}) {
        const teacher = area === 'requests';
        const now = clock();
        const subject = filters.subject ? choice(filters.subject, LAB_SUBJECTS) : '';
        return scoped(actor, area, async query => {
            const sets = (await query(`SELECT i.id,i.name,i.category subject,i.kind,i.unit,i.location,i.batch,i.hazard,CONVERT(varchar(30),i.minimum) minimum,
                CONVERT(char(10),i.expiry,23) expiryDate,i.restricted,CONVERT(varchar(30),COALESCE(b.balance,0)) available,
                CONVERT(varchar(30),COALESCE(o.out_qty,0)) onLoan
              FROM dbo.lab_items i
              OUTER APPLY(SELECT SUM(delta) balance FROM dbo.lab_movements m WHERE m.school_id=i.school_id AND m.item_id=i.id) b
              OUTER APPLY(SELECT SUM(r.quantity-COALESCE(r.returned_qty,0)-COALESCE(r.damaged_qty,0)-COALESCE(r.missing_qty,0)) out_qty
                FROM dbo.lab_requests r WHERE r.school_id=i.school_id AND r.item_id=i.id AND r.status='issued' AND i.kind='equipment') o
              WHERE i.school_id=@school AND (@subject='' OR i.category=@subject)
                ${teacher ? 'AND i.restricted=0 AND (i.expiry IS NULL OR i.expiry>=@today)' : ''}
              ORDER BY i.category, i.name;
              SELECT TOP(300) r.id,r.status,CONVERT(varchar(30),r.quantity) quantity,r.purpose,CONVERT(char(10),r.needed_on,23) needed,
                CONVERT(char(10),r.return_by,23) returnBy,CONVERT(varchar(30),r.returned_qty) returnedQty,CONVERT(varchar(30),r.damaged_qty) damagedQty,
                CONVERT(varchar(30),r.missing_qty) missingQty,r.closed_at closedAt,r.close_note closeNote,
                i.name,i.unit,i.kind,i.category subject,i.hazard,cl.section+' — '+cl.name+COALESCE(' ('+cl.stream+')','') className,${personName('rq')} requester
              FROM dbo.lab_requests r JOIN dbo.lab_items i ON i.school_id=r.school_id AND i.id=r.item_id
              LEFT JOIN dbo.classes cl ON cl.id=r.class_id
              ${personJoins('rq', 'r.requested_by_type', 'r.requested_by_id')}
              WHERE r.school_id=@school AND (@subject='' OR i.category=@subject)
                ${teacher ? 'AND r.requested_by_type=@actor_type AND r.requested_by_id=@actor' : ''}
              ORDER BY CASE WHEN r.status='issued' AND r.return_by<@today THEN 0 WHEN r.status='pending' THEN 1 WHEN r.status='approved' THEN 2 WHEN r.status='issued' THEN 3 ELSE 4 END,
                r.needed_on, r.id DESC;
              SELECT TOP(50) i.name,i.unit,m.action,CONVERT(varchar(30),m.delta) delta,m.request_id requestId,m.note,m.occurred_at occurredAt,${personName('ed')} editor
              FROM dbo.lab_movements m JOIN dbo.lab_items i ON i.school_id=m.school_id AND i.id=m.item_id
              ${personJoins('ed', 'm.actor_type', 'm.actor_id')}
              WHERE m.school_id=@school AND (@subject='' OR i.category=@subject) ${teacher ? 'AND 1=0' : ''} ORDER BY m.id DESC;
              SELECT i.category subject,COUNT(*) requests,
                SUM(CASE WHEN i.kind='equipment' THEN COALESCE(r.damaged_qty,0)+COALESCE(r.missing_qty,0) ELSE 0 END) equipmentLost
              FROM dbo.lab_requests r JOIN dbo.lab_items i ON i.school_id=r.school_id AND i.id=r.item_id
              WHERE r.school_id=@school AND r.status IN ('issued','returned','damaged','consumed') AND r.needed_on>=@since ${teacher ? 'AND 1=0' : ''}
              GROUP BY i.category ORDER BY i.category;
              SELECT DISTINCT c.id,c.section+' — '+c.name+COALESCE(' ('+c.stream+')','') label
              FROM dbo.timetables t JOIN dbo.classes c ON c.id=t.class_id JOIN dbo.academic_years y ON y.id=t.academic_year_id AND y.isCurrent=1
              WHERE t.school_id=@school ${teacher ? 'AND t.teacher_id=@actor' : 'AND 1=0'} ORDER BY label;`,
            { today: [sql.Date, now], since: [sql.Date, addDays(now, -90)], subject: [sql.NVarChar(20), subject] })).recordsets;
            const soon = addDays(now, 30);
            const items = sets[0].map(i => ({
                ...i, low: Number(i.available) <= Number(i.minimum),
                expired: Boolean(i.expiryDate && i.expiryDate < now), expiringSoon: Boolean(i.expiryDate && i.expiryDate >= now && i.expiryDate <= soon),
            }));
            const requests = sets[1].map(r => {
                const accounted = Number(r.returnedQty || 0) + Number(r.damagedQty || 0) + Number(r.missingQty || 0);
                return { ...r, outstanding: Number(r.quantity) - accounted, overdue: r.status === 'issued' && r.kind === 'equipment' && Boolean(r.returnBy) && r.returnBy < now };
            });
            const awaitingReturn = requests.filter(r => r.status === 'issued' && r.kind === 'equipment');
            return {
                items, requests, movements: sets[2], usage: sets[3], classes: sets[4], today: now, subject, subjects: LAB_SUBJECTS, hazards: HAZARDS,
                alerts: {
                    low: items.filter(i => i.low).length, expired: items.filter(i => i.expired).length, expiringSoon: items.filter(i => i.expiringSoon).length,
                    pending: requests.filter(r => r.status === 'pending').length,
                    awaitingReturn: awaitingReturn.length, overdue: awaitingReturn.filter(r => r.overdue).length,
                },
            };
        });
    }

    async function library(query, b, now) {
        if (b.action === 'add') {
            return query('INSERT dbo.library_copies(school_id,accession,title,author,shelf,isbn) VALUES(@school,@acc,@title,@author,@shelf,@isbn)', {
                acc: [sql.NVarChar(60), text(b.accession, 60)], title: [sql.NVarChar(160), text(b.title, 160)], author: [sql.NVarChar(120), text(b.author, 120)],
                shelf: [sql.NVarChar(80), text(b.shelf, 80)], isbn: [sql.NVarChar(30), text(b.isbn || '', 30, true) || null],
            });
        }
        const copy = [sql.Int, id(b.copy)];
        const state = (await query(`SELECT c.id,COALESCE(e.id,0) version,e.action,e.pupil_id,e.staff_type,e.staff_id,CONVERT(char(10),e.due_date,23) due
            FROM dbo.library_copies c WITH(UPDLOCK) ${latestEvent} WHERE c.school_id=@school AND c.id=@copy`, { copy })).recordset[0];
        if (!state) throw fail(404, 'Copy not found.');
        if (!/^(0|[1-9]\d*)$/.test(String(b.version)) || String(state.version) !== String(b.version)) throw fail(409, 'This copy changed. Reopen its latest record.');
        const loan = ['checkout', 'renew'].includes(state.action), unavailable = ['lost', 'damaged'].includes(state.action);
        let student = state.pupil_id, staffType = state.staff_type, staff = state.staff_id, due = null;
        switch (b.action) {
        case 'checkout': {
            if (loan || unavailable) throw fail(409, 'This copy is unavailable.');
            const match = /^(student|admin|teacher|auxiliary):([1-9]\d*)$/.exec(b.borrower || '');
            if (!match) throw fail(422, 'Choose a borrower.');
            const borrower = id(match[2]);
            if (match[1] === 'student') {
                if (!(await query('SELECT id FROM dbo.students WHERE id=@b AND school_id=@school AND isWithdrawn=0', { b: [sql.Int, borrower] })).recordset.length) throw fail(404, 'Borrower not found.');
                const limit = loanLimit();
                const active = (await query(ACTIVE_STUDENT_LOANS, { student: [sql.Int, borrower] })).recordset[0].n;
                if (limit > 0 && active >= limit) throw fail(409, `This student already has ${active} book(s) on loan (limit ${limit}). Return one first.`);
                student = borrower; staffType = null; staff = null;
            } else {
                const eligible = { admin: "SELECT id FROM dbo.Admins WHERE id=@b AND school_id=@school AND LOWER(LTRIM(RTRIM(role)))='admin'",
                    teacher: "SELECT id FROM dbo.teachers WHERE id=@b AND school_id=@school AND status='active'",
                    auxiliary: "SELECT id FROM dbo.auxiliary_staff WHERE id=@b AND school_id=@school AND status='active'" }[match[1]];
                if (!(await query(eligible, { b: [sql.Int, borrower] })).recordset.length) throw fail(404, 'Borrower not found.');
                student = null; staffType = match[1]; staff = borrower;
            }
            due = date(b.due); if (due < now) throw fail(422, 'Choose today or a later due date.'); break;
        }
        case 'renew':
            if (!loan) throw fail(409, 'There is no active loan.');
            due = date(b.due); if (due <= state.due || due < now) throw fail(422, 'Choose a later due date.'); break;
        case 'return': if (!loan) throw fail(409, 'There is no active loan.'); break;
        case 'lost': case 'damaged': if (unavailable) throw fail(409, 'This copy already needs review.'); break;
        case 'repair': if (!unavailable) throw fail(409, 'This copy is already in circulation.'); student = null; staffType = null; staff = null; break;
        default: throw fail(422, 'Unknown library action.');
        }
        return query(`INSERT dbo.library_events(school_id,copy_id,action,pupil_id,staff_type,staff_id,due_date,actor_type,actor_id)
            VALUES(@school,@copy,@action,@p,@st,@s,@due,@actor_type,@actor)`,
        { copy, action: [sql.VarChar(12), b.action], p: [sql.Int, student], st: [sql.NVarChar(20), staffType], s: [sql.Int, staff], due: [sql.Date, due] });
    }

    // Optional whole/decimal count from a form (blank = 0).
    function count(value, wholeUnits, label) {
        if (value === undefined || value === null || value === '') return 0;
        const n = number(value);
        if (wholeUnits && !Number.isInteger(n)) throw fail(422, `${label}: equipment is counted in whole units.`);
        return n;
    }

    async function lab(query, area, b, now) {
        const teacher = area === 'requests';
        if (teacher !== (b.action === 'request')) throw fail(403, 'Access denied');
        const move = (item, action, delta, requestId = null, note = null) => query(`INSERT dbo.lab_movements(school_id,item_id,request_id,action,delta,note,actor_type,actor_id)
            VALUES(@school,@item,@rid,@action,@delta,@note,@actor_type,@actor)`,
        { item, rid: [sql.Int, requestId], action: [sql.VarChar(12), action], delta: [sql.Decimal(12, 3), delta], note: [sql.NVarChar(200), note] });

        if (b.action === 'add') {
            const kind = choice(b.kind, ['equipment', 'consumable', 'reagent']);
            return query(`INSERT dbo.lab_items(school_id,name,category,kind,unit,location,batch,minimum,expiry,restricted,hazard)
            VALUES(@school,@name,@category,@kind,@unit,@location,@batch,@min,@expiry,@restricted,@hazard)`, {
                name: [sql.NVarChar(120), text(b.name, 120)], category: [sql.NVarChar(60), choice(b.subject, LAB_SUBJECTS)], kind: [sql.VarChar(12), kind],
                unit: [sql.NVarChar(30), text(b.unit, 30)], location: [sql.NVarChar(80), text(b.location, 80)], batch: [sql.NVarChar(60), text(b.batch || '', 60, true)],
                min: [sql.Decimal(12, 3), number(b.minimum)], expiry: [sql.Date, b.expiry ? date(b.expiry) : null], restricted: [sql.Bit, b.restricted === 'on'],
                hazard: [sql.VarChar(20), choice(b.hazard || 'none', HAZARDS)],
            });
        }

        let request = null;
        if (!['receive', 'request', 'adjust', 'dispose'].includes(b.action)) {
            request = (await query('SELECT * FROM dbo.lab_requests WITH(UPDLOCK) WHERE school_id=@school AND id=@id', { id: [sql.Int, id(b.request)] })).recordset[0];
            if (!request) throw fail(404, 'Request not found.');
        }
        const item = [sql.Int, request ? request.item_id : id(b.item)];
        const stock = (await query(`SELECT i.name,i.kind,i.restricted,CONVERT(char(10),i.expiry,23) expiry,
            (SELECT COALESCE(SUM(delta),0) FROM dbo.lab_movements m WHERE m.school_id=i.school_id AND m.item_id=i.id) balance
            FROM dbo.lab_items i WITH(UPDLOCK) WHERE i.school_id=@school AND i.id=@item`, { item })).recordset[0];
        if (!stock || (teacher && stock.restricted)) throw fail(404, 'Item not found.');
        const equipment = stock.kind === 'equipment';
        const balance = Number(stock.balance);

        // Stock-take: record the physical count; the difference becomes an adjustment.
        if (b.action === 'adjust') {
            const counted = count(b.counted, equipment, 'Counted quantity');
            if (b.counted === undefined || b.counted === '') throw fail(422, 'Enter the quantity counted on the shelf.');
            const delta = Number((counted - balance).toFixed(3));
            if (delta === 0) throw fail(422, 'The count matches the recorded stock; nothing to adjust.');
            return move(item, 'adjust', delta, null, text(b.reason, 200));
        }
        // Disposal: expired, broken or contaminated stock leaves the inventory with a reason.
        if (b.action === 'dispose') {
            const qty = number(b.quantity);
            if (qty <= 0 || (equipment && !Number.isInteger(qty))) throw fail(422, 'Enter a positive quantity. Equipment uses whole units.');
            if (qty > balance) throw fail(409, 'You cannot dispose of more than the recorded stock.');
            return move(item, 'dispose', -qty, null, text(b.reason, 200));
        }

        const quantity = request ? Number(request.quantity) : number(b.quantity);
        if (quantity <= 0 || (equipment && !Number.isInteger(quantity))) throw fail(422, 'Enter a positive quantity. Equipment uses whole units.');
        if (['request', 'approve', 'issue'].includes(b.action) && (stock.restricted || (stock.expiry && stock.expiry < now))) throw fail(409, 'This stock is restricted or expired.');

        if (b.action === 'receive') return move(item, 'receive', quantity, null, text(b.note || '', 200, true) || null);

        if (teacher) {
            const needed = date(b.needed);
            if (needed < now || (stock.expiry && stock.expiry < needed)) throw fail(422, 'Choose a practical date from today onward, within the stock expiry.');
            let returnBy = null;
            if (equipment) {
                returnBy = date(b.returnBy || '');
                if (returnBy < needed) throw fail(422, 'The return date must be on or after the practical date.');
                if (returnBy > addDays(needed, 30)) throw fail(422, 'Equipment can be kept at most 30 days after the practical.');
                const overdue = (await query(`SELECT COUNT(*) n FROM dbo.lab_requests r JOIN dbo.lab_items i ON i.school_id=r.school_id AND i.id=r.item_id
                    WHERE r.school_id=@school AND r.requested_by_type=@actor_type AND r.requested_by_id=@actor
                      AND r.status='issued' AND i.kind='equipment' AND r.return_by<@today`, { today: [sql.Date, now] })).recordset[0].n;
                if (overdue > 0) throw fail(409, `You have ${overdue} equipment request(s) past their return date. Return that equipment to the laboratory before requesting more.`);
            }
            const classId = b.classId ? id(b.classId) : null;
            if (classId && !(await query('SELECT id FROM dbo.classes WHERE school_id=@school AND id=@class', { class: [sql.Int, classId] })).recordset.length) throw fail(404, 'Class not found.');
            return query(`INSERT dbo.lab_requests(school_id,item_id,requested_by_type,requested_by_id,quantity,purpose,needed_on,return_by,class_id)
                VALUES(@school,@item,@actor_type,@actor,@qty,@purpose,@needed,@returnBy,@class)`, {
                item, qty: [sql.Decimal(12, 3), quantity], purpose: [sql.NVarChar(200), text(b.purpose, 200)], needed: [sql.Date, needed],
                returnBy: [sql.Date, returnBy], class: [sql.Int, classId],
            });
        }

        const rid = request.id;
        const setStatus = (status, extra = '') => query(`UPDATE dbo.lab_requests SET status=@status${extra} WHERE school_id=@school AND id=@id`,
            { status: [sql.VarChar(12), status], id: [sql.Int, rid], note: [sql.NVarChar(200), text(b.note || '', 200, true) || null] });

        switch (b.action) {
        case 'approve':
            if (request.status !== 'pending') throw fail(409, 'Only pending requests can be approved.');
            await setStatus('approved');
            return move(item, 'approve', 0, rid);
        case 'decline':
            if (request.status !== 'pending') throw fail(409, 'Only pending requests can be declined.');
            await setStatus('declined', ', close_note=@note, closed_at=SYSUTCDATETIME()');
            return move(item, 'decline', 0, rid, text(b.note || '', 200, true) || null);
        case 'issue':
            if (request.status !== 'approved') throw fail(409, 'Approve the request before issuing it.');
            if (balance < quantity) throw fail(409, `Only ${balance} in stock; cannot issue ${quantity}.`);
            await setStatus('issued');
            return move(item, 'issue', -quantity, rid);
        case 'return': {
            // Equipment check-in: every issued unit must be accounted for as good, damaged or missing.
            if (!equipment) throw fail(422, 'Consumables and reagents are closed with “Record use”.');
            if (request.status !== 'issued') throw fail(409, 'Only issued equipment can be checked in.');
            const good = count(b.good, true, 'Returned in good condition');
            const damaged = count(b.damaged, true, 'Damaged');
            const missing = count(b.missing, true, 'Missing');
            const outstanding = quantity - Number(request.returned_qty || 0) - Number(request.damaged_qty || 0) - Number(request.missing_qty || 0);
            const total = good + damaged + missing;
            if (total <= 0) throw fail(422, 'Enter how many units came back in good condition, damaged or missing.');
            if (total > outstanding) throw fail(422, `Only ${outstanding} unit(s) are still out on this request.`);
            if ((damaged || missing) && !String(b.note || '').trim()) throw fail(422, 'Describe what happened to the damaged or missing units.');
            const closes = total === outstanding;
            const anyLoss = damaged > 0 || missing > 0 || Number(request.damaged_qty || 0) > 0 || Number(request.missing_qty || 0) > 0;
            await query(`UPDATE dbo.lab_requests SET returned_qty=COALESCE(returned_qty,0)+@good, damaged_qty=COALESCE(damaged_qty,0)+@damaged,
                missing_qty=COALESCE(missing_qty,0)+@missing, close_note=COALESCE(@note, close_note)
                ${closes ? ', status=@status, closed_at=SYSUTCDATETIME()' : ''} WHERE school_id=@school AND id=@id`, {
                good: [sql.Decimal(12, 3), good], damaged: [sql.Decimal(12, 3), damaged], missing: [sql.Decimal(12, 3), missing],
                note: [sql.NVarChar(200), text(b.note || '', 200, true) || null], status: [sql.VarChar(12), anyLoss ? 'damaged' : 'returned'], id: [sql.Int, rid],
            });
            if (good) await move(item, 'return', good, rid);
            if (damaged) await move(item, 'damage', 0, rid, `${damaged} damaged: ${text(b.note, 200)}`.slice(0, 200));
            if (missing) await move(item, 'lost', 0, rid, `${missing} missing: ${text(b.note, 200)}`.slice(0, 200));
            return { closed: closes };
        }
        case 'consume': {
            // Consumables and reagents: record use; unused quantity goes back on the shelf.
            if (equipment) throw fail(422, 'Equipment must be checked in as returned, damaged or missing.');
            if (request.status !== 'issued') throw fail(409, 'Only issued requests can be closed.');
            const unused = count(b.unused, false, 'Unused quantity');
            if (unused > quantity) throw fail(422, `Unused quantity cannot exceed the ${quantity} issued.`);
            await query(`UPDATE dbo.lab_requests SET status='consumed', returned_qty=@unused, closed_at=SYSUTCDATETIME(), close_note=@note
                WHERE school_id=@school AND id=@id`, { unused: [sql.Decimal(12, 3), unused], note: [sql.NVarChar(200), text(b.note || '', 200, true) || null], id: [sql.Int, rid] });
            return move(item, 'consume', unused, rid, `${Number((quantity - unused).toFixed(3))} used`);
        }
        default:
            throw fail(422, 'Unknown laboratory action.');
        }
    }

    async function save(actor, area, body) {
        if (!body || typeof body.operation !== 'string' || !body.operation) throw fail(422, 'Reopen the form before saving.');
        const now = clock();
        await scoped(actor, area, query => (area === 'library' ? library(query, body, now) : lab(query, area, body, now)), body.operation);
    }

    // A student's current loans; callers must already have checked access (student self or linked guardian).
    async function studentLoans(schoolId, studentId) {
        await poolConnect;
        const now = clock();
        const rows = (await pool.request().input('school', sql.Int, schoolId).input('student', sql.Int, studentId).input('today', sql.Date, now)
            .query(`SELECT c.title,c.author,c.accession,CONVERT(char(10),e.due_date,23) due,
                      CAST(CASE WHEN e.due_date<@today THEN 1 ELSE 0 END AS bit) overdue
                    FROM dbo.library_copies c ${latestEvent}
                    WHERE c.school_id=@school AND e.action IN ('checkout','renew') AND e.pupil_id=@student ORDER BY e.due_date`)).recordset;
        return { loans: rows, limit: loanLimit(), today: now };
    }

    return { listLibrary, listLab, save, studentLoans, AREAS };
}

module.exports = { createInventoryService, AREAS, LAB_SUBJECTS, HAZARDS, today };
