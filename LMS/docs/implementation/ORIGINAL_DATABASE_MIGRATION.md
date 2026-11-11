# Original database migration execution record

26 October 2026. Owner explicitly requests migration; school ownership confirmed as LYCEE BATOURI. Status: **original database adoption committed and independently verified, including CHECKDB**. Earlier preparation notes below describe the sequence, not the current gate.

## Applied adoption

The DBA restored the exact separate target and granted database-owner access. Agent verification confirmed ONLINE/access on both databases. Seven M1 expansion files (002–008) first passed an always-rolled-back schema rehearsal. A full ownership/identity dry run then passed with all original field values and credentials preserved, followed by a committed copy migration and independent verification including CHECKDB, canonical sessions/CSRF, inactive-account denial, revocation and a rejected cross-school FK insert. Temporary verification records/sessions were rolled back.

The original source matched the rehearsal fingerprint exactly. The tracked original server was briefly stopped, adoption applied atomically on **MARIUS\DEV / schooldb**, and the server restarted as recorded in `backups/runtime/server-state.json` (PID 35168 at this launch). Login HTTP status: **200**. Source preservation verified inside the adoption transaction: **24 original tables, 1,401 rows, every original field unchanged**, including original hashes, IDs and statuses. All 20 school-owned tables were assigned to school 1, code `LYCEE_BATOURI`, name LYCEE BATOURI. The two actual language sections support the Bilingual school designation; timezone is Africa/Douala.

Canonical mapping: **103 accounts** (2 recognised administrators, 22 teachers, 79 pupils). One inactive teacher remains disabled with revoked membership. The known teacher-role row in Admins (id 5) remains unchanged and receives no canonical mapping or administrator authority. Initial platform operator is the explicitly designated `admin@school.local`; its existing credential was copied unchanged and its platform grant was audited. No email-based account merge or password reset occurred.

Migration 001 was **adopted, not executed**. `legacy_adoption_runs` records this distinction, source fingerprint, ownership attestation, operator, compatibility notes and the explicit role exception; checksum-ledger entries record the exact adopted baseline and executed expansion files. Compatibility adds nullable teacher matricule and offering coefficient where absent; unknown historical values remain NULL. A missing timetable slot FK is added WITH CHECK. Historical teaching years, report grading and ambiguous legacy actors remain unchanged.

Artifacts: `scripts/legacyAdoption.js`, `scripts/rehearseLegacyAdoption.js`, `scripts/inspectLegacyAccounts.js`, `scripts/verifyLegacyAdoption.js`; ignored evidence under `backups/legacy-migration/` includes adoption-dry-run.json, adoption-rehearsal.json, verification-rehearsal.json and adoption-original.json. Original execution requires successful committed/independently verified rehearsal and an exact original-schema/data fingerprint; repeat adoption is refused. Failure before commit rolls back the whole adoption.

Independent original verification also passed: preserved original counts, exact migration checksums, trusted FKs, designated operator grant, excluded role exception, canonical session/CSRF, inactive-account rejection, revocation, cross-school FK rejection and full CHECKDB. Test mutations were rolled back. Durable non-sensitive result: `evidence/original-migration-verification-2026-10-26.json`; detailed local result: `backups/legacy-migration/verification-original.json`.

Regression evidence: **63 isolated tests + 12 synthetic SQL tests passed**. Four focused adoption/restore tests passed again after cutover. The first full-data dry run exposed SQL's diagram table without an id column; deterministic row-multiset digests corrected that and the repeat passed. Verification's initial test adapter could not support nested service transactions; its unsupported switch call was removed, while real session/revocation and composite-school tests remain. CHECKDB initially exceeded the driver's default timeout; the supported per-request timeout was corrected and the rehearsal CHECKDB passed. These failed attempts are not counted as passes.

## Runtime and phase limits

This is database adoption, **not completion of M1 or canonical runtime activation**. Port 2026 retains the original single-school application/design; its restart also loads the tested legacy administrator-role check. Port 2027 remains the synthetic-only preview. Do not point its sample-account seeder at schooldb. Legacy writes can still create unmapped/unowned records or change statuses outside canonical workflows; reconcile and close those write paths before canonical activation or onboarding another school. See M1_COMPLETION_CHECKLIST.md for remaining personnel, route and browser gates. M2 remains queued.

Before any rollback after commit, stop writes and assess subsequent changes. Preserve the original backup and separate rehearsal copy. Do not automatically restore over schooldb or discard post-migration writes. Transaction rollback covers pre-commit failures; a post-commit restore requires a reviewed DBA recovery plan.

## Initial preparation (historical)

- Read-only original-instance readiness: `MARIUS\\DEV / schooldb`. Configured login can BACKUP DATABASE but cannot CREATE ANY DATABASE and is not sysadmin.
- Added `scripts/prepareLegacyMigration.js`, exact-source guarded and explicit `--backup-original` only. Creates a fresh randomly named COPY_ONLY backup with CHECKSUM. No source probe, schema alteration, login grant, password operation, or row update.
- Actual backup completed: `D:\Dev\schooldb_before_m1_008eafa5e2aed4d8.bak` on the SQL Server filesystem. This is the DEV instance's data path, not the other instance's B:\Default path. Backup contains real school data; restrict access and retain it.
- Manifest and DBA packet: `backups/legacy-migration/008eafa5e2aed4d8_manifest.json` and `008eafa5e2aed4d8_restore.sql`. The initial manifest records the preparation-time restore state; subsequent DBA restoration and agent CHECKDB verification supersede it.
- Two focused packet tests pass: wrong input refused, unique target, instance check, VERIFYONLY/CHECKDB, escaped logical names, additional data-file handling, no replacement of existing databases.

## Earlier DBA action (completed)

The DBA executed the complete packet on **MARIUS\DEV**. It verifies the backup, restores only the new `schooldb_m1_rehearsal_008eafa5e2aed4d8`, runs CHECKDB and reports the target state. It refuses an existing target and never replaces schooldb. The original configured login could not create this copy; the owner subsequently provided access to the restored copy.

Copy verification, complete adoption rehearsal and original cutover subsequently completed as recorded above. The clean synthetic baseline was never executed over original tables. Database migration and runtime activation remain separate operations.
