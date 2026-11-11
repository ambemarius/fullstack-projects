# School Feature Hub redesign — 7 November 2026

## Outcome and entry points

The School Feature Menu now uses a responsive dark-green LMS shell with grouped navigation, a compact school/account header, consistent local SVG icons, module cards and compact record tiles. No framework, external font or icon dependency was added.

- Practice launcher: https://localhost:2030/
- Authenticated school dashboard: https://localhost:2027/school
- Existing canonical sign-in remains at https://localhost:2027/. Its signed-in view links to the dashboard; `next=school` returns there after sign-in.

The requested reference image was not present in the conversation. The implementation follows the written requirements and the lms-product-design skill, with the owner's dark-green brand overriding its default navy suggestion.

## Audit and dependencies

The original hub was `views/school-practice.ejs`, rendered by public GET `/` in `scripts/schoolPractice.js`. It used shared `public/css/practice.css`, no client script, and a single `financeAvailable` view flag. It was a public synthetic launcher, not a signed-in school dashboard. Its LYCEE BATOURI heading therefore did not establish an active real-school identity.

Practice POST `/open/:area` creates or reuses the designated synthetic account session. Inventory and finance services independently enforce roles, CSRF and school boundaries. Attendance and academic-history practice run on separate origins. The real canonical server in `scripts/canonicalSchool.js` uses guarded identity resolution, secure session cookies, runtime feature flags and scoped service APIs. Original reports/timetables remain on the separate original application. These boundaries are retained.

Shared inventory CSS was intentionally left intact. The new stylesheet is used only by the hub template. Original teacher/pupil registration forms and all module business logic are unchanged.

## Files changed

| File | Purpose |
|---|---|
| `views/school-practice.ejs` | Shared practice/live dashboard template, semantic sections, card actions, account disclosure and mobile dialog |
| `views/partials/hub-nav.ejs` | Reused desktop/mobile grouped navigation |
| `views/partials/hub-icon.ejs` | Local, decorative stroke SVG icons with text labels |
| `public/css/school-hub.css` | Scoped green design tokens, responsive grids, compact one-module layout, hover/focus/touch styles |
| `public/js/school-hub.js` | Progressive mobile dialog, focus return/section landing, account Escape dismissal, history-cache refresh |
| `utils/schoolHub.js` | Server-side navigation model filtered by verified roles and enabled features; separate public practice model |
| `model/identity/schoolHubService.js` | Read-only school/current-year lookup bound to an authenticated account, membership, session and school |
| `scripts/schoolPractice.js` | Supplies the explicit practice model; existing launch routes remain unchanged |
| `scripts/canonicalSchool.js` | Adds authenticated GET `/school`, redirecting anonymous callers to sign-in |
| `views/canonical-school.ejs`, `public/js/canonical-school.js` | Existing-session dashboard link and fixed post-login destination |
| `tests/school-hub.test.js` | Role/feature filtering, missing/ambiguous year, HTML escaping, caller scope rejection, anonymous/duplicate cookie handling and revocation/switch cases |
| `tests/sql/inventory-workflows.test.js` | Adds two-school dashboard context/revocation verification to existing disposable synthetic fixtures |
| `scripts/checkCanonicalSchool.js` | Live anonymous dashboard redirect and asset checks |

## Access and context behaviour

The public practice launcher shows enabled sample-role entry points. It explicitly says **Practice visitor** and **Academic year varies by workspace**. It neither consumes a canonical school cookie nor claims to be the signed-in user of any module. Practice roles remain separate, predefined fictional accounts. Actual module access still passes the original backend service checks.

School record tiles appear only on the authenticated dashboard. All eight former destinations are retained there, subject to role and enabled-feature flags. Administrators get People, Academics and Administration groups. Teachers get Courses and invitation acceptance. Pupils get Courses. Auxiliary roles see only their relevant practice module; a role without enabled record tools receives an explicit empty state. Platform privileges alone do not create a school dashboard context. The original application may require its own sign-in.

