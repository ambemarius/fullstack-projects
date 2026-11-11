# DBA setup: synthetic database

Approved test target: **MARIUS / lms_test_codex**, using the dedicated credentials supplied by the owner and saved only in ignored config/.env.test.local. The application continues to use **MARIUS\DEV**. Initial provisioning on DEV failed; after the owner clarified the separate instance, test connection and two real SQL tests passed. No existing school database was migrated.

For future reprovisioning, a database administrator should create that database on MARIUS and a dedicated SQL login/user restricted to it. The test runner needs DDL and data permissions there; db_owner on this disposable database is the current development arrangement. Server-wide administrator rights are unnecessary. Do not add the test login to the existing school database.

After selecting **lms_test_codex** in the administrator's SQL session, mark it synthetic:

```sql
IF DB_NAME() <> N'lms_test_codex'
    THROW 50000, 'Select the approved synthetic database first', 1;
EXEC sys.sp_addextendedproperty
    @name=N'LMS_SYNTHETIC_ONLY', @value=N'codex-approved';
```

Copy config/.env.test.local.example to config/.env.test.local. Fill the actual server/instance and dedicated login password locally. The target/allowed server and target/allowed database entries must match exactly. Certificate trust is false by default; enable trust only for the approved local SQL instance if it uses a development certificate. Do not paste the password into chat or commit the filled file.

Once the DBA confirms completion, run:

```powershell
npm.cmd test
npm.cmd run test:sql
```

The SQL suite checks database identity and marker before applying the baseline, applies migrations twice and inspects constraints. The baseline runner refuses an existing unversioned schema with user tables. The suite does not create the database or connect to the existing school database. Backup/restore and full legacy migration rehearsals remain separate follow-up work; neither is certified by the initial SQL suite.
