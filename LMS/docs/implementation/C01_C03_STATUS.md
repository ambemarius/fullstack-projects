# Approved implementation: foundation and authentication containment

Updated 26 October 2026 (Africa/Lagos). The owner approved all proposals and separately authorised a disposable synthetic SQL database on the locally configured server. This approval accepts the proposed architecture/defaults; unknown factual values, grading thresholds and real-data mappings are not invented.

## C01 — implemented; isolated tests verified

Files: app/app.js, config/environment.js, config/database.js, server.js, package.json, tests/setup.cjs and test helpers/suites.

The application is constructed through createApp. Imports no longer load local credentials, connect to SQL, run DDL or listen on a socket. The existing model pool/poolConnect interface remains available through a lazy adapter. AsyncLocalStorage provides test-only request-scoped database overrides; concurrent synthetic contexts are isolated. Server startup explicitly connects, listens and closes; it no longer creates the admin table.

Tests refuse default DB_STRING and require an exact allowlisted synthetic database/server plus separate credentials. Unit/API fixtures use in-memory SQL adapters, not a real database. Loopback ephemeral HTTP servers exercise real Express routers/controllers/middleware.

Migration impact: none. Rollback: bounded source/config revert, preserving the auth security fixes when rolling back later work. Runtime compatibility with real SQL transactions remains pending SQL integration.

## C02 — implemented transitional containment; synthetic API tests verified

Files: config/auth.js, utils/generateToken.js/verifyToken.js, roleAuth and role middlewares, admin router/controllers, teacher/student login controllers, student list projection, globalErrHandler, scripts/seedAdmin.js, config/.env.example and .gitignore.

JWTs require a local environment secret, explicit account type, versioned claims, subject, issuer/audience and expiry. Wrong-role tokens are rejected before account lookup, including overlapping legacy IDs. Old tokens are invalidated. This is transitional containment; canonical accounts, memberships and HttpOnly sessions are still pending M1.

Admin registration requires existing admin authentication and cannot create arbitrary role names. First-admin seed requires explicit credentials and no longer logs passwords. Withdrawn students cannot log in or use protected APIs; teachers require active status. Student listing selects password-safe columns; errors omit stacks/internal driver details and carry a request ID. Automatic npm process-kill hooks were removed.

A signing secret was generated locally and appended only where missing/too short; its value was never displayed or added to tracked documentation. Existing DB connection settings were not changed. Login again after restarting the server; existing bearer tokens are intentionally invalid.

Migration impact: none. Rollback must not restore ID-only tokens, public admin provisioning, credential disclosure or automatic port killing.

## C03 — clean baseline implemented and verified on the separate test instance

Files: migrations/001_legacy_baseline.sql, scripts/migrate.js, scripts/createTestDatabase.js, scripts/testEnvironment.js, tests/migrations.test.js and tests/sql/schema.test.js.

Baseline contains the 23 existing table domains in FK order, teacher matriculeFile compatibility and an explicit timetable slot FK. The migration runner uses a transaction/application lock and checksum ledger, rejects checksum/history mismatch and refuses existing unversioned schemas. Offline tests verify ordering, refusal, ledger behaviour and rollback orchestration. Real SQL tests subsequently applied the baseline, reran it as a no-op and verified trusted FKs, invalid-reference rejection and model/API contracts with rolled-back synthetic fixtures.

Disposable provisioning was attempted using the configured connection, targeting master metadata and a new lms_test_codex database only. The sandboxed attempt timed out. The approved outside-sandbox attempt reached SQL Server but CREATE LOGIN failed with SQL error 15247. Provisioning stopped before CREATE DATABASE. No new database/login or existing school records were changed by the failed statement. No credentials appeared in output.

The owner subsequently selected lms_test_codex and supplied dedicated credentials, saved to ignored config/.env.test.local. Initial ELOGIN was resolved by the owner's clarification that this database is hosted on **MARIUS**, separately from the application's **MARIUS\DEV** instance. The verified target remains MARIUS/lms_test_codex; application connection settings were not changed. **Two real SQL tests pass.** The approved reference-data setup also completed through the lazy-pool compatibility path, adding only classes, slots and Cameroon locations. Backup/restore and legacy-upgrade rehearsal remain follow-up work. See TEST_DATABASE_SETUP.md.

## Remaining gates

M0 is not complete: expanded SQL integration, legacy-upgrade fixtures and restore rehearsal remain pending. M1 school isolation is not implemented and a second real school must not be onboarded. G06/G16 were reproduced then repaired: all four mark-enrolment calls now use correct argument order; teacher marks and student/teacher timetable screens use a new minimal authenticated academic-context endpoint. Both mark save routes and teacher context pass synthetic API tests. The route matrix gained R107. No schema or grading policy change was required by these bounded repairs.

Latest results: **npm.cmd test: 29 passed; npm.cmd run test:sql: 2 passed; 0 failures/TODOs.** Report passmark/history, full mark validation/ownership/transactions and other audit findings remain open. No production migration, real-data copy, legacy reseed or password reset was run.
