# M3 raw-score entry

## Using the change

On the canonical school's Courses page, a teacher chooses a term and opens **Raw marks** beside a confirmed teaching assignment. An administrator selects an offering and uses **Open raw mark sheet**. Enter a score and its maximum for each sequence. Zero is a recorded score. Leave an unrecorded sequence blank. **Save changed scores** sends the edited rows together, up to 200 per request. **Save score** saves one row.

If another editor saved a newer version of any selected row, the server returns a conflict and rolls back the entire batch. Edits remain visible so the teacher can compare them with a freshly opened sheet before retrying. Each committed score has its own version and audit event, with one request ID shared by the batch.

## Verification and operation

- The isolated suite passed all 145 tests. The client tests cover incomplete rows, zero, stale versions, retained drafts and a response that returns saved versions in a different order.
- The focused two-school SQL test in `tests/sql/academic-links.test.js` passed through the canonical HTTP API. It verified that a stale second row reverses an earlier insert and its audit event. A successful batch saved both scores and linked their audits.
- The ownership-checked canonical restart launched PID 21028 on port 2027. The pinned HTTPS smoke test verified the deployed Courses script, sign-in requirement and unauthenticated mark-write denial. Authenticated score changes were exercised on synthetic records. The full schema-installing SQL suite was deferred to preserve the running sample preview.
- The increment requires no SQL migration. To roll back the feature, restore the preceding Courses client, marks service and matching health check from the reviewed source checkpoint, then restart the canonical listener and run its HTTPS checks. Existing saved scores use the same schema.

## Dependencies still open

The last live placement review found 79 active pupils without a year and 177 teaching links without a year. A teacher needs a confirmed assignment for the selected year and term. Saving requires active subject enrolment and a matching current class and year for the pupil. Use school records to reconcile these facts.

Report-card calculations and promotion depend on the school's rules for both sections, including maxima, weighting, rounding and treatment of a missing sequence. Timetable collision handling can proceed independently.
