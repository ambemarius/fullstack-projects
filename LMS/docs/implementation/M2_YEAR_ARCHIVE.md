# M2 academic-year archival

Verified on two synthetic schools on 5 November 2026. In the M2 preview an administrator opens **Year coverage**, selects a year, reviews its pupil and teaching counts, enters a reason and chooses **Archive year**. The archived date appears on the same page. Academic setup continues to list the year for reading.

## Eligibility and effect

Choose another current year before archiving. Archival also requires zero active pupil profiles pointing to the selected year and zero unfinished placements. The latter count uses only the latest non-voided revision of each placement. A period is unfinished when its end is open or later than today's date in the school's time zone. An end date equal to today has already closed under the ledger's half-open interval rule.

The administrator reviews the other coverage discrepancies and supplies a reason. Archival freezes further placement revisions into and out of that year. Review missing dated placements before taking this permanent action. The operation never moves or withdraws a pupil, creates missing history, revises marks, or certifies a complete cohort. Existing source rows and dated history remain available.

## Storage and request boundary

Staged migration 013 creates an empty archive table, a unique index on the year definition and two triggers. The school/year key permits one receipt. The receipt records the version, frozen year definition, administrator membership and account, reason and UTC timestamp. Its foreign keys protect the archived year from deletion, reopening or changes to the pinned definition. The receipt is immutable. A ledger insert trigger checks both the new and previous year of a revision. Ledger inserts collect their result with OUTPUT INTO for SQL Server trigger compatibility.

The opt-in endpoint is `POST /api/setup/academic-years/:id/archive` with a version and a reason of up to 200 characters. It requires school administrator authority, a valid session, same-origin protection and CSRF. The setup transaction serializes archive, edit and current-year selection using the existing school lock. It rechecks eligibility, bumps the year version, records the receipt and writes the audit before committing. An archive conflict returns 409. The temporary preview owns its staged schema and removes only verified fixture data on exit.

## Verification and rollout

**Subsequent owner decision.** The restored-copy migration rehearsal described below has been waived. Synthetic regression tests remain in use. Production schema and writer activation are separate from the live read-only academic-records review.

142 isolated tests and 32 synthetic SQL tests passed. SQL verification included rollback of staged DDL, foreign-school and teacher denial, missing CSRF, active profile and unfinished-period refusal, duplicate archive attempts, competing current selection, failure of the final audit, direct receipt/definition protection, blocked placement revisions, and equality of coverage and revision history after archiving. Preview HTTPS confirmed archive, historical readback, foreign-school rejection and rejection of reactivation through the mounted application. The preview was stopped and its fixture cleanup succeeded. The deployed M1 health check passed.

For production review keep 010–013 outside migration discovery. Rehearse the four staged files together on a fresh independent restored copy of the current M1 database, verify stored values and migration history, then coordinate writer flags across both runtimes. Review real coverage and existing credentials through preservation checks before requesting activation. The old M1 adoption copy is historical evidence. A new restore must use a separate destination. After any future activation that records archives, preserve the receipts and guards during repair. Visual acceptance and the restored-copy rehearsal remain open.
