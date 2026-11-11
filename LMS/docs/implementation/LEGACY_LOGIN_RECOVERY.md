# Original application login diagnosis and optional recovery

**Post-adoption notice, 27 October:** this legacy-only administrator updater now refuses canonical databases to prevent one-copy credential changes. Its earlier pre-adoption recovery is historical. The currently requested teacher reset uses scripts/Recover-TeacherPassword.ps1 and M1_TEACHER_RECOVERY.md. Do not reuse the old Apply command on adopted schooldb.

Follow-up: owner ran recovery and received the original generic failure. Its cause was not captured, so no successful reset is assumed. Updated wrapper validates password length/UTF-8 size locally before any update, and Node emits only closed safe diagnostic codes (including SQL error number without raw driver text). Added validation-only mode (`-ValidateOnly`, never combine with `-Apply`), BOM/UTF-8 decoding and safe stderr display. Verified actual Windows PowerShell child-process handoff with generated non-account input: passwordAccepted=true, changes=0. `npm.cmd test`: 56 passed; focused recovery tests also pass. No live apply was executed by the agent.

26 October 2026. Owner reports “Invalid login credentials” at http://localhost:2026/login. Verified configured original target is MARIUS\DEV / schooldb. Administrator and active teacher identifiers exist; selected credential metadata shows supported bcrypt hashes. A deliberately nonexistent login returns the expected HTTP 401, rather than a connection/server error. No real password was requested in chat, guessed, disclosed or tested by the agent. The exact unsuccessful user role/password combination was not observed, so this diagnoses a credential/role mismatch rather than proving which password was entered.

The supplied email list identifies existing accounts, not sample credentials. Correct role selection and each account's existing password are required. SQL Server credentials and the port-2027 sample shortcuts do not authenticate the original UI. The owner prefers the original teacher/pupil creation design; this preference remains recorded in DECISIONS_REQUIRED.md.

Prepared `scripts/recoverLegacyAdmin.js` and `scripts/Recover-LegacyAdmin.ps1`. Default mode is read-only review. The reviewed candidate admin@school.local is account ID 7; review returned changes=0. No password reset was applied.

If the owner chooses recovery, they run this locally and enter/confirm the new password through masked PowerShell prompts:

```powershell
& 'C:\Users\amben\Desktop\FS_PROJECTS\LMS\scripts\Recover-LegacyAdmin.ps1' -Email 'admin@school.local' -Apply
```

The Apply flag and local human entry authorise changing exactly that reviewed account. The tool requires the exact original server/database, a uniquely identified administrator role and matching reviewed account ID. It writes a bcrypt cost-12 replacement only if the original hash is unchanged, refuses concurrent account replacement/reset and changes no role, email, other account or schema. Passwords are sent to the node child through private standard input, never command-line arguments, environment variables or files. Do not enter a new password in chat. After successful completion, select Admin, admin@school.local and the newly chosen password on the original login page.

Existing legacy tokens retain their normal expiry (up to one hour); this tool does not rotate the shared signing key or log out unrelated users. Immediate per-account session revocation is part of canonical M1 sessions, not retrofitted by this recovery tool.

Validation: `npm.cmd test` passed 54 isolated tests with zero failures/skips/TODO. New fake-adapter tests prove default nonwriting review, wrong-target refusal, reviewed-ID checks, bounded optimistic update, password exclusion from output and concurrent-change refusal. Live execution was review-only; no live apply test or successful original-account browser sign-in is claimed. Original UI code and passwords remain unchanged pending owner action.
