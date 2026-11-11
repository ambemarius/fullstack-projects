const Student = require('../model/Academic/student');
const { createRoleAuth } = require('./roleAuth');
module.exports = createRoleAuth({ accountType: 'student', findById: id => Student.findById(id) });
