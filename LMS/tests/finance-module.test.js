const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { createApp } = require('../app/app');
const { withDatabase } = require('../config/database');
const generateToken = require('../utils/generateToken');
const { createFinanceService } = require('../model/finance/financeService');
const { financeCollectionsCsv } = require('../utils/financeCsv');
const { syntheticDatabase } = require('./helpers/database');
const { serve } = require('./helpers/http');

const admin = { schoolId: 1, type: 'admin', id: 1, name: 'Admin', duties: [] };
const bursar = { schoolId: 1, type: 'auxiliary', id: 5, name: 'Bursar', duties: ['bursar'] };
const teacher = { schoolId: 1, type: 'teacher', id: 2, name: 'Teacher', duties: [] };
const openCharge = { id: 10, student_id: 4, year_id: 5, description: 'Tuition 2026/2027', amount: '150000', paid: '50000', balance: '100000', cancelled: null, student: 'A Student', matricule: 'LB-1', year: '2026/2027' };

// A stand-in transaction: records every statement and answers from a handler.
function fakeTransactions(answer) {
    const log = [];
    const beginTransaction = async () => {
        const state = { committed: false, rolledBack: false };
        log.push(state);
        return {
            state,
            begin: async () => {}, commit: async () => { state.committed = true; }, rollback: async () => { state.rolledBack = true; },
            request() {
                const params = {};
                return { input(name, _t, value) { params[name] = value; return this; }, query: async statement => { (state.statements ||= []).push({ statement, params }); return answer(statement, params); } };
            },
        };
    };
    return { log, beginTransaction };
}

test('bursars run fee collection: record payments, charge, reverse and cancel; teachers without the duty get nothing', async () => {
    const { log, beginTransaction } = fakeTransactions(statement => {
        if (statement.includes('UPDLOCK')) return { recordset: [{ id: 10 }] };
        if (statement.includes('INSERT dbo.finance_payments')) return { recordset: [{ id: 77 }] };
        if (statement.includes('FROM dbo.finance_charges c')) return { recordset: [openCharge] };
        return { recordset: [], recordsets: [[], [], [], []] };
    });
    const service = createFinanceService({ beginTransaction });
    const pay = { action: 'pay', charge: '10', amount: '20000', paidOn: '2026-01-15', method: 'cash', operation: crypto.randomUUID() };
    assert.deepEqual(await service.save(bursar, pay), { id: 10, paymentId: 77 });
    const insert = log[0].statements.find(s => s.statement.includes('INSERT dbo.finance_payments'));
    assert.deepEqual([insert.params.actor_type, insert.params.actor, insert.params.school], ['auxiliary', 5, 1]);

    // The bursar is in charge of fees: charging and corrections are allowed (the permission check passes;
    // the fake database may still refuse the details, but never with "no permission").
    const manage = [{ action: 'charge', student: '4', year: '5', description: 'X', amount: '1', operation: crypto.randomUUID() },
        { action: 'reverse', charge: '10', payment: '77', reason: 'mistake' }, { action: 'cancel', charge: '10', reason: 'mistake' }];
    for (const action of manage) {
        const outcome = await service.save(bursar, action).then(() => 'saved', err => err.statusCode);
        assert.notEqual(outcome, 403, `bursar may ${action.action}`);
    }
    const opened = log.length;
    for (const action of manage) await assert.rejects(service.save(teacher, action), { statusCode: 403 });
    await assert.rejects(service.list(teacher), { statusCode: 403 });
    await assert.rejects(service.list({ ...admin, schoolId: null }), { statusCode: 409 });
    assert.equal(log.length, opened, 'refused requests never open a transaction');
});

test('payments are refused above the balance, in the future, or without a reference for non-cash methods', async () => {
    const { log, beginTransaction } = fakeTransactions(statement => {
        if (statement.includes('UPDLOCK')) return { recordset: [{ id: 10 }] };
        if (statement.includes('FROM dbo.finance_charges c')) return { recordset: [openCharge] };
        throw new Error('unexpected ' + statement);
    });
    const service = createFinanceService({ beginTransaction });
    const base = { action: 'pay', charge: '10', paidOn: '2026-01-15', method: 'cash', amount: '100', operation: crypto.randomUUID() };
    await assert.rejects(service.save(admin, { ...base, amount: '100001' }), { statusCode: 409, message: /exceeds the outstanding balance/ });
    await assert.rejects(service.save(admin, { ...base, paidOn: '2999-01-01' }), { statusCode: 422, message: /future/ });
    await assert.rejects(service.save(admin, { ...base, method: 'mobile' }), { statusCode: 422, message: /transaction reference/ });
    await assert.rejects(service.save(admin, { ...base, amount: '12.5' }), { statusCode: 422 });
    assert.ok(log.every(t => t.rolledBack && !t.committed), 'every refusal rolls back');
});

