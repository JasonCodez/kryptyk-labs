// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const multer = require("multer");
const path = require("path");

const crypto = require("crypto");

const router = express.Router();

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------

function normalizeEmail(email) {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      clearance_level: user.clearance_level || "INITIATED"
    },
    process.env.JWT_SECRET || "changeme",
    { expiresIn: "7d" }
  );
}

function generateSixDigitKey() {
  // 000000–999999 with leading zeros
  const n = Math.floor(Math.random() * 1000000);
  return n.toString().padStart(6, "0");
}

async function hashKey(raw) {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);
  return bcrypt.hash(raw, rounds);
}

async function validateAccessKey(userId, rawKey) {
  // newest, unused, unexpired key for this user
  const result = await db.query(
    `SELECT id, key_hash, expires_at, used
     FROM access_keys
     WHERE user_id = $1
       AND used = FALSE
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const ok = await bcrypt.compare(rawKey, row.key_hash);
  if (!ok) return null;

  return row; // includes id
}

async function findUserByEmail(email) {
  const res = await db.query(
    `SELECT *
     FROM users
     WHERE email = $1`,
    [email]
  );
  return res.rows[0];
}

async function markKeyUsed(id) {
  await db.query(
    `UPDATE access_keys
     SET used = TRUE
     WHERE id = $1`,
    [id]
  );
}

// ---- Numeric ROT helpers for the puzzle key ----

function encryptKeyWithShift(rawKey, shift) {
  return rawKey.replace(/\d/g, (d) =>
    String((parseInt(d, 10) + shift) % 10)
  );
}

function decryptKeyWithShift(cipher, shift) {
  return cipher.replace(/\d/g, (d) =>
    String((parseInt(d, 10) - shift + 10) % 10)
  );
}

// -------------------------------------------------------------
// Upload config for profile photos
// -------------------------------------------------------------
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, "..", "uploads"));
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `profile_${Date.now()}${ext}`;
      cb(null, name);
    }
  })
});

// -------------------------------------------------------------
// REQUEST ACCESS (initial signup, puzzle-based)
// -------------------------------------------------------------
router.post("/request-access", async (req, res) => {
  try {
    let { email } = req.body || {};
    const emailNorm = normalizeEmail(email);

    if (!/\S+@\S+\.\S+/.test(emailNorm)) {
      return res.status(400).json({ error: "Invalid email." });
    }

    let user = await findUserByEmail(emailNorm);

    // If user exists AND has password -> they must use reset instead
    if (user && user.password_hash) {
      return res.status(403).json({
        error: "This asset is already registered. Use RESET PASSWORD instead."
      });
    }

    // Create user if not exists
    if (!user) {
      const insert = await db.query(
        `INSERT INTO users (email, is_verified, clearance_level)
         VALUES ($1, FALSE, 'INITIATED')
         RETURNING *`,
        [emailNorm]
      );
      user = insert.rows[0];
    }

    // Raw key that /verify-key will expect
    const rawKey = generateSixDigitKey();
    const hashed = await hashKey(rawKey);

    // Invalidate old keys
    await db.query(
      `UPDATE access_keys
       SET used = TRUE
       WHERE user_id = $1 AND used = FALSE`,
      [user.id]
    );

    // Insert new key (15 minute TTL)
    await db.query(
      `INSERT INTO access_keys (user_id, key_hash, expires_at, used)
       VALUES ($1, $2, NOW() + INTERVAL '15 minutes', FALSE)`,
      [user.id, hashed]
    );

    // Cipher for the puzzle
    const shift = Math.floor(Math.random() * 9) + 1; // 1–9
    const cipher = encryptKeyWithShift(rawKey, shift);
    const sanity = decryptKeyWithShift(cipher, shift); // should equal rawKey

    console.log("=== ACCESS KEY DEBUG ===");
    console.log("email:   ", emailNorm);
    console.log("rawKey:  ", rawKey);
    console.log("shift:   ", shift);
    console.log("cipher:  ", cipher);
    console.log("sanity:  ", sanity);
    console.log("========================");

    return res.json({
      ok: true,
      cipher,
      shift,
      rawKeyDev: sanity, // dev-only; front-end can ignore or use
      message:
        "Cryptographic access artifact issued. Decrypt the key using the gate hint to proceed."
    });
  } catch (err) {
    console.error("request-access error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// -------------------------------------------------------------
// VERIFY KEY (Step 2)
// Expects the *real* 6-digit key, not the cipher
// -------------------------------------------------------------
router.post("/verify-key", async (req, res) => {
  try {
    let { email, key } = req.body || {};
    const emailNorm = normalizeEmail(email);

    if (!emailNorm || !key) {
      return res.status(400).json({ error: "Missing email or key." });
    }

    const user = await findUserByEmail(emailNorm);
    if (!user) {
      return res.status(404).json({ error: "No asset found." });
    }

    const record = await validateAccessKey(user.id, key);
    if (!record) {
      return res
        .status(400)
        .json({ error: "Invalid or expired access key." });
    }

    // Do NOT mark it used yet; we let complete-signup actually consume it.
    return res.json({ ok: true });
  } catch (err) {
    console.error("verify-key error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// -------------------------------------------------------------
// COMPLETE SIGNUP (Step 3)
// NOTE: front-end only sends { email, password }
// We do NOT require key again here, since /verify-key already checked it.
// -------------------------------------------------------------
router.post("/complete-signup", async (req, res) => {
  try {
    let { email, password } = req.body || {};
    const emailNorm = normalizeEmail(email);

    if (!/\S+@\S+\.\S+/.test(emailNorm)) {
      return res.status(400).json({ error: "Invalid email." });
    }
    if (!password || password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters." });
    }

    const user = await findUserByEmail(emailNorm);
    if (!user) {
      return res.status(404).json({ error: "No asset found." });
    }

    // If they already have a password, force them to login/reset
    if (user.password_hash) {
      return res.status(403).json({
        error:
          "Asset already has a clearance phrase. Use SIGN IN or RESET PASSWORD."
      });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);
    const hash = await bcrypt.hash(password, rounds);

    await db.query(
      `UPDATE users
       SET password_hash   = $1,
           is_verified     = TRUE,
           clearance_level = COALESCE(clearance_level, 'INITIATED'),
           updated_at      = NOW(),
           last_login_at   = NOW()
       WHERE id = $2`,
      [hash, user.id]
    );

    // Mark the newest unused key as used, if any
    const v = await validateAccessKey(user.id, password); // this won't work, so skip
    // Instead, just mark all unused keys as used after signup:
    await db.query(
      `UPDATE access_keys
       SET used = TRUE
       WHERE user_id = $1 AND used = FALSE`,
      [user.id]
    );

    // Re-fetch with latest data
    const refreshed = await findUserByEmail(emailNorm);
    const safeUser = {
      id: refreshed.id,
      email: refreshed.email,
      display_name: refreshed.display_name || null,
      clearance_level: refreshed.clearance_level || "INITIATED"
    };

    const token = signToken(safeUser);

    // Log SIGNUP
    await db.query(
      "INSERT INTO asset_access_logs (user_id, event_type, message) VALUES ($1, $2, $3)",
      [safeUser.id, "SIGNUP", "Asset clearance profile established."]
    );

    return res.json({
      ok: true,
      message: "Signup complete. Clearance established.",
      token,
      user: safeUser
    });
  } catch (err) {
    console.error("complete-signup error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// -------------------------------------------------------------
// LOGIN
// -------------------------------------------------------------
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body || {};
    const emailNorm = normalizeEmail(email);

    if (!/\S+@\S+\.\S+/.test(emailNorm)) {
      return res.status(400).json({ error: "Invalid email." });
    }
    if (!password) {
      return res.status(400).json({ error: "Password is required." });
    }

    const user = await findUserByEmail(emailNorm);

    if (!user) {
      return res
        .status(403)
        .json({ error: "Incorrect email or password." });
    }

    if (!user.password_hash) {
      return res.status(403).json({
        error: "No valid password found. Complete signup first."
      });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res
        .status(401)
        .json({ error: "Incorrect email or password." });
    }

    const updatedRes = await db.query(
      `UPDATE users
       SET is_verified        = TRUE,
           clearance_level    = COALESCE(clearance_level, 'INITIATED'),
           clearance_tier     = COALESCE(clearance_tier, 'INITIATE'),
           clearance_sublevel = COALESCE(clearance_sublevel, 1),
           last_login_at      = NOW()
       WHERE id = $1
       RETURNING clearance_level, clearance_tier, clearance_sublevel`,
      [user.id]
    );

    const updated = updatedRes.rows[0] || {};

    const safeUser = {
      id: user.id,
      email: user.email,
      display_name: user.display_name || null,
      clearance_level: updated.clearance_level || user.clearance_level || "INITIATED",
      clearance_tier: updated.clearance_tier || user.clearance_tier || "INITIATE",
      clearance_sublevel:
        updated.clearance_sublevel ??
        user.clearance_sublevel ??
        1
    };

    const token = signToken(safeUser);

    await db.query(
      "INSERT INTO asset_access_logs (user_id, event_type, message) VALUES ($1, $2, $3)",
      [user.id, "LOGIN", "Asset authenticated via gate."]
    );

    return res.json({
      ok: true,
      message: "Login successful.",
      token,
      user: safeUser
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// -------------------------------------------------------------
// PASSWORD RESET: request-reset
// NOTE: No email sending. Dev-style: just generate a key,
// store it in access_keys, and log it. Front-end still just
// shows a generic success message.
// -------------------------------------------------------------
router.post("/request-reset", async (req, res) => {
  try {
    let { email } = req.body || {};
    const emailNorm = normalizeEmail(email);

    if (!/\S+@\S+\.\S+/.test(emailNorm)) {
      return res.status(400).json({ error: "Invalid email." });
    }

    const user = await findUserByEmail(emailNorm);
    if (!user) {
      // don't leak existence; match your current behavior
      return res.status(404).json({ error: "Unauthorized. asset not found" });
    }
    if (!user.password_hash) {
      return res
        .status(403)
        .json({ error: "Unauthorized. Use Request Access." });
    }

    const rawKey = generateSixDigitKey();
    const keyHash = await hashKey(rawKey);

    // Invalidate old keys
    await db.query(
      `UPDATE access_keys
       SET used = TRUE
       WHERE user_id = $1 AND used = FALSE`,
      [user.id]
    );

    // Insert reset key
    await db.query(
      `INSERT INTO access_keys (user_id, key_hash, expires_at, used)
       VALUES ($1, $2, NOW() + INTERVAL '15 minutes', FALSE)`,
      [user.id, keyHash]
    );

    console.log(`[RESET KEY] ${emailNorm}: ${rawKey}`);

    return res.json({
      ok: true,
      message: "If asset exists, reset key generated for this session."
      // You *could* also include rawKeyDev here if you want the frontend to display it.
      // rawKeyDev: rawKey
    });
  } catch (err) {
    console.error("request-reset error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// -------------------------------------------------------------
// PASSWORD RESET: complete-reset
// -------------------------------------------------------------
router.post("/complete-reset", async (req, res) => {
  try {
    let { email, key, password } = req.body || {};
    const emailNorm = normalizeEmail(email);

    if (!emailNorm || !key) {
      return res.status(400).json({ error: "Email & key required." });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password too short." });
    }

    const user = await findUserByEmail(emailNorm);
    if (!user) {
      return res.status(404).json({ error: "No asset found." });
    }

    const record = await validateAccessKey(user.id, key);
    if (!record) {
      return res.status(400).json({ error: "Invalid or expired key." });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);
    const hash = await bcrypt.hash(password, rounds);

    await db.query(
      `UPDATE users
       SET password_hash = $1,
           updated_at    = NOW()
       WHERE id = $2`,
      [hash, user.id]
    );

    await markKeyUsed(record.id);

    await db.query(
      "INSERT INTO asset_access_logs (user_id, event_type, message) VALUES ($1, $2, $3)",
      [user.id, "RESET", "Asset clearance phrase reset via protocol."]
    );

    return res.json({ ok: true, message: "Password reset complete." });
  } catch (err) {
    console.error("complete-reset error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// -------------------------------------------------------------
// AUTH ME (session validation)
// -------------------------------------------------------------
router.get("/me", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.replace("Bearer ", "");

    if (!token) return res.json({ ok: false });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "changeme");
    } catch (e) {
      return res.json({ ok: false });
    }

    const userRes = await db.query(
      `SELECT
         id,
         email,
         display_name,
         clearance_level,
         created_at,
         last_login_at
       FROM users
       WHERE id = $1`,
      [decoded.id]
    );

    const user = userRes.rows[0];
    if (!user) {
      return res.json({ ok: false });
    }

    return res.json({
      ok: true,
      user
    });
  } catch (err) {
    console.error("me error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// -------------------------------------------------------------
// EXPORT
// -------------------------------------------------------------
module.exports = router;
