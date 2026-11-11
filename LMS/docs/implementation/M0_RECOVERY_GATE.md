# M0 recovery gate

Status: in progress, 26 October 2026. Source: MARIUS/lms_test_codex. Restore destination: MARIUS/lms_test_codex_restore. Existing MARIUS\DEV is outside this operation.

**Current packet, superseding earlier pending packets:** backups/rehearsals/240798fdb65f1f46_restore.sql. Owner confirmed backup directory **B:\Default**; backup created there successfully. Destination is the new **lms_test_codex_restore_240798fdb65f1f46**. Run the full latest script and require “Restore recovery probe verified”. Source, old restore copies and older backup files are preserved. The utility's latest pointer and durable original-count evidence select this packet for subsequent verification.

Current blocker: after the DBA returned both databases ONLINE, old restored-copy verification failed because its backup probe was missing. A fresh packet is now prepared: **backups/rehearsals/83e40d137e72c9b2_restore.sql**, creating **lms_test_codex_restore_83e40d137e72c9b2** without overwriting old databases. Run the entire packet as DBA on MARIUS and require its final result “Restore recovery probe verified”. Agent count/history/probe/DBCC verification must then pass. Latest isolated/SQL suites pass (37 + 3).

The first count manifest was missing; its reconstructed verification was explicitly labelled and did not pass. The fresh packet retains the full original count manifest in both backups/rehearsals and docs/implementation/recovery-evidence. Normal verification uses this original evidence, not reconstruction. Supported restore destinations are the fixed old test name or a strictly validated unique synthetic suffix; arbitrary database names and replacement are rejected.

## Prepared and checked

The recovery utility writes a uniquely named native backup in SQL Server's directory, with COPY_ONLY/CHECKSUM/COMPRESSION. It uses server database-file paths if the server does not expose its default backup directory. A synthetic subject probe is committed before backup and removed afterwards, so restored state can be distinguished from current state. All table counts and backup identity are captured in an ignored manifest.

The test login can BACKUP DATABASE but cannot create databases or VERIFYONLY. A DBA-only packet is ready at backups/rehearsals/c9d4d1282b208606_restore.sql. It checks that the destination does not exist, runs VERIFYONLY WITH CHECKSUM, restores to unique data/log files, and never uses replacement or drops another database. No restore was executed by the utility.

## DBA step

Run the prepared packet in SSMS as DBA on MARIUS. Report whether it completes. If it fails, retain its error details without credentials. Do not rerun by deleting an existing destination or adding WITH REPLACE; review the existing destination first.

## Agent verification after DBA completion

```powershell
node scripts/recoveryRehearsal.js verify
```

This connects only to the two fixed synthetic databases. It verifies the destination name/marker, all saved row counts, the recovery probe present only in the restored copy, and DBCC CHECKDB. Evidence is written to the manifest. No production data is involved. Source and destination remain available for inspection; no automatic destructive cleanup is performed.

M0 closes only when this verification, the isolated/SQL suites and source checkpoint checks pass. Live legacy-schema upgrade and production encrypted backup/restore remain separate approved operations; synthetic fixtures do not waive them. M1 stays queued until the M0 gate is recorded as passed.
