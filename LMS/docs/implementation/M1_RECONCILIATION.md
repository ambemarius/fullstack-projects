# M1 legacy reconciliation and initial scoped personnel reads

Implemented and tested on 26 October 2026, synthetic SQL only. M1 remains in progress.

## Changed scope

- `migrations/004_reconciliation_ledger.sql`: two additive provenance tables, ownership_reconciliation_runs and ownership_reconciliation_items. Source baseline, identity foundation and ledger now comprise 35 tables. Installation assigns no ownership and maps no accounts.
- `scripts/reconcileSchool.js`: a library for bounded, explicitly selected synthetic reconciliation. No production CLI, background migration or HTTP endpoint is registered.
- `model/identity/schoolAccess.js`: verified, immutable school context with private session binding and per-operation revocation/role checks.
- `model/identity/personnelRepository.js`: scoped student list/search/count and student/teacher detail reads. No existing route is replaced yet; write APIs and complete personnel workflows remain outstanding.
- New policy/context tests and expanded real SQL reconciliation/visibility tests; updated SQL table inventory assertion.

## Reconciliation contract

Every scope supplies an active school ID, an active explicitly granted platform operator account ID, a short attestation reference and 1–1000 selected `(table,id)` pairs. The operator ID is a trusted internal migration input, not browser authority. The tool requires the configured synthetic database identity and its approved server marker on planning and applying. Real-school use remains disabled; ownership attestation and reviewed real-data rehearsal are still required before building a production execution path.

Selectors are restricted to the 20 school-owned legacy tables; geography is excluded. Duplicate selectors and unknown/nonpositive IDs are refused. Parent-first order follows baseline dependencies. The plan checks every original FK between school-owned tables: each parent must already belong to the chosen school or be explicitly selected while unresolved. A foreign-school row/parent is a conflict. An unresolved parent outside the selected scope stops planning. No wildcard/default-school backfill occurs.

Plans contain only selectors, identity-state decisions, provenance and hashes of relevant ownership/identity/parent fields plus the migration ledger. They contain no names, email addresses, password hashes or sensitive source fields. These are fingerprints of migration-relevant fields, not snapshots of all business data. Marks/names/medical details are not overwritten or certified by this reconciliation.

Mapping keys are technical identifiers `legacy:<source_table>:<id>`. Overlapping IDs and equal emails in independent tables remain different canonical identities; these technical keys are not the final browser username design. Source credentials are copied unchanged only for recognised bcrypt 2a/2b hash forms and bounded work factors. Unsupported credentials/roles and unknown or contradictory statuses require review. Suspended/withdrawn teachers and withdrawn pupils become disabled canonical accounts with revoked memberships. School admin mapping grants only the school admin role; no platform grant is created. Auxiliary job titles do not provision accounts.

An existing mapping is reused only when its school, canonical key, account/membership state, expected role, verified provenance and credential hash agree. Differences require explicit reconciliation; the tool never resets passwords, reactivates accounts or merges identities. Legacy rows and IDs remain in place. Ambiguous numeric actors such as `subject_scores.created_by` remain unchanged and unresolved for later actor mapping.

## Dry run, apply and repeat behaviour

1. Load the approved test environment and construct a database adapter as in `tests/sql/reconciliation.test.js`. There is no default production command.
2. Use `createReconciler(database).plan(scope)` to obtain a read-only plan. Review its explicit selectors, target, status decisions, parent agreement and attestation reference.
3. Use `apply(plan,{dryRun:true})` to execute ownership/mapping/audit operations inside a serializable transaction and roll them all back. Returned counts describe simulated work; no run ID is persisted.
4. Apply the same reviewed plan with `apply(plan)` only in the approved synthetic environment. A transaction-owned application lock serialises reconciliation, and source/schema fingerprints are rechecked under transaction locks before writes. Any later failure rolls back ownership, canonical mappings, memberships and audit/run evidence together.
5. A completed plan hash is unique. Replaying it returns its historical completed run without rewriting anything; this is not a fresh certification of current source state. Build a new plan to inspect the current graph. Concurrent application of one plan produces one committed run and one replay result.

The run records school/operator/attestation reference, plan hash, selected/mapped counts and completion time. Items bind the run to school/table/legacy ID and the pre-application fingerprint. This supports explicit batches and resumable verified repeats. Initial application maps accounts; a fresh equivalent scope over existing verified mappings maps zero new accounts.

## Initial scoped reads

School context is constructed only after resolving a current opaque session. Platform-only sessions have no school context. Callers cannot forge context by copying it or adding a school field; private context binding is rechecked on each repository operation. Platform grants do not substitute for a school role.

Every SQL data statement independently joins the bound session, canonical account, active membership, active school and permitted role, rechecking expiry, revocation and account security version. All data predicates begin with the exact verified school. No connection-level session state is used, so pooled concurrent queries do not share mutable tenant context. NULL ownership is excluded.

- Student list/search/count requires school admin and bounded pagination. The same school and search predicates apply to rows and count. Caller-supplied school options are ignored.
- Student detail permits school admin or the pupil's own verified legacy mapping. No teacher roster access is inferred from a teacher role.
- Teacher detail permits school admin or the teacher's own verified legacy mapping.
- Foreign/unresolved detail IDs return no row. DTOs omit passwords and medical fields; student lists also omit guardian/address information.

These are internal repository methods, not completed browser features. SQL tests cover school-admin positive reads, foreign/unresolved denial, unmapped-pupil denial and revocation. Positive mapped pupil/teacher self workflows still require their own activation/acceptance tests. Existing legacy endpoints retain their current behaviour until replaced together with the rest of tenancy.

## Executed evidence and limits

`npm.cmd test`: **45 passed**. `npm.cmd run test:sql`: **9 passed**, zero failures/skips/TODO. Target MARIUS/lms_test_codex. Migration 004 was first rehearsed and rolled back (`Rolled back 004_reconciliation_ledger.sql`), then installed through the checksum ledger; repeat application and trusted-FK checks pass.

Real SQL exercises explicit parent-chain selection; foreign/unresolved-parent refusal; secret-free plans; checksum tampering and stale-status refusal; full dry-run rollback; late canonical collision rollback after earlier updates; inactive-state/password preservation; no platform escalation; unchanged marks/raw actor IDs; provenance item cardinality; concurrent/repeated apply; fresh-plan mapping reuse; and revoked-operator refusal. The initial reconciliation run exposed uppercase SQL GUID versus lowercase generated GUID return values; normalised the replay result, then reran successfully.

Scoped SQL checks cover own-school list/search/count, foreign/unresolved detail denial, no password/medical fields, forged-context refusal, parallel query isolation, unmapped-pupil denial, platform-only context rejection, session revocation at the service layer and independent SQL denial even when a prior service descriptor is deliberately reused after revocation.

Fixture accounts, mappings, runs and business rows are removed using exact synthetic keys/IDs. No real-school data is copied, mapped, reseeded or deleted. Existing recovery copies remain unchanged. Synthetic schema compatibility does not certify an arbitrary old live schema or missing historical ownership.

## Rollback and continuation

Before activation, rollback leaves additive tables and unused repositories in place. Dry runs roll back automatically; failed applies commit nothing. Do not delete a committed real-data mapping or undo school ownership without reviewed reconciliation, especially after new writes. No automatic destructive undo is supplied.

Next: complete scoped personnel write paths and their permissions, configurable academic setup and enrolment/assignment boundaries, then marks/reports/timetables and retained exam/finance paths. Resolve all ownership and ambiguous actors before mandatory ownership/global-key replacement. Mount canonical routes and browser login together only after complete two-school/API/browser acceptance. M2 remains queued.
