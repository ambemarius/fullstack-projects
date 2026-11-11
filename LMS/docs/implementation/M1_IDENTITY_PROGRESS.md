# M1 identity and tenancy implementation

Updated 26 October 2026. M1 is in progress. This is an internal foundation, not an enabled multi-school application.

**Latest browser increment:** isolated HTTPS preview is running at https://localhost:2027 with only scoped M1 APIs, persistent fictional demo schools and role-aware UI. Production/port-2026 routes are unchanged. **52 isolated/API + 12 SQL tests and the real pinned-certificate HTTPS check pass.** Actual browser interaction is still blocked at the local certificate warning pending the user's own final click; no visual acceptance is claimed. See [M1_BROWSER_PREVIEW.md](M1_BROWSER_PREVIEW.md) for startup/data guards, delivered screens, exact evidence and remaining handoff. Earlier “unmounted” notes refer to the legacy application; scoped factories are mounted only in this isolated preview.

**Latest link increment:** scoped offering creation, atomic versioned enrolment/revocation batches, explicit-year teaching assignment/revocation, actor-derived self discovery and assignment-authorised rosters implemented. 007 leaves original teacher years NULL, so unresolved links grant no scoped permission. **51 isolated/API + 12 SQL tests pass**. Read [M1_ACADEMIC_LINKS.md](M1_ACADEMIC_LINKS.md) first. Router remains unmounted; historical placement repair and remaining domain/browser scopes are not complete.

**Newest academic increment:** school-scoped academic year/class/subject setup and minimal membership context implemented and API/SQL-tested. Migration 006 replaces assigned-row global business/current-year keys with school keys while preserving unresolved uniqueness; canonical-created years no longer need an invented legacy admin. **49 isolated/API + 11 SQL tests pass**. See [M1_ACADEMIC_SETUP.md](M1_ACADEMIC_SETUP.md). Router remains unmounted; earlier totals/remaining-key notes below are historical. Existing server restarted as a hidden background process after its old listener stopped; /login returned 200.

**Latest personnel increment:** scoped registration/profile/status services, optimistic profile versions, transactional audit and membership-specific session revocation, school-aware matricule/email login and unmounted personnel HTTP factory are implemented. Teacher list and positive pupil/teacher self reads are tested. Migration 005 is applied only to synthetic SQL after rollback rehearsal. **47 isolated/API + 10 SQL tests pass**. See [M1_PERSONNEL_WORKFLOWS.md](M1_PERSONNEL_WORKFLOWS.md) for files, contracts, evidence, rollback and next work. Existing application is running at localhost:2026/login; new canonical screens are not active.

**Newest increment:** migration 004 adds a reconciliation run/item ledger (35 synthetic tables total). Explicit synthetic-only ownership/account planning, rollback rehearsal, transactional apply and repeat/concurrency safety are implemented. Initial school-scoped student list/search/count and pupil/teacher detail repositories are tested but not routed. **45 isolated/API + 9 SQL tests pass**, zero failures/skips/TODO. See [M1_RECONCILIATION.md](M1_RECONCILIATION.md) for exact execution, limits and continuation. Earlier counts below describe prior increments.

Latest increment: invitation acceptance, canonical password login, atomic session switching and an unmounted HTTP router are implemented. Migration 003 adds nullable ownership and same-school foreign keys across the 20 legacy school tables. Current results: **40 isolated/API tests and 8 SQL tests pass**, no failures/skips/TODO. The prior increment's results below are retained as history.

## Authority and environment

The owner accepted the backup/restore work and explicitly directed progression beyond M0. Automated recovery verification confirmed access, identity, migration history and original manifest counts for the exact separate target. Its source-probe assertion fails after the operator restored the backup over the synthetic source; DBCC checks were not reached. This accepted exception remains recorded, not marked as a passed automated drill. No recovery cleanup was executed after its execution request was declined. Recovery copies remain unchanged.

Only MARIUS/lms_test_codex was migrated. No legacy data copy, owner-school attestation, production migration or application activation occurred. MARIUS\DEV remains unchanged.

## Implemented and verified

Migration `002_identity_foundation.sql` adds nine empty tables: schools, accounts, school_memberships, membership_roles, legacy_account_map, platform_role_grants, account_sessions, school_invitations and identity_audit_events. The baseline plus ledger now has 33 tables. No source table was changed, no account was mapped automatically, no school was designated and no platform permission was seeded.

Accounts have an explicit canonical login key; its eventual browser input/normalisation contract is still to be implemented. Independent legacy IDs and emails never merge automatically. Legacy mapping separates source tables and binds each source identity to one canonical account and the matching school membership. School memberships permit combinations of school roles and multi-school staff. Composite constraints reject mixed-school roles, session membership belonging to another account and inconsistent audit actors. Platform grants are separate and do not confer pupil-data access.

The internal `model/identity/identityService.js` creates opaque sessions and stores only SHA-256 token and CSRF hashes. It rechecks account status, security version, session expiry/revocation, membership status, school status and roles on resolution. Platform-only sessions have no school context. Logout revokes a session. School switching rechecks old and target memberships inside a transaction, rotates session and CSRF tokens, revokes the prior session and preserves its absolute expiry. Failed switching leaves the prior session intact. Concurrent switches permit only one success.

