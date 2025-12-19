// routes/profile.js
const express = require("express");
const db = require("../db");
const {
  clearanceForSuccessfulMissions,
  progressPctToNextTier
} = require("../kryptyk-labs-api/clearance");
async function logAssetEvent(userId, eventType, message, meta) {
  try {
    await db.query(
      `
      INSERT INTO asset_access_logs (user_id, event_type, message, meta)
      VALUES ($1, $2, $3, $4)
      `,
      [userId, eventType, message || null, meta || null]
    );
  } catch (err) {
    // Don't crash the request if logging fails
    console.warn("[LOG] failed to insert asset_access_logs row:", err.message);
  }
}

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

    // Authoritative mission progress
    let missionsCompleted = 0;
    try {
      const mc = await db.query(
        "SELECT COUNT(*)::int AS c FROM mission_completions WHERE user_id = $1 AND success = TRUE",
        [user.id]
      );
      missionsCompleted = mc.rows[0]?.c || 0;
    } catch (err) {
      // If table doesn't exist yet in a fresh DB, keep 0.
      if (err.code !== "42P01") {
        throw err;
      }
    }

    const computedClearance = clearanceForSuccessfulMissions(missionsCompleted);
    const progressPct = progressPctToNextTier(missionsCompleted);

    // Keep users table synced to authoritative rules (non-fatal if table missing).
    try {
      await db.query(
        "UPDATE users SET clearance_level = $1, clearance_progress_pct = $2 WHERE id = $3",
        [computedClearance, progressPct, user.id]
      );
    } catch (err) {
      console.warn("[PROFILE] failed to sync clearance/progress:", err.message);
    }

    const clearance = computedClearance;
    const xp = 0;

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
      .json({ ok: false, error: "Failed to load profile summary." });
  }
});



// PUT /api/profile/settings (motto, maybe later more)
// PUT /api/profile/settings (motto, display_name)
router.put("/settings", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { motto, display_name } = req.body || {};

    const updates = [];
    const values = [];
    let idx = 1;

    // Motto update (optional)
    if (typeof motto !== "undefined") {
      updates.push(`motto = $${idx}`);
      values.push(motto || null);
      idx++;
    }

    // Display name update (optional)
    if (typeof display_name !== "undefined") {
      const normalizedDisplayName = String(display_name || "").trim();
      updates.push(`display_name = $${idx}`);
      values.push(normalizedDisplayName.length ? normalizedDisplayName : null);
      idx++;
    }

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ ok: false, error: "No valid profile settings provided." });
    }

    values.push(userId);
    const sql = `UPDATE users SET ${updates.join(", ")} WHERE id = $${idx}`;
    await db.query(sql, values);

    // Optional logging – skip cleanly if asset_access_logs doesn’t exist
    try {
      await db.query(
        "INSERT INTO asset_access_logs (user_id, event_type, message) VALUES ($1, $2, $3)",
        [
          userId,
          "PROFILE_UPDATE",
          display_name
            ? "Asset display name updated."
            : "Asset motto updated."
        ]
      );
    } catch (logErr) {
      if (logErr.code === "42P01") {
        console.warn(
          "[PROFILE] asset_access_logs table missing during settings update; skipping log."
        );
      } else {
        console.warn("[PROFILE] settings log insert failed:", logErr);
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    if (err && err.code === "23505") {
      // Unique violation (display name already taken)
      if (err.constraint === "idx_users_display_name_unique") {
        return res.status(409).json({
          ok: false,
          error: "Display name already in use. Choose a different name."
        });
      }
    }
    console.error("/api/profile/settings error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to update profile settings." });
  }
});

// GET /api/profile/archive
// Returns archived events (briefings & missions) for the current asset
router.get("/archive", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Only pull mission / briefing related events
    const { rows } = await db.query(
      `
      SELECT
        id,
        event_type,
        message,
        meta,
        created_at
      FROM asset_access_logs
      WHERE user_id = $1
        AND event_type IN (
          'BRIEFING_VIEW',
          'BRIEFING_ACK',
          'MISSION_UNLOCK',
          'MISSION_START',
          'MISSION_COMPLETE'
        )
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [userId]
    );

    return res.json({
      ok: true,
      events: rows
    });
  } catch (err) {
    console.error("/api/profile/archive error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load archive from the lab console."
    });
  }
});



module.exports = router;


