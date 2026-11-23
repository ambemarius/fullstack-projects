const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../app/app');
const { withDatabase } = require('../config/database');
const generateToken = require('../utils/generateToken');
const { createInventoryService } = require('../model/inventory/inventoryService');
const { syntheticDatabase } = require('./helpers/database');
const { serve } = require('./helpers/http');

const TODAY = '2026-11-16';
const librarian = { schoolId: 1, type: 'auxiliary', id: 5, name: 'L', duties: ['librarian'] };
const labAttendant = { schoolId: 1, type: 'auxiliary', id: 6, name: 'LA', duties: ['lab_attendant'] };
const teacher = { schoolId: 1, type: 'teacher', id: 7, name: 'T', duties: [] };
const admin = { schoolId: 1, type: 'admin', id: 1, name: 'A', duties: [] };
const op = () => crypto.randomUUID();

function fakeTransactions(answer) {
    const log = [];
    const beginTransaction = async () => {
        const state = { statements: [], committed: false, rolledBack: false };
        log.push(state);
        return {
            begin: async () => {}, commit: async () => { state.committed = true; }, rollback: async () => { state.rolledBack = true; },
            request() {
                const params = {};
                return { input(n, _t, v) { params[n] = v; return this; }, query: async s => { state.statements.push({ statement: s, params }); return answer(s, params); } };
            },
        };
    };
    return { log, beginTransaction };
}

test('areas are limited to their duty: librarians lend, lab attendants manage stock, teachers request', async () => {
    const { log, beginTransaction } = fakeTransactions(() => ({ recordset: [], recordsets: [[], [{}], [], [], [], []] }));
    const service = createInventoryService({ beginTransaction, clock: () => TODAY });
    await service.listLibrary(librarian);
    await service.listLibrary(admin);
    await assert.rejects(service.listLibrary(labAttendant), { statusCode: 403 });
    await assert.rejects(service.listLibrary(teacher), { statusCode: 403 });
    await service.listLab(labAttendant, 'laboratory');
    await assert.rejects(service.listLab(librarian, 'laboratory'), { statusCode: 403 });
    await service.listLab(teacher, 'requests');
    await assert.rejects(service.listLab(admin, 'requests'), { statusCode: 403 });
    assert.equal(log.length, 4);
    const teacherList = log[3].statements[0];
    assert.match(teacherList.statement, /i\.restricted=0/);
    assert.match(teacherList.statement, /r\.requested_by_type=@actor_type AND r\.requested_by_id=@actor/);
});

test('checkout enforces the student loan limit, a valid borrower, a version check and a future due date', async () => {
    let active = 2, version = 0;
    const { log, beginTransaction } = fakeTransactions(statement => {
        if (statement.includes('INSERT dbo.inventory_operations')) return { recordset: [] };
        if (statement.includes('WITH(UPDLOCK)')) return { recordset: [{ id: 3, version, action: null, pupil_id: null, staff_type: null, staff_id: null, due: null }] };
        if (statement.includes('FROM dbo.students WHERE id=@b')) return { recordset: [{ id: 40 }] };
        if (statement.includes("SELECT id FROM dbo.teachers WHERE id=@b")) return { recordset: [{ id: 7 }] };
        if (statement.includes('SELECT COUNT(*) n FROM dbo.library_copies')) return { recordset: [{ n: active }] };
        if (statement.includes('INSERT dbo.library_events')) return { recordset: [] };
        throw new Error('unexpected ' + statement);
    });
    const service = createInventoryService({ beginTransaction, clock: () => TODAY, loanLimit: () => 3 });
    const checkout = over => service.save(librarian, 'library', { operation: op(), action: 'checkout', copy: '3', version: '0', borrower: 'student:40', due: '2026-11-30', ...over });

    await checkout();
    const event = log[0].statements.find(s => s.statement.includes('INSERT dbo.library_events'));
    assert.deepEqual([event.params.p, event.params.st, event.params.s, event.params.actor_type, event.params.actor], [40, null, null, 'auxiliary', 5]);

    active = 3;
    await assert.rejects(checkout(), { statusCode: 409, message: /limit 3/ });
    active = 0;
    await checkout({ borrower: 'teacher:7' });
    const staffEvent = log.at(-1).statements.find(s => s.statement.includes('INSERT dbo.library_events'));
    assert.deepEqual([staffEvent.params.p, staffEvent.params.st, staffEvent.params.s], [null, 'teacher', 7]);
    await assert.rejects(checkout({ borrower: 'parent:4' }), { statusCode: 422 });
    await assert.rejects(checkout({ due: '2026-11-01' }), { statusCode: 422, message: /later due date/ });
    version = 9;
    await assert.rejects(checkout(), { statusCode: 409, message: /changed/ });
    await assert.rejects(service.save(librarian, 'library', { action: 'checkout' }), { statusCode: 422, message: /Reopen/ });
});

