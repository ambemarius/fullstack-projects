# Ordered MVP backlog

Status: **all tasks proposed**. No implementation or migration authorised. Estimates are relative effort (S/M/L/XL), not committed dates. Dependencies precede their consumers. Every delivered feature requires API, SQL, permission/isolation, browser and regression evidence; no syntax-only completion.

## M0 — approved baseline and safe test environment

| Task | Scope / effort | Depends on | Acceptance evidence |
|---|---|---|---|
| B00 | Owner audit/decisions approval; S | This review | Record identity/tenancy/MVP decisions and implementation authorisation; unresolved gates remain explicit |
| B01 | Recover repository baseline and non-production environment contract; M | B00, D01/D13 | Known branch/commit or approved source archive; safe DB identity allowlist; tests cannot target live DB |
| B02 | Introduce pure/unit + API harness and DB import boundary; M | B01 | Missing test DB config fails closed; app can be instantiated with isolated dependencies; no startup DDL on import |
| B03 | Versioned clean schema baseline; M | Test SQL approval, B02 | Empty disposable SQL setup twice, 23 source domains accounted for; migration ledger/checksums; no fabricated demographics/status loss |
| B04 | Synthetic fixtures and restore rehearsal; L | B03, credentials approval | Equal role IDs, unequal offering/student IDs, two years; encrypted backup restored and counts checked; no real pupil data in fixtures |
| B05 | Behaviour regression baseline; M | B02–B04 | Known failures recorded per G01–G26; confirmed safe positive cases; API/browser mismatch exposed |

M0 audit documentation is delivered; environment, runtime tests and restore drill are **not** delivered by Stage B. See M0_M1_ROADMAP.md.

## M1 — identity, onboarding and school boundaries

| Task | Scope / effort | Depends on | Acceptance evidence |
|---|---|---|---|
| B10 | Immediate auth containment/projections/error sanitisation; M | B02, owner auth approval | No old ID-only token; anonymous admin creation denied; account responses hash-free; inactive status enforced |
| B11 | Schools/accounts/legacy mappings/memberships/platform grants expand migration; L | D02/D03/D15, migration packet | No merging by email/ID; legacy school attested; no implicit platform admin; backfill counts reconcile |
| B12 | Canonical session and server-validated school context; L | D03, B11 | Cookie/CSRF/session fixation/logout/revocation tests; membership switch cannot grant foreign access |
| B13 | Tenant scope all 93 API declarations and repository/controller queries; XL | B11–B12 | Route matrix updated; foreign ID/nested parent/list/search/count/export/batch all denied; no unscoped fallbacks |
| B14 | Composite tenant constraints/indexes; L | Reconciled backfill, B13 | Cross-school parent FK rejected; existing rows preserved; current year unique per school |
| B15 | Protected onboarding and multi-role navigation; L | B12–B14 | Two schools provision independently; duplicate invite replay safe; school admin cannot grant platform power |
| B16 | Pilot migration/cutover drill; L | B10–B15 | Verified restore, dry-run/reconciliation and scoped rollback; two-school browser/API suite passes before pilot |

Do not enable a second real school while any repository/export/script remains unscoped. New tables or a school selector alone do not complete M1.

## M2 — historical academic foundation

| Task | Scope / effort | Depends on | Acceptance evidence |
|---|---|---|---|
| B20 | Student enrolment history/provenance and transfers; L | B16, D03/D10 | Effective class/year roster stable after transfer/promotion; unknown old cohorts flagged, not invented |
| B21 | Year-specific offerings/teacher assignments and coefficient snapshots; L | B20, D10 | Different years have independent assignments/coefficient rules; co-teaching intentional |
| B22 | Registration and personnel contracts; M | B20–B21 | Student/enrolment/fees atomic; matricule fields reconciled; partial-name update preserves names; clear/null semantics explicit |
| B23 | Membership counts/archive and subject enrolment repair; M | B20–B21 | Counts match authoritative history; unenrolment for year A leaves B; referenced years archived safely |

## M3 — assessment and scheduling correctness

