# Implementation log

**10 November 2026, form and navigation UX.** Installed design skill applied: persistent native validation messages and linked summaries across shared forms; mobile drawer Close/backdrop, keyboard focus containment and desktop resize recovery. Browser verified teacher error correction, 320 px full registration, 1440 px Subjects and 390 px drawer. 165 isolated tests and updated four-server check:ui passed. No SQL, record, credential, policy or runtime changes. Dedicated screen-reader, print/zoom and live-account acceptance remain. Evidence: docs/design/FORM_AND_NAVIGATION_UX_2026-11-10.md. Temporary UI fixture server stopped; viewport reset.

**10 November 2026, route UX follow-up.** Styled browser error pages are active across the four running servers; API JSON responses, HTTP status codes, roles and redirects are preserved. Fixed original administrator Evaluation tabs incorrectly triggering Registration and failing to restore after refresh. Added nine Classes-panel labels. Browser reviewed all nine nested administrator panels, error-page reflow/recovery and populated sample finance charge/receipt/statement routes. 161 isolated and three synthetic SQL tests passed; npm run check:ui passed. Verified restart PIDs: original 55436, canonical 40436, inventory 11628, attendance 6576. No real-school records, credentials or policies changed. Real-account/assistive-technology/print acceptance and the previously stopped 2028 preview remain separate. See docs/design/ROUTE_UX_REVIEW_2026-11-10.md.

**9 November 2026, application-wide UI refresh.** The dark-green design now covers registration, original record screens, staff access, academic tools, landing/sign-in, attendance, library and laboratory; Finance colours are aligned. Preserved form hooks, all business clients, permissions, schemas, records and passwords. Final 156 isolated tests passed; three focused synthetic SQL tests passed on 8 November. All 22 visual-fixture layouts passed 320/1440 px overflow checks, with actual synthetic workflow/browser checks and keyboard navigation review. Canonical HTTPS boundaries passed again. Final practice check passed inventory/finance/attendance checks but found the separate 2028 enrolment preview offline; its ownership manifest remains and was not cleaned or reseeded. Live-account acceptance, full screen-reader/zoom and print acceptance remain. See docs/design/APPLICATION_UI_REVIEW_2026-11-09.md for coverage and limits. No application restart or database change for this UI release.

**7 November 2026, School Feature Hub redesigned.** Dark-green responsive practice hub and authenticated /school dashboard are active. Server-derived school/current-year context and role-filtered record tiles preserve all former destinations and existing guards. 155 isolated and 3 synthetic SQL tests passed, live HTTPS checks passed, and desktop/tablet/mobile plus role-layout browser reviews completed. Original forms, real records, passwords and schemas unchanged. Real signed-in acceptance, full screen-reader/zoom checks and other module redesigns remain. See docs/design/SCHOOL_HUB_REDESIGN_2026-11-07.md. Runtime PIDs: inventory 39356; canonical 15052.

## 6 November 2026 — attendance and stock review

Activated date-range attendance totals, per-pupil correction history, literal library catalogue search and attendant stock movements. Attendance and feature-menu processes restarted through the new ownership-checking practice script. [Implementation and limits](docs/implementation/PRACTICE_REVIEW_TOOLS.md)

## 6 November 2026 — library, laboratory and feature menu

Created SQL-backed library circulation and laboratory inventory workspaces, connected through the local feature menu on port 2030. Role-specific sample sessions use separate cookies. The running feature menu, all three role pages and the four pre-existing application ports passed health checks. [Release record](docs/implementation/M5_M6_PRACTICE_WORKSPACES.md)

## M4 attendance practice register

Built a separate practice application for discipline staff to enter and correct attended periods on dated class registers. The sample server uses the marked synthetic SQL database. The production migration list and existing applications have no attendance mount. [Workflow and verification](docs/implementation/M4_ATTENDANCE_REGISTER.md)

## 5 November 2026 — personal timetable CSV and print

Activated CSV download and a dedicated print view through the same permission checks as the personal timetable. The checked canonical restart launched PID 29104 on port 2027. [Release evidence and rollback](docs/implementation/M3_TIMETABLE_EXPORTS.md)

## 5 November 2026 — teacher and pupil timetables

Courses now shows a personal timetable for the selected term of the current school year. Both original timetable bookmarks redirect there when canonical Courses is active. The verified canonical and original restarts launched PIDs 22168 and 5360 respectively. [Implementation and recovery](docs/implementation/M3_PERSONAL_TIMETABLES.md)

## 5 November 2026 — administrator timetable conflicts

Activated clock-range checks for class, teacher and named room bookings on the original administrator interface. Generation now commits only when every allocated period fits. The ownership-checked restart launched port 2026 under PID 3376. [Implementation and rollback](docs/implementation/M3_TIMETABLE_COLLISIONS.md)

## 5 November 2026 — M3 raw-score batch entry

Activated batch saving on the canonical Courses page after the isolated suite and focused two-school SQL test passed. Each successful batch has a common audit request ID. The ownership-checked restart launched PID 21028 on port 2027 and the pinned HTTPS check verified the deployed client. [Release record](docs/implementation/M3_MARK_ENTRY.md)

## 5 November 2026 — existing pupil placement review

Added a read-only current-year review list to canonical registration and verified aggregate rollout prerequisites against the existing school database. Both interfaces are running. [Findings and follow-up](docs/implementation/M2_CURRENT_PLACEMENT_REVIEW.md)

## 5 November 2026 — live academic-records review

Registration exposes per-pupil and per-teacher source evidence through the read-only academic history router. Choose a person’s Academic records action and a year. The school administrator sees subject links and raw mark references for pupils, or explicit-year and undated teaching assignments separately. Results clear on access loss, school changes and tab switches. Requests use the existing verified school session. The original registration partials are intact. The real deployment uses `canonicalAcademicHistoryReview` and existing M1 tables. To withdraw this read-only feature, disable that flag and reload only the verified canonical listener. No live migration was run. Restored-copy migration rehearsal was waived by the owner.

## 5 November 2026 — explicit year archival

Added staged migration 013 and the administrator archive operation to the temporary M2 workspace. The transaction checks current placements and profiles, records the actor and reason, and preserves historical reads. Production rollout awaits restored-copy rehearsal. [Implementation record](docs/implementation/M2_YEAR_ARCHIVE.md)

