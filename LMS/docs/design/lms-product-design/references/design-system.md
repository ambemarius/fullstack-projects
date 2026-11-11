# Recommended design direction

Design a calm, contemporary school administration workspace. Aim for the clarity of mature education SaaS, with a distinct school identity. This is a proposed direction; adjust it coherently to owner feedback and existing approved branding.

## Visual foundation

| Token | Starting value | Use |
|---|---|---|
| Navigation | `#14263D` | Deep navy sidebar; light text with verified contrast |
| Primary | `#2563EB` | Main buttons, links and selected navigation |
| Canvas | `#F5F7FB` | Application background |
| Surface | `#FFFFFF` | Forms, tables, panels |
| Text | `#182230` | Main content |
| Muted text | `#526177` | Secondary information |
| Border | `#D8E0EB` | Dividers and passive surfaces; not automatically adequate for input outlines |
| Success | `#067647` | Confirmed success, paired with text |
| Warning | `#B54708` | Pending/overdue states, paired with text |
| Danger | `#B42318` | Errors and destructive controls |

Use CSS custom properties, including hover, focus, disabled and selected states. Verify actual foreground/background combinations; these tokens alone do not certify contrast. Prefer a locally available sans-serif stack such as `Inter, "Segoe UI", system-ui, sans-serif`; do not add an external font request by default. Use roughly 16px body, 14px table text and 28–32px page titles, adjusting for density. Set tabular numerals for money and counts. Avoid tiny grey text.

Use a 4/8px spacing rhythm with 16/24/32px structural gaps, modest 8–12px radii and restrained shadows. Cards should group a meaningful task or summary, not wrap every line of content. A professional desktop page may be information-dense without being cramped.

## Application shell and information architecture

Desktop: approximately 240px sidebar, 64px top bar and flexible content. Include school identity, clear active navigation, breadcrumb/title and role/account controls. Academic-year context must be explicit where it affects data. Do not expose a fake school/year/role selector when the backend does not support it.

Suggested groups, shown only when authorized and available:

- Overview.
- People: pupils, teachers, staff accounts.
- Academics: classes/subjects, enrolment, courses/marks, timetables, reports.
- School operations: attendance/discipline, library, laboratory.
- Finance: charges, collections, statements.
- Administration: setup and permissions appropriate to the signed-in role.

Use one consistent stroke-based icon family from existing local assets or a verified licensed set. Pair navigation icons with labels. Keep rarely used technical tools out of primary navigation. A sidebar link to a separate practice workspace must identify that destination; do not disguise it as real-school data.

Mobile: labelled menu button opens an accessible drawer; Escape closes it and focus returns to its trigger. Use a single main content column. Tables may scroll within a labelled region where their two-dimensional comparison is necessary; the entire page should not overflow. Keep the important identifier and row action discoverable. Never drop financial columns without another accessible way to read them.

## Reusable component behaviours

**Page header:** title, short context, one primary task button. Secondary actions are quieter. Put the main search/filter toolbar next to the data it affects.

**Dashboard:** prioritize useful tasks and exceptions. Show only trusted, available metrics with dates and scope. Empty or incomplete historical data is not a zero trend. Do not add decorative charts to fill space.

**Tables:** meaningful headers, readable row density, consistent sorting indicators, visible filters, result count and real pagination if supported. Right-align amounts. Keep dates and names readable. Row selection must show a selected count and clearly scoped bulk actions. Preserve selection only while its scope remains valid. Treat stale records as a recoverable state.

**Forms:** persistent labels, clear required/optional fields, input examples where useful, inline validation and an error summary for long forms. Preserve entries on recoverable errors. Use two columns for related short inputs on desktop and one on mobile. Use full-page sections for long forms; drawers are for short contextual tasks. Group original registration fields logically without deleting or renaming their behavioural hooks. Maintain a predictable primary save action.

**Feedback:** disable a pending submit to reduce accidental repeats while keeping server idempotency. Report what was saved and provide the next useful action. Announce success/errors accessibly. A toast alone is insufficient for an important validation or permission failure. Avoid endless spinners and show retry/context on errors.

**Dialogs:** use for bounded confirmation or short edits. Give them accessible titles, focus management and Escape behaviour where safe. Do not put a complex registration workflow inside a small modal.

**Empty states:** distinguish no records, no filter matches, unavailable data and access denial. Offer a relevant next action only if it is permitted. Fictional practice values must remain clearly labelled.

## Module-specific priorities

| Module | Design focus | Behaviour to preserve |
|---|---|---|
| Pupil/teacher registration | Familiar full forms, sections, clear save/error feedback | Existing fields, validation and account distinctions |
| Finance | Scannable charges, filters, amounts, payment capture, receipt/statement navigation | XAF; cashier/admin separation; reversals are not refunds; current-state totals |
| Batch charging | Searchable explicit selection, selected count, review of pupil/fee/total | 1–200 pupils, session-bound review, duplicate/stale checks, atomic confirmation |
| Attendance | Fast register entry and visible recorded/unrecorded states | Existing roster/date scope, correction history; missing does not mean absent |
| Academics | Consistent pupil/year/subject context, efficient mark grids | No invented placements, maxima, grading or promotion policies |
| Timetable | Clear periods, day/teacher/class context, printable layout | Existing collision/authority checks and accessible alternative to visual grids |
| Library/lab | Search-first inventory and clear circulation/request states | Role permissions, stock availability, restricted items and transaction history |
| Staff accounts | Clear account status and invitation/recovery next steps | No displayed passwords; operator authority and school-specific role boundaries |

## Accessibility and verification

Target WCAG 2.2 AA for changed surfaces. Verify relevant criteria against the current [W3C quick reference](https://www.w3.org/WAI/WCAG22/quickref/). Check normal text contrast of at least 4.5:1, large text at least 3:1, relevant non-text contrast, keyboard operation, visible focus, labels, error identification and reflow. Prefer 44px touch controls as a design target; do not misstate it as the WCAG 2.2 AA minimum in every case.

Inspect representative screens at 1440, 1024, 768 and 390px, with a 320px reflow/200% zoom check where applicable. A desktop screenshot does not establish mobile quality. Verify loading, long names, French labels, empty data, large amounts, validation failures and successful submission. Print receipts/statements without navigation or clipped totals. Keep motion short and respect reduced-motion preferences.

Record what was actually tested and what remains unverified. Do not require a new test framework for a reversible style change; reuse existing tooling and add behaviour tests when a changed interaction creates a regression risk.
