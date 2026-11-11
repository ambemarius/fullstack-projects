# Application UI review — 9 November 2026

## Outcome

The dark-green School Hub design now extends across the existing application: sign-in, registration, staff access, academic tools, original record screens, attendance, library and laboratory. Finance retains its reviewed layout and now uses the same green palette. This is a presentation release, not activation of deferred academic or financial capabilities.

The work began on 8 November and was completed with the owner's continuation on 9 November. The `lms-product-design` skill was applied. Express/EJS, CSS and vanilla JavaScript remain the stack; no package was added. No application controller, service, route, migration, authentication client, database schema, school record or password was changed.

## Audit and corrections

| Finding | Correction |
|---|---|
| Separate blue, navy and green visual systems | Shared green tokens, restrained typography, common cards, controls, focus and table styles; Finance palette aligned |
| Oversized headings and decorative school-photo placeholder | Compact page hierarchy and removal of the empty photo card |
| Inconsistent original administrator sidebar | Existing local SVG icons reused; consistent active, hover and focus states |
| Academic and auxiliary sidebars disappeared on phones without a menu control | Compact wrapping navigation on these two pages; original registration keeps its working drawer |
| Canonical course handoff was outside the administrator content column | Notice moved inside the content column without changing its condition or destination |
| Blank Save/Delete icon buttons depended on unavailable icon fonts | Plain text action labels, preserving IDs and button types |
| Search fields, fee controls and older assignment/mark selectors lacked accessible names | Associated search labels, fee-specific accessible names and persistent selector labels |
| Teacher list headings did not match the eight rendered cells | Corrected to ID, first name, last name, email, phone, section, type and status |
| Record tables occupied narrow columns | Full-width pupil/teacher directory rows, responsive form groups and focusable horizontal table regions |
| Table actions and library damage/loss looked like primary actions | Neutral secondary styling and distinct destructive outlines |
| Account forms had excessive line length/unused panel width | Bounded account-page width and consistent form alignment |
| Initial dashboard counts implied a known zero | Em dash until the existing data loader returns actual figures |
| Landing page contained placeholder contacts and unverified claims | Task-based landing page with genuine application destinations and administrator support guidance |
| Sample sign-in mentioned a school name that did not match the running fixture | Generic, accurate membership-based guidance |

## File and dependency map

- New shared assets: `public/css/workspace-ui.css`, `public/js/workspace-ui.js`, `views/partials/workspace-assets.ejs`, `views/partials/workspace-wayfinding.ejs`.
- Shared original header: `views/partials/header.ejs`. This updates the old teacher/pupil dashboards, subject/allocation/promotion screens and timetable pages without replacing their clients.
- Original dashboard and forms: `views/admin-layout.ejs`, `views/m1-original-registration.ejs`, both `views/partials/canonical-*-registration.ejs` files, `views/teachers.ejs`, `views/students.ejs`, `views/teacher-dashboard.ejs`, `views/allocations.ejs`.
- Public and canonical pages: `views/landing.ejs`, `views/login.ejs`, `views/m1-preview.ejs`, `views/canonical-school.ejs`, `views/canonical-academic.ejs`, `views/canonical-auxiliary.ejs`, `views/canonical-courses.ejs`, `views/canonical-invitations.ejs`, `views/canonical-staff-accounts.ejs`.
- Practice: `views/attendance.ejs`, `views/practice-inventory.ejs`, `views/inventory-error.ejs`.
- Finance: `public/css/finance-workspace.css` only. Existing finance templates, submission handlers and dedicated print stylesheet retained.
- Review tooling: `scripts/uiReviewPreview.js`, `tests/ui-review.test.js`. The loopback-only visual fixture app uses source templates, strips business scripts, exposes no APIs or POST routes, and shows an explicit fictional-layout banner. It is not mounted in any school runtime.

The presentation script adds a skip link, labelled keyboard-scrollable table regions (including asynchronously inserted tables), drawer expanded state and Escape/focus return. It does not read credentials, grant permissions, fetch data or submit forms. Existing hidden states remain hidden. Existing server-side role and school checks remain authoritative.

## Page coverage

