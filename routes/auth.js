// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const multer = require("multer");
const path = require("path");
const ACCESS_KEY_TTL_MINUTES = Number(process.env.ACCESS_KEY_TTL_MINUTES || 15);


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
       AND kind = 'signup'
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
        , used_at = COALESCE(used_at, NOW())
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

    // If user already exists and has a password set, force them to sign in.
    const existing = await findUserByEmail(normalizedEmail);
    if (existing && existing.password_hash) {
      return res.status(400).json({
        ok: false,
        error:
          "This asset already has credentials. Use SIGN IN to authenticate."
      });
    }

    // Create a user placeholder if one doesn't exist (so we have a user_id)
    let user = existing;
    if (!user) {
      const insertUser = await db.query(
        `INSERT INTO users (email, clearance_level, clearance_progress_pct, created_at, is_verified)
         VALUES ($1, 'INITIATED', 0, NOW(), FALSE)
         RETURNING id, email, display_name, clearance_level, clearance_progress_pct`,
        [normalizedEmail]
      );
      user = insertUser.rows[0];
      console.log("[REQUEST-ACCESS] created placeholder user:", user.id);
    }

    // Generate a 6-digit key
    const rawKey = generateSixDigitKey();
    const key_hash = await hashKey(rawKey);

    // Choose a numeric shift (1–9)
    const shift = Math.floor(Math.random() * 9) + 1;
    const cipher = encryptKeyWithShift(rawKey, shift);

    const ttl = ACCESS_KEY_TTL_MINUTES;
    const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

    // Store key tied to email (your later flow uses email)
    await db.query(
      `INSERT INTO access_keys (email, user_id, key_hash, kind, created_at, expires_at, used, attempts)
       VALUES ($1, $2, $3, 'signup', NOW(), $4, FALSE, 0)`,
      [normalizedEmail, user.id, key_hash, expiresAt]
    );

    console.log("[REQUEST-ACCESS] shift:", shift, "rawKey(test):", rawKey);

    return res.json({
      ok: true,
      message: "Access key dispatched (ciphered).",
      cipher,
      shift
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
// -------------------------------------------------------------
router.post("/verify-key", async (req, res) => {
  try {
    const { email, key } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !/\S+@\S+\.\S+/.test(normalizedEmail)) {
      return res.status(400).json({ ok: false, error: "Invalid email." });
    }
    if (!key || typeof key !== "string") {
      return res.status(400).json({ ok: false, error: "Key is required." });
    }

    // Find the newest access key row for this email
    const keyRes = await db.query(
      `SELECT id, key_hash, expires_at, used, attempts
       FROM access_keys
       WHERE email = $1
         AND kind = 'signup'
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedEmail]
    );

    const row = keyRes.rows[0];
    if (!row) {
      return res.status(400).json({
        ok: false,
        error: "No access key found. Request a new key."
      });
    }

    if (row.used) {
      return res.status(400).json({
        ok: false,
        error: "This access key has already been used. Request a new one."
      });
    }

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.status(400).json({
        ok: false,
        error: "This access key has expired. Request a new one."
      });
    }

    // Compare provided key against hash
    const ok = await bcrypt.compare(key, row.key_hash);
    if (!ok) {
      // increment attempts
      await db.query(
        `UPDATE access_keys SET attempts = COALESCE(attempts, 0) + 1 WHERE id = $1`,
        [row.id]
      );
      return res.status(400).json({
        ok: false,
        error: "Invalid access key."
      });
    }

    // Find user now (for returning info)
    let user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(400).json({
        ok: false,
        error:
          "Asset record not found for this email. Request access again."
      });
    }

    // We do NOT mark the key as used here anymore.
    // That happens only in /complete-signup after password is set.

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
      error: "The gate subsystem glitched while verifying your key."
    });
  }
});

// -------------------------------------------------------------
// COMPLETE SIGNUP (Step 3)
// -------------------------------------------------------------

// ---------- COMPLETE SIGNUP (set password + create user) ----------
router.post("/complete-signup", async (req, res) => {
  const { email, password, display_name, security_question, security_answer } =
    req.body;

  try {
    console.log("[COMPLETE-SIGNUP] incoming body:", {
      email,
      hasPassword: !!password,
      display_name
    });

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Email is required to complete signup."
      });
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        ok: false,
        error: "Password must be at least 8 characters."
      });
    }

    if (!security_question || typeof security_question !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Security question is required."
      });
    }

    if (!security_answer || typeof security_answer !== "string" || !security_answer.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Security answer is required."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({
        ok: false,
        error: "Email cannot be empty."
      });
    }

    const client = await db.pool.connect();

    try {
      await client.query("BEGIN");

      // 1) Get a valid (unused, unexpired) access key for this email
      const keyRes = await client.query(
        `
        SELECT id, used, expires_at
        FROM access_keys
        WHERE email = $1
          AND kind = 'signup'
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [normalizedEmail]
      );

      if (keyRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          ok: false,
          error:
            "No valid access key found for that email.\nRequest a new key and try again."
        });
      }

      const keyRow = keyRes.rows[0];

      if (keyRow.used) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          ok: false,
          error: "This access key has already been used. Request a new key."
        });
      }

      if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          ok: false,
          error: "This access key has expired. Request a new one from the gate."
        });
      }

      const accessKeyId = keyRow.id;

      // 2) Hash password with env-configured rounds
      const rounds = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);
      const passwordHash = await bcrypt.hash(password, rounds);

      const securityAnswerHash = await bcrypt.hash(security_answer.trim(), rounds);

      // 3) Upsert user with password + optional display_name
      const userRes = await client.query(
        `
  INSERT INTO users (
    email,
    password_hash,
    display_name,
    security_question,
    security_answer_hash,
    clearance_level,
    clearance_progress_pct,
    created_at,
    last_login_at,
    is_verified
  )
  VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    'INITIATED',
    5,
    NOW(),
    NULL,
    TRUE
  )
  ON CONFLICT (email) DO UPDATE
  SET
    password_hash = EXCLUDED.password_hash,
    display_name = COALESCE(EXCLUDED.display_name, users.display_name),
    security_question = COALESCE(EXCLUDED.security_question, users.security_question),
    security_answer_hash = COALESCE(EXCLUDED.security_answer_hash, users.security_answer_hash),
    is_verified   = TRUE
  RETURNING
    id,
    email,
    display_name,
    clearance_level,
    clearance_progress_pct,
    debrief_seen,
    debrief_seen_at
  `,
        [
          normalizedEmail,
          passwordHash,
          display_name || null,
          security_question,
          securityAnswerHash
        ]
      );

      const user = userRes.rows[0];

      // 4) Mark that access key as used
      await client.query(
        `
        UPDATE access_keys
        SET used = TRUE,
            used_at = COALESCE(used_at, NOW())
        WHERE id = $1
        `,
        [accessKeyId]
      );

      // 5) Commit the transaction
      await client.query("COMMIT");

      // 6) Issue JWT using the same helper as /login
      const safeUser = {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        clearance_level: user.clearance_level,
        clearance_progress_pct: user.clearance_progress_pct,
        debrief_seen: !!user.debrief_seen
      };

      const token = signToken(safeUser);

      console.log("[COMPLETE-SIGNUP] success for:", safeUser.email);

      return res.json({
        ok: true,
        message: "Signup complete.",
        token,
        user: safeUser
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("complete-signup transaction error:", err);
      return res.status(500).json({
        ok: false,
        error:
          "The lab console failed to finalize your asset credentials. Try again in a moment."
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("complete-signup outer error:", err);
    return res.status(500).json({
      ok: false,
      error: "The lab console is unstable. Please try again shortly."
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
       SET is_verified     = TRUE,
           clearance_level = COALESCE(clearance_level, 'INITIATED'),
           last_login_at   = NOW()
       WHERE id = $1
       RETURNING clearance_level`,
      [user.id]
    );

    const updated = updatedRes.rows[0] || {};

    const safeUser = {
      id: user.id,
      email: user.email,
      display_name: user.display_name || null,
      clearance_level:
        updated.clearance_level || user.clearance_level || "INITIATED",
      debrief_seen: !!user.debrief_seen
    };

    const token = signToken(safeUser);

    // Optional logging – skip cleanly if asset_access_logs doesn't exist yet
    try {
      await db.query(
        "INSERT INTO asset_access_logs (user_id, event_type, message) VALUES ($1, $2, $3)",
        [user.id, "LOGIN", "Asset authenticated via gate."]
      );
    } catch (logErr) {
      if (logErr.code === "42P01") {
        console.warn(
          "[AUTH] asset_access_logs table missing on login; skipping log insert."
        );
      } else {
        console.warn("[AUTH] login log insert failed:", logErr);
      }
    }

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
      `SELECT id, email, is_verified, security_question, security_answer_hash
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

    // Return security question (no key yet). Key is issued only after answering.
    if (!user.security_question || !user.security_answer_hash) {
      return res.status(400).json({
        ok: false,
        error:
          "No reset protocol is configured for this asset. Complete signup again or contact an administrator."
      });
    }

    return res.json({
      ok: true,
      message: "Security prompt retrieved.",
      question: user.security_question
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
// PASSWORD RESET: verify-reset-answer
// Body: { email, answer }
// Returns: { ok: true, reset_key }
// -------------------------------------------------------------
router.post("/verify-reset-answer", async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    const answer = req.body?.answer;

    const email = normalizeEmail(rawEmail);
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email." });
    }
    if (!answer || typeof answer !== "string" || !answer.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Security answer is required."
      });
    }

    const user = await findUserByEmail(email);
    if (!user || !user.security_answer_hash) {
      return res.status(400).json({
        ok: false,
        error: "Reset failed. Verify your prompt and try again."
      });
    }

    const ok = await bcrypt.compare(answer.trim(), user.security_answer_hash);
    if (!ok) {
      return res.status(400).json({
        ok: false,
        error: "Incorrect security answer."
      });
    }

    // Generate reset key and store it
    const plainKey = generateSixDigitKey();
    const keyHash = await hashKey(plainKey);

    const insertKeySql = `
      INSERT INTO access_keys (
        email,
        user_id,
        key_hash,
        kind,
        created_at,
        expires_at,
        used_at,
        attempts,
        used
      )
      VALUES (
        $1,
        $2,
        $3,
        'reset',
        NOW(),
        NOW() + interval '15 minutes',
        NULL,
        0,
        FALSE
      )
      RETURNING id, created_at, expires_at;
    `;

    await db.query(insertKeySql, [email, user.id, keyHash]);

    return res.json({
      ok: true,
      message: "Reset key issued.",
      reset_key: plainKey
    });
  } catch (err) {
    console.error("verify-reset-answer error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to verify security answer." });
  }
});

// -------------------------------------------------------------
// PASSWORD RESET: complete-reset
// Body: { email, key, password }
// -------------------------------------------------------------
router.post("/complete-reset", async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    const key = req.body?.key;
    const password = req.body?.password;

    const email = normalizeEmail(rawEmail);
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email." });
    }
    if (!key || typeof key !== "string") {
      return res.status(400).json({ ok: false, error: "Reset key is required." });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        ok: false,
        error: "Password must be at least 8 characters."
      });
    }

    // Find user (do not leak if missing; respond generic-ish)
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(400).json({
        ok: false,
        error: "Reset failed. Request a new reset key and try again."
      });
    }

    // Find newest reset key row for this email
    const keyRes = await db.query(
      `SELECT id, key_hash, expires_at, used, attempts
       FROM access_keys
       WHERE email = $1
         AND kind = 'reset'
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    const row = keyRes.rows[0];
    if (!row) {
      return res.status(400).json({
        ok: false,
        error: "No reset key found. Request a new one."
      });
    }
    if (row.used) {
      return res.status(400).json({
        ok: false,
        error: "This reset key has already been used. Request a new one."
      });
    }
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.status(400).json({
        ok: false,
        error: "This reset key has expired. Request a new one."
      });
    }

    const ok = await bcrypt.compare(key, row.key_hash);
    if (!ok) {
      await db.query(
        `UPDATE access_keys SET attempts = COALESCE(attempts, 0) + 1 WHERE id = $1`,
        [row.id]
      );
      return res.status(400).json({ ok: false, error: "Invalid reset key." });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);
    const passwordHash = await bcrypt.hash(password, rounds);

    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE users
         SET password_hash = $1,
             is_verified = TRUE
         WHERE id = $2`,
        [passwordHash, user.id]
      );

      await client.query(
        `UPDATE access_keys
         SET used = TRUE,
             used_at = COALESCE(used_at, NOW())
         WHERE id = $1`,
        [row.id]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("complete-reset error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to complete reset." });
  }
});

// -------------------------------------------------------------
// ONBOARDING: mark debrief as seen (one-time)
// -------------------------------------------------------------
router.post("/debrief-complete", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.replace("Bearer ", "");

    if (!token) return res.status(401).json({ ok: false });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "changeme");
    } catch (e) {
      return res.status(401).json({ ok: false });
    }

    await db.query(
      `UPDATE users
       SET debrief_seen = TRUE,
           debrief_seen_at = COALESCE(debrief_seen_at, NOW())
       WHERE id = $1`,
      [decoded.id]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("debrief-complete error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error." });
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
         last_login_at,
         debrief_seen,
         debrief_seen_at
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
