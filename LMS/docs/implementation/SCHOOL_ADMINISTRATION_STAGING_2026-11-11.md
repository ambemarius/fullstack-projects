# School-local account administration — staged

This implements part of the owner's subscription model clarification. It is **not a completed provider subscription/onboarding product** and is **not activated in the real database**.

## Implemented source

- Additive staged schema017 defines explicit school-super-administrator grants with a composite school/membership/account foreign key. Applied migrations001–009 remain unchanged.
- `model/identity/schoolAdministration.js` resolves the server session and verifies the current-school grant, active administrator membership, account and school inside the transaction. Platform authority alone does not confer school account-management rights.
- `nativeStaffService.js` has an opt-in school-administration mode. School account directories, invitations, creation, revocation, disable and recovery operations use the authenticated school. Existing cross-school account discovery/link issuance is unavailable in this mode. Existing invitation acceptance is retained and rechecks issuer authority.
- Recovery cannot change a provider account, school super administrator or an account shared with another active school. Administrator removal protects the school-super-administrator grant. New administrators receive ordinary school administrator access only.
- The canonical identity response hides platform permissions and other-school memberships in this mode. Old platform invitation operations are excluded except pending acceptance. The hub separates unavailable live modules from practice workspaces.
- Staff UI obtains school management context from a guarded backend endpoint, rather than granting authority from browser state.
- Startup checks schema017 readiness before opening a listener if the future `canonicalSchoolAdministration` policy is enabled. That policy is currently absent/false.

## Validation

`tests/school-administration.test.js` covers early scope/role rejection and excluded cross-school account APIs. `tests/sql/school-administration.test.js` uses two synthetic schools to verify scope, issuer revocation, acceptance/replay, ordinary-admin denial, recovery and credential-sharing restrictions, protected removal, versioned changes and composite ownership constraints. It and the existing native staff SQL test passed (2/2). Fixtures were cleaned; no real data was seeded.

The activation script `scripts/activateSchoolAdministration.js` checks the exact original database/instance, migration checksums, existing adopted administrator mapping, a serializable lock, old-row preservation and account hash/version preservation. Its **rollback-only review passed** with one proposed grant and preserved original fields/credentials. `--apply` was not run. It targets the previously designated existing owner `admin@school.local`; do not substitute an arbitrary account or repeat adoption. A separate release ledger tracks017 without modifying prior migration history.

The final overall isolated suite passed 172/172. Browser account presentation was reviewed with fictional records only; details are in `docs/design/UX_BUG_REVIEW_2026-11-11.md`.

## Next implementation work

1. Resolve the original listener ownership mismatch and audit the other agent's unreviewed additions before coordinated runtime activation.
2. Review and commit the additive017 release, enable its policy, restart only verified owned listeners, and verify real-school sign-in/context without changing existing credentials.
3. Build provider-only subscribed-school provisioning, first-super-administrator invitation and school lifecycle management. They are not supplied by this increment.
4. Generalise the current fixed LYCEE_BATOURI runtime/sign-in context for each subscribing school, with no cross-school directory in institution-facing flows.
5. Complete live-module activation independently; the available finance/library/laboratory/attendance workspaces still include synthetic-only features.

Do not report subscription onboarding complete, silently promote every administrator, invent school ownership, seed real users, or restore over schooldb.
