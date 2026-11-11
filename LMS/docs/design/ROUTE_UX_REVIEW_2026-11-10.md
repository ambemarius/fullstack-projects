# Route UX review — 10 November 2026

## Delivered fixes

This review extends the [9 November application UI review](APPLICATION_UI_REVIEW_2026-11-09.md) to browser error states, nested administrator navigation and populated finance detail routes. The LMS product-design skill and existing dark-green identity were retained.

1. Browser page requests now receive a styled missing-page, access-denied or server-error screen with a clear return action. Raw exception text and requested URLs are not interpolated into the page. Global errors retain a support reference, and pages are not cached.
2. Original administrator Evaluation controls no longer trigger Registration's event handler. Previously, clicking Report Cards or Course Review cleared the registration selection and stored a registration route; restoring the Evaluation subtab also ran before its listeners existed. The handler is now scoped to Registration, Evaluation stores its own route, and restoration runs after both groups are bound. Stored subtab values are matched against actual buttons rather than interpolated into selectors.
3. Nine Classes-panel controls now have associated visible labels: section, class, stream, class teacher and five fee fields. Existing IDs, values, validation and write locks are unchanged.

## Route coverage and evidence

| Runtime / route | Coverage |
|---|---|
| Original `/`, `/login` | Prior responsive review retained; live login markup and shared assets checked after restart |
| Original `/admin-dashboard` | Navigation handlers tested in isolation and in the browser; Registration → Teacher → Evaluation → Report Cards → refresh stays on Report Cards |
| Administrator Registration subtabs | Pupil, teacher, subject, classes, auxiliary and academic-year layouts reviewed at 320 px; no content overflow; Classes labels corrected and rechecked |
| Administrator Evaluation subtabs | Marks, course review and report cards reviewed at 320 px; no content overflow |
| Original `/teachers`, `/students`, `/subjects`, `/allocations`, `/promotion`, teacher/pupil dashboards and timetable routes | Covered by prior 22-screen responsive review and current rendering regression; no new business behaviour introduced |
| Canonical `/school`, `/registration`, `/academic`, `/auxiliary`, `/invitations`, `/courses`, `/staff-accounts` | Existing layouts retained. Denied page routes now use the common browser error view. Student/teacher/librarian role-denial and allowed teacher-course cases tested without SQL; anonymous sign-in redirects retained |
| Practice `/workspace/finance`, `?charge=…`, `/receipt/:payment` | Existing fictional charge, payment history and receipt inspected in the browser; no payment or correction submitted |
| Practice `/workspace/finance/statements`, `?pupil=…` | Pupil directory → populated statement → charge/receipt links reviewed; totals, context and print/CSV actions remain present |
| Practice `/workspace/cashier`, finance/cashier collections, statements and batch routes | Existing synthetic SQL/HTTP regression coverage passed; cashier/admin boundaries preserved |
| Practice library, laboratory and requests | Prior populated mobile review retained; two-school SQL workflows passed; invalid area now has a browser recovery view |
| Attendance `/` | Prior populated mobile review retained; shared missing-page and asset response checked live |
| Unmatched page routes on 2026, 2027, 2029, 2030 | HTTP 404 plus HTML recovery page verified live on all four servers |
| Missing API routes on all four servers | HTTP 404 with the existing JSON error contract, even with an HTML Accept header |
| Enrolment practice 2028 | Last recorded offline on 9 November. Not restarted, cleaned or reseeded during this UI task; its source layout remains covered by isolated rendering |

The browser fixture catalogue now renders 23 templates, including the new error page. Error variants were inspected at 320 px and desktop width. The actual canonical 404 page's **Return to workspace** link was clicked and verified to return to the existing sign-in screen. Screenshots were inspected through the browser tool; no separate image artifact is claimed.

## Implementation map

- `utils/pageError.js`: explicit HTML page negotiation, safe fixed messages and page-denial rendering.
- `views/page-error.ejs`, `public/css/workspace-ui.css`: common accessible error layout, support reference, green brand and responsive sizing.
- `middlewares/globalErrHandler.js`: HTML only for GET/HEAD non-API requests explicitly preferring HTML. Default fetch clients, JSON-preferring clients, API routes and POST failures retain JSON responses and status codes.
- `scripts/canonicalSchool.js`: replaced only the denied-page response presentation; session resolution, role predicates, feature flags, redirects and API routers are unchanged.
- `scripts/schoolPractice.js`: replaced only unknown-area response presentation; non-browser response remains `Not Found` and HTTP 404.
- `public/js/admin-layout.js`: scoped tab handlers and corrected restoration order; no academic, grading, finance or account operations changed.
- `views/admin-layout.ejs`: nine label `for` attributes added.
- `scripts/uiReviewPreview.js`: explicit subpanel fixtures and optional navigation-only review. Navigation source is extracted from bounded source regions; no authentication, logout, data-loading or write handlers are enabled in this fixture.
- `tests/page-errors.test.js`: response negotiation, error redaction, status preservation and canonical role/redirect boundaries.
- `tests/admin-navigation.test.js`: actual navigation blocks exercised against click and refresh/restoration scenarios.
- `scripts/checkUiRoutes.js` and package command `npm run check:ui`: read-only live checks independent of the stopped enrolment preview. HTTPS certificate verification stays enabled.

## Verification and activation

- Full isolated suite: **161 passed**, zero failures/skips.
- Focused synthetic SQL suite: **3 passed** (finance, reviewed batch charges, library/laboratory; two-school scope and role coverage retained).
- Browser: actual fictional charge, receipt and statement routes; all nine administrator subpanels at 320 px; zero remaining unlabelled visible Classes controls; corrected Evaluation refresh; error layouts and actual canonical missing-page recovery.
- `npm run check:ui`: passed on all four running application servers, including API JSON compatibility, assets, practice finance access denial and canonical registration sign-in redirect.
- Ownership-verifying restart scripts activated the loaded server changes: original PID **55436**, canonical **40436**, inventory/finance practice **11628**, attendance practice **6576**. Runtime policy files and shared legacy write locks were preserved.
- No real-school records, credentials, migration or business rules changed. SQL tests used their isolated synthetic fixtures. No real-school login was performed for this review.

## Remaining acceptance and continuation

Protected real-account populated views still need owner acceptance. This review does not certify full screen-reader support, 200% zoom, all physical devices or printed output. No live error was deliberately triggered by damaging data or changing permissions. Server-error appearance used a database-free fixture; error sanitisation used injected HTTP test routes.

Do not treat the shared error screen as a new entitlement or an activation of deferred modules. JSON APIs remain separate from HTML navigation. An offline process cannot serve a custom error page, so the recorded 2028 preview ownership/recovery issue remains independent of UI work.

Pre-change verified checkpoint: `backups/source/1794326504769_source.json.gz` (454 files; secrets excluded). For rollback, revert only this increment's presentation/response/navigation files and restart through the ownership-verifying scripts; do not restore databases. The final checkpoint is recorded in the handoff.