test('lab requests follow pending → approved → issued and cannot overdraw stock', async () => {
    let request = { id: 11, item_id: 2, quantity: 5, status: 'pending' }, balance = 3;
    const { log, beginTransaction } = fakeTransactions(statement => {
        if (statement.includes('INSERT dbo.inventory_operations')) return { recordset: [] };
        if (statement.includes('FROM dbo.lab_requests WITH(UPDLOCK)')) return { recordset: [request] };
        if (statement.includes('FROM dbo.lab_items i WITH(UPDLOCK)')) return { recordset: [{ kind: 'consumable', restricted: false, expiry: null, balance }] };
        if (statement.includes('UPDATE dbo.lab_requests') || statement.includes('INSERT dbo.lab_movements') || statement.includes('INSERT dbo.lab_requests')) return { recordset: [] };
        throw new Error('unexpected ' + statement);
    });
    const service = createInventoryService({ beginTransaction, clock: () => TODAY });
    await assert.rejects(service.save(labAttendant, 'laboratory', { operation: op(), action: 'issue', request: '11' }), { statusCode: 409, message: /Approve the request/ });
    await service.save(labAttendant, 'laboratory', { operation: op(), action: 'approve', request: '11' });
    request = { ...request, status: 'approved' };
    await assert.rejects(service.save(labAttendant, 'laboratory', { operation: op(), action: 'issue', request: '11' }), { statusCode: 409, message: /Only 3 in stock/ });
    balance = 10;
    await service.save(labAttendant, 'laboratory', { operation: op(), action: 'issue', request: '11' });
    const move = log.at(-1).statements.find(s => s.statement.includes('INSERT dbo.lab_movements'));
    assert.deepEqual([move.params.delta, move.params.actor_type], [-5, 'auxiliary']);
    await assert.rejects(service.save(teacher, 'requests', { operation: op(), action: 'receive', item: '2', quantity: '1' }), { statusCode: 403 });
    await service.save(teacher, 'requests', { operation: op(), action: 'request', item: '2', quantity: '2', needed: '2026-11-20', purpose: 'Form 4 titration' });
    const req = log.at(-1).statements.find(s => s.statement.includes('INSERT dbo.lab_requests'));
    assert.deepEqual([req.params.actor_type, req.params.actor, req.params.qty], ['teacher', 7, 2]);
});

// A stand-in lab with one request and one item whose fields the test can change between calls.
function labFixture(state) {
    return fakeTransactions((statement, params) => {
        if (statement.includes('INSERT dbo.inventory_operations')) return { recordset: [] };
        if (statement.includes('FROM dbo.lab_requests WITH(UPDLOCK)')) return { recordset: [state.request] };
        if (statement.includes('FROM dbo.lab_items i WITH(UPDLOCK)')) return { recordset: [{ name: 'Item', kind: state.kind, restricted: false, expiry: null, balance: state.balance }] };
        if (statement.includes('SELECT COUNT(*) n FROM dbo.lab_requests')) return { recordset: [{ n: state.overdue || 0 }] };
        if (statement.includes('FROM dbo.classes WHERE')) return { recordset: [{ id: params.class }] };
        if (/UPDATE dbo\.lab_requests|INSERT dbo\.lab_movements|INSERT dbo\.lab_requests|INSERT dbo\.lab_items/.test(statement)) return { recordset: [] };
        throw new Error('unexpected ' + statement);
    });
}