## 5 November 2026 — historical year coverage

Added the opt-in synthetic administrator Year coverage tab and scoped GET. Removed the legacy year-delete fallback after identifying its single-junction dependency check. No production migration or restart. [Implementation and verification](docs/implementation/M2_YEAR_COVERAGE.md)

## 5 November 2026 — year offerings and teaching history

Added staged migration 012, current-year coefficient entry with evidence and version checks, transactional teaching events and an administrator year-history view. Tests verified retention across a year change, explicit co-teaching, revocation and full rollback. [Implementation record](docs/implementation/M2_YEAR_OFFERINGS.md)

## 4 November 2026 — dated pupil withdrawal and return

Added school-local session revocation, durable withdrawal receipts, legacy token invalidation through readmission, explicit review of resuming subjects, and dated placement checks on subject and score writes. Staged 011 depends on staged 010. Both were rehearsed in the guarded synthetic database. The live M1 runtime passed its health checks. [Change and rollout record](docs/implementation/M2_PUPIL_WITHDRAWAL_RETURN.md)

## 4 November 2026 — current pupil transfers

**4 November 2026 — current pupil transfers verified in the synthetic workflow.** The dedicated administrator operation closes the old placement, opens the new one, updates the versioned pupil projection and preserves year memberships/marks/courses in one transaction. Existing active destination links require review; no automatic subject enrolment or account change. Duplicate/stale/cross-school requests and final-audit rollback tested. The transfer form is available only in the opt-in synthetic preview; no live mount, schema change or real transfer. **136 isolated +28 synthetic SQL tests passed.** Visual acceptance remains pending at the browser certificate warning. Preview stopped and fixtures cleaned. Existing M1 listeners were cold-started on vacant ports with verified ownership; pinned live health passed. See docs/implementation/M2_CURRENT_TRANSFERS.md. Next dated withdrawal/return with membership/session handling, course-placement checks and year-specific offerings/assignments. M2 remains in progress.

## 30 October2026 — initial enrolment registration/history verified in synthetic workflow

Added default-off transaction composition for pupil registration and explicit dated enrolment, preserving original forms and M1 live behavior. Pupil/account/membership/map/current placement/year junction/ledger/audits commit together; final audit failure rolls back all. Administrator History displays append-only revisions and unknown-history notice with safe text, school-switch clearing and stale-response protection. Profile edits cannot change placement; undated pupil status is refused in the staged workflow and preview ledger is read-only. **131 isolated +27 synthetic SQL tests pass**, zero failures/skips. Browser checks at1280/390/320 cover two-school history separation, edit/reset, keyboard and teacher form. Synthetic preview cleaned and closed; pinned real HTTPS passes. No production migration/restart/data/password changes. Next dated transfer/status/current projection/course integration; see docs/implementation/M2_REGISTRATION_INTEGRATION.md.

## 30 October2026 — enrolment ledger verified/staged

Implemented staged010 identities and append-only revisions, administrator record/correct/transfer service and unmounted CSRF-protected API. Explicit start/inclusive and end/exclusive dates, source/reason/actor history, per-school/pupil transaction locks, cross-year overlap rejection and optimistic version checks preserve dated placements; current fields/fees/marks/passwords are untouched. Transfers atomically close/open records with shared operation ID and audit. Dated rosters survive current pupil withdrawal/class/year changes and paginate safely. **127 isolated +26 SQL tests pass; focused3 pass**, including destination-audit rollback and schema cleanup. Existing migrations/runtime policy/package manifests unchanged; live HTTPS healthy. Dependencies repaired to lockfile after missing modules and locked bcrypt cleanup issue. Full evidence and next integration gates in docs/implementation/M2_ENROLMENT_LEDGER.md. M2 remains in progress; no real migration or activation.

## 30 October2026 — M1 accepted; M2 history review verified/staged

Recorded owner's explicit M1 acceptance/M2 authorization and closed the checklist without repeating approval. Added admin-only history-review service and unmounted GET API, separating current placement from year membership/subject/score evidence and keeping teacher NULL years unresolved. No inferred dates, classes, grades, coefficient snapshots or access grants. Implemented strict scopes, same-school parent joins/current SQL authority, no-store, read-only method enforcement and bounded-result refusal. **125 isolated +25 synthetic SQL tests pass**, including transaction rollback/count preservation and actual HTTP isolation. No schema/data/password/policy/process changes on the real application. Next authoritative enrolment ledger and reviewed transfer/provenance workflows; M2 is not complete. Details: docs/implementation/M2_IMPLEMENTATION_PLAN.md.

## 29 October 2026 — final M1 browser verification

Completed mobile/keyboard/two-school visual checks on existing guarded synthetic fixtures in a temporary2028 host with separately named secure cookies. Fixed registration switch privacy/races and false success feedback; accessible search/header attributes added through canonical JS, preserving original form partial bytes. Full122 isolated tests pass;24 SQL baseline unchanged, no SQL/schema changes. Real records/passwords preserved. Signed out, reset viewport, closed preview tab and stopped owned process;2028 closed and real pinned HTTPS health passes. Technical M1 gates complete; formal owner acceptance pending before M2. See docs/implementation/M1_BROWSER_ACCEPTANCE_2026-10-29.md. Deleted automation remains deleted.

## 27 October 2026 — invitation success feedback and fresh login

Implemented owner's requested acceptance-to-login behavior. Public acceptance now invalidates recipient sessions/version atomically with grant/consumption/audit, using per-account locking. UI clears secrets, replaces location with a one-time success login marker, selects existing Teacher type and hides acceptance for already-admin users. 85 isolated +16 SQL tests pass; canonical restart48608 and actual HTTPS health verified. No production grant/password change. Independent course scaffold stays disabled and requires its own review/tests; see M1_INVITATION_SUCCESS_FLOW.md.

## 27 October 2026 — owner-selected teacher recovery preparation

Reviewed the requested teacher and verified mapping without credentials. Built private masked wrapper and atomic source/canonical recovery preserving roles/status, revoking sessions/pending invitations and auditing without values. Added legacy credential-version and login/reset-race checks; disabled unsafe legacy-only admin Apply on canonical DBs. 81 isolated +16 SQL tests pass. Enabled original runtime support via tracked restart9976; readiness and unchanged selected review version1/changes0 verified; canonical HTTPS healthy. Password remains unchanged until owner private entry. See M1_TEACHER_RECOVERY.md.

