# UI audit

Review: 25 October 2026. **Static inspection only**. No server, browser session, screenshot, screen-reader run or measured contrast audit was performed. Layout and mobile risks below are source-supported; rendered defects require authorised test-environment confirmation. Palette and visual identity must be preserved.

## Page inventory

| URL | Template / script | Current role/workflow |
|---|---|---|
| / | landing.ejs | Public school landing |
| /login | login.ejs / auth.js | Role selector; admin/teacher email or student matricule |
| /admin-dashboard | admin-layout.ejs / admin-layout.js, location-picker.js | Home, Registration, Finance, Evaluation, Personnel |
| /teacher-dashboard | teacher-dashboard.ejs / teacher-dashboard.js | Profile, teaching subjects/students, marks |
| /student-dashboard | student-dashboard.ejs / student-dashboard.js | Profile; not an exam/report dashboard |
| /teachers | teachers.ejs / teachers.js | Separate admin teacher management/assignment |
| /students | students.ejs / students.js | Separate admin student management |
| /subjects | subjects.ejs / subjects.js | Separate subject management |
| /allocations | allocations.ejs / allocations.js | Admin class/year allocation |
| /timetable | timetable.ejs / timetable.js | Admin manual/generation/grid |
| /timetable-teacher | timetable-teacher.ejs / timetable.js | Teacher self grid |
| /timetable-student | timetable-student.ejs / timetable.js | Student self grid |
| /promotion | promotion.ejs / promotion.js | Admin class promotion |

13 page templates plus partials/header.ejs and partials/footer.ejs = 15 EJS templates. CSS is shared at public/css/style.css. description/description.htm is a design reference, not a served route. No school platform, discipline, librarian or lab attendant screen exists yet.

## Preserve these elements

`public/css/style.css:1` defines primary blue #2563eb, dark blue #1d4ed8, pale background #f1f5f9, text #0f172a, muted #64748b, border #e2e8f0, danger #dc2626 and success #16a34a. Keep palette, card/form styling and general identity. Admin sidebar currently hardcodes LYCEE BATOURI (`views/admin-layout.ejs:12`); future school branding must use verified school context rather than a universal name. Confirm branding policy before replacing text/assets.

Responsive work already exists: marks controls at 600px, form grids at 768px/480px, sidebar off-canvas at 768px, print rules at the end of CSS. Do not describe the project as wholly unresponsive. Validate these rules rather than replacing all styles.

## Findings and proposed repairs

