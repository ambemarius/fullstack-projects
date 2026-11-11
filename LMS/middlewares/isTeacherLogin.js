const Teacher = require('../model/staff/teacher');
const { createRoleAuth } = require('./roleAuth');
module.exports = createRoleAuth({ accountType: 'teacher', findById: id => Teacher.findById(id) });
