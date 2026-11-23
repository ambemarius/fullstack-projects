# Versioned schema migrations

The initial baseline is for an empty, explicitly selected database. The runner refuses an unversioned database with existing user tables; it is not an automatic legacy upgrade. Do not run legacy setup/seed scripts to bypass this gate.

Migration SQL is immutable once applied. The ledger stores version and SHA-256 checksum; applied-file edits, unknown versions, and gaps stop execution. Each version and its ledger row run in one transaction with an application lock. Backup/dry-run/restore approval remains required for real-data migrations.

009_staff_profile_links.sql is applied to the approved original database after a separate rollback rehearsal and exact existing-field preservation checks. It adds only explicit staff-profile links; no backfill or grants. Do not edit it or repeat adoption. Read docs/implementation/M1_STAFF_ACCOUNTS_ACTIVATION.md and use the guarded helper for its evidence; do not run generic setup/seed against real data.

010_parents_notifications_integrity.sql is additive and guarded (IF OBJECT_ID / COL_LENGTH / sys.indexes): guardian accounts (`parents`, `parent_students`), `notifications`, `subject_score_history` plus `subject_scores.updated_by`, `subjects.passmark`, the `CK_ss_score_range` check (added WITH NOCHECK so legacy rows are not re-validated) and indexes on pupil/teacher/timetable/result lookups. It is the only source of these objects; models no longer create or alter tables at runtime.

011_staff_duties_single_school.sql adds `staff_duties` (bursar, librarian, lab_attendant, discipline_master granted to admins, teachers or auxiliary staff), a nullable `auxiliary_staff.password` for non-teaching sign-in, and `dbo.lms_apply_single_school_defaults`. The procedure acts only when exactly one active school exists: it gives `school_id` on every school-owned table a default of that school and backfills NULLs parent-before-child. This is the owner's single-application decision (November 2026); a multi-school deployment must drop the `DF_school_*` defaults first. Seeding calls the procedure again after creating the first school.

012_finance.sql ports the staged finance draft: append-only `finance_charges`, `finance_payments`, `finance_reversals` and `finance_cancellations`, with the recording person as (`actor_type`, `actor_id`) instead of an identity membership, `operation_id` uniqueness for safe retries, and `finance_charges.source` (`legacy-import` for rows copied by scripts/importLegacyFees.js).

013_attendance.sql replaces the staged daily-count draft with per-lesson registers: `attendance_registers` (one per class, date and timetabled start time, with the lesson's length in minutes) and versioned `attendance_marks` (present / absent / late with minutes, justification, and a required reason for every revision after the first). Absence hours on report cards are the sum of absent lessons' minutes.

014_library_lab.sql ports the staged library/laboratory draft: `library_copies` with an append-only `library_events` history (a copy's state is its latest event), `lab_items` with stock as the sum of `lab_movements`, `lab_requests` (pending → approved → issued → returned / damaged / consumed), and single-use `inventory_operations` so a resubmitted form is refused. Borrowers, requesters and actors are (type, id) instead of identity memberships. The pupil loan limit is `library.pupilLoanLimit` in config/runtimePolicy.json (default 3).

015_lab_management.sql restricts laboratory items to the subject laboratories (Physics, Chemistry, Biology, Geology, General lab), adds a hazard class, and adds equipment return accounting to `lab_requests` (`return_by`, `returned_qty`, `damaged_qty`, `missing_qty`, `closed_at`, `close_note`, optional `class_id`), a `note` on movements, and the `lost`, `adjust` (stock count) and `dispose` movement actions. Statements touching newly added columns run through EXEC so the batch compiles.

The files in docs/implementation/staged/ (attendance 014, library/lab 015, finance 016 and others) are historical drafts written for the two-server identity layer. They are not applied in this numbering; each module is ported as the next free number (012 onward) against `staff_duties` and `requireStaff`.

For authorised synthetic testing, provision only lms_test_codex with scripts/createTestDatabase.js --approved-synthetic-only, then run the synthetic SQL test command. The dedicated login is restricted to the test database. Its local config is git-ignored. No production credentials or real pupil data are copied into fixtures.

Rollback of the clean baseline is disposal or restore of the explicitly authorised synthetic environment, not DROP commands in application startup. No down migration is automatically executed. Legacy expand/backfill migrations require a separately reconciled schema/data inventory.
