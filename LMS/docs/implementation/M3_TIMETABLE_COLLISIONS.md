# M3 administrator timetable collisions

## Administrator workflow

On the original Timetable Management page, select the class, teacher, day, teaching slot, term and year. Enter a room when one is assigned. An overlapping booking identifies the class, teacher or room that is already busy. Adjacent lessons can meet at the same clock time. A given slot can be booked only once for the same resource and day. Room matching ignores surrounding whitespace and letter case. Blank rooms reserve no named room.

Generate uses the existing first-fit order and confirmed year/term teacher assignments. It skips slots that overlap another lesson for the class or its teacher, even across different slot IDs. Generated lessons continue to have an unspecified room. If the planner cannot place every period, it reports how many are outstanding and keeps the previous schedule. The planner makes no claim that a different ordering could never fit.

## Implementation and evidence

The scoped timetable service checks bookings inside the existing school/year/term transaction lock. Manual and generated writes use the same lock. Legacy entries without a slot ID can block a conflict by clock range. An unusable stored time range conservatively blocks the affected resource on that day. A write uses the existing tables and audit transaction.

All 146 isolated tests and the focused SQL test in `tests/sql/legacy-timetable.test.js` passed. Synthetic cases covered distinct slots with overlapping times, back-to-back lessons, invalid times, breaks, equivalent room names, scope across terms and schools, and concurrent creates with one winner. Incomplete generation and a forced audit failure both preserved the previous timetable. The HTTP adapter returned 409 with the conflict reason.

The ownership-checked original listener restarted on 2026 under PID 3376. The post-restart health check verified the timetable boundary header, anonymous read/write denial, and canonical HTTPS health. Positive writes ran only on synthetic schools. The full schema-installing SQL suite was deferred to preserve the active sample preview.

For rollback, take timetable writes offline and restore the previous scoped service from the preceding source checkpoint before a verified restart. Retain the scoped route flag and legacy write locks. This release requires no migration or timetable data restoration. Teacher and pupil self-service timetable screens are a separate B34 item.