School name comes from `dbo.schools` for the active session's school. Academic year comes only from that school's `academic_years.isCurrent=1` records. Missing or multiple current years are labelled explicitly; the application does not infer a year from the date or select the first available year. Both SQL reads contain the existing session/account/membership/school authority predicate, and identity is rechecked before rendering. Caller school/role query values are ignored. Names are EJS-escaped. Page responses remain `no-store` with the existing CSP.

The four operational modules remain practice features. This UI release does not activate production finance, library, laboratory or attendance. No schema, grading, enrolment, credential, live-school record, runtime security flag or legacy write-lock changes were made.

## Verification performed

- Full isolated regression suite: **155 passed, 0 failed, 0 skipped**.
- Focused SQL suite `npm.cmd run test:finance`: **3 passed**, exercising batch finance, cashier/admin boundaries, inventory workflows and the added two-school hub context checks. Only disposable synthetic fixtures were changed and cleaned up.
- Live `npm.cmd run check:practice`: passed pinned HTTPS, existing practice launch/session paths, finance reports/statements and other workspace reachability.
- Live `node scripts/checkCanonicalSchool.js`: passed anonymous dashboard redirect/assets, retained security checks and exclusion of old APIs. No real password used.
- Verified process ownership before restarting: practice inventory PID **39356**, canonical PID **15052**. Original runtime preserved. Current runtime metadata remains authoritative if restarted later.
- Browser: actual practice hub inspected at **1440, 1024, 768, 390 and 320 CSS pixels**. DOM measurements showed no page-width overflow. Screenshots inspected in the tool at desktop/tablet/mobile widths.
- Browser: mobile drawer open, Escape, focus return to Menu, section navigation with focus landing, and account disclosure/Escape tested. Visible keyboard focus observed. Native dialog contains modal focus; a native details-based fallback is supplied for unenhanced navigation.
- Calculated contrast for the main token pairs: body text on white 13.96:1; muted text on canvas 5.56:1; white on primary green 9.90:1; sidebar text 11.13:1; practice badge 6.44:1; live badge 7.56:1; focus outline on white 4.57:1. These checks do not constitute a full accessibility audit.
- Browser: Library and bursar/cashier launch buttons opened their existing workflows; their return links reopened the hub. The live-school action correctly reached `/?next=school` because this browser had no active canonical session. No real credentials were entered.
- Browser: administrator grouped record tiles, teacher and pupil branches inspected using a temporary database-free visual fixture on loopback 2031. Administrator tiles inspected on desktop and mobile. Fixture roles are **visual test data**, not evidence of live authentication; actual authority is covered by isolated HTTP and SQL tests. The helper was stopped and removed after inspection.

The first sandboxed visual fixture could not be reached by the browser. It was stopped, rerun with the normal approved network permission, checked for HTTP 200, and successfully inspected in a fresh tab. No browser certificate warning or security control was bypassed. The errored temporary tab is not a deliverable.

## Limits and follow-up

The owner's real authenticated dashboard/sign-out journey remains a manual acceptance check. The same template's role branches were browser-tested with fixtures, and its real route/context were tested automatically. Screen-reader behaviour, actual 200% browser zoom and JavaScript-disabled rendering were not exhaustively verified; 320px reflow, keyboard interaction and source fallback were checked. This is not a claim of full WCAG conformance.

Other module interiors retain their existing appearance, including the previously delivered navy Finance workspace. This task redesigns the hub, not the full application. No new school selector is shown because extra real-school onboarding remains gated. Future modules must add navigation through server-side capabilities and keep their own backend authorisation.

## Rollback and checkpoints

Rollback is source-only: restore the changed templates/assets and two hub route integrations from the pre-task checkpoint `backups/source/1794062435304_source.json.gz`, then use the verified runtime restart scripts. Review file-level differences first to preserve unrelated later work. No database rollback is required. An intermediate verified checkpoint is `backups/source/1794069358966_source.json.gz`; the completed implementation checkpoint is `backups/source/1794069991898_source.json.gz` (447 files, secret-excluding). The final documentation pointer and contrast evidence were recorded afterwards.