test('equipment requests need a return date and are blocked while the teacher has overdue equipment', async () => {
    const state = { kind: 'equipment', balance: 20, overdue: 0 };
    const { log, beginTransaction } = labFixture(state);
    const service = createInventoryService({ beginTransaction, clock: () => TODAY });
    const ask = over => service.save(teacher, 'requests', { operation: op(), action: 'request', item: '2', quantity: '4', needed: '2026-11-18', purpose: 'Form 3 optics', classId: '5', ...over });
    await assert.rejects(ask(), { statusCode: 422, message: /valid date/ }, 'return date missing');
    await assert.rejects(ask({ returnBy: '2026-11-17' }), { statusCode: 422, message: /on or after the practical/ });
    await assert.rejects(ask({ returnBy: '2027-01-30' }), { statusCode: 422, message: /30 days/ });
    await assert.rejects(ask({ needed: '2026-11-10', returnBy: '2026-11-18' }), { statusCode: 422, message: /from today/ });
    await ask({ returnBy: '2026-11-19' });
    const insert = log.at(-1).statements.find(s => s.statement.includes('INSERT dbo.lab_requests'));
    assert.deepEqual([insert.params.returnBy, insert.params.class, insert.params.qty], ['2026-11-19', 5, 4]);
    state.overdue = 1;
    await assert.rejects(ask({ returnBy: '2026-11-19' }), { statusCode: 409, message: /past their return date/ });
    state.kind = 'reagent';
    await ask({ quantity: '250', returnBy: '' });
    assert.equal(log.at(-1).statements.find(s => s.statement.includes('INSERT dbo.lab_requests')).params.returnBy, null, 'reagents need no return date');
});

test('equipment check-in accounts for every unit: partial returns stay open, losses need a note and close as damaged', async () => {
    const state = { kind: 'equipment', balance: 0, request: { id: 11, item_id: 2, quantity: 10, status: 'issued', returned_qty: null, damaged_qty: null, missing_qty: null } };
    const { log, beginTransaction } = labFixture(state);
    const service = createInventoryService({ beginTransaction, clock: () => TODAY });
    const checkIn = body => service.save(labAttendant, 'laboratory', { operation: op(), action: 'return', request: '11', ...body });
    await assert.rejects(checkIn({ good: '0' }), { statusCode: 422, message: /how many units/ });
    await assert.rejects(checkIn({ good: '11' }), { statusCode: 422, message: /Only 10 unit/ });
    await assert.rejects(checkIn({ good: '8', damaged: '2' }), { statusCode: 422, message: /Describe what happened/ });
    await assert.rejects(checkIn({ good: '1.5' }), { statusCode: 422, message: /whole units/ });

    await checkIn({ good: '6' });
    let update = log.at(-1).statements.find(s => s.statement.includes('UPDATE dbo.lab_requests'));
    assert.doesNotMatch(update.statement, /status=@status/, 'a partial return keeps the request open');
    assert.equal(log.at(-1).statements.find(s => s.statement.includes('INSERT dbo.lab_movements')).params.delta, 6, 'good units go back on the shelf');

    state.request = { ...state.request, returned_qty: 6 };
    await checkIn({ good: '3', missing: '1', note: 'One thermometer not returned by the class' });
    update = log.at(-1).statements.find(s => s.statement.includes('UPDATE dbo.lab_requests'));
    assert.match(update.statement, /status=@status/);
    assert.equal(update.params.status, 'damaged');
    const moves = log.at(-1).statements.filter(s => s.statement.includes('INSERT dbo.lab_movements')).map(s => [s.params.action, s.params.delta]);
    assert.deepEqual(moves, [['return', 3], ['lost', 0]]);
    await assert.rejects(service.save(labAttendant, 'laboratory', { operation: op(), action: 'consume', request: '11' }), { statusCode: 422, message: /checked in/ });
});

test('consumables close with use recorded; stock counts and disposals carry a reason', async () => {
    const state = { kind: 'reagent', balance: 500, request: { id: 12, item_id: 3, quantity: 200, status: 'issued' } };
    const { log, beginTransaction } = labFixture(state);
    const service = createInventoryService({ beginTransaction, clock: () => TODAY });
    const lab = body => service.save(labAttendant, 'laboratory', { operation: op(), ...body });
    await assert.rejects(lab({ action: 'return', request: '12', good: '1' }), { statusCode: 422, message: /Record use/ });
    await assert.rejects(lab({ action: 'consume', request: '12', unused: '201' }), { statusCode: 422 });
    await lab({ action: 'consume', request: '12', unused: '50' });
    assert.deepEqual(['consume', 50, '150 used'], (s => [s.params.action, s.params.delta, s.params.note])(log.at(-1).statements.find(s => s.statement.includes('INSERT dbo.lab_movements'))));

    await assert.rejects(lab({ action: 'adjust', item: '3', counted: '500', reason: 'count' }), { statusCode: 422, message: /matches/ });
    await assert.rejects(lab({ action: 'adjust', item: '3', counted: '480', reason: '' }), { statusCode: 422 });
    await lab({ action: 'adjust', item: '3', counted: '480', reason: 'Termly stock count' });
    assert.equal(log.at(-1).statements.find(s => s.statement.includes('INSERT dbo.lab_movements')).params.delta, -20);
    await assert.rejects(lab({ action: 'dispose', item: '3', quantity: '600', reason: 'expired' }), { statusCode: 409 });
    await lab({ action: 'dispose', item: '3', quantity: '100', reason: 'Expired batch' });
    assert.equal(log.at(-1).statements.find(s => s.statement.includes('INSERT dbo.lab_movements')).params.delta, -100);
    await assert.rejects(service.save(teacher, 'requests', { operation: op(), action: 'dispose', item: '3', quantity: '1', reason: 'x' }), { statusCode: 403 });
});

