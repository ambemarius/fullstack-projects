# LMS — secondary-school management

Express/CommonJS, Microsoft SQL Server, EJS, CSS and browser JavaScript for Cameroonian secondary-school administration. Existing workflows cover registration, personnel, classes/subjects, academic years, teacher assignments, timetables, sequence marks, reports, promotion and separate MCQ APIs. Attendance, library, laboratory inventory and multi-school tenancy are planned; they are not complete.

## Current status

The architecture proposals were approved and implementation proceeds through [sequential phase gates](PHASE_STATUS.md). Read [implementation status](docs/implementation/C01_C03_STATUS.md), [test results](TEST_RESULTS.md), [architecture review](docs/architecture/README.md) and [roadmap](docs/architecture/M0_M1_ROADMAP.md). There are 35 passing isolated tests and three passing real SQL tests on a separate synthetic instance. M0 awaits actual restore verification before M1 begins. Do not onboard a second school before tenancy/isolation work is verified.

## Local application configuration

Install dependencies with npm install when needed. Copy config/.env.example to config/.env if no local configuration exists, then supply the actual SQL Server DB_STRING and a private JWT_SECRET of at least 32 bytes. Do not overwrite an existing local config or commit credentials. An existing local config was retained and its missing signing secret provisioned during implementation.

Use npm start or npm run server (nodemon) with an already prepared schema. Default HTTP port is 2026. Startup explicitly connects to SQL but performs no schema creation and never force-kills another listener. Existing tokens from the previous ID-only authentication are invalid; log in again after restarting.

The first administrator must be provisioned explicitly against a prepared schema with ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) configured locally. npm run seed uses those supplied credentials; it does not create tables or print passwords. POST /api/v1/admin/register now requires an authenticated administrator. There is no universal development password.

## Tests

```powershell
npm.cmd test
```

This command does not load workstation credentials or connect to a real database. It exercises the real Express routes/controllers with synthetic adapters, identity/security rules, configuration guards and migration orchestration.

For the explicitly approved disposable SQL target, follow [DBA setup](docs/implementation/TEST_DATABASE_SETUP.md). Fill the ignored config/.env.test.local using its example, verify identity and marker, then:

```powershell
node scripts/verifyTestDatabase.js
npm.cmd run test:sql
npm.cmd run setup -- --approved-synthetic-only
```

Only **MARIUS / lms_test_codex** is approved for this test work; application configuration remains **MARIUS\DEV**. Identity checks and the clean-baseline SQL suite pass. No production backup/restore or legacy data migration has been performed.

## Schema and maintenance

The versioned clean baseline defines 23 application tables. It is intended for an empty, marked synthetic database and uses a checksum ledger/application lock/transaction. Existing unversioned databases are refused. The legacy setup command no longer runs inline destructive schema backfills. npm run init is not a supported unattended production setup path.

Do not run seedStudents.js, resetPasswords.js or old migration scripts against existing school data. They remain historical maintenance files with potentially destructive behaviour. Real-data upgrades require the reviewed migration/backfill/backup process.

## Code map

| Location | Responsibility |
|---|---|
| server.js | Explicit startup, shutdown and configuration validation |
| app/app.js | createApp factory and router mounting |
| config | Lazy SQL adapter, runtime/auth configuration and private local files |
| routes / controllers / model | HTTP contracts, workflows and parameterised SQL |
| middlewares / utils | Role authentication, error responses and strict token claims |
| views / public | EJS pages, styles and browser workflows |
| migrations / scripts | Versioned clean baseline and guarded maintenance tooling |
| tests | Isolated API/unit regressions; separately invoked real SQL suite |

API base is /api/v1; the [route matrix](docs/architecture/ROUTE_PERMISSION_MATRIX.md) inventories the audit baseline plus implementation additions. Three account types exist today; platform/school memberships and HttpOnly session migration remain future M1 work. Critical remaining work includes teacher object authorisation, historical enrolments, report policy/schema consistency, mark validation/transactions and timetable integrity.
