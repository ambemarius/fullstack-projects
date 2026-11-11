# Staff accounts — activated

27 October 2026. **Active:** https://localhost:2027/staff-accounts, Staff sign-in and native Administrator sign-in. canonicalStaffAccounts=true. Supersedes earlier staged/unmounted staff-account descriptions. Full M1 remains open for retained domains and human acceptance; M2 has not started.

## Implementation

nativeStaffService.js provides operator-only account/profile review, native auxiliary and standalone administrator invitations, token listing/revocation and password-recovery issuance. auxiliaryInvitationService.js provides authenticated exact-existing-account acceptance into a new school membership, preserving credentials. All changes are explicit: no email merge, inferred school/role, profile takeover or automatic membership reactivation.

Native auxiliary roles are discipline_master, librarian and lab_attendant, independent of job title. Standalone administrator profiles require a separate operator creation action and native-creation audit provenance before invitation. Original/mapped admins cannot be claimed. New original-table Admin profiles contain an undisclosed random bcrypt sentinel; it is never the canonical password. The recipient privately chooses the canonical password. No platform grants, teacher profile or legacy password are created for that administrator.

Public token acceptance requires configured HTTPS Origin, strict fields and rate limits. Protected mutations also require fresh opaque session and CSRF. Tokens are random32-byte secrets, stored hash-only, expire after24 hours and work once. Reserved namespaces new-staff/reset-staff/new-admin/reset-admin bind source, role, school and reviewed profile/account state; bootstrap rejects these namespaces. Native login keys use random native-staff identifiers. No secret is stored in the browser or URL, logged, printed or emailed automatically.

Signup atomically creates account/membership/role/profile link, consumes token and audits. Recovery changes only a native non-legacy account, increments its security version, revokes all sessions and audits atomically. A failed audit rolls everything back. Recovery never reactivates disabled/suspended/revoked access. Existing legacy recovery remains separate.

staffIdentity.js and staffProfileResolver.js enforce exact active school/account/member/source profile, required role and current session/version. Adopted accounts with secondary profiles retain their verified primary legacy credential/status anchor. Native accounts require the native namespace and no legacy map. Missing/revoked source links cannot fall through to a weaker guard. Post-password session/hash recheck prevents an old-password/new-version login race. Switching rotates and revalidates both source states; real middleware still permits only LYCEE_BATOURI, not another real school.

Auxiliary suspension/withdrawal now atomically revokes linked school sessions, retaining other-school access. Standalone admin disablement checks review/link version, protects self/platform authority, requires another verified original admin, revokes local membership/link/sessions and audits. Revoked links remain reserved. Original staff forms, mapped records and administrator invitation workflow are preserved.

canonical-staff-accounts view/script supplies recipient private signup/recovery, existing-account acceptance, operator directories/issuance/revocation, standalone admin creation and disablement. Success clears secrets and returns directly to Staff or Administrator login, not another invitation form. Guide: STAFF_ACCOUNTS_GUIDE.md.

## Schema and preservation

Reviewed009_staff_profile_links.sql is now an applied, immutable executable migration. Migrations001–008 were not altered. It adds one table with composite school/member/account/source foreign keys, explicit source/role checks, unique profile claims and status/version metadata. No original schema column change, backfill, school inference or grant is performed.

Synthetic009 rollback rehearsal preceded ledger installation. scripts/activateStaffSchema.js guards exact MARIUS\\DEV/schooldb and exact prior checksums; default mode rolls back. It snapshots all existing fields under transaction locks, runs009 and verifies all old rows/fields unchanged plus new table empty/trusted. Original rehearsal returned applied=false, rehearsed=true, existingTablesPreserved=37, existingFieldsPreserved=true, newLinks=0. Separate apply returned the same with applied=true. Only the new empty table and009 ledger row were committed. No adoption, restore or seed was repeated.

No real account/profile/invitation/grant/reset/removal was performed for tests. Existing real records and passwords were preserved. Native profile creation changes original Admins only when the operator deliberately creates a new profile later.

## Verification and runtime

**105 isolated +19 synthetic SQL tests passed**, no failures/skips/TODO. Coverage: private-input clearing and role-correct redirect; password mismatch; Origin/session/CSRF/payload boundaries; schema target refusal; exact tenant/profile/account integrity; stale, revoked, expired and wrong-recipient denial; concurrent single-use acceptance; forced-audit rollback; guarded native login; two-school switching; local suspension and non-revival of old sessions; global recovery invalidation; standalone administrator signup/recovery/stale-review/disable rollback; unchanged original credentials and roles. Fictional test school codes were corrected to uppercase; table-count contract was updated for009. A sandbox-blocked HTTP run passed after approved loopback access.

Real readiness/checksums/source alignment/trusted staff foreign keys and identifier checks passed. Only verified owned canonical listener restarted: auxiliary activation51692, final standalone-admin activation52032. Original19352 and shared legacy write locks unchanged. Verify process metadata before actions; PIDs are launch evidence. Pinned live HTTPS passed public setup rendering, Staff option, protected directory/administrator/token endpoint denials, malformed public payload denial, invalid Staff login with no cookie, existing canonical protections and actual old409 locks.

Actual human browser/owner acceptance remains pending the existing certificate handoff. No bypass, fabricated browser session or repeated request was used.

## Operations and remaining gates

Keep009 immutable. A faulty-feature rollback can disable canonical staff mounts/sign-in under verified process ownership while retaining ALL existing legacy write locks. Do not drop populated links or delete identities; preserve records/audit for repair. Disabled native admin links require explicit review before restoration. Native administrators have canonical tools and do not automatically gain a legacy password for unported tools.

Staff-account implementation is delivered for the approved school. Remaining M1 gates cover all retained-domain tenancy boundaries and human browser/owner acceptance; additional real schools remain blocked by those gates. Operational discipline/library/lab modules remain M4–M6. Do not mark M1 complete or start M2 based only on account delivery.
