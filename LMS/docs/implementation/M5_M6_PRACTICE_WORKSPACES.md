# Library and laboratory practice workspaces

6 November 2026. The owner requested access to features for gradual testing and correction. The feature menu runs at https://localhost:2030 and opens both new inventory modules using fictional records. It also links to attendance on 2029, enrolment practice on 2028, canonical school tools on 2027 and the original application on 2026.

## Library

The librarian can add individually accessioned copies with title, author, shelf and optional ISBN. Each copy can be lent to an eligible pupil or staff member of the same school. Checkout takes an explicit due date. Renewal requires a later date. Returns, loss, damage and restoration to circulation append a history event. The page shows overdue loans and recent circulation.

Copy versions protect against acting on an older loan after another librarian returned and reissued that copy. Each form has a unique operation identifier, so repeating a submitted form fails safely. Transactional scope and locking protect concurrent checkouts.

## Laboratory

The attendant can add equipment, consumables and reagent batches with units, location, minimum stock and optional expiry or restriction. Stock receipts add movements to the ledger. Teachers see eligible stock and create requests for a quantity, date and lesson purpose. Their request list is limited to their own membership.

The attendant approves or declines requests, then explicitly issues approved quantities. The available balance cannot be overdrawn. Whole units are required for equipment. A usable return restores its issued quantity. Damage and consumption close the issued request while retaining the stock reduction. Expired and restricted items cannot be requested or issued. Low balances and expiry appear on the stock cards.

## Verification and operations

All 148 isolated tests passed. The focused SQL test in `tests/sql/inventory-workflows.test.js` uses two synthetic schools and checks duplicate titles with independent copies, foreign borrowers, concurrent checkout, renew/return, stale copy versions, damage/repair, stock receipts, duplicate submissions, concurrent issues, usable and damaged returns, fractional equipment denial, expiry, restricted visibility, teacher permissions and CSRF. Actual HTTP pages rendered for librarian, attendant and teacher. Fixture records were cleaned after the test.

The practice launcher verifies the synthetic database marker and checks the staged schema fingerprint before provisioning. Its separate role cookies allow teacher and attendant tabs to be used together. The server binds to loopback and uses the existing local certificate. Sample records persist in SQL across restarts. The running release passed `node scripts/checkSchoolPractice.js`, including reachability of the existing school and practice servers.

Run `node scripts/schoolPractice.js` to start the menu on a vacant port 2030. Stop its verified owned process to withdraw the preview. The new tables are installed only in the marked synthetic database from staged file 015. The production migration list has no inventory schema activation.

## Remaining work

School-configured lending limits, renewal limits, stocktake, write-off, partial lab returns, reconciliation, requisition approvals, dedicated borrower self-service and production rollout remain open. This increment uses explicitly entered due dates and school-local calendar dates for the Cameroon practice environment. Restricted stock remains unavailable for issue until a reviewed permission workflow is implemented.

Attendance justification approvals and roster creation from dated enrolments remain open. Report grading and promotion await the school's grading rules. The feature menu gives access to the existing report screen through the administrator dashboard. M4–M6 acceptance remains in progress.
