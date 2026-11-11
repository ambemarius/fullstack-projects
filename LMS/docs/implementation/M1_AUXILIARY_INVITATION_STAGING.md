# Existing-account auxiliary invitations — staged

27 October 2026. Implemented and tested, **not mounted or activated**. Builds on proposed009 in M1_STAFF_PROFILE_FOUNDATION.md. No real schema migration, profile link, invitation, account, role grant, password change or process restart was performed. M1 remains open.

## Delivered increment

model/identity/auxiliaryInvitationService.js provides operator-only issue/revoke and recipient-authenticated acceptance. This is specifically an **existing active account joining a new school membership**, linked to an exact active auxiliary profile. It does not provision first-time accounts or change existing memberships. Existing pending/revoked/active memberships and existing/reserved profile links require separate review; no reactivation or profile takeover is inferred.

Issuance accepts only schoolId, exact accountId, exact profileId, explicit role and the reviewed auxiliary representation version. Roles are limited to discipline_master, librarian and lab_attendant. The account must not be a pupil in any school. An operator cannot invite themselves through this flow. No email matching, caller password, job-title permission, administrator privilege or platform privilege is accepted. The profile must be active in the target active school, and its exact reviewed state is checked under locks. A pending invitation reserves both target account/school and auxiliary profile/school against another pending claim.

The 24-hour token is returned once; only its SHA-256 hash is stored. The reserved intended_login_key namespace staff-profile binds exact account, profile, role and a digest of canonical login key, target school and the profile representation. It contains no profile email/name/phone or password. Changes to the account key or reviewed profile require a new invitation. Revocation is operator-only; consumed/revoked tokens cannot be revoked again. Expired, revoked, consumed, wrong-account and issuer-authority-lost invitations cannot be accepted.

Acceptance takes the same per-account reauthentication application lock as existing-administrator acceptance, checks fresh SQL session/account/member/school/role authority, then serializes the profile and school/account membership claim. In one serializable transaction it creates the new membership, explicit auxiliary role and profile link, consumes the token, increments the recipient account security version, revokes all recipient sessions and writes audit. Passwords, first-school roles, legacy primary maps, source profiles and platform grants remain unchanged. A failed audit rolls back all changes. Fresh sign-in is required after success; the backend returns signedOut=true.

routes/identity/auxiliaryInvitationRouter.js is an **unmounted factory**, with exact Origin, opaque session, CSRF, bounded per-IP attempts, no-store responses, strict token-only acceptance and cookie clearing only after successful commit. Endpoints relative to its future mount are POST /, POST /accept and POST /:id/revoke. There is no production URL for this feature yet. The current canonical runtime intentionally returns404 for /api/auxiliary-invitations.

The pending-school bootstrap implementation now excludes the reserved staff-profile namespace both when issuing and accepting bootstrap invitations. This prevents future namespace reuse from sending an existing-account profile invitation through new-account bootstrap. These source changes passed the complete suite; no runtime restart was needed for the unmounted increment.

## Verification

**99 isolated tests and18 synthetic SQL tests passed**, zero failures/skips/TODO. New unit/HTTP tests cover role/credential injection, non-operator denial before SQL, bootstrap namespace rejection, Origin/session/CSRF boundaries, strict token-only acceptance, no cookie clearing on rejection and absence of the new API from the real-school factory.

Synthetic SQL temporarily installs proposed009 only in the allowlisted test database, exercises real service transactions, then drops the test table and cleans all explicit fixtures. It inserts no migration-ledger row; a following schema rehearsal confirms the table is absent. The SQL test covers exact account/profile/version binding, duplicate profile claims, wrong recipient, changed profile, suspension, revoked issuer grant, forced-audit rollback, concurrent acceptance with one winner, all-device sign-out, preserved account hashes/status/login keys and first-school teacher role, exact librarian-only second-school role, resolving the created link, expiration, existing revoked membership rejection and pupil denial. Authority-like auxiliary job labels confer no admin/platform role.

Pinned live HTTPS checks passed; all existing course/personnel/invitation locks remain active. Actual browser/owner acceptance remains pending its existing human handoff; no certificate interaction or repeated request was attempted.

## Remaining before activation

1. Complete first-time/native auxiliary account invitation and private password creation, including exact-profile ownership and duplicate identity recovery; never auto-claim an account by email.
2. Integrate linked staff login and guarded source checks, preserving adopted accounts' primary legacy credential/status protections. The profile metadata resolver alone is not authentication. Add explicit school switching, account recovery, linked source-status revocation and reauthentication race tests.
3. Implement the operator eligibility/review/token delivery and recipient browser flows. Delivery remains a manual secure handoff unless explicitly authorised; this code sends no messages. Add existing-account role/link lifecycle review rather than silently accepting into occupied/revoked memberships.
4. Review auxiliary service suspension/withdrawal against linked authority, plus real rollout/preflight/rollback and retained domain permissions. Scope-specific roles do not activate the deferred discipline/library/laboratory modules.
5. Only then promote009, rehearse coordinated deployment and mount under existing approval. Keep real multi-school onboarding blocked until all mandatory M1 domain boundaries and acceptance gates pass. Do not advance M2.