## 27 October 2026 — mount invitations at owner's request

Added fail-closed existing-local-profile enforcement and fixed LYCEE_BATOURI scope, verified operator staff directory, protected invitation management/acceptance page and safe staff login return links. Mounted the API with all prior token/authority/race/audit guards. 78 isolated +15 SQL tests pass; focused production-policy tests and actual pinned HTTPS checks pass. Readiness passed and only the verified canonical listener restarted (launchPID13116). Original gates retained; no real invitation/grant/password/data/schema change performed. Cross-school native profile provisioning stays gated. See M1_INVITATION_MOUNT.md.

## 27 October 2026 — staged existing-account invitations

Implemented protected existing-account school-admin membership invitation engine/factory with exact account/key binding, hashed one-time tokens, 24-hour expiry, operator-only issuance/revocation, authenticated acceptance, fresh SQL authority and atomic audit. Preserves credentials/old roles and refuses student promotion/revoked-member recovery. Reserved the invitation-purpose namespace in pending-school bootstrap. 77 isolated +15 SQL tests pass. Kept factory unmounted because explicit school-local profile/link and login/source-guard integration remains necessary; verified live404 and feature health. No production privilege or data/schema change, and no repeated certificate request. Next integration steps in M1_EXISTING_ACCOUNT_INVITATIONS.md.

## 27 October 2026 — unattended auxiliary profile increment

Implemented and activated admin-only school-scoped auxiliary records with search/paging, create/edit/soft status, representation-token concurrency and atomic audit. Job titles explicitly confer no account authority. Preserved original name on unrelated edits; no schema migration. Added shared runtime policy and old auxiliary writer lock/handoff. 74 isolated +14 SQL tests pass; real ownership/drift readiness and post-deployment boundary/HTTPS/dashboard checks pass. No production fixture, password or source-record change by verification. Browser acceptance stays pending, and hourly continuation remains active for remaining M1 account/invitation/domain work. See M1_AUXILIARY_PROFILES.md.

## 26 October 2026 — academic setup and away-work continuation

Activated the already tested scoped academic backend with a real admin-style class/subject/year workspace, explicit current-year actions, original dashboard handoff and old academic writer lock. Real readiness and actual lock checks passed; restarted verified original then canonical listeners. 71 isolated +13 SQL tests and pinned real HTTPS checks pass. No new migration or production fixture. Owner asked to keep implementing while resting; created ACTIVE hourly same-chat heartbeat continue-lms-m1-implementation, preserving normal permissions and human-only handoffs, quiet routine progress, sequential M1 gates and documentation. Browser acceptance remains pending without blocking independent work. See M1_ACADEMIC_ACTIVATION.md and AGENT_HANDOFF.md.

## 26 October 2026 — activate preserved personnel forms safely

Introduced shared runtime policy, old identity/personnel writer gate, original-dashboard handoff and protected real-school original registration forms. Enabled scoped creation/editing/status plus read-only parent/reference data. Private table state now clears on denial/sign-out. Zero aggregate source drift; restarted verified original process with lock, checked actual409, repeated readiness, then restarted canonical with writes enabled. 69 isolated +13 SQL tests and actual HTTPS checks pass. No new migration, password operation or production test pupil/teacher. Browser screenshot confirms certificate barrier remains; policy requires human final click. Full M1 remains in progress; see M1_PERSONNEL_ACTIVATION.md.

## 26 October 2026 — fix real-school canonical sign-in

Owner could not sign in because port2027 targeted fictional samples. Implemented guarded real-school startup and a real-credential sign-in/read-only workspace, with automatic school code, scoped admin lists, and denial of legacy password/role/status drift. No source credentials altered and no demo bypass mounted. Verified readiness and owned PID44728, replaced only that listener with canonical PID40856; port2026 remains running. 66 isolated +13 SQL tests and pinned actual HTTPS checks pass. Full canonical writes and browser acceptance remain M1 gates. See docs/implementation/CANONICAL_REAL_SIGNIN.md.

## 26 October 2026 — original database adoption completed

Verified DBA-restored copy ONLINE/access and db_owner. Implemented exact-target, transactional adoption with original-field multiset preservation, credential/status mapping, explicit role exception and provenance/checksum ledger. Rehearsed seven expansions with rollback, full adoption rollback, committed copy and independent integrity/identity checks. Original source fingerprint matched; briefly paused the owned server, committed adoption on schooldb, restarted server and verified HTTP200. All 1,401 original rows/every old field and credential preserved; 103 accounts mapped, inactive teacher disabled, teacher-role Admins row gets no canonical authority. Initial owner-authorised platform grant audited. Independent original CHECKDB and identity/constraint tests passed. 63 isolated +12 synthetic SQL tests pass. M1 remains open; canonical runtime and remaining write/browser boundaries are separate. See docs/implementation/ORIGINAL_DATABASE_MIGRATION.md.

## 26 October 2026 — owner requests original migration

Readiness confirms backup permission but no create-database authority on MARIUS\DEV. Created a fresh COPY_ONLY CHECKSUM original backup at D:\Dev\schooldb_before_m1_008eafa5e2aed4d8.bak; no school records/schema changed. Generated exact-instance DBA restore/check packet for a unique separate rehearsal target. Two focused packet tests pass. Restore verification/adoption rehearsal remain pending DBA execution; see docs/implementation/ORIGINAL_DATABASE_MIGRATION.md. No live migration completion claimed.

## 26 October 2026 — original forms, scoped scores and confirmed ownership

Implemented migration 008 and school/assignment/enrolment-authorised versioned score batches in the isolated preview. Restored original teacher/student registration form structure with canonical scoped handlers, protected edit details, validated demographics and atomic initial placement. Medical/finance fields remain disabled. Hardened legacy administrator role recognition without granting authority to non-admin Admins rows. Owner confirms LYCEE BATOURI and all original-record ownership, and authorises operator selection; designated admin@school.local has no new platform grant yet. Read-only original-schema report retained. Complete verification: 59 isolated and 12 synthetic SQL tests; pinned HTTPS checks pass. Full M1 remains open; remaining gates documented in M1_COMPLETION_CHECKLIST.md.

