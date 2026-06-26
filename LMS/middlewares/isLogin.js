const Admin = require("../model/staff/admin");
const verifyToken = require("../utils/verifyToken");

const isLogin = async (req, res, next) => {
  // get token from the Authorization header: "Bearer <token>"
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const err = new Error("No token provided, authorization denied");
    err.statusCode = 401;
    return next(err);
  }
  const token = authHeader.split(" ")[1];

  // verify token
  const verifiedToken = verifyToken(token);
  if (!verifiedToken) {
    const err = new Error("Token expired/invalid");
    err.statusCode = 401;
    return next(err);
  }

  // find the admin and attach it (without the password) to the request
  const user = await Admin.findById(verifiedToken.id);
  if (!user) {
    const err = new Error("Admin not found");
    err.statusCode = 401;
    return next(err);
  }
  const { password, ...safeUser } = user;
  req.userAuth = safeUser;
  next();
};

module.exports = isLogin;
