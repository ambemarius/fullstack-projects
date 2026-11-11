# M1 browser verification and acceptance handoff

**Subsequent owner decision,29 October:** owner accepted M1 and explicitly authorized M2. The acceptance-pending statements below document the earlier handoff and are superseded. M1 is closed; see M1_COMPLETION_CHECKLIST.md and M2_IMPLEMENTATION_PLAN.md.

29 October 2026. **Technical M1 exit checks pass. Formal owner acceptance remains pending; M2 has not started.** This supersedes pending keyboard/mobile/two-school findings in the 28 October exit review.

## Environment and preservation

The real LYCEE BATOURI interfaces remain on ports2026/2027. Browser tests used a separate loopback HTTPS host on2028 with existing fixtures in MARIUS/lms_test_codex. The launcher requires the synthetic-only marker, matching migration checksums and existing fixture evidence; it never seeds or migrates. A separate secure cookie name prevents consuming or overwriting the real application's host-wide session cookie.

No real account, password, role, invitation, pupil, teacher, academic record or schema changed. No form was submitted. Original student and teacher partials remain byte-for-byte preserved. Migrations001–009 remain immutable. No runtime restart was needed for these static JavaScript changes; prior launch evidence remains original56744/canonical52032, subject to ownership verification before future restarts.

## Observed browser results

| Check | Observed result |
| --- | --- |
| Real sign-in at width390 | Email/password keyboard order works; document width375 equals scroll width375; no credentials entered |
| Registration widths320,390,768,1280 | Pupil/teacher controls remain in bounds; content widths305,375,753,1025 respectively equal scroll widths |
| Pupil keyboard traversal | All18 enabled named controls reached, ending at submit; no submission |
| Teacher keyboard traversal | All19 enabled named controls reached, ending at submit; no submission |
| Navigation keyboard | Enter selects Teacher and updates pressed states; Enter opens mobile menu; Escape closes it and returns focus to toggle; reverse Tab verified |
| School A to B | Maplewood records replaced by Riverside; only the selected school's synthetic pupil/teacher appear |
| School B to A after fix | Workspace immediately hidden and both tables empty during request; only A records return on success |
| Teacher roster | Sample teacher A sees its own Form1/Math assignment and Sample Pupil A, without B records |
| Teacher visits admin registration | Administrator-required message; workspace hidden and both tables empty |
| Expired session | Access-denied response hides/clears private workspace; fresh synthetic sign-in restores authorized access |
| Logout | Synthetic teacher/admin signed out; chooser returned |

Viewport emulation was available through the **browser-level** capability. The earlier conclusion based on tab capabilities is superseded. No certificate warning was bypassed.

## Fixes and regression evidence

Registration switching now clears rows, edits, selections and forms immediately, advances the request epoch to reject stale responses, and hides the workspace until context loads. Failed switching/bootstrap remains locked and cannot show false success. Accessible search names and table column scope are added through canonical JavaScript, preserving original form partials.

Three behavioral tests cover delayed responses, failed bootstrap and failed switching. A preview-cookie test verifies real cookies are ignored/not overwritten, duplicates rejected and secure attributes retained.

Final full isolated suite: **122/122 pass**, zero failures/skips/TODO,54.869 seconds. An initial exact-form-preservation failure was corrected by restoring original partial bytes and moving accessibility attributes into JavaScript; the entire suite then passed. Previous **24/24 synthetic SQL** results remain the database baseline, not a new rerun: no SQL/service/schema changed this increment. Browser checks used actual guarded synthetic SQL for sessions, switching, roster reads and denial.

After logout, viewport reset, temporary tab closed and owned preview process stopped. Final loopback verification confirms2028 is closed. Real pinned-certificate HTTPS checks pass: real-school shell, no sample/legacy bypass, unauthorized writes blocked and invalid credentials denied. No real password used.

## Visual evidence

- [Pupil form at320px](evidence/m1-mobile-student-320-2026-10-28.png)
- [Teacher form at320px](evidence/m1-mobile-teacher-320-2026-10-28.png)
- [Teacher denied administrator registration](evidence/m1-teacher-registration-denied-2026-10-29.png)

Captures contain blank forms or synthetic data. These are scoped M1 checks, not full M7 accessibility certification.

## Remaining decision

Owner acceptance of the delivered M1 interface remains the final checklist gate. All technical M1 gates have evidence; no additional implementation blocker is recorded. M2 historical enrolments/assignments, grading/promotion changes and additional real-school onboarding remain gated. Keep scope flags and legacy writer locks enabled. The implementation automation remains deleted; do not recreate routine follow-ups for unchanged acceptance.