Status terms: **proposed** = specified but not applied; **implemented** = artifact/code exists; **verified** = stated verification completed at stated scope. Verification of a document does not verify its proposed product feature.

## 26 October 2026 — recovery error reporting correction

Owner's private recovery attempt returned the original generic failure. Replaced vague reporting with safe codes, local pre-update password checks, explicit validation-only mode and BOM/UTF-8 input handling. Actual Windows PowerShell child stdin check passed with generated non-account data and zero DB changes. 56 isolated tests pass, including unsupported length, safe errors and child-process validation; focused tests rerun after SQL-number reporting was added. No live account password was read, printed or reset by the agent; the prior user's failed attempt is not counted as a successful change.

## 26 October 2026 — original login diagnosis and prepared recovery

- User reports invalid credentials in original UI. Verified account identifiers, supported credential format and expected 401 response, without retrieving/exposing real hashes or asking for passwords. Configured target confirmed MARIUS\DEV/schooldb. Correct role/existing password remains necessary; no known password was validated or reset.
- Prepared exact-target, default-review-only administrator recovery with masked local PowerShell password entry, reviewed-ID/old-hash concurrency guards and one-account update. Review of admin@school.local returned account ID 7, changes=0. No live apply or database/schema change executed.
- 54 isolated tests pass, including recovery guard/optimistic-update/output tests using fakes. docs/implementation/LEGACY_LOGIN_RECOVERY.md records the human-run command and legacy token-expiry limitation. Original registration design preference remains authoritative.

## 26 October 2026 — isolated M1 HTTPS browser preview

- **Implemented:** separate synthetic-only loopback HTTPS runtime 2027, role-aware workspace and sample sign-in; mounted only scoped identity/personnel/setup/link APIs. Existing application 2026 unchanged. Fictional demo schools/accounts retained, with private random credentials/TLS/process metadata excluded from source checkpoints and responses.
- **Session/UI:** own membership discovery, in-memory CSRF with Origin-protected renewal after reload, secure HttpOnly cookie, school cache reset/rotation and fail-closed visible workspace on 403. Scoped self DTOs include same-school labels. No localStorage JWT or unscoped legacy API exposure.
- **Verified:** 52 isolated/API + 12 SQL tests pass; actual HTTPS client trusts only the exact local certificate and verifies cookie/CSRF/school isolation/logout. No new migration or live data operation. Browser checks remain pending: local certificate interstitial still shown despite user approval replies; expanded details only, final bypass left to user under the computer-use confirmation policy. Saved screenshot and retained tab as handoff.
- **Record:** docs/implementation/M1_BROWSER_PREVIEW.md specifies delivered forms, guarded seed/startup, persistent fixture limitations, rollback and remaining manual verification. M1 is not complete and no production activation is claimed.

## 26 October 2026 — M1 offerings, enrolment and explicit teaching permissions

- **Implemented:** school-admin offering creation/list, atomic current-year pupil enrolment/revocation batches and year-specific teacher assignment/revocation; version conflicts, preserved participation/history, safe inventories and actor-derived self views. Teacher rosters require exact mapped active assignment; co-teachers are independent. No hard deletion or marks correction exposed.
- **Migration 007:** explicit nullable teacher year plus same-school/year FKs and year-aware uniqueness; active/revoked states and versions on pupil/teacher links. Existing teacher years remain NULL and never authorise scoped access. Rehearsed/rolled back before synthetic installation, then repeat-run passes. This supplies M1 permission context without claiming M2 historical reconstruction.
- **Verified:** 51 isolated/API + 12 SQL tests pass, zero failures/skips/TODO. Batch rollback includes prior links/year participation/audit, old NULL-year links remain unchanged, and marked enrolment revocation is refused. Real unmounted API and independent SQL revocation tests pass; existing server /login HTTP 200.
- **Limits/rollback:** docs/implementation/M1_ACADEMIC_LINKS.md records exact contracts/files/tests. No live database or browser route changed. Leave expanded schema unused before activation; do not blindly restore yearless uniqueness after new-year links exist. Remaining domain and browser isolation keep M1 open.

## 26 October 2026 — M1 scoped academic setup and tenant business keys

- **Implemented:** academic year/class/subject admin create/list/versioned edit; per-school atomic current-year selection and audit; same-school active parent checks; minimal current-year/slot context for verified admin/teacher/pupil memberships. Canonical descriptor binds the freshly authorised role for SQL verification. New API factory is unmounted.
- **Migration 006:** school-scoped assigned-row business keys/current-year uniqueness, separate unresolved uniqueness, canonical year creator FK and setup versions. Existing legacy creator values are preserved; no legacy actor/profile is invented. Rehearsed and rolled back before synthetic installation, then ledger repeat-run passes. No applied migration rewritten.
- **Verified:** 49 isolated/API + 11 SQL tests pass, including shared identifiers across schools, within-school/NULL-key conflicts, concurrent changes, foreign/inactive parents, canonical creator, minimal role context, independent revocation and late-audit rollback. Details/rollback: docs/implementation/M1_ACADEMIC_SETUP.md.
- **Runtime:** previous local listener had stopped. Restarted owner-requested server via hidden Start-Process, private logs/state under ignored backups/runtime; /login HTTP 200. Existing app/browser/routes remain on their prior configuration and no production schema changed. M1 and full two-school/browser activation remain incomplete.

## 26 October 2026 — M1 scoped personnel writes and requested server startup

- **Implemented:** pupil/teacher registration with atomic canonical mapping/audit, allowed-field edits, optimistic versions, explicit status/reason changes and membership-specific session revocation. No deletion, password reset, platform escalation or inferred academic placement. Added scoped teacher pagination and native matricule/email login.
- **HTTP:** shared canonical Origin/cookie helper and unmounted scoped personnel factory. Existing routes/UI remain unchanged pending complete tenant activation. Real API/SQL tests cover registration, login, read, edit/status, CSRF/Origin and cross-school denial.
- **Migration:** 005 adds version/audit metadata on synthetic SQL only. Initial compilation failure rolled back; corrected before first ledger installation. Rollback rehearsal, installation and repeat-run then pass. Applied migration checksums remain immutable.
- **Verified:** 47 isolated/API + 10 SQL tests pass, no failures/skips/TODO. Forced fixture-scoped audit-trigger failure rolls back profile/account/membership/map; trigger removed. Native pupil/teacher self reads and school-specific revocation pass. docs/implementation/M1_PERSONNEL_WORKFLOWS.md records exact scope/limits.
- **Server:** user requested startup for visualisation. npm.cmd start succeeded after allowing SQL network access, listening on port 2026; GET /login returned 200. No startup migrations/DDL or application database configuration change occurred. The process was left running; canonical personnel services are not mounted into this interface yet.