test('items belong to a subject laboratory and carry a hazard class', async () => {
    const { log, beginTransaction } = labFixture({});
    const service = createInventoryService({ beginTransaction, clock: () => TODAY });
    const add = over => service.save(labAttendant, 'laboratory', { operation: op(), action: 'add', name: 'Conc. sulfuric acid', kind: 'reagent', unit: 'mL', location: 'Chemistry store', minimum: '500', subject: 'Chemistry', hazard: 'corrosive', ...over });
    await assert.rejects(add({ subject: 'Mathematics' }), { statusCode: 422 });
    await assert.rejects(add({ hazard: 'spicy' }), { statusCode: 422 });
    await add();
    const insert = log.at(-1).statements.find(s => s.statement.includes('INSERT dbo.lab_items'));
    assert.deepEqual([insert.params.category, insert.params.hazard], ['Chemistry', 'corrosive']);
});

test('pages send signed-out visitors to sign-in; loans are limited to the student and linked guardians', async t => {
    const db = syntheticDatabase(statement => {
        if (statement.includes('FROM teachers WHERE id')) return { recordset: [{ id: 7, status: 'active', name: 'T', school_id: 1 }] };
        if (statement.includes('FROM staff_duties')) return { recordset: [] };
        if (statement.includes('FROM parents WHERE id')) return { recordset: [{ id: 4, status: 'active' }] };
        if (statement.includes('FROM parent_students WHERE parent_id')) return { recordset: [] };
        throw new Error('unexpected statement: ' + statement);
    });
    const base = await serve(t, createApp({ logging: false, requestContext: (_req, _res, next) => withDatabase(db, next) }));
    for (const page of ['/library', '/laboratory', '/lab-requests']) {
        const res = await fetch(base + page, { redirect: 'manual' });
        assert.equal(res.status, 302, page);
        assert.equal(res.headers.get('location'), '/login?next=' + encodeURIComponent(page));
    }
    const refused = await fetch(base + '/library', { headers: { Authorization: `Bearer ${generateToken(7, 'teacher')}` } });
    assert.equal(refused.status, 403);
    assert.match(await refused.text(), /librarian duty/);
    assert.equal((await fetch(base + '/api/v1/library/children/42', { headers: { Authorization: `Bearer ${generateToken(4, 'parent')}` } })).status, 403);
    assert.equal((await fetch(base + '/api/v1/library/my-loans')).status, 401);
    assert.equal((await fetch(base + '/api/v1/library/my-loans', { headers: { Authorization: `Bearer ${generateToken(7, 'teacher')}` } })).status, 401);
});

test('migration 014 keeps library history and stock append-only, with people as (type, id)', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/014_library_lab.sql'), 'utf8');
    for (const table of ['library_copies', 'library_events', 'lab_items', 'lab_requests', 'lab_movements', 'inventory_operations']) assert.match(sql, new RegExp('CREATE TABLE dbo\\.' + table));
    assert.equal(/school_memberships|\bDROP\b|\bDELETE\b/i.test(sql), false);
    assert.match(sql, /PK_inventory_operations PRIMARY KEY \(school_id, actor_type, actor_id, operation_id\)/);
});

test('migration 015 limits items to subject laboratories and enforces return accounting', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/015_lab_management.sql'), 'utf8');
    assert.match(sql, /CHECK \(category IN \('Physics', 'Chemistry', 'Biology', 'Geology', 'General lab'\)\)/);
    assert.match(sql, /CK_lab_requests_accounting/);
    assert.match(sql, /'adjust', 'dispose'/);
    assert.equal(/\bDELETE\b|\bDROP TABLE\b/i.test(sql), false);
});
