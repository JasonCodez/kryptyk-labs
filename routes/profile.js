// routes/profile.js
const express = require("express");
const db = require("../db");
const authMiddleware = require("../kryptyk-labs-api/middleware/auth"); // adjust path if needed

const router = express.Router();

// Helper: deterministic sector if null
function deriveSector(userId, email) {
  const sectors = [
    "CRYPTOGRAPHY DIVISION",
    "SIGNAL INTELLIGENCE",
    "ARCHIVE OPERATIONS",
    "FIELD SYSTEMS",
    "SIMULATION LAB",
    "BLACK VAULT"
  ];
  let seed = userId || 0;
  if (email) {
    for (const ch of email) {
      seed += ch.charCodeAt(0);
    }
  }
  return sectors[seed % sectors.length];
}

// GET /api/profile/summary
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Pull only columns that actually exist in your users table
    const userRes = await db.query(
      `SELECT id,
              email,
              display_name,
              clearance_level,
              motto,
              clearance_progress_pct,
              created_at,
              last_login_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const user = userRes.rows[0];
    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found." });
    }

    // Sector is derived in code, not stored in DB
    const sector = deriveSector(user.id, user.email);

    const clearance = (user.clearance_level || "INITIATED").toUpperCase();

    // Use stored clearance_progress_pct or default to 5
    const rawProgress =
      typeof user.clearance_progress_pct === "number"
        ? user.clearance_progress_pct
        : 5;
    const progressPct = Math.max(0, Math.min(100, rawProgress));

    // XP / missions = placeholders for now
    const xp = 0;
    const missionsCompleted = 0;

    // Try to load logs; if the table doesn't exist, just return an empty list
    let logs = [];
    try {
      const logsRes = await db.query(
        `SELECT event_type, message, created_at
         FROM asset_access_logs
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 25`,
        [user.id]
      );
      logs = logsRes.rows;
    } catch (err) {
      // 42P01 = table does not exist
      if (err.code === "42P01") {
        console.warn(
          "[PROFILE] asset_access_logs table missing; returning empty logs."
        );
        logs = [];
      } else {
        throw err;
      }
    }

    return res.json({
      ok: true,
      profile: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        clearance_level: clearance,
        motto: user.motto,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
        sector,
        xp,
        missions_completed: missionsCompleted,
        profile_image_url: null,
        clearance_progress_pct: progressPct
      },
      logs
    });

  } catch (err) {
    console.error("/api/profile/summary error:", err);
    return res
      .status(500)
      .json({ok: false, error: "Failed to load profile summary." });
  }
});



// PUT /api/profile/settings (motto, maybe later more)
router.put("/settings", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { motto } = req.body;

    await db.query("UPDATE users SET motto = $1 WHERE id = $2", [
      motto || null,
      userId
    ]);

    await db.query(
      "INSERT INTO asset_access_logs (user_id, event_type, message) VALUES ($1, $2, $3)",
      [userId, "PROFILE_UPDATE", "Asset motto updated."]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("/api/profile/settings error:", err);
    return res
      .status(500)
      .json({ error: "Failed to update profile settings." });
  }
});

module.exports = router;


