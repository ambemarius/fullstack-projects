# Year-specific offerings and teaching history

5 November 2026. This increment is enabled in the guarded M2 synthetic preview. LYCEE BATOURI uses the M1 course workspace.

## Administrator workflow

Sign in to the synthetic preview as the sample administrator in Ledger A. Under **Subject memberships**, use **Year offerings and teaching history** to select an academic year and a class subject. For the school’s current year, enter the explicit coefficient and the source reference supporting it. Each save records another revision. The catalogue coefficient is displayed separately. A year starts unconfigured even if an earlier year has a coefficient.

Use **Manage subject memberships** to assign or revoke a teacher for a term in the current year. Each actual change records the teacher, offering, term, year, status, link version, editor, UTC recording time and applicable coefficient revision. Co-teachers have independent assignments. Repeating a request for the existing state with the current version adds no event. Selecting an earlier year displays the evidence recorded for it.

The preview requires a configured year offering before granting an assignment or enrolling a pupil. Revocation of an existing explicit-year assignment is allowed even if its year has no recorded coefficient. Its event records the revocation with an unknown coefficient revision. Existing rows with a missing teaching year still require source review. Recorded times describe when edits were made. Teacher names in the history view are current display names.

## Storage, scope and concurrency

Staged migration 012 creates two empty append-only tables. The coefficient revision chain is keyed by school, class subject and academic year. Foreign keys bind the offering, year, editor membership and assignment event to the same school. A teaching event references its coefficient revision when known. Existing catalogue values, legacy assignment rows and historical reports receive no backfill.

The academic link service reuses its serializable transaction and school lock. A teaching change, year junction, event and audit commit together. Concurrent coefficient changes require the reviewed version. History readers take the same lock in shared mode so both result sets describe a consistent state. Each history collection has a 1,000-row review limit and rejects larger results. School administrators use the existing session, origin and CSRF boundaries. Assigned teacher access continues to depend on an active assignment for the exact year and term.

The synthetic HTTP interface accepts `POST /api/links/year-offerings` with offeringId, yearId, version, coefficient and sourceReference. `GET /api/links/offerings/:id/years/:year/history` returns coefficient revisions and recorded teaching changes. The scope of these endpoints is independent of report weighting and promotion policy.

## Verification and continuation

The two-school SQL rehearsal checks rollback, missing and foreign parents, stale versions, same-term co-teachers, undated legacy rows, independent years, immutable history, and a deliberately failed final audit. It verifies that an older assignment can be revoked before the first coefficient is configured. The interface test checks an explicit current-year submission, archived-year viewing and rejection of a stale form. Full results are in TEST_RESULTS.md.

The temporary preview includes a synthetic Geometry catalogue entry and teacher. Startup, certificate-pinned HTTPS entry, anonymous history denial and fixture cleanup passed. Visual browser acceptance is pending at the previously recorded certificate gate.

Keep 010–012 outside production migration discovery. Before activation reconcile real year offerings, year memberships, course links, assignment coverage and missing dates using read-only evidence. Review year archival protections, rehearse the concrete migration/rollback on a separate copy and verify all affected writers together. If a rollout needs to be stopped after users record year history, preserve both history tables and restrict affected writers during repair.