## 26 October 2026 — M1 explicit reconciliation and first scoped personnel reads

- **Implemented:** additive reconciliation ledger 004; synthetic-only plan/dry-run/apply library with explicit selected rows, parent agreement, relevant-source/schema fingerprints, preserved account hashes/status, no email merging, no platform escalation, serializable/app-lock transactions, provenance and repeat/concurrency safety.
- **Implemented:** immutable privately bound school context and student list/search/count plus pupil/teacher detail repositories, with per-operation service verification and independent SQL session/account/membership/school/role guards. No existing route/browser workflow changed.
- **Verified:** 45 isolated/API + 9 SQL tests pass. 004 rehearsed with rollback before installation on the approved synthetic database. Late mapping collision rolls back earlier writes; inactive users remain disabled; repeated/concurrent application does not duplicate mappings. Scoped reads hide foreign/unresolved data and reject revoked/forged authority. GUID case mismatch corrected before successful reruns.
- **Rollback/limits:** additive schema remains unused before activation; no destructive undo, real-data import, guessed ownership or actor remapping. Exact synthetic fixtures cleaned; recovery copies preserved. docs/implementation/M1_RECONCILIATION.md records files, behaviour, tests, operating procedure and remaining M1 domain work.

## 26 October 2026 — M1 invitation, sessions and ownership continuation

- **Implemented:** identityService invitation acceptance with bcrypt credentials and atomic provisioning/audit; canonical school-aware password login; transactionally rotating school sessions preserving absolute expiry. Duplicate canonical identities are refused before writes; no merge/password reset. Concurrent invitation replay and concurrent session switching each permit only one success.
- **Implemented:** unmounted routes/identity/identityRouter.js with secure HttpOnly host cookie, exact HTTPS Origin checks, CSRF on authenticated mutations, bounded credential attempts and server-derived actor/request fields. No default app route or browser login changed.
- **Schema:** migration 003 adds nullable ownership, same-school unique parent keys and composite FKs to 20 legacy school-owned tables. Rehearsed with rollback before applying to synthetic SQL only. No backfill/default school, inferred actor, global-key removal or mandatory ownership activation. Existing source rows and recovery copies preserved.
- **Verified:** 40 isolated/API + 8 SQL tests pass. Failure found in canonical-account collision handling was corrected with a locked preflight; entire relevant suites rerun successfully. Test fixture cleanup is exact synthetic keys only. See TEST_RESULTS.md and docs/implementation/M1_IDENTITY_PROGRESS.md for limits.
- **Rollback/remaining:** leave additive schema unused and router unmounted. Legacy reconciliation, scoped repositories, browser integration, shared production limiter/trusted-proxy configuration and full two-school acceptance remain. M1 is incomplete; M2 queued. No production DB migration occurred.

## 26 October 2026 — owner accepts M0; M1 foundation begins

- **Owner decision:** explicitly move past backup/restore. M0 closed by owner acceptance with the residual automated source-probe/DBCC exception recorded in PHASE_STATUS.md. Exact separate target access, identity, migration history and original counts passed; no marker cleanup ran after execution permission was declined. Earlier pending DBA requests below are superseded.
- **Implemented / verified:** additive migration 002 and internal identity/session/onboarding service. Nine empty canonical tables on MARIUS/lms_test_codex; no legacy backfill, default school, platform grant or new route activation. Composite school/account membership integrity, hashed opaque sessions/CSRF values, immediate status/grant rechecks and atomic protected pending-school invitations are tested.
- **Tests:** 38 isolated and 6 SQL tests pass, no skips/TODOs/failures. Initial lowercase synthetic-code fixture failure corrected before the full passing run. Schema rehearsed with rollback before application; ledger repeat-run and trusted FK checks pass. Service fixtures are cleaned by exact synthetic keys.
- **Scope/rollback/next work:** docs/implementation/M1_IDENTITY_PROGRESS.md describes changed files, schema, tests, pre-activation rollback and remaining domain sequence. No production DB, application routes or browser authentication changed. M1 is incomplete; M2 remains queued.

## 26 October 2026 — sequential phase gate and M0 recovery preparation

- **Restore follow-up:** owner reports script completion. Verification stopped first on missing count manifest, then on ELOGIN for the previously working source database. Added explicit reconstruction with provenance disclosure and a unit test; restored identity, counts, migration checksum and integrity checks remain unpassed. Asked DBA to confirm the supplied login and both database mappings. M0 stays open; M1 remains queued.
- **Root cause established:** read-only master connection succeeded with the dedicated login. Source lms_test_codex is RESTORING; separate restore target is not visible. Superseded the earlier credential question with a request for DBA completion of the intended recovery sequence and both test databases ONLINE. No automatic WITH RECOVERY, overwrite, drop or password change was attempted. Isolated tests now 36 passed; SQL phase gate remains unpassed.
- **Reconciliation after ONLINE:** the old restored copy lacked the recovery probe (subjects count 0 rather than 1); failed the gate instead of accepting the operator completion report. Created a fresh checksum backup and original count evidence with a durable second copy; unique-target DBA packet 83e40d137e72c9b2_restore.sql preserves both old databases and asserts its probe immediately after restore. Awaiting DBA execution, then agent verification. Current tests: 37 isolated + 3 SQL passed. No M1 changes begun.
- **Backup path correction:** owner specified B:\Default. Saved this explicit directory in ignored test configuration, prepared backup 240798fdb65f1f46 there successfully, and regenerated the unique no-overwrite packet. That packet supersedes earlier pending packets; restored target will be lms_test_codex_restore_240798fdb65f1f46. No previous backup or database was removed/overwritten. M0 remains pending DBA execution and agent reconciliation.
- **Latest operator completion report:** owner says latest probe assertion passed. Agent verification returned ELOGIN for the unique target; read-only diagnostics confirm source/old restore ONLINE and accessible, unique target not visible. Prepared CHECK_RESTORE_TARGET.sql for operator's SSMS connection to identify server/instance/target/probe/login mapping. No phase gate waived or M1 implementation started.
- **Source-replacement clarification:** user said the source was being restored/replaced rather than a new database. Supplied COMPLETE_M0_RESTORE.sql with explicit source recovery and a separate no-overwrite target. After execution report, source is ONLINE but the exact target remains invisible to the dedicated login. Added scoped restored-user mapping and a final EXECUTE AS login access check for DBA execution. Requested actual source_access/restored_access values; M0 is still unverified.

