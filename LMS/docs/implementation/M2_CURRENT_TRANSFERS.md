# M2 current pupil transfers

4 November 2026. The administrator transfer workflow is staged for the disposable two-school preview. The live M1 applications do not enable it. This is an internal change of class or academic year within one school, not a transfer of school membership, a promotion decision, or a historical data import.

## What an administrator can do

Open a pupil's History in the transfer-enabled registration screen. When one recorded enrolment is open and a suitable destination exists, expand **Record a class or year transfer**. Choose a class in the pupil's section, supply the effective date, source reference and reason, and submit. The destination year is the school's current academic year. Missing ledger history cannot initiate a transfer. If the pupil or ledger changed, reopen History and review the fresh versions.

The old class includes dates strictly before the transfer date; the new class starts on that date. Earlier revisions remain visible. The pupil's current class/year changes and their previous year membership remains. Moving within one year does not duplicate its membership. No fee, course enrolment, mark, account role, password or school membership is created or changed by the transfer. An existing active destination course link requires separate review because moving back could silently re-enable mark editing. A destination subject with no such link can be assigned separately after transfer. Subject links still describe year/subject membership, not dated subject attendance.

## Implementation and rollback

- `model/identity/enrolmentLedgerService.js`: both the source ledger revision and pupil profile version must match. A SERIALIZABLE transaction uses the existing school academic-links lock before the per-pupil ledger lock. It checks the school/admin authority, pupil projection, source year junction, destination class/section/current year and active destination subject links. It rejects a future effective date in the school's time zone, withdrawn pupils and unexplained differences. Source closure, destination opening, current projection, year junction and final audit commit together with one operation ID.
- `routes/identity/pupilPlacementRouter.js`: a dedicated POST-only operation; current canonical administrator session, exact Origin/CSRF, no-store, strict input/route scope. It exposes no independent ledger creation or revision endpoint.
- `views/m1-original-registration.ejs` and `public/js/m1-original-registration.js`: separate form beside the history table, filtered destination choices, success refresh, conflict handling and school-context draft clearing. The preserved original teacher/pupil form partials were not edited. The temporary preview opts in through `scripts/m1Preview.js` and `scripts/m2RegistrationPreview.js`; the live application has no mount or template opt-in.
- No schema edits, migration promotion, real pupil transfers or historical backfill. Rollback before activation: keep the current-transfer option off. Do not delete historical ledger rows or disable M1 write locks.

## Verification and limits

The two-school SQL/HTTP test exercises same-year and year-changing transfers; prior/current rosters at the date boundary; foreign schools, wrong roles, missing CSRF, stale versions, withdrawn pupils, projection drift, missing year evidence, section and current-year mismatches. Concurrent submissions produce one winner. An injected failure on the final audit rolls back both ledger revisions, projection and the new year junction. Original marks remain readable and cannot be rewritten through the old class. Account/credential, fee and original subject/score records are compared without disclosing them. The test removes only its disposable fixtures and staged tables, and checks count/checksum baselines.

Isolated frontend tests verify destination filtering, the versioned request, refusal to retry a conflict, post-success refresh, stale school response handling, and opt-in-only template/route rendering. Full suite counts are in TEST_RESULTS.md. Browser visual verification of the new form is **pending**: the in-app browser refused the preview's localhost certificate before rendering. No warning was bypassed; the preview exited cleanly and removed its synthetic data.

The real 2026/2027 listeners were offline before the smoke check. The cold-start helper verified the ports were vacant and the new process owned each listener before updating runtime metadata. No process was killed. Original port2026 PID32064 and canonical port2027 PID11208 passed the pinned M1 health check with no real password. Check runtime metadata again before future operations.

Next: dated withdrawal and return with membership/session effects, authoritative placement checks for course workflows, year-specific offerings/teaching history, and browser/activation review. Staged010 stays outside migration discovery. M2 remains open.
