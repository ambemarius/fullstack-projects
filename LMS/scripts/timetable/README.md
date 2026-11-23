# Timetable scheduler

Builds a clash-free weekly timetable for every class from the LMS's own allocations and teacher assignments, and reports exactly what cannot be scheduled and why. None of these scripts write to the database: the export only reads, and the other two work on JSON files.

**In the app:** administrators use **Timetable → Generate whole timetable** (`/timetable`). It runs the same scheduler (`utils/timetableScheduler.js`) on live data and shows a preview with every class grid. Only after confirmation does it replace the chosen term, in one transaction, with a JSON backup in `backups/timetable/auto/` (override with `TIMETABLE_BACKUP_DIR`). See `model/Academic/timetableGenerator.js`. These scripts are for "what if" staffing, which the button does not do.

## Pipeline

```bash
# 1. Export classes, weekly periods (subject_allocations), active teacher assignments and time slots.
npm run timetable:export -- backups/timetable/2026-27/input.json            # current year; add --year <id> for another

# 2. Optional "what if" staffing: hypothetical teachers (negative ids, names ending "(new)").
node scripts/timetable/addTeachers.js backups/timetable/2026-27/input.json backups/timetable/2026-27/staffed.json \
  --split "Mathematics:3,Chemistry:3,Physics:3,English Language:2,Biology:2" \
  --cover "French,Geography,History,Literature:2"

# 3. Schedule. --study fills the remaining slots with supervised study periods.
npm run timetable:schedule -- backups/timetable/2026-27/staffed.json backups/timetable/2026-27/run --study
```

`backups/` is git-ignored, which keeps exports (teacher names) and reports out of the repository.

Step 3 writes `timetable_report.md` (validation, teacher loads, shortfalls, every class and teacher grid) and `timetable.json` (grids with class, subject and teacher ids). It exits with code 1 if the result breaks a hard rule; that should never happen.

## Rules

**Never broken:** a teacher is in one class per slot; a class has one lesson per slot; no subject goes beyond its weekly periods; no teacher works more slots than the week has (lessons plus supervision).

**Optimised:**
- Places as many required periods as possible. The subject furthest behind its weekly hours goes first, so no class loses a whole subject.
- Spreads lessons across the week: at most `ceil(periods / days)` per day, so 5 periods means one a day and 6 means at most two. This is relaxed by one only when nothing else fits.
- Keeps a teacher in the same room for back-to-back periods where possible.
- Study supervisors are teachers who are free and already in school that day, sharing supervision evenly.

**Method:** slot-by-slot bipartite matching between classes and free teachers, using augmenting paths, then a repair pass that moves one blocking lesson to make room for anything left over. A final check recounts everything from the grids.

## Reading the result

- `valid: true`: no hard rule broken.
- `complete: true`: also every required period placed and no empty student slot.
- If `complete` is false, the **Shortfall** and **Teacher load** tables show the cause: usually one teacher with more periods than the week has, or a subject with no active teacher.

## Data notes

- Only class subjects with an allocation for the year are exported. Linked but unallocated subjects (such as the duplicate History subjects, ids 3–5) are skipped.
- Several active teachers on one class subject are treated as a shared assignment: any of them may take a period.
- Teacher day preferences are not stored in the LMS yet, so preferred or free days are not modelled beyond the "already in school that day" rule for supervision.

## Importing a result

Importing replaces live timetable rows. The 2026-11-23 import (`backups/runtime/import_timetable.js`, with its backup and `rollback_timetable_import.js`) is a one-off example tied to that run. A future import should follow the same pattern: back up, run everything in one transaction, verify inside it, dry-run first, and only then use `--apply`.
