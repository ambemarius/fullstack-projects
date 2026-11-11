---
name: lms-product-design
description: Design and implement polished UX/UI for the LYCEE BATOURI Express/EJS school-management application, including its dashboards, registration, finance and school modules. Use for visual redesign, navigation, forms, tables, responsive layouts and design reviews; not for database migrations or new financial or academic policy.
---

# LMS product design

Make this application feel like a coherent, professionally designed school-management product. Optimize for a school employee completing repeated tasks accurately and comfortably. Visual appeal should come from composition, clear hierarchy, confident typography and careful interaction details.

## Understand this application before designing

Locate the project root and read the newest entries in `AGENT_HANDOFF.md`, `PHASE_STATUS.md` and the relevant implementation record. Inspect the actual target templates, styles and browser flows. The owner prefers the original pupil/teacher creation workflows over the simplified replacement screens: preserve their useful structure and complete fields while improving layout and feedback.

The stack is Express, EJS and existing JavaScript/CSS. Keep it unless the user requests a technology change. Preserve field names, IDs used by scripts, route contracts, validation, CSRF, role checks, school scope, account recovery and legacy write locks. Do not derive new grading, promotion, fee, refund or enrolment rules from a visual redesign.

The original application, canonical school workspace and synthetic practice workspace may have separate origins and sessions. Discover their current status from project records. Give them a consistent visual language, but preserve authentication boundaries and clear live/practice identification. A common sidebar is not authorization to merge sessions, enable staged features or write real records. Do not include server ports or implementation explanations in ordinary product labels; route existing links correctly and identify practice content plainly.

## Set an intentional direction

Read [references/design-system.md](references/design-system.md) when creating or substantially changing screens. It contains the recommended visual direction, component behaviour and LMS-specific workflows. Treat its tokens as a coherent starting point, not an existing approved brand manual. Preserve established school branding where available.

For competitive benchmarking, read [references/product-patterns.md](references/product-patterns.md). Verify public product documentation or screenshots when doing fresh research; distinguish documented features from your own design recommendations. Never claim access to authenticated competitor screens you have not seen. Use patterns, not copied logos, screenshots, proprietary layouts or marketing claims.

Start from the user's actual requested deliverable. For a prompt or specification request, deliver that artifact without changing the application. For an authorized implementation request, complete a useful connected workflow, not just a mood board or recoloured screen. Reuse existing authorization rather than introducing a new approval gate for every visual decision.

## Design and implementation workflow

1. Identify concrete current UX problems from source and available browser evidence. Map the role, frequent task, data needed, main action and success state for each target screen. Avoid treating a missing backend feature as a CSS problem.
2. Define the shared shell, navigation, page hierarchy and reusable components. Prioritize task completion and familiar registration forms. Default first slice: Finance overview → pupil statement/charge → payment receipt, with administrator batch review; the user may choose another module.
3. Implement semantic EJS partials and scoped token-based CSS. Maintain existing behavioural hooks. Use progressive enhancement for filter panels, dialogs or mobile navigation. Avoid a second parallel component system and global selectors that break unrelated pages.
4. Cover normal, empty, loading, validation-error, server-error, permission-denied, stale-data and success states that apply to the flow. Keep drafts on recoverable failures. Distinguish an unknown value from zero. Display pending functionality honestly; no decorative controls that pretend to work.
5. Verify the changed workflow with representative synthetic data. Reuse project tests appropriate to affected behaviour. Review keyboard operation, focus, accessible labels, contrast, responsive overflow and printable output where relevant. Inspect actual browser output; record screenshot evidence when tools permit. If certificate acceptance or visual capture is unavailable, record the limitation and continue independent checks without bypassing it.
6. Report completed screens, changed files, validation and remaining limits. Update project handoff/design evidence when work spans sessions. Do not describe practice features as production-ready or claim accessibility conformance from appearance alone.

## Quality bar

- A user can identify their school, workspace, role, current module and next action without reading a paragraph of instructions.
- Each task has one clear primary action, with secondary and destructive actions visually distinct. Do not place row-level destructive actions next to the primary submit action.
- Dense operational information remains scannable. Amounts align right with tabular numerals; status has text as well as colour; table headers and filter context remain understandable.
- Search, filters, selections and pagination actually work against their stated scope. Do not hide unmatched records client-side and present partial totals as school totals.
- Registration retains all required pupil/teacher information and the user's preferred workflow. Finance retains XAF amounts, current correction semantics, receipts and batch confirmation boundaries.
- Screens are usable at desktop and mobile widths. Support English/French text expansion without pretending untranslated interfaces are localized.
- No fabricated trend charts, fake notifications, decorative metric cards, random gradients, oversized editorial headings, emoji navigation or repeated oversized empty spaces.
- A polished UI must also work: verify forms, error recovery, role restrictions and school isolation after changing their presentation.
