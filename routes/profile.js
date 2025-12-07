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

    const userRes = await db.query(
      `SELECT id, email, display_name, clearance_level,
              created_at, last_login_at, sector, motto,
              xp, missions_completed, profile_image_url
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const user = userRes.rows[0];
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    let sector = user.sector;
    if (!sector) {
      sector = deriveSector(user.id, user.email);
      await db.query(
        "UPDATE users SET sector = $1 WHERE id = $2",
        [sector, user.id]
      );
    }

    // Basic clearance progression: 0–100 per level
    const xp = user.xp || 0;
    const missionsCompleted = user.missions_completed || 0;
    const clearance = (user.clearance_level || "INITIATED").toUpperCase();

    const levelThresholds = {
      INITIATED: 0,
      OPERATIVE: 200,
      ARCHIVIST: 500,
      ADMIN: 1000
    };

    const currentBase = levelThresholds[clearance] ?? 0;
    const nextBase =
      clearance === "INITIATED"
        ? levelThresholds.OPERATIVE
        : clearance === "OPERATIVE"
        ? levelThresholds.ARCHIVIST
        : clearance === "ARCHIVIST"
        ? levelThresholds.ADMIN
        : levelThresholds.ADMIN;

    const normalized = Math.max(0, xp - currentBase);
    const span = Math.max(1, nextBase - currentBase);
    const progressPct = Math.max(
      0,
      Math.min(100, Math.round((normalized / span) * 100))
    );

    // Recent logs
    const logsRes = await db.query(
      `SELECT event_type, message, created_at
       FROM asset_access_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );

    return res.json({
      ok: true,
      profile: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        clearance_level: clearance,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
        sector,
        motto: user.motto,
        xp,
        missions_completed: missionsCompleted,
        profile_image_url: user.profile_image_url,
        clearance_progress_pct: progressPct
      },
      logs: logsRes.rows
    });
  } catch (err) {
    console.error("/api/profile/summary error:", err);
    return res
      .status(500)
      .json({ error: "Failed to load profile summary." });
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

// // routes/profile.js
// const express = require("express");
// const jwt = require("jsonwebtoken");
// const db = require("../db");

// const router = express.Router();

// /**
//  * Small auth middleware for profile routes
//  * Expects Authorization: Bearer <token>
//  */
// function requireAuth(req, res, next) {
//   const auth = req.headers.authorization || "";
//   const token = auth.replace("Bearer ", "").trim();

//   if (!token) {
//     return res.status(401).json({ ok: false, error: "Missing token." });
//   }

//   let decoded;
//   try {
//     decoded = jwt.verify(token, process.env.JWT_SECRET || "changeme");
//   } catch (err) {
//     console.error("profile requireAuth token error:", err);
//     return res.status(401).json({ ok: false, error: "Invalid token." });
//   }

//   req.userId = decoded.id;
//   req.userEmail = decoded.email;
//   next();
// }

// /**
//  * GET /api/profile/summary
//  * Used by assets/js/profile.js → loadProfileFromServer()
//  */
// router.get("/summary", requireAuth, async (req, res) => {
//   try {
//     const userId = req.userId;

//     // Pull core profile fields from users table
//     const userRes = await db.query(
//       `
//       SELECT
//         id,
//         email,
//         display_name,
//         clearance_level,
//         created_at,
//         last_login_at,
//         sector,
//         missions_completed,
//         motto,
//         profile_image_url
//       FROM users
//       WHERE id = $1
//       `,
//       [userId]
//     );

//     const user = userRes.rows[0];
//     if (!user) {
//       return res.status(404).json({ ok: false, error: "Asset not found." });
//     }

//     // Fake / basic progress for now if you don't have a real formula
//     const clearanceProgressPct = 5;

//     // Recent logs from asset_access_logs if present
//     let logs = [];
//     try {
//       const logsRes = await db.query(
//         `
//         SELECT event_type, message, created_at
//         FROM asset_access_logs
//         WHERE user_id = $1
//         ORDER BY created_at DESC
//         LIMIT 25
//         `,
//         [userId]
//       );
//       logs = logsRes.rows || [];
//     } catch (logErr) {
//       console.warn("Profile summary: unable to load logs:", logErr.message);
//       logs = [];
//     }

//     return res.json({
//       ok: true,
//       profile: {
//         id: user.id,
//         email: user.email,
//         display_name: user.display_name,
//         clearance_level: user.clearance_level || "INITIATED",
//         created_at: user.created_at,
//         last_login_at: user.last_login_at,
//         sector: user.sector,
//         missions_completed: user.missions_completed,
//         motto: user.motto,
//         profile_image_url: user.profile_image_url,
//         clearance_progress_pct: clearanceProgressPct
//       },
//       logs
//     });
//   } catch (err) {
//     console.error("profile summary error:", err);
//     return res.status(500).json({ ok: false, error: "Internal server error." });
//   }
// });

// /**
//  * PUT /api/profile/settings
//  * Used by assets/js/profile.js motto form
//  */
// router.put("/settings", requireAuth, async (req, res) => {
//   try {
//     const userId = req.userId;
//     const { motto } = req.body || {};

//     if (typeof motto !== "string" || motto.trim().length === 0) {
//       return res
//         .status(400)
//         .json({ ok: false, error: "Motto cannot be empty." });
//     }

//     const trimmed = motto.trim().slice(0, 240);

//     await db.query(
//       `
//       UPDATE users
//       SET motto = $1,
//           updated_at = NOW()
//       WHERE id = $2
//       `,
//       [trimmed, userId]
//     );

//     await db.query(
//       `
//       INSERT INTO asset_access_logs (user_id, event_type, message)
//       VALUES ($1, $2, $3)
//       `,
//       [userId, "PROFILE", "Asset motto updated from profile console."]
//     );

//     return res.json({ ok: true, motto: trimmed });
//   } catch (err) {
//     console.error("profile settings error:", err);
//     return res.status(500).json({ ok: false, error: "Internal server error." });
//   }
// });

// module.exports = router;