test('batch reviews belong to the person who prepared them', async () => {
    const students = [{ id: 4, firstName: 'A', lastName: 'Student', matricule: 'LB-1', existing: 0 }];
    const { beginTransaction } = fakeTransactions(statement => {
        if (statement.includes('FROM dbo.academic_years')) return { recordset: [{ id: 5, name: '2026/2027', fromYear: 2026, toYear: 2027 }] };
        if (statement.includes('FROM dbo.students p')) return { recordset: students };
        if (statement.includes('INSERT dbo.finance_charges')) return { recordset: [{ id: 900 }] };
        throw new Error('unexpected ' + statement);
    });
    const service = createFinanceService({ beginTransaction });
    const review = await service.reviewBulk(admin, { students: ['4'], year: '5', description: 'Tuition 2026/2027', amount: '150000' });
    assert.equal(review.total, '150000');
    const otherAdmin = { ...admin, id: 2 };
    await assert.rejects(service.confirmBulk(otherAdmin, review.token), { statusCode: 409 });
    const saved = await service.confirmBulk(admin, review.token);
    assert.equal(saved.charges[0].id, 900);
    await assert.rejects(service.confirmBulk(admin, review.token), { statusCode: 409 }, 'a review saves once');
    const bursarReview = await service.reviewBulk(bursar, { students: ['4'], year: '5', description: 'Tuition 2026/2027', amount: '150000' });
    assert.equal(bursarReview.total, '150000', 'the bursar can charge a class');
    await assert.rejects(service.confirmBulk(admin, bursarReview.token), { statusCode: 409 }, 'a review belongs to the person who prepared it');
    await assert.rejects(service.reviewBulk(teacher, { students: ['4'], year: '5', description: 'X', amount: '1' }), { statusCode: 403 });
});

test('finance pages send signed-out visitors to sign-in and explain refusals to staff without the duty', async t => {
    const db = syntheticDatabase((statement, params) => {
        if (statement.includes('FROM teachers WHERE id')) return { recordset: [{ id: 2, status: 'active', name: 'Teacher', school_id: 1 }] };
        if (statement.includes('FROM staff_duties')) return { recordset: [] };
        throw new Error('unexpected statement: ' + statement);
    });
    const app = createApp({ logging: false, requestContext: (_req, _res, next) => withDatabase(db, next) });
    const base = await serve(t, app);
    const anonymous = await fetch(base + '/finance', { redirect: 'manual' });
    assert.equal(anonymous.status, 302);
    assert.match(anonymous.headers.get('location'), /^\/login/);
    const refused = await fetch(base + '/finance', { headers: { Authorization: `Bearer ${generateToken(2, 'teacher')}` } });
    assert.equal(refused.status, 403);
    assert.match(await refused.text(), /bursar duty/);
    const student = await fetch(base + '/finance', { headers: { Authorization: `Bearer ${generateToken(3, 'student')}` } });
    assert.equal(student.status, 403);
});

test('finance POSTs carried by the session cookie must come from this site', async t => {
    const db = syntheticDatabase(statement => {
        if (statement.includes('FROM Admins')) return { recordset: [{ id: 1, role: 'admin', name: 'Admin', school_id: 1 }] };
        if (statement.includes('FROM staff_duties')) return { recordset: [] };
        throw new Error('unexpected statement: ' + statement);
    });
    const app = createApp({ logging: false, requestContext: (_req, _res, next) => withDatabase(db, next) });
    const base = await serve(t, app);
    const cookie = 'lms_token=' + generateToken(1, 'admin');
    const res = await fetch(base + '/finance', { method: 'POST', headers: { Cookie: cookie, Origin: 'https://attacker.invalid', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'action=cancel&charge=1&reason=x' });
    assert.equal(res.status, 403);
    assert.match(await res.text(), /Cross-site request blocked/);
});

test('school CSV exports drop the practice marker', () => {
    const report = { school: { name: 'LYCEE BATOURI' }, from: '2026-01-01', to: '2026-01-31', generatedAt: new Date('2026-02-01T00:00:00Z'), rows: [] };
    assert.match(financeCollectionsCsv(report, { practice: false }), /^﻿"Records","School"/);
    assert.match(financeCollectionsCsv(report), /^﻿"Practice records","School"/);
});

test('migration 012 is append-only and records who acted without identity-layer memberships', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/012_finance.sql'), 'utf8');
    for (const table of ['finance_charges', 'finance_payments', 'finance_reversals', 'finance_cancellations']) assert.match(sql, new RegExp('CREATE TABLE dbo\\.' + table));
    assert.equal(/school_memberships|membership_roles/.test(sql), false);
    assert.equal(/\bDROP\b|\bDELETE\b|\bUPDATE\b/i.test(sql), false);
    assert.match(sql, /UQ_finance_payments_operation UNIQUE \(school_id, actor_type, actor_id, operation_id\)/);
});

