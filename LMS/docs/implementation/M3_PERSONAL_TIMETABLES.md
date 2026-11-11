# Personal timetables

Teachers and pupils open Courses and choose a term to see their lessons in weekday and time order. Each entry shows the recorded time, class and stream, subject, teacher and room. Entries with recorded times and no slot ID are included. The original My Timetable bookmarks take users to Courses, which requests a school sign-in when needed.

The read-only endpoint `GET /api/links/my-timetable?yearId=…&term=…` verifies the session, selected school, membership, role, mapped profile and current year. Its query accepts only year and term. Every lesson requires an active teacher with an explicit assignment for its class, subject, year and term. A teacher sees only lessons naming that teacher. A pupil needs active subject enrolment and a current class and year matching the lesson. When dated placements are enabled, exactly one effective enrolled placement must also match. A missing confirmation produces an empty or partial schedule. Reconcile the underlying school records before expecting additional lessons.

The dashboard uses text nodes for all returned values. A denied request clears the course workspace. The original legacy API locks still apply. The change requires no schema migration.

All 147 isolated tests and the focused academic-links SQL test passed. The fixture used two schools, two teachers with the same class and subject, an enrolled pupil and a peer with revoked enrolment. The signed-in HTTP checks verified term and year filtering, missing placement, rejected caller profile selection, revoked assignment and session, administrator denial and uncached responses.

The post-restart check verified the two redirects on 2026, the deployed client and anonymous denial on 2027, and the existing HTTPS and access checks. Signed-in validation used synthetic records. Human browser acceptance remains open. The full schema-installing SQL suite was deferred to preserve the sample preview.

To roll back this increment, restore the previous academic-links service and router, Courses client, original page routes and matching health check from the preceding source checkpoint. Restart the two tracked listeners with ownership checks and verify their access boundaries. Continue with B34 exports, using only records visible to the signed-in role.
