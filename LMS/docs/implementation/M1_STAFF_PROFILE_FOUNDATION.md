# Explicit staff profiles across schools — staged foundation

27 October 2026. **Implemented and tested, not activated.** The original one-account legacy map remains intact. The new schema proposal is outside the executable migration directory at docs/implementation/staged/009_staff_profile_links.sql. The new resolver is not imported by either runtime. No production schema, accounts, passwords, profiles, grants or processes changed in this increment. Existing live workflows remain healthy.

## Why this is needed

The existing legacy_account_map is intentionally one primary legacy profile per account and supports only Admins, teachers and students. Auxiliary records contain job labels and no account credential. Reusing emails or relaxing that primary-map uniqueness would merge identities without consent and would not supply a valid per-school source guard. Native auxiliary accounts and explicit multi-school staff therefore need a separate per-membership profile link.

## Implemented structure

The proposed staff_profile_links table binds school_id, membership_id and account_id with a composite foreign key to the exact membership. Exactly one original administrator, teacher or auxiliary profile must be specified. Each source profile uses a composite school/profile foreign key and a filtered unique index, so a profile cannot be claimed by another account. One account can have separate explicitly selected profiles in different schools; it can have only one linked staff profile per school membership. Revoked links remain reserved for reviewed recovery rather than silently being reassigned.

Each link has an explicit required_role: administrator profiles require admin, teachers require teacher, and auxiliary profiles require discipline_master, librarian or lab_attendant. It also has active/revoked status, a positive version and creator/time metadata. No email identifier, password, automatic role grant, source-table alteration, default-school assignment or backfill is present. Choosing an auxiliary job label such as Admin or Platform operator cannot select administrator/platform authority. Creating a link alone does not grant its required membership role.

model/identity/staffProfileResolver.js is a staged, read-only metadata resolver. It takes only an opaque session token, resolves current canonical identity, then independently checks the exact session/account/school/membership tuple in SQL. It checks session expiry/revocation/security version, active school/account/membership/link, the explicit required membership role and active source status/recognised source role. It returns only frozen link/profile identifiers and version, not credentials or personal records. A fake upstream identity cannot make a token for school A resolve a profile in school B.

This resolver is **not a replacement authentication guard**. It does not verify legacy credential equality and must not be mounted as a shortcut around the current real-school guardedIdentity source checks. The coordinated integration must retain primary legacy credential/status protections for adopted accounts, distinguish canonical-only accounts explicitly and test recovery/school-switch behaviour. Native canonical credentials must not be copied into old profiles to invent a relationship.

## Verification

**96 isolated tests and17 synthetic SQL tests passed**, no failures/skips/TODO. The new schema is created and exercised entirely inside a transaction in the approved synthetic database, then rolled back. After rollback the table is absent and account/role/platform-grant counts equal their starting values. No ledger row is inserted; applied migrations001–008 remain immutable. A unit test prevents accidental discovery of the staged009 proposal by the normal runner.

The SQL rehearsal verifies mixed-school profile and membership rejection, wrong-account rejection, forbidden auxiliary admin/platform roles, profile claim uniqueness, one account resolving separate same-email profiles in two schools, no access from the link without its role, forged school switching denial, local source suspension without affecting the other school, required-role removal, link revocation and account security-version invalidation. Synthetic authority-like job labels do not confer permission. Existing identity tests cover membership/school/session revocation separately.

The existing pinned live HTTPS checker passed after staging. No runtime restart, real migration, real link, role grant, test account or browser acceptance was performed.

## Next implementation increment

1. Add operator-issued, exact-account/profile/role-bound invitations and recipient-authenticated acceptance. Bind profile identity and version, not email alone; check school/account/profile state in the same serializable transaction as link creation, role grant, token consumption and audit. Never reactivate a revoked membership/link implicitly.
2. Add a distinct new-account invitation path where the recipient privately chooses their own password; no generated or disclosed passwords. Initial account creation must not claim an existing email/account without authentication. Keep school-admin and platform permissions separate.
3. Integrate staff login, source guards and explicit school switching with guarded denial for missing/multiple profiles and primary legacy credential drift. Add synchronized recovery/revocation handling and tests before mounting anything.
4. Review auxiliary status changes against linked account/membership authority. Job labels remain labels; a suspended local record must lose local access immediately while unrelated schools retain their own explicit memberships.
5. Rehearse the complete schema/workflow rollout, review rollback and checksum consequences, then promote009 to executable migrations and activate under the existing approval. Do not apply the structural table alone to production or run broad onboarding before all mandatory M1 route boundaries pass.

M1 remains in progress. Historical enrolment, grading, reporting and other M2–M7 work is still queued.
