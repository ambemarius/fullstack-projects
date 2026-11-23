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

test('bursars view and record payments but cannot charge, reverse or cancel; teachers without the duty get nothing', async () => {
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

    for (const action of [{ action: 'charge', student: '4', year: '5', description: 'X', amount: '1', operation: crypto.randomUUID() },
        { action: 'reverse', charge: '10', payment: '77', reason: 'mistake' }, { action: 'cancel', charge: '10', reason: 'mistake' }]) {
        await assert.rejects(service.save(bursar, action), { statusCode: 403 });
    }
    await assert.rejects(service.list(teacher), { statusCode: 403 });
    await assert.rejects(service.list({ ...admin, schoolId: null }), { statusCode: 409 });
    assert.equal(log.length, 1, 'refused requests never open a transaction');
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
    await assert.rejects(service.reviewBulk(bursar, { students: ['4'], year: '5', description: 'X', amount: '1' }), { statusCode: 403 });
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
