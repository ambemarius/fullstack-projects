# Test and verification record

**10 November 2026, form and navigation UX.** Installed design skill applied: persistent native validation messages and linked summaries across shared forms; mobile drawer Close/backdrop, keyboard focus containment and desktop resize recovery. Browser verified teacher error correction, 320 px full registration, 1440 px Subjects and 390 px drawer. 165 isolated tests and updated four-server check:ui passed. No SQL, record, credential, policy or runtime changes. Dedicated screen-reader, print/zoom and live-account acceptance remain. Evidence: docs/design/FORM_AND_NAVIGATION_UX_2026-11-10.md. Temporary UI fixture server stopped; viewport reset.

**10 November 2026, route UX follow-up.** Styled browser error pages are active across the four running servers; API JSON responses, HTTP status codes, roles and redirects are preserved. Fixed original administrator Evaluation tabs incorrectly triggering Registration and failing to restore after refresh. Added nine Classes-panel labels. Browser reviewed all nine nested administrator panels, error-page reflow/recovery and populated sample finance charge/receipt/statement routes. 161 isolated and three synthetic SQL tests passed; npm run check:ui passed. Verified restart PIDs: original 55436, canonical 40436, inventory 11628, attendance 6576. No real-school records, credentials or policies changed. Real-account/assistive-technology/print acceptance and the previously stopped 2028 preview remain separate. See docs/design/ROUTE_UX_REVIEW_2026-11-10.md.

**9 November 2026, application-wide UI refresh.** The dark-green design now covers registration, original record screens, staff access, academic tools, landing/sign-in, attendance, library and laboratory; Finance colours are aligned. Preserved form hooks, all business clients, permissions, schemas, records and passwords. Final 156 isolated tests passed; three focused synthetic SQL tests passed on 8 November. All 22 visual-fixture layouts passed 320/1440 px overflow checks, with actual synthetic workflow/browser checks and keyboard navigation review. Canonical HTTPS boundaries passed again. Final practice check passed inventory/finance/attendance checks but found the separate 2028 enrolment preview offline; its ownership manifest remains and was not cleaned or reseeded. Live-account acceptance, full screen-reader/zoom and print acceptance remain. See docs/design/APPLICATION_UI_REVIEW_2026-11-09.md for coverage and limits. No application restart or database change for this UI release.

**7 November 2026, School Feature Hub redesigned.** Dark-green responsive practice hub and authenticated /school dashboard are active. Server-derived school/current-year context and role-filtered record tiles preserve all former destinations and existing guards. 155 isolated and 3 synthetic SQL tests passed, live HTTPS checks passed, and desktop/tablet/mobile plus role-layout browser reviews completed. Original forms, real records, passwords and schemas unchanged. Real signed-in acceptance, full screen-reader/zoom checks and other module redesigns remain. See docs/design/SCHOOL_HUB_REDESIGN_2026-11-07.md. Runtime PIDs: inventory 39356; canonical 15052.

**6 November 2026, review tools.** 148 isolated tests and both focused attendance/inventory SQL tests passed. Totals reflect the latest revision, unknown periods remain separate, and foreign history and totals are denied. Catalogue search handles literal SQL-like text. Teacher accounts receive no attendant movement history. Live HTTPS checks passed after verified restarts. [Details](docs/implementation/PRACTICE_REVIEW_TOOLS.md)

**6 November 2026, inventory workspaces.** All 148 isolated tests and the focused two-school library/lab SQL integration test passed. Tests cover competing checkout and issue, replay prevention, stale copy versions, damage, stock conservation, school and role scope, expiry/restrictions, form rendering and CSRF. The live feature menu and role pages passed verified HTTPS checks. [Cases and boundaries](docs/implementation/M5_M6_PRACTICE_WORKSPACES.md)

**Attendance register.** All 148 isolated tests passed. The focused two-school SQL/HTTP test passed for daily counts, correction history, concurrent edits, CSRF, role and school boundaries. Positive writes used dedicated synthetic fixtures. [Test record](docs/implementation/M4_ATTENDANCE_REGISTER.md)

**5 November 2026, personal timetable exports.** All 148 isolated tests and the focused two-school SQL integration test passed. Edge printed 60 synthetic lessons across 13 pages with all room markers, long subject endings and repeated column headings present. Live HTTPS access-denial and asset checks passed. [Evidence and limits](docs/implementation/M3_TIMETABLE_EXPORTS.md)

**5 November 2026, personal timetables.** All 147 isolated tests and the focused two-school academic-links SQL integration test passed. Positive signed-in tests used synthetic school records. Post-restart checks verified both original bookmarks, the deployed client and anonymous API denial. [Cases and limits](docs/implementation/M3_PERSONAL_TIMETABLES.md)

**5 November 2026, M3 timetable.** 146 isolated tests and the focused two-school timetable SQL integration test passed. These checks cover actual clock overlaps, adjacent periods, concurrent room reservations, insufficient capacity, audit rollback and HTTP conflict responses. Post-restart health and access checks passed. [Evidence and limits](docs/implementation/M3_TIMETABLE_COLLISIONS.md)

**5 November 2026, M3 mark entry.** 145/145 isolated tests and the focused two-school academic-links SQL test passed. A stale second score rolled back the first score and its audit event. The successful batch preserved zero and separate maxima. Post-restart HTTPS checks on 2027 passed. The full schema-installing SQL suite was deferred to preserve the running synthetic preview. [Evidence and limits](docs/implementation/M3_MARK_ENTRY.md)

## Current pupil placement review — 5 November 2026

144 isolated tests passed. The affected canonical history SQL integration passed with two transaction-scoped synthetic schools and cursor paging across 51 pupils. The active preview requires keeping its staged schema, so the full SQL installation suite was deferred. Live canonical and sample HTTPS checks passed. [Details](docs/implementation/M2_CURRENT_PLACEMENT_REVIEW.md)

## Read-only academic records on registration — 5 November 2026

143 isolated and 32 synthetic SQL tests passed, zero skipped. The actual canonical app factory rendered the registration panel and enforced HTTP and SQL role, school, read-only and scope boundaries on two-school data. The interface regression covered selecting another person before an earlier response arrived. Certificate-verified HTTPS on 2028 confirmed both source-history reads, anonymous denial and year coverage. Live 2027 public health and anonymous denial passed after the verified restart. No real credential was used for testing.