| Task | Scope / effort | Depends on | Acceptance evidence |
|---|---|---|---|
| B30 | Mark ID/order/validation/ownership/transactions; M | B21, D10 | Unequal IDs correct; unassigned/wrong year denied; bad batch causes no writes; corrections audited |
| B31 | Reports and grading policies; L | B30, D10 | Missing passmark contract fixed; golden maxima/rounding/ties/missing-score cases; historical reports stable |
| B32 | Promotion decisions, preview, history and idempotency; L | B20/B31, D10 | Same batch rerun no double move; source enrolments preserved; reviewed terminal completion |
| B33 | Atomic timetables and collision control; L | B21, D04 | Class/teacher/room conflicts rejected including concurrent writes; replacement failure preserves schedule |
| B34 | Role-safe metadata/UI repair and secure exports; M | B30–B33 | Teacher marks and self grids use allowed read models; CSV/print safe on synthetic long names |
| B35 | Retained MCQ/finance containment; M | D12 | Secure or explicitly disable routes; preserve existing records; no accidental scope expansion |

## M4 — discipline and attendance

| Task | Scope / effort | Depends on | Acceptance evidence |
|---|---|---|---|
| B40 | School calendar/day periods and historical session roster; L | M2, D04/D07 | Session school/year/class/date unique; scheduled periods explicit; past roster unchanged after promotion |
| B41 | Period entry and correction audit; L | B40 | 7/8 -> 1 missed; 0/8 -> 8; duplicate student/date/period prevented; old/new/reason/editor/time retained |
| B42 | Restricted justification review; M | B41, D06/D15 | 8 missed plus approved 8-period justification -> 8 missed, 8 justified, 0 unjustified; no erased history; unauthorised evidence hidden |
| B43 | Weekly/term/year totals and review flags; M | B42, D05 | Edits/approvals propagate totals; schedule/holidays respected; threshold creates review alert, never dismissal |
| B44 | Discipline UI and isolation tests; L | B40–B43 | Role-separated entry/approval; no cross-school data; mobile roster workflow tested |

## M5 — library

| Task | Scope / effort | Depends on | Acceptance evidence |
|---|---|---|---|
| B50 | Catalogue/titles/copies/shelves/acquisition/stocktake; L | M1, D08 | Same title has multiple independent copies/accessions; school-scoped barcode; missing ISBN permitted |
| B51 | Eligible borrower loans/renewals/returns; L | B50, D08 | One active loan per copy under concurrent checkout; renewal policy; return restores correct availability |
| B52 | Overdue/loss/damage/write-off and librarian UI; L | B51 | Immutable history, explicit conditions, no automatic fines; cross-school borrower denied; own loan view authorised |

## M6 — laboratory

| Task | Scope / effort | Depends on | Acceptance evidence |
|---|---|---|---|
| B60 | Items/units/batches/storage/balances/movement ledger; L | M1, D09 | Equipment vs consumables/reagents; fractional units as approved; immutable movements; no negative balance |
| B61 | Teacher request/review/issue/return/reconciliation; L | B60 | Concurrent issues cannot overdraw; borrower/time/condition captured; damaged return unavailable until reviewed |
| B62 | Requisitions/expiry/low-stock/attendant UI; L | B61 | Expired reagent flagged; refill approval history; restricted materials permission; cross-school requests denied |

## M7 — release confidence and interface refinement

| Task | Scope / effort | Depends on | Acceptance evidence |
|---|---|---|---|
| B70 | Accessible responsive navigation/forms/tables; L | M3–M6, UI audit | Existing palette retained; keyboard/mobile/zoom/A4 checks; role/year/school context clear |
| B71 | End-to-end regression, query plans and capacity; L | Pilot sizes, completed flows | SQL/API/browser/isolation suites; approved concurrent load target; bounded pagination and aggregate queries |
| B72 | Deployment/runbook/backup/incident/retention procedures; L | D13/D15 | HTTPS/session configuration, least-privilege DB, tested recovery time, rollback drill, private logs |
| B73 | Owner pilot acceptance and explicit release approval; M | B70–B72 | Known limitations signed; no unresolved isolation/security release blocker; no production-ready claim without evidence |

## Explicit post-MVP candidates

Expanded finance/payment integrations, full MCQ dashboard/exam administration, parent portal, notifications, offline synchronisation, subscription billing and custom domains need separate approved scope. Preserve current data and close exposure even when UI is deferred. No automatic fines, dismissal, grade-based promotion or fee-year inference without approved policy.
