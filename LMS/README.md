# LMS — School Management System API

Node.js + Express REST API backed by **Microsoft SQL Server**, with JWT auth for
**admins, teachers, and students**, and full academic management (subjects,
classes, academic years, exams, multiple-choice questions, and gated results).

---

## 1. Prerequisites

- **Node.js** 18+
- **SQL Server** running locally with a database and a SQL login.
  The app reads its connection string from `config/.env`.

## 2. Install dependencies

```bash
npm install
```

## 3. Configure the database connection

Edit **`config/.env`** (an ADO.NET-style connection string):

```env
DB_STRING=Server=MACHINE\DEV;Database=schooldb;User Id=schoolapp;Password=YOURPASS;Encrypt=false;TrustServerCertificate=true;
PORT=2026
```

> Named instances (e.g. `MACHINE\DEV`) are resolved via the SQL Browser service.
> You can also use `Server=localhost,1440` to point at a fixed TCP port.

## 4. Create the tables + seed the first admin

```bash
npm run init
```

This runs `setupAcademic.js` (creates all 13 tables, seeds the 21 classes) and
`seedAdmin.js` (creates the default admin). Both are **idempotent** — safe to
re-run.

Default admin (override with `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars):

```
email:    admin@school.local
password: Admin@123
```

Individual steps if you prefer:

```bash
npm run setup   # tables + classes only
npm run seed    # admin only
```

## 5. Run the server

```bash
npm run server   # nodemon (auto-reload, for development)
# or
npm start        # plain node
```

Server starts on **http://localhost:2026** (or `PORT` from `config/.env`).
Visit `/` for a health/landing page.

---

## Quick smoke test (Postman / curl)

1. **Login** to get a JWT:
   ```
   POST http://localhost:2026/api/v1/admin/login
   Body (raw JSON): { "email": "admin@school.local", "password": "Admin@123" }
   ```
2. Copy the `token` from the response.
3. Call any protected route with header `Authorization: Bearer <token>`, e.g.:
   ```
   GET http://localhost:2026/api/v1/admin/profile
   ```

---

## API overview  (base path `/api/v1`)

| Group | Base | Highlights |
|---|---|---|
| Admin | `/admin` | register, login, CRUD, suspend/withdraw teacher, publish results |
| Teachers | `/teachers` | admin-register, login, profile, CRUD |
| Students | `/students` | admin-register, login (matricule), profile, CRUD |
| Subjects | `/subjects` | create (auto-offered in all classes), list, single |
| Classes | `/classes` | list, single, `/:id/subjects` |
| Academic Years | `/academic-years` | create, list, single, `/:id/current`, `/:id` (delete) |
| Exams | `/exams` | create, questions, set status, `/:id/take`, `/:id/write` |
| Results | `/exam-results` | `/my-results` (student), `/exam/:examId` (admin) |

**Auth roles:** `isLogin` (admin), `isTeacherLogin`, `isStudentLogin` — each
verifies a JWT and loads the matching account.

**Results are gated:** students only see a result after an admin runs
`PUT /api/v1/admin/publish/exam/:id`.

---

## Project structure

```
LMS/
  app/app.js            Express app (middleware + route wiring)
  server.js             Boots the app after the DB connects
  config/
    database.js         SQL Server connection pool
    .env                Connection string + PORT
  model/                Data access (one file per entity)
    staff/   academic/  students/
  controllers/          Request handlers
    staff/   students/  academic/
  routes/               Express routers
  middlewares/          isLogin / isTeacherLogin / isStudentLogin / errors
  utils/                JWT generate/verify
  scripts/
    setupAcademic.js    Create all tables + seed classes
    seedAdmin.js        Seed the first admin
  views/                EJS landing page
  frontend/             React (Vite) frontend — folder skeleton
```

## From a clean clone — the whole thing in 4 commands

```bash
npm install
# edit config/.env with your DB connection string
npm run init
npm run server
```
