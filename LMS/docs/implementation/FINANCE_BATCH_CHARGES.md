# Reviewed batch charges

7 November 2026. The finance practice administrator can open **Charge several pupils**, select 1–200 active pupils, choose an academic year, enter a fee/instalment description, per-pupil XAF amount and optional due date, and review the full selection and total before confirming. Cashiers cannot review or save batches.

## Behaviour

Review makes no database changes. Confirmation inserts the entire selection in one authorized SERIALIZABLE transaction. A failed insert rolls back every charge. The results page links to each saved charge and clearly states that no payments were recorded.

Selection is explicit; no enrolment or historical year is inferred. Withdrawn, missing or foreign-school pupils cause the batch to fail, not silently shrink. Duplicate identifiers and batches above 200 pupils are rejected. An existing uncancelled charge with the same pupil, academic year and fee description prevents a bulk charge. A different instalment needs its own description. This is a conservative batch safeguard; it is not a new database-wide uniqueness rule for the existing single-charge workflow.

The review is held in the service process under the authenticated session hash. Its random token is bound to that session and school, expires after 15 minutes and is replaced by the session's next successful review. At most 256 pending session reviews are retained, with expired reviews removed during preparation. A restart invalidates pending reviews without affecting saved charges. Only the token and CSRF value are accepted at confirmation; submitted amounts or pupil identifiers cannot replace the reviewed values.

Confirmation rechecks current administrator authority, active pupils, year definitions, pupil identity details and existing charges. A changed selection requires a fresh review. Individual operation identifiers and transactional duplicate checks protect repeated and concurrent confirmations. Successful completion removes the pending review. Returning without saving leaves no charges; the temporary review can remain until replacement or expiry.

## Verification

All 148 isolated tests and all three focused SQL tests passed. The new batch test covers empty/oversized/duplicate selection, foreign school/year identifiers, cashier denial, session binding, immutable reviewed amounts, replay, competing confirmations, replaced reviews, renamed or withdrawn pupils, revocation, actual HTTP review/confirmation, CSRF/origin enforcement and ignored confirmation-field tampering.

The rollback check installs a temporary CHECK constraint restricted to the fixture's second pupil and fee. It verifies SQL error 547 naming that exact constraint and confirms the first insert was rolled back. The initial trigger fixture was discovered to fail before insertion because of SQL Server OUTPUT restrictions; it was replaced before accepting rollback evidence. All temporary constraints/triggers and fixture records were removed. Persistent practice data was preserved.

The ownership-verified practice listener restarted as PID 16108. Live checks passed the administrator review page without confirming it and verified cashier controls remain absent, alongside existing finance reports/statements/exports and other workspaces. Browser inspection reviewed two fictional pupils at 100 XAF each and verified the 200 XAF total. Returning without saving showed no charges. The desktop review layout was inspected; mobile and owner acceptance remain open.

## Handoff and rollback

Implementation is in `model/identity/financeService.js`, `scripts/schoolPractice.js`, `views/practice-finance.ejs` and `views/finance-bulk.ejs`. Focused tests are in `tests/sql/finance-batch.test.js`, included by `npm.cmd run test:finance`. The live check prepares an unconfirmed sample review only.

No new retained database schema, real school charges, payments, accounts or passwords were changed. Production bursar provisioning, fee/opening-balance reconciliation and finance activation remain pending. The preceding checkpoint is `backups/source/1793991614906_source.json.gz`; source rollback and an ownership-verified practice restart invalidate pending reviews while retaining saved records. Do not delete financial rows to roll back the interface.