const crypto = require('node:crypto');

test('outstanding balances: whole school class by class and one class student by student, for bursars and administrators', async () => {
    const rows = [
        { id: 1, name: 'Ada Paid', matricule: 'M1', classId: 7, parentName: 'P1', parentPhone: '+237670000001', charges: 2, charged: '60000', paid: '60000', balance: '0', overdue: '0', lastPaid: '2026-10-01' },
        { id: 2, name: 'Ben Partial', matricule: 'M2', classId: 7, parentName: 'P2', parentPhone: null, charges: 2, charged: '60000', paid: '20000', balance: '40000', overdue: '15000', lastPaid: '2026-09-20' },
        { id: 3, name: 'Cy None', matricule: 'M3', classId: 7, parentName: null, parentPhone: null, charges: 2, charged: '60000', paid: '0', balance: '60000', overdue: '60000', lastPaid: null },
        { id: 4, name: 'Dee Nothing', matricule: 'M4', classId: 8, parentName: null, parentPhone: null, charges: 0, charged: '0', paid: '0', balance: '0', overdue: '0', lastPaid: null },
    ];
    const { beginTransaction } = fakeTransactions((statement, params) => {
        if (statement.includes('FROM dbo.schools')) return { recordset: [{ id: 1, name: 'School' }] };
        if (statement.includes('FROM dbo.academic_years')) return { recordset: [{ id: 5, name: '2026/2027', isCurrent: true }, { id: 3, name: '2025/2026', isCurrent: false }] };
        if (statement.includes('FROM dbo.classes')) return { recordset: [{ id: 7, section: 'Anglophone', name: 'Form1', stream: 'Normal' }, { id: 8, section: 'Anglophone', name: 'Form2', stream: 'Bilingual' }] };
        if (statement.includes('WITH ch AS')) { assert.equal(params.year, 5, 'defaults to the current year'); return { recordset: rows }; }
        throw new Error('unexpected ' + statement.slice(0, 60));
    });
    const service = createFinanceService({ beginTransaction });

    const school = await service.outstanding(bursar, {});
    assert.equal(school.yearId, 5);
    assert.deepEqual(school.summary.map(c => [c.label, c.students, c.fullyPaid, c.partlyPaid, c.notPaid, c.noCharges, c.balance, c.overdue, c.collected]),
        [['Anglophone — Form1', 3, 1, 1, 1, 0, 100000n, 75000n, 80000n], ['Anglophone — Form2 (Bilingual)', 1, 0, 0, 0, 1, 0n, 0n, 0n]]);
    assert.deepEqual([school.totals.students, school.totals.balance, school.totals.charged], [4, 100000n, 180000n]);
    assert.deepEqual(school.students, [], 'no student list without a class');

    const owing = await service.outstanding(admin, { class: 7 });
    assert.deepEqual(owing.students.map(s => [s.name, s.status]), [['Cy None', 'unpaid'], ['Ben Partial', 'partial']], 'only those who owe, largest balance first');
    assert.deepEqual((await service.outstanding(bursar, { class: 7, show: 'all' })).students.map(s => s.status), ['unpaid', 'partial', 'paid']);
    assert.deepEqual((await service.outstanding(bursar, { class: 7, show: 'overdue' })).students.length, 2);

    await assert.rejects(service.outstanding(teacher, {}), { statusCode: 403 });
    await assert.rejects(service.outstanding(bursar, { class: 99 }), { statusCode: 404 });
    await assert.rejects(service.outstanding(bursar, { year: 42 }), { statusCode: 404 });

    const { financeOutstandingCsv } = require('../utils/financeCsv');
    const csv = financeOutstandingCsv(school);
    assert.match(csv, /"Anglophone — Form1","3","1","1","1","0","180000"|Anglophone — Form1/);
    assert.match(csv, /WHOLE SCHOOL/);
    const classCsv = financeOutstandingCsv(owing);
    assert.match(classCsv, /Cy None/);
    assert.match(classCsv, /Not paid/);
});

test('outstanding balances page is linked from the finance menu and offers Record payment for students who owe', () => {
    const nav = fs.readFileSync(path.join(__dirname, '../views/finance/nav.ejs'), 'utf8');
    assert.match(nav, /\['outstanding','Outstanding balances','\/outstanding'/);
    const view = fs.readFileSync(path.join(__dirname, '../views/finance/outstanding.ejs'), 'utf8');
    assert.match(view, /<option value="">Whole school, class by class<\/option>/);
    assert.match(view, /Record payment<\/a>/);
    const router = fs.readFileSync(path.join(__dirname, '../routes/finance/financeRouter.js'), 'utf8');
    assert.match(router, /router\.get\('\/outstanding'/);
});
