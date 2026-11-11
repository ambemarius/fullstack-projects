# Form feedback and mobile navigation — 10 November 2026

Applied the installed lms-product-design skill to the existing shared Express/EJS interface. This increment builds on the application-wide and route reviews; it does not represent new acceptance of every business workflow.

## Delivered

- Shared native form validation now leaves persistent field guidance and a linked error summary. Correcting an input removes its error; resetting removes feedback and retains existing accessibility descriptions. Native constraints and submission handling remain in control.
- Existing administrator/registration mobile drawers have a visible Close navigation button and a dimmed, clickable backdrop. Focus moves into the drawer, Tab/Shift+Tab remain within it, Escape/Close/outside click dismiss it and restore the trigger. Resizing to desktop restores page interaction and a visible navigation focus target.
- Existing green brand, original full forms, field IDs, routes and server permissions remain intact. The enhancement does not read input values, send requests or store drafts. Finance retains its existing submission/error workflow.

## Files

`public/js/form-feedback.js`, `views/partials/workspace-assets.ejs`, `public/js/workspace-ui.js`, `public/css/workspace-ui.css`; database-free fixture support in `scripts/uiReviewPreview.js`; regression coverage in `tests/form-feedback.test.js`; read-only asset checks in `scripts/checkUiRoutes.js`.

## Verification

- `npm.cmd test`: 165 passed, zero failures/skips. Four new behavioural tests cover linked errors without cancelling native validation or reading values; correction; reset; and removed/disabled fields.
- Browser: teacher form empty submit produced three errors with native focus. Correcting first/last name and email removed their messages and summary; no valid submission was made. Clicking the email summary link focused that field.
- Browser: canonical original teacher registration produced six required-field messages at 320 px with no page overflow. Desktop Subjects at 1440 px displayed a two-field summary, persistent inline messages and red borders without overflow.
- Browser: administrator drawer checked at 390 px. Close, outside click and Escape restore the trigger; Shift+Tab/Tab wrap between first/last controls; background is unavailable while open. Resizing an open drawer to 1440 px restores background access and focuses Home; no overflow.
- `npm.cmd run check:ui`: four running applications serve updated shared assets and retain browser/API error and sign-in boundaries. No restart needed for these template/static asset changes.
- No SQL suite rerun: this increment changes no backend/data paths or policy. Earlier SQL evidence is retained separately, not represented as new testing.

Visual evidence: [Desktop errors](form-feedback-desktop-2026-11-10.jpg), [Mobile drawer](mobile-navigation-2026-11-10.jpg). These are clearly labelled database-free fixtures; their data loaders and save operations are disabled. Temporary review server stopped and viewport reset after review.

## Limits and rollback

Real signed-in submissions, dedicated screen-reader testing, print and zoom acceptance remain separate. Browser-native validation wording follows the browser locale. Server error/success messages remain owned by each existing business client; this enhancement does not invent new messages or retry mutations. Closed mobile navigation and real role-filtered links still use existing application behaviour.

Pre-change source checkpoint: `backups/source/1794332989043_source.json.gz` (460 files). Roll back only the listed UI files from that checkpoint if necessary; do not restore a database or revert unrelated changes. Final checkpoint location is recorded in AGENT_HANDOFF.md. No schema, real records, passwords, process ownership or write locks changed.
