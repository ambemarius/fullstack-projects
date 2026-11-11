# Original timetable boundaries

27 October 2026. **Active in the original timetable interface** at http://localhost:2026/timetable. Existing design, read response structures and first-fit weekday/slot placement order are retained. This increment closes timetable authorization/data boundaries under M1; it does not begin historical reconstruction or the full M3 scheduling-policy redesign.

## Eight administrator routes

GET /api/v1/timetables; GET /form-data; GET /class/:classId; GET /class/:classId/grid; GET /class/:classId/periods; POST /api/v1/timetables; POST /generate/class/:classId; DELETE /:id. Short paths share the /api/v1/timetables prefix. Teacher/pupil old timetable paths remain intercepted by the existing course gate; no unreviewed access was reopened.

legacyTimetableService and scopedLegacyTimetable controller adapter use the verified legacy JWT/source/member context. Each statement rechecks account/member/role/credential version/expiry and binds school_id. Class, subject, teacher, year and slot parents must belong to the verified school; caller school/actor fields are rejected. INSERT SELECT checks all parents and authority inside the actual insertion statement. created_by remains the authenticated original Admins profile ID, preserving the original FK; audit actor uses the canonical account/member.

Reads scope timetable rows and joined teachers/subjects/classes/slots, including form inventories, allocations, year counters and period summaries. Current-year fallback searches only the verified school; explicit foreign year/class IDs404. Original safe teacher fields and grid empty-slot rows are retained. Legacy nullable-slot visibility for class/all modes is retained, and deletion handles legacy term case/trailing-space variants. JSON responses are no-store. No current/history data is repaired or inferred.

## Write and replacement protections

Create, delete and generation use serializable transactions and a shared school/year/term application lock, including cross-class generation. Parent proof, insertion/deletion and audit commit together. Delete derives its scope from a scoped existing row, then revalidates inside the write. Audit failure restores the entire previous state. Concurrent deletion has one success and one404; concurrent regeneration replaces rather than accumulating duplicate batches. Locks normalize term case/spacing consistently with legacy comparisons.

The weekday/slot first-fit loop and other-class teacher-busy exclusion retain the existing arrangement rule. Overflow is counted without materializing arbitrarily large lesson arrays. Only subjects actually allocated to the selected class/year participate in the confirmed teacher map.

Generation now requires one unambiguous active, explicitly year/term-confirmed teacher per allocated subject. Legacy NULL assignment years remain NULL and confer no inferred year. Missing/ambiguous assignments, no allocations/teaching slots, or an empty placement plan stop before deleting the existing timetable. Successful responses retain placed/overflow/unassignedSubjects fields; unassigned authority is an explicit409 instead of a partial destructive replacement. These are authorization/data-preservation prerequisites, not guessed repairs. Manual explicit entry remains available with same-school parents.

To regenerate, administrators should confirm the real current-year/term teaching assignments in https://localhost:2027/courses. Do not fabricate old-year links to make generation pass. Historical timetable reads remain available for explicitly selected owned years. Allocation configuration changes and broader scheduling/manual-overlap policy remain separate approved work; this does not claim complete M3 conflict/interval correctness.

## Verification and activation

**112 isolated +22 synthetic SQL tests passed**, zero failures/skips/TODO; final focused SQL test and five active-policy planner/inventory tests passed. Coverage includes first-fit/busy order, missing/ambiguous assignment refusal, bounded overflow counting, actor/school injection, all five foreign parents, foreign reads/deletion/generation, all eight actual HTTP adapters, safe form data and cache headers, unknown-year preservation, failed-audit rollback for create/delete/generation, same-class and cross-class concurrent generation, non-accumulating replacement, legacy term-case deletion, stale credential versions and unchanged other-school timetable snapshots.

Read-only real readiness passed: existing schema/source/staff checks, exclusive approved timetable/slot/allocation/offering/assignment/parent ownership and trusted timetable FKs. No schema migration, seed, restore, real timetable generation/deletion, assignment repair, account or password change was performed. All positive write tests use the allowlisted synthetic database and clean their fixtures.

Enabled legacyScopedTimetables=true after verification. Restarted only the verified original listener, launchPID43004; canonical52032 unchanged. Live X-LMS-Scoped-Timetables:1, anonymous timetable read/create401, pinned canonical staff/course HTTPS and existing original409 write locks passed. Verify process metadata before acting; PIDs are historical launch evidence. Actual human browser/owner acceptance remains pending without certificate bypass or repeated request.

## Remaining M1 and recovery

The source ledger still has107 declarations/94 legacy APIs. It annotates3 exam,9 personnel and8 timetable admin handlers:20 of38 retained admin/any-account declarations. The remaining18 are reads requiring review; no remaining retained administrator write is labelled unassessed in this ledger. That is a review metric, not certification of every unported handler, implicit model call or other role. Real multi-school onboarding and M2 remain blocked by the remaining boundaries and acceptance gates.

Keep the new flag true during a repair; false selects old unscoped fallbacks. If necessary, place reviewed temporary denials on affected paths while preserving data and every existing writer lock. Do not restore the database or regenerate schedules as a rollback. Applied migrations001–009 remain immutable. Continue remaining report/reference/academic/self-read boundaries without changing grading, promotion or historical policy.
