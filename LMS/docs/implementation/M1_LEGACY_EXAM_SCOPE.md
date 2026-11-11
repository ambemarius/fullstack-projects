# Original exam-result scope boundary

27 October 2026. **Activated on the original listener**, preserving existing response shapes and publication behavior. This is M1 authorization/query scoping, not an MCQ expansion or M3 grading/report policy change.

Routes covered:

- GET /api/v1/exam-results/exam/:examId
- PUT /api/v1/admin/publish/exam/:id
- PUT /api/v1/admin/unpublish/exam/:id

## Authority and data statements

legacyCredentialVersion now shares its existing canonical/source credential proof through legacyIdentity, returning immutable server-derived account/school/membership metadata while retaining the original numeric-version wrapper contract. No login response or credential is exposed by that internal helper.

createLegacySchoolAccess resolves only a signed role-bound JWT from the Authorization header. It checks current verified legacy mapping, account/member/school/required role, source status/role, binary credential alignment and the JWT credential version. A WeakMap binds immutable contexts to the original token. Authorization re-verifies token expiry and SQL state on every use; a plain object or caller-supplied school cannot create authority.

legacyExamResultsService rechecks administrator authority inside each exam/result statement as well as the access layer. Resource and result joins both constrain school_id, so a foreign exam ID returns404 and a foreign result cannot leak through a global query. Publication takes a school/exam application lock under SERIALIZABLE, updates only isPublished for that school's exam/results, checks live authority/expiry again before auditing and commits atomically. Missing/foreign exams404; unknown publication body fields422. Audit failure rolls back publication; expired/stale authority cannot commit an audit. No pupil enrolment/assignment/year inference occurs.

The two publication operations preserve existing last-serialized-operation behavior; no score/grade/passmark/status/position calculation or version-policy redesign was introduced. Existing API response shapes/messages are retained. New explicit no-store headers cover JSON clients. Teacher/pupil academic exclusions and all personnel/academic/auxiliary/course locks remain active. These original APIs are still excluded from the canonical runtime.

## Verification and activation

**108 isolated +20 synthetic SQL tests passed**, zero failures/skips/TODO. A final focused actual-HTTP SQL test passed after the final transactional authority and cache-header checks. The SQL test exercises both schools' real source profiles/maps/memberships, cross-school read/write404, strict publication payload rejection, actual original HTTP adapters, private JSON caching, audit-failure rollback, concurrent publication operations, stale credential versions, role revocation and unchanged score/grade/history fields. Unit tests refuse missing/wrong-role tokens, forged contexts, invalid IDs/states and absent authority before SQL.

Original readiness was read-only: existing migration/source/staff checks passed; exam/result ownership remained exclusively approved LYCEE BATOURI; relevant tenant FKs were trusted/enabled. No schema migration, data repair, password change, real publication or production test record occurred. No adoption/restore/seed repeated.

Set shared legacyScopedExamResults=true only after tests/readiness. Restarted verified owned original listener, launchPID21128; canonical52032 was untouched. Actual /login header X-LMS-Scoped-Exam-Results:1 confirms the feature loaded. Anonymous exam-result read and publication return401 without a real password or token. Extended pinned HTTPS checks pass existing canonical staff/course protections and actual original409 locks. Verify process metadata before acting; PIDs are launch evidence. Browser/owner acceptance remains pending the existing human handoff without further requests.

## Remaining boundaries and rollback

Source inventory still contains107 declarations/94 legacy APIs. It now marks exactly these three data handlers as legacy-exam-results-scoped. Of38 retained admin/any-account declarations,35 still need data-boundary review; the remaining unscoped writes are the three original timetable operations. Admin people/stats, reports, reference/academic inventories and other retained reads still need review. Do not interpret gate passthrough or these three fixes as complete tenancy or permission to open another real school.

Keep the new scope flag true during a repair. Turning it false would select the old unscoped fallback; do not use that as a rollback. Retain all old write locks and either repair the scoped service or place an explicitly reviewed denial on these three routes while preserving records. There is no schema rollback and no reason to restore data. Continue M1 without changing grading/history policy or starting M2.