| ID | Source evidence | Observation / limitation | Proposed acceptance |
|---|---|---|---|
| U01 | admin-layout.ejs:42; admin-layout.js menuToggle binding | Hamburger button has no explicit accessible name/expanded-controls relationship; mobile sidebar toggle needs keyboard/focus assessment | Label button, aria-expanded/controls, Escape dismissal, focus restoration; no keyboard trap at 320px |
| U02 | admin-layout.ejs:18–31 and registration subtabs | Visual tab buttons/panels lack explicit tab semantics/selection relationships | Choose accessible tab or disclosure/navigation pattern; keyboard behaviour and selected state tested |
| U03 | teacher-dashboard.ejs:31–32 | Marks subject/term selects lack associated labels; placeholder options are not reliable accessible labels | Visible labels linked by for/id; accessible name verified with keyboard/screen reader |
| U04 | admin-layout.ejs:456 onward | Several class-management labels are separate from inputs/selects without for association | Associate labels and required/error guidance; click label focuses correct control |
| U05 | login.ejs:20; teacher-dashboard.ejs:57 | Message regions are ordinary paragraphs/spans without explicit live announcement semantics | Announce async error/success; error summary links to fields; no colour-only meaning |
| U06 | admin-layout.js generated action buttons; admin-layout.ejs:42 | Emoji/title-heavy icon actions and dense table interaction need accessible name/touch target verification | Explicit labels per row; adequate target sizes; visible focus; no accidental destructive tap |
| U07 | admin-layout.js:239 onward; style.css responsive rules | Wide student tables have many columns; responsive grids do not prove tables fit small screens | 320/375/768px and 200% zoom; intentional scroll container, retained headers/actions, no whole-page horizontal overflow |
| U08 | admin-layout.js loads full student/teacher arrays and filters in browser | No verified server pagination; large pupil datasets may be slow and over-disclose data | Server tenant-scoped pagination/filter/sort with bounded fields, loading/empty/error/retry states |
| U09 | teacher-dashboard.js:109; timetable.js:219 onward | Teacher year and self timetable metadata depend on admin endpoints (G16) | Minimal role-safe read models; successful browser flows with disjoint role IDs |
| U10 | admin-layout.js:332 onward | Browser alert/confirm used extensively; no consistent inline validation or failure recovery | Consistent accessible inline feedback; duplicate-submit prevention; preserve entered values after failure |
| U11 | admin-layout.js:814; class row reset/accept handlers | Some Accept buttons provide feedback without a distinct backend acceptance transition; class delete resets settings rather than deleting class | Define action semantics; truthful labels; no success state implying an unperformed write |
| U12 | teacher-dashboard.ejs:47–48; admin-layout.ejs:738 | Teacher UI hardcodes 0–50 while admin max is editable; grading policy not shared | Render approved school/year policy; consistent maximum, rounding and validation messages |
| U13 | student-dashboard.js; admin-layout.ejs:699 | Student reports/exams not complete UI flows; Finance says coming soon | Scope approved features explicitly; no dead task entrypoints; own-only student report access |
| U14 | public/js/app.js:38 onward; dynamic innerHTML in dashboard scripts | Text escaping reused in attributes; inline onclick hinders strict CSP | DOM text/properties and delegated listeners; untrusted text inert; accessible actions retained |
| U15 | admin-layout.js:1669–1683, 1972–1988 | CSV quotation/formula safety incomplete; filename uses IDs/timestamp | Shared safe encoder, approved fields, contextual school/year labels; test quotes/newlines/formulas |
| U16 | login.ejs:14–17; auth.js | No explicit username/current-password autocomplete contract in source | Browser password-manager flow, label/type/inputmode as appropriate; do not block paste |
| U17 | partials/header.ejs and admin layout lang=en | English UI with Francophone records; master plan requires British English but UI language policy undecided | Consistent British-English labels initially; confirm French UI scope without changing names/data |
| U18 | print rules and window.open print handlers | Print code exists; pagination, popup blocking and long cohorts unverified | A4 print preview with repeated headings, no clipped columns or unrelated pupil data; graceful popup failure |

Source line references identify inspection anchors; generated row markup and CSS are not claims of a reproduced browser failure. Contrast ratios, focus visibility and touch dimensions have not been measured.

## Target navigation proposal

School admin: overview; registration/personnel; academics; timetables; assessment/reports; discipline; library; laboratory; settings. Teacher: assignments, marks, timetable, authorised lab requests/availability and own loans. Student: own timetable/reports/loans as approved. Discipline: roster entry, justifications, corrections, totals, review alerts. Librarian: catalogue/copies, checkout/return, overdue and stocktake. Lab attendant: inventory, requests, issues/returns, low stock/expiry and requisitions. Platform admin: school onboarding/status/settings; subscriptions/billing only if approved.

Keep shared role-aware navigation and school/year context. Switching school must require server membership validation and invalidate stale page data/forms; hiding a tab never grants or revokes server permissions. Retain legacy pages until a documented parity checklist permits retirement.

## Required browser verification after authorisation

Test Chromium at desktop 1366px and mobile 320/375/768px, 200% zoom, keyboard-only and at least one screen-reader path. Check named controls, focus order, sidebar/subtabs, validation, unsaved changes, empty/slow/error responses, duplicate save, long names/French accents, dense rosters and A4 print. Capture sanitised synthetic screenshots and results in TEST_RESULTS.md. Do not load real student records for visual QA.
