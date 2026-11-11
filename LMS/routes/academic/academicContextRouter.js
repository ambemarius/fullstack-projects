const express = require('express');
const isAccountLogin = require('../../middlewares/isAccountLogin');
const AcademicYear = require('../../model/Academic/academicYear');
const TimeSlot = require('../../model/Academic/timeSlot');

const router = express.Router();

// Minimal shared metadata, not the administrator's years/personnel dropdown payload.
router.get('/', isAccountLogin, async (_req, res) => {
    if(_req.app.locals.legacyScopedReferencesEnabled)return res.json({status:'success',data:await require('../../controllers/academic/scopedLegacyReferences').handle(_req,'context')});
    const [year, slots] = await Promise.all([AcademicYear.findCurrent(), TimeSlot.getAll()]);
    res.json({ status: 'success', data: {
        currentYear: year ? { id: year.id, name: year.name, fromYear: year.fromYear, toYear: year.toYear } : null,
        slots: slots.map(slot => ({
            id: slot.id, slot_number: slot.slot_number,
            start_time: slot.start_time, end_time: slot.end_time,
            is_break: slot.is_break, sort_order: slot.sort_order,
        })),
    } });
});

module.exports = router;