## Academic-year archive — 5 November 2026

142/142 isolated tests and 32/32 synthetic SQL tests passed with zero skipped. Archive/current races, late-audit rollback, immutable archived year, ended and unfinished pupil periods, stale forms, scoped reads, scoped writes and fixture cleanup passed. Verified the mounted workflow over pinned HTTPS and checked the live M1 service. [Evidence and scope](docs/implementation/M2_YEAR_ARCHIVE.md)

## Year coverage and year retention — 5 November 2026

141/141 isolated and 31/31 synthetic SQL tests passed with zero skipped. The final isolated run includes stale school-switch response suppression and the retired year deletion handler. The SQL regression checks compare counts before and after changes in two schools, including a corrected year and voided revision. Pinned HTTPS checks passed for both schools with preview sessions. Temporary fixture cleanup succeeded and public live M1 health passed. [Details](docs/implementation/M2_YEAR_COVERAGE.md)

## Year offerings and teaching history — 5 November 2026

139/139 isolated tests passed in 34.552 seconds and 30/30 synthetic SQL tests passed in 89.730 seconds. The final focused run passed all five tests after adding a shared lock for history reads and testing revocation of a pre-existing assignment in an unconfigured year. The suites had zero failures, skips and cancellations. The live M1 health check passed. The temporary M2 preview started, served the year-enabled page via pinned HTTPS, denied anonymous history access and exited successfully after cleaning up. Browser visual acceptance remains pending. [Verification scope](docs/implementation/M2_YEAR_OFFERINGS.md)

## Dated pupil lifecycle and course eligibility — 4 November 2026

**138/138 isolated and 29/29 synthetic SQL tests passed** with zero failures, cancellations or skips. Final suite durations were 36.457 and 91.622 seconds. The lifecycle test covers two schools, original HTTP sign-in and middleware, canonical sign-in and sessions, stale tokens after return, membership revocation by a separate action, repeated requests, date boundaries, late audit failure and explicit review of versioned subjects. New course and score guards reject unknown, closed or mismatched placement evidence. A failing score batch preserves the earlier score. The test verifies cleanup and the migration checksum baseline. The separate temporary preview started successfully with the mapped Sample Lifecycle pupil, exited successfully on finish and removed its manifest. Live M1 checks passed. Visual acceptance is pending at the recorded browser certificate gate. [Lifecycle details](docs/implementation/M2_PUPIL_WITHDRAWAL_RETURN.md)

## Current pupil transfers — 4 November 2026

**136/136 isolated tests and 28/28 synthetic SQL tests passed**, no failures/skips/cancellations/TODO (36.996s and 79.470s). The focused 5-test run passed after retrying the sandbox SQL connection with approved access. Subsequent full SQL coverage includes final-audit failure during a year change, foreign and stale requests, one-winner transfer race, refusal to revive destination course access, unchanged old marks and explicit new-course enrolment. Final isolated suite also checks opt-in-only rendering, versioned transfer payload, conflict draft clearing, post-success refresh and stale school responses. Browser form inspection was blocked by the local certificate; no browser submission or visual acceptance claimed. Temporary preview schema/fixtures/manifest removed. Existing M1 listeners were offline before the check; after ownership-verified cold starts both passed pinned live checks. Details: docs/implementation/M2_CURRENT_TRANSFERS.md.

## M2 atomic registration and history UI —30 October2026

**131/131 isolated +27/27 synthetic SQL PASS**, zero failures/cancellations/skips/TODO;39.722s/160.074s. New tests cover explicit provenance/date validation, trusted transaction composition, original form single-request payload/CSRF, safe history text, stale/denied history clearing, wrong-school parents, future/noncurrent placement, HTTP role/CSRF enforcement, complete final-audit rollback, matching credential copies without disclosure, duplicate refusal, unchanged ledger after profile edits, undated status409 and read-only ledger405. Synthetic cleanup restores count/checksum baseline. Earlier focused11 pass preceded final payload test and preview refinements; full suites above cover final source. Original partial-preservation and all94 legacy exclusions remain passing. Browser1280/390/320 checks verify two-school history isolation, unknown notice, edit/reset, field fit and source→reason→submit keyboard path; original teacher form retained. No browser new credential entry/submission claimed. Temporary preview exited0 with owned fixtures/schema removed, manifest absent and2028 listener absent; viewport/tab cleaned. Real pinned HTTPS checks pass. See docs/implementation/M2_REGISTRATION_INTEGRATION.md and its screenshot.

## M2 enrolment ledger —30 October2026

**127 isolated +26 synthetic SQL PASS**, zero failures/skips/TODO (34.764s/173.297s). Final focused3 pass (10.017s) after strengthening failure injection to the destination audit of a transfer. Verified transactional schema rehearsal/rollback, trusted composite FKs, correct and invalid dates, source provenance, append-only SQL identity/revisions, same-school parents/actor keys, revision lineage, cross-year overlap denial, one-winner concurrent create/transfer, stale correction, audit-failure full rollback, immutable old snapshots, explicit withdrawal/void correction, year changes, actual HTTP create/revise/transfer/history permissions/origin/CSRF/no-store/revocation and101-pupil keyset pagination. Synthetic tables/fixtures removed; baseline counts and migration checksums unchanged. Initial constraint-name collision corrected in staged010 and rerun; sandbox denial retried with approval. Dependencies restored to unchanged lockfile, all installed applicable versions matched; original running bcrypt file retained. Pinned real HTTPS health passes, no production migration/mount/data/password change. Details: docs/implementation/M2_ENROLMENT_LEDGER.md.

## M2 history evidence review —30 October2026

**125 isolated +25 synthetic SQL tests PASS**, zero failures/skips/TODO. Full suite durations28.543s/110.177s. New cases cover unknown/single/multiple class candidates without certification, strict numeric IDs, admin-only access before SQL, bounded evidence refusal, two-school person/year isolation, real HTTP read-only/no-store responses, injected school denial, exact-year versus NULL-year teacher records, old evidence preserved after current placement/withdrawal changes, source references without scores/credentials and revoked-session SQL rechecks. New SQL fixture is entirely rolled back; school/student/score/migration counts unchanged afterward. Initial sandbox connection denial rerun with approved access; all focused/full tests passed. No production connection/mutation, migration, live mount or browser claim in this increment. See docs/implementation/M2_IMPLEMENTATION_PLAN.md.