- **Owner instruction:** finish and verify each phase before advancing. Added PHASE_STATUS.md; M0 remains in progress and M1 is queued.
- **Implemented:** synthetic backup preparation and DBA-only restore packet, identity/count/probe/DBCC verification utility, secret-excluding source checkpoints and conservative legacy interpretation fixtures.
- **Verified:** 35 isolated tests and 3 real SQL tests pass. Legacy fixture temporary-table scope was corrected before the passing run. Unknown student facts remain null/review-required; inactive teacher flags are retained.
- **Recovery evidence:** backup created for MARIUS/lms_test_codex with a committed synthetic probe, then the source probe was removed. SQL permission preflight allows BACKUP DATABASE but denies creating a database; VERIFYONLY also requires DBA permissions. No restore has been claimed or executed by this login.
- **Pending DBA action:** backups/rehearsals/c9d4d1282b208606_restore.sql verifies the backup and restores only a new lms_test_codex_restore, refusing an existing target. Owner was asked to run it in SSMS as DBA on MARIUS and report completion. M0 cannot pass until restored identity/count/probe/integrity checks succeed.
- **Scope:** only the synthetic test environment was changed. Existing application MARIUS\DEV was untouched. No real legacy upgrade or data import was performed. Synthetic recovery backup is not a substitute for the required encrypted/verified backup before any real-data migration.

## 26 October 2026 — approved C01/C02 and C03 preparation

- **Approved:** user approved all proposals/defaults, then authorised a separate synthetic SQL database on the configured server and selected lms_test_codex. No approval for real-data migrations was inferred.
- **Implemented / verified in isolated tests:** connection-free app factory and lazy database adapter; explicit server lifecycle without DDL or process killing; strict role-bound JWT configuration/claims; protected admin creation; inactive-account checks; password-safe student listing; sanitised errors; secret-free bootstrap output. Added minimal academic-context API and repaired mark enrolment parameter order. No school tenancy or canonical-cookie migration is claimed complete.
- **Implemented:** clean 23-table SQL baseline, checksum/transaction migration runner, guarded synthetic setup/provisioning and SQL test suite. The old setup command now refuses an unacknowledged target instead of executing inline legacy migrations. Administrator seeding requires explicit credentials and no longer creates tables.
- **Verified:** npm.cmd test: 29 tests passed, zero failures/TODOs. Tests use synthetic SQL adapters and ephemeral loopback HTTP; they are not real SQL/browser certification. FK baseline ordering and migration refusal/rollback orchestration pass offline tests.
- **Local configuration:** missing signing secret provisioned without display; test credentials supplied by the owner saved only in ignored config/.env.test.local. Existing DB connection settings preserved.
- **SQL target resolved:** initial DEV-instance provisioning was denied (15247), then dedicated credentials failed there. Owner clarified the new test instance is MARIUS. Updated test settings only; application MARIUS\DEV unchanged. Verified MARIUS/lms_test_codex identity and synthetic marker, applied baseline and reran it as a no-op.
- **Verified real SQL:** npm.cmd run test:sql: 2 passed. Checks include trusted FKs, invalid reference rejection, actual account models/login/list routes and rollback of synthetic fixture rows. No migration, password reset or seed was executed on an existing school database.
- **Verified reference setup:** npm.cmd run setup -- --approved-synthetic-only succeeded on MARIUS/lms_test_codex, adding only classes, timetable slots and Cameroon locations. No student/staff demo data was seeded. The lazy pool/legacy-model compatibility path executed successfully against real SQL.
- **Next:** backup/restore and legacy-upgrade rehearsal, then canonical accounts/tenancy. Details and changed files: docs/implementation/C01_C03_STATUS.md.
- **Repository:** no Git commits or branch changes made; parent repository discovery remains unresolved. Historical source hashes in architecture/SOURCE_BASELINE.json remain the audit baseline, not a claim that approved implementation left source unchanged.

## 25 October 2026 — Stage B comprehensive architecture audit

- **Verified (source inspection):** read the implementation master plan and October findings; examined boot/config, middleware, all router declarations, schemas/migrations, controllers, browser scripts/templates/styles and maintenance paths. No environment secrets or pupil records read or copied.
- **Implemented (documentation only):** docs/architecture contains system map, 106-route permission inventory, 23-table dictionary, workflow/UI audits, 26-item gap register, migration proposal, ordered M0–M7 backlog and M0/M1 roadmap. Root decisions/test/control records added.
- **Verified (static scope only):** route/table counts, source evidence references, documentation links and JS/EJS syntax recorded in TEST_RESULTS.md. Source hashes guard that application/package/design files did not change during audit. No runtime/SQL/browser/restore verification claimed.
- **Proposed:** first five change sequences C01–C05; identity/tenancy/history migration and all feature repairs/new modules. No commits created or schema applied.
- **Pending:** owner review and decisions, bounded implementation approval, safe test DB credentials/authorisation, repository baseline, grading/privacy/legacy mapping approval.

## Scope and rollback of this review

Only Markdown documentation and docs/architecture/SOURCE_BASELINE.json are deliverables. Application files, package versions, secrets and database are unchanged. Documentation can be reverted independently. A temporary documentation inventory helper was used and removed; it read source as text, never imported application modules.

## Future milestone entry template

Record date, approval/reference, bounded scope and exact files; proposed/implemented/verified state; schema version/checksum/affected counts; backup/dry-run/rollback evidence; unit/API/SQL/browser/isolation test results; unresolved decisions/risks and next review gate. Never mark all layers verified from syntax tests.
# 27 October — staged course review (not deployed)

