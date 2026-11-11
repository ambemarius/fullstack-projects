# Pupil financial statements

6 November 2026. Administrator and bursar/cashier users can open **Pupil statements** from the finance practice workspace. A charge detail also links directly to that pupil's statement for its academic year.

## Delivered

The pupil directory searches names and matricules and includes withdrawn pupils so their financial history remains accessible. It displays at most 200 matches with an explicit refinement notice when more exist. This directory limit never truncates a selected pupil's statement.

A statement shows one pupil's recorded charges and payments across all academic years or an explicitly selected year. Active charged, net paid, outstanding and overdue amounts are calculated with exact integers. Overdue means an uncancelled charge has a due date before the current Africa/Douala date; charges without due dates are not silently classified as overdue. Cancelled charges and reversed payments remain in the history and are excluded from active totals. Receipt and charge links provide detail.

The displayed zero balance explicitly means only that recorded charges have no outstanding amount. It does not certify complete fee entry, infer opening balances or import old paid checkboxes. A statement is current-state information, not a historical closing balance.

The print action hides interactive filters but retains pupil/year identity, generation time, the current-balance explanation, totals and history. CSV contains separate charge, payment and total rows with distinct amount columns, current correction status and the selected year. It uses the existing formula-safe CSV escaping. Dates are labelled as charge due dates or payment dates.

## Scope and verification

`financeService.pupilStatement` performs school-qualified pupil, year, charge and payment reads in the existing authorized SERIALIZABLE transaction. Current administrator/bursar sessions are required for both HTML and CSV. Foreign pupil/year identifiers, absent authority and revoked membership are refused. More than 500 charges or 5,000 payments produces an explicit error without partial statement totals.

All 148 isolated tests and both focused SQL tests passed. Added checks cover distinct pupils and academic years, cancellations/reversals, overdue versus due-today totals, withdrawn pupils, empty statements, foreign-school denial, role/revocation denial, HTML escaping, formula-safe CSV, protected downloads and oversized-payment rejection. Fixtures were removed while preserving the persistent practice school.

The ownership-verified practice listener restarted as PID 37604. Live checks passed statement directories, selected-pupil pages and CSV downloads for both finance roles, alongside existing reports and other workspaces. Browser DOM inspection verified the directory-to-statement workflow, academic-year selector, zero-data explanation, totals and print/export controls. Actual print-dialog output and mobile visual acceptance remain unverified.

## Handoff

Changes are in `model/identity/financeService.js`, `scripts/schoolPractice.js`, `utils/financeCsv.js`, `views/finance-statement.ejs`, finance navigation views and existing SQL/live checks. No schema, production records, real balances or passwords changed. Real bursar provisioning, reviewed fee schedules/opening balances and production activation remain pending.

The preceding checkpoint is `backups/source/1793989081719_source.json.gz`. Rollback is source-only with an ownership-verified practice restart; preserve database records. The existing M2 preview still requires avoiding the full schema-installing SQL suite.