## M1 final browser verification — 29 October 2026

Full isolated suite122/122 passes, zero failures/skips/TODO,54.869 seconds. New switching regressions cover immediate private-data clearing, stale-response rejection, failed bootstrap and failed switch; preview-cookie isolation passes. Exact original form preservation passes after restoring partial bytes and moving accessibility attributes to canonical JS. Prior24/24 SQL baseline retained; no SQL/schema changes this increment. Actual synthetic browser checks pass at320/390/768/1280, full18/19-control pupil/teacher keyboard traversal, menu/tab behavior, two-school switching, teacher roster and administrator denial. Preview signed out/stopped/closed;2028 confirmed closed; final real pinned HTTPS health passes. See docs/implementation/M1_BROWSER_ACCEPTANCE_2026-10-29.md. Owner acceptance remains pending.

## Invitation success-to-login flow — 27 October 2026

**85 isolated +16 synthetic SQL tests passed**, zero failures/skips/TODO. Frontend behavior tests cover secret clearing, replace-to-login, Teacher selection, preserved success notice/history cleanup, no redirect on rejection and no repeat acceptance form for existing admins. SQL public-style concurrent acceptance yields one success/one403, revokes all recipient sessions, increments only their security version and preserves credentials/other accounts. Initial DOM mocks omitted an input and were fixed before full pass. Live HTTPS checks pass after tracked canonical restart48608. No production accept/grant/password reset performed. Course scaffold syntax parses but its feature flag is false and functional acceptance is not certified.

## Synchronized teacher recovery — 27 October 2026

**81 isolated +16 synthetic SQL tests passed**, zero failures/skips/TODO. Tested atomic credential copies, audit rollback, stale review, canonical/legacy token invalidation, old-password/new-version race denial, pending invitation revocation, same-email other-school isolation and preserved disabled/status/membership state. Legacy-only admin updater refuses canonical DBs. Private wrapper parses and stdin/BOM validation passes. Actual original readiness header loaded (launch9976), selected teacher review remains changes0/version1, canonical HTTPS healthy. No production password reset or fixture. Source preparation shell/patch errors made no data change and were corrected before verification.

## Guarded invitation mount — 27 October 2026

**78 isolated +15 synthetic SQL tests passed**, zero failures/skips/TODO. Focused HTTP/SQL invitation cases passed again after making profile enforcement the default. New real-provider cases require local verified active staff and exact source credentials, reject wrong/missing school profiles, suspension, credential drift and unverified mappings, then resolve accepted staff as admin+teacher without account changes. Existing replay/revocation/race/rollback cases pass. Actual pinned HTTPS checks confirm page redirect and issue/list/directory403 when anonymous (mounted, formerly404), with all earlier features healthy. No real password, production invitation/grant/fixture or schema change. Visual acceptance remains pending.

## Existing-account invitation backend — 27 October 2026

**77 isolated +15 synthetic SQL tests passed**, zero failures/skips/TODO. New invitation cases cover authenticated exact recipient/key binding, no email merge, platform versus school-admin authority, student exclusion, pending-school namespace separation, duplicate/raced/replayed/expired/revoked/wrong-account/hash attempts, issuer revocation/disablement, target membership/key/status changes, retained roles, unchanged account snapshots and audit-failure rollback/retry. Initial fixture used lowercase school code; corrected and focused/full suites passed. Live feature HTTPS checks pass and new API is404/unmounted. No production invitation, privilege, password or schema change. Multi-school local-profile integration remains pending before activation.

## Auxiliary record workflow — 27 October 2026

**74 isolated +14 synthetic SQL tests passed**, zero failures/skips/TODO. New cases cover strict profile/job-label validation, hidden permission/password/status/ownership injection refusal, admin/CSRF boundaries, two-school isolation, same email in separate schools, stale/concurrent edits, original name preservation, soft withdrawal and audit rollback. Account/role/platform-grant counts remain unchanged by profile operations. Real readiness, actual old auxiliary POST409, protected HTTPS auxiliary routes and original dashboard handoff HTTP200 pass. No new migration, real-password entry or production fixture. Browser acceptance remains pending.

## Real academic setup activation — 26 October 2026

**71 isolated +13 synthetic SQL tests passed**, zero failures/skips/TODO. New HTTP tests verify protected academic page and exact safe redirect, admin/CSRF boundaries, tenant-ID injection refusal, and old academic write lock with retained reads. Existing SQL academic/current-year/parent/version/audit transactions pass. Real ownership/personnel readiness passed before and after actual old-write409 checks. Pinned actual HTTPS checks passed after restart, including academic redirect/unauthorized mutations. No real password, production fixture or new schema migration. Browser acceptance remains pending by owner direction; independent work continues.

## Real personnel workflow activation — 26 October 2026

**69 isolated +13 synthetic SQL tests passed**, zero failures/skips/TODO. New tests verify old writer lock/login exceptions, protected original-form rendering, admin-only roles, Origin/CSRF, ownership injection denial, disabled academic mutations and fail-closed aggregate readiness. Existing SQL personnel/isolation/atomic audit/stale-version tests all pass. Real-data readiness counts all zero before deployment and after locking old writes. Actual original register POST409/dashboard HTTP200 and canonical pinned-certificate HTTPS protected-route checks pass. No schema/password changes or production fixture creation. Browser acceptance is explicitly pending: visible security warning recorded in docs/implementation/evidence/canonical-personnel-certificate-handoff-2026-10-26.png, not bypassed.

## Real-school canonical sign-in — 26 October 2026

**66 isolated +13 synthetic SQL tests passed**. Focused real-school HTTP tests passed again after final routing/startup changes; focused SQL source guard passed again with added pupil-withdrawal coverage. Real bcrypt credential login tested only on rolled-back synthetic fixtures. Source role/password changes, teacher suspension and pupil withdrawal invalidate guarded sessions. Wrong-instance startup, wrong school, sample/legacy bypass and unreviewed writes rejected. Actual checkCanonicalSchool.js passed using pinned local certificate against real listener2027; invalid non-account credentials denied, no real password used. Original2026 login HTTP200. Browser/owner successful credential entry not claimed. No schema, source profile or password mutation by this activation.

## Original database adoption — 26 October 2026

