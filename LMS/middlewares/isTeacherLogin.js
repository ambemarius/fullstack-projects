const Teacher = require("../model/staff/teacher");
const verifyToken = require("../utils/verifyToken");

// Protects teacher-only routes. Verifies the JWT and attaches the teacher.
const isTeacherLogin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const err = new Error("No token provided, authorization denied");
    err.statusCode = 401;
    return next(err);
  }
  const token = authHeader.split(" ")[1];

  const verified = verifyToken(token);
  if (!verified) {
    const err = new Error("Token expired/invalid");
    err.statusCode = 401;
    return next(err);
  }

  const teacher = await Teacher.findById(verified.id);
  if (!teacher) {
    const err = new Error("Teacher not found");
    err.statusCode = 401;
    return next(err);
  }
  if (teacher.status === 'suspended' || teacher.status === 'withdrawn') {
    const err = new Error(`Your account has been ${teacher.status}`);
    err.statusCode = 403;
    return next(err);
  }
  req.userAuth = teacher; // findById already excludes the password
  next();
};

module.exports = isTeacherLogin;
