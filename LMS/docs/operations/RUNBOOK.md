# Operations runbook

How to install, run, back up and recover the LMS on a school server. The application is a single Node.js process (`server.js`) talking to one Microsoft SQL Server database.

## 1. Prerequisites

| Component | Requirement |
|---|---|
| Node.js | 20 LTS or newer (`node -v`) |
| SQL Server | 2019 or newer (Express edition is sufficient for one school). Mixed-mode authentication, TCP enabled. |
| Reverse proxy | nginx, Caddy or IIS with a TLS certificate. The app itself listens on plain HTTP and must never be exposed directly to the internet. |
| OS | Windows Server or Linux. Examples below use PowerShell and bash interchangeably. |

## 2. Database setup (once)

1. Create an empty database and a dedicated login that owns only that database:
   ```sql
   CREATE DATABASE lms_school;
   CREATE LOGIN lms_app WITH PASSWORD = '<strong password>';
   USE lms_school;
   CREATE USER lms_app FOR LOGIN lms_app;
   ALTER ROLE db_owner ADD MEMBER lms_app;   -- needed for migrations; downgrade to db_datareader/db_datawriter after
   ```
2. Copy `config/.env.example` to `config/.env` and fill in `DB_STRING`, `JWT_SECRET` (48 random bytes, see the comment in the example), `PUBLIC_ORIGIN` (the public https URL), `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters, used once), and `SCHOOL_CODE` / `SCHOOL_NAME` / `SCHOOL_SYSTEM` (used once to create the school record).
3. Apply the schema. The runner is versioned (ledger table `schema_migrations`, SHA-256 per file) and refuses to touch a database that already has tables but no ledger:
   ```bash
   node scripts/migrate.js --production
   ```
4. Create the school record and first administrator, then remove `ADMIN_EMAIL`/`ADMIN_PASSWORD` from `config/.env`. Seeding also gives every school-owned table a `school_id` default for that school (`dbo.lms_apply_single_school_defaults`), which finance, attendance and library rely on:
   ```bash
   npm run seed
   ```

## 3. Running the application

Development:
```bash
npm start
```

Production with PM2 (restarts on crash and on reboot):
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # prints the command that registers PM2 as a service
```

Docker (SQL Server stays outside the container):
```bash
docker build -t lms .
docker run -d --name lms -p 2026:2026 --env-file config/.env -v lms-uploads:/app/uploads lms
```

Health check for monitors and load balancers: `GET /health` returns `200 {"status":"ok"}` when the database answers and `503` otherwise.

## 4. Reverse proxy (TLS)

Terminate TLS at the proxy and forward to `http://127.0.0.1:2026`. Pass `X-Forwarded-Proto` and `Host`. Set `PUBLIC_ORIGIN=https://lms.example-school.cm` so cookie origin checks and links use the public address.

Minimal nginx block:
```nginx
server {
  listen 443 ssl http2;
  server_name lms.example-school.cm;
  ssl_certificate     /etc/letsencrypt/live/lms.example-school.cm/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/lms.example-school.cm/privkey.pem;
  client_max_body_size 6m;
  location / {
    proxy_pass http://127.0.0.1:2026;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

## 5. Backups

Marks and fee records are irreplaceable. Run a full backup nightly and keep at least 30 days off the server.

```sql
BACKUP DATABASE lms_school
  TO DISK = 'D:\backups\lms_school_$(date).bak'
  WITH COMPRESSION, CHECKSUM, INIT;
```

Also back up the `uploads/` directory (pupil photos, staff documents) and `config/.env` (store the latter in a password manager, not with the data).

Schedule with SQL Server Agent or Task Scheduler; verify the job's last-run status weekly.

## 6. Restore drill (do this once per term)

1. Restore the latest `.bak` to a scratch database name:
   ```sql
   RESTORE DATABASE lms_restore_test FROM DISK = 'D:\backups\lms_school_latest.bak'
     WITH MOVE 'lms_school' TO 'D:\data\lms_restore_test.mdf',
          MOVE 'lms_school_log' TO 'D:\data\lms_restore_test.ldf', REPLACE;
   ```
2. Point a second `config/.env` at it and start the app on another port (`PORT=2126 npm start`).
3. Log in and open a class report card. If it renders, the backup is good. Drop the scratch database.

## 7. Upgrading

```bash
git pull
npm ci --omit=dev
node scripts/migrate.js --production   # applies only new, unapplied versions
pm2 restart lms
```

Take a backup immediately before `migrate.js` on every upgrade.

## 8. Troubleshooting

| Symptom | Check |
|---|---|
| `RESTORE VERIFYONLY` / `HEADERONLY` fails with "CREATE DATABASE permission denied" | Expected for the app login. Verification and restores need a login with `dbcreator` or `sysadmin`; run them from SSMS as the DBA. A backup taken `WITH CHECKSUM` has already validated every page. |
| `Server port is already in use` | Another instance is running (`pm2 ls`). Never force-kill the port; stop the other process cleanly. |
| `/health` returns 503 | SQL Server down, firewall, or wrong `DB_STRING`. Test with `sqlcmd -S <server> -U lms_app`. |
| Users logged out every hour | Expected: tokens live `JWT_EXPIRES_IN` (default 1h). Raise it in `config/.env` if the school prefers. |
| Login returns 429 | Rate limit after 10 failed attempts per 15 minutes for that account/IP. Wait or reset the user's password as admin. |
| Photos/documents 404 | They are served from `/files/<name>` and require a signed-in account. Check `uploads/` exists and is writable. |

## 9. Security checklist before go-live

- [ ] `JWT_SECRET` is unique to this installation and not in git.
- [ ] `ADMIN_PASSWORD` removed from `config/.env` after seeding.
- [ ] Application reachable only through the TLS proxy; port 2026 blocked at the firewall.
- [ ] SQL login downgraded from `db_owner` after migrations.
- [ ] Nightly backup job verified; one restore drill completed.
- [ ] `config/runtimePolicy.json` reviewed: `parents.enabled` on only if the school wants the guardian portal.
- [ ] `scripts/seedDemo.js` never runs against the live database.