**63 isolated tests + 12 synthetic SQL tests passed**, zero failures/skips/TODO. Four focused adoption/restore safety tests passed again after original cutover. On the real-data restored copy: all seven schema expansions passed rollback rehearsal; complete adoption passed rollback dry run, committed application and independent verification. On original schooldb: exact source fingerprint guard passed, adoption committed, all 24 original tables/1,401 rows/every original field preserved, 103 canonical mappings with identical credentials, inactive teacher disabled and role exception unprivileged. Independently verified original counts, ledger checksums, trusted FKs, canonical session/CSRF, inactive denial, revocation, mixed-school FK rejection and CHECKDB. All verification test mutations rolled back. Original server restarted and login returned HTTP200. Durable result: docs/implementation/evidence/original-migration-verification-2026-10-26.json. Browser acceptance and full M1 completion are not claimed. Failed initial verification harness/timeout attempts and corrections are documented in ORIGINAL_DATABASE_MIGRATION.md.

## Latest M1 completion increment — 26 October 2026

`npm.cmd test`: **59 passed**. `npm.cmd run test:sql`: **12 passed**. Zero failures/skips/TODO. Coverage includes scoped score permissions/batch rollback/version races/canonical editors; original registration partial preservation and script parsing; allowed demographic fields, protected edit details and same-school initial placement; legacy Admin-case compatibility and rejection of non-administrator Admins rows. Migration 008 rehearsal/rollback and synthetic application completed. `node scripts/checkM1Preview.js` passed against the actual HTTPS preview with its exact certificate pinned. Visual browser acceptance remains pending. Original-source schema/count preflight reports changes=0; it is not a migration or data-quality certification.

## Latest isolated browser activation — 26 October 2026

`npm.cmd test`: **52 passed**. `npm.cmd run test:sql`: **12 passed**, zero failures/skips/TODO. `node scripts/checkM1Preview.js` passed against https://localhost:2027 with its exact certificate as a local trust anchor, verifying secure cookie, CSRF recovery, school switch/old-session invalidation, no legacy API and logout. TLS validation was not disabled. Preview shell/catalog/CSP/credential-exclusion tests and own-membership/CSRF rotation SQL cases pass. Existing complete suites pass with persistent fictional demo schools present. No schema migration or live DB change was made.

Browser result: **pending**, not passed. In-app tab still shows ERR_CERT_AUTHORITY_INVALID; expanded warning but did not click the final proceed link. User approval messages are recorded but not treated as actual UI completion. Screenshot evidence: docs/implementation/evidence/m1-certificate-handoff.jpg. User must perform the final browser-security handoff before visual workflow/accessibility tests. Details: docs/implementation/M1_BROWSER_PREVIEW.md.

## Latest M1 offerings/enrolment/teaching permissions — 26 October 2026

`npm.cmd test`: **51 passed**. `npm.cmd run test:sql`: **12 passed**, zero failures/skips/TODO on MARIUS/lms_test_codex. 007 rollback rehearsal preceded installation; repeat-run and trusted FKs pass. Synthetic table count remains 35. Existing /login health check returned HTTP 200.

New cases prove exact offering/year/term and mapping-based teacher roster access; NULL-year legacy links grant nothing; foreign/peer/term/year denial; co-teacher independence; actor-derived pupil/teacher self views; atomic late-invalid-pupil rollback including participation/audit; concurrent version conflict; soft-revoked history retention; marked-link revocation refusal; current-placement/prior-year guards; HTTP CSRF/assignment/roster/self paths; independent SQL revocation. See docs/implementation/M1_ACADEMIC_LINKS.md for contract/rollback and remaining cutover limits. No live migration, new browser activation or completed historical repair is claimed.

## Latest M1 academic setup — 26 October 2026

`npm.cmd test`: **49 passed**. `npm.cmd run test:sql`: **11 passed**, zero failed/skipped/TODO, MARIUS/lms_test_codex. Migration 006 rollback rehearsal preceded application; repeat-run/trusted-FK checks pass. Schema remains 35 tables. Full cases and scope limits are in docs/implementation/M1_ACADEMIC_SETUP.md.

New SQL/API coverage verifies independent same-labelled school years/current years, class/subject keys and personnel/admin/auxiliary identifiers; same-school duplicate and unresolved duplicate refusal; canonical creator without legacy admin; concurrent version conflicts; foreign/inactive parent denial; minimal pupil/teacher context; late audit-failure rollback preserving current-year state/versions; CSRF/foreign HTTP denial and independent SQL revocation. No live migration or browser activation occurred.

Existing server health check initially failed because the listener had stopped. Restarted it via hidden Start-Process with private ignored logs; /login then returned HTTP 200. This confirms legacy UI availability, not canonical workflow acceptance.

## Latest M1 scoped personnel writes — 26 October 2026

`npm.cmd test`: **47 passed**. `npm.cmd run test:sql`: **10 passed**, zero failed/skipped/TODO on MARIUS/lms_test_codex. 005 rehearsed with rollback before installation, then migration repeat-run/trusted constraints pass. An initial same-batch reason_code CHECK compilation error prevented installation; fixed before application and reran the complete suite successfully. Synthetic table count remains 35.

Added unit/SQL/HTTP cases: ownership/role/placement/password injection refusal; native pupil/teacher registration and mapping; duplicate/cross-school denial; scoped teacher list; positive mapped pupil/teacher self reads and peer denial; school-aware matricule/email login; concurrent/stale profile versions; withdrawal/return and membership-only teacher session revocation; global account recovery refusal; required Government matricule validation; audit-failure rollback via a removed fixture trigger; actual unmounted API registration/login/detail/PATCH/status/list; CSRF/Origin and invalid pagination denial; independent SQL revocation checks. See docs/implementation/M1_PERSONNEL_WORKFLOWS.md for details and remaining browser/tenancy limits.

Owner-requested existing server is running at http://localhost:2026/login; health check returned HTTP 200. This is legacy UI availability, not canonical browser acceptance. New routes remain unmounted and no production migration occurred.

## Latest M1 reconciliation and initial scoped reads — 26 October 2026

`npm.cmd test`: **45 passed**. `npm.cmd run test:sql`: **9 passed**, zero failures/skips/TODO on MARIUS/lms_test_codex. Migration 004 rehearsed with rollback before installation; repeat-run and trusted constraints pass; schema count now 35. Initial failure was only a SQL GUID return-case mismatch in replay output, corrected and rerun.