Improved raw-score draft/version handling, request input locks, discard/departure protection and scope-denial cache clearing. Added three frontend behavior tests and two HTTP course mount/legacy gate tests. 90 isolated +16 synthetic SQL tests pass. Shared course flag remains false; no production record/password/schema change or listener restart. Navigation and complete alternate-route/live activation review remain documented in docs/implementation/M1_COURSE_STAGING.md. Existing invitation success-flow deployment remains active.

# 27 October — course workspace activated

Finished role-aware course navigation/login return and original dashboard handoffs; reviewed retained route mounts and legacy link/score writers. 92 isolated +16 SQL tests and read-only real readiness passed before setting canonicalAcademicLinks=true. Verified owned legacy process restarted and actual409 locks confirmed before canonical restart. Pinned live HTTPS course/API/auth checks pass. No production academic record/password/schema/role change; unknown teaching years preserved. Exact paused teacher/pupil legacy tools, retained single-school admin modules, safe rollback and remaining M1 gates documented in docs/implementation/M1_COURSE_ACTIVATION.md. Human browser acceptance remains pending.

# 27 October — administrator access management deployed

Added operator-only verified local administrator review and removal of accepted additional teacher-admin roles. Protected original administrators/platform accounts/self-removal; require remaining verified original admin and fresh review version. Preserve credentials/teacher/other-school roles while atomically invalidating recipient sessions and auditing removal. Added confirmation/directory UI and protected endpoints. 94 isolated +16 SQL tests, read-only real readiness and pinned live checks pass after correcting audit actor membership and allowing startup to finish. Only verified canonical listener restarted (30032); original/locks unchanged. No real privilege/password/schema change by tests. M1 remains open; see docs/implementation/M1_ADMIN_ACCESS_MANAGEMENT.md.

# 27 October — explicit staff-profile foundation staged

Implemented proposed009 outside executable migrations plus an unmounted read-only linked-profile resolver. Composite tenant/profile/account membership integrity and explicit role checks support future auxiliary/native/multi-school identity without changing the primary legacy map or copying credentials. 96 isolated +17 synthetic SQL tests pass; table/schema/fixtures fully rolled back and existing live HTTPS healthy. No production migration, profile, permission, password or process change. Invitation acceptance, native account creation and guarded login/recovery integration remain before rollout; see docs/implementation/M1_STAFF_PROFILE_FOUNDATION.md. M1 remains open.

# 27 October — auxiliary invitation backend staged

Implemented exact-account/profile/version/role-bound auxiliary invitations for new school membership only, with operator issue/revoke and authenticated recipient acceptance. Atomic role/link/consume/version/session/audit; original account credentials/roles preserved. Added unmounted Origin/session/CSRF/rate-limited factory and reserved-bootstrap namespace exclusions. 99 isolated +18 synthetic SQL tests and live health pass; temporary synthetic009 table/fixtures cleaned. No real rollout/process restart or grant/password/schema change. Native private account creation and guarded login/switching/recovery/status/UI remain before009 promotion/activation; see docs/implementation/M1_AUXILIARY_INVITATION_STAGING.md. M1 remains open.

# 27 October — staff accounts completed for approved school

Delivered private native auxiliary and standalone administrator invitation/signup/recovery, operator token directory/revocation, role-correct guarded sign-in, profile/school-switch guards, preserved legacy credential anchors, local auxiliary session suspension and protected native admin disablement. Public recipient/operator UI returns directly to Staff/Admin login.105 isolated +19 SQL tests pass.009 promoted/rehearsed/applied only after tests; separate original rollback/apply verified37-table preservation with no links seeded. Final verified canonical52032, original19352/locks retained; pinned HTTPS/readiness pass. No real test accounts/grants/password changes. New standalone source profiles require explicit operator creation and store undisclosed random sentinel; recipient canonical password private. Guide/evidence: docs/implementation/STAFF_ACCOUNTS_GUIDE.md and M1_STAFF_ACCOUNTS_ACTIVATION.md. M1 domain/browser gates remain; M2 and additional real schools gated.

# 27 October — source-derived remaining route review

Added offline actual-router inventory with recognized auth middleware and current gate classification, plus full canonical exclusion regression for all94 original APIs.107 isolated tests pass, focused2 pass. No SQL/runtime/policy changes; last SQL19 baseline retained. Updated historical route matrix and recorded38 unresolved retained admin/any-account routes/five writes without claiming tenant safety. Existing follow-up prompt now focuses on scope boundaries, preserving schedule/status/thread. Staff features and009 remain active/immutable; M1 open. See docs/implementation/M1_RETAINED_ROUTE_REVIEW.md.

# 27 October — scoped original exam results activated

Added immutable fresh legacy JWT/source school/member context and SQL-level authority predicates. Scoped original admin exam read/publication/unpublication; serialize/audit publication atomically without grade/history changes.108 isolated +20 SQL tests and focused HTTP/cache/authority checks passed before activation. Read-only original ownership/constraint readiness passed; only verified original restarted21128, canonical52032 retained. Live header/anonymous401/canonical HTTPS/old409 checks pass. No real result/password/schema/data change. Inventory annotates3 scoped handlers,35 retained admin/any-account handlers/3 timetable writes remain. Keep scope flag true during repair; old false fallback is not a safe rollback. See docs/implementation/M1_LEGACY_EXAM_SCOPE.md. M1 remains open.

# 27 October — scoped original personnel reads and native readiness

Activated nine legacy admin/personnel read routes with fresh legacy context and per-statement school/authority predicates, scoped parent/fees joins, safe projections, original DTOs and no-store headers. Fixed native-admin startup review to distinguish explicit pending/active/disabled native lineage from legacy credential maps; no password copying/repair.109 isolated +21 SQL tests and final focused6 pass after correcting a synthetic aggregate query error. Real read-only readiness passed; only verified original restarted28048, canonical52032 unchanged. Live marker/401/canonical HTTPS/old409 checks pass after startup completed. No production person/credential/schema/grant change.26 retained admin/any-account handlers/3 timetable writes remain. See docs/implementation/M1_LEGACY_PERSONNEL_READ_SCOPE.md; M1 remains open.

# 27 October — scoped original timetables activated

