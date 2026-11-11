# Legacy allocation reads: staged boundary

27 October 2026. Not mounted or activated.

`model/identity/legacyAllocationReads.js` implements list and class-list reads only. It binds the verified legacy administrator school/account/membership/source/version/expiry through the existing authority service. It scopes explicit year or current-year fallback, validates optional class ownership, and joins each allocation to same-school subject, class and year. Each separate query reauthorizes and includes SQL authority; caller ownership never selects the school. Existing list aliases and ordering are retained. No write, inferred teaching year, grading or migration is introduced.

Validation: two focused tests and all114 isolated tests passed, zero failures/skips. These mock-backed tests establish rejection and statement construction only; they do not establish SQL correctness or two-school isolation. The prior22 SQL test baseline was not rerun because no runtime path was activated.

Required next increment:

1. Add two-school synthetic SQL fixtures under existing exact database/marker guards. Exercise own/foreign year and class, scoped current-year fallback, empty allocations, invalid authority, expiry/version changes and parent joins.
2. Implement reviewed dropdown projections preserving existing classes/subjects/academic-year response fields and parent boundaries. Review shared original model calls separately.
3. Add actual original HTTP adapter coverage and preserve canonical legacy API exclusions. Keep original allocation writes locked.
4. Only after full isolated/synthetic SQL tests and read-only original ownership readiness, activate a reviewed flag with verified process ownership and live protection checks.

No controller, router, flag, listener, schema or real record was changed. Inventory remains18 unassessed retained administrator/any-account reads. M1 remains open; M2 and additional real-school onboarding remain gated. Keep existing active scope flags and shared write locks enabled.
