# UX bug review — 11 November 2026

Applied the installed lms-product-design skill. Preserved the existing dark-green design, Express/EJS stack, complete registration forms and backend access checks.

## Fixed

- Staff account access denial previously hid management without restoring the invitation/recovery form. It now clears private state and restores account setup.
- An invitation token could be lost when issuance succeeded but the following list refresh failed. The issued token is now displayed first and retained on a recoverable refresh error; access denial still clears it.
- Administrator creation reports a successful save separately from a failed directory refresh, discouraging duplicate creation.
- Validation errors retain the draft, use the error presentation and receive keyboard focus so mobile users see the message.
- Refresh restores the initiating keyboard focus after controls are re-enabled, unless focus has moved to an error.
- Empty staff/token lists now explain their state. Permissions have readable labels, row actions name their staff member, and administrator removal uses destructive-action styling.
- School accounts and original registration now have a main heading.
- The newly added parent login choice is disabled and labelled coming soon while its access model remains unreviewed.

Files: `public/js/canonical-staff-accounts.js`, `views/canonical-staff-accounts.ejs`, `views/m1-original-registration.ejs`, `views/login.ejs`, focused UI tests and the database-free account review fixture.

## Browser evidence

Reviewed the 23 templates in `scripts/uiReviewPreview.js` at 320 px and 1440 px: 46 layout observations, no page-level horizontal overflow and no unnamed visible buttons. Registration's missing main heading was fixed and rechecked at 320 px. Some visual fixtures intentionally reveal normally exclusive login/workspace sections; those do not establish authenticated runtime behaviour.

The account review used the actual updated client against a fictional, database-free service. Verified the local school context, named actions, empty token state, keyboard Refresh focus, visible error focus, retained drafts and local table scrolling on mobile. Confirmed the desktop viewport was 1440 px and mobile was 320 px. No password was entered and no account was created in the browser.

- `page-layout-review-2026-11-11.json`: layout observations.
- `school-accounts-review-2026-11-11.jpg`: mobile validation feedback.
- `school-accounts-desktop-2026-11-11.png`: desktop account layout.

Temporary review tabs were closed, the viewport override reset, and both owned fixture processes stopped.

## Regression and concurrent additions

Final isolated suite: **172 passed, 0 failed**. The focused boundary/application/UI group also passed **14/14**. An initial direct test command could not connect to loopback inside the sandbox; the approved retry passed. Two test-harness omissions were corrected before the final run.

A second agent changed application routes and other files during this review; the owner confirmed that agent was paused. Its additions were preserved. The analytics handler reads aggregate data without a school boundary; parent registration/linking permits a claimed pupil ID without a verified guardian relationship. `middlewares/stagedFeaturesGate.js` now excludes those APIs and the parent dashboard before handlers run. Tests prove the handlers are not reached, and the source-derived inventory was regenerated (116 declarations, 101 legacy APIs). This is containment, not certification or completion of those features. The new parent router accounts for the application inventory increasing from 17 to 18 routers.

## Runtime and limitations

The canonical school workspace was offline and was cold-started through the verified ownership script: port 2027, PID **48160**. The separate school-super-administrator mode remains off; no schema017 commit, credential change or real-school record write was performed by this increment.

The original port2026 process is **18928**, launched with a relative `server.js` command by another actor; its manifest still names PID35696. It was not stopped or silently adopted. Static/template edits can be served on refresh, but the new server-side gate is not certified active in that already-running process. Restart it through a corrected, verified ownership record before treating the new parent/analytics routes as safely excluded there.

The four-server `check:ui` is **not fully passed**: after port2027 recovery it stopped at connection refused on port2029; port2030 was also absent from listener inventory. No practice server was reseeded or started as part of this UX task.

Dedicated screen-reader, zoom, print and real-account acceptance remain. The 23-template review does not cover every authenticated data/error state, the staged parent dashboard or every new edit made by the other agent. The wider subscriber-onboarding implementation remains separate and unfinished; see the school-administration staging record.
