// End-of-year promotion, from the same figures as the report cards.
//   preview  every student of a class with the three term averages and the annual average (as on the
//            third-term bulletin) and a proposed decision: promote (annual >= 10/20), repeat, or graduate
//            (final-year classes); plus the class they move to and the next academic year.
//   apply    the administrator's decisions (the class council may override the proposal), in one transaction.
//            Promoted and repeating students are enrolled for the NEXT academic year, so a class's students can
//            only be promoted once and a class promoted later never picks them up again. Graduates leave the
//            class lists (withdrawn, with promoted = 1).
const { sql, pool, poolConnect } = require('../../config/database');
const { createReportCardService } = require('./reportCardService');

const PASS_MARK = 10;
const FINAL_RANK = 7;
const DECISIONS = ['promote', 'repeat', 'graduate'];
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const positive = (v, label) => { const n = Number(v); if (!Number.isSafeInteger(n) || n < 1) throw fail(422, `Choose a ${label}.`); return n; };

async function defaultQuery(statement, params = {}) {
    await poolConnect;
    const r = pool.request();
    for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value);
    return r.query(statement);
}
async function defaultTransaction() {
    await poolConnect;
    const tx = pool.transaction();
    await tx.begin();
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

function createPromotionService({ query = defaultQuery, transaction = defaultTransaction, reportCards = createReportCardService() } = {}) {
    const label = c => `${c.name}${c.stream && c.stream !== 'Normal' ? ' (' + c.stream + ')' : ''}`;

    async function context(classId, yearId) {
        const cls = (await query('SELECT id, name, section, stream, rank FROM classes WHERE id = @id', { id: [sql.Int, classId] })).recordset[0];
        if (!cls) throw fail(404, 'Class not found.');
        const year = (await query('SELECT id, name, fromYear, toYear FROM academic_years WHERE id = @id', { id: [sql.Int, yearId] })).recordset[0];
        if (!year) throw fail(404, 'Academic year not found.');
        const nextYear = (await query(`SELECT TOP 1 id, name FROM academic_years WHERE fromYear > @from ORDER BY fromYear, id`,
            { from: [sql.Int, year.fromYear] })).recordset[0] || null;
        const finalYear = cls.rank >= FINAL_RANK;
        // Classes one level up in the same section; the same stream first (Form 1 Bilingual -> Form 2 Bilingual).
        const nextClasses = finalYear ? [] : (await query(`SELECT id, name, stream FROM classes WHERE section = @section AND rank = @rank ORDER BY name`,
            { section: [sql.NVarChar(20), cls.section], rank: [sql.Int, cls.rank + 1] })).recordset
            .map(c => ({ id: c.id, label: label(c), sameStream: (c.stream || 'Normal') === (cls.stream || 'Normal') }))
            .sort((a, b) => Number(b.sameStream) - Number(a.sameStream));
        return { cls, year, nextYear, finalYear, nextClasses };
    }

    async function preview({ classId, yearId }) {
        const cId = positive(classId, 'class'), yId = positive(yearId, 'academic year');
        const ctx = await context(cId, yId);
        const data = await reportCards.classCards({ classId: cId, term: 'Third', yearId: yId });
        const students = data.cards.map(card => {
            const annual = card.annual_average;
            const proposal = annual === null || annual === undefined ? 'repeat' : annual >= PASS_MARK ? (ctx.finalYear ? 'graduate' : 'promote') : 'repeat';
            return {
                id: Number(card.student.id), name: card.student.full_name, matricule: card.student.matricule, repeater: Boolean(card.student.is_repeater),
                terms: card.term_history.map(h => h.avg), annual, rank: null,
                decision: proposal,
                reason: annual === null || annual === undefined ? 'No annual average yet (marks missing)' : annual >= PASS_MARK ? `Annual average ${annual.toFixed(2)} ≥ ${PASS_MARK}` : `Annual average ${annual.toFixed(2)} < ${PASS_MARK}`,
            };
        });
        // Rank by annual average (ties share a rank: 1, 2, 2, 4); students without one come last.
        const annuals = students.filter(s => s.annual !== null && s.annual !== undefined).map(s => s.annual);
        for (const st of students) st.rank = st.annual === null || st.annual === undefined ? null : 1 + annuals.filter(v => v > st.annual + 1e-9).length;
        students.sort((a, b) => (a.rank || 9999) - (b.rank || 9999) || a.name.localeCompare(b.name));
        return {
            class: { id: ctx.cls.id, label: `${ctx.cls.section} — ${label(ctx.cls)}`, section: ctx.cls.section, finalYear: ctx.finalYear },
            year: { id: ctx.year.id, name: ctx.year.name }, nextYear: ctx.nextYear, nextClasses: ctx.nextClasses, passMark: PASS_MARK, students,
            counts: DECISIONS.reduce((o, d) => ({ ...o, [d]: students.filter(s => s.decision === d).length }), {}),
            missingAverages: students.filter(s => s.annual === null || s.annual === undefined).length,
        };
    }

    // body: { classId, yearId, nextClassId, decisions: { [studentId]: 'promote' | 'repeat' | 'graduate' } }
    async function apply(actor, body = {}) {
        const cId = positive(body.classId, 'class'), yId = positive(body.yearId, 'academic year');
        const ctx = await context(cId, yId);
        if (!ctx.nextYear) throw fail(409, `Create the next academic year (after ${ctx.year.name}) first: promoted and repeating students are enrolled for it.`);
        const decisions = body.decisions && typeof body.decisions === 'object' ? body.decisions : null;
        if (!decisions || !Object.keys(decisions).length) throw fail(422, 'Send a decision for each student.');
        let nextClassId = null;
        if (Object.values(decisions).includes('promote')) {
            if (ctx.finalYear) throw fail(422, 'Students of a final-year class graduate; they cannot be promoted to another class.');
            nextClassId = positive(body.nextClassId, 'class to promote to');
            if (!ctx.nextClasses.some(c => c.id === nextClassId)) throw fail(422, 'Choose a class one level up in the same section.');
        }
        if (Object.values(decisions).includes('graduate') && !ctx.finalYear) throw fail(422, 'Only final-year students graduate.');

        // Only the class's students for the ending year (never someone already moved to the next year).
        const roster = (await query(`SELECT id FROM students WHERE currentClassLevel = @class AND isWithdrawn = 0 AND (academicYearId IS NULL OR academicYearId = @year)`,
            { class: [sql.Int, cId], year: [sql.Int, yId] })).recordset.map(r => r.id);
        const ids = Object.keys(decisions).map(Number);
        const stranger = ids.find(id => !roster.includes(id));
        if (stranger) throw fail(409, `Student ${stranger} is no longer in this class for ${ctx.year.name}. Reload the preview.`);
        const missing = roster.filter(id => !ids.includes(id));
        if (missing.length) throw fail(422, `Choose a decision for every student (${missing.length} missing).`);
        for (const d of Object.values(decisions)) if (!DECISIONS.includes(d)) throw fail(422, 'Each decision must be promote, repeat or graduate.');

        const tx = await transaction();
        const counts = { promote: 0, repeat: 0, graduate: 0 };
        try {
            for (const [sid, d] of Object.entries(decisions)) {
                const p = { id: [sql.Int, Number(sid)], next: [sql.Int, ctx.nextYear.id], cls: [sql.Int, nextClassId] };
                if (d === 'promote') await tx.query('UPDATE students SET currentClassLevel = @cls, academicYearId = @next, promoted = 1 WHERE id = @id', p);
                else if (d === 'repeat') await tx.query('UPDATE students SET academicYearId = @next, promoted = 0 WHERE id = @id', p);
                else await tx.query('UPDATE students SET promoted = 1, isWithdrawn = 1 WHERE id = @id', p);
                counts[d] += 1;
            }
            await tx.commit();
        } catch (err) {
            await tx.rollback().catch(() => {});
            throw err;
        }
        return { class: `${ctx.cls.section} — ${label(ctx.cls)}`, nextYear: ctx.nextYear.name, nextClass: ctx.nextClasses.find(c => c.id === nextClassId)?.label || null,
            promoted: counts.promote, repeating: counts.repeat, graduated: counts.graduate, by: actor && actor.id };
    }

    return { preview, apply };
}

module.exports = { createPromotionService, PASS_MARK };