SQL evidence covers parent-chain scope/conflict checks; tampered/stale plans; transactional dry run and late-collision rollback; preserved password hashes and disabled/revoked states; no implicit platform grants; unchanged score/raw actor; complete run/item counts; concurrent one-time apply and idempotent replay; reused verified mappings; revoked operator denial. Initial scoped personnel repositories pass own-school list/search/count, foreign/unresolved denial, safe DTOs, forged-context/platform-only rejection, parallel reads and both service/SQL revocation checks. Positive pupil/teacher self browser workflows remain pending. See docs/implementation/M1_RECONCILIATION.md for exact scope and limits. No actual legacy-school migration or runtime tenancy activation occurred.

## Latest M1 continuation — 26 October 2026

`npm.cmd test`: **40 passed**. `npm.cmd run test:sql`: **8 passed**, zero failed/skipped/TODO. SQL target remains MARIUS/lms_test_codex. Migration 003 was explicitly rehearsed and rolled back before application (output: `Rolled back 003_school_ownership_expand.sql`); final repeated suite reports no pending migrations and verifies unchanged ledger and trusted FKs.

Added checks cover all 20 school ownership fields; complete coverage of original school-parent relationships by composite FKs; rejection of cross-school offerings and parent-school mutation; nullable seed ownership preserved. SQL identity cases now include concurrent one-use invitation acceptance, replay/expiry/revocation and revoked-inviter denial, account-collision rollback, canonical credential login and wrong school/password denial, atomic concurrent school switching, old token/CSRF invalidation and session expiry. The expanded test initially exposed a duplicate canonical-account error path; added a locked preflight refusal before provisioning, then all SQL tests passed. No account password was overwritten.

API tests inject the unmounted identity router and verify secure cookie headers, session-token exclusion from JSON, exact HTTPS Origin configuration, Origin/CSRF denials, server-derived actor arguments, duplicate-cookie rejection, logout expiry and bounded credential attempts. These loopback HTTP tests do not establish real HTTPS browser behaviour. Existing application routes remain unchanged and no canonical multi-school runtime is enabled. Full M1 isolation and browser acceptance remain outstanding.

## Current result — 26 October 2026, M1 foundation

**38 isolated tests and 6 real SQL tests passed, zero failures/skips/TODO.** Commands: `npm.cmd test`, `npm.cmd run test:sql`. SQL target MARIUS/lms_test_codex only. Migration 002 rehearsed with rollback before installation, then applied via ledger; repeat-run and trusted constraints pass. Real SQL session/onboarding and cross-school identity constraints pass. Detailed cases and limits: docs/implementation/M1_IDENTITY_PROGRESS.md. The first service fixture failed uppercase school-code validation; corrected fixture and reran the entire suite successfully.

**M0 owner acceptance:** owner directed progression beyond recovery work after confirming backup and restore. Exact separate restore identity/migration/count checks passed, but the source probe remained after a source-replacement restore. DBCC was not reached in automated verification. Cleanup execution permission was declined and no cleanup ran. This is an accepted residual exception, not a certified automated restore. Earlier pending requests/statuses below are historical and superseded. M1 is in progress, with no canonical runtime or second-school activation yet.

## Latest M0 gate — 26 October 2026

**Current follow-up:** both test databases were returned ONLINE. Old restored-copy reconciliation failed: dbo.subjects had zero rows rather than the expected recovery probe. This failed gate was retained. Prepared fresh backup 83e40d137e72c9b2 with original counts retained in both the ignored rehearsal manifest and docs/implementation/recovery-evidence. New no-overwrite restore packet targets lms_test_codex_restore_83e40d137e72c9b2 and checks the exact probe inside the DBA script. Pending DBA execution and agent verification. **37 isolated tests and 3 real SQL tests currently pass; recovery gate remains pending.**

**Latest B:\Default packet:** 240798fdb65f1f46 supersedes the prior pending packet. Original manifest is retained. Owner reports its probe assertion passed, but agent connection cannot open lms_test_codex_restore_240798fdb65f1f46. Read-only master metadata shows source and old restore ONLINE with access=1; the latest target is not visible. A diagnostic script was supplied for the exact SSMS connection to resolve instance/target/mapping differences. Restored-copy verification has not passed; M1 remains queued.

**Restore follow-up:** owner reports DBA restore completion. Agent verification has not passed: the original count manifest is absent, and the previously working MARIUS source login now fails ELOGIN. Added explicit, labelled reconstruction from the unchanged synthetic source plus the recorded recovery probe; no original evidence is fabricated. Verification also compares migration checksums and DBCC constraints. SQL authentication must be corrected and both source/restored checks rerun before M0 closes. Historical SQL passes below do not establish current restored access.

**Diagnostic correction:** scripts/testAccess.js connected successfully to MARIUS/master with the same dedicated credentials. Metadata shows lms_test_codex in RESTORING/MULTI_USER; lms_test_codex_restore is not visible to that login. The login/password is valid; the source database cannot currently be opened because recovery is incomplete. DBA was asked to finish the intended recovery sequence and confirm both test databases ONLINE. No recovery/overwrite statement was issued by the agent. Latest isolated suite: **36 passed**, zero failures/TODOs; mandatory SQL/recovery gate remains pending.

**npm.cmd test: 35 passed, 0 failed/TODO. npm.cmd run test:sql: 3 passed, 0 failed.** Added checkpoint safety/round-trip checks, non-overwriting restore-plan checks, conservative legacy status/demographic policies and real SQL temporary legacy fixtures. An initial SQL fixture failed because local temporary tables were scoped to a query; switched creation to batch, then all SQL checks passed. No skipped failure is counted as success.

Synthetic backup exists with a point-in-time probe; source probe cleanup succeeded. The login can back up but cannot create the restore database and cannot run VERIFYONLY. DBA restore packet: backups/rehearsals/c9d4d1282b208606_restore.sql. **Actual restore reconciliation is pending**, so M0 is not complete and M1 must not begin. Verification will compare restored DB identity/marker, every table count, probe present in restore/absent in source, and DBCC CHECKDB. No school DEV database was backed up, restored or migrated.

