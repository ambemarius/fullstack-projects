# KodoSchool — secondary-school management

KodoSchool is a school management system for Cameroonian secondary schools (Anglophone GCE and Francophone Baccalauréat streams). Node.js 20 / Express 5 / EJS server-rendered pages, Microsoft SQL Server, no front-end build step.

**Covers today:** student, teacher and auxiliary-staff registration with photos and documents; classes, subjects, academic years and teacher assignments; timetables; sequence marks with change history; class report cards; end-of-year promotion; a parent/guardian portal (verified by the guardian phone on the student record); staff duties; **financial management** at `/finance` (charging a class or a student, recording what a student paid with one combined receipt, reversals and cancellations, outstanding balances by class, student statements, collection reports and CSV), run by the bursar; **attendance** (teachers take registers for their timetabled lessons from their dashboard; administrators and the discipline master use `/attendance` for justification and term totals, and a discipline master can be limited to chosen classes, which then appear under **Discipline** in their teacher portal; absence hours appear on report cards and on student and parent dashboards); **library** at `/library` (catalogue, lending with a per-student loan limit, renewals, returns, lost/damaged review, overdue list by class; students and parents see current loans) and **laboratory** at `/laboratory` for the Physics, Chemistry, Biology, Geology and General laboratories (hazard classes, reorder and expiry warnings, receiving, stock counts and disposal with reasons, usage by subject) with teacher requests at `/lab-requests` (requested before the practical; equipment carries a return-by date, is checked back in as good, damaged or missing, and overdue equipment blocks new equipment requests). Teachers, students and parents each get a panel with a sidebar of sections; students and parents see results by subject with one column per sequence and the term or year average. Multi-school tenancy remains staged code behind the `model/identity` layer.

## Install and run a school instance

Full procedure, including TLS, backups and the restore drill: **[docs/operations/RUNBOOK.md](docs/operations/RUNBOOK.md)**. The short version:

```bash
npm ci --omit=dev
cp config/.env.example config/.env        # fill DB_STRING, JWT_SECRET, PUBLIC_ORIGIN, ADMIN_EMAIL, ADMIN_PASSWORD
node scripts/migrate.js --production      # versioned schema, safe to re-run
npm run seed                              # first administrator, then remove ADMIN_* from config/.env
pm2 start ecosystem.config.js             # or: npm start / docker build -t lms .
```

Health check: `GET /health`. Default port 2026; put it behind a TLS reverse proxy and set `PUBLIC_ORIGIN` to the public URL.

### Configuration (`config/.env`)

| Variable | Purpose |
|---|---|
| `DB_STRING` | SQL Server connection string (dedicated login, one database) |
| `JWT_SECRET` | 48+ random bytes; unique per installation |
| `JWT_EXPIRES_IN` | Session lifetime, default `1h` |
| `PUBLIC_ORIGIN` | Public https origin; used for cookie origin checks |
| `WORKSPACE_BASE_URL` | Leave empty. Only set when the separate canonical workspace server is deployed. |
| `UPLOAD_DIR` | Where photos/documents are stored (default `uploads/`, served via `/files/:name` to signed-in users) |
| `PORT`, `NODE_ENV` | Standard |

Feature flags live in `config/runtimePolicy.json` (`parents.enabled`, `analytics.enabled`, `notifications.*`). The `canonical*` / `legacyScoped*` keys switch the app into the two-server migration mode described under *Architecture*; keep them `false` for a single-server school deployment.

## Accounts

Five account types, each with its own login endpoint and HttpOnly cookie plus bearer token: **administrator** (email), **teacher** (email), **student** (matricule), **parent/guardian** (phone) and **non-teaching staff** (email; an administrator sets their password under Personnel → Duties and sign-in). School **duties** (bursar, librarian, laboratory attendant, discipline master) are granted by an administrator to teachers or non-teaching staff and decide access to the school modules through `middlewares/staffAccess.js` (`requireStaff`). Logins are rate-limited (10 attempts / 15 min). Administrators cannot delete their own or the last admin account; students and teachers are withdrawn/deactivated, never hard-deleted.

## Development

```bash
npm start            # or npm run server (nodemon)
npm test             # 250+ isolated tests; no database needed
npm run test:sql     # optional, against the approved synthetic SQL instance (see docs/implementation/TEST_DATABASE_SETUP.md)
```

Code map:

| Location | Responsibility |
|---|---|
| `server.js`, `app/app.js` | Startup, `createApp` factory, middleware and router mounting |
| `routes/`, `controllers/`, `model/` | HTTP contracts, workflows, parameterised SQL |
| `middlewares/` | Role auth (`roleAuth.js`), login rate limit, uploads, feature gates, error handler |
| `views/`, `public/` | EJS pages, `style.css` design tokens, browser modules (`window.LMS`, `api()`, `toast()`) |
| `migrations/`, `scripts/migrate.js` | Versioned schema with checksum ledger |
| `services/` | Notification channels (email/SMS/in-app, flag-gated) |
| `tests/` | `node:test` suites exercising the real Express app with a synthetic SQL adapter |
| `docs/operations/` | Runbook (install, TLS, backups, restore drill) |
| `scripts/timetable/` | Timetable scheduler (export inputs, generate, add placeholder teachers) |

## Architecture note

Between October and November 2026 the project ran as two servers: this application on port 2026 and a "canonical school workspace" (`scripts/canonicalSchool.js`, `model/identity/**`, `routes/identity/**`) on https://localhost:2027 that owned writes behind the `canonical*` policy flags. For a deployable product the owner chose the **single original application**: the flags are off, port 2026 owns all reads and writes, and the identity layer remains in the tree as staged future work (multi-school tenancy, school-local administrators, attendance, finance).

Never run `scripts/seedDemo.js` against a real school database.
