// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const multer = require("multer");
const path = require("path");
const ACCESS_KEY_TTL_MINUTES = Number(process.env.ACCESS_KEY_TTL_MINUTES || 15);


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
// routes/auth.js (or wherever your auth routes live)
// routes/auth.js (inside your router)

const ACCESS_KEY_TTL_MINUTES = 15; // or whatever you’re using

router.post("/request-access", async (req, res) => {
  try {
    console.log("[REQUEST-ACCESS] incoming body:", req.body);

    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Valid email is required."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({
        ok: false,
        error: "Email cannot be empty."
      });
    }

    // 1) Generate a numeric 6-digit key, e.g. "482190"
    const rawKey = crypto
      .randomInt(0, 1_000_000)
      .toString()
      .padStart(6, "0");

    // 2) Random drift 0–9 (or 1–9 if you prefer)
    const shift = crypto.randomInt(0, 10);

    // 3) Cipher = each digit shifted forward by `shift` mod 10
    const cipher = rawKey
      .split("")
      .map((ch) => {
        const d = parseInt(ch, 10);
        return ((d + shift) % 10).toString();
      })
      .join("");

    // 4) Hash the ORIGINAL numeric key
    const keyHash = await bcrypt.hash(rawKey, 10);

    // 5) Store in access_keys
    await db.query(
      `
      INSERT INTO access_keys (
        email,
        key_hash,
        created_at,
        expires_at,
        used_at,
        attempts,
        used
      )
      VALUES (
        $1,
        $2,
        NOW(),
        NOW() + interval '${ACCESS_KEY_TTL_MINUTES} minutes',
        NULL,
        0,
        FALSE
      )
      `,
      [normalizedEmail, keyHash]
    );

    console.log(
      "[ACCESS KEY GENERATED]",
      normalizedEmail,
      "rawKey=",
      rawKey,
      "cipher=",
      cipher,
      "shift=",
      shift
    );

    return res.json({
      ok: true,
      message: "Access key generated and dispatched.",
      cipher,
      shift,
      debug_key: rawKey // remove once you're done testing
    });
  } catch (err) {
    console.error("request-access error:", err);
    return res.status(500).json({
      ok: false,
      error: "The lab console failed to generate an access key."
    });
  }
});




// -------------------------------------------------------------
// VERIFY KEY (Step 2)
// Expects the *real* 6-digit key, not the cipher
// -------------------------------------------------------------
const MAX_KEY_ATTEMPTS = 5;

