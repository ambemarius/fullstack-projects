const asyncHandler = require('express-async-handler');
const Location = require('../../model/Academic/location');

//@desc   List all regions
//@route  GET /api/v1/locations/regions
//@access Private (admin)
exports.getRegionsCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedReferencesEnabled){const data=await require('./scopedLegacyReferences').handle(req, 'geography', 'regions');return res.status(200).json({status:'success',results:data.length,data});}

    const regions = await Location.getRegions();
    res.status(200).json({ status: 'success', results: regions.length, data: regions });
});

//@desc   Divisions of a region
//@route  GET /api/v1/locations/regions/:regionId/divisions
//@access Private (admin)
exports.getDivisionsCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedReferencesEnabled){const data=await require('./scopedLegacyReferences').handle(req, 'geography', 'divisions', req.params.regionId);return res.status(200).json({status:'success',results:data.length,data});}

    const divisions = await Location.getDivisions(req.params.regionId);
    res.status(200).json({ status: 'success', results: divisions.length, data: divisions });
});

//@desc   Subdivisions of a division
//@route  GET /api/v1/locations/divisions/:divisionId/subdivisions
//@access Private (admin)
exports.getSubdivisionsCtrl = asyncHandler(async (req, res) => {
    if(req.app.locals.legacyScopedReferencesEnabled){const data=await require('./scopedLegacyReferences').handle(req, 'geography', 'subdivisions', req.params.divisionId);return res.status(200).json({status:'success',results:data.length,data});}

    const subs = await Location.getSubdivisions(req.params.divisionId);
    res.status(200).json({ status: 'success', results: subs.length, data: subs });
});
