/**
 * Copy the old registration fee checkboxes (student_fees) into the finance ledger.
 *
 *   node scripts/importLegacyFees.js --year <academicYearId> --admin <adminId>           (dry run)
 *   node scripts/importLegacyFees.js --year <academicYearId> --admin <adminId> --apply   (write)
 *
 * Each student_fees row becomes a charge "<fee type> <year>" for that academic year; rows
 * marked paid also get a full payment dated --paid-on (default today), method "other",
 * reference "legacy-import". Re-running skips rows already imported. One transaction.
 */
const crypto = require('node:crypto');

function arg(name) {
    const i = process.argv.indexOf('--' + name);
    return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
    require('../config/environment').loadEnvironment();
    const { sql, pool, poolConnect } = require('../config/database');
    const { today } = require('../model/finance/financeService');
    const yearId = Number(arg('year')), adminId = Number(arg('admin'));
    const paidOn = arg('paid-on') || today();
    const apply = process.argv.includes('--apply');
    if (!Number.isSafeInteger(yearId) || !Number.isSafeInteger(adminId) || !/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) {
        throw new Error('Usage: --year <academicYearId> --admin <adminId> [--paid-on YYYY-MM-DD] [--apply]');
    }
    await poolConnect;
    const year = (await pool.request().input('id', sql.Int, yearId).query('SELECT id, name, school_id FROM academic_years WHERE id = @id')).recordset[0];
    const admin = (await pool.request().input('id', sql.Int, adminId).query("SELECT id, name FROM Admins WHERE id = @id AND LOWER(LTRIM(RTRIM(role))) = 'admin'")).recordset[0];
    if (!year || !year.school_id) throw new Error('Academic year not found or not linked to a school');
    if (!admin) throw new Error('Administrator not found');

    const rows = (await pool.request().input('year', sql.Int, yearId).input('suffix', sql.NVarChar(60), ' ' + year.name).query(`
        SELECT f.id, f.student_id, f.fee_type, CONVERT(varchar(30), CONVERT(bigint, ROUND(f.amount, 0))) amount, f.paid,
               s.firstName + ' ' + s.lastName student, s.matricule, s.school_id,
               (SELECT COUNT(*) FROM finance_charges c WHERE c.student_id = f.student_id AND c.year_id = @year
                  AND c.source = 'legacy-import' AND c.description = f.fee_type + @suffix) imported
        FROM student_fees f JOIN students s ON s.id = f.student_id
        ORDER BY s.lastName, s.firstName, f.fee_type`)).recordset;

    const plan = rows.filter(r => !r.imported && Number(r.amount) > 0 && r.school_id === year.school_id);
    const skipped = rows.length - plan.length;
    const total = plan.reduce((s, r) => s + BigInt(r.amount), 0n);
    const paid = plan.filter(r => r.paid).reduce((s, r) => s + BigInt(r.amount), 0n);
    console.table(plan.map(r => ({ student: r.student, matricule: r.matricule, fee: r.fee_type + ' ' + year.name, amount: r.amount, paid: r.paid ? 'yes' : 'no' })));
    console.log(`${plan.length} charge(s) to create for ${year.name}, ${total} XAF; ${plan.filter(r => r.paid).length} paid in full (${paid} XAF, dated ${paidOn}). ${skipped} row(s) skipped (already imported, zero amount or another school). Recorded by ${admin.name}.`);
    if (!apply) { console.log('Dry run only. Re-run with --apply to write these entries.'); return; }
    if (!plan.length) { console.log('Nothing to import.'); return; }

    const tx = pool.transaction();
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
        for (const r of plan) {
            const charge = (await new sql.Request(tx)
                .input('school', sql.Int, year.school_id).input('student', sql.Int, r.student_id).input('year', sql.Int, yearId)
                .input('description', sql.NVarChar(120), r.fee_type + ' ' + year.name).input('amount', sql.BigInt, r.amount)
                .input('admin', sql.Int, adminId).input('op', sql.UniqueIdentifier, crypto.randomUUID())
                .query(`INSERT finance_charges(school_id, student_id, year_id, description, amount, currency, actor_type, actor_id, operation_id, source)
                        OUTPUT inserted.id VALUES(@school, @student, @year, @description, @amount, 'XAF', 'admin', @admin, @op, 'legacy-import')`)).recordset[0];
            if (r.paid) {
                await new sql.Request(tx)
                    .input('school', sql.Int, year.school_id).input('charge', sql.Int, charge.id).input('amount', sql.BigInt, r.amount)
                    .input('paid', sql.Date, paidOn).input('admin', sql.Int, adminId).input('op', sql.UniqueIdentifier, crypto.randomUUID())
                    .query(`INSERT finance_payments(school_id, charge_id, amount, paid_on, method, reference, actor_type, actor_id, operation_id)
                            VALUES(@school, @charge, @amount, @paid, 'other', 'legacy-import', 'admin', @admin, @op)`);
            }
        }
        await tx.commit();
        console.log(`Imported ${plan.length} charge(s).`);
    } catch (err) {
        await tx.rollback().catch(() => {});
        throw err;
    }
}

if (require.main === module) main()
    .then(() => process.exit(0))
    .catch(err => { console.error('Legacy fee import stopped:', err.message); process.exit(1); });

module.exports = { main };
