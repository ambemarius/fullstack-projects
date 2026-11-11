# Dated pupil withdrawal and return

4 November 2026. The M2 preview supports withdrawal and readmission for a verified pupil with a recorded placement. LYCEE BATOURI continues to run the M1 workflows.

## Administrator workflow

Open Registration, select a pupil's History, and choose **Record withdrawal**. Enter the effective date, source reference and reason. The withdrawal date is the first day outside the old placement. On commit the pupil loses access at this school immediately. Existing historical marks remain available under their original placement.

For readmission choose **Record return**, select the verified class in the current academic year, and review the active subjects displayed for that class. When subjects exist the administrator explicitly confirms the list. The server checks their identifiers and versions again inside the transaction. A changed list requires fresh review. Return starts a separate enrolment period. The gap between departure and readmission is visible in dated rosters. A pupil signs in afresh with the existing password.

## Identity and transaction rules

The administrator must have a current school session. The pupil must have a verified mapping to an active account, a matching credential hash, a pupil-only local membership and an explicit year membership for the source placement. The workflow requires both the reviewed ledger revision and the current pupil profile version. Unexplained legacy history, privileged memberships, independent account restrictions or mismatched projections are referred for review.

The ledger revision, pupil status, current placement, local membership, affected sessions and audit share one serializable transaction. Withdrawal retains the last class/year on the withdrawn profile and closes the ledger period. Return checks the recorded withdrawal, opens a new period, retains earlier year memberships and writes the destination year link as needed. The destination subject review uses the same school lock as subject enrolment. The operation preserves subject rows and marks.

In the ledger-enabled preview, subject enrolment and raw-score writes require one authoritative placement covering today in the school's time zone. Its latest revision must match the offering's class and academic year. Missing, conflicting, closed or mismatched placement evidence blocks the write. A mixed score batch rolls back if any pupil fails the check. Historical sheets retain access to their recorded marks.

Staged migration 011 adds a SQL Server row version to school memberships and an append-only receipt for each withdrawal. The receipt identifies the membership, account, account security version and stamp produced by the revocation. A later membership update, even a repeated revocation, changes its stamp and blocks automatic reactivation. A current profile edit uses its own profile version and cannot manufacture this receipt.

Canonical withdrawal revokes sessions tied to the affected membership. An active session at another school keeps its original scope. With the lifecycle enabled, legacy pupil token verification includes the number of immutable withdrawal receipts for that verified membership in addition to the account credential version. Original sign-in, role middleware and scoped self-profile reads use this check. After return, an old token remains invalid. Other memberships and the global account version retain their existing values.

## Verification and release gates

The guarded SQL test rehearses and rolls back staged 010 and 011, then exercises class/date boundaries, actual HTTP session/CSRF/role checks, two-school isolation, independent revocation, original and canonical sign-in, course review, concurrency and audit-failure rollback. It cleans its own schema and fixtures and compares baseline counts, schema absence and migration checksums. Automated frontend coverage includes the request contents, course confirmation, draft clearing, stale school responses and conditional form rendering. See TEST_RESULTS.md for final results.

Run the temporary synthetic preview with `node scripts/m2RegistrationPreview.js`. The mapped fictional pupil **Sample Lifecycle** can exercise both actions. Enter `finish` at its terminal to clean up. The preview uses the dedicated HTTPS port 2028. Visual acceptance is pending at the previously observed browser certificate gate.

Production activation requires reviewed migrations 010 and 011, coordinated launch of legacy pupil token checks and canonical lifecycle routes, and verification of the existing shared write locks. Once a real withdrawal has occurred, rolling back the writer must retain receipt-based token checks. Switching back to the earlier token verifier could revive an old token after readmission. Before live deployment rehearse that rollback with the original JWT lifetime, ongoing session revocation and schema retention. M2 still includes year-specific offerings and teaching history, historical reconciliation, coverage review for existing course links, and release review.