Protected school invitation creation rechecks a live session and explicit platform grant inside the write transaction. It creates a pending school, a hashed, two-day initial-admin invitation and an audit record together. Duplicate school creation rolls back; a school administrator without a separate platform grant is denied. No messages are sent.

Acceptance locks the unexpired, unrevoked, unconsumed invitation and pending school, rechecks the inviter's active account and explicit platform grant, creates a new canonical account/admin membership, activates the school, consumes the invitation and audits the action in one transaction. Passwords require at least 12 characters and at most 72 UTF-8 bytes, with bcrypt cost 12. Existing accounts are never overwritten or implicitly merged; their invitation workflow remains separate. Expiry, revocation, replay, concurrent acceptance, canonical-key collision rollback and revoked inviter denial are SQL-tested. Canonical password login requires a login key and explicit school code for school sessions; platform-only login requires a separate platform grant. Missing identities still perform a bcrypt comparison. No credential/hash is returned.

`routes/identity/identityRouter.js` provides an **unmounted** factory with login, invitation acceptance, current session, school switching, logout and platform school invitations. It requires a configured exact HTTPS origin; all state changes require matching Origin. Authenticated mutations also require the session's CSRF token. The cookie is `__Host-lms_session`, Secure, HttpOnly, SameSite=Strict, path `/`, with no Domain. Session tokens never appear in JSON. Duplicate session cookies are refused; actor/membership/audit IDs are not accepted from callers. Credential endpoints have bounded per-process, per-IP attempt limits; production scaling needs a shared limiter and reviewed trusted-proxy setup. These are HTTP/header tests on loopback, not actual HTTPS browser certification. Browser CSRF persistence/recovery and UI integration remain to be delivered. The factory is not registered in `app/app.js`, so existing application routes cannot use canonical school sessions yet.

Migration `003_school_ownership_expand.sql` adds nullable `school_id`, `(school_id,id)` unique keys and school foreign keys to all 20 legacy school-owned tables. Each original FK between those tables also gets a trusted same-school composite FK. Original constraints/cascades and global business uniqueness remain intact. Geography is still global. Existing rows remain NULL/unresolved; future repositories must require exact verified school context and never treat NULL as a wildcard. No default ownership, ambiguous score-actor mapping, legacy backfill or NOT NULL activation occurs. The source test schema remains 33 tables.

## Verification, 26 October

- `npm.cmd test`: 38 passed, zero failed/skipped/TODO.
- `npm.cmd run test:sql`: 6 passed, zero failed/skipped/TODO on the synthetic target.
- Migration 002 was first executed in a transaction and rolled back, proving no schools table remained; then applied through the checksum ledger. Repeat application is a no-op. All FKs remain enabled/trusted.
- Real SQL verifies overlapping legacy role IDs remain distinct, one account can hold roles in two schools, wrong-school references fail, another account's membership cannot be used for a session, and school roles cannot contain platform permissions.
- Session/onboarding tests verify hashed storage, distinct CSRF matching, platform-only context, wrong-account membership denial, separate platform authority, duplicate invite rollback, immediate school/membership/account/grant revocation, logout and security-version invalidation.
- First service test attempt failed because its generated school code contained lowercase hex while validation requires uppercase. Corrected the synthetic fixture; the entire suite then passed. No product validation was weakened.
- Service fixtures are removed by exact random fixture keys; constraint fixtures roll back. No real people are seeded. Recovery marker rows are preserved.

The schema rehearsal test checks ledger/integrity through the other SQL tests after migration is already installed; its original rollback rehearsal was executed before the first installation. These tests do not certify an existing school upgrade or complete tenant isolation.

## Remaining bounded M1 work, in order

1. Implement explicit, resumable legacy mappings with cardinality reconciliation, preserving original IDs/status. Define the browser login identifier contract for school-aware pupils and multi-school staff without merging existing emails. Actual legacy ownership still requires factual attestation before any real migration.
2. Complete explicit platform bootstrap, authenticated existing-account invitations, browser login/session/CSRF lifecycle and role-aware navigation. The implemented initial-admin acceptance/session HTTP factory remains unmounted pending scoped APIs. No implicit initial platform operator.
3. Topologically backfill only attested ownership; reconcile every parent/child and ambiguous actor; then require ownership and replace global business keys/current-year uniqueness with school keys. Nullable ownership/composite-FK expansion is implemented, but NULL rows remain unresolved. Do not enable multi-school operation yet.
4. Scope repositories in bounded domains: identity/personnel; classes/years/subjects; enrolment/assignments; marks/reports; timetables; retained exams/finance. Update route matrix and all scripts, counts, exports, batches and browser metadata paths with each change.
5. Replace browser authentication and navigation together with scoped APIs. Preserve visual identity. Run full role/object/two-school isolation catalogue and browser workflows before activating canonical tenancy.

M2 remains queued until M1's complete exit gate passes. Later grading, discipline, library and lab business thresholds remain factual decisions rather than invented defaults.

## Rollback

Pre-activation rollback leaves additive tables unused and keeps the hardened existing application. Do not drop populated tables or revert to vulnerable authentication. No source data or legacy fields need restoring for this change. Migration files are checksum-protected and must never be edited after application. Future production migration/cutover remains separately authorised.
