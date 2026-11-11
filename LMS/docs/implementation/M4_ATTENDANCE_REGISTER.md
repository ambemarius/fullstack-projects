# Attendance practice register

Open the practice server on port 2029 and choose **Open sample register**. Select a class and date. Record the number of periods a pupil attended, then save. A blank entry means attendance is still unknown. Saving zero marks all scheduled periods missed. Changing a recorded count requires a reason. The original and corrected counts remain in the revision history with the staff account, school membership and time.

## Data and access

The staged SQL defines a unique register for school, year, class and date. Each register has an explicit scheduled period count and a roster snapshot. Each version of a pupil's entry is a separate row. Submitting the same version concurrently allows one save. The API checks the discipline master role and current school membership. Writes also verify the session, origin, CSRF token, register and pupil.

The preview launcher `node scripts/attendancePreview.js` binds HTTPS to the loopback interface. It verifies the synthetic database name and marker before provisioning. The sample identity has a dedicated cookie, and each restart reuses the same synthetic school. Two fictional paper registers have six and eight periods respectively. They use generated pupils and illustrate entry and correction independently of real pupil placement.

## Verification and limits

All 148 isolated tests passed. The focused HTTP/SQL test `tests/sql/attendance-register.test.js` created two isolated school fixtures and cleaned up their records. It checked blank entries, seven of eight attended, zero of eight after correction, counts above the scheduled day, concurrent saves, correction reason and editor retention, independent dates, foreign-school access, role removal and request forgery.

The running preview passed HTTPS verification on 2029. The anonymous register request was denied. Sample sign-in returned two class dates and the selected register contained three fictional pupils.

Stop the dedicated preview process to withdraw the practice release. Practice entries persist in the synthetic database. Deployment to the school database requires reviewed register creation from the dated enrolment ledger and school calendar. Justification approval, weekly and term totals, and discipline thresholds remain separate work. M3 grading decisions and export work remain recorded in the phase plan.
