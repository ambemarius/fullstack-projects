# Financial management practice

6 November 2026. Owner requested continued financial management and explicitly chose **XAF with a separate bursar/cashier role**. The workflow is active in the synthetic practice server on HTTPS port 2030. The original administrator Finance tab links to it. This is not a production finance rollout.

## Available workflow

Open `https://localhost:2030/#finance`. Administrator and bursar/cashier have separate practice sessions. An administrator creates a charge for an explicitly selected pupil and academic year, with a fee description, whole-franc amount and optional due date. The cashier can search charges, receive partial payments and open printable receipts. Administrators can also collect payments.

Payment methods are cash, bank transfer, mobile money and other. A transaction reference is required except for cash. This records an already received payment; it does not initiate a transfer. Future payment dates, zero/negative/fractional amounts and payments exceeding the outstanding amount are rejected. Amounts are bounded to 12 digits per entry and use exact integer arithmetic for totals. The search summary shows charged, collected and outstanding values for matching charges. Cancelled charges and reversed entries are excluded from totals.

Receipts use `PAY-{schoolId}-{paymentId}`, show the payment date, recording time and operator, and are visibly marked as fictional practice receipts. Saving a payment redirects to its receipt. Only administrators can reverse a mistaken payment, with a mandatory reason. The original payment remains visible and its receipt is marked reversed. Reversal corrects a ledger entry; it is not a refund. An administrator may cancel a charge only when net collected is zero, also retaining the reason and original charge.

## Implementation and boundaries

- `model/identity/financeService.js`: scoped reads and writes; repeated session, account, school, membership and role validation within SERIALIZABLE transactions. Per-charge update locks serialize payment, reversal and cancellation decisions. Unique operation identifiers reject duplicate charge/payment submissions. Reversal and cancellation keys reject repeated corrections.
- `docs/implementation/staged/016_financial_management.sql`: four new financial ledger tables with school-qualified foreign keys and actor references. The staged expansion adds `bursar` to the membership role constraint. Applied migrations 001–009 were not edited.
- `scripts/financeSample.js`: refuses databases without the approved synthetic marker, installs the staged schema under an application lock, verifies its checksum and provisions only dedicated fictional administrator/bursar accounts in the specified sample school. It does not enable finance roles or invitations in the live school.
- `scripts/schoolPractice.js`: mounts finance and cashier pages, charge details, payment actions and receipt reads only in the loopback practice runtime. Forms use session-bound CSRF and exact-origin enforcement. Separate role cookies are secure, HttpOnly and SameSite Strict. EJS escapes displayed text. Cashier restrictions are enforced in the service, not just by hidden controls.
- Views `practice-finance`, `finance-charge`, `finance-receipt` and the original Finance tab provide navigation. Receipt styling and the print control are local assets.

The original `student_fees` amount/paid flags are not imported or treated as a reliable transaction history. No real balances, school records or passwords changed. No agent-created financial transactions were left in the persistent practice school; users can create their own examples there.

## Verification and activation

All **148 isolated tests** passed. `npm.cmd run test:finance` passed both focused synthetic SQL tests: the new finance workflow and existing inventory workflows. Finance tests cover two schools; foreign pupils, years, charges and receipts; role and revoked-membership denial; partial payments; concurrent overpayment attempts; idempotency; exact large values; mandatory references; invalid dates/amounts; reversal/cancellation history and totals; escaped HTML; real HTTP origin/CSRF enforcement; and payment-to-receipt redirects.

An initial staged-DDL syntax error was corrected before installation. The test cleanup was made resilient to an absent finance schema. Successful fixtures were removed after verification; the initial failed fixture was separately identified and removed under exact school/account guards. The persistent practice school and other active previews were retained.

The ownership-checked practice restart activated PID **13308** on port 2030. The first immediate probe preceded listener readiness; the subsequent `npm.cmd run check:practice` passed finance administrator/cashier pages, all inventory pages, attendance, enrolment practice and both school runtimes. The original administrator dashboard served the new finance link without a restart. Browser inspection confirmed the administrator charge form and the separate cashier page with no charge-creation controls. The live browser's local certificate required no new acceptance. Full production or print-dialog acceptance is not claimed.

## Remaining production work

Collection reports by date/method/cashier, printing and CSV export were subsequently delivered in practice. See [collection report evidence](FINANCE_COLLECTION_REPORTS.md). This does not change the production rollout gates below.

1. Integrate the bursar role into reviewed live staff provisioning, invitations, recovery and role-aware navigation. The production identity schema has not been expanded.
2. Agree fee schedules, opening balances, existing-payment reconciliation and charge eligibility before creating real ledger entries. Do not infer paid amounts from legacy checkboxes.
3. Add school-approved adjustments, waivers/refunds, collection period reports and payment reconciliation. These are separate workflows, not implied by ledger reversals.
4. Review migration 016 and production role expansion, recovery/rollback evidence and school acceptance before live activation.

For rollback, restore the preceding source checkpoint `backups/source/1793962577172_source.json.gz` using the existing reviewed restoration process and restart only the verified practice listener. Retain the synthetic finance tables, records and role expansion for review; do not drop records to roll back the UI. The original financial records are untouched. Never run the full schema-installing SQL suite while the active M2 preview owns its synthetic schema.