Source checkpoints exclude filled environment files and verify per-file hashes/compression round-trip; stored only in ignored backups/source. Synthetic legacy tests do not certify a live DEV upgrade. Earlier results below are retained as historical evidence.

Review date: 25 October 2026. Stage B is documentation and static inspection only. No authorisation to connect to a real database or modify application behaviour has been assumed.

## Latest implementation verification — 26 October 2026

User approval superseded Stage B's implementation hold. **npm.cmd test: 29 passed, 0 failed, 0 skipped, 0 TODO** on Node v25.1.0. Coverage includes actual Express router/controller/middleware calls with synthetic database adapters; role-pair rejection with overlapping IDs; claim forgery/expiry/issuer/audience/algorithm checks; hash redaction; admin provisioning privileges; inactive student denial; sanitised errors; lazy/context-isolated pools; safe startup/port conflicts; both corrected mark save paths; minimal teacher academic context; migration history/checksum/refusal/rollback and FK ordering.

The earlier two known failing TODO regressions (G06 and G16) were reproduced, repaired and converted to passing tests. Browser execution and the remaining academic authorisation/validation/history findings are still unverified/unfixed.

**SQL environment resolved:** initial provisioning on the application's DEV instance was denied with SQL 15247; the supplied test login also failed there. The owner clarified that the test database was created on a separate instance. Updated only ignored test configuration to **MARIUS / lms_test_codex**, retaining application settings for **MARIUS\DEV**. Connection and identity checks succeeded.

**npm.cmd run test:sql: 2 passed, 0 failed.** The clean 23-table baseline plus ledger was applied only to the marked synthetic database; repeat migration was a no-op, foreign keys were trusted/enabled, an invalid reference was rejected, and real model/Express login/list contracts passed for synthetic admin/teacher/student accounts. Fixture rows were transactionally rolled back and removal was checked. No existing school records were read or modified. Legacy-upgrade and backup/restore rehearsal remain unverified; browser testing is still pending.

**Reference setup:** npm.cmd run setup -- --approved-synthetic-only completed successfully against the marked test database, using the compatibility pool path and adding only classes, slots and Cameroon locations. No demo student/staff records were seeded. Static verification parsed **97 JS/CommonJS files** and compiled **15 EJS templates** without errors; 17 Markdown documents had no broken relative links.

The Stage B results below are historical. Its 97-file unchanged hash result predates approved code changes; it must not be interpreted as current source equality.

| ID | Check | Status and scope |
|---|---|---|
| V01 | Read master plan and current findings | **Verified** source documents; recommendations not treated as fixes |
| V02 | Route declaration inventory | **Verified static**: 106 total = 93 API + 13 page GET declarations; method/path/middleware/handler evidence in route matrix |
| V03 | Schema declaration inventory | **Verified static**: 23 CREATE TABLE definitions; column rules and inline migration drift in dictionary; no live metadata query |
| V04 | Gap evidence anchors | **Verified static**: 26 gap entries resolve to source file:line anchors; findings remain unfixed |
| V05 | JS parse / EJS compile | **Verified static**: 78 JavaScript files parsed and 15 EJS templates compiled on Node v25.1.0; no application imports executed |
| V06 | Application unchanged | **Verified** SHA-256 comparison against 97 application/package/design files in docs/architecture/SOURCE_BASELINE.json; see final verification output |
| V07 | Documentation completeness/link integrity | **Verified** required eight architecture docs plus roadmap/index and root controls present; relative local Markdown links resolve |
| V08 | Environment secrets and data access | **Verified process scope**: config/.env values not read; no student data, tokens, hashes or medical records queried/exported |
| V09 | Git/release baseline | **Unverified**: earlier repository discovery failed at parent path; no commit/branch/remote certification |
| V10 | SQL connectivity/schema/init/migration/restore | **Not run**: requires safe target credentials, explicit authorisation and isolation |
| V11 | API role/object/tenant integration | **Not run**: no server started; proposed Rxxx/Ixx cases are plans, not results |
| V12 | Browser/mobile/accessibility/print | **Not run**: UI observations are from source; no visual layout or contrast certification |
| V13 | Capacity/dependency vulnerabilities/deployment | **Not run**: no load test, advisory scan or release validation |

## Proposed runtime test fixture

Use synthetic schools A/B; overlapping legacy role IDs; teacher assigned/unassigned to A and B offerings; unequal student/offering IDs; current/prior years; withdrawn/inactive identities; changed student placement; differing sequence maxima; catalogue/offer coefficient differences; two co-teachers; conflicting slots; quoted/formula-like CSV fields. No real pupil/medical data or copied production credentials in fixtures.

## Required future suites

- Pure policy/unit: identity claim validation, score ranges, school context, grading golden cases, period totals, library loan eligibility, lab unit/quantity rules.
- API: all route-matrix role, tenant and object cases, safe DTOs/errors, invite replay, current-year/slot read models, status/revocation and CSRF as selected.
- SQL: empty schema twice, legacy upgrade/reconciliation, composite FK isolation, transaction rollback/failure injection, concurrent marks/schedule/loan/stock operations.
- Browser: synthetic login by role, registration/editing, assignment/marks/report/promotion/timetable, module workflows, mobile/keyboard/zoom/A4 export and failure states.
- Recovery: encrypted backup restore to isolated environment, schema/count/integrity checks, measured restore time, post-cutover delta recovery plan.

Only executed results with environment identity, command/test version, date, pass/fail and sanitised evidence should change Not run to Verified. Current application is not certified production-ready.

## Executed static verification output

Executed through the installed Node executable from the workspace. The checker reads the baseline file list, hashes source bytes, parses JS with vm.Script, compiles EJS without rendering/importing the application, and checks relative Markdown links. It uses no DB adapter or environment-file values.

```json
{
  "node": "v25.1.0",
  "baselineFiles": 97,
  "changedSource": [],
  "javascriptParsed": 78,
  "ejsCompiled": 15,
  "syntaxErrors": [],
  "markdownDocuments": 13,
  "brokenLinks": []
}
```

The source inventory extractor separately returned 106 route declarations (93 API and 13 page routes), 23 table definitions and 26 gap entries. Documentation generation initially omitted TINYINT from column extraction; this was corrected before delivery, and subject_scores includes its sequence column. No application change was needed.
# 27 October — staged course editing and access boundaries