router.post("/verify-key", async (req, res) => {
  try {
    console.log("[VERIFY-KEY] incoming body:", req.body);

    const { email, key } = req.body;

    // Basic validation
    if (!email || typeof email !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Valid email is required."
      });
    }
    if (!key || typeof key !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Valid access key is required."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const submittedKey = key.trim(); // should be the 6-digit decrypted key

    // Fetch the latest access_key row for this email
    const { rows } = await db.query(
      `
      SELECT id, email, key_hash, created_at, expires_at, used, attempts
      FROM access_keys
      WHERE email = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [normalizedEmail]
    );

    if (!rows.length) {
      console.warn("[VERIFY-KEY] no access key row found for", normalizedEmail);
      return res.status(400).json({
        ok: false,
        error: "Access key invalid or expired."
      });
    }

    const keyRow = rows[0];

    // Check used / attempts / expiry
    const now = new Date();

    if (keyRow.used) {
      return res.status(400).json({
        ok: false,
        error: "This access key has already been used."
      });
    }

    if (keyRow.attempts >= MAX_KEY_ATTEMPTS) {
      return res.status(400).json({
        ok: false,
        error: "Too many attempts. Request a new access key."
      });
    }

    if (keyRow.expires_at && new Date(keyRow.expires_at) < now) {
      return res.status(400).json({
        ok: false,
        error: "This access key has expired. Request a new one."
      });
    }

    // Compare submitted key (plain 6-digit) with stored hash
    const isMatch = await bcrypt.compare(submittedKey, keyRow.key_hash);

    console.log(
      "[VERIFY-KEY] compare result",
      { normalizedEmail, submittedKey, isMatch }
    );

    if (!isMatch) {
      // bump attempts
      await db.query(
        `UPDATE access_keys SET attempts = attempts + 1 WHERE id = $1`,
        [keyRow.id]
      );

      return res.status(400).json({
        ok: false,
        error: "Access key invalid. Check your decryption."
      });
    }

    // Mark this key as used
    await db.query(
      `
      UPDATE access_keys
      SET used = TRUE,
          used_at = NOW(),
          attempts = attempts + 1
      WHERE id = $1
      `,
      [keyRow.id]
    );

    // At this point key is valid – either find or create the user record
    const userResult = await db.query(
      `
      SELECT id, email, display_name, clearance_level, clearance_progress_pct
      FROM users
      WHERE email = $1
      `,
      [normalizedEmail]
    );

    let user = userResult.rows[0];

    if (!user) {
      // Initial user creation for new asset
      const insertUser = await db.query(
        `
        INSERT INTO users (
          email,
          password_hash,
          display_name,
          clearance_level,
          clearance_progress_pct,
          created_at,
          last_login_at,
          is_verified
        )
        VALUES (
          $1,
          NULL,
          NULL,
          'INITIATED',
          5,
          NOW(),
          NULL,
          FALSE
        )
        RETURNING id, email, display_name, clearance_level, clearance_progress_pct
        `,
        [normalizedEmail]
      );

      user = insertUser.rows[0];
      console.log("[VERIFY-KEY] created new user for", normalizedEmail);
    }

    // TODO: you might keep origin_dossier flags etc. here if you want

    return res.json({
      ok: true,
      message: "Access key verified.",
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        clearance_level: user.clearance_level,
        clearance_progress_pct: user.clearance_progress_pct
      }
    });
  } catch (err) {
    console.error("verify-key error:", err);
    return res.status(500).json({
      ok: false,
      error: "The lab console failed to verify that key."
    });
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
// ---------- REQUEST PASSWORD RESET ----------
router.post("/request-reset", async (req, res) => {
  const rawEmail = req.body?.email;

  if (!rawEmail || typeof rawEmail !== "string") {
    console.log("[REQUEST-RESET] missing or invalid email in body:", req.body);
    return res.status(400).json({
      ok: false,
      error: "A valid email is required."
    });
  }

  const email = rawEmail.trim().toLowerCase();
  console.log("[REQUEST-RESET] normalizedEmail:", email);

  try {
    // 1) Look up user; if not found, respond success anyway to avoid leaking which emails exist
    const userResult = await db.query(
      `SELECT id, email, is_verified
       FROM users
       WHERE email = $1`,
      [email]
    );

    const user = userResult.rows[0];
    if (!user) {
      console.log("[REQUEST-RESET] no user for email, returning generic success");
      return res.json({
        ok: true,
        message: "If this asset exists in the lab, a reset key has been dispatched."
      });
    }

    // (Optional) if you want to require verified accounts only:
    // if (!user.is_verified) {
    //   return res.status(400).json({
    //     ok: false,
    //     error: "This asset has not completed initial verification."
    //   });
    // }

    // 2) Generate reset key
    const plainKey = Math.floor(100000 + Math.random() * 900000).toString();
    const keyHash = await bcrypt.hash(plainKey, BCRYPT_ROUNDS);

    // 3) Insert reset key into access_keys INCLUDING email
    const insertKeySql = `
      INSERT INTO access_keys (
        email,
        key_hash,
        created_at,
        expires_at,
        used_at,
        attempts,
        used
      )
      VALUES (
        $1,
        $2,
        NOW(),
        NOW() + interval '15 minutes',
        NULL,
        0,
        FALSE
      )
      RETURNING id, email, created_at, expires_at;
    `;

    console.log("[REQUEST-RESET] inserting reset key for:", email);
    const keyResult = await db.query(insertKeySql, [email, keyHash]);
    console.log("[REQUEST-RESET] inserted access_key row (reset):", keyResult.rows[0]);

    // 4) TODO: send reset email here using your mailer (with plainKey)
    console.log("[REQUEST-RESET] plain reset key (for testing only):", plainKey);

    return res.json({
      ok: true,
      message: "If this asset exists in the lab, a reset key has been dispatched."
    });
  } catch (err) {
    console.error("request-reset error:", err);
    return res.status(500).json({
      ok: false,
      error: "The lab console failed to generate your reset key."
    });
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
