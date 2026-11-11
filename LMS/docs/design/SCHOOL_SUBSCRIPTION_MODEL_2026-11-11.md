# School subscription and account ownership

## Owner clarification — 11 November 2026

The provider onboards a subscribing school with its name and an initial school super administrator account. That super administrator creates additional administrators and users for that institution. School users see only their own institution and do not need to understand other institutions or the provider's administration.

This supersedes earlier product assumptions that school staff should normally use cross-school account selection or platform-operator workflows. It does not authorise silently removing existing memberships, changing real passwords or promoting accounts.

## Required experience and authority

1. Provider administration is separate from school administration. The provider registers schools, records subscription entitlement and provisions the first school super administrator through private account activation.
2. The school has a dedicated sign-in destination and branded workspace. Its verified school context is resolved by the server; a school URL or hidden form field alone never grants access. No public directory of subscribing schools is needed.
3. The school super administrator manages school administrators, teachers, pupils and support staff, assigning only permissions within that school. They cannot create institutions, manage other subscriptions or grant platform authority.
4. Other administrators receive explicitly delegated school permissions. Teachers, pupils and support staff see their role-specific school tools. School authority must be checked on every protected operation, not just reflected in navigation.
5. Newly created accounts belong to the current institution by default. There is no cross-institution account directory in school administration. A matching email does not reveal or merge another institution's account.
6. Normal school pages show the institution, academic year and role, with one coherent navigation experience. Practice workspaces remain separate from the subscribed school's operational dashboard; unfinished modules must not masquerade as live school functionality.
7. Historical multi-school memberships must not be destroyed. Any future supported multi-school employment is an explicit exception with separately verified context, not the default school workflow.

## Source findings

- `model/identity/identityService.js` already contains school invitations, school memberships, school-aware login and session checks. These provide reusable foundations; this review does not certify every route.
- `model/identity/nativeStaffService.js` currently requires `platform_operator` for staff account administration. Merely renaming this permission to school super administrator would be unsafe: it includes platform-level authority and accepts target-school arguments.
- `views/canonical-staff-accounts.ejs` exposes existing-account concepts from other schools. School account-management presentation and its backend directory queries need a school-local contract.
- `views/canonical-school.ejs` and `public/js/canonical-school.js` contain fixed LYCEE BATOURI sign-in/identity labels rather than a general subscriber-school entry experience.
- `utils/schoolHub.js` links live school roles to separate practice origins for finance, library, laboratory and attendance. Those are synthetic workflows and cannot become live modules by relabelling links.
- `DECISIONS_REQUIRED.md` records a platform grant on an adopted LYCEE BATOURI administrator. Separate provider authority from ordinary school sessions through an explicit reviewed transition; preserve owner access and existing passwords.

## Implementation order

1. Define and test distinct provider and school-super-administrator permissions, including school-admin delegation, self-removal/last-super-admin protection and audit events. Stage any schema change as a new migration; preserve applied migrations.
2. Refactor account creation, invitations, recovery and account directories to use verified active-school authority. Keep provider-only school provisioning separate. Test two synthetic schools, forged target identifiers, cross-school email lookups and privilege escalation before activation.
3. Build the provider onboarding flow and first-super-administrator activation. Record subscription status without inventing prices, payment processing, grace periods or deletion rules. Commercial automation requires actual policy decisions.
4. Provide a school-specific sign-in and coherent school dashboard using verified school identity and role context. Remove cross-school account choices and practice links from ordinary school journeys only when suitable live destinations or honest availability states exist.
5. Integrate each remaining live module behind that institution's permissions and school context, with synthetic isolation checks before any live activation. Existing practice data must never be copied into school records.

## Acceptance

A provider can onboard School A and School B. Each initial super administrator can create and manage their own administrators/users. Each user sees only their institution. School A cannot read, alter, list or infer School B's private accounts/records by changing URLs or request bodies. No school account can grant provider authority. Recovery and invitation flows preserve those boundaries. School navigation does not route operational tasks into fictional practice data.

This record captures the requested product model and source gaps. It does not claim that subscription onboarding, a distinct school-super-administrator permission, or unified live modules are already implemented. No application, schema, account, password or data changes were made for this clarification.
