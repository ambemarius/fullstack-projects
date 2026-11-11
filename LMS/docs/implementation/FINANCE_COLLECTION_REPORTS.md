# Finance collection reports

6 November 2026. Collection reports are active in the synthetic finance workspace on port 2030. Open Finance as administrator or bursar/cashier, then **Collection reports and exports**.

## Delivered

The report selects an inclusive payment-date range of up to 366 days, with optional payment-method and recording-operator filters. It shows original recorded amounts, amounts currently reversed and current net collected, grouped by method and cashier/administrator. Individual entries link to their existing receipt and retain reversal reasons and timestamps. Operators with historical payments remain selectable even if their membership was later revoked; viewing the report still requires an active authorized session.

HTML and CSV use the same scoped service and filters. CSV includes the school, selected period, generation timestamp, receipt, pupil, fee, method, transaction reference, recording operator, amounts, current status and recording/reversal timestamps. Spreadsheet formula prefixes are neutralized with the existing CSV quoting utility. The print control uses the browser print dialog and hides interactive filters. The selected filters and period remain visible in print.

The period refers to payment dates, not recording or reversal dates. Reversal state is current when the report is generated, including corrections made after the selected period. This is not an as-of closing balance, a refund report or a bank reconciliation. All visible pages and exports identify the records as fictional practice data.

The service verifies session, school, membership and administrator/bursar authority within a SERIALIZABLE transaction. School-qualified joins protect pupils, charges and payment operators. Caller-supplied foreign operator identifiers are refused. Reports exceeding 5,000 payments return a request to narrow the filters; no incomplete report or partial total is returned. Amounts and totals retain exact integer arithmetic.

## Verification and activation

- 148/148 isolated tests passed.
- `npm.cmd run test:finance`: both focused SQL tests passed. New checks cover inclusive start/end dates, separate school results, foreign operator rejection, wrong-role/revoked-membership denial, method/cashier filters, current reversal reconciliation, invalid date ranges, escaped HTML, safe CSV data, protected download routes and a 5,001-payment limit fixture. Fixtures were cleaned; persistent practice data was preserved.
- The verified practice listener restarted as PID 20124. `npm.cmd run check:practice` passed both finance report/CSV routes plus the existing inventory, attendance, enrolment and school runtime checks.
- Browser DOM inspection confirmed the report filters, totals, group tables, receipt section, CSV link and print button. Screenshot capture was unavailable; printed output and responsive visual acceptance are not certified by this check.

No schema changes, real payments, opening balances or production staff changes were made. Migration 016 and real bursar provisioning retain their previously recorded production gates. Bank reconciliation, approved refunds/waivers and historical opening balances remain separate work.

## Handoff and rollback

Changed service: `model/identity/financeService.js`. Report route: `scripts/schoolPractice.js`. CSV formatter: `utils/financeCsv.js`. View: `views/finance-collections.ejs`. Navigation and print styles were extended. SQL integration and live checks cover the new routes.

The preceding verified source checkpoint is `backups/source/1793983914001_source.json.gz`. Reverting this increment requires restoring the reviewed source and restarting only the ownership-verified practice listener; there is no database rollback. Do not run the full schema-installing SQL suite while the existing M2 preview is active.