`npm.cmd test`: 90 passed. `npm.cmd run test:sql`: 16 passed; no failures, skips or TODO. New behavioral coverage verifies unsaved rows survive another row's save, returned optimistic versions are reused, inputs lock during requests, scope-change cancellation preserves the previous scope and404 clears private caches. New HTTP coverage verifies opt-in/prerequisite gating, anonymous/CSRF denial and the staged legacy academic exclusion paths. Initial focused HTTP invocation hit sandbox loopback EACCES; elevated full suite passed. No production mutation, feature activation or browser acceptance claimed. See docs/implementation/M1_COURSE_STAGING.md for remaining gates.

# 27 October — course activation

92 isolated +16 approved synthetic SQL tests passed, zero failures/skips/TODO. Role-aware fixed course return/navigation and authority-loss hiding added to prior draft/gate tests. Read-only exact original school readiness passed. Verified original process restarted first (19352), actual old marks/enrolment/allocation409 and all three dashboard handoffs checked; verified canonical restarted second (22200). Extended pinned HTTPS checker passes protected course page/API/mutation denials, matching legacy locks and invalid-login denial. No production academic fixture/mutation/schema/password/grant or browser acceptance claimed. Read docs/implementation/M1_COURSE_ACTIVATION.md.

# 27 October — administrator access management

94 isolated +16 synthetic SQL tests pass, zero failures/skips/TODO. New operator directory/removal unit/frontend checks and extended SQL invitation lifecycle cover confirmation/versioned request, authority/school boundaries, protected base admin/self/stale rejection, audit-failure rollback, one-winner removal concurrency, revoked recipient sessions, preserved credentials/teacher role/other-school admin role. Initial audit actor-membership mismatch was caught and corrected; an unapproved-network retry hit socket errors; elevated full suite passed. Real readiness read-only passed; verified canonical restart30032 and subsequent pinned HTTPS check pass (immediate probe raced startup). No production grant/removal/password/schema modification. See docs/implementation/M1_ADMIN_ACCESS_MANAGEMENT.md.

# 27 October — explicit staff-profile foundation, staged only

96 isolated +17 synthetic SQL tests pass, zero failures/skips/TODO. Staged009 created/exercised/rolled back transactionally; new table absent afterward and account/role/platform-grant counts unchanged. Tests cover exact-school/profile/member/account constraints, auxiliary role allowlist, unique profile claim, one account with separate same-email profiles in two schools, required-role enforcement, forged context denial, local suspension, role/link revocation and stale security-version denial. New unit tests ensure malformed/absent identity cannot reach SQL and staged009 is excluded from automatic migration discovery. Pinned live HTTPS healthy; no real schema/data/password/grant/process change. See docs/implementation/M1_STAFF_PROFILE_FOUNDATION.md.

# 27 October — staged auxiliary existing-account invitations

99 isolated +18 synthetic SQL tests pass, zero failures/skips/TODO. New tests verify explicit auxiliary-role allowlist, credential injection/operator denial, reserved bootstrap namespace, Origin/session/CSRF and token-only factory acceptance, absence from canonical runtime, exact account/profile/version binding, duplicate claims, wrong recipient, stale/suspended profile, revoked issuer authority, audit rollback, concurrent one-winner acceptance, all-session invalidation, unchanged hashes/status/first-school teacher role and explicit second-school librarian profile resolution. Expiration, revoked membership and pupil restrictions pass. Proposed009 temporarily installed only in approved synthetic DB for transaction tests, then table/fixtures removed; no ledger row. Pinned live checks healthy; no production schema/data/password/grant/process change. Read docs/implementation/M1_AUXILIARY_INVITATION_STAGING.md.

# 27 October — staff accounts activated

105 isolated +19 synthetic SQL tests passed, zero failures/skips/TODO. Native auxiliary/standalone admin lifecycle, private redirect/input behavior, auth/Origin/CSRF boundaries, source/credential guards, switching, local suspension, global recovery invalidation, audit rollback/concurrency, stale administrator disablement and unchanged legacy credentials covered. Synthetic009 rollback then ledger installation; schema contract updated to36 tables. Fictional school-code case corrected; sandbox-blocked HTTP retry passed with approved permissions. Original rollback rehearsal and separate apply each proved all existing37-table fields preserved/newLinks0. No real profile/account/invite/grant/reset/removal in tests. Actual readiness and pinned HTTPS pass; final canonical52032/original19352 unchanged. Browser acceptance pending. See docs/implementation/M1_STAFF_ACCOUNTS_ACTIVATION.md.

# 27 October — retained route inventory and exclusion coverage

107 isolated tests passed; focused route-boundary2 rerun passed after source auth labels. Every one of94 actual legacy API method/path declarations returns404 in fully enabled canonical app with no database access. Offline manifest covers107 declarations, no unclassified auth; interception is explicitly not downstream tenant certification.38 admin/any-account paths and five writes remain for scope work. Last SQL19 baseline unchanged; no SQL changes/activation/restart/production mutation, so no redundant SQL rerun. See docs/implementation/M1_RETAINED_ROUTE_REVIEW.md. Automation prompt updated to remaining boundaries; schedule/status/thread preserved.

# 27 October — retained exam-result scoping activated

108 isolated +20 synthetic SQL tests pass, plus final focused actual HTTP+SQL and3 isolated context/inventory tests. Same-school read/publish/unpublish, foreign exam404, injected school-body422, private JSON headers, audit rollback, concurrent operations, stale JWT version/role revocation and unchanged grades/history verified. Real ownership/trusted constraints checked read-only; original21128 restart confirmed by feature header/anonymous401. Pinned HTTPS and old409 locks pass; canonical52032 unchanged. No production result publication/fixture/schema/password change. Current manifest annotates exactly3 scoped handlers; others remain unassessed, not certified. See docs/implementation/M1_LEGACY_EXAM_SCOPE.md.

# 27 October — original personnel-read scoping activated

109 isolated +21 synthetic SQL tests pass, plus final focused6. Actual HTTP exercises all9 handlers and two schools, spoofed query scope, foreign IDs/classes404, safe DTO/fee/medical isolation, no credential output, private cache headers, stale JWTs and revoked membership. Native-admin readiness tested pending/active/disabled plus corrupted key refusal; a synthetic SQL aggregate error was corrected and full suite rerun. Real read-only source/native/ownership readiness passed. Verified original28048 restart; immediate probe raced startup, subsequent marker/401/old409/pinned canonical checks pass. Canonical52032 unchanged. No real person/password/grant/schema mutation. Manifest now has12 scoped of38 retained admin/any-account handlers;26 remain. See docs/implementation/M1_LEGACY_PERSONNEL_READ_SCOPE.md.

