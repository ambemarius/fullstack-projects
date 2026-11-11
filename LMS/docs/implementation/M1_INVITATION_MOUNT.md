# Mounted administrator invitations

**Updated acceptance UX:** successful public acceptance now revokes recipient sessions/increments security version atomically and redirects to login with success feedback and their existing account type selected. It no longer leaves the recipient on the acceptance form; already-admin users do not see that form again. See M1_INVITATION_SUCCESS_FLOW.md (85 isolated +16 SQL tests). Earlier session-preservation descriptions are historical for the internal engine, not the mounted public acceptance route.

27 October 2026. Owner explicitly requested mounting the staged invitation feature. **Active at https://localhost:2027/invitations**, with API `/api/membership-invitations`. Current scope: administrator invitations for existing verified, active LYCEE BATOURI staff. This does not activate cross-school profile provisioning, new-account/password invitations or auxiliary permission assignment.

## User workflow

The platform operator signs in with their existing account, opens Administrator invitations and selects a staff member from the verified local directory. Issue returns a single-use token shown once; the operator distributes it themselves. The app sends no email/message and writes no token to browser storage or URL history. Operators can list/revoke pending invitations; the directory and catalog require platform authority, not merely a school-admin role.

The recipient signs in as their own existing staff account, opens the same page and pastes the invitation token into the acceptance form. Teachers have an acceptance link on their workspace even before becoming administrators. Acceptance preserves their original staff role, account type and password; they continue to sign in as Teacher using their existing email/password, with the additional admin role available in the canonical school workspace. Legacy Admin-table authentication and platform privileges are unchanged.

## Integration safeguards

Both service and HTTP factory now require a verified local school profile by default. Production additionally fixes the allowed school code to LYCEE_BATOURI. Issuance and acceptance independently validate a verified teacher/admin profile mapping, active local membership/source status, corresponding source role and exact binary credential equality. This occurs inside the same serializable transaction as the grant/audit/consumption, not after it. No raw profile or credential is copied, invented or merged. Missing/mismatched/unverified/inactive local profiles return409 (or source-session403); unsupported school codes are refused. Existing staff with a student identity remain ineligible.

The mounted API therefore adds an explicit admin role to an already-verified local staff membership. It cannot leave an unprovisioned cross-school admin membership behind. The broader engine's new-membership branch is tested only with an explicit internal policy override; the real router never exposes that override. Native/multi-school profile-link provisioning remains separate M1 work and must be integrated atomically before widening the real scope.

Existing token binding, hashed storage, 24-hour expiry, issuer/account/session revalidation, duplicate rejection, one-time/race protection, revoked-member refusal and atomic audit remain in force. No endpoint grants platform permissions. Invalid role/actor/password/ownership overrides are rejected. The service's new eligible-account lookup returns only names/business email and exact account IDs for eligible verified local staff, to the authenticated platform operator.

## Files and activation

`canonicalMembershipInvitations: true` in config/runtimePolicy.json enables the protected page and API mount in scripts/canonicalSchool.js. Source additions: views/canonical-invitations.ejs and public/js/canonical-invitations.js. The existing canonical home adds administrator and staff-acceptance links and a fixed safe login return path. Original student/teacher forms are unchanged.

Real readiness passed. Restarted only the ownership-verified canonical listener (PID13116 at launch; verify backups/runtime/canonical-school-process.json before acting). The original server/write locks remain running unchanged. No migration, production fixture, invitation issuance, privilege grant or password change was performed by activation.

## Verification

Complete suites: **78 isolated tests +15 synthetic SQL tests passed**, zero failures/skips/TODO. Focused invitation HTTP and SQL cases passed again after tightening the default policy. The SQL lifecycle now also exercises the real guarded identity provider with a verified local staff profile, rejects wrong school/missing profile/source suspension/credential drift/pending mapping, then verifies accepted local staff resolve both admin and teacher roles without changing account snapshots or credentials. Full broader replay/revocation/race/audit-rollback tests remain passing.

Actual pinned-certificate HTTPS checks passed after restart: protected invitation page redirects anonymous users to login; mounted issue/list/directory routes now return403 instead of their former404 when unauthenticated; existing personnel, academic and auxiliary boundaries remain healthy. No real password was used. One initial shell-based navigation edit failed to parse before file writes, and a patch with duplicate file sections was rejected; both were corrected before the full tests/deployment. No data changes resulted from those tooling errors.

Visual owner acceptance is still pending; no browser warning was bypassed or repeatedly requested. Full M1 remains in progress. Preserve the local-profile restriction and current legacy write locks on future work.
