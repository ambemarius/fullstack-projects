// KodoSchool staff (platform console). The account belongs to no school, so requests run with no school set.
const PlatformAdmin = require('../model/platform/platformAdmin');
const { createRoleAuth } = require('./roleAuth');
module.exports = createRoleAuth({ accountType: 'platform', findById: id => PlatformAdmin.findById(id) });
