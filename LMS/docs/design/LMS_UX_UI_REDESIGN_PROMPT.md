# LMS redesign prompt

Copy the prompt below into the agent working in this project. The accompanying skill is `lms-product-design`; its project copy is `docs/design/lms-product-design/SKILL.md`.

---

Use $lms-product-design. Act as a senior product designer and frontend engineer redesigning LYCEE BATOURI's existing school-management application.

The current interface looks like disconnected prototypes. Create a polished, captivating and consistent school administration product, informed by public product documentation and available UI examples from Fedena, OpenApply and Veracross. Use their functional clarity as a benchmark, not their branding or marketing-page layouts.

First inspect the actual application, current handoff and recent implementation records. Identify the specific layout, navigation, typography, form and table problems in the screens you can inspect. Preserve the original pupil and teacher creation workflows that the owner prefers, including every required field, validation and existing behaviour.

Establish one design system: deep navy navigation, restrained blue primary actions, light neutral canvas, white working surfaces, readable sans-serif typography, consistent spacing, coherent icons and clear status colours. Use compact, useful dashboards and well-organized operational tables. Avoid oversized serif headings, emoji navigation, decorative charts, fake statistics, excessive rounded cards and large unused spaces. Explain any coherent departure from this starting direction.

Create a shared application shell with role-appropriate navigation, clear school/workspace context, useful page headers, search/filter toolbars, consistent primary actions and mobile navigation. Only render controls backed by working authorized behaviour. Practice data must remain visibly distinct from real school records. Preserve separate sessions and origins where the architecture requires them.

Begin with a complete Finance design slice: overview and charge list, pupil statement, charge/payment screen, receipt, collection report and administrator batch-charge review. Carry the same reusable components into the original registration forms next, then attendance, academic tools, library, laboratory and staff accounts as scope permits. Do not stop after changing colours or making a single static dashboard mockup.

For each flow, design the populated, empty, validation-error, permission-denied, stale-data, pending-submit and success states that apply. Preserve user input on recoverable failures. Keep money and totals legible, align numeric columns, label statuses with text, and distinguish missing data from zero. Make long forms easy to scan without removing necessary information.

Keep Express/EJS and the current JavaScript/CSS architecture. Reuse partials and CSS tokens; preserve existing selectors, names, route contracts, role restrictions, CSRF and school isolation. Do not change databases, credentials, grading rules, financial rules or production activation status as part of this design work. Do not seed real records for screenshots. Do not move the project to another framework or a website builder merely for appearance.

Deliver:

1. A concise evidence-based UX audit and a clear design direction.
2. A documented token/component system and module navigation map.
3. Implemented, connected screens for the chosen slice using existing functionality.
4. Browser verification at desktop and mobile sizes, keyboard/focus and contrast checks, applicable print checks and screenshots where the tools permit.
5. Relevant passing regression tests and a handoff stating completed screens, changed files and remaining work.

Use synthetic records for testing. Respect existing activation authorization and process ownership checks. If browser certificate acceptance blocks inspection, leave that human action pending and continue independent work without bypassing it. Be explicit about unverified results. Proceed with authorized reversible UI work without repeatedly asking for approval of routine design choices.

The result should help real school staff work quickly and confidently and should look like one professionally designed product across modules.