Added verified school/member SQL boundaries for8 timetable admin paths, scoped parents/form/read metadata, atomic audited create/delete/generation and shared school/year/term serialization. Preserved original UI/DTOs and first-fit placement; bounded overflow counting and pre-delete refusal for unconfirmed/ambiguous teaching years or empty plans prevent guessed/destructive replacements.112 isolated +22 SQL tests, focused SQL/5 tests and real readiness/live checks pass. Only original43004 restarted; canonical52032 and existing locks retained. No real schedules, assignments, passwords or schema mutated.18 retained admin/any-account reads remain unassessed; M1/M2 gates unchanged. See docs/implementation/M1_LEGACY_TIMETABLE_SCOPE.md.



**27 October allocation-read staging:** unmounted `legacyAllocationReads` now scopes year/current-year, optional class parent and allocation/subject/class/year joins with fresh legacy administrator authorization in every SQL statement. Two isolated regressions pass; full isolated suite114 passes. This is NOT activated or SQL-certified: no controller/router/policy/runtime/database change. Existing22 SQL baseline remains historical, not rerun this increment. Next add two-school synthetic SQL and actual HTTP coverage, preserve allocation dropdown DTOs, then complete readiness/activation review. Manifest still18 unassessed retained reads; do not mark these routes scoped yet. See docs/implementation/M1_LEGACY_ALLOCATION_STAGING.md.



**27 October allocations ACTIVE:** all3 original allocation read/dropdown paths now bind verified legacy administrator authority and same-school year/class/subject/teacher/enrolment parents in every SQL statement. Current-year fallback is school-local; foreign parents404. Original DTOs/forms and writer409 locks retained.114 isolated +23 synthetic SQL tests passed; final focused4 passed after loopback sandbox retry. Real read-only readiness passed. Original listener restarted with verified ownership, launchPID38680; canonical unchanged. No real data/schema/password changes. Remaining15 retained admin/any-account reads plus other required boundaries and human acceptance keep M1 open. Keep legacyScopedAllocations=true during repair. See docs/implementation/M1_LEGACY_ALLOCATION_SCOPE.md.



**28 October M1 implementation exit review:** final14 reference/academic/auxiliary/geography reads, report-card read and2 self-profile reads are scoped and ACTIVE. Source-derived ledger107 declarations/94 APIs now has40 retained authenticated handlers with explicit reviewed boundaries, zero unassessed; all94 old APIs remain excluded from canonical runtime.118 isolated +24 synthetic SQL tests pass, final focused reference/report/self SQL and6 boundary tests pass; original read-only readiness and pinned live denial/header/409 checks pass. Original launchPID56744; canonical52032 unchanged (verify metadata). No real account/password/academic/schema changes. Existing report computation/response block is byte-equivalent after newline normalization to prechange checkpoint (SHA2568b4dd764e0e8dde8706e65d2f8ffbc9d9a06afb2a2a198859ca9329e417175a9); optional missing subjects.passmark uses the already-established50 fallback. Desktop browser now reaches real signed-in registration: certificate handoff is RESOLVED, original Student/Teacher forms observed; responsive overflow fixed and tab pressed-state/menu accessibility improved. Later browser returned to sign-in; no credential entered. Keyboard/mobile/two-school visual and owner acceptance remain UNVERIFIED. Read docs/implementation/M1_EXIT_REVIEW_2026-10-28.md. M1 is READY FOR ACCEPTANCE, NOT formally closed; M2/additional real-school onboarding remain gated. Never repeat adoption/009/seeding or disable scope flags/write locks. Automated implementation follow-up should stop once this review is delivered; no autonomous acceptance.


28 October follow-up: implementation automation `continue-lms-m1-implementation` deleted successfully after the acceptance handoff, as its instruction requires when only recorded visual/owner acceptance remains. Do not recreate it or advance M2 automatically. Last source checkpoint before this note: backups/source/1793193649909_source.json.gz (335 files, secrets excluded).

## 6 November 2026 — Finance practice activated

Owner confirmed XAF plus a separate bursar/cashier role. Added scoped charge/payment/receipt/reversal/cancellation workflow and original Finance tab navigation. Staged016 installed only in approved synthetic SQL. 148 isolated and two focused SQL tests pass; PID13308 serves the activated practice workspace, live HTTPS checks passed, and administrator/cashier browser views verified. Real-school financial migration and bursar provisioning remain pending. See docs/implementation/FINANCE_PRACTICE_WORKSPACE.md.


## 6 November 2026 — Finance collection reports

Added administrator/cashier date-range reports, method/operator groups, retained reversal status, printing and safe CSV export. 148 isolated and two focused SQL tests passed, including 5,001-row bound and two-school checks. Verified practice restart PID20124; live report/CSV checks passed. No schema or real financial changes. See docs/implementation/FINANCE_COLLECTION_REPORTS.md.


## 6 November 2026 — Pupil financial statements

Added scoped pupil/year financial statements, withdrawn-pupil access, current/overdue totals, historical correction visibility, receipt links, printing and safe CSV. 148 isolated and two focused SQL tests passed; verified practice PID37604 and live statement/export checks passed. Browser directory-to-statement DOM inspected. No schema or real financial data changed. See docs/implementation/FINANCE_PUPIL_STATEMENTS.md.


## 7 November 2026 — Reviewed batch charges

Administrator-only select/review/confirm workflow supports 1–200 pupils and atomic charge creation. Bound reviews and current facts prevent stale, duplicate or altered confirmations. 148 isolated and three SQL tests passed; rollback evidence verifies a second-pupil constraint failure. Practice PID16108 and live review checks passed; browser two-pupil preview returned without saving. No real financial or retained-schema changes. See docs/implementation/FINANCE_BATCH_CHARGES.md.


## 7 November 2026 — Reusable LMS design guidance

Created docs/design/LMS_UX_UI_REDESIGN_PROMPT.md and the self-contained lms-product-design skill with component guidance and primary-source product references. Installed four validated skill files in the user Codex skills folder after checking destination absence; copied-file SHA256 checks matched. Source and installed skill validation passed. No application, database or runtime changes. Design preference recorded in AGENT_HANDOFF.md.


## 7 November 2026 — Finance redesign

Shared finance shell/components, responsive navigation, tables/statuses, retained-error form submissions and all finance templates delivered. Named action/method control shadowing fixed with regression coverage. 152 isolated +3 SQL tests passed; live practice PID23644 checks passed. Desktop/mobile browser exercises used fictional records only. Registration and remaining app shells are next. See docs/design/FINANCE_REDESIGN_2026-11-07.md.