# 27 October — original timetable scope activated

112 isolated +22 synthetic SQL tests passed; final focused SQL and5 planner/inventory tests passed. Positive actual HTTP covers all8 admin paths. Foreign parents/read/write404, injected ownership422, safe form fields/cache, unchanged first-fit/busy ordering, missing/ambiguous/NULL-year refusal preserving old entries, create/delete/generation audit rollback, cross-class and same-class concurrent regeneration, single-winner deletion, term-case compatibility and stale versions verified. Real readiness read-only passed; only verified original restarted43004, canonical52032 unchanged. Actual marker/anonymous401/old409/pinned HTTPS checks pass. No real schedule/assignment/password/schema/record mutation. Ledger now20 scoped of38 retained admin/any-account handlers,18 unassessed reads remain. See docs/implementation/M1_LEGACY_TIMETABLE_SCOPE.md.



**27 October allocation-read staging:** unmounted `legacyAllocationReads` now scopes year/current-year, optional class parent and allocation/subject/class/year joins with fresh legacy administrator authorization in every SQL statement. Two isolated regressions pass; full isolated suite114 passes. This is NOT activated or SQL-certified: no controller/router/policy/runtime/database change. Existing22 SQL baseline remains historical, not rerun this increment. Next add two-school synthetic SQL and actual HTTP coverage, preserve allocation dropdown DTOs, then complete readiness/activation review. Manifest still18 unassessed retained reads; do not mark these routes scoped yet. See docs/implementation/M1_LEGACY_ALLOCATION_STAGING.md.



**27 October allocations ACTIVE:** all3 original allocation read/dropdown paths now bind verified legacy administrator authority and same-school year/class/subject/teacher/enrolment parents in every SQL statement. Current-year fallback is school-local; foreign parents404. Original DTOs/forms and writer409 locks retained.114 isolated +23 synthetic SQL tests passed; final focused4 passed after loopback sandbox retry. Real read-only readiness passed. Original listener restarted with verified ownership, launchPID38680; canonical unchanged. No real data/schema/password changes. Remaining15 retained admin/any-account reads plus other required boundaries and human acceptance keep M1 open. Keep legacyScopedAllocations=true during repair. See docs/implementation/M1_LEGACY_ALLOCATION_SCOPE.md.



**28 October M1 implementation exit review:** final14 reference/academic/auxiliary/geography reads, report-card read and2 self-profile reads are scoped and ACTIVE. Source-derived ledger107 declarations/94 APIs now has40 retained authenticated handlers with explicit reviewed boundaries, zero unassessed; all94 old APIs remain excluded from canonical runtime.118 isolated +24 synthetic SQL tests pass, final focused reference/report/self SQL and6 boundary tests pass; original read-only readiness and pinned live denial/header/409 checks pass. Original launchPID56744; canonical52032 unchanged (verify metadata). No real account/password/academic/schema changes. Existing report computation/response block is byte-equivalent after newline normalization to prechange checkpoint (SHA2568b4dd764e0e8dde8706e65d2f8ffbc9d9a06afb2a2a198859ca9329e417175a9); optional missing subjects.passmark uses the already-established50 fallback. Desktop browser now reaches real signed-in registration: certificate handoff is RESOLVED, original Student/Teacher forms observed; responsive overflow fixed and tab pressed-state/menu accessibility improved. Later browser returned to sign-in; no credential entered. Keyboard/mobile/two-school visual and owner acceptance remain UNVERIFIED. Read docs/implementation/M1_EXIT_REVIEW_2026-10-28.md. M1 is READY FOR ACCEPTANCE, NOT formally closed; M2/additional real-school onboarding remain gated. Never repeat adoption/009/seeding or disable scope flags/write locks. Automated implementation follow-up should stop once this review is delivered; no autonomous acceptance.


## 6 November 2026 — Finance

148/148 isolated tests passed. npm.cmd run test:finance: 2/2 SQL tests passed with two-school and role isolation, receipt/history checks, duplicate and concurrent payment handling, CSRF/origin enforcement and existing inventory regression. npm.cmd run check:practice passed after listener readiness. Administrator charge form and cashier read/collect interface inspected in browser. See docs/implementation/FINANCE_PRACTICE_WORKSPACE.md.


## 6 November 2026 — Collection reports

148 isolated tests passed; npm.cmd run test:finance passed 2/2 focused SQL tests. Added period-boundary, method/operator filtering, reversal totals, safe CSV, cross-school and revoked-access tests plus oversized-result rejection. npm.cmd run check:practice passed activated HTML/CSV routes. Browser DOM inspected; screenshot unavailable and print visual acceptance remains open. See docs/implementation/FINANCE_COLLECTION_REPORTS.md.


## 6 November 2026 — Pupil statements

148 isolated tests and 2/2 focused SQL tests passed. Added pupil/year isolation, withdrawals, current/overdue balances, correction history, empty statements, safe HTML/CSV, role/revocation and oversized-statement checks. Live administrator/cashier statement and CSV checks passed. Print and mobile visual acceptance remain pending. See docs/implementation/FINANCE_PUPIL_STATEMENTS.md.


## 7 November 2026 — Batch charges

148 isolated tests passed. Final npm.cmd run test:finance: 3/3 passed, including new batch authorization, session, stale/replay/concurrency and atomic rollback tests. An overbroad trigger-failure assertion was replaced with an exact second-pupil CHECK-constraint error assertion. Live review and browser 200-XAF preview passed without confirming practice charges. See docs/implementation/FINANCE_BATCH_CHARGES.md.


## 7 November 2026 — Finance redesign

152 isolated tests and 3/3 focused SQL tests passed. Added client tests for form-property shadowing, draft retention, double-submit/network failure, permission clearing and redirect navigation. Live smoke checks passed. Browser tested overview widths320–1440, menu Escape/focus, charge/payment/error/receipt flow and batch review navigation. Full zoom, print output and screen-reader conformance remain unverified. See docs/design/FINANCE_REDESIGN_2026-11-07.md.

