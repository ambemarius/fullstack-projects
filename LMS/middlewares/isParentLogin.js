const Parent = require('../model/Academic/parent');
const { createRoleAuth } = require('./roleAuth');
module.exports = createRoleAuth({ accountType: 'parent', findById: id => Parent.findById(id) });