| Pages/templates | Review performed |
|---|---|
| Landing, original login | Isolated layouts plus actual original application browser review |
| Original administrator dashboard | Home fixture plus evaluation-tab visual review; original behaviour hooks retained |
| Original-style canonical registration | Both form layouts; actual synthetic sign-in, pupil/teacher tabs, dynamic tables and mobile drawer/Escape check on 8 November |
| Canonical school sign-in/workspace | Fixture layout and actual unauthenticated redirect/sign-in view |
| Academic setup, auxiliary staff | Desktop/mobile fixtures, including visible compact mobile navigation |
| Courses, invitations, staff accounts | Desktop/mobile fixtures; actual synthetic academic workspace reviewed on 8 November; real protected submissions not attempted |
| M1/M2 sample landing | Fixture and actual sample sign-in on 8 November |
| Teachers, pupils, subjects, allocations | Desktop/mobile fixtures; teacher form also checked at tablet width; fields and table layouts reviewed |
| Timetable management, teacher timetable, pupil timetable | Desktop/mobile fixtures; standalone print template retained |
| Teacher dashboard, pupil dashboard, promotion | Source and desktop/mobile fixture review; retained business restrictions remain in force |
| Attendance | Actual sample register, dated class control and populated pupil cards at mobile width |
| Library, laboratory, teacher laboratory requests | Actual fictional role launch, catalogue/stock/request layouts and navigation at mobile width |
| Finance overview, charge, receipt, collections, statements, batch review | Shared palette update; actual overview/mobile and collections/desktop browser checks; existing workflow/role/CSV checks and synthetic SQL suite |
| Inventory/finance error views | Template review, accessible error message and recovery action; no deliberate real-data failure induced |
| School Hub and personal timetable print | Previously reviewed layouts retained; no redesign of these templates in this increment |

All 22 allowlisted fixture pages were measured in the browser at 320 × 800 and 1440 × 1000: no document-width overflow or overflowing administrator content containers. Representative screenshots were inspected in the tool output. Wide data tables intentionally scroll within their own labelled regions. The teacher directory was also inspected at 768 px; actual registration, attendance and inventory at 390 px. Fee controls were rechecked after adding labels: no visible unlabelled control remained in the registration fixture.

Fixtures deliberately disable application scripts and reveal selected layout branches. Their all-role navigation, blank/loading records and unavailable runtime actions are not evidence of an authorization failure or successful live transaction. Real-world long-data and authenticated owner acceptance still matter.

## Verification

- Final `npm.cmd test`: **156 passed**, zero failed/skipped (9 November). Includes 22-page rendering and rejection of fixture API/POST requests.
- `npm.cmd run test:finance`: **3 passed** (8 November), covering finance, reviewed batch charges and inventory against isolated synthetic schools. Later edits changed only presentation and labels.
- Source comparison against pre-change checkpoint: no lost `id`, `name`, `data-kind`, `data-tab`, `data-sub`, `data-fee`, `action` or `method` hooks in modified EJS templates. Landing page intentionally replaced; its section anchors were retained.
- `node scripts/checkCanonicalSchool.js`: passed on 8 and 9 November, including verified TLS, real-school shell, no sample/legacy bypass and rejection of unauthorized writes/invalid credentials. No real password used.
- `npm.cmd run check:practice`: full pass on 8 November. On 9 November all preceding inventory/finance role pages, reports, statements, CSV/batch-review and attendance checks passed, then the check stopped at **ECONNREFUSED on 2028**. Canonical was independently rechecked; original landing was observed in the browser.
- No application runtime restart was required for the EJS/static asset changes. The database-free review server was temporary.

## Outstanding items and boundaries

1. **Enrolment practice is offline as of the final check.** Its ownership manifest still exists at `backups/runtime/m2-registration-preview-owned.json`. Do not blindly rerun or delete it: the existing preview script requires a reviewed ownership/cleanup process and touches synthetic staged schemas. No cleanup, schema reset or fresh sample seeding was performed for this UI release.
2. Real signed-in owner acceptance remains for protected school workflows, including large directories, invitation success/recovery and role-specific academic data. No real credentials were entered or changed and no school records were created to exercise styling.
3. Full screen-reader, 200% zoom, physical-device and printed-output acceptance remain. Focus/labels/responsive checks do not constitute WCAG certification. Dedicated financial and timetable print rules were retained.
4. The original application still has some legacy labels and legacy-only tools. This visual work does not reopen paused APIs, approve grading rules, reconcile historical placements or activate practice finance/inventory against real data.
5. The source checkout's existing Git metadata could not resolve its parent directory during `git status`; it was not repaired during this UI task. Use the verified secret-excluding source checkpoints for this increment until Git is repaired separately.

## Rollback and continuation

Pre-change source checkpoint: `backups/source/1794114474486_source.json.gz` (447 files; private environments excluded). Roll back only the reviewed UI files from this snapshot and remove their new includes/assets as a coherent change. Do not restore the database or overwrite unrelated subsequent implementation work. A final checkpoint is recorded at the top of `AGENT_HANDOFF.md`.

For future visual review, run `node scripts/uiReviewPreview.js` and use its catalogue on loopback port 2031. Stop the owned process after review. Use actual synthetic role workspaces for behavioural checks; never mistake fixture controls for active application workflows.
