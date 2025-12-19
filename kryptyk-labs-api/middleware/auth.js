// kryptyk-labs-api/middleware/auth.js
const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";

  // Expecting "Bearer <token>"
  const [, token] = authHeader.split(" ");

  if (!token) {
    return res.status(401).json({ error: "Missing auth token." });
  }

  const secret = process.env.JWT_SECRET;
  const effectiveSecret = secret || "changeme";

  try {
    const payload = jwt.verify(token, effectiveSecret);
    // Attach to request so handlers can use it
    req.user = {
      id: payload.id,
      email: payload.email
    };
    next();
  } catch (err) {
    console.error("JWT verification error:", err);
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

module.exports = authMiddleware;

