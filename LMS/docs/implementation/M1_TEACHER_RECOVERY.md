# Synchronized teacher password recovery

27 October 2026. Owner selected a teacher for recovery. **Review only: no production password reset has been performed.** Teacher/profile3, canonical account3 remain active, verified, credential-aligned and securityVersion1. The owner must enter the new password privately; never request it in chat, generate a substitute or treat this preparation as completed recovery.

## Private operation

Run scripts/Recover-TeacherPassword.ps1 with the selected registered address in -Email. Default is review-only; -Apply performs fresh review, asks twice through masked local Read-Host and sends JSON via child stdin. Passwords must be at least12 characters and at most72 UTF-8 bytes. Nothing is put in process arguments, source, logs or chat. -ValidateOnly performs private-input validation without changing credentials. Wrapper parsing and BOM/private-input compatibility are tested.

scripts/recoverTeacherPassword.js is a trusted local owner/DBA tool, not a public/self-service endpoint. Production target is exactly MARIUS\DEV/schooldb and LYCEE_BATOURI, with the designated verified active platform operator. Apply requires reviewed profile ID/security version and a live original runtime with credential-version checks loaded. Synthetic tests require the existing allowlist/marker and cannot fall back to production. CLI exposes no target override.

One serializable transaction writes an identical bcrypt12 hash to the teacher and canonical account, increments security_version, revokes all target canonical sessions and outstanding existing-admin invitations bound to the account, and audits field names only. Failed audit or stale review rolls back all changes. Teacher/account/membership status and all roles remain unchanged; recovery does not reactivate disabled staff. Other accounts/schools are untouched.

## Legacy login safety

Original login tokens now optionally carry a positive credentialVersion. Under canonicalCredentialRecovery=true, login obtains the canonical version only if the exact hash just checked by bcrypt still matches source and canonical copies, preventing an old-password/new-version race. Legacy authenticated requests verify source role/status/ownership, canonical mapping/role/member/account/school state, credential alignment and version. Existing unstamped tokens count as version1; only a recovered account's incremented version rejects its old tokens. Fresh login receives the new version. No signing-key rotation/mass logout is needed. Opaque canonical sessions already compare versions and are explicitly revoked.

Files: model/identity/legacyCredentialVersion.js, token/controller/roleAuth integration, scripts/recoverTeacherPassword.js and scripts/Recover-TeacherPassword.ps1. Original runtime announces X-LMS-Credential-Versions:1; apply refuses if this readiness signal is absent. The legacy-only administrator updater now refuses canonical/adopted databases, preventing a one-copy password change. Its pre-adoption recovery remains historical. Synchronized administrator/pupil and web self-service recovery are separate remaining work.

## Evidence and pending step

**81 isolated +16 synthetic SQL tests passed**, zero failures/skips/TODO. Coverage: coupled credentials, audit rollback, stale review, old-password rejection, canonical/legacy token revocation, login/reset race refusal, pending invitation cancellation, same-email other-school isolation and preservation of inactive/disabled/revoked states. No production test password was set.

Enabled canonicalCredentialRecovery=true; restarted only the tracked original listener (launchPID9976). Actual runtime-ready check and selected review passed, still changes0/version1. Canonical HTTPS checks pass. No migration, production password/profile/role/session change was performed by verification. Two shell/patch preparation errors made no file/data change and were corrected before tests.

Owner private entry is the remaining reset step. After success verify only non-secret version/alignment metadata, never the chosen password. Continue independent M1 work while entry is pending; do not repeat/reset automatically or claim full M1 completion.
