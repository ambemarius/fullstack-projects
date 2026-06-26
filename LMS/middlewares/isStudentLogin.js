const Student = require("../model/Academic/student");
const verifyToken = require("../utils/verifyToken");

// Protects student-only routes. Verifies the JWT and attaches the student.
const isStudentLogin = async (req, res, next) => {
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

  const student = await Student.findById(verified.id);
  if (!student) {
    const err = new Error("Student not found");
    err.statusCode = 401;
    return next(err);
  }
  req.userAuth = student; // findById already excludes the password
  next();
};

module.exports = isStudentLogin;
