# Finance UX/UI redesign

7 November 2026. Applied `lms-product-design` to a connected Finance workflow in the synthetic practice application. This is the first implemented slice of the wider redesign.

## Audit and direction

The preceding finance pages had independent headers, large serif titles, loose spacing, uniform action styling and little distinction between a directory, a report and a transaction. Navigation returned users to the feature menu instead of keeping finance tools in context. Validation errors replaced the current form and lost its immediate context.

The new shell uses navy navigation, restrained blue primary actions, a light neutral canvas and compact sans-serif typography. Charges, Collections and Pupil statements share persistent navigation, active-page indication, workspace identity and role context. Practice status remains visible. The original school forms, databases and session boundaries are preserved.

## Implemented components and flows

- `views/partials/finance-shell.ejs`, `finance-nav.ejs`, `finance-end.ejs`: shared desktop navigation, top bar, skip link, mobile dialog with native focus containment/Escape handling, and no-JavaScript navigation fallback. Icons are simple locally authored inline SVGs.
- `public/css/finance-workspace.css`: scoped colour/spacing/type tokens; summary cards, action hierarchy, responsive fields, financial tables, status badges, error/success feedback, receipt definition lists and print overrides. Library and laboratory styles remain separate.
- Charges overview: scoped totals, search toolbar, result count, readable pupil/fee hierarchy, aligned currency columns, explicit empty states and a New charge action that opens and focuses the form.
- Charge/payment, receipt, collection report, statement and batch-review/result templates now use the same shell. Administrative corrections are visually distinct. Existing fields, route contracts, CSRF and role checks remain in place.
- `public/js/finance-workspace.js`: progressive form submission, pending-submit protection, retained field values on recoverable errors, server redirect handling, accessible error focus and private-content clearing on permission denial. The module uses HTML attributes rather than `form.action`/`form.method`, which are shadowed by existing named form controls. Server-rendered forms continue to work without JavaScript.
- Finance errors use the same visual shell. The mandatory non-cash payment reference now has a specific validation message; the rule itself is unchanged.

Print assets preserve the sample warning, totals and financial context while hiding navigation. Actual print-dialog/PDF output is not certified by this release.

## Verification

All **152 isolated tests** and **three focused synthetic SQL tests** passed. Four new client tests cover named-control shadowing, validation draft retention, pending double-submit suppression/network errors, permission denial and successful redirects. Existing SQL/HTTP tests exercise role and school boundaries, charge/payment/reversal flows, receipt/report/statement rendering and exports, plus batch review and atomic confirmation.

Live checks passed after an ownership-verified practice restart under PID **23644**. The main school runtimes remain separate. Browser inspection covered:

- Overview widths 1440, 1024, 768, 390 and 320 CSS pixels without document-level horizontal overflow in the observed state; tables have labelled, keyboard-focusable scroll regions.
- Mobile navigation opening, Escape dismissal and restored focus on the menu trigger.
- New charge action opening/focusing the pupil field, actual charge creation, a missing-reference error retaining a 10,000 XAF amount, and successful receipt navigation after correction.
- Administrator batch review and working mobile navigation after the asynchronous review response.
- Collection report and pupil-directory navigation on mobile; desktop dashboard and receipt, and mobile directory screenshots were inspected in the conversation.

Primary colour checks: white/blue 5.17:1, secondary text/canvas 5.87:1, sidebar secondary text/navy 8.42:1, paid status 6.94:1, overdue status 6.32:1 and input outline/white 3.51:1. These are selected token checks, not a claim of complete WCAG conformance. Full screen-reader auditing, actual 200% browser zoom and print-output review remain open.

Browser exercises used the persistent fictional practice school. A sample tuition charge of 25,000 XAF and payment of 10,000 XAF were entered for Ari Sample (charge 95, receipt PAY-1629-30059). The workspace also contains a 100 XAF Maya sample batch charge observed during review; it was preserved. None of these are real-school balances or transactions. Disposable SQL fixtures were cleaned by their tests.

## Next design work and rollback

Apply the shared visual language to original pupil/teacher registration while preserving its preferred form structure and complete fields, then extend to attendance, academic tools, inventory and staff accounts. The practice feature-menu landing page and original/canonical school shells have not yet been redesigned. Do not present this Finance slice as the entire application redesign or a production finance activation.

No schema, credentials or production financial data changed. Use the preceding source checkpoint `backups/source/1794035491677_source.json.gz` if a reviewed source rollback is needed. Revert presentation files and restart only the verified practice process when reverting loaded JavaScript services; retain financial records. Existing database activation gates continue to apply.
