const Auxiliary = require('../model/staff/auxiliary');
const { createRoleAuth } = require('./roleAuth');
module.exports = createRoleAuth({ accountType: 'auxiliary', findById: id => Auxiliary.findById(id) });
