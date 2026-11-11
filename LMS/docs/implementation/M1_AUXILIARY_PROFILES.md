# Scoped auxiliary staff records

27 October 2026. **Activated at https://localhost:2027/auxiliary** against LYCEE BATOURI's adopted schooldb. This is the auxiliary personnel-record workflow, not an auxiliary sign-in or permission-grant workflow. M1 remains in progress.

## Delivered

School administrators can register, search/page through, edit and set pending/active/suspended/withdrawn status on their school's auxiliary records. New records start pending. Records are retained; no hard-delete endpoint is exposed. Names/email/phone/job title use bounded validation. Original legacy full-name text is preserved on non-name edits. The admin-style workspace uses the existing stylesheet and is linked from the canonical home and original auxiliary tab/hash handoff.

The existing auxiliary_staff.role column is a **job label only**, presented as jobTitle in the new API. No accounts, membership roles, platform grants, credentials or sessions are created/changed by this feature. Choosing a label such as Librarian or Platform operator cannot confer authority. Account invitations and actual auxiliary permissions remain separate M1 work.

No schema migration was necessary. Optimistic versions are SHA-256 representation tokens over the exact selected record fields, including original name/status/school/creation timestamp. They are not authentication credentials or monotonic counters. An edit/status transaction locks the school-scoped record, compares the supplied token, then writes and audits atomically. Audit stores action/reason/changed field names, not field values. Unchanged representations may keep the same token. This avoids silently adding or renumbering live legacy versions while still rejecting competing edits.

## Implementation

- model/identity/auxiliaryService.js: admin-only scoped lists and serializable create/update/status transactions, fresh SQL authority, strong representation tokens, per-school duplicate handling and safe DTOs.
- routes/identity/auxiliaryRouter.js: GET/POST /api/auxiliary, PATCH /:id, POST /:id/status; opaque cookie identity, exact Origin and CSRF for mutations. Caller school/account/permission/password/status fields are rejected from profile payloads.
- views/canonical-auxiliary.ejs and public/js/canonical-auxiliary.js: familiar admin layout, search/paging, explicit status actions, no account/permission controls, safe text rendering and private-cache clearing on denial/logout.
- legacyAuxiliaryGate.js and shared runtime policy: original auxiliary non-read endpoints now return409 and the canonical URL. Existing original reads remain available. New canonical handler is enabled only by canonicalAuxiliaryWrites=true alongside personnel context.
- Canonical startup verifies auxiliary ownership before activation. No source ownership or credential repair is inferred. Original student/teacher forms and academic setup remain available.

## Verification and activation

**74 isolated tests and 14 synthetic SQL tests passed**, zero failures/skips/TODO. SQL coverage includes two-school isolation, teacher denial, same email across separate schools, stale edits, a concurrent-edit winner/409 loser, soft withdrawal, original full-name preservation, atomic audit-failure rollback and unchanged account/role/platform-grant counts despite authority-like job labels. HTTP tests verify admin-only protected page, CSRF, injected permission rejection and old write exclusion. All fixtures remain in the allowlisted synthetic database and are cleaned up.

Real readiness passed with no auxiliary ownership conflict and no personnel drift. Activated the original write lock first (actual POST /api/v1/auxiliary/register returned409), repeated readiness, then restarted the tracked canonical listener. Launch PIDs original42736/canonical31852; verify ignored runtime process files before acting. Post-restart pinned HTTPS checks passed, including auxiliary anonymous redirect and unauthenticated GET/POST denial. Original dashboard rendered HTTP200 with the auxiliary handoff attribute. No real password or production test auxiliary record was used; no production profile, school ownership, historical data or schema was changed by verification.

Browser/owner acceptance is still pending. Do not repeat the certificate request while the owner rests; continue independent approved work. Next M1 items are administrator/native account workflows, auxiliary account invitations/permissions, existing-account and multi-school profile handling, and remaining domain boundaries. Do not label M1 complete or advance M2 based on this profile-only increment.
