# Staff accounts

Open https://localhost:2027/staff-accounts. School code: **LYCEE_BATOURI**.

## Auxiliary staff

1. Create the personal record in **Auxiliary staff** and explicitly set it active.
2. The platform operator opens **Staff accounts**, chooses Discipline master, Librarian or Laboratory attendant, and clicks **Issue invitation**. Job titles do not grant access.
3. Give the token privately to the selected person. It is shown once, lasts24 hours and is not emailed automatically.
4. The recipient opens the same page, selects **Create my staff account**, pastes the token, and enters and confirms a private password: at least12 characters, at most72 UTF-8 bytes.
5. Success clears private fields and opens sign-in directly. Select **Auxiliary staff**, using the registered email and chosen password.

## Standalone administrators

The platform operator uses **Add a standalone administrator**, entering name and email, then issues an invitation for that new profile. The recipient privately sets a password and is returned to **Administrator** sign-in. No teacher profile is required; platform authority is not granted.

Existing administrators and additional admin roles for teachers remain at https://localhost:2027/invitations. Teacher registration/editing retains its original form and Teacher sign-in. Existing passwords are unchanged by this rollout.

## Password recovery and tokens

For newly invited native accounts, the operator clicks **Issue password recovery**. The recipient selects **Reset my staff password**, pastes the token and privately chooses a new password. Only their submission changes it; all their account sessions then end, including other schools. Adopted legacy teacher/administrator accounts retain their separate trusted recovery procedures; this form cannot overwrite legacy credentials.

**Recent staff tokens** lets the operator revoke unused tokens. Tokens work once. Revoke a pending token before issuing another. A changed account/profile can invalidate a token; refresh and reissue instead of choosing a password for someone else.

## Suspension and removal

Auxiliary **suspended** or **withdrawn** status ends that school's linked sessions immediately. Other schools retain their own explicit memberships. Deliberate reactivation requires fresh sign-in; revoked sessions do not revive.

For a new standalone administrator, **Disable administrator access** ends school access. Original administrators, platform authority, self-removal and the last verified original administrator are protected. Revoked memberships/links stay reserved and require separate review before restoration.

## Existing accounts and schools

An operator can explicitly select an eligible existing account when inviting an auxiliary profile in another school. The recipient first authenticates, then selects **Join with my existing account**. Passwords are preserved; matching email never merges accounts automatically. Occupied/revoked memberships require review.

The live runtime remains restricted to LYCEE BATOURI. Two-school account switching/isolation is tested; opening another real school still requires the remaining M1 route/acceptance gates. Discipline, library and laboratory operational modules remain in later phases.
