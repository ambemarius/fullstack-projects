const Admin = require('../model/staff/admin');
const { createRoleAuth } = require('./roleAuth');
module.exports = createRoleAuth({ accountType: 'admin', findById: id => Admin.findById(id) });
