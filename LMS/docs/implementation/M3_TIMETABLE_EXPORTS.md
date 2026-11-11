# Personal timetable CSV and print

Teachers and pupils select a term in Courses. When lessons are available, **Download CSV** saves the timetable and **Print timetable** opens a dedicated page with a print button. Downloading or opening the print view checks the current session, school, role and lesson eligibility again.

Both formats use the existing personal timetable query. The CSV contains the academic year, term, day, start and end times, class, stream, subject, teacher and room. The writer quotes fields, doubles embedded quotes, preserves accented text and protects formula-like prefixes. The printable page escapes stored text, wraps long names, repeats column headings and hides the print button on paper. The release also corrects two misencoded separators in the on-screen schedule.

## Verification

All 148 isolated tests and the focused academic-links SQL test passed. Signed-in test accounts from two synthetic schools exercised both formats. The fixture covered teachers sharing a subject, pupil access, a revoked assignment, a revoked session, attempted school selection and names containing formula prefixes, quotes, accents and HTML markup. A separate Edge print-to-PDF check rendered the EJS template with 60 synthetic lessons. All 60 room markers and subject endings appeared across 13 pages. Each page contained the column headings.

The tracked canonical listener restarted on port 2027 under PID 29104. Its HTTPS check verified deployed controls and print assets, and anonymous denial for both formats. Signed-in export tests used synthetic records. The full schema-installing SQL suite was deferred to preserve the sample preview.

## Recovery and remaining work

This increment requires no database migration. To revert it, restore the preceding academic-links router, service, Courses client and matching health check from the personal timetable checkpoint `1793910277616_source.json.gz`, then restart the tracked canonical listener and verify access controls. B34 still includes the marks and report export paths on the original administrator interface. Report calculations remain subject to the school's section-specific grading rules.
