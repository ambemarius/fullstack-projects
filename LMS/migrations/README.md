# Versioned schema migrations

The initial baseline is for an empty, explicitly selected database. The runner refuses an unversioned database with existing user tables; it is not an automatic legacy upgrade. Do not run legacy setup/seed scripts to bypass this gate.

Migration SQL is immutable once applied. The ledger stores version and SHA-256 checksum; applied-file edits, unknown versions, and gaps stop execution. Each version and its ledger row run in one transaction with an application lock. Backup/dry-run/restore approval remains required for real-data migrations.

009_staff_profile_links.sql is applied to the approved original database after a separate rollback rehearsal and exact existing-field preservation checks. It adds only explicit staff-profile links; no backfill or grants. Do not edit it or repeat adoption. Read docs/implementation/M1_STAFF_ACCOUNTS_ACTIVATION.md and use the guarded helper for its evidence; do not run generic setup/seed against real data.

For authorised synthetic testing, provision only lms_test_codex with scripts/createTestDatabase.js --approved-synthetic-only, then run the synthetic SQL test command. The dedicated login is restricted to the test database. Its local config is git-ignored. No production credentials or real pupil data are copied into fixtures.

Rollback of the clean baseline is disposal or restore of the explicitly authorised synthetic environment, not DROP commands in application startup. No down migration is automatically executed. Legacy expand/backfill migrations require a separately reconciled schema/data inventory.
